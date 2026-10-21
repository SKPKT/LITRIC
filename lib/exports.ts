import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

const clean = (s: any) =>
  String(s ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e\n]/g, "");
const emerald = rgb(0.025, 0.185, 0.157),
  gold = rgb(0.78, 0.6, 0.23),
  gray = rgb(0.38, 0.43, 0.45);
export async function certificatePDF(
  c: any,
  student: any,
  school: string,
  origin: string,
) {
  const pdf = await PDFDocument.create(),
    page = pdf.addPage([841.89, 595.28]),
    regular = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold),
    serif = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  pdf.setTitle("LITRIC — Sijil Pengiktirafan Sekolah");
  pdf.setAuthor("LITRIC · SK Pendidikan Khas Taiping");
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 842,
    height: 595,
    color: rgb(0.99, 0.985, 0.96),
  });
  page.drawRectangle({
    x: 25,
    y: 25,
    width: 792,
    height: 545,
    borderColor: gold,
    borderWidth: 1.5,
  });
  page.drawRectangle({
    x: 34,
    y: 34,
    width: 774,
    height: 527,
    borderColor: emerald,
    borderWidth: 0.5,
  });
  const center = (
    s: string,
    y: number,
    size: number,
    font = regular,
    color = emerald,
  ) => {
    s = clean(s);
    page.drawText(s, {
      x: Math.max(50, (842 - font.widthOfTextAtSize(s, size)) / 2),
      y,
      size,
      font,
      color,
    });
  };
  center("L I T R I C", 502, 25, bold);
  center(
    "Literacy Intelligence for Tracking, Reporting, Insights & Competency",
    480,
    9,
  );
  center(school, 446, 14, bold);
  center("SIJIL PENGIKTIRAFAN SEKOLAH", 395, 27, bold);
  center("Dengan penghargaan kepada", 356, 12, serif);
  const size = Math.min(
    25,
    710 / Math.max(1, bold.widthOfTextAtSize(clean(student.name), 1)),
  );
  center(student.name, 316, size, bold);
  center(c.category, 270, 20, serif);
  center(
    `${c.total} bahan bacaan${c.level ? `  -  ${c.level} Bintang` : ""}`,
    238,
    14,
    bold,
  );
  const scope = clean(c.scope);
  center(scope.length > 115 ? scope.slice(0, 112) + "..." : scope, 210, 9);
  center(`Tarikh pencapaian: ${c.date}`, 179, 11);
  center("Every Read Counts. Every Progress Matters.", 137, 12, serif, gold);
  center(
    "Pengiktirafan sekolah. Bukan pensijilan rasmi AINS atau PAJSK.",
    83,
    9,
    regular,
    gray,
  );
  const qr = await QRCode.toDataURL(
      `${origin}/verify/${c.verification_token}`,
      { width: 180, margin: 1, errorCorrectionLevel: "M" },
    ),
    img = await pdf.embedPng(qr);
  page.drawImage(img, { x: 717, y: 51, width: 67, height: 67 });
  page.drawText(`ID: ${c.id}`, {
    x: 57,
    y: 58,
    size: 7,
    font: regular,
    color: gray,
  });
  if (c.revoked) center("DIBATALKAN", 365, 30, bold, rgb(0.7, 0.1, 0.1));
  return pdf.save();
}
export async function reportPDF(
  data: any,
  m: any,
  filters: any,
  programme?: any,
) {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: any,
    y = 0;
  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    y = 785;
    page.drawText("LITRIC / LAPORAN LITERASI", {
      x: 42,
      y,
      size: 17,
      font: bold,
      color: emerald,
    });
    y -= 15;
    page.drawText("Literacy Intelligence for Tracking, Reporting, Insights & Competency", {x:42, y, size:7.5, font, color:gray});
    y -= 15;
    page.drawText("Every Read Counts. Every Progress Matters.", {x:42, y, size:8, font, color:gray});
    y -= 18;
    page.drawText(
      clean(data.settings.schoolName || "SK Pendidikan Khas Taiping"),
      { x: 42, y, size: 10, font, color: gray },
    );
    y -= 28;
  };
  newPage();
  const line = (s: any, size = 10, isBold = false) => {
    const txt = clean(s);
    const face = isBold ? bold : font,
      chunks: string[] = [];
    let current = "";
    for (const word of txt.split(/\s+/)) {
      if (
        face.widthOfTextAtSize((current ? current + " " : "") + word, size) <=
        511
      ) {
        current += (current ? " " : "") + word;
        continue;
      }
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (const char of word) {
        if (face.widthOfTextAtSize(current + char, size) > 511) {
          chunks.push(current);
          current = "";
        }
        current += char;
      }
    }
    if (current || !chunks.length) chunks.push(current);
    if (isBold && y < 100) newPage();
    for (const chunk of chunks) {
      if (y < 60) newPage();
      page.drawText(chunk.trim(), {
        x: 42,
        y,
        size,
        font: isBold ? bold : font,
        color: emerald,
      });
      y -= size + 7;
    }
  };
  line(programme?.name || "Ringkasan pencapaian bacaan", 15, true);
  line(`Dijana: ${new Date().toISOString().slice(0, 10)}`);
  line(
    `Penapis: ${
      Object.entries(filters)
        .filter(([, v]) => v)
        .map(
          ([k, v]) =>
            `${({ dataset: "Set data", year: "Tahun", month: "Bulan", classId: "Kelas", student: "Murid", language: "Bahasa", category: "Kategori", source: "Sumber", verification: "Pengesahan" } as Record<string, string>)[k] || k}: ${k === "classId" ? data.classes.find((c: any) => c.id === v)?.name || "Tidak tersedia" : k === "student" ? data.students.find((s: any) => s.id === v)?.name || "Tidak tersedia" : v}`,
        )
        .join(", ") || "Tiada"
    }`,
  );
  line(
    `Murid: ${m.students.length}   Aktif dalam sumber: ${m.active ?? "Tidak tersedia"}`,
  );
  line(
    `Bacaan dilaporkan: ${m.reported ?? "Tidak tersedia"}   Ditolak: ${m.rejected ?? "Tidak tersedia"}`,
  );
  line(
    `Layak pengiraan: ${m.eligible ?? "Tidak tersedia"}   Purata sumber: ${m.average == null ? "Tidak tersedia" : m.average.toFixed(1)}`,
  );
  line(
    m.unverified
      ? "Tempoh belum disahkan. Jumlah sumber tidak membuktikan bacaan tahunan."
      : "Skop mengikut kelompok disahkan.",
  );
  line(
    `Baris perlu semakan: ${m.reviewCount}; identiti bertindih: ${m.blocked.length}`,
  );
  if (programme) {
    line("Maklumat program", 13, true);
    line(data.programmeScope || "");
    for (const k of [
      "date",
      "organizer",
      "target_participants",
      "actual_participants",
      "activities",
      "outcomes",
      "notes",
    ])
      line(
        `${({ date: "Tarikh", organizer: "Penganjur", target_participants: "Sasaran peserta", actual_participants: "Peserta sebenar", activities: "Aktiviti", outcomes: "Hasil bacaan", notes: "Catatan guru" } as Record<string, string>)[k]}: ${programme[k] ?? "-"}`,
      );
    line("Ringkasan: hasil dan bilangan peserta ialah rekod guru.");
    line("Cadangan: semak bukti program dan sasaran susulan bersama guru.");
  }
  line("Ringkasan murid", 13, true);
  for (const s of m.students)
    line(
      `${s.name} | ${s.reported} sumber | ${s.eligible ?? "-"} layak | ${s.achievement.level ?? "-"} bintang`,
    );
  line("Sumber dan skop pelaporan", 13, true);
  for (const b of m.batches)
    line(
      `${b.filename} | ${b.period_start || "?"} hingga ${b.period_end || "?"} | ${({ unknown: "Semantik belum disahkan", monthly: "Agregat bulanan", annual: "Agregat tempoh", snapshot: "Snapshot kumulatif", event: "Peristiwa individu" } as Record<string, string>)[b.granularity]} | ${b.verification === "verified" ? "Disahkan" : "Belum disahkan"}`,
    );
  // Vector chart of reported totals per supplied source, with missing periods omitted.
  if (m.monthly.length) {
    if (y < 230) newPage();
    line("Bacaan mengikut fail sumber", 12, true);
    const max = Math.max(1, ...m.monthly.map((x: any) => x.value));
    for (const v of m.monthly) {
      if (y < 65) newPage();
      page.drawText(clean(v.label), { x: 42, y, size: 9, font });
      if (v.value != null)
        page.drawRectangle({
          x: 115,
          y: y - 2,
          width: (300 * v.value) / max,
          height: 10,
          color: emerald,
        });
      page.drawText(v.value == null ? "Tidak tersedia" : String(v.value), {
        x: 450,
        y,
        size: 9,
        font,
      });
      y -= 22;
    }
  }
  if (programme && data.evidence?.length) {
    newPage();
    line("Bukti visual program", 15, true);
    for (const item of data.evidence) {
      if (y < 400) newPage();
      line(item.name, 10, true);
      if (item.bytes && ["image/jpeg", "image/png"].includes(item.mime)) {
        try {
          const image =
            item.mime === "image/png"
              ? await pdf.embedPng(item.bytes)
              : await pdf.embedJpg(item.bytes);
          const size = image.scaleToFit(480, 300);
          if (y - size.height < 60) newPage();
          page.drawImage(image, {
            x: 42,
            y: y - size.height,
            width: size.width,
            height: size.height,
          });
          y -= size.height + 20;
        } catch {
          line(
            "Imej tidak dapat dirender. Fail asal tersedia dalam rekod program.",
          );
        }
      } else
        line("Bukti sokongan tersedia melalui rekod program yang dilindungi.");
    }
  }
  for (const [i, p] of pdf.getPages().entries())
    p.drawText(`Pengiktirafan sekolah / ${i + 1}`, {
      x: 42,
      y: 30,
      size: 8,
      font,
      color: gray,
    });
  return pdf.save();
}
export async function reportXLSX(
  data: any,
  m: any,
  filters: any,
  programme?: any,
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "LITRIC";
  wb.created = new Date();
  const summary = [
    ["LITRIC - Laporan literasi"],
    ["Literacy Intelligence for Tracking, Reporting, Insights & Competency"],
    ["Every Read Counts. Every Progress Matters."],
    ["Sekolah", data.settings.schoolName],
    ["Penapis", JSON.stringify(filters)],
    ["Murid", m.students.length],
    ["Murid aktif dalam sumber", m.active],
    ["Bacaan dilaporkan", m.reported],
    ["Bacaan layak", m.eligible],
    ["Bacaan ditolak", m.rejected],
    [
      "Tempoh",
      m.unverified ? "Tempoh belum disahkan" : "Mengikut kelompok disahkan",
    ],
    ["Purata sumber", m.average],
    ["Perlu semakan", m.reviewCount],
  ];
  const add = (name: string, rows: any[]) => {
    const ws = wb.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    for (const row of rows) ws.addRow(row);
    ws.columns.forEach((c, i) => {
      c.width = i === 0 ? 46 : i === 1 ? 38 : 25;
    });
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF062F28" },
    };
    ws.getRow(1).height = 26;
    ws.eachRow((r, i) => {
      if (i > 1) {
        r.font = { name: "Calibri", size: 11 };
        r.eachCell((c) => {
          if (typeof c.value === "number")
            c.numFmt = Number.isInteger(c.value) ? "#,##0" : "#,##0.0";
        });
      }
    });
  };
  add("Ringkasan", summary);
  add("Murid", [
    ["ID", "Nama", "Kelas", "Dilaporkan", "Layak", "Bintang"],
    ...m.students.map((s: any) => [
      s.id,
      s.name,
      data.classes.find((c: any) => c.id === s.class_id)?.name ||
        "Belum dipetakan",
      s.reported,
      s.eligible,
      s.achievement.level,
    ]),
  ]);
  add("Sumber", [
    ["Fail", "Set data", "Mula", "Akhir", "Granulariti", "Pengesahan"],
    ...m.batches.map((b: any) => [
      b.filename,
      b.dataset,
      b.period_start,
      b.period_end,
      b.granularity,
      b.verification,
    ]),
  ]);
  if (programme)
    add("Program", [
      ["Medan", "Maklumat"],
      ...Object.entries(programme).map(([k, v]) => [k, String(v ?? "")]),
    ]);
  return wb.xlsx.writeBuffer();
}
