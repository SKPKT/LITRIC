import fs from "node:fs";
import path from "node:path";
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error(
    "Usage: node scripts/restore-backup.mjs backup.json reviewed-restore.sql",
  );
const dump = JSON.parse(fs.readFileSync(input, "utf8"));
if (dump.version !== 1 || !dump.school || !dump.tables)
  throw new Error("Unsupported backup.");
const snapshots = fs
  .readdirSync(new URL("../drizzle/meta/", import.meta.url))
  .filter((x) => x.endsWith("_snapshot.json"))
  .sort();
const schema = JSON.parse(
  fs.readFileSync(
    new URL("../drizzle/meta/" + snapshots.at(-1), import.meta.url),
    "utf8",
  ),
);
const order = [
  "schools",
  "classes",
  "students",
  "student_class_history",
  "users",
  "invitations",
  "student_aliases",
  "import_batches",
  "star_rule_versions",
  "ains_summaries",
  "ains_snapshots",
  "ains_activity_records",
  "ains_event_registry",
  "import_errors",
  "school_reading_entries",
  "reading_targets",
  "student_achievements",
  "smartlib_book_links",
  "reading_programmes",
  "programme_participants",
  "evidence_files",
  "certificates",
  "teacher_observations",
  "identity_merges",
  "settings",
  "audit_logs",
];
const quote = (v) =>
  v == null
    ? "NULL"
    : typeof v === "number" && Number.isFinite(v)
      ? String(v)
      : "'" + String(v).replaceAll("'", "''") + "'";
if (Object.keys(dump.tables).some((t) => !order.includes(t)))
  throw new Error(
    "Backup contains an unmapped table. Refusing an incomplete restore.",
  );
const sql = [
  "-- LITRIX reviewed restore into a NEW, migrated database only.",
  "-- Existing records are never overwritten. Copy R2 evidence/source objects separately.",
];
let count = 0;
for (const table of order) {
  const spec = schema.tables[table];
  if (!spec) throw new Error("Unknown table " + table);
  for (const row of dump.tables[table] || []) {
    if ((table === "schools" ? row.id : row.school_id) !== dump.school)
      throw new Error("Cross-school row rejected.");
    const keys = Object.keys(row);
    if (keys.some((k) => !spec.columns[k]))
      throw new Error("Unknown backup column.");
    sql.push(
      `INSERT INTO "${table}" (${keys.map((k) => '"' + k + '"').join(",")}) VALUES (${keys.map((k) => quote(row[k])).join(",")});`,
    );
    count++;
  }
}
fs.writeFileSync(path.resolve(output), sql.join("\n") + "\n", { flag: "wx" });
console.log(
  `Prepared ${count} inserts for ${dump.school}. Review the SQL, migrate a new database, then apply. No database was modified.`,
);
