"use client";
import React, { useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Download,
  ShieldCheck,
  Info,
  CloudUpload,
  X,
} from "lucide-react";
import { Panel, Field, Pill, Empty, fmt, api } from "../litric";

const aliases: any = {
  code: ["code", "school code", "kod sekolah"],
  school: ["school", "school name", "nama sekolah"],
  name: ["name", "student name", "nama", "nama murid"],
  email: ["email", "e-mel", "emel", "source id", "student id"],
  approved: ["approved", "diluluskan", "bacaan diluluskan", "jumlah bacaan"],
  rejected: ["rejected", "ditolak"],
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
function autoMap(headers: string[]) {
  return Object.fromEntries(
    Object.entries(aliases).map(([k, a]: any) => [
      k,
      headers.find((h) => a.includes(key(h))) || "",
    ]),
  );
}
async function sha(file: File) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
async function parse(
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
      !code && school.includes("pendidikan khas") && school.includes("taiping");
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
      const h = sheet.getRow(1).values as any[];
      headers = h.slice(1).map((x: any) => String(cell(x)));
      sheet.eachRow((row: any, i: number) => {
        if (i === 1) return;
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
export default function ImportCentre({ data, mutate, busy, notify }: any) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]),
    [mapping, setMapping] = useState<any>({}),
    [headers, setHeaders] = useState<string[]>([]),
    [sample, setSample] = useState<any[]>([]),
    [stage, setStage] = useState(0),
    [dataset, setDataset] = useState(""),
    [granularity, setGranularity] = useState("summary"),
    [progress, setProgress] = useState(0),
    [working, setWorking] = useState(false),
    [previews, setPreviews] = useState<any[]>([]),
    [nameConfirm, setNameConfirm] = useState(false),
    [drag, setDrag] = useState(false),
    [error, setError] = useState(""),
    [results, setResults] = useState<any[]>([]);
  const isAdmin = data.user.role === "admin";
  if (!isAdmin)
    return (
      <Empty title="Akses pentadbir diperlukan">
        Import dikawal oleh pentadbir sekolah.
      </Empty>
    );
  async function choose(list: File[]) {
    setWorking(true);
    setError("");
    setPreviews([]);
    setResults([]);
    try {
      let expanded: File[] = [];
      for (const f of list) {
        if (f.size > 70 * 1024 * 1024) throw new Error("Had fail ialah 70 MB.");
        if (/\.zip$/i.test(f.name)) {
          const { unzipSync } = await import("fflate");
          let size = 0;
          const zip = unzipSync(new Uint8Array(await f.arrayBuffer()), {
            filter: (entry) => {
              if (!/\.(csv|xlsx)$/i.test(entry.name)) return false;
              size += entry.originalSize;
              if (
                size > 250 * 1024 * 1024 ||
                entry.originalSize > 70 * 1024 * 1024
              )
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
      if (!expanded.length || expanded.length > 15)
        throw new Error("Pilih 1 hingga 15 fail CSV atau XLSX.");
      setFiles(expanded);
      const r = await parse(expanded[0], {}, setProgress);
      setHeaders(r.headers);
      const detected = autoMap(r.headers);
      setMapping(detected);
      setGranularity(
        detected.event_id && detected.reading_date ? "event" : "summary",
      );
      setSample(r.sample);
      setDataset(
        expanded.length > 1
          ? "NILAM import baharu"
          : expanded[0].name.replace(/\.(csv|xlsx)$/i, ""),
      );
      setStage(1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWorking(false);
      setProgress(0);
    }
  }
  async function preview() {
    setWorking(true);
    setError("");
    try {
      if (
        !mapping.name ||
        (granularity !== "event" && !mapping.approved) ||
        (granularity === "event" &&
          (!mapping.event_id ||
            !mapping.reading_date ||
            !mapping.title ||
            !mapping.approval_status ||
            !mapping.email)) ||
        (!mapping.code && !mapping.school)
      )
        throw new Error(
          "Peta nama murid, bacaan diluluskan dan kod/nama sekolah.",
        );
      const arr = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i],
          parsed = await parse(file, mapping, (p: number) =>
            setProgress(Math.round(((i + p / 100) / files.length) * 100)),
          );
        if (!parsed.rows.length)
          throw new Error(
            `Tiada rekod ABA6052 dalam ${file.name}. Semak pemetaan.`,
          );
        const r = await api("import/preview", {
          rows: parsed.rows,
          granularity,
        });
        arr.push({
          ...parsed,
          stats: r.stats,
          errors: r.errors,
          previewRows: r.rows,
          filename: file.name,
          fileHash: await sha(file),
          sourceType: /csv$/i.test(file.name) ? "CSV" : "XLSX",
        });
      }
      setPreviews(arr);
      setStage(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWorking(false);
      setProgress(0);
    }
  }
  async function commit() {
    setWorking(true);
    setError("");
    const saved = [];
    try {
      if (previews.some((p) => p.nameMatched) && !nameConfirm)
        throw new Error("Sahkan padanan sekolah melalui nama sebelum import.");
      for (let i = 0; i < previews.length; i++) {
        const p = previews[i];
        saved.push(
          await mutate("import/commit", {
            rows: p.rows.map((r: any) => r.raw || r),
            dataset,
            filename: p.filename,
            sourceType: p.sourceType,
            fileHash: p.fileHash,
            monthHint: null,
            granularity,
          }),
        );
        setProgress(Math.round(((i + 1) / previews.length) * 100));
      }
      setResults(saved);
      setStage(3);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }
  const stats = previews.reduce((s: any, p: any) => {
    for (const k of [
      "accepted",
      "review",
      "rejected",
      "duplicate",
      "excluded",
      "reported",
    ])
      s[k] = (s[k] || 0) + p.stats[k];
    return s;
  }, {});
  return (
    <>
      <div className="stepper">
        {["Muat naik", "Peta lajur", "Semak data", "Selesai"].map((s, i) => (
          <div
            className={stage === i ? "current" : stage > i ? "done" : ""}
            key={s}
          >
            <span>{stage > i ? <CheckCircle2 size={17} /> : i + 1}</span>
            <b>{s}</b>
            {i < 3 && <i />}
          </div>
        ))}
      </div>
      {error && (
        <div className="notice danger">
          <Info size={19} />
          {error}
        </div>
      )}
      {working && (
        <div className="upload-progress">
          <span>
            <RefreshCw className="spin" size={16} /> Memproses fail… {progress}%
          </span>
          <progress max={100} value={progress} />
        </div>
      )}
      {stage === 0 && (
        <>
          <Panel
            title="Pusat Import AINS"
            sub="CSV, Excel XLSX atau ZIP · pelbagai fail disokong"
          >
            <div
              className={"dropzone " + (drag ? "drag" : "")}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                choose(Array.from(e.dataTransfer.files));
              }}
            >
              <div className="upload-symbol">
                <CloudUpload size={38} />
              </div>
              <h3>Letakkan fail bacaan di sini</h3>
              <p>atau pilih fail daripada peranti anda</p>
              <button
                className="btn primary"
                disabled={working}
                onClick={() => input.current?.click()}
              >
                <Upload size={16} /> Pilih fail
              </button>
              <small>
                Sehingga 15 fail · CSV 70 MB · Excel 15 MB · ZIP 70 MB
              </small>
              <input
                ref={input}
                type="file"
                multiple
                accept=".csv,.xlsx,.zip"
                hidden
                onChange={(e) => choose(Array.from(e.target.files || []))}
              />
            </div>
            <div className="import-assurances">
              <span>
                <ShieldCheck size={18} /> Hanya kod sekolah ABA6052
              </span>
              <span>
                <CheckCircle2 size={18} /> Pratonton sebelum disimpan
              </span>
              <span>
                <RefreshCw size={18} /> Import boleh dibatalkan
              </span>
            </div>
          </Panel>
          <Panel
            title="Fail yang dibekalkan"
            sub={`${data.providedSourceCount || 0} sumber tersedia di pelayan · tiada rekod sekolah lain`}
          >
            <div className="provided-files">
              <FileSpreadsheet size={33} />
              <div>
                <b>{data.providedSourceCount ? "AINS_LMS.xlsx & CSV Januari–Julai" : "Tiada sumber peribadi dibundel"}</b>
                <p>
                  Identiti sumber dan jumlah akan dikira daripada kandungan
                  fail.
                </p>
              </div>
              <button
                className="btn"
                disabled={busy || !data.providedSourceCount}
                onClick={() => mutate("seed", {}).catch(() => {})}
              >
                Import fail dibekalkan <ArrowRight size={15} />
              </button>
            </div>
          </Panel>
        </>
      )}
      {stage === 1 && (
        <Panel
          title="Pemetaan lajur"
          sub={`${files.length} fail · ${headers.length} lajur dalam fail pertama`}
        >
          <div className="form-grid">
            <Field
              label="Nama set data"
              hint="Fail dalam set ini dipaparkan bersama; tahun dan skop disahkan kemudian."
            >
              <input
                required
                value={dataset}
                onChange={(e) => setDataset(e.target.value)}
              />
            </Field>
            <Field label="Jenis kandungan sumber">
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value)}
              >
                <option value="summary">
                  Ringkasan murid / snapshot (semantik belum disahkan)
                </option>
                <option value="event">
                  Peristiwa bacaan individu dengan ID, tarikh dan status
                </option>
              </select>
            </Field>
            {Object.keys(aliases)
              .filter((k) =>
                granularity === "event"
                  ? !["approved", "rejected"].includes(k)
                  : ![
                      "event_id",
                      "reading_date",
                      "title",
                      "approval_status",
                      "language",
                      "category",
                    ].includes(k),
              )
              .map((k) => (
                <Field
                  label={
                    {
                      code: "Kod sekolah",
                      school: "Nama sekolah",
                      name: "Nama murid",
                      email: "Pengecam sumber / E-mel",
                      approved: "Bacaan diluluskan",
                      rejected: "Bacaan ditolak",
                      event_id: "ID peristiwa sumber",
                      reading_date: "Tarikh aktiviti (YYYY-MM-DD)",
                      title: "Tajuk bahan",
                      approval_status:
                        "Status kelulusan (approved/rejected/pending)",
                      language: "Bahasa (bm/eng/others)",
                      category: "Kategori (fiction/nonfiction/digital/nonbook)",
                    }[k]
                  }
                  key={k}
                >
                  <select
                    value={mapping[k] || ""}
                    onChange={(e) =>
                      setMapping({ ...mapping, [k]: e.target.value })
                    }
                  >
                    <option value="">Tidak dipetakan</option>
                    {headers.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </select>
                </Field>
              ))}
          </div>
          <div className="notice">
            <Info size={18} />
            <p>
              Lajur bahasa dan kategori dengan tajuk AINS standard dikenal pasti
              secara automatik. Jika lajur tiada, nilai kekal tidak tersedia.
            </p>
          </div>
          <div className="table-scroll mapping-preview">
            <table>
              <thead>
                <tr>
                  {headers.slice(0, 10).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sample.slice(0, 4).map((r, i) => (
                  <tr key={i}>
                    {headers.slice(0, 10).map((h) => (
                      <td key={h}>{String(r[h] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={() => setStage(0)}>
              <ArrowLeft size={16} /> Kembali
            </button>
            <button
              className="btn primary"
              disabled={working || !dataset.trim()}
              onClick={preview}
            >
              Pratonton dan semak <ArrowRight size={16} />
            </button>
          </div>
        </Panel>
      )}
      {stage === 2 && (
        <>
          {granularity === "event" && (
            <div className="notice">
              <Info size={18} />
              <p>
                Peristiwa individu:{" "}
                {previews.reduce(
                  (n, p) => n + (p.stats.acceptedEvents || 0),
                  0,
                )}{" "}
                peristiwa baharu sah. Jumlah kad di bawah ialah ringkasan murid.
                ID berulang tidak menambah bacaan; hanya status approved dikira
                diluluskan.
              </p>
            </div>
          )}
          <div className="kpis">
            {[
              ["accepted", "Diterima"],
              ["review", "Perlu semakan"],
              ["rejected", "Ditolak"],
              ["duplicate", "Pendua"],
            ].map(([k, l]) => (
              <div className="kpi" key={k}>
                <span>{l}</span>
                <strong>{fmt(stats[k])}</strong>
                <small>Hanya rekod sekolah ABA6052</small>
              </div>
            ))}
          </div>
          <div className="notice">
            <Info size={18} />
            <p>
              <b>Tempoh belum disahkan.</b> {stats.reported} bahan dilaporkan
              dalam sumber. Jumlah ini belum layak untuk pengiraan bintang.
            </p>
          </div>
          <Panel
            title="Pratonton rekod sekolah"
            sub="Sehingga 50 baris setiap fail dipaparkan"
          >
            {previews.map((p) => (
              <div className="preview-file" key={p.filename}>
                <h3>
                  <FileSpreadsheet size={18} />
                  {p.filename}
                  <Pill tone="neutral">{p.rows.length} baris</Pill>
                </h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Baris</th>
                        <th>Nama murid</th>
                        <th>Diluluskan</th>
                        <th>Status</th>
                        <th>Isu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.previewRows.slice(0, 50).map((r: any, i: number) => (
                        <tr key={i}>
                          <td>{r.rowNumber || r._row}</td>
                          <td>{r.name || r.raw?.name}</td>
                          <td>{r.approved}</td>
                          <td>
                            <Pill
                              tone={
                                r.status === "review"
                                  ? "amber"
                                  : r.status === "rejected"
                                    ? "red"
                                    : "green"
                              }
                            >
                              {r.status || "Menunggu import"}
                            </Pill>
                          </td>
                          <td>{r.issue || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {previews.some((p) => p.nameMatched) && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={nameConfirm}
                  onChange={(e) => setNameConfirm(e.target.checked)}
                />
                Saya sahkan padanan nama sekolah ini ialah SK Pendidikan Khas
                Taiping (ABA6052). Nama asal dikekalkan.
              </label>
            )}
            <div className="form-actions">
              <button className="btn" onClick={() => setStage(1)}>
                <ArrowLeft size={15} /> Ubah pemetaan
              </button>
              <button
                className="btn primary"
                disabled={working}
                onClick={commit}
              >
                Simpan {previews.length} kelompok <ArrowRight size={16} />
              </button>
            </div>
          </Panel>
        </>
      )}
      {stage === 3 && (
        <Panel title="Import selesai">
          <Empty
            icon={CheckCircle2}
            title={`${results.filter((r) => !r.duplicate).length} kelompok baharu disimpan`}
            action={
              <button
                className="btn primary"
                onClick={() => {
                  setStage(0);
                  setFiles([]);
                  setProgress(0);
                }}
              >
                Import fail lain
              </button>
            }
          >
            Fail berulang tidak ditambah semula. Semak skop pelaporan dan isu
            identiti di Audit & Sejarah Import.
          </Empty>
          {results.map((r, i) => (
            <div key={i} className="result-row">
              <span>{previews[i]?.filename}</span>
              <Pill tone={r.duplicate ? "amber" : "green"}>
                {r.duplicate ? "Telah diimport" : "Disimpan"}
              </Pill>
            </div>
          ))}
        </Panel>
      )}
      <Panel
        title="Import terkini"
        sub="Sumber, pengesahan dan keputusan import"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fail sumber</th>
                <th>Set data</th>
                <th>Pelaporan</th>
                <th>Status</th>
                <th>Ralat</th>
              </tr>
            </thead>
            <tbody>
              {data.import_batches.map((b: any) => (
                <tr key={b.id}>
                  <td>
                    <FileSpreadsheet size={16} />
                    {b.filename}
                  </td>
                  <td>{b.dataset}</td>
                  <td>
                    {b.period_start
                      ? `${b.period_start} – ${b.period_end}`
                      : "Tempoh belum disahkan"}
                  </td>
                  <td>
                    <Pill tone={b.status === "active" ? "green" : "neutral"}>
                      {b.status === "active" ? "Aktif" : "Dibatalkan"}
                    </Pill>
                  </td>
                  <td>
                    <a
                      className="icon-btn"
                      title="Muat turun laporan ralat"
                      href={"/api/errors?batch=" + b.id}
                    >
                      <Download size={17} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
