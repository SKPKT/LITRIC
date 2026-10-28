import { env } from "cloudflare:workers";
import {
  SCHOOL,
  DEFAULT_RULE,
  reviewRows,
  digest,
  norm,
  aggregate,
  canAccessStudent,
  canRole,
  validScope,
  validRule,
  star,
  identityKey,
} from "./domain.mjs";
import { planIdentities } from './student-identity.mjs';
import seed from "./seed-data.json";
import {authenticate} from "./standalone-auth.mjs";
import { prepareEvents } from "./events.mjs";

export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export const db = () => {
  if (!env.DB) throw new Error("Pangkalan data belum tersedia.");
  return env.DB;
};
export const all = async (sql: string, ...args: any[]) => {
  const r = await db()
    .prepare(sql)
    .bind(...args)
    .all();
  return r.results as any[];
};
export const first = async (sql: string, ...args: any[]) =>
  (await db()
    .prepare(sql)
    .bind(...args)
    .first()) as any;
export const statement = (sql: string, ...args: any[]) =>
  db()
    .prepare(sql)
    .bind(...args.map((x) => (x === undefined ? null : x)));
export const run = async (sql: string, ...args: any[]) =>
  statement(sql, ...args).run();
export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export const requireRole = (u: any, roles: string[]) => {
  if (!canRole(u, roles)) fail("Tiada kebenaran untuk tindakan ini.", 403);
};
export async function audit(
  u: any,
  action: string,
  entityId: string | null,
  detail: any = {},
) {
  await run(
    "INSERT INTO audit_logs (id,school_id,user_id,action,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?)",
    uid(),
    u.school_id,
    u.id,
    action,
    entityId,
    JSON.stringify(detail),
    now(),
  );
}
export async function auth(request: Request) {
  return authenticate(request, env.DB);
}
export async function initialize(u: any) {
  await db().batch([
    statement(
      "INSERT OR IGNORE INTO settings (school_id,data) VALUES (?,?)",
      u.school_id,
      JSON.stringify({
        schoolName: SCHOOL.name,
        schoolCode: SCHOOL.code,
        smartlibUrl: "",
        schoolLogo: "",
        seedVersion: 1,
      }),
    ),
    statement(
      "INSERT OR IGNORE INTO star_rule_versions (id,school_id,thresholds,marks,certified,created_at,created_by) VALUES (?,?,?,?,?,?,?)",
      "default-ABA6052",
      u.school_id,
      JSON.stringify(DEFAULT_RULE.thresholds),
      JSON.stringify(DEFAULT_RULE.marks),
      0,
      now(),
      u.id,
    ),
  ]);
  // Seed only after the configured owner has authenticated. All periods remain unverified.
  await importProvided(u);
}
export async function importBatch(u: any, input: any, options: any = {}) {
  requireRole(u, ["admin"]);
  if (!Array.isArray(input.rows) || input.rows.length > 5000)
    fail("Had 5,000 baris sekolah untuk setiap kelompok.");
  if (!input.filename || !input.dataset)
    fail("Nama fail dan set data diperlukan.");
  const review = await reviewRows(input.rows, u.school_id);
  if (!review.rows.length)
    fail(
      "Tiada baris dengan kod sekolah yang dibenarkan. Peta lajur kod sekolah terlebih dahulu.",
    );
  const fingerprint =
    options.fingerprint ||
    (await digest(
      JSON.stringify(review.rows.map((r: any) => r.rowHash).sort()),
    ));
  const existing = await first(
    "SELECT id,status FROM import_batches WHERE school_id=? AND (fingerprint=? OR (file_hash IS NOT NULL AND file_hash=?))",
    u.school_id,
    fingerprint,
    input.fileHash || null,
  );
  if (existing)
    return {
      duplicate: true,
      batchId: existing.id,
      status: existing.status,
      stats: review.stats,
    };
  const id = uid(),
    at = now(),
    key = `${u.school_id}/imports/${id}.json`;
  const known = await all(
    "SELECT a.*,s.name,s.merged_into FROM student_aliases a JOIN students s ON s.id=a.student_id WHERE a.school_id=?",
    u.school_id,
  );
  const aliases = new Map(known.map((a) => [a.source_id, a]));
  const people = await all('SELECT * FROM students WHERE school_id=?', u.school_id);
  const identityPlan = planIdentities(review.rows, people, known, input.identityLinks || {});
  if(identityPlan.issues.length) fail('Padanan identiti memerlukan pengesahan dalam pratonton import. Tiada profil atau bacaan ditambah.',409);
  if (env.BUCKET)
    await env.BUCKET.put(
      key,
      JSON.stringify({
        filename: input.filename,
        originalFileHash: input.fileHash,
        rows: (options.originalRows || input.rows).filter(
          (r: any) => norm(r.code) === u.school_id,
        ),
      }),
      { httpMetadata: { contentType: "application/json" } },
    );
  const stmts: any[] = [
    statement(
      "INSERT INTO import_batches (id,school_id,dataset,filename,fingerprint,file_hash,source_type,granularity,month_hint,verification,status,stats,source_key,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      u.school_id,
      String(input.dataset).slice(0, 160),
      String(input.filename).slice(0, 240),
      fingerprint,
      input.fileHash || null,
      ["CSV", "XLSX", "ZIP"].includes(input.sourceType)
        ? input.sourceType
        : "CSV",
      options.events ? "event" : "unknown",
      input.monthHint || null,
      "unverified",
      "active",
      JSON.stringify({ ...review.stats, ...options.eventStats }),
      env.BUCKET ? key : null,
      u.id,
      at,
    ),
  ];
  for (const r of review.rows) {
    if (r.status === "rejected") {
      stmts.push(
        statement(
          "INSERT INTO import_errors (id,school_id,batch_id,row_number,severity,message,raw) VALUES (?,?,?,?,?,?,?)",
          uid(),
          u.school_id,
          id,
          r.rowNumber,
          r.status,
          r.issue,
          JSON.stringify(r.raw),
        ),
      );
      continue;
    }
    const sourceId = r.sourceId || `missing:${id}:${r.rowNumber}`;
    let alias = aliases.get(sourceId);
    const identity = identityPlan.targets.get(r.rowNumber);
    let studentId = identity?.studentId || alias?.student_id;
    if(identity?.manual && r.status==='review' && r.issue?.startsWith('Pengecam sumber tiada')){r.status='accepted';r.issue='';review.stats.review--;review.stats.accepted++;}
    if(identity?.manual && alias){stmts.push(statement('UPDATE student_aliases SET verified=? WHERE id=? AND school_id=?',r.sourceId?1:0,alias.id,u.school_id));}
    if (!studentId) {
      studentId = uid();
      stmts.push(
        statement(
          "INSERT INTO students (id,school_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)",
          studentId,
          u.school_id,
          r.name,
          "unconfirmed",
          at,
          at,
        ),
      );
    }
    if(!alias){
      stmts.push(statement(
          "INSERT INTO student_aliases (id,school_id,student_id,source_id,original_name,verified) VALUES (?,?,?,?,?,?)",
          uid(),
          u.school_id,
          studentId,
          sourceId,
          r.name,
          r.sourceId ? 1 : 0,
        ));
      alias = { student_id: studentId, name: r.name };
      aliases.set(sourceId, alias);
    }
    if (!identity?.manual && norm(alias.name) !== norm(r.name) && r.status !== "duplicate") {
      if (r.status === "accepted") {
        review.stats.accepted--;
        review.stats.review++;
      }
      r.status = "review";
      r.issue = "Pengecam sumber sama tetapi nama berbeza. Semak identiti.";
    }
    stmts.push(
      statement(
        "INSERT INTO ains_summaries (id,school_id,batch_id,student_id,source_id,original_school,original_name,row_number,row_hash,approved,rejected,measures,raw,status,issue) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        uid(),
        u.school_id,
        id,
        studentId,
        r.sourceId,
        r.originalSchool,
        r.name,
        r.rowNumber,
        r.rowHash,
        r.approved,
        r.rejected,
        JSON.stringify(r.measures),
        JSON.stringify(r.raw),
        r.status,
        r.issue || null,
      ),
    );
    if (r.issue)
      stmts.push(
        statement(
          "INSERT INTO import_errors (id,school_id,batch_id,row_number,severity,message,raw) VALUES (?,?,?,?,?,?,?)",
          uid(),
          u.school_id,
          id,
          r.rowNumber,
          r.status,
          r.issue,
          JSON.stringify(r.raw),
        ),
      );
  }
  for (const e of options.events || []) {
    const studentId = aliases.get(e.sourceId)?.student_id;
    if (!studentId) fail("Pengecam peristiwa tidak mempunyai profil murid.");
    stmts.push(
      statement(
        "INSERT INTO ains_activity_records (id,school_id,batch_id,student_id,event_id,date,title,approval_status,content_hash,raw,row_number) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        uid(),
        u.school_id,
        id,
        studentId,
        e.eventId,
        e.date,
        e.title,
        e.status,
        e.hash,
        JSON.stringify(e.raw),
        e.row,
      ),
      statement(
        "INSERT INTO ains_event_registry (id,school_id,event_id,batch_id,content_hash) VALUES (?,?,?,?,?)",
        await digest(u.school_id + "|" + e.eventId),
        u.school_id,
        e.eventId,
        id,
        e.hash,
      ),
    );
  }
  for (const e of options.errors || [])
    stmts.push(
      statement(
        "INSERT INTO import_errors (id,school_id,batch_id,row_number,severity,message,raw) VALUES (?,?,?,?,?,?,?)",
        uid(),
        u.school_id,
        id,
        e.row,
        e.status,
        e.message,
        JSON.stringify(e.raw),
      ),
    );
  stmts.push(
    statement(
      "UPDATE import_batches SET stats=? WHERE id=? AND school_id=?",
      JSON.stringify({ ...review.stats, ...options.eventStats }),
      id,
      u.school_id,
    ),
  );
  // The whole school-sized import is atomic; registry uniqueness also prevents concurrent duplicate events.
  try {
    await db().batch(stmts);
  } catch (e) {
    if (env.BUCKET) await env.BUCKET.delete(key);
    const concurrent = await first(
      "SELECT id,status FROM import_batches WHERE school_id=? AND fingerprint=?",
      u.school_id,
      fingerprint,
    );
    if (concurrent)
      return {
        duplicate: true,
        batchId: concurrent.id,
        status: concurrent.status,
        stats: review.stats,
      };
    if (!options.retry && String(e).includes("student_aliases"))
      return importBatch(u, input, { ...options, retry: true });
    throw e;
  }
  await audit(u, "Import data", id, {
    filename: input.filename,
    stats: review.stats,
    fingerprint,
    identityDecisions: Object.entries(input.identityLinks||{}).map(([row,v]:any)=>({row,studentId:v.studentId,reason:v.reason})),
  });
  return { batchId: id, stats: { ...review.stats, ...options.eventStats } };
}
export async function importIdentityPlan(u:any, rows:any[]) {
  return planIdentities(rows, await all('SELECT * FROM students WHERE school_id=?',u.school_id), await all('SELECT * FROM student_aliases WHERE school_id=?',u.school_id));
}
export async function eventPreview(u: any, input: any) {
  requireRole(u, ["admin"]);
  if (!Array.isArray(input.rows) || input.rows.length > 5000)
    fail("Had 5,000 peristiwa sekolah.");
  const previous = await all(
    "SELECT * FROM ains_event_registry WHERE school_id=?",
    u.school_id,
  );
  const prepared = await prepareEvents(
    input.rows,
    u.school_id,
    new Map(previous.map((e) => [e.event_id, e])),
  );
  const review = await reviewRows(prepared.rows, u.school_id);
  return { prepared, review, previous };
}
export async function importEvents(u: any, input: any) {
  const { prepared, review, previous } = await eventPreview(u, input);
  if (!prepared.events.length) {
    if (
      prepared.duplicates &&
      prepared.errors.every((e: any) => e.status === "duplicate")
    )
      return {
        duplicate: true,
        batchId: previous[0]?.batch_id || null,
        stats: { ...review.stats, ...prepared.stats },
      };
    fail("Tiada peristiwa baharu yang sah. Semak laporan pratonton.");
  }
  const fingerprint = await digest(
    JSON.stringify(
      (await Promise.all(input.rows.map((r: any) => digest(r)))).sort(),
    ),
  );
  return importBatch(
    u,
    { ...input, rows: prepared.rows },
    {
      events: prepared.events,
      eventStats: prepared.stats,
      errors: prepared.errors,
      originalRows: input.rows,
      fingerprint,
    },
  );
}
export async function importProvided(u: any) {
  requireRole(u, ["admin"]);
  const results = [];
  for (const s of seed) results.push(await importBatch(u, s));
  return results;
}
export async function loadData(u: any) {
  const school = u.school_id;
  const names = [
    "students",
    "classes",
    "import_batches",
    "ains_summaries",
    "school_reading_entries",
    "reading_targets",
    "reading_programmes",
    "certificates",
    "teacher_observations",
    "student_class_history",
    "smartlib_book_links",
    "evidence_files",
    "programme_participants",
  ];
  const loaded = await Promise.all(
    names.map((t) => all(`SELECT * FROM ${t} WHERE school_id=?`, school)),
  );
  const data: any = Object.fromEntries(names.map((n, i) => [n, loaded[i]]));
  const allStudents = data.students;
  const canonical = (id: string) => {
    const seen = new Set();
    let s = allStudents.find((s: any) => s.id === id);
    while (s?.merged_into && !seen.has(s.id)) {
      seen.add(s.id);
      s = allStudents.find((a: any) => a.id === s.merged_into);
    }
    return s?.id || id;
  };
  data.students = allStudents.filter(
    (s: any) => !s.merged_into && canAccessStudent(u, s),
  );
  const accessible = new Set(data.students.map((s: any) => s.id));
  data.ains_summaries = data.ains_summaries
    .map((r: any) => ({ ...r, canonical_id: canonical(r.student_id) }))
    .filter((r: any) => accessible.has(r.canonical_id));
  if (u.role !== "admin") {
    const relevant = new Set(data.ains_summaries.map((r: any) => r.batch_id));
    data.import_batches = data.import_batches.filter((b: any) =>
      relevant.has(b.id),
    );
    data.ains_summaries = data.ains_summaries.map((r: any) => {
      const raw = JSON.parse(r.raw);
      return {
        ...r,
        source_id: null,
        original_name: null,
        row_hash: null,
        raw: JSON.stringify({
          events: raw.events?.map((e: any) => ({
            event_id: e.event_id,
            reading_date: e.reading_date,
            approval_status: e.approval_status,
            language: e.language,
            category: e.category,
          })),
        }),
      };
    });
  }
  for (const key of [
    "school_reading_entries",
    "certificates",
    "teacher_observations",
    "student_class_history",
  ])
    data[key] = data[key]
      .map((r: any) => ({ ...r, canonical_id: canonical(r.student_id) }))
      .filter((r: any) => accessible.has(r.canonical_id));
  data.reading_targets = data.reading_targets
    .map((r: any) => ({
      ...r,
      student_id: r.student_id ? canonical(r.student_id) : null,
    }))
    .filter(
      (r: any) =>
        u.role === "admin" ||
        (r.student_id && accessible.has(canonical(r.student_id))) ||
        (r.class_id && JSON.parse(u.class_ids || "[]").includes(r.class_id)),
    );
  if (u.role === "student") {
    data.reading_programmes = [];
    data.evidence_files = [];
    data.programme_participants = [];
    data.smartlib_book_links = data.smartlib_book_links.filter(
      (b: any) => b.suitable,
    );
  }
  if (u.role === "teacher") {
    data.reading_programmes = data.reading_programmes.filter(
      (p: any) => p.teacher_id === u.id,
    );
    const pids = new Set(data.reading_programmes.map((p: any) => p.id));
    data.evidence_files = data.evidence_files.filter((f: any) =>
      pids.has(f.programme_id),
    );
    data.programme_participants = data.programme_participants.filter(
      (p: any) =>
        pids.has(p.programme_id) && accessible.has(canonical(p.student_id)),
    );
  }
  data.programme_participants = data.programme_participants.map((p: any) => ({
    ...p,
    canonical_id: canonical(p.student_id),
  }));
  const rr = await first(
    "SELECT * FROM star_rule_versions WHERE school_id=? ORDER BY created_at DESC LIMIT 1",
    school,
  );
  data.rule = rr
    ? {
        ...rr,
        thresholds: JSON.parse(rr.thresholds),
        marks: JSON.parse(rr.marks),
      }
    : DEFAULT_RULE;
  data.settings = JSON.parse(
    (await first("SELECT data FROM settings WHERE school_id=?", school))
      ?.data || "{}",
  );
  delete data.settings.smartlibToken;
  data.settings.smartlibConfigured = !!data.settings.smartlibUrl;
  if (u.role !== "admin") delete data.settings.smartlibUrl;
  if (u.role === "admin") {
    data.providedSourceCount = seed.length;
    data.users = await all("SELECT * FROM users WHERE school_id=?", school);
    data.invitations = await all(
      "SELECT * FROM invitations WHERE school_id=?",
      school,
    );
    data.merges = await all(
      "SELECT * FROM identity_merges WHERE school_id=? ORDER BY created_at DESC",
      school,
    );
    data.audit = await all(
      "SELECT * FROM audit_logs WHERE school_id=? ORDER BY created_at DESC LIMIT 200",
      school,
    );
    data.errors = await all(
      "SELECT id,batch_id,row_number,severity,message FROM import_errors WHERE school_id=?",
      school,
    );
    data.aliases = await all(
      "SELECT * FROM student_aliases WHERE school_id=?",
      school,
    );
  } else {
    data.import_batches = data.import_batches.map((b: any) => ({
      ...b,
      stats: null,
      file_hash: null,
      source_key: null,
      fingerprint: null,
    }));
  }
  return data;
}
export const filtersFrom = (url: URL) =>
  Object.fromEntries(
    [
      "dataset",
      "year",
      "month",
      "classId",
      "student",
      "language",
      "category",
      "source",
      "verification",
    ].map((k) => [k, url.searchParams.get(k) || ""]),
  );
