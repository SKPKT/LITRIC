import fs from "node:fs";
import { createHash } from "node:crypto";
export function validateBackup(dump) {
  if (dump.version !== 1 || dump.school !== "ABA6052" || !dump.tables)
    throw new Error("Unsupported school/backup.");
  const required = [
    "schools",
    "students",
    "student_aliases",
    "classes",
    "student_class_history",
    "users",
    "import_batches",
    "ains_summaries",
    "ains_snapshots",
    "ains_activity_records",
    "ains_event_registry",
    "star_rule_versions",
    "audit_logs",
  ];
  for (const table of required)
    if (!Array.isArray(dump.tables[table]))
      throw new Error("Missing table: " + table);
  for (const [table, rows] of Object.entries(dump.tables)) {
    if (!Array.isArray(rows)) throw new Error("Invalid table.");
    const ids = new Set();
    for (const row of rows) {
      if ((table === "schools" ? row.id : row.school_id) !== "ABA6052")
        throw new Error("Cross-school row.");
      if (row.id && ids.has(row.id)) throw new Error("Duplicate primary key.");
      ids.add(row.id);
    }
  }
  const students = new Set(dump.tables.students.map((s) => s.id)),
    batches = new Set(dump.tables.import_batches.map((b) => b.id));
  for (const table of [
    "ains_summaries",
    "ains_snapshots",
    "ains_activity_records",
  ])
    for (const row of dump.tables[table]) {
      if (!students.has(row.student_id) || !batches.has(row.batch_id))
        throw new Error("Broken historical reference.");
      if (!Number.isSafeInteger(row.approved ?? 0) || (row.approved ?? 0) < 0)
        throw new Error("Invalid reading count.");
    }
  const sums = {};
  for (const row of dump.tables.ains_summaries) {
    const year =
      dump.tables.import_batches.find((b) => b.id === row.batch_id)?.year ||
      "unknown";
    sums[year] = (sums[year] || 0) + row.approved;
  }
  return {
    school: dump.school,
    counts: Object.fromEntries(
      Object.entries(dump.tables).map(([k, v]) => [k, v.length]),
    ),
    rawApprovedByYear: sums,
    objectKeys: [
      ...new Set(
        [
          ...dump.tables.import_batches.map((b) => b.source_key),
          ...(dump.tables.evidence_files || []).map((f) => f.key),
        ].filter(Boolean),
      ),
    ],
  };
}
if (
  process.argv[1] &&
  new URL(import.meta.url).pathname.endsWith(
    process.argv[1].replaceAll("\\", "/"),
  )
) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw new Error(
      "Usage: node scripts/validate-backup.mjs private-backup.json private-manifest.json",
    );
  const bytes = fs.readFileSync(input),
    summary = validateBackup(JSON.parse(bytes));
  fs.writeFileSync(
    output,
    JSON.stringify(
      { ...summary, sha256: createHash("sha256").update(bytes).digest("hex") },
      null,
      2,
    ),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Backup validated; comparison manifest saved without pupil names. No database changed.",
  );
}
