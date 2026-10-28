"use client";
import React, { useState, useRef } from "react";
import {apiFetch} from "../../lib/client-api";
import {ProtectedImage} from "../../components/protected-image";
import {
  Users,
  Plus,
  ArrowRight,
  ArrowLeft,
  Download,
  Upload,
  FileSpreadsheet,
  BookOpen,
  Target,
  Star,
  Settings,
  ShieldCheck,
  History,
  CheckCircle2,
  Info,
  Search,
  ScanLine,
  Camera,
  X,
  Lock,
  Award,
  CalendarDays,
  ArrowUpRight,
  Merge,
  Undo2,
  Save,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import {
  Panel,
  Field,
  Pill,
  Empty,
  Modal,
  Badge,
  SourceBars,
  fmt,
  pretty,
  initials,
  query,
  api,
} from "../litric";
import { aggregate, MONTHS, coversRange } from "../../lib/domain.mjs";
import { StudentReportControls, useStudentReport } from './student-report-controls';
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
const monthStart = () => today().slice(0, 7) + "-01";
const nameOf = (data: any, id: string) =>
  pretty(
    data.students.find((s: any) => s.id === id)?.name || "Profil dipautkan",
  );
const classOf = (data: any, id: string) =>
  data.classes.find((c: any) => c.id === id)?.name || "Belum dipetakan";
export default function WorkspaceViews(ctx: any) {
  const { route } = ctx;
  if (route.startsWith("profil/"))
    return <Profile {...ctx} id={route.split("/")[1]} />;
  const pages: Record<string, any> = {
    murid: Students,
    sasaran: Targets,
    bacaan: Readings,
    smartlib: Smartlib,
    program: Programmes,
    sijil: Certificates,
    laporan: Reports,
    tetapan: SystemSettings,
    audit: Audit,
  };
  const Page = pages[route];
  return Page ? (
    <Page {...ctx} />
  ) : (
    <Empty title="Halaman tidak ditemui">
      Pilih halaman daripada navigasi.
    </Empty>
  );
}
function Form({
  title,
  fields,
  initial = {},
  onClose,
  onSubmit,
  submit = "Simpan",
  children,
}: any) {
  const [v, setV] = useState<any>(initial),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose} wide={fields.length > 7}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSubmit(v);
            onClose();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          {fields
            .filter((f: any) => !f.show || f.show(v))
            .map((f: any) => (
              <Field label={f.label} hint={f.hint} key={f.key}>
                {f.type === "select" ? (
                  <select
                    required={f.required}
                    value={v[f.key] ?? ""}
                    onChange={(e) => setV({ ...v, [f.key]: e.target.value })}
                  >
                    <option value="">Pilih…</option>
                    {f.options.map((o: any) => (
                      <option value={o.value ?? o} key={o.value ?? o}>
                        {o.label ?? o}
                      </option>
                    ))}
                  </select>
                ) : f.type === "checkbox" ? (
                  <span className="checkbox">
                    <input
                      type="checkbox"
                      checked={!!v[f.key]}
                      onChange={(e) =>
                        setV({ ...v, [f.key]: e.target.checked })
                      }
                    />
                    {f.text || "Ya, disahkan"}
                  </span>
                ) : f.type === "textarea" ? (
                  <textarea
                    required={f.required}
                    maxLength={f.max || 2000}
                    value={v[f.key] ?? ""}
                    onChange={(e) => setV({ ...v, [f.key]: e.target.value })}
                  />
                ) : f.type === "multi" ? (
                  <div className="multiselect">
                    {f.options.map((o: any) => (
                      <label key={o.value}>
                        <input
                          type="checkbox"
                          checked={(v[f.key] || []).includes(o.value)}
                          onChange={(e) =>
                            setV({
                              ...v,
                              [f.key]: e.target.checked
                                ? [...(v[f.key] || []), o.value]
                                : (v[f.key] || []).filter(
                                    (x: any) => x !== o.value,
                                  ),
                            })
                          }
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    required={f.required}
                    type={f.type || "text"}
                    min={f.min ?? (f.type === "number" ? 0 : undefined)}
                    max={f.max}
                    maxLength={f.type !== "number" ? 1000 : undefined}
                    value={v[f.key] ?? ""}
                    placeholder={f.placeholder || ""}
                    onChange={(e) => setV({ ...v, [f.key]: e.target.value })}
                  />
                )}
              </Field>
            ))}
        </div>
        {children}
        {error && <div className="notice danger">{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Batal
          </button>
          <button className="btn primary" disabled={busy}>
            <Save size={16} />
            {busy ? "Menyimpan…" : submit}
          </button>
        </div>
      </form>
    </Modal>
  );
}
const studentOptions = (data: any) =>
  data.students.map((s: any) => ({ value: s.id, label: pretty(s.name) }));
const classOptions = (data: any) =>
  data.classes.map((s: any) => ({
    value: s.id,
    label: s.name + " · " + s.year,
  }));
function Students(ctx: any) {
  const { data, mutate, go } = ctx,
    [form, setForm] = useState<any>(null),
    [page, setPage] = useState(0),
    [merge, setMerge] = useState(false),
    [classForm,setClassForm]=useState(false);
  const admin = data.user.role === "admin";
  const {filters,setFilters,report}=useStudentReport(data);
  const list = report.records;
  const editStudent=(s:any)=>{const alias=data.aliases?.find((a:any)=>a.student_id===s.id&&a.verified&&!a.source_id.startsWith('missing:'));setForm({...s,source_id:alias?.source_id||'',source_verified:!!alias});};
  const fields = [
    { key: "name", label: "Nama penuh", required: true },
    {
      key: "class_id",
      label: "Kelas",
      type: "select",
      options: classOptions(data),
    },
    {
      key: "academic_year",
      label: "Tahun akademik",
      type: "number",
      min: 2000,
      max: 2100,
    },
    {
      key: "status",
      label: "Status enrolmen",
      type: "select",
      options: [
        { value: "unconfirmed", label: "Belum disahkan" },
        { value: "current", label: "Aktif" },
        { value: "graduated", label: "Tamat Sekolah" },
        { value: "former", label: "Tamat Sekolah (rekod lama)" },
        { value: "transferred", label: "Berpindah" },
      ],
    },
    { key: "member_id", label: "ID ahli SMARTLIB" },
    { key: 'source_id', label: 'ID murid sumber AINS', hint: 'Pilihan. Gunakan pengecam sebenar yang telah disemak; nama sahaja tidak digunakan untuk padanan automatik.' },
    { key: 'source_verified',label:'Pengesahan pengecam AINS',type:'checkbox',text:'Saya telah mengesahkan ID sumber ini berdasarkan rekod sekolah.',show:(v:any)=>!!v.source_id },
    { key: 'duplicate_confirmed',label:'Individu berlainan dengan nama sama',type:'checkbox',text:'Saya mengesahkan ini individu berbeza, bukan profil pendua.' },
    { key: 'duplicate_reason',label:'Bukti individu berbeza',type:'textarea',required:true,show:(v:any)=>!!v.duplicate_confirmed },
  ];
  return (
    <>
      <Panel
        title="Direktori murid"
        sub={`${data.students.length} profil kekal · sumber dipautkan melalui pengecam`}
        action={
          admin && (
            <div className="button-row">
              <button className="btn" onClick={()=>setClassForm(true)}>Tambah kelas</button>
              <button className="btn" onClick={() => setMerge(true)}>
                <Merge size={15} /> Semak identiti
              </button>
              <button
                className="btn primary"
                onClick={() => setForm({ status: "current", academic_year:new Date().getFullYear() })}
              >
                <Plus size={18} /> Tambah Murid
              </button>
            </div>
          )
        }
      >
        <StudentReportControls data={data} filters={filters} setFilters={(v:any)=>{setFilters(v);setPage(0);}} notify={ctx.notify}/>
        <p className="pad">{list.length} murid · Murid berpindah atau tamat sekolah diarkibkan dengan sejarah kekal.</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nama murid</th>
                <th>Kelas</th>
                <th>Tahun</th>
                <th>Enrolmen</th>
                <th>Jumlah bacaan terkumpul</th>
                <th>Pencapaian Bintang</th>
                <th>Profil</th>
              </tr>
            </thead>
            <tbody>
              {list
                .slice(page * 12, page * 12 + 12)
                .map((s: any, i: number) => (
                  <tr key={s.id}>
                    <td>
                      <div className="name-cell">
                        <span className={"avatar color-" + (i % 5)}>
                          {initials(s.name)}
                        </span>
                        <span>
                          <b>{pretty(s.name)}</b>
                          <small>
                            ID {s.id.slice(0, 8)}{" "}
                            {s.member_id && "· " + s.member_id}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>{classOf(data, s.class_id)}</td>
                    <td>{s.academic_year || "Belum disahkan"}</td>
                    <td>
                      <Pill tone={s.status === "current" ? "green" : "neutral"}>
                        {s.statusLabel}
                      </Pill>
                    </td>
                    <td>{s.total==null?(s.hasAins?'Belum disahkan':'Tiada rekod AINS'):fmt(s.total)}</td>
                    <td>{s.achievement.level==null?'Belum dapat disahkan':`${s.achievement.level} Bintang`}</td>
                    <td>
                      <div className="button-row">
                        <button
                          className="text-btn"
                          onClick={() => go("profil/" + s.id)}
                        >
                          Lihat <ArrowUpRight size={15} />
                        </button>
                        {admin && (
                          <button
                            className="text-btn"
                            onClick={() => editStudent(s)}
                          >
                            Edit
                          </button>
                        )}
                        {admin&&<button className="text-btn" onClick={()=>mutate("student/archive",{id:s.id,archived:!s.archived_at})}>{s.archived_at?"Pulih arkib":"Arkibkan"}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>
            {list.length
              ? `${page * 12 + 1}–${Math.min(page * 12 + 12, list.length)}`
              : "0"}{" "}
            daripada {list.length}
          </span>
          <button
            className="btn"
            disabled={!page}
            onClick={() => setPage(page - 1)}
          >
            Sebelum
          </button>
          <button
            className="btn"
            disabled={(page + 1) * 12 >= list.length}
            onClick={() => setPage(page + 1)}
          >
            Seterusnya
          </button>
        </div>
      </Panel>
      {form && (
        <Form
          title={form.id ? "Kemaskini profil murid" : "Tambah profil murid"}
          fields={fields}
          initial={form}
          onClose={() => setForm(null)}
          onSubmit={async(v: any) => {await mutate("student", v);if(!form.id){setFilters({status:'all',academicYear:'',classId:'',star:'all',search:v.name});setPage(0);}}}
        />
      )}{" "}
      {classForm&&<Form title="Tambah kelas" fields={[{key:"name",label:"Nama kelas",required:true},{key:"year",label:"Tahun akademik",type:"number",min:2000,max:2100,required:true}]} initial={{year:new Date().getFullYear()}} onClose={()=>setClassForm(false)} onSubmit={(v:any)=>mutate("class",v)}/>}
      {merge && <IdentityReview {...ctx} onClose={() => setMerge(false)} />}
    </>
  );
}
function IdentityReview({ data, mutate, onClose }: any) {
  const [v, setV] = useState({ from: "", into: "", reason: "" }),
    [error, setError] = useState("");
  return (
    <Modal title="Semakan padanan identiti" onClose={onClose} wide>
      <div className="notice">
        <ShieldCheck size={18} />
        <p>
          Nama serupa tidak digabung automatik. Semak pengecam sumber, rekod
          tahun dan bukti sekolah sebelum menggabungkan.
        </p>
      </div>
      <div className="form-grid">
        {["from", "into"].map((k) => (
          <Field
            key={k}
            label={
              k === "from" ? "Profil sumber" : "Profil utama yang dikekalkan"
            }
          >
            <select
              value={(v as any)[k]}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
            >
              <option value="">Pilih murid</option>
              {data.students.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {pretty(s.name)} · {s.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>
      {[v.from, v.into].filter(Boolean).map((id) => (
        <div className="identity-detail" key={id}>
          <b>{nameOf(data, id)}</b>
          {data.aliases
            ?.filter((a: any) => a.student_id === id)
            .map((a: any) => (
              <p key={a.id}>
                {a.source_id} · {a.original_name}
              </p>
            ))}
        </div>
      ))}
      <Field label="Bukti dan sebab padanan">
        <textarea
          value={v.reason}
          onChange={(e) => setV({ ...v, reason: e.target.value })}
        />
      </Field>
      {error && <p className="red-text">{error}</p>}
      <div className="form-actions">
        <button
          className="btn primary"
          disabled={!v.from || !v.into || v.from === v.into || !v.reason.trim()}
          onClick={async () => {
            try {
              await mutate("identity/merge", v);
              onClose();
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          <Merge size={16} /> Sahkan gabungan identiti
        </button>
      </div>
      <h3>Sejarah gabungan</h3>
      {data.merges?.map((m: any) => (
        <div className="result-row" key={m.id}>
          <span>
            {m.from_id.slice(0, 8)} → {m.into_id.slice(0, 8)}
            <small>{m.reason}</small>
          </span>
          {m.undone ? (
            <Pill tone="neutral">Dibatalkan</Pill>
          ) : (
            <button
              className="btn"
              onClick={() =>
                mutate("identity/undo", { id: m.id }).catch(() => {})
              }
            >
              <Undo2 size={15} /> Batal gabungan
            </button>
          )}
        </div>
      ))}
      {!data.merges?.length && (
        <p className="muted">Tiada gabungan identiti.</p>
      )}
    </Modal>
  );
}
function Profile(ctx: any) {
  const { data, id, go, mutate } = ctx,
    [note, setNote] = useState(false),
    [year, setYear] = useState("");
  const s = data.students.find((s: any) => s.id === id);
  if (!s)
    return (
      <Empty title="Profil tidak ditemui">
        Profil ini tidak tersedia kepada akaun anda.
      </Empty>
    );
  const m = aggregate({
      students: [s],
      rows: data.ains_summaries,
      batches: data.import_batches,
      rule: data.rule,
      filters: { dataset: ctx.filters.dataset, year },
    }),
    p = m.students[0],
    lifetime=aggregate({students:[s],rows:data.ains_summaries,batches:data.import_batches,rule:data.rule,filters:{}}),
    lifetimeStudent=lifetime.students[0],
    a = lifetimeStudent?.achievement || { level: null, progress: 0 },
    entries = data.school_reading_entries.filter(
      (r: any) => r.canonical_id === id,
    ),
    years = [
      ...new Set(
        data.import_batches.filter((b: any) => b.year).map((b: any) => b.year),
      ),
    ];
  return (
    <>
      <button
        className="text-btn back"
        onClick={() => go(data.user.role === "student" ? "dashboard" : "murid")}
      >
        <ArrowLeft size={16} /> Kembali
      </button>
      <div className="profile-header">
        <span className="avatar profile-avatar">{initials(s.name)}</span>
        <div>
          <span className="eyebrow">PROFIL PERKEMBANGAN</span>
          <h2>{pretty(s.name)}</h2>
          <p>
            {classOf(data, s.class_id)} ·{" "}
            {s.academic_year || "Tahun belum disahkan"} · ID {s.id.slice(0, 8)}
          </p>
        </div>
        <select
          aria-label="Tahun pencapaian murid"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="">Pilih skop tahun</option>
          {years.map((y: any) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>
      <div className="kpis">
        <div className="kpi">
          <span>Bacaan dalam sumber</span>
          <strong>{fmt(p?.reported)}</strong>
          <small>{ctx.filters.dataset}</small>
        </div>
        <div className="kpi">
          <span>Bacaan terkumpul disahkan</span>
          <strong>{fmt(lifetimeStudent?.eligible)}</strong>
          <small>
            {lifetimeStudent?.eligible == null ? "Tempoh belum disahkan" : "Semua tahun persekolahan"}
          </small>
        </div>
        <div className="kpi">
          <span>Rekod Bacaan Sekolah</span>
          <strong>
            {entries.filter((r: any) => r.completion === "complete").length}
          </strong>
          <small>Berasingan daripada kelulusan AINS</small>
        </div>
        <div className="kpi">
          <span>Markah PAJSK sekolah</span>
          <strong className="word-value">
            {a.marks ?? (a.level == null ? "Belum disahkan" : "Belum layak")}
          </strong>
          <small>
            {data.rule.certified
              ? "Rujukan disahkan pentadbir"
              : "Menunggu pengesahan peraturan"}
          </small>
        </div>
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Perjalanan bintang"
          sub={
            a.level == null
              ? "Sahkan skop bacaan untuk melihat pencapaian"
              : "Pencapaian terkumpul sepanjang persekolahan"
          }
        >
          <div className="profile-badges">
            {[1, 2, 3, 4, 5].map((n) => (
              <Badge
                key={n}
                level={n}
                locked={a.level == null || a.level < n}
              />
            ))}
          </div>
          <div className="progress-label">
            <b>
              {a.level == null
                ? "Tempoh belum disahkan"
                : a.level === 5
                  ? "TAHNIAH! ANDA TELAH MENCAPAI 5 BINTANG NILAM!"
                  : `${a.level} Bintang · ${a.remaining} bahan lagi menuju ${a.level + 1} Bintang`}
            </b>
            <span>
              {fmt(lifetimeStudent?.eligible)} / {a.next || "720+"}
            </span>
          </div>
          <progress max={100} value={a.progress} />
          {a.level === 5 && (
            <div className="celebration" aria-hidden="true">
              ✦ ✧ ✦ ✧ ✦
            </div>
          )}
        </Panel>
        <Panel
          title="Pemerhatian guru"
          sub="Catatan sokongan perkembangan murid"
          action={
            data.user.role !== "student" && (
              <button className="text-btn" onClick={() => setNote(true)}>
                <Plus size={15} /> Catatan
              </button>
            )
          }
        >
          {data.teacher_observations
            .filter((n: any) => n.canonical_id === id)
            .map((n: any) => (
              <div className="observation" key={n.id}>
                <p>{n.note}</p>
                <small>{n.created_at.slice(0, 10)}</small>
              </div>
            ))}
          {!data.teacher_observations.some(
            (n: any) => n.canonical_id === id,
          ) && (
            <Empty title="Belum ada catatan">
              Guru boleh menambah pemerhatian dan sokongan bacaan.
            </Empty>
          )}
        </Panel>
        <Panel title="Jejak bacaan murid" sub="Kandungan sumber terpilih">
          {m.monthly.length ? (
            <SourceBars items={m.monthly} />
          ) : (
            <Empty icon={CalendarDays} title="Siri masa belum tersedia">
              Tarikh tidak direka daripada jumlah agregat.
            </Empty>
          )}
        </Panel>
        <Panel
          title="Sejarah sumber & pencapaian"
          sub="Tahun dan eksport dikekalkan berasingan"
        >
          <div className="timeline">
            {data.import_batches
              .filter((b: any) =>
                data.ains_summaries.some(
                  (r: any) => r.batch_id === b.id && r.canonical_id === id,
                ),
              )
              .map((b: any) => (
                <div key={b.id}>
                  <i />
                  <b>{b.year || "Tahun belum disahkan"}</b>
                  <p>{b.filename}</p>
                  <small>
                    {b.period_start
                      ? `${b.period_start} – ${b.period_end}`
                      : "Tempoh belum disahkan"}{" "}
                    · {b.verification === "verified" ? "Disahkan" : "Belum disahkan"}
                  </small>
                </div>
              ))}
          </div>
        </Panel>
        <Panel title="Pilihan bahasa & kategori" sub="Daripada rekod sumber">
          <div className="horizontal-bars">
            {m.languages.map((l: any) => (
              <div key={l.key}>
                <div>
                  <span>
                    {
                      (
                        {
                          bm: "Bahasa Melayu",
                          eng: "Bahasa Inggeris",
                          others: "Lain-lain",
                        } as Record<string, string>
                      )[l.key]
                    }
                  </span>
                  <b>{l.value}</b>
                </div>
                <progress max={Math.max(1, m.reported)} value={l.value} />
              </div>
            ))}
          </div>
          <div className="tag-row">
            {m.categories.map((c: any) => (
              <Pill tone="neutral" key={c.key}>
                {c.key}: {c.value}
              </Pill>
            ))}
          </div>
        </Panel>
        <Panel
          title="Bacaan bersama guru"
          sub="Rekod sekolah yang disahkan guru"
        >
          {entries.length ? (
            <div className="list-records">
              {entries.map((r: any) => (
                <div key={r.id}>
                  <BookOpen size={19} />
                  <div>
                    <b>{r.title}</b>
                    <p>
                      {r.date} ·{" "}
                      {r.completion === "complete" ? "Selesai" : "Dalam proses"}
                    </p>
                  </div>
                  <Pill tone="neutral">Sekolah</Pill>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Mulakan satu bacaan">
              Aktiviti berbantu akan muncul di sini.
            </Empty>
          )}
        </Panel>
      </div>
      {note && (
        <Form
          title="Pemerhatian guru"
          fields={[
            {
              key: "note",
              label: "Catatan guru",
              type: "textarea",
              required: true,
            },
          ]}
          onClose={() => setNote(false)}
          onSubmit={(v: any) => mutate("observation", { ...v, student_id: id })}
        />
      )}
    </>
  );
}
function targetProgress(data: any, t: any) {
  const ids = data.students
    .filter((s: any) =>
      t.student_id ? s.id === t.student_id : s.class_id === t.class_id,
    )
    .map((s: any) => s.id);
  if (t.source === "school") {
    const count = data.school_reading_entries.filter(
      (r: any) =>
        ids.includes(r.canonical_id) &&
        r.date >= t.start &&
        r.date <= t.end &&
        r.completion === "complete" &&
        r.confirmed,
    ).length;
    return { count, verified: true };
  }
  const batches = data.import_batches.filter(
    (b: any) =>
      b.verification === "verified" &&
      b.period_start >= t.start &&
      b.period_end <= t.end,
  );
  const m = aggregate({
    students: data.students.filter((s: any) => ids.includes(s.id)),
    rows: data.ains_summaries,
    batches,
    rule: data.rule,
  });
  return {
    count: m.eligible || 0,
    verified:
      m.complete &&
      !m.multiyear &&
      ids.length > 0 &&
      ids.every((id: string) =>
        coversRange(
          batches
            .filter((b: any) =>
              data.ains_summaries.some(
                (r: any) =>
                  r.canonical_id === id &&
                  r.batch_id === b.id &&
                  r.status === "accepted",
              ),
            )
            .map((b: any) => [b.period_start, b.period_end]),
          t.start,
          t.end,
        ),
      ),
  };
}
function Targets(ctx: any) {
  const { data, mutate } = ctx,
    [form, setForm] = useState<any>(false);
  return (
    <>
      <Panel
        title="Sasaran bacaan"
        sub="Matlamat individu, bulanan dan kelas"
        action={
          <button className="btn primary" onClick={() => setForm(true)}>
            <Plus size={16} /> Sasaran baharu
          </button>
        }
      >
        {!data.reading_targets.length ? (
          <Empty
            icon={Target}
            title="Bina matlamat bacaan pertama"
            action={
              <button className="btn" onClick={() => setForm(true)}>
                Tetapkan sasaran <ArrowRight size={15} />
              </button>
            }
          >
            Pilih murid atau kelas, tempoh dan sumber bacaan yang akan diukur.
          </Empty>
        ) : (
          <div className="target-grid">
            {data.reading_targets.map((t: any) => {
              const p = targetProgress(data, t);
              return (
                <div className="target-card" key={t.id}>
                  <div className="target-icon">
                    <Target size={23} />
                    <Pill tone="neutral">
                      {t.source === "school" ? "Rekod sekolah" : "AINS"}
                    </Pill>
                  </div>
                  <h3>{t.title}</h3>
                  {(data.user.role === "admin" ||
                    t.teacher_id === data.user.id) && (
                    <button className="text-btn" onClick={() => setForm(t)}>
                      Kemaskini sasaran
                    </button>
                  )}
                  <p>
                    {t.student_id
                      ? nameOf(data, t.student_id)
                      : classOf(data, t.class_id)}
                  </p>
                  <small>
                    {t.start} – {t.end}
                  </small>
                  <div className="progress-label">
                    <b>{p.verified ? fmt(p.count) : "Data belum lengkap"}</b>
                    <span>/ {t.target} bahan</span>
                  </div>
                  <progress max={t.target} value={p.verified ? p.count : 0} />
                  <p>
                    {p.verified
                      ? Math.max(0, t.target - p.count) +
                        " bahan lagi untuk mencapai sasaran."
                      : "Pengesahan dan liputan tempoh diperlukan."}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      {form && (
        <Form
          title={form.id ? "Kemaskini sasaran bacaan" : "Sasaran bacaan baharu"}
          initial={{
            source: "school",
            start: monthStart(),
            end: today(),
            ...(typeof form === "object" ? form : {}),
          }}
          onClose={() => setForm(false)}
          onSubmit={(v: any) => mutate("target", v)}
          fields={[
            {
              key: "title",
              label: "Tajuk sasaran",
              required: true,
              placeholder: "Contoh: 10 bacaan bersama guru",
            },
            {
              key: "student_id",
              label: "Murid (individu)",
              type: "select",
              options: studentOptions(data),
            },
            {
              key: "class_id",
              label: "Kelas (sasaran kelas)",
              type: "select",
              options: classOptions(data),
            },
            {
              key: "target",
              label: "Bilangan bahan sasaran",
              type: "number",
              min: 1,
              max: 100000,
              required: true,
            },
            {
              key: "start",
              label: "Tarikh mula",
              type: "date",
              required: true,
            },
            { key: "end", label: "Tarikh akhir", type: "date", required: true },
            {
              key: "source",
              label: "Sumber pengukuran",
              type: "select",
              required: true,
              options: [
                { value: "school", label: "Rekod Bacaan Sekolah" },
                { value: "ains", label: "Bacaan Diluluskan AINS" },
              ],
            },
          ]}
        />
      )}
    </>
  );
}
function Readings(ctx: any) {
  const { data, mutate } = ctx,
    [form, setForm] = useState(false),
    [reconcile, setReconcile] = useState<any>(null);
  return (
    <>
      <div className="assisted-banner">
        <BookOpen size={38} />
        <div>
          <h2>Satu buku. Satu pengalaman bersama.</h2>
          <p>Rekod aktiviti bacaan melalui bimbingan dan pengesahan guru.</p>
        </div>
        <button className="btn primary" onClick={() => setForm(true)}>
          <Plus size={18} /> Rekod bacaan
        </button>
      </div>
      <div className="notice">
        <ShieldCheck size={18} />
        <p>
          <b>Rekod Bacaan Sekolah</b> disimpan berasingan daripada{" "}
          <b>Bacaan Diluluskan AINS</b>. Peminjaman buku tidak dikira sebagai
          bacaan.
        </p>
      </div>
      <Panel
        title="Rekod bacaan berbantu"
        sub={`${data.school_reading_entries.length} aktiviti sekolah`}
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Murid & bahan</th>
                <th>Tarikh</th>
                <th>Jenis</th>
                <th>Status</th>
                <th>Pautan AINS</th>
              </tr>
            </thead>
            <tbody>
              {data.school_reading_entries.map((r: any) => (
                <tr key={r.id}>
                  <td>
                    <b>{nameOf(data, r.canonical_id)}</b>
                    <small className="block">{r.title}</small>
                  </td>
                  <td>{r.date}</td>
                  <td>{r.type}</td>
                  <td>
                    <Pill
                      tone={r.completion === "complete" ? "green" : "amber"}
                    >
                      {r.completion === "complete" ? "Selesai" : "Dalam proses"}
                    </Pill>
                  </td>
                  <td>
                    {r.reconciled_summary_id ? (
                      <Pill tone="neutral">Dipautkan · tidak ditambah</Pill>
                    ) : (
                      <button
                        className="text-btn"
                        onClick={() => setReconcile(r)}
                      >
                        Semak padanan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.school_reading_entries.length && (
          <Empty icon={BookOpen} title="Belum ada aktiviti direkodkan">
            Pilih murid, bahan dan tarikh untuk bermula.
          </Empty>
        )}
      </Panel>
      {form && (
        <Form
          title="Rekod bacaan bersama guru"
          onClose={() => setForm(false)}
          initial={{
            date: today(),
            type: "assisted",
            completion: "complete",
            language: "bm",
            category: "fiction",
            confirmed: false,
          }}
          onSubmit={(v: any) => mutate("reading", v)}
          fields={[
            {
              key: "student_id",
              label: "1. Pilih murid",
              type: "select",
              required: true,
              options: studentOptions(data),
            },
            {
              key: "title",
              label: "2. Tajuk buku / bahan bacaan",
              required: true,
            },
            { key: "book_id", label: "ID buku SMARTLIB (jika ada)" },
            {
              key: "date",
              label: "3. Tarikh bacaan",
              type: "date",
              required: true,
            },
            {
              key: "type",
              label: "4. Jenis aktiviti",
              type: "select",
              options: [
                { value: "assisted", label: "Bacaan berbantu" },
                { value: "independent", label: "Bacaan kendiri" },
                { value: "shared", label: "Bacaan bersama" },
                { value: "response", label: "Respons bergambar" },
              ],
            },
            {
              key: "completion",
              label: "5. Tahap penyelesaian",
              type: "select",
              options: [
                { value: "complete", label: "Selesai dibaca" },
                { value: "in_progress", label: "Masih membaca" },
              ],
            },
            {
              key: "language",
              label: "Bahasa",
              type: "select",
              options: [
                { value: "bm", label: "Bahasa Melayu" },
                { value: "eng", label: "Bahasa Inggeris" },
                { value: "others", label: "Lain-lain" },
              ],
            },
            {
              key: "category",
              label: "Kategori",
              type: "select",
              options: [
                { value: "fiction", label: "Fiksyen" },
                { value: "nonfiction", label: "Bukan fiksyen" },
                { value: "digital", label: "Digital" },
                { value: "nonbook", label: "Bukan buku" },
              ],
            },
            {
              key: "reflection",
              label: "Respons / refleksi murid (pilihan)",
              type: "textarea",
            },
            {
              key: "confirmed",
              label: "6. Pengesahan guru",
              type: "checkbox",
              text: "Saya mengesahkan aktiviti ini telah dijalankan.",
            },
          ]}
        />
      )}{" "}
      {reconcile && (
        <Form
          title="Pautkan aktiviti kepada sumber AINS"
          onClose={() => setReconcile(null)}
          onSubmit={(v: any) =>
            mutate("reading/reconcile", { ...v, id: reconcile.id })
          }
          fields={[
            {
              key: "summary_id",
              label: "Ringkasan sumber murid yang sama",
              type: "select",
              required: true,
              options: data.ains_summaries
                .filter((r: any) => r.student_id === reconcile.student_id)
                .map((r: any) => ({
                  value: r.id,
                  label: `${data.import_batches.find((b: any) => b.id === r.batch_id)?.filename} · baris ${r.row_number} · ${r.approved} bahan`,
                })),
            },
            {
              key: "note",
              label: "Bukti bahawa aktiviti ini termasuk dalam ringkasan",
              type: "textarea",
              required: true,
            },
          ]}
        >
          <div className="notice">
            <Info size={17} />
            <p>
              Ringkasan tidak mengenal pasti buku individu. Pautan ini ialah
              pengesahan manual guru dan tidak menambah jumlah AINS.
            </p>
          </div>
        </Form>
      )}
    </>
  );
}
function Smartlib({ data, notify, mutate }: any) {
  const [q, setQ] = useState(""),
    [books, setBooks] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [camera, setCamera] = useState(false);
  async function search(value = q) {
    setBusy(true);
    setError("");
    try {
      const r = await api("smartlib?q=" + encodeURIComponent(value));
      setBooks(r.books);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Panel
        title="Katalog SMARTLIB"
        sub="Cari ISBN, imbas QR atau masukkan pengecam buku"
        action={
          <Pill
            tone={
              data.settings.smartlibUrl || data.settings.smartlibConfigured
                ? "green"
                : "neutral"
            }
          >
            {data.settings.smartlibUrl || data.settings.smartlibConfigured
              ? "Adapter dikonfigurasi"
              : "Belum disambungkan"}
          </Pill>
        }
      >
        <form
          className="catalogue-search"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <div className="input-icon">
            <Search size={19} />
            <input
              aria-label="ISBN atau kod QR buku"
              placeholder="Tajuk, ISBN atau kod QR buku…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              required
            />
          </div>
          <button className="btn" type="button" onClick={() => setCamera(true)}>
            <ScanLine size={18} /> Imbas
          </button>
          <button className="btn primary" disabled={busy}>
            Cari buku <ArrowRight size={16} />
          </button>
        </form>
        {error && (
          <div className="notice danger">
            <Info size={18} />
            {error}
          </div>
        )}
        {!books.length ? (
          <Empty
            icon={BookOpen}
            title={
              data.settings.smartlibUrl || data.settings.smartlibConfigured
                ? "Cari bahan bacaan yang sesuai"
                : "Sambungkan koleksi perpustakaan sekolah"
            }
          >
            Adapter mengambil butiran daripada katalog yang dibenarkan.
            Pentadbir boleh menetapkan URL dan kunci API dalam konfigurasi
            pelayan.
          </Empty>
        ) : (
          <div className="book-grid">
            {books.map((b: any) => (
              <div className="book-card" key={b.id}>
                {b.cover ? (
                  <img
                    src={b.cover}
                    alt={"Kulit buku " + b.title}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="book-cover">
                    <BookOpen size={37} />
                  </div>
                )}
                <h3>{b.title}</h3>
                <p>{b.author || "Pengarang tidak dinyatakan"}</p>
                <small>ISBN {b.isbn || "—"}</small>
                <div className="tag-row">
                  <Pill>{b.category || "Kategori belum dipetakan"}</Pill>
                  <Pill tone="neutral">
                    {b.availability || "Status tidak tersedia"}
                  </Pill>
                </div>
                <button
                  className="btn full"
                  onClick={() =>
                    mutate("book/save", { ...b, suitable: true }).catch(
                      () => {},
                    )
                  }
                >
                  Pilih sebagai bahan sesuai
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel
        title="Cadangan pilihan guru"
        sub="Bahasa dan kategori dipilih daripada katalog tersedia"
      >
        <div className="list-records">
          {data.smartlib_book_links
            .filter((b: any) => b.suitable)
            .map((b: any) => (
              <div key={b.id}>
                <BookOpen size={22} />
                <div>
                  <b>{b.title}</b>
                  <p>
                    {b.language || "Bahasa belum dipetakan"} ·{" "}
                    {b.category || "Kategori belum dipetakan"}
                  </p>
                </div>
                <Pill>Dipilih guru</Pill>
              </div>
            ))}
        </div>
        {!data.smartlib_book_links.some((b: any) => b.suitable) && (
          <p className="muted pad">
            Belum ada bahan dipilih guru. Minat dan kesesuaian ditentukan guru
            tanpa inferens daripada diagnosis murid.
          </p>
        )}
      </Panel>
      {camera && (
        <CameraScanner
          onClose={() => setCamera(false)}
          onValue={(v: string) => {
            setQ(v);
            setCamera(false);
            search(v);
          }}
        />
      )}
    </>
  );
}
function CameraScanner({ onClose, onValue }: any) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    [error, setError] = useState("");
  React.useEffect(() => {
    let cancelled = false,
      timer: any;
    async function start() {
      try {
        const Detector = (window as any).BarcodeDetector;
        if (!Detector)
          throw new Error(
            "Pelayar ini belum menyokong pengimbas. Masukkan ISBN atau kod QR secara manual.",
          );
        stream.current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.current.getTracks().forEach((t) => t.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = stream.current;
          await video.current.play();
        }
        const detector = new Detector({
          formats: ["qr_code", "ean_13", "code_128"],
        });
        timer = setInterval(async () => {
          try {
            if (video.current?.readyState === 4) {
              const values = await detector.detect(video.current);
              if (values[0]?.rawValue) {
                clearInterval(timer);
                onValue(values[0].rawValue);
              }
            }
          } catch {}
        }, 500);
      } catch (e: any) {
        setError(e.message);
      }
    }
    start();
    return () => {
      cancelled = true;
      clearInterval(timer);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  return (
    <Modal title="Imbas QR / kod bar buku" onClose={onClose}>
      {error ? (
        <div className="notice">{error}</div>
      ) : (
        <>
          <video className="scanner-video" ref={video} muted playsInline />
          <p>Halakan kamera pada kod buku. Bunyi tidak diperlukan.</p>
        </>
      )}
    </Modal>
  );
}
function Programmes(ctx: any) {
  const { data, mutate, notify, refresh } = ctx,
    [form, setForm] = useState(false),
    [view, setView] = useState<any>(null),
    [uploading, setUploading] = useState(false);
  async function upload(file: File, pid: string) {
    setUploading(true);
    try {
      const f = new FormData();
      f.set("file", file);
      f.set("programme_id", pid);
      const r = await apiFetch("/api/file", { method: "POST", body: f });
      const j: any = await r.json();
      if (!r.ok) throw new Error(j.error);
      notify("Bukti program disimpan.");
      await refresh();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <>
      <Panel
        title="Program membaca sekolah"
        sub="Aktiviti, penyertaan dan bukti dalam satu tempat"
        action={
          <button className="btn primary" onClick={() => setForm(true)}>
            <Plus size={16} /> Daftar program
          </button>
        }
      >
        {!data.reading_programmes.length ? (
          <Empty
            icon={CalendarDays}
            title="Bina budaya membaca bersama"
            action={
              <button className="btn" onClick={() => setForm(true)}>
                Daftar program pertama
              </button>
            }
          >
            Bulan Membaca, 5 Minit Membaca atau aktiviti bacaan berbantu.
          </Empty>
        ) : (
          <div className="programme-grid">
            {data.reading_programmes.map((p: any) => (
              <button
                className="programme-card"
                key={p.id}
                onClick={() => setView(p)}
              >
                <span className="programme-date">
                  <b>{p.date.slice(8)}</b>
                  {MONTHS[Number(p.date.slice(5, 7)) - 1]}
                </span>
                <div>
                  <h3>{p.name}</h3>
                  <p>{p.organizer}</p>
                  <small>
                    {p.actual_participants} / {p.target_participants} peserta ·{" "}
                    {p.date}
                  </small>
                </div>
                <ArrowUpRight size={18} />
              </button>
            ))}
          </div>
        )}
      </Panel>
      {form && (
        <Form
          title="Daftar program membaca"
          onClose={() => setForm(false)}
          initial={{
            date: today(),
            target_participants: 0,
            actual_participants: 0,
            participants: [],
          }}
          onSubmit={(v: any) => mutate("programme", v)}
          fields={[
            { key: "name", label: "Nama program", required: true },
            { key: "date", label: "Tarikh", type: "date", required: true },
            { key: "organizer", label: "Penganjur", required: true },
            {
              key: "target_participants",
              label: "Sasaran peserta",
              type: "number",
              required: true,
            },
            {
              key: "actual_participants",
              label: "Peserta sebenar",
              type: "number",
              required: true,
            },
            {
              key: "participants",
              label: "Senarai murid peserta (pilihan)",
              type: "multi",
              options: studentOptions(data),
            },
            {
              key: "activities",
              label: "Aktiviti",
              type: "textarea",
              required: true,
            },
            {
              key: "outcomes",
              label: "Hasil bacaan",
              type: "textarea",
              required: true,
            },
            {
              key: "notes",
              label: "Catatan & cadangan guru",
              type: "textarea",
            },
          ]}
        />
      )}{" "}
      {view && (
        <Modal title={view.name} onClose={() => setView(null)} wide>
          <div className="programme-detail">
            <Pill>{view.date}</Pill>
            <p>
              <b>Penganjur:</b> {view.organizer}
            </p>
            <p>
              <b>Penyertaan:</b> {view.actual_participants} daripada sasaran{" "}
              {view.target_participants}
            </p>
            <progress
              max={Math.max(1, view.target_participants)}
              value={view.actual_participants}
            />
            <h3>Aktiviti</h3>
            <p>{view.activities}</p>
            <h3>Hasil bacaan</h3>
            <p>{view.outcomes}</p>
            <h3>Catatan guru</h3>
            <p>{view.notes || "Tiada catatan."}</p>
            <h3>Bukti program</h3>
            <div className="evidence-grid">
              {data.evidence_files
                .filter((f: any) => f.programme_id === view.id)
                .map((f: any) => (
                  <a
                    href={"/api/file?id=" + f.id}
                    key={f.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {f.mime.startsWith("image/") ? (
                      <ProtectedImage src={"/api/file?id=" + f.id} alt={f.name} />
                    ) : (
                      <FileText size={36} />
                    )}
                    <span>{f.name}</span>
                  </a>
                ))}
            </div>
            <label className="btn upload-label">
              <Upload size={16} />
              {uploading ? "Memuat naik…" : "Muat naik foto / bukti"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                hidden
                disabled={uploading}
                onChange={(e) => {
                  if (e.target.files?.[0]) upload(e.target.files[0], view.id);
                }}
              />
            </label>
            <div className="form-actions">
              <a
                className="btn primary"
                href={
                  "/api/report?" +
                  query({ ...ctx.filters, programme: view.id, format: "pdf" })
                }
              >
                <Download size={16} /> Laporan PDF
              </a>
              <a
                className="btn"
                href={
                  "/api/report?" +
                  query({ ...ctx.filters, programme: view.id, format: "xlsx" })
                }
              >
                <Download size={16} /> Excel
              </a>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
function Certificates(ctx: any) {
  const { data, mutate } = ctx,
    [form, setForm] = useState(false);
  return (
    <>
      <div className="certificate-banner">
        <Award size={42} />
        <div>
          <span className="eyebrow">PENGIKTIRAFAN SEKOLAH</span>
          <h2>Raikan perjalanan literasi.</h2>
          <p>
            Sijil A4 dengan ID unik dan QR pengesahan yang melindungi identiti
            murid.
          </p>
        </div>
        <button className="btn primary" onClick={() => setForm(true)}>
          <Plus size={16} /> Keluarkan sijil
        </button>
      </div>
      <Panel
        title="Daftar sijil digital"
        sub="Bukan pensijilan rasmi AINS atau PAJSK"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Murid</th>
                <th>Pengiktirafan</th>
                <th>Tarikh</th>
                <th>Status</th>
                <th>Sijil</th>
              </tr>
            </thead>
            <tbody>
              {data.certificates.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    <b>{nameOf(data, c.canonical_id)}</b>
                    <small className="block">{c.id.slice(0, 13)}</small>
                  </td>
                  <td>
                    {c.category}
                    <small className="block">
                      {c.total} bahan{" "}
                      {c.level ? "· " + c.level + " Bintang" : ""}
                    </small>
                  </td>
                  <td>{c.date}</td>
                  <td>
                    <Pill tone={c.revoked ? "red" : "green"}>
                      {c.revoked ? "Dibatalkan" : "Dikeluarkan"}
                    </Pill>
                  </td>
                  <td>
                    <div className="button-row">
                      <a
                        className="btn"
                        href={"/api/certificate/pdf?id=" + c.id}
                      >
                        <Download size={15} /> PDF
                      </a>
                      {data.user.role === "admin" && !c.revoked && (
                        <button
                          className="text-btn"
                          onClick={() =>
                            mutate("certificate/revoke", { id: c.id }).catch(
                              () => {},
                            )
                          }
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.certificates.length && (
          <Empty icon={Award} title="Pencapaian menunggu untuk diraikan">
            Keluarkan sijil apabila bukti pencapaian dan tempoh disahkan.
          </Empty>
        )}
      </Panel>
      {form && (
        <Form
          title="Keluarkan sijil pengiktirafan sekolah"
          onClose={() => setForm(false)}
          initial={{ date: today(), category: "Bintang NILAM" }}
          onSubmit={(v: any) =>
            mutate("certificate", { ...v, filters: ctx.filters })
          }
          fields={[
            {
              key: "student_id",
              label: "Nama murid",
              type: "select",
              required: true,
              options: studentOptions(data),
            },
            {
              key: "category",
              label: "Kategori pengiktirafan",
              type: "select",
              required: true,
              options: [
                "Bintang NILAM",
                "Pembaca Paling Konsisten",
                "Peningkatan Bacaan Terbaik",
                "Pembaca Terbanyak",
                "Pencapaian Sasaran Bacaan",
              ],
            },
            {
              key: "date",
              label: "Tarikh pencapaian",
              type: "date",
              required: true,
            },
            {
              key: "note",
              label: "Asas pengiktirafan guru",
              hint: "Bagi kategori selain bintang, catat bukti guru. Bilangan diambil daripada rekod sekolah.",
              type: "textarea",
              show: (v: any) => v.category !== "Bintang NILAM",
              required: true,
            },
          ]}
        >
          <div className="notice">
            <ShieldCheck size={17} />
            <p>
              Jumlah dan tahap bintang dikira oleh pelayan. Sijil bintang
              memerlukan skop yang disahkan.
            </p>
          </div>
        </Form>
      )}
    </>
  );
}
function Reports(ctx: any) {
  const { data, filters } = ctx,
    m = data.metrics;
  return (
    <>
      <Panel
        title="Laporan pencapaian literasi"
        sub="Eksport menggunakan penapis dan pengiraan yang sama seperti dashboard"
      >
        <div className="report-summary">
          <div>
            <span className="eyebrow">SK PENDIDIKAN KHAS TAIPING</span>
            <h2>{filters.dataset}</h2>
            <p>
              {m.unverified
                ? "Tempoh belum disahkan"
                : "Mengikut skop disahkan"}{" "}
              · {m.batches.length} fail sumber
            </p>
            <div className="report-numbers">
              <span>
                <b>{m.students.length}</b> murid
              </span>
              <span>
                <b>{m.reported}</b> bahan dilaporkan
              </span>
              <span>
                <b>{m.eligible ?? "—"}</b> layak
              </span>
            </div>
          </div>
          <FileSpreadsheet size={74} strokeWidth={0.8} />
        </div>
        <div className="export-options">
          <a href={"/api/report?" + query({ ...filters, format: "pdf" })}>
            <span className="export-icon pdf">
              <FileText size={28} />
            </span>
            <div>
              <b>Laporan PDF</b>
              <p>Ringkasan, senarai murid, carta dan liputan sumber.</p>
            </div>
            <Download size={20} />
          </a>
          <a href={"/api/report?" + query({ ...filters, format: "xlsx" })}>
            <span className="export-icon">
              <FileSpreadsheet size={28} />
            </span>
            <div>
              <b>Fail Excel</b>
              <p>Angka bertip, lembaran ringkasan, murid dan sumber.</p>
            </div>
            <Download size={20} />
          </a>
        </div>
      </Panel>
      <Panel title="Skop yang disertakan">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fail</th>
                <th>Tempoh</th>
                <th>Granulariti</th>
                <th>Pengesahan</th>
              </tr>
            </thead>
            <tbody>
              {m.batches.map((b: any) => (
                <tr key={b.id}>
                  <td>{b.filename}</td>
                  <td>
                    {b.period_start
                      ? `${b.period_start} – ${b.period_end}`
                      : "Tempoh belum disahkan"}
                  </td>
                  <td>{b.granularity}</td>
                  <td>
                    <Pill
                      tone={b.verification === "verified" ? "green" : "amber"}
                    >
                      {b.verification === "verified"
                        ? "Disahkan"
                        : "Belum disahkan"}
                    </Pill>
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
function SystemSettings(ctx: any) {
  const { data, mutate } = ctx,
    [form, setForm] = useState(""),
    [rules, setRules] = useState(data.rule.thresholds.join(",")),
    [marks, setMarks] = useState(data.rule.marks.join(",")),
    [reference, setReference] = useState(data.rule.reference || ""),
    [certified, setCertified] = useState(!!data.rule.certified);
  if (data.user.role !== "admin")
    return <Empty title="Tetapan untuk pentadbir sahaja" />;
  return (
    <>
      <div className="settings-grid">
        <Panel
          title="Identiti & integrasi sekolah"
          sub="Konfigurasi LITRIC yang berasingan daripada SMARTLIB"
          action={
            <button className="text-btn" onClick={() => setForm("settings")}>
              Kemaskini
            </button>
          }
        >
          <dl>
            <dt>Institusi</dt>
            <dd>{data.settings.schoolName}</dd>
            <dt>Kod sekolah</dt>
            <dd>ABA6052</dd>
            <dt>SMARTLIB</dt>
            <dd>{data.settings.smartlibUrl || "Belum disambungkan"}</dd>
            <dt>Logo sekolah</dt>
            <dd>Belum dibekalkan. Tiada logo pengganti digunakan.</dd>
            <dt>Rahsia API</dt>
            <dd>Dikonfigurasi sebagai SMARTLIB_API_KEY di pelayan.</dd>
          </dl>
        </Panel>
        <Panel
          title="Kelas & tahun akademik"
          action={
            <button className="text-btn" onClick={() => setForm("class")}>
              <Plus size={15} /> Kelas
            </button>
          }
        >
          {data.classes.map((c: any) => (
            <div className="result-row" key={c.id}>
              <b>{c.name}</b>
              <Pill tone="neutral">{c.year}</Pill>
            </div>
          ))}
          {!data.classes.length && (
            <Empty icon={Users} title="Kelas belum dipetakan">
              Fail sumber tidak mempunyai kelas. Daftar kelas sebenar sebelum
              pemetaan murid.
            </Empty>
          )}
        </Panel>
        <Panel
          title="Peraturan bintang & PAJSK"
          sub="Versi peraturan disimpan bersama jejak audit"
        >
          <Field label="Ambang bintang 1 hingga 5 (pisahkan dengan koma)">
            <input value={rules} onChange={(e) => setRules(e.target.value)} />
          </Field>
          <Field label="Markah sekolah (pisahkan dengan koma)">
            <input value={marks} onChange={(e) => setMarks(e.target.value)} />
          </Field>
          <Field label="Rujukan pengesahan rasmi">
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Dokumen dan tarikh semakan pentadbir"
            />
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={certified}
              onChange={(e) => setCertified(e.target.checked)}
            />
            Pentadbir telah mengesahkan peraturan terhadap rujukan semasa.
          </label>
          <button
            className="btn primary"
            onClick={() =>
              mutate("rules", {
                thresholds: rules.split(",").map(Number),
                marks: marks.split(",").map(Number),
                reference,
                certified,
              }).catch(() => {})
            }
          >
            Simpan versi peraturan
          </button>
        </Panel>
        <Panel
          title="Sandaran & pemulihan"
          sub="Salinan data sekolah dengan jejak asal"
        >
          <p>
            Eksport sandaran JSON semua jadual. Salinan turut disimpan dalam
            storan peribadi sekolah apabila R2 tersedia.
          </p>
          <a className="btn" href="/api/backup">
            <Download size={16} /> Muat turun sandaran
          </a>
          <p className="muted small">
            Panduan pemulihan luar talian disertakan dalam README. Fail bukti
            dan sumber asal disimpan berasingan dalam R2.
          </p>
        </Panel>
      </div>
      <Panel
        title="Akses pengguna"
        sub="Identiti melalui ChatGPT; peranan dan kelas dikuatkuasakan pelayan"
        action={
          <button className="btn primary" onClick={() => setForm("user")}>
            <Plus size={16} /> Tetapkan akses
          </button>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Peranan</th>
                <th>Kelas dibenarkan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u: any) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    <small className="block">{u.email}</small>
                  </td>
                  <td>{u.role}</td>
                  <td>
                    {JSON.parse(u.class_ids)
                      .map((id: string) => classOf(data, id))
                      .join(", ") || "—"}
                  </td>
                  <td>{u.active ? "Aktif" : "Dinyahaktifkan"}</td>
                </tr>
              ))}
              {data.invitations.map((u: any) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    {JSON.parse(u.class_ids)
                      .map((id: string) => classOf(data, id))
                      .join(", ") || "—"}
                  </td>
                  <td>Belum log masuk</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-foot">
          <Info size={14} />
          Akses Site kekal peribadi. Kebenaran Site dan peranan aplikasi
          kedua-duanya diperlukan.
        </div>
      </Panel>
      {form === "settings" && (
        <Form
          title="Identiti & adapter SMARTLIB"
          initial={data.settings}
          onClose={() => setForm("")}
          onSubmit={(v: any) => mutate("settings", v)}
          fields={[
            { key: "schoolName", label: "Nama sekolah", required: true },
            {
              key: "smartlibUrl",
              label: "URL adapter katalog (HTTPS)",
              type: "url",
              hint: "GET ?q=ISBN&school=ABA6052 → {books:[...]}. Kunci API disimpan di pelayan.",
            },
          ]}
        />
      )}{" "}
      {form === "class" && (
        <Form
          title="Daftar kelas"
          onClose={() => setForm("")}
          onSubmit={(v: any) => mutate("class", v)}
          fields={[
            { key: "name", label: "Nama kelas", required: true },
            {
              key: "year",
              label: "Tahun akademik",
              type: "number",
              min: 2000,
              max: 2100,
              required: true,
            },
          ]}
        />
      )}{" "}
      {form === "user" && (
        <Form
          title="Tetapkan akses pengguna"
          initial={{ role: "teacher", class_ids: [] }}
          onClose={() => setForm("")}
          onSubmit={(v: any) => mutate("user", v)}
          fields={[
            {
              key: "email",
              label: "E-mel akaun ChatGPT",
              type: "email",
              required: true,
            },
            {
              key: "role",
              label: "Peranan",
              type: "select",
              required: true,
              options: [
                { value: "admin", label: "Pentadbir" },
                { value: "teacher", label: "Guru" },
                { value: "student", label: "Murid" },
                { value: "public", label: "Paparan agregat tanpa nama" },
              ],
            },
            {
              key: "student_id",
              label: "Profil murid (untuk peranan murid)",
              type: "select",
              options: studentOptions(data),
              show: (v: any) => v.role === "student",
              required: true,
            },
            {
              key: "class_ids",
              label: "Kelas dibenarkan (untuk guru)",
              type: "multi",
              options: classOptions(data),
              show: (v: any) => v.role === "teacher",
            },
          ]}
        />
      )}
    </>
  );
}
function Audit(ctx: any) {
  const { data, mutate } = ctx,
    [verify, setVerify] = useState<any>(null),
    [review, setReview] = useState<any>(null);
  if (data.user.role !== "admin")
    return <Empty title="Akses pentadbir diperlukan" />;
  const issues = data.ains_summaries.filter((r: any) => r.status === "review");
  return (
    <>
      <Panel
        title="Sejarah import & liputan"
        sub="Sahkan tempoh, semantik dan kelayakan sebelum pengiraan bintang"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fail & sumber</th>
                <th>Jumlah mentah</th>
                <th>Skop</th>
                <th>Status</th>
                <th>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {data.import_batches.map((b: any) => (
                <tr key={b.id}>
                  <td>
                    <b>{b.filename}</b>
                    <small className="block">
                      {b.source_type} · v{b.version} ·{" "}
                      {b.created_at.slice(0, 10)}
                    </small>
                    <small className="block">
                      SHA {b.file_hash?.slice(0, 16)}…
                    </small>
                  </td>
                  <td>{JSON.parse(b.stats || "{}").reported ?? "—"}</td>
                  <td>
                    {b.period_start ? (
                      <>
                        <b>{b.year}</b>
                        <small className="block">
                          {b.period_start} – {b.period_end}
                        </small>
                        {b.granularity}
                      </>
                    ) : (
                      "Tempoh belum disahkan"
                    )}
                  </td>
                  <td>
                    <Pill
                      tone={
                        b.status !== "active"
                          ? "neutral"
                          : b.verification === "verified"
                            ? "green"
                            : "amber"
                      }
                    >
                      {b.status !== "active"
                        ? "Dibatalkan"
                        : b.verification === "verified"
                          ? "Disahkan"
                          : "Belum disahkan"}
                    </Pill>
                  </td>
                  <td>
                    <div className="audit-actions">
                      <button
                        className="text-btn"
                        disabled={b.status !== "active"}
                        onClick={() => setVerify(b)}
                      >
                        Sahkan skop
                      </button>
                      <a
                        href={"/api/source?batch=" + b.id}
                        className="text-btn"
                      >
                        Sumber
                      </a>
                      <a
                        href={"/api/errors?batch=" + b.id}
                        className="text-btn"
                      >
                        Ralat
                      </a>
                      <button
                        className="text-btn"
                        onClick={() =>
                          mutate(
                            b.status === "active"
                              ? "batch/rollback"
                              : "batch/restore",
                            { id: b.id },
                          ).catch(() => {})
                        }
                      >
                        {b.status === "active" ? "Batal import" : "Pulihkan"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Baris memerlukan semakan"
        sub={`${issues.length} baris · rekod asal dikekalkan`}
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fail / baris</th>
                <th>Murid</th>
                <th>Bacaan</th>
                <th>Isu</th>
                <th>Keputusan</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((r: any) => (
                <tr key={r.id}>
                  <td>
                    {
                      data.import_batches.find((b: any) => b.id === r.batch_id)
                        ?.filename
                    }
                    <small className="block">Baris {r.row_number}</small>
                  </td>
                  <td>{r.original_name}</td>
                  <td>{r.approved}</td>
                  <td>{r.issue}</td>
                  <td>
                    <button className="btn" onClick={() => setReview(r)}>
                      Semak
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!issues.length && (
          <p className="pad muted">Tiada baris menunggu semakan.</p>
        )}
      </Panel>
      <Panel title="Jejak audit" sub="200 tindakan terkini">
        <div className="timeline audit-timeline">
          {data.audit.map((a: any) => (
            <div key={a.id}>
              <i />
              <b>{a.action}</b>
              <p>
                {data.users.find((u: any) => u.id === a.user_id)?.name ||
                  a.user_id}{" "}
                ·{" "}
                {new Date(a.created_at).toLocaleString("ms-MY", {
                  timeZone: "Asia/Kuala_Lumpur",
                })}
              </p>
              <small>{a.entity_id || "Sistem"}</small>
            </div>
          ))}
        </div>
      </Panel>
      {verify && (
        <Form
          title="Sahkan skop pelaporan"
          initial={{
            ...verify,
            coverage_complete: !!verify.coverage_complete,
            star_eligible: !!verify.star_eligible,
            note: verify.verification_note || "",
          }}
          onClose={() => setVerify(null)}
          onSubmit={(v: any) => mutate("batch/verify", v)}
          fields={[
            {
              key: "year",
              label: "Tahun pelaporan daripada bukti",
              type: "number",
              min: 2000,
              max: 2100,
              required: true,
            },
            {
              key: "granularity",
              label: "Semantik sumber",
              type: "select",
              required: true,
              options: [
                {
                  value: "monthly",
                  label: "Agregat bulanan (tidak kumulatif)",
                },
                { value: "annual", label: "Agregat tempoh / tahunan" },
                { value: "snapshot", label: "Snapshot kumulatif" },
                {
                  value: "event",
                  label: "Peristiwa individu (import ID aktiviti sahaja)",
                },
              ],
            },
            {
              key: "period_start",
              label: "Mula tempoh diliputi",
              type: "date",
              required: true,
            },
            {
              key: "period_end",
              label: "Akhir tempoh diliputi",
              type: "date",
              required: true,
            },
            {
              key: "snapshot_date",
              label: "Tarikh snapshot",
              type: "date",
              show: (v: any) => v.granularity === "snapshot",
              required: true,
            },
            {
              key: "coverage_complete",
              label: "Liputan tempoh",
              type: "checkbox",
              text: "Eksport meliputi keseluruhan tempoh yang dinyatakan.",
            },
            {
              key: "star_eligible",
              label: "Kelayakan pencapaian",
              type: "checkbox",
              text: "Gunakan skop ini untuk pengiraan bintang.",
            },
            {
              key: "note",
              label: "Bukti pengesahan tempoh dan semantik",
              type: "textarea",
              required: true,
            },
          ]}
        >
          <div className="notice">
            <Info size={17} />
            <p>
              Jangan sahkan tahun daripada nama fail sahaja. Snapshot terkini
              menggantikan snapshot terdahulu. Skop yang bertindih dikecualikan
              daripada pengiraan.
            </p>
          </div>
        </Form>
      )}{" "}
      {review && (
        <Form
          title={`Semak baris ${review.row_number}`}
          onClose={() => setReview(null)}
          onSubmit={(v: any) => mutate("row/resolve", { ...v, id: review.id })}
          fields={[
            {
              key: "status",
              label: "Keputusan",
              type: "select",
              required: true,
              options: [
                { value: "accepted", label: "Terima sebagai ringkasan murid" },
                { value: "excluded", label: "Kecualikan daripada jumlah" },
                { value: "review", label: "Kekalkan untuk semakan" },
              ],
            },
            {
              key: "reason",
              label: "Sebab / bukti keputusan",
              type: "textarea",
              required: true,
            },
          ]}
        >
          <div className="raw-record">
            <b>Rekod sumber asal</b>
            <pre>{JSON.stringify(JSON.parse(review.raw), null, 2)}</pre>
          </div>
        </Form>
      )}
    </>
  );
}
