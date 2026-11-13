import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import ExcelJS from "exceljs";
import { zipSync } from "fflate";
let source = fs.readFileSync("lib/ains-parser.ts", "utf8");
for (const name of ["fflate", "papaparse", "exceljs/dist/exceljs.min.js"])
  source = source.replaceAll(
    '"' + name + '"',
    JSON.stringify(import.meta.resolve(name)),
  );
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const { parse, expandSources, autoMap } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
test("actual XLSX and ZIP parsing: title rows, historical year, exact school code, wrong-school exclusion and explicit name fallback", async () => {
  const workbook = new ExcelJS.Workbook(),
    sheet = workbook.addWorksheet("Ujian");
  sheet.addRow(["Eksport sintetik tanpa data sebenar"]);
  sheet.addRow([]);
  sheet.addRow([
    "Kod Sekolah",
    "Nama Sekolah",
    "Nama Murid",
    "Student ID",
    "Diluluskan",
    "Ditolak",
    "Tahun",
  ]);
  sheet.addRow([
    "ABA6052",
    "SK Pendidikan Khas Taiping",
    "MURID UJIAN A",
    "synthetic-01",
    120,
    0,
    2023,
  ]);
  sheet.addRow([
    "OTHER",
    "SK Pendidikan Khas Taiping",
    "MURID LUAR",
    "synthetic-other",
    999,
    0,
    2023,
  ]);
  sheet.addRow([
    "",
    "SK Pendidikan Khas Taiping",
    "MURID UJIAN B",
    "synthetic-02",
    180,
    0,
    2024,
  ]);
  sheet.addRow([
    "",
    "SK Pendidikan Khas Taiping Lain",
    "MURID LUAR B",
    "synthetic-other-02",
    999,
    0,
    2024,
  ]);
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  const zip = new File(
    [
      zipSync({
        "historical.xlsx": bytes,
        "ignored.txt": new TextEncoder().encode("synthetic"),
      }),
    ],
    "historical.zip",
  );
  const expanded = await expandSources([zip]);
  assert.equal(expanded.length, 1);
  const result = await parse(expanded[0], {}, () => {});
  assert.equal(result.rows.length, 2);
  assert.deepEqual(
    result.rows.map((r) => r.year),
    [2023, 2024],
  );
  assert.equal(result.rows[0].email, "synthetic-01");
  assert.equal(result.rows[0].approved, 120);
  assert.equal(result.rows[1]._schoolNameMatch, true);
  assert.equal(result.nameMatched, true);
  assert.equal(autoMap(result.headers).year, "Tahun");
});
