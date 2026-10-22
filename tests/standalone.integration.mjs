import { validateBackup } from "../scripts/validate-backup.mjs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { aggregate } from "../lib/domain.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { hashPassword, sha, verifyPassword } from "../lib/standalone-auth.mjs";
const setupKey = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
const mfOptions = {
  name: "litric-api",
  modules: true,
  scriptPath: "standalone/dist-api/worker.js",
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  assets: {
    directory: "dist-worker",
    binding: "ASSETS",
    workerName: "litric-api",
    routerConfig: {
      has_user_worker: true,
      invoke_user_worker_ahead_of_assets: true,
    },
    assetConfig: { not_found_handling: "single-page-application" },
  },
  d1Databases: ["DB"],
  durableObjects: { SCHOOL_SERVICE: { className: "LitricSchoolService", useSQLite: true } },
  bindings: { LITRIC_AUTH_MODE: "standalone", LITRIC_BOOTSTRAP_HASH: await sha(setupKey), LITRIC_BOOTSTRAP_EXPIRES_AT: String(Date.now() + 600_000) },
};
const mf = new Miniflare(mfOptions);
let checks = 0;
const expected = (actual, value) => {
  assert.deepEqual(actual, value);
  checks++;
};
try {
  const page = await mf.dispatchFetch("https://litric.example.invalid/");
  const html = await page.text();
  assert.equal(page.status, 200, html);
  checks++;
  assert.ok(html.includes("LITRIC"));
  checks++;
  const db = await mf.getD1Database("DB");
  for (const file of fs.readdirSync("standalone/migrations").sort()) {
    const sql = fs
      .readFileSync("standalone/migrations/" + file, "utf8")
      .replaceAll("--> statement-breakpoint", "");
    await db.batch(
      sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => db.prepare(s)),
    );
  }
  const temporary = crypto.randomUUID(),
    password = crypto.randomUUID(),
    at = new Date().toISOString();
  let token = "";
  async function call(path, body, status = 200, options = {}) {
    const response = await mf.dispatchFetch(
      "https://litric.example.invalid" + path,
      {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Origin: options.origin || "https://litric.example.invalid",
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...options.headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    const value = await response.json();
    assert.equal(response.status, status, `${path}: ${JSON.stringify(value)}`);
    checks++;
    return value;
  }
  await call('/api/auth/bootstrap', { password: temporary }, 404);
  await call('/api/auth/bootstrap', { password: temporary }, 404, { headers: { 'X-Litric-Setup-Key': 'a'.repeat(64) } });
  expected((await call('/api/auth/bootstrap', {}, 400, { headers: { 'X-Litric-Setup-Key': setupKey } })).error.startsWith('Kata laluan mesti'), true);
  expected(await call('/api/auth/bootstrap', { password: temporary }, 200, { headers: { 'X-Litric-Setup-Key': setupKey } }), { ok: true, mustChange: true });
  await call('/api/auth/bootstrap', { password }, 409, { headers: { 'X-Litric-Setup-Key': setupKey } });
  const account = await db.prepare("SELECT * FROM auth_accounts WHERE username='GPM'").first();
  const id = account.user_id;
  expected(account.must_change, 1);
  expected(await verifyPassword(temporary, account.password_hash), true);
  expected((await db.prepare('SELECT COUNT(*) AS n FROM auth_accounts').first()).n, 1);
  await call("/api/state", undefined, 401, {
    headers: {
      "oai-authenticated-user-id": id,
      "oai-authenticated-user-email": "admin@example.invalid",
    },
  });
  await call(
    "/api/auth/login",
    { username: "GPM", password: crypto.randomUUID() },
    401,
  );
  token = (
    await call("/api/auth/login", { username: "GPM", password: temporary })
  ).token;
  await call("/api/state", undefined, 428);
  await call("/api/source?batch=missing", undefined, 428);
  await call("/api/auth/password", { currentPassword: temporary, password });
  await call("/api/state", undefined, 401);
  token = (await call("/api/auth/login", { username: "GPM", password })).token;
  expected((await call("/api/state")).students.length, 0);
  await call("/api/state", undefined, 403, { origin: "https://evil.invalid" });
  const input = (year, approved, dataset = "Sintetik") => ({
    filename: `ujian-${year}-${approved}.xlsx`,
    dataset,
    sourceType: "XLSX",
    rows: [
      {
        code: "ABA6052",
        name: "MURID UJIAN TANPA IDENTITI SEBENAR",
        source_id: "synthetic-permanent-01",
        approved,
        rejected: 0,
        year,
      },
      {
        code: "OTHER",
        name: "LUAR SEKOLAH UJIAN",
        source_id: "synthetic-other",
        approved: 999,
        rejected: 0,
        year,
      },
    ],
  });
  const batchIds = [];
  for (const [year, total] of [
    [2023, 120],
    [2024, 180],
    [2025, 100],
  ]) {
    const preview = await call("/api/import/preview", input(year, total));
    expected(preview.stats.excluded, 1);
    const saved = await call("/api/import/commit", input(year, total));
    batchIds.push(saved.id || saved.batchId);
    const bid = saved.id || saved.batchId;
    assert.ok(bid);
    const scope = {
      id: bid,
      year,
      period_start: `${year}-01-01`,
      period_end: `${year}-12-31`,
      granularity: "annual",
      coverage_complete: true,
      star_eligible: true,
      note: "Bukti sintetik tahunan bebas untuk ujian automatik.",
    };
    await call(
      "/api/batch/verify",
      {
        ...scope,
        year: year + 1,
        period_start: `${year + 1}-01-01`,
        period_end: `${year + 1}-12-31`,
      },
      400,
    );
    await call("/api/batch/verify", scope);
  }
  expected(
    (await call("/api/import/commit", input(2023, 120))).duplicate,
    true,
  );
  let state = await call("/api/state?year=2025");
  const sourceRows = await call("/api/source?batch=" + state.import_batches[0].id);
  expected(sourceRows.length, 1);
  expected(state.students.length, 1);
  expected(state.metrics.eligible, 100);
  expected(state.metrics.lifetime.students[0].eligible, 400);
  expected(state.metrics.lifetime.students[0].achievement.level, 2);
  expected(state.metrics.lifetime.students[0].achievement.remaining, 32);
  const student = state.students[0],
    historyCount = state.ains_summaries.length;
  await call("/api/student", {
    ...student,
    name: student.name,
    status: "transferred",
  });
  await call("/api/student/archive", { id: student.id, archived: true });
  state = await call("/api/state");
  assert.ok(state.students[0].archived_at);
  checks++;
  expected(state.ains_summaries.length, historyCount);
  expected(state.metrics.lifetime.students[0].eligible, 400);
  await call("/api/student/archive", { id: student.id, archived: false });
  state = await call("/api/state");
  expected(state.students[0].archived_at, null);
  expected(state.students[0].status, "transferred");
  const overlap = await call(
    "/api/import/commit",
    input(2024, 10, "Ringkasan lain"),
  );
  const bid = overlap.id || overlap.batchId;
  await call("/api/batch/verify", {
    id: bid,
    year: 2024,
    period_start: "2024-01-01",
    period_end: "2024-12-31",
    granularity: "annual",
    star_eligible: true,
    note: "Bukti sintetik bertindih untuk ujian penolakan.",
  });
  state = await call("/api/state");
  expected(state.metrics.lifetime.students[0].eligible, null);
  await call("/api/batch/rollback", { id: bid });
  state = await call("/api/state");
  expected(state.metrics.lifetime.students[0].eligible, 400);
  const backup = await call("/api/backup");
  expected(backup.school, "ABA6052");
  expected(backup.tables.ains_summaries.length, historyCount + 1);
  const manifest = validateBackup(backup);
  expected(manifest.counts.students, 1);
  expected(manifest.rawApprovedByYear[2024], 190);
  assert.throws(() => validateBackup({ ...backup, school: "OTHER" }));
  checks++;
  const broken = structuredClone(backup);
  broken.tables.ains_summaries[0].student_id = "missing";
  assert.throws(() => validateBackup(broken));
  checks++;
  const legacy = structuredClone(backup);
  for (const row of legacy.tables.students) delete row.archived_at;
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "litric-synthetic-restore-"),
  );
  const restored = new DatabaseSync(":memory:");
  try {
    const input = path.join(dir, "backup.json"),
      output = path.join(dir, "restore.sql");
    fs.writeFileSync(input, JSON.stringify(legacy));
    const child = spawnSync(
      process.execPath,
      ["scripts/restore-backup.mjs", input, output],
      { encoding: "utf8" },
    );
    assert.equal(child.status, 0, child.stderr);
    checks++;
    for (const file of fs.readdirSync("standalone/migrations").sort())
      restored.exec(fs.readFileSync("standalone/migrations/" + file, "utf8"));
    restored.exec(fs.readFileSync(output, "utf8"));
    for (const [table, rows] of Object.entries(legacy.tables))
      expected(
        restored.prepare("SELECT COUNT(*) AS n FROM " + table).get().n,
        rows.length,
      );
    expected(restored.prepare("PRAGMA foreign_key_check").all(), []);
    const m = aggregate({
      students: restored.prepare("SELECT * FROM students").all(),
      rows: restored.prepare("SELECT * FROM ains_summaries").all(),
      batches: restored.prepare("SELECT * FROM import_batches").all(),
    });
    expected(m.students[0].eligible, 400);
  } finally {
    restored.close();
    if (fs.realpathSync(path.dirname(dir)) !== fs.realpathSync(os.tmpdir())) throw new Error("Unexpected temporary directory.");
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const adminToken = token;
  await db.batch([
    db
      .prepare(
        "INSERT INTO users(id,school_id,email,name,role,active,created_at) VALUES (?,?,?,?,?,?,?)",
      )
      .bind(
        "teacher-test",
        "ABA6052",
        "teacher@example.invalid",
        "GURU UJIAN",
        "teacher",
        1,
        at,
      ),
    db
      .prepare(
        "INSERT INTO auth_accounts(user_id,username,password_hash,must_change,created_at) SELECT ?,?,?,0,?",
      )
      .bind("teacher-test", "TEACHER", await hashPassword(password), at),
  ]);
  token = (await call("/api/auth/login", { username: "TEACHER", password }))
    .token;
  expected((await call("/api/state")).students.length, 0);
  await call("/api/student/archive", { id: student.id, archived: true }, 403);
  token = adminToken;
  await call("/api/auth/logout", {});
  await call("/api/state", undefined, 401);
  token = (await call("/api/auth/login", { username: "GPM", password })).token;
  await db.prepare("UPDATE auth_sessions SET expires_at=1").run();
  await call("/api/state", undefined, 401);
  await mf.setOptions({ ...mfOptions, bindings: { ...mfOptions.bindings, LITRIC_BOOTSTRAP_EXPIRES_AT: '1' } });
  await call('/api/auth/bootstrap', { password }, 404, { headers: { 'X-Litric-Setup-Key': setupKey } });
  await mf.setOptions({ ...mfOptions, bindings: { LITRIC_AUTH_MODE: "standalone", LITRIC_LOGIN_ENABLED: "false" } });
  const pilotHealth = await mf.dispatchFetch("https://litric.example.invalid/health");
  expected(await pilotHealth.json(), { ok: true, loginEnabled: false });
  await call("/api/auth/login", { username: "GPM", password }, 503);
  await call("/api/state", undefined, 401);
  console.log(
    `PASS: ${checks} independent Worker/D1 checks; authentication, first-login gate, CORS, exact school filtering, duplicate imports, three-year 400/2-star/32 calculation, overlap rejection, rollback, archive/restore, backup, expiry and logout.`,
  );
} finally {
  await mf.dispose();
}
