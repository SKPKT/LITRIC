import test from "node:test";
import assert from "node:assert/strict";
import {
  star,
  reviewRows,
  aggregate,
  selectVerified,
  canAccessStudent,
  validScope,
  validRule,
  digest,
  stable,
  coversRange,
} from "../lib/domain.mjs";
const s = {
  id: "student-a",
  name: "MURID UJIAN A",
  school_id: "ABA6052",
  class_id: "class-a",
  active: 1,
};
const b = (id, extra = {}) => ({
  id,
  dataset: "test",
  year: 2025,
  period_start: "2025-01-01",
  period_end:
    extra.granularity === "snapshot"
      ? extra.snapshot_date || "2025-12-31"
      : "2025-12-31",
  snapshot_date: "2025-12-31",
  granularity: "annual",
  verification: "verified",
  status: "active",
  star_eligible: 1,
  coverage_complete: 1,
  created_at: "2026-01-01",
  ...extra,
});
const r = (id, batch, total, extra = {}) => ({
  id,
  batch_id: batch,
  student_id: s.id,
  canonical_id: s.id,
  approved: total,
  rejected: 0,
  status: "accepted",
  measures: { "total bm": total, "total eng": 0, "total others": 0 },
  ...extra,
});
for (const [n, level] of [
  [143, 0],
  [144, 1],
  [287, 1],
  [288, 2],
  [431, 2],
  [432, 3],
  [575, 3],
  [576, 4],
  [719, 4],
  [720, 5],
  [900, 5],
])
  test(`${n} bacaan = ${level} bintang`, () => {
    assert.equal(star(n).level, level);
    assert.equal(star(n).marks, level ? level + 2 : null);
  });
test("300 bacaan: 132 lagi ke 432, 4 markah", () =>
  assert.deepEqual(
    [star(300).next, star(300).remaining, star(300).marks],
    [432, 132, 4],
  ));
test("unknown scope is not a zero-star result", () =>
  assert.equal(star(null).level, null));
