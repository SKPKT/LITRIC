import React, { useState } from "react";
import {
  Users,
  BookOpen,
  Star,
  ShieldCheck,
  Upload,
  TrendingUp,
} from "lucide-react";
import { Panel, Badge, fmt, pretty, Modal } from "../litric";
import { StudentReportControls, useStudentReport } from './student-report-controls';
function Stat({ label, value, icon: Icon, sub }: any) {
  return (
    <article className="kpi">
      <div className="kpi-top">
        <span>{label}</span>
        <span className="kpi-icon">
          <Icon size={22} />
        </span>
      </div>
      <strong>{value == null ? "—" : fmt(value)}</strong>
      <small>{sub}</small>
    </article>
  );
}
function Bars({ items, label }: any) {
  const max = Math.max(1, ...items.map((x: any) => x.value || 0));
  return (
    <div className="year-bars" role="list" aria-label={label}>
      {items.length ? (
        items.map((x: any) => (
          <div className="year-row" role="listitem" key={x.key}>
            <span>{x.label}</span>
            <span className="year-bar-track" aria-hidden="true">
              <span
                className="year-bar"
                style={{
                  display: "block",
                  width: ((x.value || 0) / max) * 100 + "%",
                }}
              />
            </span>
            <b>{x.value == null ? "Belum disahkan" : fmt(x.value)}</b>
          </div>
        ))
      ) : (
        <p>Belum ada rekod yang disahkan.</p>
      )}
    </div>
  );
}
export function IndependentDashboard({ ctx }: any) {
  const { data, go } = ctx,
    m = data.metrics,
    l = m.lifetime,
    current = m.current;
  const currentStudents = data.students.filter(
    (s: any) => s.status === "current" && !s.archived_at && (!ctx.filters.classId || s.class_id === ctx.filters.classId),
  );
  return (
    <>
      <section className="welcome-banner">
        <div>
          <span className="welcome-kicker">
            LITRIC · SK PENDIDIKAN KHAS TAIPING
          </span>
          <h2>
            Setiap bacaan,
            <br />
            <em>satu kemajuan.</em>
          </h2>
          <p>
            Bimbing potensi murid dengan rekod tahunan dan pencapaian sepanjang
            persekolahan.
          </p>
          <button className="banner-link" onClick={() => go("bintang")}>
            Terokai pencapaian NILAM →
          </button>
        </div>
        <BookOpen size={100} aria-hidden="true" />
      </section>
      <div className="kpis dashboard-kpis">
        <Stat
          label="Jumlah Murid Semasa"
          value={currentStudents.length}
          icon={Users}
          sub="Tidak termasuk murid berpindah atau diarkib"
        />
        <Stat
          label="Murid Mempunyai Rekod AINS"
          value={l.students.length}
          icon={BookOpen}
          sub="Identiti kekal · semua tahun"
        />
        <Stat
          label="Jumlah Bacaan Tahun Semasa"
          value={current.eligible}
          icon={TrendingUp}
          sub={`${m.currentYear} · bacaan diluluskan dan disahkan`}
        />
        <Stat
          label="Jumlah Bacaan Terkumpul"
          value={l.eligible}
          icon={Star}
          sub="Semua tahun · sumber bebas yang disahkan"
        />
        <Stat
          label="Rekod Perlu Pengesahan"
          value={
            data.import_batches.filter(
              (b: any) =>
                b.status === "active" && b.verification !== "verified",
            ).length
          }
          icon={ShieldCheck}
          sub={`${l.reviewCount} baris perlu semakan · ${l.blocked.length} identiti bertindih`}
        />
        <Stat
          label="Murid Mencapai Bintang"
          value={l.students.filter((s: any) => s.achievement.level > 0).length}
          icon={Star}
          sub="Berdasarkan bacaan terkumpul yang disahkan"
        />
      </div>
      <div className="notice">
        <ShieldCheck size={20} />
        <p>
          Penapis tahun mengubah laporan tahunan. Pencapaian terkumpul sentiasa
          merangkumi semua tahun. Rekod belum disahkan kekal berasingan;
          pertindihan menghalang pengiktirafan.
        </p>
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Jumlah bacaan mengikut tahun"
          sub="Bacaan diluluskan yang disahkan"
        >
          <Bars
            label="Bacaan tahunan"
            items={m.yearly.map((y: any) => ({
              key: y.year,
              label: y.year,
              value: y.eligible,
            }))}
          />
        </Panel>
        <Panel
          title="Bilangan murid mengikut bintang"
          sub="Pencapaian terkumpul · semua tahun"
        >
          <Bars
            label="Taburan bintang"
            items={l.starDistribution.map((x: any) => ({
              key: x.level,
              label: x.level + " Bintang",
              value: x.count,
            }))}
          />
        </Panel>
        <Panel
          title="Perbandingan kelas"
          sub="Bacaan dalam penapis tahun dan set data terpilih"
        >
          <Bars
            label="Perbandingan kelas"
            items={m.classGroups.map((x: any) => ({
              key: x.id || "none",
              label:
                data.classes.find((c: any) => c.id === x.id)?.name ||
                "Belum dipetakan",
              value: x.total,
            }))}
          />
        </Panel>
        <Panel title="Pencapaian tertinggi" sub="Jumlah terkumpul disahkan">
          <Bars
            label="Pencapaian murid"
            items={[...l.students]
              .filter((s: any) => s.eligible != null)
              .sort((a: any, b: any) => b.eligible - a.eligible)
              .slice(0, 5)
              .map((s: any) => ({
                key: s.id,
                label: pretty(s.name),
                value: s.eligible,
              }))}
          />
        </Panel>
      </div>
      {!data.import_batches.length && (
        <Panel title="Mulakan rekod literasi">
          <p className="pad">
            Import fail AINS dan sahkan tahun serta jenis ringkasan sebelum
            mengira bintang.
          </p>
          {data.user.role === "admin" && (
            <button className="btn primary" onClick={() => go("import")}>
              <Upload size={18} /> Import Data AINS
            </button>
          )}
        </Panel>
      )}
    </>
  );
}
export function LifetimeAchievements({ ctx }: any) {
  const {filters,setFilters,report}=useStudentReport(ctx.data);
  const { data } = ctx,
    m = data.metrics,
    l = m.lifetime,
    [rules, setRules] = useState(false),
    [thresholds, setThresholds] = useState(data.rule.thresholds.join(",")),
    [marks, setMarks] = useState(data.rule.marks.join(",")),
    [error, setError] = useState("");
  return (
    <>
      <section className="achievement-hero">
        <span className="eyebrow">PENCAPAIAN SEPANJANG PERSEKOLAHAN</span>
        <h2>Setiap kemajuan wajar diraikan.</h2>
        <p>
          Jumlah tahunan bebas dan disahkan digabung melalui identiti murid yang
          sama.
        </p>
      </section>
      <div className="badge-gallery">
        {data.rule.thresholds.map((n: number, i: number) => (
          <div className="badge-card" key={n}>
            <Badge level={i + 1} />
            <b>
              {n}
              {i === 4 ? "+" : ""} bacaan
            </b>
            <p>{data.rule.marks[i]} markah</p>
            <small>
              {data.rule.certified
                ? "Rujukan disahkan sekolah"
                : "Peraturan sekolah · menunggu pengesahan rasmi"}
            </small>
          </div>
        ))}
      </div>
      <StudentReportControls data={data} filters={filters} setFilters={setFilters} notify={ctx.notify}/>
      <Panel
        title="Rekod bintang terkumpul"
        sub="Penapis tahun tidak memadam pencapaian tahun terdahulu"
        action={
          data.user.role === "admin" && (
            <button className="btn" onClick={() => setRules(true)}>
              Tetapan ambang bintang
            </button>
          )
        }
      >
        <div className="table-scroll">
          <table className="lifetime-table">
            <thead>
              <tr>
                <th>Murid / kelas</th>
                <th>Rekod mengikut tahun</th>
                <th>Tahun semasa</th>
                <th>Tahun terdahulu</th>
                <th>Terkumpul</th>
                <th>Bintang / sasaran</th>
                <th>Pengesahan</th>
              </tr>
            </thead>
            <tbody>
              {report.records.map((s: any) => {
                const history = s.history.map((h:any)=>({year:h.year,student:{eligible:h.total,reported:h.reported}}));
                const annual = s.annual;
                const earlier = history.filter((y:any)=>y.year < report.year);
                const previous = !earlier.length||earlier.some((y:any)=>y.student.eligible==null)?null:earlier.reduce(
                    (sum: number, y: any) => sum + (y.student.eligible || 0),
                    0,
                  );
                return (
                  <tr key={s.id}>
                    <td>
                      <button
                        className="text-btn"
                        onClick={() => ctx.go("profil/" + s.id)}
                      >
                        {pretty(s.name)}
                      </button>
                      <small className="block muted">
                        {data.classes.find((c: any) => c.id === s.class_id)
                          ?.name || "Belum dipetakan"}
                      </small>
                    </td>
                    <td>
                      {history.map((y: any) => (
                        <div key={y.year}>
                          {y.year}:{" "}
                          {y.student.eligible == null
                            ? "Belum disahkan"
                            : fmt(y.student.eligible)}{" "}
                          <small className="muted">
                            (sumber: {fmt(y.student.reported)})
                          </small>
                        </div>
                      ))}
                    </td>
                    <td>{annual == null ? "—" : fmt(annual)}</td>
                    <td>{previous==null?'Belum disahkan':fmt(previous)}</td>
                    <td>
                      <b>{s.total == null ? (s.hasAins?'Belum disahkan':'Tiada rekod AINS') : fmt(s.total)}</b>
                    </td>
                    <td>
                      {s.achievement.level == null ? (
                        "Belum dapat disahkan"
                      ) : (
                        <>
                          <span className="gold-stars">
                            ★ {s.achievement.level} Bintang
                          </span>
                          <small className="block">
                            {s.achievement.next
                              ? `${s.achievement.remaining} lagi → ${s.achievement.next}`
                              : "Tahap tertinggi"}
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      {s.verification}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!report.records.length && <p className="pad">Tiada murid sepadan dengan penapis.</p>}
      </Panel>
      {rules && (
        <Modal
          title="Peraturan bintang sekolah"
          onClose={() => setRules(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await ctx.mutate("rules", {
                  thresholds: thresholds.split(",").map(Number),
                  marks: marks.split(",").map(Number),
                  certified: false,
                });
                setRules(false);
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            <label>
              5 ambang bacaan, dipisahkan koma
              <input
                value={thresholds}
                onChange={(e) => setThresholds(e.target.value)}
                required
              />
            </label>
            <label>
              5 markah, dipisahkan koma
              <input
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                required
              />
            </label>
            <p>
              Perubahan disimpan sebagai versi baharu dan belum diperakui rasmi.
            </p>
            <p role="alert">{error}</p>
            <button className="btn primary">Simpan versi peraturan</button>
          </form>
        </Modal>
      )}
    </>
  );
}