export function metrics(data: any, filters: any) {
  const base = {students:data.students, rows:data.ains_summaries, batches:data.import_batches, rule:data.rule};
  const annual=aggregate({...base,filters});
  const lifetime=aggregate({...base,filters:{classId:filters.classId,student:filters.student}});
  const currentYear=new Date().getUTCFullYear();
  const current=aggregate({...base,filters:{classId:filters.classId,student:filters.student,year:String(currentYear)}});
  const years=[...new Set(data.import_batches.filter((b:any)=>b.status==='active'&&b.year).map((b:any)=>b.year))].sort();
  return {...annual,lifetime,currentYear,current,yearly:years.map(year=>({year,...aggregate({...base,filters:{classId:filters.classId,student:filters.student,year:String(year)}})}))};
}
export async function studentAccess(u: any, id: string) {
  let s = await first(
    "SELECT * FROM students WHERE id=? AND school_id=?",
    id,
    u.school_id,
  );
  const seen = new Set();
  while (s?.merged_into && !seen.has(s.id)) {
    seen.add(s.id);
    s = await first(
      "SELECT * FROM students WHERE id=? AND school_id=?",
      s.merged_into,
      u.school_id,
    );
  }
  if (!s || !canAccessStudent(u, s))
    fail("Murid tidak ditemui atau akses tidak dibenarkan.", 403);
  return s;
}
export function text(value: any, max = 1000) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}
export function required(value: any, label: string, max = 1000) {
  const s = text(value, max);
  if (!s) fail(`${label} diperlukan.`);
  return s;
}
export function date(value: any) {
  const s = text(value, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    fail("Tarikh tidak sah.");
  return s;
}
export async function mutation(u: any, path: string, p: any) {
  const school = u.school_id,
    id = p.id || uid(),
    at = now();
  if (path === "seed") {
    return { results: await importProvided(u) };
  }
  if (path === "import/preview") {
    requireRole(u, ["admin"]);
    if (!Array.isArray(p.rows) || p.rows.length > 5000)
      fail("Had 5,000 baris sekolah.");
    if (p.granularity === "event") {
      const { prepared, review } = await eventPreview(u, p);
      return {
        stats: { ...review.stats, ...prepared.stats },
        errors: [
          ...review.errors,
          ...prepared.errors.map((e: any) => ({
            row: e.row,
            status: e.status,
            message: e.message,
          })),
        ],
        rows: review.rows.slice(0, 50),
        identityIssues: (await importIdentityPlan(u, review.rows)).issues,
      };
    }
    const r = await reviewRows(p.rows, school);
    return { stats: r.stats, errors: r.errors, rows: r.rows.slice(0, 50), identityIssues: (await importIdentityPlan(u,r.rows)).issues };
  }
  if (path === "import/commit")
    return p.granularity === "event" ? importEvents(u, p) : importBatch(u, p);
  if (path === "batch/rollback") {
    requireRole(u, ["admin"]);
    await db().batch([
      statement(
        "DELETE FROM ains_event_registry WHERE batch_id=? AND school_id=?",
        id,
        school,
      ),
      statement(
        "UPDATE import_batches SET status='rolled_back',star_eligible=0 WHERE id=? AND school_id=?",
        id,
        school,
      ),
    ]);
    await audit(u, "Batal kelompok import", id);
    return { ok: true };
  }
  if (path === "batch/restore") {
    requireRole(u, ["admin"]);
    const ev = await all(
      "SELECT * FROM ains_activity_records WHERE batch_id=? AND school_id=?",
      id,
      school,
    );
    const stmts = await Promise.all(
      ev.map(async (e) =>
        statement(
          "INSERT INTO ains_event_registry (id,school_id,event_id,batch_id,content_hash) VALUES (?,?,?,?,?)",
          await digest(school + "|" + e.event_id),
          school,
          e.event_id,
          id,
          e.content_hash,
        ),
      ),
    );
    try {
      await db().batch([
        ...stmts,
        statement(
          "UPDATE import_batches SET status='active',verification='unverified',star_eligible=0 WHERE id=? AND school_id=?",
          id,
          school,
        ),
      ]);
    } catch {
      fail(
        "Kelompok tidak dapat dipulihkan. ID peristiwa mungkin telah digunakan dalam kelompok aktif lain.",
        409,
      );
    }
    await audit(u, "Pulih kelompok import", id);
    return { ok: true };
  }
  if (path === "batch/verify") {
    requireRole(u, ["admin"]);
    const b = await first(
      "SELECT * FROM import_batches WHERE id=? AND school_id=?",
      id,
      school,
    );
    if (!b || b.status !== "active") fail("Kelompok tidak aktif.");
    const sourceRows=await all("SELECT raw FROM ains_summaries WHERE batch_id=? AND school_id=?",id,school);
    const sourceYears=new Set(sourceRows.map((r:any)=>JSON.parse(r.raw).year).filter(Boolean).map(Number));
    if(sourceYears.size>1 || (sourceYears.size===1&&!sourceYears.has(Number(p.year)))) fail("Tahun pengesahan bercanggah dengan tahun sumber.");
    const scope = {
      ...p,
      year: Number(p.year),
      star_eligible: p.star_eligible ? 1 : 0,
    };
    if (!validScope(scope))
      fail("Tahun, tarikh mula/akhir dan jenis agregat yang sah diperlukan.");
    if ((p.granularity === "event") !== (b.granularity === "event"))
      fail("Fail ringkasan tidak boleh ditukar menjadi rekod buku individu.");
    if (b.granularity === "event") {
      const bounds = await first(
        "SELECT MIN(date) AS start,MAX(date) AS end FROM ains_activity_records WHERE batch_id=? AND school_id=?",
        id,
        school,
      );
      if (
        !bounds?.start ||
        bounds.start < p.period_start ||
        bounds.end > p.period_end ||
        Number(bounds.start.slice(0, 4)) !== scope.year ||
        Number(bounds.end.slice(0, 4)) !== scope.year
      )
        fail(
          "Tarikh peristiwa mesti berada dalam tahun dan skop yang disahkan. Pecahkan fail berbilang tahun kepada kelompok berasingan.",
        );
    }
    if (!p.note || p.note.trim().length < 12)
      fail(
        "Catat bukti pengesahan tempoh dan semantik (sekurang-kurangnya 12 aksara).",
      );
    await run(
      "UPDATE import_batches SET year=?,period_start=?,period_end=?,snapshot_date=?,granularity=?,verification='verified',coverage_complete=?,star_eligible=?,verified_by=?,verification_note=? WHERE id=? AND school_id=?",
      scope.year,
      p.period_start,
      p.period_end,
      p.snapshot_date || null,
      p.granularity,
      p.coverage_complete ? 1 : 0,
      p.star_eligible ? 1 : 0,
      u.id,
      text(p.note),
      id,
      school,
    );
    if (p.granularity === "snapshot") {
      await run(
        "DELETE FROM ains_snapshots WHERE batch_id=? AND school_id=?",
        id,
        school,
      );
      await run(
        "INSERT INTO ains_snapshots (id,school_id,batch_id,student_id,snapshot_date,approved) SELECT id,school_id,batch_id,student_id,?,approved FROM ains_summaries WHERE batch_id=? AND school_id=?",
        p.snapshot_date,
        id,
        school,
      );
    }
    await audit(u, "Sahkan skop import", id, scope);
    return { ok: true };
  }
  if (path === "row/resolve") {
    requireRole(u, ["admin"]);
    const r = await first(
      "SELECT * FROM ains_summaries WHERE id=? AND school_id=?",
      id,
      school,
    );
    if (!r) fail("Baris tidak ditemui.");
    if (!["accepted", "excluded", "review"].includes(p.status) || !p.reason)
      fail("Keputusan dan sebab semakan diperlukan.");
    if (p.status === "accepted") {
      const another = await first(
        "SELECT id FROM ains_summaries WHERE batch_id=? AND student_id=? AND status='accepted' AND id<>?",
        r.batch_id,
        r.student_id,
        id,
      );
      if (another)
        fail(
          "Terdapat baris diterima untuk murid ini. Kecualikan baris lain atau kekalkan semakan.",
        );
    }
    await run(
      "UPDATE ains_summaries SET status=?,issue=? WHERE id=? AND school_id=?",
      p.status,
      text(p.reason),
      id,
      school,
    );
    await audit(u, "Semak baris sumber", id, {
      status: p.status,
      reason: p.reason,
    });
    return { ok: true };
  }
  if (path === "student/archive") {
    requireRole(u, ["admin"]);
    await studentAccess(u, p.id);
    if (typeof p.archived !== "boolean") fail("Status arkib tidak sah.");
    await run("UPDATE students SET archived_at=?,status=CASE WHEN ?=0 AND status IN ('former','graduated','transferred') THEN 'current' ELSE status END,updated_at=? WHERE id=? AND school_id=?", p.archived ? at : null, p.archived?1:0, at, p.id, school);
    await audit(u, p.archived ? "Arkib murid" : "Pulih murid", p.id);
    return {id:p.id};
  }
  if (path === "student") {
    requireRole(u, ["admin"]);
    if (p.id) await studentAccess(u, p.id);
    const existing = p.id ? await first('SELECT * FROM students WHERE id=? AND school_id=?', id, school) : null;
    if(typeof p.name!=='string'||!p.name.trim()||p.name.trim().length>160||/[\x00-\x1f]/.test(p.name)) fail('Nama penuh murid diperlukan dan mesti tidak melebihi 160 aksara.');
    const name=p.name.trim().replace(/\s+/g,' ');
    const status=p.status||existing?.status||'current';
    if(!['current','former','graduated','transferred','unconfirmed'].includes(status))fail('Status murid tidak sah.');
    const year=p.academic_year?Number(p.academic_year):null;
    if(year!==null&&(!Number.isInteger(year)||year<2000||year>2100))fail('Tahun akademik tidak sah.');
    if(p.class_id && !await first('SELECT id FROM classes WHERE id=? AND school_id=?',p.class_id,school))fail('Kelas tidak sah.');
    const sourceId=identityKey({source_id:p.source_id});
    if(sourceId.length>200||/[\x00-\x1f]/.test(sourceId))fail('Pengecam AINS tidak sah.');
    const alias=sourceId?await first('SELECT * FROM student_aliases WHERE school_id=? AND source_id=?',school,sourceId):null;
    if(sourceId&&p.source_verified!==true)fail('Sahkan pengecam sumber AINS berdasarkan rekod sekolah.');
    if(alias&&(await studentAccess(u,alias.student_id)).id!==id)fail('Pengecam AINS ini sudah dipautkan kepada profil lain. Gunakan Semak identiti.',409);
    if(!existing){
      const people=await all('SELECT * FROM students WHERE school_id=? AND merged_into IS NULL',school);
      const duplicate=people.filter(s=>norm(s.name)===norm(name)&&String(s.class_id||'')===String(p.class_id||'')&&String(s.academic_year||'')===String(year||''));
      if(duplicate.length && !(p.duplicate_confirmed===true&&typeof p.duplicate_reason==='string'&&p.duplicate_reason.trim().length>=10))fail('Profil dengan nama, kelas dan tahun yang sama sudah ada. Edit atau pulihkan profil tersebut; jika individu berbeza, sahkan bukti individu berbeza.',409);
    }
    const inactive=['transferred','graduated','former'].includes(status);
    const archived=inactive?(existing?.archived_at||at):existing&&existing.status!==status&&status==='current'?null:existing?.archived_at||null;
    const stmts:any[]=[existing ? statement('UPDATE students SET name=?,class_id=?,academic_year=?,status=?,member_id=?,archived_at=?,updated_at=? WHERE id=? AND school_id=?',name,p.class_id||null,year,status,text(p.member_id,200)||null,archived,at,id,school) : statement('INSERT INTO students (id,school_id,name,class_id,academic_year,status,member_id,archived_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',id,school,name,p.class_id||null,year,status,text(p.member_id,200)||null,archived,at,at)];
    if(sourceId)stmts.push(alias?statement('UPDATE student_aliases SET verified=1 WHERE id=? AND school_id=?',alias.id,school):statement('INSERT INTO student_aliases(id,school_id,student_id,source_id,original_name,verified) VALUES (?,?,?,?,?,1)',uid(),school,id,sourceId,name));
    if(p.class_id&&year)stmts.push(statement('INSERT INTO student_class_history(id,school_id,student_id,class_id,year,created_at) SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM student_class_history WHERE school_id=? AND student_id=? AND class_id=? AND year=?)',uid(),school,id,p.class_id,year,at,school,id,p.class_id,year));
    await db().batch(stmts);
    await audit(u,'Simpan murid',id,{sourceIdentifierVerified:!!sourceId,duplicateReason:p.duplicate_confirmed?text(p.duplicate_reason,1000):null});
    return {id,message:'Maklumat murid berjaya disimpan.'};
  }
  if (path === "class") {
    requireRole(u, ["admin"]);
    const year = Number(p.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100)
      fail("Tahun tidak sah.");
    await run(
      "INSERT INTO classes (id,school_id,name,year) VALUES (?,?,?,?)",
      id,
      school,
      required(p.name, "Nama kelas"),
      year,
    );
    await audit(u, "Tambah kelas", id);
    return { id };
  }
  if (path === "identity/merge") {
    requireRole(u, ["admin"]);
    if (p.from === p.into) fail("Pilih dua murid berbeza.");
    const a = await studentAccess(u, p.from),
      b = await studentAccess(u, p.into);
    if (a.merged_into || b.merged_into)
      fail("Pilih profil yang belum digabung.");
    if (
      await first(
        "SELECT id FROM students WHERE merged_into=? OR merged_into=?",
        a.id,
        b.id,
      )
    )
      fail("Batalkan gabungan terdahulu sebelum membuat gabungan berantai.");
    const reason = required(p.reason, "Bukti padanan identiti");
    await db().batch([
      statement(
        "UPDATE students SET merged_into=?,updated_at=? WHERE id=? AND school_id=?",
        b.id,
        at,
        a.id,
        school,
      ),
      statement(
        "INSERT INTO identity_merges (id,school_id,from_id,into_id,reason,created_at,created_by) VALUES (?,?,?,?,?,?,?)",
        id,
        school,
        a.id,
        b.id,
        reason,
        at,
        u.id,
      ),
    ]);
    await audit(u, "Gabung identiti", id, { from: a.id, into: b.id, reason });
    return { id };
  }
  if (path === "identity/undo") {
    requireRole(u, ["admin"]);
    const m = await first(
      "SELECT * FROM identity_merges WHERE id=? AND school_id=? AND undone=0",
      id,
      school,
    );
    if (!m) fail("Gabungan tidak ditemui.");
    await db().batch([
      statement(
        "UPDATE students SET merged_into=NULL,updated_at=? WHERE id=? AND school_id=?",
        at,
        m.from_id,
        school,
      ),
      statement(
        "UPDATE identity_merges SET undone=1 WHERE id=? AND school_id=?",
        id,
        school,
      ),
    ]);
    await audit(u, "Batal gabungan identiti", id);
    return { ok: true };
  }
  if (path === "observation") {
    requireRole(u, ["admin", "teacher"]);
    await studentAccess(u, p.student_id);
    await run(
      "INSERT INTO teacher_observations (id,school_id,student_id,note,teacher_id,created_at) VALUES (?,?,?,?,?,?)",
      id,
      school,
      p.student_id,
      required(p.note, "Pemerhatian"),
      u.id,
      at,
    );
    await audit(u, "Pemerhatian guru", id);
    return { id };
  }
  if (path === "target") {
    requireRole(u, ["admin", "teacher"]);
    if (p.student_id) await studentAccess(u, p.student_id);
    if (p.class_id) {
      const c = await first(
        "SELECT * FROM classes WHERE id=? AND school_id=?",
        p.class_id,
        school,
      );
      if (
        !c ||
        (u.role === "teacher" && !JSON.parse(u.class_ids).includes(c.id))
      )
        fail("Kelas tidak dibenarkan.", 403);
    }
    if (!p.student_id && !p.class_id) fail("Pilih murid atau kelas.");
    if (p.student_id && p.class_id) fail("Pilih satu skop sasaran sahaja.");
    const n = Number(p.target);
    if (!Number.isInteger(n) || n < 1 || n > 100000) fail("Sasaran tidak sah.");
    const start = date(p.start),
      end = date(p.end);
    if (start > end) fail("Tempoh sasaran tidak sah.");
    if (p.id) {
      const previous = await first(
        "SELECT * FROM reading_targets WHERE id=? AND school_id=?",
        id,
        school,
      );
      if (!previous || (u.role === "teacher" && previous.teacher_id !== u.id))
        fail("Sasaran tidak dibenarkan.", 403);
      await run(
        "UPDATE reading_targets SET student_id=?,class_id=?,title=?,target=?,start=?,end=?,source=? WHERE id=? AND school_id=?",
        p.student_id || null,
        p.class_id || null,
        required(p.title, "Tajuk sasaran"),
        n,
        start,
        end,
        p.source === "ains" ? "ains" : "school",
        id,
        school,
      );
      await audit(u, "Kemaskini sasaran", id, {
        previous,
        target: n,
        start,
        end,
      });
      return { id };
    }
    await run(
      "INSERT INTO reading_targets (id,school_id,student_id,class_id,title,target,start,end,source,teacher_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      id,
      school,
      p.student_id || null,
      p.class_id || null,
      required(p.title, "Tajuk sasaran"),
      n,
      start,
      end,
      p.source === "ains" ? "ains" : "school",
      u.id,
      at,
    );
    await audit(u, "Tambah sasaran", id);
    return { id };
  }
  if (path === "reading") {
    requireRole(u, ["admin", "teacher"]);
    await studentAccess(u, p.student_id);
    if (!p.confirmed) fail("Pengesahan guru diperlukan.");
    await run(
      "INSERT INTO school_reading_entries (id,school_id,student_id,book_id,title,date,type,completion,language,category,reflection,teacher_id,confirmed,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      school,
      p.student_id,
      p.book_id || null,
      required(p.title, "Bahan bacaan"),
      date(p.date),
      text(p.type) || "assisted",
      p.completion === "complete" ? "complete" : "in_progress",
      text(p.language) || "bm",
      text(p.category) || "fiction",
      text(p.reflection),
      u.id,
      1,
      at,
    );
    await audit(u, "Rekod Bacaan Sekolah", id);
    return { id, source: "school", ainsApproved: false };
  }
  if (path === "reading/reconcile") {
    requireRole(u, ["admin", "teacher"]);
    const r = await first(
      "SELECT * FROM school_reading_entries WHERE id=? AND school_id=?",
      id,
      school,
    );
    if (!r) fail("Rekod tidak ditemui.");
    await studentAccess(u, r.student_id);
    const s = await first(
      "SELECT * FROM ains_summaries WHERE id=? AND school_id=? AND student_id=?",
      p.summary_id,
      school,
      r.student_id,
    );
    if (!s) fail("Ringkasan AINS murid tidak sepadan.");
    await run(
      "UPDATE school_reading_entries SET reconciled_summary_id=? WHERE id=? AND school_id=?",
      s.id,
      id,
      school,
    );
    await audit(u, "Pautkan bacaan kepada ringkasan AINS", id, {
      summary: s.id,
      note: required(p.note, "Bukti pautan"),
    });
    return { ok: true };
  }
  if (path === "programme") {
    requireRole(u, ["admin", "teacher"]);
    const participants = Array.isArray(p.participants)
      ? [...new Set(p.participants)]
      : [];
    for (const student of participants) await studentAccess(u, String(student));
    const target = Number(p.target_participants),
      actual = Number(p.actual_participants);
    if (
      !Number.isInteger(target) ||
      target < 0 ||
      !Number.isInteger(actual) ||
      actual < 0 ||
      actual < participants.length
    )
      fail("Bilangan peserta tidak sah.");
    const stmts = [
      statement(
        "INSERT INTO reading_programmes (id,school_id,name,date,organizer,target_participants,actual_participants,activities,outcomes,notes,teacher_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        school,
        required(p.name, "Nama program"),
        date(p.date),
        required(p.organizer, "Penganjur"),
        target,
        actual,
        required(p.activities, "Aktiviti"),
        required(p.outcomes, "Hasil bacaan"),
        text(p.notes),
        u.id,
        at,
      ),
      ...participants.map((s) =>
        statement(
          "INSERT INTO programme_participants (id,school_id,programme_id,student_id) VALUES (?,?,?,?)",
          uid(),
          school,
          id,
          s,
        ),
      ),
    ];
    await db().batch(stmts);
    await audit(u, "Daftar program", id);
    return { id };
  }
  if (path === "settings") {
    requireRole(u, ["admin"]);
    const current = JSON.parse(
      (await first("SELECT data FROM settings WHERE school_id=?", school))
        ?.data || "{}",
    );
    if (p.smartlibUrl) {
      let url: URL;
      try {
        url = new URL(p.smartlibUrl);
      } catch {
        fail("URL SMARTLIB tidak sah.");
      }
      if (
        url!.protocol !== "https:" ||
        url!.username ||
        url!.password ||
        /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(url!.hostname)
      )
        fail("Adapter memerlukan URL HTTPS awam yang dibenarkan.");
    }
    const next = {
      ...current,
      schoolName: text(p.schoolName) || SCHOOL.name,
      smartlibUrl: text(p.smartlibUrl),
      schoolLogo: current.schoolLogo || "",
    };
    await run(
      "UPDATE settings SET data=? WHERE school_id=?",
      JSON.stringify(next),
      school,
    );
    await audit(u, "Kemaskini tetapan", school);
    return { ok: true };
  }
  if (path === "rules") {
    requireRole(u, ["admin"]);
    const r = { thresholds: p.thresholds, marks: p.marks };
    if (!validRule(r)) fail("Lima ambang menaik dan markah sah diperlukan.");
    if (p.certified && !p.reference)
      fail("Rujukan pengesahan peraturan diperlukan.");
    await run(
      "INSERT INTO star_rule_versions (id,school_id,thresholds,marks,certified,reference,created_at,created_by) VALUES (?,?,?,?,?,?,?,?)",
      id,
      school,
      JSON.stringify(r.thresholds),
      JSON.stringify(r.marks),
      p.certified ? 1 : 0,
      text(p.reference),
      at,
      u.id,
    );
    await audit(u, "Versi peraturan bintang", id, r);
    return { id };
  }
  if (path === "user") {
    requireRole(u, ["admin"]);
    const email = required(p.email, "E-mel").toLowerCase();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !["admin", "teacher", "student", "public"].includes(p.role)
    )
      fail("E-mel atau peranan tidak sah.");
    if (p.role === "student") await studentAccess(u, p.student_id);
    const classIds = Array.isArray(p.class_ids) ? p.class_ids : [];
    for (const c of classIds) {
      if (
        !(await first(
          "SELECT id FROM classes WHERE id=? AND school_id=?",
          c,
          school,
        ))
      )
        fail("Kelas tidak sah.");
    }
    const registered = await first(
      "SELECT id FROM users WHERE school_id=? AND email=?",
      school,
      email,
    );
    if (registered) p.user_id = registered.id;
    if (p.user_id) {
      if (p.user_id === u.id)
        fail("Peranan pentadbir sendiri tidak boleh diubah di sini.");
      await run(
        "UPDATE users SET role=?,class_ids=?,student_id=?,active=? WHERE id=? AND school_id=?",
        p.role,
        JSON.stringify(classIds),
        p.student_id || null,
        p.active === false ? 0 : 1,
        p.user_id,
        school,
      );
    } else
      await run(
        "INSERT INTO invitations (id,school_id,email,role,student_id,class_ids,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(school_id,email) DO UPDATE SET role=excluded.role,student_id=excluded.student_id,class_ids=excluded.class_ids",
        id,
        school,
        email,
        p.role,
        p.student_id || null,
        JSON.stringify(classIds),
        at,
      );
    await audit(u, "Tetapkan akses pengguna", id, { email, role: p.role });
    return { id };
  }
  if (path === "certificate") {
    requireRole(u, ["admin", "teacher"]);
    await studentAccess(u, p.student_id);
    const data = await loadData(u),
      f = { ...p.filters, student: p.student_id };
    const m = metrics(data, f),
      s = m.students.find((s: any) => s.id === p.student_id);
    const category = required(p.category, "Kategori sijil");
    const allowed = [
      "Bintang NILAM",
      "Pembaca Paling Konsisten",
      "Peningkatan Bacaan Terbaik",
      "Pembaca Terbanyak",
      "Pencapaian Sasaran Bacaan",
    ];
    if (!allowed.includes(category)) fail("Kategori sijil tidak sah.");
    if (
      category === "Bintang NILAM" &&
      (!s?.achievement.level || m.unverified || m.blocked.length || m.multiyear)
    )
      fail(
        "Sijil bintang memerlukan tempoh tunggal yang disahkan dan bintang dicapai.",
      );
    let total = s?.eligible ?? 0;
    const certificateDate = date(p.date),
      eligibleBatches = m.batches.filter(
        (b: any) => b.star_eligible && b.verification === "verified",
      );
    if (
      category === "Bintang NILAM" &&
      eligibleBatches.some((b: any) => b.period_end > certificateDate)
    )
      fail("Tarikh sijil mesti pada atau selepas akhir skop pencapaian.");
    let scope = "";
    if (category === "Bintang NILAM") {
      scope = `${f.dataset || eligibleBatches[0]?.dataset} · ${f.year || eligibleBatches[0]?.year}`;
    } else {
      const local = data.school_reading_entries.filter(
        (r: any) =>
          r.canonical_id === p.student_id &&
          r.completion === "complete" &&
          r.date <= certificateDate &&
          (!f.year || r.date.slice(0, 4) === String(f.year)) &&
          (!f.month || Number(r.date.slice(5, 7)) === Number(f.month)),
      );
      total = local.length;
      if (!p.note || p.note.length < 12)
        fail("Catat asas pengiktirafan guru (sekurang-kurangnya 12 aksara).");
      scope = `Rekod Bacaan Sekolah · ${f.year || "Semua tahun"} hingga ${certificateDate} · ${text(p.note)}`;
    }
    const token = uid();
    await run(
      "INSERT INTO certificates (id,school_id,student_id,category,total,level,date,dataset,scope,rule_id,verification_token,issued_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      school,
      p.student_id,
      category,
      total,
      category === "Bintang NILAM" ? s.achievement.level : null,
      date(p.date),
      f.dataset || "school",
      scope,
      data.rule.id || null,
      token,
      u.id,
      at,
    );
    if (category === "Bintang NILAM")
      await run(
        "INSERT INTO student_achievements (id,school_id,student_id,rule_id,year,dataset,level,total,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        uid(),
        school,
        p.student_id,
        data.rule.id,
        Number(eligibleBatches[0].year),
        eligibleBatches[0].dataset,
        s.achievement.level,
        total,
        at,
      );
    await audit(u, "Keluarkan sijil pengiktirafan sekolah", id);
    return { id, token };
  }
  if (path === "certificate/revoke") {
    requireRole(u, ["admin"]);
    await run(
      "UPDATE certificates SET revoked=1 WHERE id=? AND school_id=?",
      id,
      school,
    );
    await audit(u, "Batal sijil", id);
    return { ok: true };
  }
  if (path === "book/save") {
    requireRole(u, ["admin", "teacher"]);
    const externalId = required(p.id, "Pengecam buku", 150),
      existing = await first(
        "SELECT id FROM smartlib_book_links WHERE external_id=? AND school_id=?",
        externalId,
        school,
      );
    const bookId = existing?.id || uid();
    if (existing)
      await run(
        "UPDATE smartlib_book_links SET suitable=?,updated_at=? WHERE id=? AND school_id=?",
        p.suitable ? 1 : 0,
        at,
        bookId,
        school,
      );
    else
      await run(
        "INSERT INTO smartlib_book_links (id,school_id,external_id,title,author,isbn,category,language,cover,availability,suitable,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        bookId,
        school,
        externalId,
        required(p.title, "Tajuk buku"),
        text(p.author),
        text(p.isbn),
        text(p.category),
        text(p.language),
        typeof p.cover === "string" && p.cover.startsWith("https://")
          ? p.cover
          : null,
        text(p.availability),
        p.suitable ? 1 : 0,
        at,
      );
    await audit(u, "Pilih bahan sesuai SMARTLIB", bookId);
    return { id: bookId, ainsApproved: false };
  }
  fail("Tindakan tidak ditemui.", 404);
}
