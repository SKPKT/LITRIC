
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { aggregate } from '../lib/domain.mjs';

const sql = readFileSync(process.argv[2], 'utf8');
const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
db.exec(sql);
db.exec('PRAGMA foreign_keys=ON');
if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Backup integrity check failed.');
const list = table => db.prepare('SELECT * FROM ' + table + " WHERE school_id='ABA6052'").all();
const batches = list('import_batches'), students = list('students'), rows = list('ains_summaries');
const users = new Map(list('users').map(u => [u.id, u]));
const accounts = new Set(db.prepare('SELECT user_id FROM auth_accounts').all().map(a => a.user_id));
const evidence = Object.fromEntries(['ains_summaries','ains_activity_records','ains_event_registry','ains_snapshots','import_errors'].map(t => [t,list(t)]));
const byStudent = new Map(students.map(s=>[s.id,s]));
const synthetic = [];
for (const b of batches) {
  const u = users.get(b.created_by);
  const kind = b.dataset === 'QA-SINTETIK-' + b.created_by ? 'ordinary' : b.dataset === 'QA-OVERLAP-' + b.created_by ? 'overlap' : '';
  if (!kind || u?.name !== 'PENTADBIR QA SINTETIK' || u.email !== 'qa@example.invalid' || u.active || accounts.has(u.id) || b.status !== 'rolled_back' || b.source_key) continue;
  const scoped = Object.fromEntries(Object.entries(evidence).map(([t,rs])=>[t,rs.filter(r=>r.batch_id===b.id)]));
  if (scoped.ains_summaries.length !== 1 || scoped.ains_activity_records.length || scoped.ains_event_registry.length || scoped.import_errors.length) continue;
  const r = scoped.ains_summaries[0], s=byStudent.get(r.student_id);
  if (!s?.name.startsWith('MURID QA SINTETIK ') || !s.archived_at || s.merged_into || r.original_name !== s.name || r.source_id !== 'qa-' + u.id) continue;
  const expected = kind === 'overlap' ? (b.year===2024&&r.approved===10) : ({2023:120,2024:180,2025:100}[b.year]===r.approved);
  const filename = kind === 'overlap' ? b.dataset + '.xlsx' : b.dataset + '-' + b.year + '.xlsx';
  if (!expected || b.filename !== filename || !scoped.ains_snapshots.every(a=>a.student_id===s.id&&a.approved===r.approved)) continue;
  synthetic.push({id:b.id, year:b.year, kind, counts:Object.fromEntries(Object.entries(scoped).map(([t,rs])=>[t,rs.length]))});
}
const confirmed = new Set(synthetic.map(b=>b.id));
const totals = bs => {
  const report = aggregate({students,rows,batches:bs});
  return {reported:report.reported,eligible:report.approvedEligible,studentCount:report.students.length,stars:Array.from({length:6},(_,n)=>report.students.filter(s=>s.achievement.level===n).length)};
};
const statsBefore = totals(batches), statsAfter = totals(batches.filter(b=>!confirmed.has(b.id)));
console.log(JSON.stringify({backupVerified:true, schoolBatches:batches.length, studentProfiles:students.length, synthetic, unconfirmedQaCandidates:batches.filter(b=>/^QA-(SINTETIK|OVERLAP)-/.test(b.filename)&&!confirmed.has(b.id)).length, otherSummaries:rows.filter(r=>!confirmed.has(r.batch_id)).length, statsBefore, statsAfter},null,2));
