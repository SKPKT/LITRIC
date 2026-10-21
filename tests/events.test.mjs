import test from "node:test";
import assert from "node:assert/strict";
import { prepareEvents } from "../lib/events.mjs";
import { reviewRows, aggregate } from "../lib/domain.mjs";
const e = (id, status = "approved") => ({
  code: "ABA6052",
  name: "MURID UJIAN",
  email: "fixture@example.invalid",
  event_id: id,
  reading_date: "2025-06-01",
  title: "BUKU UJIAN",
  approval_status: status,
  language: "bm",
  category: "fiction",
});
test("individual events require explicit approval; pending is not a book approval", async () => {
  const x = await prepareEvents(
    [e("a"), e("b", "pending"), e("c", "rejected")],
    "ABA6052",
  );
  assert.equal(x.rows.length, 1);
  assert.equal(x.rows[0].approved, 1);
  assert.equal(x.rows[0].rejected, 1);
  assert.equal(x.rows[0]["total bm"], 1);
});
test("repeat event within file is not counted twice", async () => {
  const x = await prepareEvents([e("a"), e("a")], "ABA6052");
  assert.equal(x.duplicates, 1);
  assert.equal(x.rows[0].approved, 1);
});
test("same ID with conflicting event content fails safely", async () => {
  await assert.rejects(
    () => prepareEvents([e("a"), { ...e("a"), title: "BUKU LAIN" }], "ABA6052"),
    /bercanggah/,
  );
});
test("registry matches duplicate events across exports", async () => {
  const x = await prepareEvents([e("a")], "ABA6052");
  const y = await prepareEvents(
    [e("a"), e("b")],
    "ABA6052",
    new Map([["a", { content_hash: x.events[0].hash }]]),
  );
  assert.equal(y.duplicates, 1);
  assert.equal(y.rows[0].approved, 1);
});
test("missing event ID/date/status cannot imply a reading", async () => {
  const x = await prepareEvents(
    [
      { ...e("a"), event_id: "" },
      { ...e("b"), reading_date: "2025-02-30" },
      { ...e("c"), approval_status: "" },
    ],
    "ABA6052",
  );
  assert.equal(x.events.length, 0);
  assert.equal(x.errors.length, 3);
});
test("distinct verified event batches may share dates without double counting summaries", () => {
  const s = { id: "s", name: "UJIAN" },
    b = (id) => ({
      id,
      dataset: "event",
      year: 2025,
      granularity: "event",
      period_start: "2025-06-01",
      period_end: "2025-06-30",
      verification: "verified",
      star_eligible: 1,
      status: "active",
      coverage_complete: 1,
    }),
    r = (id) => ({
      student_id: "s",
      batch_id: id,
      approved: 1,
      rejected: 0,
      measures: {},
      status: "accepted",
    });
  const m = aggregate({
    students: [s],
    rows: [r("a"), r("b")],
    batches: [b("a"), b("b")],
  });
  assert.equal(m.eligible, 2);
  assert.equal(m.blocked.length, 0);
});
test("missing language is unavailable rather than zero", () => {
  const m = aggregate({
    students: [{ id: "s", name: "UJIAN" }],
    rows: [
      {
        student_id: "s",
        batch_id: "b",
        approved: 3,
        rejected: 0,
        status: "accepted",
        measures: {},
      },
    ],
    batches: [{ id: "b", dataset: "test", status: "active" }],
    filters: { language: "bm" },
  });
  assert.equal(m.reported, null);
  assert.equal(m.active, null);
  assert.equal(m.languages[0].value, null);
  assert.equal(m.students[0].achievement.level, null);
});
