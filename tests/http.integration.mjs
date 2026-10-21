// Run only against the local built Worker. Identity headers simulate trusted Sites dispatch.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
const origin = process.env.LITRIC_TEST_ORIGIN || process.env.LITRIX_TEST_ORIGIN || "http://127.0.0.1:8787";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw new Error(
    "Integration tests are restricted to a local non-production database.",
  );
const admin = {
  "oai-authenticated-user-id": "local_seedy",
  "oai-authenticated-user-email": "seedy@sites.test",
};
const teacher = {
  "oai-authenticated-user-id": "fixture-teacher",
  "oai-authenticated-user-email": "teacher-fixture@example.invalid",
};
const pupil = {
  "oai-authenticated-user-id": "fixture-pupil",
  "oai-authenticated-user-email": "pupil-fixture@example.invalid",
};
const publicUser = {
  "oai-authenticated-user-id": "fixture-display",
  "oai-authenticated-user-email": "display-fixture@example.invalid",
};
let checks = 0;
async function call(path, body, headers = admin, status = 200) {
  const r = await fetch(origin + "/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...headers,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json();
  assert.equal(r.status, status, `${path}: ${JSON.stringify(j)}`);
  checks++;
  return j;
}
const tag = Date.now();
const privateSources = JSON.parse(await fs.readFile(new URL("../lib/seed-data.json", import.meta.url), "utf8"));
const dataset = `UJIAN-${tag}`,
  sourceId = `fixture-${tag}@example.invalid`;
const source = (approved) => ({
  filename: `fixture-${tag}-${approved}.csv`,
  dataset,
  sourceType: "CSV",
  rows: [
    {
      code: "ABA6052",
      school: "SEKOLAH UJIAN",
      name: "MURID UJIAN ANONIM",
      email: sourceId,
      approved,
      rejected: 0,
      "total bm": approved,
      "total eng": 0,
      "total others": 0,
    },
  ],
});
await call("state", undefined, {}, 401);
await call("state");
const seeded = await call("seed", {});
assert.equal(seeded.results.length, privateSources.length);
const repeats = await call("seed", {});
assert.ok(repeats.results.every((x) => x.duplicate));
let state;
if (privateSources.length) {
state = await call(
  "state?dataset=" + encodeURIComponent("AINS 2025 (label pengguna)"),
);
assert.equal(state.metrics.reported, 362);
assert.equal(state.metrics.students.length, 20);
assert.equal(state.metrics.eligible, null);
const monthly = await call(
  "state?dataset=" + encodeURIComponent("NILAM Jan–Jul"),
);
assert.equal(monthly.metrics.reported, 322);
assert.equal(monthly.metrics.students.length, 28);
assert.equal(monthly.metrics.monthly.length, 7);
} else {
  await call("import/commit", {...source(1),dataset:`OTHER-FIXTURE-${tag}`, rows:[{...source(1).rows[0],name:"MURID UJIAN KEDUA",email:`other-fixture-${tag}@example.invalid`}]});
}
const imported = await call("import/commit", source(144));
const repeated = await call("import/commit", source(144));
assert.equal(repeated.duplicate, true);
state = await call("state?dataset=" + dataset);
let s = state.metrics.students[0];
assert.equal(s.achievement.level, null);
await call("batch/verify", {
  id: imported.batchId,
  year: 2025,
  period_start: "2025-01-01",
  period_end: "2025-12-31",
  granularity: "annual",
  coverage_complete: true,
  star_eligible: true,
  note: "UJIAN AUTOMATIK: skop fixture disahkan.",
});
state = await call("state?dataset=" + dataset);
s = state.metrics.students[0];
assert.equal(s.achievement.level, 1);
assert.equal(s.achievement.marks, 3);
const classResult = await call("class", {
  name: `KELAS UJIAN ${tag}`,
  year: 2025,
});
await call("student", {
  id: s.id,
  name: s.name,
  class_id: classResult.id,
  academic_year: 2025,
  status: "current",
});
await call("user", {
  email: teacher["oai-authenticated-user-email"],
  role: "teacher",
  class_ids: [classResult.id],
});
await call("user", {
  email: pupil["oai-authenticated-user-email"],
  role: "student",
  student_id: s.id,
});
await call("user", {
  email: publicUser["oai-authenticated-user-email"],
  role: "public",
});
const tState = await call("state?dataset=" + dataset, undefined, teacher);
assert.equal(tState.students.length, 1);
assert.equal(tState.users, undefined);
assert.equal(tState.aliases, undefined);
const pState = await call("state?dataset=" + dataset, undefined, pupil);
assert.equal(pState.students.length, 1);
assert.equal(pState.students[0].id, s.id);
await call("import/commit", source(999), teacher, 403);
await call(
  "reading",
  {
    student_id: s.id,
    title: "Buku Ujian",
    date: "2025-05-01",
    confirmed: true,
  },
  pupil,
  403,
);
await call("report", undefined, pupil, 403);
const denied = state.students.find((x) => x.id !== s.id);
await call(
  "reading",
  {
    student_id: denied.id,
    title: "Tidak dibenarkan",
    date: "2025-05-01",
    confirmed: true,
  },
  teacher,
  403,
);
await call(
  "reading",
  {
    student_id: s.id,
    title: "BUKU UJIAN ANONIM",
    date: "2025-05-01",
    type: "assisted",
    completion: "complete",
    language: "bm",
    category: "fiction",
    confirmed: true,
    approved: 9999,
  },
  teacher,
);
const afterReading = await call("state?dataset=" + dataset);
assert.equal(afterReading.metrics.reported, 144);
assert.ok(
  afterReading.school_reading_entries.some((r) => r.student_id === s.id),
);
await call(
  "target",
  {
    student_id: s.id,
    title: "SASARAN UJIAN",
    target: 10,
    start: "2025-05-01",
    end: "2025-05-31",
    source: "school",
  },
  teacher,
);
const cert = await call("certificate", {
  student_id: s.id,
  category: "Bintang NILAM",
  date: "2025-12-31",
  filters: { dataset },
});
await call("certificate/verify?token=" + cert.token, undefined, {}, 401);
await call("report", undefined, {}, 401);
await call("backup", undefined, {}, 401);
const verified = await call(
  "certificate/verify?token=" + cert.token,
  undefined,
  pupil,
);
assert.equal(verified.level, 1);
const pdf = await fetch(origin + "/api/certificate/pdf?id=" + cert.id, {
  headers: admin,
});
assert.equal(pdf.status, 200);
const certBytes = new Uint8Array(await pdf.arrayBuffer());
const certDoc = await PDFDocument.load(certBytes);
assert.equal(certDoc.getPages().length, 1);
assert.ok(Math.abs(certDoc.getPages()[0].getWidth() - 841.89) < 1);
const report = await fetch(
  origin + "/api/report?dataset=" + dataset + "&format=xlsx",
  { headers: admin },
);
assert.equal(report.status, 200);
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(await report.arrayBuffer());
const summarySheet = wb.getWorksheet("Ringkasan");
let reported;
summarySheet.eachRow(row => { if (row.getCell(1).value === "Bacaan dilaporkan") reported = row.getCell(2).value; });
assert.equal(reported, 144);
assert.equal(wb.creator, "LITRIC");
assert.equal(certDoc.getTitle(), "LITRIC — Sijil Pengiktirafan Sekolah");
const reportPDF = await fetch(
  origin + "/api/report?dataset=" + dataset + "&format=pdf",
  { headers: admin },
);
assert.equal(reportPDF.status, 200);
await PDFDocument.load(await reportPDF.arrayBuffer());
await call("batch/rollback", { id: imported.batchId });
const rolled = await call("state?dataset=" + dataset);
assert.equal(rolled.metrics.reported, 0);
await call("batch/restore", { id: imported.batchId });
const restored = await call("state?dataset=" + dataset);
assert.equal(restored.metrics.students[0].achievement.level, null);
const snapDataset = `UJIAN-SNAPSHOT-${tag}`;
const old = await call("import/commit", {
  ...source(200),
  dataset: snapDataset,
});
const newer = await call("import/commit", {
  ...source(300),
  dataset: snapDataset,
});
for (const [b, d] of [
  [old, "2025-06-01"],
  [newer, "2025-07-01"],
])
  await call("batch/verify", {
    id: b.batchId,
    year: 2025,
    period_start: "2025-01-01",
    period_end: d,
    snapshot_date: d,
    granularity: "snapshot",
    star_eligible: true,
    coverage_complete: true,
    note: "UJIAN AUTOMATIK snapshot kumulatif.",
  });
const snap = await call("state?dataset=" + snapDataset);
assert.equal(snap.metrics.reported, 300);
assert.equal(snap.metrics.eligible, 300);
const eventDataset = `UJIAN-EVENT-${tag}`;
const eventRow = (id) => ({
  code: "ABA6052",
  name: "MURID UJIAN ANONIM",
  email: sourceId,
  event_id: `${tag}-${id}`,
  reading_date: "2025-06-01",
  title: "BAHAN UJIAN",
  approval_status: "approved",
  language: "bm",
  category: "fiction",
});
const event1 = await call("import/commit", {
  filename: `event-${tag}.csv`,
  dataset: eventDataset,
  sourceType: "CSV",
  granularity: "event",
  rows: [eventRow("a"), eventRow("b")],
});
const event2 = await call("import/commit", {
  filename: `event2-${tag}.csv`,
  dataset: eventDataset,
  sourceType: "CSV",
  granularity: "event",
  rows: [eventRow("a"), eventRow("b"), eventRow("c")],
});
assert.equal(event2.stats.duplicateEvents, 2);
let eventState = await call("state?dataset=" + eventDataset);
assert.equal(eventState.metrics.reported, 3);
assert.equal(eventState.metrics.monthly[0].value, 3);
for (const b of [event1, event2])
  await call("batch/verify", {
    id: b.batchId,
    year: 2025,
    period_start: "2025-06-01",
    period_end: "2025-06-30",
    granularity: "event",
    star_eligible: true,
    coverage_complete: true,
    note: "UJIAN AUTOMATIK: peristiwa dikenal pasti.",
  });
eventState = await call("state?dataset=" + eventDataset);
assert.equal(eventState.metrics.eligible, 3);
await call("batch/rollback", { id: event1.batchId });
eventState = await call("state?dataset=" + eventDataset);
assert.equal(eventState.metrics.reported, 1);
await call("batch/restore", { id: event1.batchId });
eventState = await call("state?dataset=" + eventDataset);
assert.equal(eventState.metrics.reported, 3);
assert.equal(eventState.metrics.unverified, true);
const display = await call("state", undefined, publicUser);
const mergedProfile = await call("student", {
  name: "PROFIL UTAMA UJIAN",
  class_id: classResult.id,
  academic_year: 2025,
  status: "current",
});
const merge = await call("identity/merge", {
  from: s.id,
  into: mergedProfile.id,
  reason: "UJIAN AUTOMATIK padanan identiti disahkan.",
});
let afterMerge = await call("state?dataset=" + dataset, undefined, pupil);
assert.equal(afterMerge.students.length, 1);
assert.equal(afterMerge.students[0].id, mergedProfile.id);
assert.equal(afterMerge.metrics.reported, 144);
await call("identity/undo", { id: merge.id });
afterMerge = await call("state?dataset=" + dataset, undefined, pupil);
assert.equal(afterMerge.students[0].id, s.id);
const programme = await call(
  "programme",
  {
    name: `PROGRAM UJIAN ${tag}`,
    date: "2025-06-01",
    organizer: "GURU UJIAN",
    target_participants: 1,
    actual_participants: 1,
    participants: [s.id],
    activities: "Aktiviti bacaan ujian.",
    outcomes: "Satu aktiviti ujian direkodkan.",
    notes: "Bukti ujian anonim.",
  },
  teacher,
);
const png = new Uint8Array(
  await fs.readFile(new URL("./fixtures/evidence-test.png", import.meta.url)),
);
const form = new FormData();
form.set("programme_id", programme.id);
form.set("file", new Blob([png], { type: "image/png" }), "bukti-ujian.png");
const upload = await fetch(origin + "/api/file", {
  method: "POST",
  headers: teacher,
  body: form,
});
assert.equal(upload.status, 200);
const evidence = await upload.json();
await call("file?id=" + evidence.id, undefined, pupil, 403);
const programmePdf = await fetch(
  origin +
    "/api/report?dataset=" +
    dataset +
    "&programme=" +
    programme.id +
    "&format=pdf",
  { headers: teacher },
);
assert.equal(programmePdf.status, 200);
const programmeBytes = new Uint8Array(await programmePdf.arrayBuffer());
const pdoc = await PDFDocument.load(programmeBytes);
assert.ok(pdoc.getPages().length >= 2);
const backupResponse = await fetch(origin + "/api/backup", { headers: admin });
assert.equal(backupResponse.status, 200);
const backup = await backupResponse.json();
assert.ok(backup.tables.ains_event_registry);
await fs.mkdir("../../work/qa", { recursive: true });
await fs.writeFile("../../work/qa/backup-test.json", JSON.stringify(backup));
await fs.writeFile("../../work/qa/programme-test.pdf", programmeBytes);
assert.equal(display.students, undefined);
assert.equal(display.ains_summaries, undefined);
await call("backup", undefined, publicUser, 403);
const forged = await fetch(origin + "/api/class", {
  method: "POST",
  headers: {
    ...admin,
    "Content-Type": "application/json",
    Origin: "https://untrusted.invalid",
  },
  body: JSON.stringify({ name: "BLOCKED", year: 2025 }),
});
assert.equal(forged.status, 403);
await call("state?dataset=" + dataset + "&year=2025&classId=" + classResult.id);
const otherYear = await call("state?dataset=" + dataset + "&year=2024");
assert.equal(otherYear.metrics.reported,0);
const wrongClass = await call("state?dataset=" + dataset + "&classId=class-not-assigned");
assert.equal(wrongClass.metrics.students.length,0);
await fs.mkdir("../../work/qa", { recursive: true });
await fs.writeFile("../../work/qa/certificate-test.pdf", certBytes);
await fs.writeFile(
  "../../work/qa/integration-result.json",
  JSON.stringify(
    {
      apiResponses: checks,
      passed: true,
      sourceControls: privateSources.length ? {
        ains: { students: 20, reported: 362 },
        monthly: { students: 28, rawReported: 322 },
      } : {privateSourcesExcluded: true},
      date: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(
  `PASS: ${checks} API responses validated; certificate PDF, report PDF, programme evidence PDF, XLSX and backup inspected. Fixtures exist only in the local test database.`,
);