test("numeric validation and exact school filtering", async () => {
  const x = await reviewRows([
    { code: "ABA6052", name: "A", email: "a", approved: "-1" },
    { code: "OTHER", name: "B", approved: 999 },
    { code: "ABA6052", name: "C", email: "c", approved: "3.5" },
    { code: "ABA6052", name: "D", email: "d", approved: 4 },
  ]);
  assert.equal(x.stats.rejected, 2);
  assert.equal(x.stats.excluded, 1);
  assert.equal(x.stats.reported, 4);
});
test("exact duplicate rows excluded from reported readings", async () => {
  const raw = { code: "ABA6052", name: "A", email: "a", approved: "14" };
  const x = await reviewRows([raw, { ...raw }]);
  assert.equal(x.stats.reported, 14);
  assert.equal(x.stats.duplicate, 1);
});
test("different rows for same source id require review", async () => {
  const raw = { code: "ABA6052", name: "A", email: "a", approved: "14" };
  const x = await reviewRows([raw, { ...raw, approved: "16" }]);
  assert.equal(x.stats.review, 2);
  assert.equal(x.stats.accepted, 0);
});
test("reimport content fingerprint is independent of row order", async () => {
  const raw = [
    { code: "ABA6052", name: "A", email: "a", approved: "14" },
    { code: "ABA6052", name: "B", email: "b", approved: "15" },
  ];
  const a = await reviewRows(raw),
    b = await reviewRows([...raw].reverse());
  assert.equal(
    await digest(JSON.stringify(a.rows.map((x) => x.rowHash).sort())),
    await digest(JSON.stringify(b.rows.map((x) => x.rowHash).sort())),
  );
});
test("later cumulative snapshot replaces earlier", () => {
  const batches = [
    b("old", { granularity: "snapshot", snapshot_date: "2025-06-01" }),
    b("new", { granularity: "snapshot", snapshot_date: "2025-07-01" }),
  ];
  const selected = selectVerified(
    [r("r1", "old", 200), r("r2", "new", 300)],
    batches,
  );
  assert.equal(
    selected.rows.reduce((s, r) => s + r.approved, 0),
    300,
  );
});
test("snapshot dashboard total also replaces earlier snapshot", () => {
  const m = aggregate({
    students: [s],
    rows: [r("r1", "old", 200), r("r2", "new", 300)],
    batches: [
      b("old", { granularity: "snapshot", snapshot_date: "2025-06-01" }),
      b("new", { granularity: "snapshot", snapshot_date: "2025-07-01" }),
    ],
  });
  assert.equal(m.reported, 300);
  assert.equal(m.eligible, 300);
  assert.equal(m.rawReported, 500);
});
test("disjoint cumulative baselines remain separate and may be combined after verification", () => {
  const m = aggregate({
    students: [s],
    rows: [r("a", "a", 200), r("b", "b", 300)],
    batches: [
      b("a", {
        granularity: "snapshot",
        period_end: "2025-06-30",
        snapshot_date: "2025-06-30",
      }),
      b("b", {
        granularity: "snapshot",
        period_start: "2025-07-01",
        snapshot_date: "2025-12-31",
      }),
    ],
  });
  assert.equal(m.reported, 500);
  assert.equal(m.eligible, 500);
});
test("overlapping verified annual and monthly scopes are blocked", () => {
  const x = selectVerified(
    [r("a", "a", 300), r("b", "b", 20)],
    [b("a"), b("b", { granularity: "monthly", period_end: "2025-01-31" })],
  );
  assert.equal(x.rows.length, 0);
  assert.deepEqual(x.blocked, [s.id]);
});
test("disjoint months can be added", () => {
  const x = selectVerified(
    [r("a", "a", 10), r("b", "b", 20)],
    [
      b("a", { granularity: "monthly", period_end: "2025-01-31" }),
      b("b", {
        granularity: "monthly",
        period_start: "2025-02-01",
        period_end: "2025-02-28",
      }),
    ],
  );
  assert.equal(
    x.rows.reduce((n, r) => n + r.approved, 0),
    30,
  );
});
test("unknown year remains unverified for star totals", () => {
  const m = aggregate({
    students: [s],
    rows: [r("a", "a", 900)],
    batches: [b("a", { year: null })],
  });
  assert.equal(m.students[0].eligible, null);
  assert.equal(m.students[0].achievement.level, null);
});
test("years are not combined for stars, identity remains unique", () => {
  const m = aggregate({
    students: [s],
    rows: [r("a", "a", 200), r("b", "b", 200)],
    batches: [
      b("a"),
      b("b", {
        year: 2026,
        period_start: "2026-01-01",
        period_end: "2026-12-31",
      }),
    ],
  });
  assert.equal(m.students.length, 1);
  assert.equal(m.students[0].eligible, null);
  assert.equal(m.multiyear, true);
});
test("rolled-back import is excluded", () => {
  const m = aggregate({
    students: [s],
    rows: [r("a", "a", 300)],
    batches: [b("a", { status: "rolled_back" })],
  });
  assert.equal(m.reported, 0);
});
test("school entries or borrowing cannot enter AINS aggregation", () => {
  const m = aggregate({
    students: [s],
    rows: [],
    batches: [],
    school_reading_entries: [{ approved: 1000 }],
    borrowing: [{ approved: 1000 }],
  });
  assert.equal(m.reported, 0);
  assert.equal(m.eligible, null);
});
test("missing coverage is unavailable, not confirmed inactive", () => {
  const m = aggregate({
    students: [s],
    rows: [r("a", "a", 0)],
    batches: [b("a", { verification: "unverified" })],
  });
  assert.equal(m.inactive, null);
});
test("student and teacher permissions isolate school and class", () => {
  assert.equal(canAccessStudent(null, s), false);
  assert.equal(
    canAccessStudent({ active: 1, school_id: "OTHER", role: "admin" }, s),
    false,
  );
  assert.equal(
    canAccessStudent(
      {
        active: 1,
        school_id: s.school_id,
        role: "teacher",
        class_ids: '["class-b"]',
      },
      s,
    ),
    false,
  );
  assert.equal(
    canAccessStudent(
      {
        active: 1,
        school_id: s.school_id,
        role: "student",
        student_id: "other",
      },
      s,
    ),
    false,
  );
  assert.equal(
    canAccessStudent(
      {
        active: 1,
        school_id: s.school_id,
        role: "teacher",
        class_ids: '["class-a"]',
      },
      s,
    ),
    true,
  );
});
test("filtered reports and dashboard share same aggregate", () => {
  const args = {
    students: [s],
    rows: [r("a", "a", 123)],
    batches: [b("a")],
    filters: { dataset: "test", year: "2025", language: "bm" },
  };
  const dashboard = aggregate(args),
    report = aggregate(args);
  assert.equal(report.reported, 123);
  assert.deepEqual(report, dashboard);
});
test("invalid dates and rule thresholds rejected", () => {
  assert.equal(validScope(b("a", { period_end: "2025-02-30" })), false);
  assert.equal(
    validRule({
      thresholds: [144, 288, 288, 576, 720],
      marks: [3, 4, 5, 6, 7],
    }),
    false,
  );
});
test("overlapping scopes from different datasets cannot inflate stars", () => {
  const x = selectVerified(
    [r("a", "a", 300), r("b", "b", 300)],
    [b("a"), b("b", { dataset: "other" })],
  );
  assert.equal(x.rows.length, 0);
  assert.deepEqual(x.blocked, [s.id]);
});
test("coverage gaps cannot be treated as a complete target period", () => {
  assert.equal(
    coversRange(
      [
        ["2025-01-01", "2025-01-31"],
        ["2025-03-01", "2025-03-31"],
      ],
      "2025-01-01",
      "2025-03-31",
    ),
    false,
  );
  assert.equal(
    coversRange(
      [
        ["2025-01-01", "2025-01-31"],
        ["2025-02-01", "2025-02-28"],
      ],
      "2025-01-01",
      "2025-02-28",
    ),
    true,
  );
});
test("missing student-month coverage never confirms inactivity", () => {
  const other = { ...s, id: "student-b", name: "UJIAN B" };
  const m = aggregate({
    students: [s, other],
    rows: [
      r("a", "jan", 0),
      r("b", "feb", 0),
      r("c", "feb", 0, { student_id: other.id, canonical_id: other.id }),
    ],
    batches: [
      b("jan", { granularity: "monthly", period_end: "2025-01-31" }),
      b("feb", {
        granularity: "monthly",
        period_start: "2025-02-01",
        period_end: "2025-02-28",
      }),
    ],
  });
  assert.equal(m.inactive, null);
  assert.equal(m.complete, false);
});
