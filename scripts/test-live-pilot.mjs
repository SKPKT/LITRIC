// Explicit operator-only acceptance test. Never runs in CI or against Sites.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import ts from 'typescript';
import { hashPassword } from '../lib/standalone-auth.mjs';

if (process.env.LITRIC_ALLOW_SYNTHETIC_PILOT !== '1') throw new Error('Explicit synthetic pilot authorization required.');
const origin = process.env.LITRIC_PRODUCTION_URL;
const config = JSON.parse(fs.readFileSync('standalone/wrangler.generated.jsonc', 'utf8'));
if (!origin || new URL(origin).origin !== origin || !origin.startsWith('https://') || !new URL(origin).hostname.endsWith('.workers.dev') || !new URL(origin).hostname.startsWith(config.name + '.')) throw new Error('Invalid school pilot origin.');
const dir = process.argv.includes('--cleanup') ? process.env.LITRIC_QA_DIRECTORY : fs.mkdtempSync(path.join(os.tmpdir(), 'litric-live-qa-'));
if (!dir || fs.realpathSync(path.dirname(dir)) !== fs.realpathSync(os.tmpdir()) || !path.basename(dir).startsWith('litric-live-qa-')) throw new Error('Invalid QA temporary directory.');
const q = (v) => "'" + String(v).replaceAll("'", "''") + "'";
function sql(text) {
  const file = path.join(dir, 'operation.sql');
  fs.writeFileSync(file, text, { mode: 0o600 });
  try {
    const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'litric-school', '--remote', '--config', 'standalone/wrangler.generated.jsonc', '--file', file, '--json'], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error('Pilot QA database operation failed; sensitive SQL is not logged.');
    return true;
  } finally { fs.rmSync(file, { force: true }); }
}
function cleanup(state) {
  if (state.origin !== origin || !state.username.startsWith('QA_')) throw new Error('QA ownership mismatch.');
  sql(`DELETE FROM auth_sessions WHERE user_id=${q(state.id)};
DELETE FROM auth_accounts WHERE user_id=${q(state.id)} AND username=${q(state.username)};
UPDATE users SET active=0 WHERE id=${q(state.id)} AND name='PENTADBIR QA SINTETIK';
UPDATE import_batches SET status='rolled_back',star_eligible=0 WHERE created_by=${q(state.id)} AND dataset IN (${q('QA-SINTETIK-' + state.id)},${q('QA-OVERLAP-' + state.id)});
${state.studentId ? `UPDATE students SET archived_at=${q(new Date().toISOString())},status='transferred' WHERE id=${q(state.studentId)} AND name=${q(state.studentName)};` : ''}`);
}
if (process.argv.includes('--cleanup')) {
  const state = JSON.parse(fs.readFileSync(path.join(dir, 'browser-qa.json'), 'utf8'));
  cleanup(state);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('QA credentials revoked; synthetic imports rolled back and student archived; history preserved.');
  process.exit(0);
}
const state = { origin, id: crypto.randomUUID(), username: 'QA_' + crypto.randomUUID().slice(0, 8), password: crypto.randomUUID(), studentName: 'MURID QA SINTETIK ' + crypto.randomUUID().slice(0, 8) };
let token = '', complete = false;
const checks = [];
async function call(route, body, status = 200, headers = {}) {
  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      result = await fetch(origin + '/api/' + route, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      break;
    } catch { if (attempt === 2) throw new Error('Network connection failed on ' + route); }
  }
  const text = await result.text();
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('Unexpected non-JSON response (HTTP ' + result.status + ') on ' + route); }
  assert.equal(result.status, status, route + ': HTTP ' + result.status);
  checks.push({ route, status });
  console.log('CHECK ' + status + ' ' + route);
  return value;
}
try {
  const date = new Date().toISOString();
  const temporary = crypto.randomUUID();
  sql(`INSERT OR IGNORE INTO schools(id,name,code,created_at) VALUES ('ABA6052','SK Pendidikan Khas Taiping','ABA6052',${q(date)});
INSERT INTO users(id,school_id,email,name,role,class_ids,active,created_at) VALUES (${q(state.id)},'ABA6052','qa@example.invalid','PENTADBIR QA SINTETIK','admin','[]',1,${q(date)});
INSERT INTO auth_accounts(user_id,username,password_hash,must_change,created_at) VALUES (${q(state.id)},${q(state.username)},${q(await hashPassword(temporary))},1,${q(date)});
INSERT OR IGNORE INTO star_rule_versions(id,school_id,thresholds,marks,certified,created_at,created_by) VALUES ('default-ABA6052','ABA6052','[144,288,432,576,720]','[3,4,5,6,7]',0,${q(date)},${q(state.id)});`);
  await call('state', undefined, 401);
  await call('auth/login', { username: state.username, password: crypto.randomUUID() }, 401);
  const first = await call('auth/login', { username: state.username, password: temporary });
  assert.equal(first.mustChange, true);
  token = first.token;
  await call('state', undefined, 428);
  await call('auth/password', { currentPassword: temporary, password: state.password });
  await call('state', undefined, 401);
  token = (await call('auth/login', { username: state.username, password: state.password })).token;
  const initial = await call('state');
  if (initial.students.some((s) => !s.name.startsWith('MURID QA SINTETIK '))) throw new Error('Non-QA pupils exist; stop before importing synthetic records.');

  let parserSource = fs.readFileSync('lib/ains-parser.ts', 'utf8');
  for (const name of ['fflate', 'papaparse', 'exceljs/dist/exceljs.min.js']) parserSource = parserSource.replaceAll('"' + name + '"', JSON.stringify(import.meta.resolve(name)));
  const compiled = ts.transpileModule(parserSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const { parse } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
  const sourceId = 'qa-' + state.id;
  const inputs = [];
  for (const [year, approved] of [[2023,120], [2024,180], [2025,100]]) {
    const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet('QA');
    sheet.addRow(['Eksport sintetik untuk ujian sahaja']);
    sheet.addRow(['Kod Sekolah','Nama Sekolah','Nama Murid','Student ID','Diluluskan','Ditolak','Tahun']);
    sheet.addRow(['ABA6052','SK Pendidikan Khas Taiping',state.studentName,sourceId,approved,0,year]);
    sheet.addRow(['ABA60520','SK Pendidikan Khas Taiping','MURID LUAR QA','qa-other-1',999,0,year]);
    sheet.addRow(['OTHER','SEKOLAH LUAR QA','MURID LUAR QA','qa-other-2',999,0,year]);
    const file = new File([new Uint8Array(await workbook.xlsx.writeBuffer())], 'QA-SINTETIK-' + state.id + '-' + year + '.xlsx');
    const selected = await parse(file, {}, () => {});
    assert.equal(selected.rows.length, 1);
    assert.equal(selected.rows[0].code, 'ABA6052');
    const all = await parse(file, {}, () => {}, true);
    const input = { filename: file.name, dataset: 'QA-SINTETIK-' + state.id, sourceType: 'XLSX', rows: all.rows };
    inputs.push(input);
    const preview = await call('import/preview', input);
    assert.equal(preview.stats.excluded, 2);
    const saved = await call('import/commit', input);
    await call('batch/verify', { id: saved.id || saved.batchId, year, period_start: year + '-01-01', period_end: year + '-12-31', granularity: 'annual', coverage_complete: true, star_eligible: true, note: 'UJIAN SINTETIK: skop tahunan bebas, bukan rekod murid sebenar.' });
  }
  assert.equal((await call('import/commit', inputs[0])).duplicate, true);
  let data = await call('state?year=2025');
  const pupil = data.students.find((s) => s.name === state.studentName);
  assert.ok(pupil);
  state.studentId = pupil.id;
  const achievement = data.metrics.lifetime.students.find((s) => s.id === pupil.id || s.student?.id === pupil.id);
  assert.ok(achievement, 'Synthetic lifetime row missing');
  assert.equal(achievement.eligible, 400);
  assert.equal(achievement.achievement.level, 2);
  assert.equal(achievement.achievement.remaining, 32);
  const history = data.ains_summaries.filter((r) => r.student_id === pupil.id).length;
  await call('student', { ...pupil, status: 'transferred' });
  await call('student/archive', { id: pupil.id, archived: true });
  data = await call('state');
  assert.ok(data.students.find((s) => s.id === pupil.id).archived_at);
  assert.equal(data.ains_summaries.filter((r) => r.student_id === pupil.id).length, history);
  await call('student/archive', { id: pupil.id, archived: false });
  await call('student', { ...pupil, status: 'current' });
  const overlap = await call('import/commit', { ...inputs[1], filename: 'QA-OVERLAP-' + state.id + '.xlsx', dataset: 'QA-OVERLAP-' + state.id, rows: [{ code: 'ABA6052', name: state.studentName, source_id: sourceId, approved: 10, year: 2024 }] });
  const overlapId = overlap.id || overlap.batchId;
  await call('batch/verify', { id: overlapId, year: 2024, period_start: '2024-01-01', period_end: '2024-12-31', granularity: 'annual', star_eligible: true, note: 'UJIAN SINTETIK bertindih.' });
  data = await call('state');
  assert.equal(data.metrics.lifetime.students.find((s) => s.id === pupil.id || s.student?.id === pupil.id).eligible, null);
  await call('batch/rollback', { id: overlapId });
  data = await call('state');
  assert.equal(data.metrics.lifetime.students.find((s) => s.id === pupil.id || s.student?.id === pupil.id).eligible, 400);
  await call('auth/logout', {});
  await call('state', undefined, 401);
  token = (await call('auth/login', { username: state.username, password: state.password })).token;
  sql('UPDATE auth_sessions SET expires_at=1 WHERE user_id=' + q(state.id));
  await call('state', undefined, 401);
  token = '';
  const rateUser = 'QA_RATE_' + state.id;
  for (let i = 0; i < 10; i++) await call('auth/login', { username: rateUser, password: crypto.randomUUID() }, 401);
  await call('auth/login', { username: rateUser, password: crypto.randomUUID() }, 429);
  fs.writeFileSync(path.join(dir, 'browser-qa.json'), JSON.stringify(state), { mode: 0o600 });
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ origin, checkedAt: new Date().toISOString(), checks, lifetime: { total: 400, stars: 2, remaining: 32 }, syntheticOnly: true }, null, 2));
  complete = true;
  console.log('PASS: live authentication, first-change gate, expiry, logout, rate limit, real synthetic XLSX school filtering, duplicate/overlap prevention, archive/restore and 400/2-star/32 calculation.');
  console.log('QA_DIRECTORY=' + dir);
} finally {
  if (!complete) {
    cleanup(state);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
