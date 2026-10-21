import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { reviewRows, aggregate } from "../lib/domain.mjs";
const seed = JSON.parse(
  fs.readFileSync(new URL("../lib/seed-data.json", import.meta.url)),
);
test("provided source controls: school rows only, separate totals", {skip: seed.length === 0 ? "Private school sources are excluded from public source" : false}, () => {
  const monthly = seed.filter((b) => b.sourceType === "CSV"),
    ains = seed.find((b) => b.sourceType === "XLSX");
  assert.equal(monthly.length, 7);
  assert.equal(
    new Set(monthly.flatMap((b) => b.rows.map((r) => r.email))).size,
    28,
  );
  assert.equal(
    monthly.flatMap((b) => b.rows).reduce((s, r) => s + Number(r.approved), 0),
    322,
  );
  assert.equal(new Set(ains.rows.map((r) => r.email)).size, 20);
  assert.equal(
    ains.rows.reduce((s, r) => s + Number(r.approved), 0),
    362,
  );
  assert.ok(seed.every((b) => b.rows.every((r) => r.code === "ABA6052")));
  assert.ok(seed.every((b) => !b.year));
});
test("each supplied source detects its repeated rows or conflicting identities", {skip: seed.length === 0 ? "Private school sources are excluded from public source" : false}, async () => {
  for (const b of seed) {
    const x = await reviewRows(b.rows);
    assert.equal(
      x.stats.reported,
      b.rows.reduce((s, r) => s + Number(r.approved), 0),
    );
    assert.ok(
      x.stats.review >= 2 || x.stats.duplicate >= 1,
      `${b.filename}: repeated IDs must be detected`,
    );
    assert.equal(x.stats.rejected, 0);
  }
});
