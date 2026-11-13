export const aliases: any = {
  code: ["code", "school code", "kod sekolah"],
  school: ["school", "school name", "nama sekolah"],
  name: ["name", "student name", "nama", "nama murid"],
  email: ["email", "e-mel", "emel", "source id", "student id"],
  approved: ["approved", "diluluskan", "bacaan diluluskan", "jumlah bacaan"],
  rejected: ["rejected", "ditolak"],
  year: ["year", "tahun", "academic year", "tahun pelaporan", "tahun akademik"],
  period_start: ["period start", "tarikh mula"],
  period_end: ["period end", "tarikh akhir"],
  event_id: ["event id", "activity id", "reading id", "id aktiviti"],
  reading_date: ["reading date", "date", "tarikh bacaan"],
  title: ["title", "book title", "tajuk", "tajuk buku"],
  approval_status: ["approval status", "status kelulusan", "status"],
  language: ["language", "bahasa"],
  category: ["category", "kategori"],
};
const key = (s: any) =>
  String(s ?? "")
    .replace(/^\ufeff/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
export function autoMap(headers: string[]) {
  return Object.fromEntries(
    Object.entries(aliases).map(([k, a]: any) => [
      k,
      headers.find((h) => a.includes(key(h))) || "",
    ]),
  );
}
export async function sha(file: File) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function parse(
  file: File,
  mapping: any,
  onProgress: any,
  allRows = false,
) {
  const sample: any[] = [],
    selected: any[] = [];
  let headers: string[] = [],
    count = 0,
    nameMatched = false;
  const match = (raw: any, row: number) => {
    count++;
    if (sample.length < 8) sample.push(raw);
    const map = Object.keys(mapping).length ? mapping : autoMap(headers);
    const code = String(raw[map.code] || "")
        .trim()
        .toUpperCase(),
      school = key(raw[map.school] || "");
    const byName =
      !code &&
      [
        "sk pendidikan khas taiping",
        "sekolah kebangsaan pendidikan khas taiping",
      ].includes(school);
    if (code === "ABA6052" || byName || allRows) {
      const normalized: any = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [key(k), v]),
      );
      for (const [target, source] of Object.entries(map))
        if (source) normalized[target] = raw[source as string];
      normalized._row = row;
      normalized._originalSchool = code || String(raw[map.school] || "");
      if (byName) {
        normalized.code = "ABA6052";
        normalized._schoolNameMatch = true;
        nameMatched = true;
      }
      if (selected.length >= 5000)
        throw new Error(
          "Lebih 5,000 baris sekolah. Bahagikan fail kepada kelompok.",
        );
      selected.push(normalized);
    }
  };
  if (/\.csv$/i.test(file.name)) {
    const Papa = (await import("papaparse")).default;
    await new Promise<void>((resolve, reject) => {
      let stopped = false;
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        chunkSize: 1024 * 1024,
        chunk: (res: any, parser: any) => {
          try {
            headers = res.meta.fields || headers;
            for (const r of res.data) match(r, count + 2);
            onProgress(
              Math.min(
                96,
                Math.round(
                  ((res.meta.cursor || 0) / Math.max(file.size, 1)) * 100,
                ),
              ),
            );
          } catch (e) {
            stopped = true;
            parser.abort();
            reject(e);
          }
        },
        complete: () => {
          if (!stopped) resolve();
        },
        error: reject,
      });
    });
  } else if (/\.xlsx$/i.test(file.name)) {
    if (file.size > 15 * 1024 * 1024)
      throw new Error("Had Excel 15 MB. Gunakan CSV untuk fail lebih besar.");
    const bytes = await file.arrayBuffer();
    const { unzipSync } = await import("fflate");
    let unpacked = 0;
    unzipSync(new Uint8Array(bytes), {
      filter: (entry) => {
        unpacked += entry.originalSize;
        if (unpacked > 120 * 1024 * 1024)
          throw new Error("Kandungan Excel terlalu besar selepas diekstrak.");
        return false;
      },
    });
    const ExcelJS = (await import("exceljs/dist/exceljs.min.js")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes);
    const cell = (v: any): any =>
      v == null
        ? ""
        : v instanceof Date
          ? v.toISOString().slice(0, 10)
          : typeof v === "object"
            ? (v.result ??
              v.text ??
              v.richText?.map((x: any) => x.text).join("") ??
              "")
            : v;
    for (const sheet of wb.worksheets) {
      let headerRow = 1;
      for (let i = 1; i <= Math.min(40, sheet.rowCount); i++) {
        const candidate = (sheet.getRow(i).values as any[])
          .slice(1)
          .map((x: any) => String(cell(x)));
        const found = autoMap(candidate);
        if (
          found.name &&
          (found.code || found.school) &&
          (found.approved || found.event_id)
        ) {
          headerRow = i;
          break;
        }
      }
      const h = sheet.getRow(headerRow).values as any[];
      headers = h.slice(1).map((x: any) => String(cell(x)));
      sheet.eachRow((row: any, i: number) => {
        if (i <= headerRow) return;
        const values = row.values as any[];
        match(
          Object.fromEntries(headers.map((h, j) => [h, cell(values[j + 1])])),
          i,
        );
      });
    }
    onProgress(98);
  } else throw new Error("Format disokong: CSV, XLSX atau ZIP.");
  return { headers, sample, rows: selected, totalRows: count, nameMatched };
}

export async function expandSources(list: File[]) {
  const expanded: File[] = [];
  for (const f of list) {
    if (f.size > 70 * 1024 * 1024) throw new Error("Had fail ialah 70 MB.");
    if (/\.zip$/i.test(f.name)) {
      const { unzipSync } = await import("fflate");
      let size = 0;
      const zip = unzipSync(new Uint8Array(await f.arrayBuffer()), {
        filter: (entry) => {
          if (!/\.(csv|xlsx)$/i.test(entry.name)) return false;
          size += entry.originalSize;
          if (size > 250 * 1024 * 1024 || entry.originalSize > 70 * 1024 * 1024)
            throw new Error("ZIP melebihi had saiz selepas diekstrak.");
          return true;
        },
      });
      for (const [name, bytes] of Object.entries(zip)) {
        if (expanded.length >= 15)
          throw new Error("Had 15 fail bagi satu muat naik.");
        expanded.push(
          new File([bytes as any], name.split("/").pop()!, {
            type: /csv$/i.test(name)
              ? "text/csv"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        );
      }
    } else expanded.push(f);
  }

  return expanded;
}
