"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Upload,
  Users,
  ChartNoAxesCombined,
  Star,
  Target,
  BookOpen,
  Library,
  CalendarDays,
  Award,
  FileChartColumn,
  Settings,
  History,
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Download,
  ShieldCheck,
  Info,
  Check,
  LogOut,
  Menu,
  X,
  SlidersHorizontal,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Accessibility,
  GraduationCap,
  ScanLine,
  FileSpreadsheet,
  CloudUpload,
  BookMarked,
  Eye,
} from "lucide-react";
import ImportCentre from "./modules/import-centre";
import WorkspaceViews from "./modules/workspace-views";
import {apiFetch, logout, downloadProtected, isPages} from "../lib/client-api";
import {
  DEFAULT_RULE,
  MONTHS,
  star,
  aggregate,
  explainInsights,
} from "../lib/domain.mjs";

export const fmt = (n: any, d = 0) =>
  n == null
    ? "—"
    : Number(n).toLocaleString("ms-MY", { maximumFractionDigits: d });
export const pretty = (s: string) =>
  s?.toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase()) || "";
export const initials = (name: string) =>
  name
    ?.split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("") || "M";
export async function api(path: string, body?: any) {
  const r = await apiFetch(
    "/api/" + path,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  let data: any;
  try {
    data = await r.json();
  } catch {
    throw new Error("Pelayan belum memberikan respons yang sah.");
  }
  if (!r.ok)
    throw Object.assign(new Error(data.error || "Operasi tidak berjaya."), {
      status: r.status,
    });
  return data;
}
export const query = (filters: any) =>
  new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== "" && v != null) as any,
  ).toString();
export function Pill({ children, tone = "green" }: any) {
  return <span className={"pill " + tone}>{children}</span>;
}
export function Empty({ icon: Icon = BookOpen, title, children, action }: any) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={29} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Panel({ title, sub, action, children, className = "" }: any) {
  return (
    <section className={"panel " + className}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Modal({ title, children, onClose, wide = false }: any) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    const prev = document.activeElement as HTMLElement;
    const el = document.querySelector<HTMLElement>(".modal");
    el?.focus();
    return () => {
      document.removeEventListener("keydown", h);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const a = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>(
              "button,input,select,textarea,a[href]",
            ),
          ).filter((x) => !x.hasAttribute("disabled"));
          if (!a.length) return;
          const first = a[0],
            last = a[a.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Tutup" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Field({ label, children, hint }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Badge({ level, locked = false }: any) {
  return (
    <div
      className={"achievement-badge " + (locked ? "locked" : "")}
      aria-label={`${level} Bintang${locked ? " belum dicapai" : ""}`}
    >
      <div className="badge-seal">
        <BookOpen size={27} />
        <div className="badge-stars">
          {Array.from({ length: level }, (_, i) => (
            <Star size={13} fill="currentColor" key={i} />
          ))}
        </div>
        <b>{String(level).padStart(2, "0")}</b>
      </div>
      <strong>{level} Bintang</strong>
      {locked && <Lock size={12} />}
    </div>
  );
}
export function SourceBars({ items, active = false }: any) {
  const max = Math.max(
    1,
    ...items.map((x: any) => (active ? x.active : x.value)),
  );
  return (
    <div
      className="source-chart"
      role="img"
      aria-label={items
        .map((x: any) => `${x.label}: ${active ? x.active : x.value}`)
        .join(", ")}
    >
      <div className="chart-grid">
        {[1, 0.75, 0.5, 0.25, 0].map((n, i) => (
          <div key={i}>
            <span>{Math.round(max * n)}</span>
            <i />
          </div>
        ))}
      </div>
      <div className="chart-columns">
        {items.map((x: any, i: number) => (
          <div className="chart-column" key={x.id}>
            <div className="bar-tip">{fmt(active ? x.active : x.value)}</div>
            <div
              className={"chart-bar " + (i === items.length - 1 ? "last" : "")}
              style={{
                height: `${Math.max(1, ((active ? x.active : x.value) / max) * 87)}%`,
                visibility:
                  (active ? x.active : x.value) == null ? "hidden" : "visible",
              }}
              title={`${x.filename}: ${active ? x.active : x.value}`}
            >
              <span />
            </div>
            <small>{x.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
import StandaloneLogin from "./standalone-login";
import {IndependentDashboard,LifetimeAchievements} from "./modules/independent-views";
const nav = [["LITRIC V2", [
  ["dashboard", "Dashboard Analitik", LayoutDashboard],
  ["import", "Import Data AINS", Upload],
  ["murid", "Pengurusan Murid", Users],
  ["bintang", "Pencapaian Bintang NILAM", Star],
]]] as any;const pageTitles: any = Object.fromEntries(
  nav.flatMap(([, items]: any) => items.map(([id, label]: any) => [id, label])),
);

export default function Litric() {
  const [route, setRoute] = useState("dashboard"),
    [data, setData] = useState<any>(null),
    [error, setError] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [mobile, setMobile] = useState(false),
    [advanced, setAdvanced] = useState(false),
    [notifications, setNotifications] = useState(false),
    [search, setSearch] = useState(""),
    [theme, setTheme] = useState("light"),
    [contrast, setContrast] = useState(false),
    [filters, setFilters] = useState<any>({
      dataset: "AINS 2025 (label pengguna)",
      year: "",
      month: "",
      classId: "",
      student: "",
      language: "",
      category: "",
      source: "",
      verification: "",
    });
  useEffect(() => {
    const h = () => {
      const requested=location.hash.replace(/^#\/?/, "") || "dashboard";
      setRoute(["dashboard","import","murid","bintang"].includes(requested)||requested.startsWith("profil/") ? requested : "dashboard");
      setMobile(false);
    };
    h();
    addEventListener("hashchange", h);
    setTheme(localStorage.getItem("litric-theme") || localStorage.getItem("litrix-theme") || "light");
    return () => removeEventListener("hashchange", h);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("litric-theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.contrast = String(contrast);
  }, [contrast]);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api("state?" + query(filters));
      setData(d);
      setError(null);
    } catch (e: any) {
      setError(e);
      if (e.status === 401 || e.status === 403) setData(null);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 5500);
  };
  useEffect(() => {
    if (!isPages) return;
    const disconnected = () => {
      setData(null);
      setError(Object.assign(new Error("Sesi tamat. Sila log masuk semula."), {status: 401}));
    };
    const download = (event: MouseEvent) => {
      const a = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.origin !== location.origin || !a.pathname.startsWith("/api/")) return;
      event.preventDefault();
      downloadProtected(a.pathname + a.search).catch(e => notify(e.message));
    };
    document.addEventListener("click", download);
    window.addEventListener("litric:disconnected", disconnected);
    return () => {
      document.removeEventListener("click", download);
      window.removeEventListener("litric:disconnected", disconnected);
    };
  }, []);
  const mutate = async (path: string, p: any) => {
    setBusy(true);
    try {
      const r = await api(path, p);
      notify(
        r.duplicate
          ? "Fail ini telah diimport. Jumlah tidak ditambah."
          : "Perubahan disimpan.",
      );
      await refresh();
      return r;
    } catch (e: any) {
      notify(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const go = (id: string) => {
    location.hash = "/" + id;
  };
  const ctx = {
    data,
    filters,
    setFilters,
    refresh,
    mutate,
    busy,
    notify,
    go,
    search,
  };
  if (error && !data) return <StandaloneLogin error={error} onLogin={async()=>{go("dashboard");await refresh();}}/>;
  if (!data)
    return (
      <div className="boot">
        <Brand />
        <div className="spinner" />
        <p>Menyediakan ruang literasi anda…</p>
      </div>
    );
  const m = data.metrics,
    title = route.startsWith("profil/")
      ? "Profil Murid"
      : pageTitles[route] || "Dashboard Utama",
    isAdmin = data.user.role === "admin",
    isStudent = data.user.role === "student";
  const filteredNav = nav.map(([group, items]: any) => [
    group,
    items.filter(([id]: any) =>
      isAdmin || isStudent
        ? isAdmin || ["dashboard", "bintang"].includes(id)
        : !["import", "tetapan", "audit"].includes(id),
    ),
  ]);
  const result = search
    ? data.students
        .filter((s: any) => s.name.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 6)
    : [];
  return (
    <div className={"app " + (isStudent ? "student-mode" : "")}>
      <a className="skip-link" href="#main-content">
        Langkau ke kandungan
      </a>
      {mobile && (
        <div className="sidebar-overlay" onClick={() => setMobile(false)} />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a href="#/dashboard" className="brand-link">
          <Brand />
        </a>
        <div className="school-switch">
          <span className="school-icon">
            <GraduationCap size={20} />
          </span>
          <div>
            <b>SK Pendidikan Khas Taiping</b>
            <small>
              ABA6052 <i /> Ruang sekolah
            </small>
          </div>
        </div>
        <nav aria-label="Navigasi utama">
          {filteredNav.map(([group, items]: any) => (
            <div className="nav-group" key={group}>
              <span className="nav-label">{group}</span>
              {items.map(([id, label, Icon]: any) => (
                <a
                  key={id}
                  href={"#/" + id}
                  aria-current={route === id ? "page" : undefined}
                  className={"nav-item " + (route === id ? "active" : "")}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {id === "import" && isAdmin && (
                    <small>{data.import_batches.length}</small>
                  )}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="ecosystem">
            <Library size={19} />
            <span>
              Dalam ekosistem <b>LITRIC</b>
              <small>Every Progress Matters.</small>
            </span>
            <ArrowUpRight size={15} />
          </div>
          <div className="user-row">
            <span className="avatar admin">{initials(data.user.name)}</span>
            <div>
              <b>{data.user.name.split("@")[0]}</b>
              <small>
                {isAdmin ? "Pentadbir sekolah" : isStudent ? "Murid" : "Guru"}
              </small>
            </div>
            <a
              aria-label="Log keluar"
              href="#/dashboard"
              target="_top"
              onClick={(e)=>{e.preventDefault();logout().catch(()=>{});}}
            >
              <LogOut size={17} />
            </a>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Buka menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Ruang kerja</span>
            <ChevronRight size={14} />
            <b>{title}</b>
          </div>
          <div className="top-actions">
            <div className="global-search">
              <Search size={16} />
              <input
                aria-label="Cari murid"
                placeholder="Cari nama murid…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="icon-btn"
                  onClick={() => setSearch("")}
                  aria-label="Kosongkan carian"
                >
                  <X size={13} />
                </button>
              )}
              {search && (
                <div className="search-results">
                  {result.length ? (
                    result.map((s: any) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          go("profil/" + s.id);
                          setSearch("");
                        }}
                      >
                        {pretty(s.name)}
                        <ArrowUpRight size={14} />
                      </button>
                    ))
                  ) : (
                    <p>Tiada murid ditemui.</p>
                  )}
                </div>
              )}
            </div>
            <button
              className="icon-btn"
              title="Kontras tinggi"
              aria-label="Togol kontras tinggi"
              aria-pressed={contrast}
              onClick={() => setContrast(!contrast)}
            >
              <Accessibility size={18} />
            </button>
            <button
              className="icon-btn"
              aria-label="Tukar mod cerah atau gelap"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="notification-wrap">
              <button
                className="icon-btn bell"
                aria-label="Lihat notifikasi data"
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={18} />
                {m.unverified && <i />}
              </button>
              {notifications && (
                <div className="notification-menu">
                  <b>Perhatian data</b>
                  <p>
                    {m.unverified
                      ? "Pengesahan tempoh diperlukan sebelum pengiraan bintang."
                      : "Tiada tempoh belum disahkan dalam penapis ini."}
                  </p>
                  <p>{m.reviewCount} baris sumber memerlukan semakan.</p>
                  <button
                    className="text-btn"
                    onClick={() => {
                      go(isAdmin ? "import" : "murid");
                      setNotifications(false);
                    }}
                  >
                    Lihat butiran <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
            <span className="avatar top-avatar">
              {initials(data.user.name)}
            </span>
          </div>
        </header>
        <main id="main-content" className="content" tabIndex={-1}>
          {error && <div className="notice danger">{error.message}</div>}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                LITRIC / {isStudent ? "RUANG MURID" : "LITERACY INTELLIGENCE"}
              </div>
              <h1>{title}</h1>
              <p>
                {route === "dashboard"
                  ? "Pantau perkembangan, fahami bacaan, raikan pencapaian."
                  : route === "import"
                    ? "Urus sumber bacaan dengan skop dan jejak yang jelas."
                    : "Setiap langkah kecil membina kemajuan literasi."}
              </p>
            </div>
            <div className="heading-actions">
              {loading && <RefreshCw className="spin" size={18} />}
              <span className="date-label">
                <CalendarDays size={15} />
                {new Date().toLocaleDateString("ms-MY", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "Asia/Kuala_Lumpur",
                })}
              </span>
              {!isStudent && (
                <button className="btn" onClick={() => downloadProtected("/api/report?format=xlsx&"+query(filters)).catch(e=>notify(e.message))}>
                  <Download size={16} /> Eksport Laporan
                </button>
              )}
            </div>
          </div>
          {["dashboard", "analitik", "bintang", "laporan"].includes(route) && (
            <>
              <div className="filters">
                <label>
                  <span>Set data</span>
                  <select
                    aria-label="Set data"
                    value={filters.dataset}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        dataset: e.target.value,
                        year: "",
                        month: "",
                      })
                    }
                  >
                    <option value="">Semua set data</option>
                    {[
                      ...new Set(
                        data.import_batches
                          .filter((b: any) => b.status === "active")
                          .map((b: any) => b.dataset),
                      ),
                    ].map((s: any) => (
                      <option key={s}>{s}</option>
                    ))}
                    {!data.import_batches.length && (
                      <option>Belum ada set data</option>
                    )}
                  </select>
                </label>
                <label>
                  <span>Tahun pelaporan</span>
                  <select
                    aria-label="Tahun pelaporan"
                    value={filters.year}
                    onChange={(e) =>
                      setFilters({ ...filters, year: e.target.value })
                    }
                  >
                    <option value="">Semua dalam set data</option>
                    {[
                      ...new Set(
                        data.import_batches
                          .filter((b: any) => b.year)
                          .map((b: any) => b.year),
                      ),
                    ].map((y: any) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Kelas</span>
                  <select
                    aria-label="Kelas"
                    value={filters.classId}
                    onChange={(e) =>
                      setFilters({ ...filters, classId: e.target.value })
                    }
                  >
                    <option value="">Semua kelas</option>
                    {data.classes.map((c: any) => (
                      <option value={c.id} key={c.id}>
                        {c.name} · {c.year}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={"btn filter-btn " + (advanced ? "selected" : "")}
                  onClick={() => setAdvanced(!advanced)}
                >
                  <SlidersHorizontal size={16} /> Penapis{" "}
                  {Object.values(filters).filter(Boolean).length > 1 && (
                    <span className="count">
                      {Object.values(filters).filter(Boolean).length - 1}
                    </span>
                  )}
                </button>
              </div>
              {advanced && (
                <div className="advanced-filters">
                  {[
                    [
                      "month",
                      "Bulan",
                      [
                        ["", "Semua bulan"],
                        ...MONTHS.map((m: string, i: number) => [
                          String(i + 1),
                          m,
                        ]),
                      ],
                    ],
                    [
                      "student",
                      "Murid",
                      [
                        ["", "Semua murid"],
                        ...data.students.map((s: any) => [
                          s.id,
                          pretty(s.name),
                        ]),
                      ],
                    ],
                    [
                      "language",
                      "Bahasa",
                      [
                        ["", "Semua bahasa"],
                        ["bm", "Bahasa Melayu"],
                        ["eng", "Bahasa Inggeris"],
                        ["others", "Lain-lain"],
                      ],
                    ],
                    [
                      "category",
                      "Kategori",
                      [
                        ["", "Semua kategori"],
                        ["fiction", "Fiksyen"],
                        ["nonfiction", "Bukan fiksyen"],
                        ["digital", "Digital"],
                        ["nonbook", "Bukan buku"],
                      ],
                    ],
                    [
                      "source",
                      "Sumber",
                      [
                        ["", "Semua sumber"],
                        ["CSV", "CSV"],
                        ["XLSX", "Excel"],
                      ],
                    ],
                    [
                      "verification",
                      "Pengesahan",
                      [
                        ["", "Semua status"],
                        ["verified", "Disahkan"],
                        ["unverified", "Belum disahkan"],
                      ],
                    ],
                  ].map(([k, label, opts]: any) => (
                    <Field key={k} label={label}>
                      <select
                        value={filters[k]}
                        onChange={(e) =>
                          setFilters({ ...filters, [k]: e.target.value })
                        }
                      >
                        {opts.map(([v, l]: any) => (
                          <option value={v} key={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ))}
                </div>
              )}
            </>
          )}
          {route === "dashboard" ? (
            isStudent ? (
              <StudentHome ctx={ctx} />
            ) : (
              <IndependentDashboard ctx={ctx} />
            )
          ) : route === "import" ? (
            <><ImportCentre {...ctx} /><WorkspaceViews {...ctx} route="audit" /></>
          ) : route === "analitik" ? (
            <Analytics ctx={ctx} />
          ) : route === "bintang" ? (
            <LifetimeAchievements ctx={ctx} />
          ) : (
            <WorkspaceViews {...ctx} route={route} />
          )}
          <footer className="page-footer">
            <span>
              <span className="mini-brand">LITRIC</span> Every Read Counts.
              Every Progress Matters.
            </span>
            <span>© {new Date().getFullYear()} LITRIC · SK Pendidikan Khas Taiping</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Info size={18} />
          {toast}
          <button aria-label="Tutup notis" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy-indicator" role="status">
          <RefreshCw className="spin" size={16} /> Menyimpan…
        </div>
      )}
    </div>
  );
}
function Brand() {
  return (
    <div className="brand" title="Literacy Intelligence for Tracking, Reporting, Insights & Competency">
      <span className="brand-mark">
        <BookOpen size={24} />
        <i />
      </span>
      <div>
        LITRIC<small>LITERACY INTELLIGENCE</small>
      </div>
    </div>
  );
}
function BookArt() {
  return (
    <svg
      className="book-art"
      viewBox="0 0 260 170"
      fill="none"
      aria-hidden="true"
    >
      <ellipse
        cx="143"
        cy="149"
        rx="103"
        ry="14"
        fill="var(--deep)"
        opacity=".23"
      />
      <path d="M42 108l91-40 99 33-90 45z" fill="var(--light-purple)" />
      <path d="M42 108v12l100 37 90-45v-11l-90 45z" fill="var(--violet)" />
      <path d="M54 82l84-38 90 30-87 44z" fill="var(--gold)" />
      <path d="M54 82v16l87 34 87-44V74l-87 44z" fill="var(--gold-dark)" />
      <path
        d="M61 64c30-12 49-12 79 4 28-26 52-37 78-36l-2 45c-23 0-47 13-76 36-28-16-51-20-79-13z"
        fill="var(--light-purple)"
      />
      <path
        d="M61 64v36c28-7 51-3 79 13V68c-30-16-49-16-79-4z"
        fill="var(--surface)"
      />
      <path
        d="M140 68v45m-64-38c18-3 31 0 47 7m-47 7c18-3 31 0 47 7m37-28c13-12 24-18 39-22m-39 35c13-12 24-18 39-22"
        stroke="var(--chart-secondary)"
        strokeWidth="2"
      />
      <path d="M111 57v31l9-3 8 8V60" fill="var(--violet)" />
      <path d="M42 36l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z" fill="var(--gold)" />
      <circle cx="218" cy="116" r="4" fill="var(--chart-secondary)" />
      <circle cx="229" cy="49" r="3" fill="var(--gold)" />
    </svg>
  );
}
function Kpi({ title, value, sub, icon: Icon, accent = "green" }: any) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span>{title}</span>
        <span className={"kpi-icon " + accent}>
          <Icon size={19} />
        </span>
      </div>
      <strong>
        {value == null
          ? "—"
          : fmt(value, typeof value === "number" && value % 1 ? 1 : 0)}
      </strong>
      <small>{sub}</small>
    </div>
  );
}
export function Dashboard({ ctx }: any) {
  const { data, go } = ctx,
    m = data.metrics;
  const top = m.students.slice(0, 5),
    languages = m.languages,
    languageTotal = languages.every((x: any) => x.value != null)
      ? languages.reduce((n: any, x: any) => n + x.value, 0)
      : null,
    bm = languageTotal ? (languages[0].value / languageTotal) * 100 : 0,
    eng = languageTotal ? (languages[1].value / languageTotal) * 100 : 0;
  return (
    <>
      <section className="welcome-banner">
        <div>
          <span className="welcome-kicker">
            <i /> RUANG LITERASI SEKOLAH
          </span>
          <h2>
            Daripada bacaan,
            <br />
            <em>terbina masa depan.</em>
          </h2>
          <p>Kenali setiap kemajuan. Bimbing setiap potensi.</p>
          <button className="banner-link" onClick={() => go("murid")}>
            Lihat perkembangan murid <ArrowRight size={16} />
          </button>
        </div>
        <div className="welcome-right">
          <div className="school-stamp">
            <GraduationCap size={18} />
            <span>
              SK Pendidikan Khas Taiping<small>ABA6052 · PERAK</small>
            </span>
          </div>
          <BookArt />
          <span className="banner-index">01 — LITERASI UNTUK SEMUA</span>
        </div>
      </section>
      <div className="scope-line">
        <span>
          <span className="live-dot" />
          {ctx.filters.dataset}
        </span>
        <span className={m.unverified ? "amber-text" : "green-text"}>
          <ShieldCheck size={14} />
          {m.unverified
            ? "Tempoh belum disahkan"
            : m.batches.length
              ? "Skop disahkan"
              : "Tiada data dalam penapis"}
        </span>
        <small>{m.batches.length} fail sumber</small>
      </div>
      <div className="kpis">
        <Kpi
          title="Jumlah Murid"
          value={m.students.length}
          sub="Identiti unik dalam sumber terpilih"
          icon={Users}
        />
        <Kpi
          title="Murid Aktif Membaca"
          value={m.active}
          sub="Ada bacaan dalam fail sumber"
          icon={BookOpen}
          accent="cyan"
        />
        <Kpi
          title="Bacaan Diluluskan"
          value={m.reported}
          sub={
            m.unverified
              ? "Dilaporkan sumber · belum disahkan"
              : "Mengikut penapis sumber"
          }
          icon={BookMarked}
        />
        <Kpi
          title="Purata Setiap Murid"
          value={m.average}
          sub={`${fmt(m.rejected)} bacaan dilaporkan ditolak`}
          icon={ChartNoAxesCombined}
          accent="gold"
        />
      </div>
      {m.unverified && (
        <div className="notice">
          <Info size={18} />
          <p>
            <b>Semak skop sebelum menilai pencapaian.</b> Tahun dan jenis
            agregat belum disahkan. Jumlah sumber tidak digunakan untuk
            pengiraan bintang.
          </p>
          <button
            onClick={() =>
              go(data.user.role === "admin" ? "audit" : "analitik")
            }
          >
            Semak data <ArrowRight size={14} />
          </button>
        </div>
      )}
      <div className="dashboard-grid">
        <Panel
          title="Jejak bacaan"
          sub={
            m.monthly.length
              ? "Jumlah dilaporkan mengikut fail sumber"
              : "Liputan masa berdasarkan data yang tersedia"
          }
          action={
            <Pill tone="neutral">
              {m.monthly.length
                ? "Jan–Jul · tahun belum disahkan"
                : "Tempoh belum disahkan"}
            </Pill>
          }
        >
          <div className="chart-legend">
            <i /> Bacaan diluluskan dalam sumber <span>BAHAN BACAAN</span>
          </div>
          {m.monthly.length ? (
            <SourceBars items={m.monthly} />
          ) : (
            <div className="single-scope">
              <div className="scope-number">
                {fmt(m.reported)}
                <small>bahan dilaporkan</small>
              </div>
              <div className="scope-illustration">
                <BookOpen size={48} strokeWidth={1} />
                <span>Ringkasan satu eksport</span>
                <p>
                  Tarikh laporan tiada dalam fail.
                  <br />
                  Carta bulanan menunggu bukti tempoh.
                </p>
              </div>
            </div>
          )}
          <div className="panel-foot">
            <Info size={13} />
            {m.monthly.length
              ? "Bulan mengikut nama fail. Nilai ini belum membuktikan aktiviti bulanan."
              : "Bulan yang tiada rekod tidak ditunjukkan sebagai sifar."}
          </div>
        </Panel>
        <Panel
          title="Bahasa bacaan"
          sub="Agihan dalam sumber terpilih"
          action={
            <span className="small-icon">
              <BookOpen size={17} />
            </span>
          }
        >
          <div className="donut-wrap">
            <div
              className="donut"
              style={{
                background: languageTotal
                  ? `conic-gradient(var(--emerald) 0 ${bm}%, var(--chart-secondary) ${bm}% ${bm + eng}%, var(--gold) ${bm + eng}% 100%)`
                  : "var(--line)",
              }}
            >
              <div>
                <b>{fmt(languageTotal)}</b>
                <small>bahan bacaan</small>
              </div>
            </div>
          </div>
          <div className="donut-legend">
            {languages.map((x: any, i: number) => (
              <div key={x.key}>
                <span>
                  <i
                    style={{
                      background: ["var(--emerald)", "var(--chart-secondary)", "var(--gold)"][i],
                    }}
                  />
                  {["Bahasa Melayu", "Bahasa Inggeris", "Lain-lain"][i]}
                </span>
                <b>
                  {fmt(x.value)}{" "}
                  <small>
                    {languageTotal
                      ? Math.round((x.value / languageTotal) * 100)
                      : 0}
                    %
                  </small>
                </b>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Perkembangan murid"
          sub="Bacaan dilaporkan dalam set data terpilih"
          action={
            <button className="text-btn" onClick={() => go("murid")}>
              Semua murid <ArrowRight size={15} />
            </button>
          }
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>MURID</th>
                  <th>KELAS</th>
                  <th>BACAAN</th>
                  <th>STATUS BINTANG</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {top.map((s: any, i: number) => (
                  <tr key={s.id} onClick={() => go("profil/" + s.id)}>
                    <td>
                      <div className="name-cell">
                        <span className={"avatar color-" + i}>
                          {initials(s.name)}
                        </span>
                        <span>
                          <b>{pretty(s.name)}</b>
                          <small>ID {s.id.slice(0, 8)}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {data.classes.find((c: any) => c.id === s.class_id)
                        ?.name || (
                        <span className="muted">Belum dipetakan</span>
                      )}
                    </td>
                    <td>
                      <b>{fmt(s.reported)}</b>
                    </td>
                    <td>
                      <Pill tone={s.achievement.level ? "gold" : "neutral"}>
                        {s.achievement.level == null
                          ? "Menunggu pengesahan"
                          : s.achievement.level
                            ? `${s.achievement.level} Bintang`
                            : "Belum Mencapai 1 Bintang"}
                      </Pill>
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        aria-label={"Profil " + s.name}
                        onClick={() => go("profil/" + s.id)}
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!top.length && (
            <Empty title="Tiada rekod dalam penapis ini">
              Ubah penapis untuk melihat murid.
            </Empty>
          )}
        </Panel>
        <Panel title="Ruang pencapaian" sub="Setiap kemajuan wajar diraikan">
          <div className="milestone-preview">
            <Badge level={1} locked />
            <div>
              <b>
                Langkah pertama,
                <br />
                144 bahan bacaan.
              </b>
              <p>Satu bintang membuka perjalanan pencapaian NILAM.</p>
            </div>
          </div>
          <div className="stat-split">
            <div>
              <b>{fmt(m.eligibleStudents)}</b>
              <small>Murid dengan skop layak</small>
            </div>
            <div>
              <b>{m.inactive == null ? "—" : m.inactive}</b>
              <small>Belum aktif dalam tempoh lengkap</small>
            </div>
          </div>
          <button className="btn full" onClick={() => go("bintang")}>
            Terokai pencapaian <ArrowRight size={16} />
          </button>
        </Panel>
      </div>
      <Panel title="Tindakan seterusnya" className="actions-panel">
        <div className="quick-actions">
          {[
            [
              Upload,
              "Sahkan sumber data",
              "Semak tempoh dan baris yang bertindih.",
              "import",
            ],
            [
              Target,
              "Urus rekod murid",
              "Semak profil dan perkembangan bacaan.",
              "murid",
            ],
            [
              BookOpen,
              "Raikan bintang NILAM",
              "Lihat pencapaian dan kemajuan murid.",
              "bintang",
            ],
          ].map(([Icon, title, sub, page]: any) => (
            <button
              key={page}
              onClick={() =>
                go(
                  data.user.role === "admin"
                    ? page
                    : page === "import"
                      ? "murid"
                      : page,
                )
              }
            >
              <span>
                <Icon size={22} />
              </span>
              <div>
                <b>{title}</b>
                <p>{sub}</p>
              </div>
              <ArrowUpRight size={17} />
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}
export function Analytics({ ctx }: any) {
  const { data } = ctx,
    m = data.metrics;
  const yearly = [
    ...new Set(
      data.import_batches.filter((b: any) => b.year).map((b: any) => b.year),
    ),
  ].map((year) => {
    const x = aggregate({
      students: data.students,
      rows: data.ains_summaries,
      batches: data.import_batches,
      rule: data.rule,
      filters: { dataset: ctx.filters.dataset, year: String(year) },
    });
    return { year, ...x };
  });
  return (
    <>
      <div className="notice">
        <Info size={18} />
        <p>
          Perbandingan hanya bermakna apabila liputan dan jenis agregat sepadan.
          Ketiadaan rekod tidak membuktikan murid tidak membaca.
        </p>
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Corak bacaan sumber"
          sub="Bulan berdasarkan fail yang dibekalkan"
        >
          {m.monthly.length ? (
            <SourceBars items={m.monthly} />
          ) : (
            <Empty title="Trend bulanan belum tersedia">
              Sumber ini tidak mempunyai tarikh aktiviti.
            </Empty>
          )}
        </Panel>
        <Panel
          title="Murid aktif mengikut fail"
          sub="Identiti dengan sekurang-kurangnya satu bacaan"
        >
          {m.monthly.length ? (
            <SourceBars items={m.monthly} active />
          ) : (
            <Empty icon={Users} title="Tempoh tidak tersedia">
              Tiada siri bulanan yang disahkan.
            </Empty>
          )}
        </Panel>
        <Panel title="Agihan bintang NILAM" sub="Hanya bacaan dalam skop layak">
          <div className="horizontal-bars">
            {m.starDistribution.map((x: any) => (
              <div key={x.level}>
                <div>
                  <span>
                    {x.level ? x.level + " Bintang" : "Belum Mencapai 1 Bintang"}
                  </span>
                  <b>{x.count} murid</b>
                </div>
                <progress
                  max={Math.max(1, m.students.length)}
                  value={x.count}
                />
              </div>
            ))}
          </div>
          <div className="panel-foot">
            {m.students.filter((s: any) => s.achievement.level == null).length}{" "}
            murid menunggu pengesahan skop.
          </div>
        </Panel>
        <Panel
          title="Perbandingan kelas"
          sub="Jumlah, purata dan kadar aktif mengikut saiz kelas"
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Kelas</th>
                  <th>Murid</th>
                  <th>Jumlah</th>
                  <th>Purata</th>
                  <th>Aktif</th>
                  <th>Bintang</th>
                </tr>
              </thead>
              <tbody>
                {m.classGroups.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      {data.classes.find((x: any) => x.id === c.id)?.name ||
                        "Belum dipetakan"}
                    </td>
                    <td>{c.count}</td>
                    <td>{c.total}</td>
                    <td>{fmt(c.average, 1)}</td>
                    <td>
                      {fmt(
                        c.active == null ? null : (c.active / c.count) * 100,
                        0,
                      )}
                      %
                    </td>
                    <td>{c.stars}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-foot">
            Perbandingan kelas memerlukan pemetaan kelas dan liputan yang
            sepadan.
          </div>
        </Panel>
        <Panel title="Kategori bahan bacaan" sub="Komponen dilaporkan sumber">
          <div className="horizontal-bars">
            {m.categories.map((c: any) => (
              <div key={c.key}>
                <div>
                  <span>
                    {
                      (
                        {
                          fiction: "Fiksyen",
                          nonfiction: "Bukan fiksyen",
                          digital: "Digital",
                          nonbook: "Bukan buku",
                        } as Record<string, string>
                      )[c.key]
                    }
                  </span>
                  <b>{fmt(c.value)}</b>
                </div>
                <progress max={Math.max(1, m.reported)} value={c.value} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Sejarah mengikut tahun"
          sub="Tahun tidak digabung secara automatik"
        >
          {yearly.length ? (
            <>
              <SourceBars
                items={yearly.map((y: any) => ({
                  id: y.year,
                  label: String(y.year),
                  value: y.reported,
                  filename: String(y.year),
                }))}
              />
              <table>
                <thead>
                  <tr>
                    <th>Tahun</th>
                    <th>Dilaporkan</th>
                    <th>Layak</th>
                    <th>Skop</th>
                  </tr>
                </thead>
                <tbody>
                  {yearly.map((y: any) => (
                    <tr key={y.year}>
                      <td>{y.year}</td>
                      <td>{y.reported}</td>
                      <td>{y.eligible ?? "—"}</td>
                      <td>{y.unverified ? "Belum disahkan" : "Disahkan"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <Empty icon={CalendarDays} title="Tahun pelaporan belum disahkan">
              Sahkan tahun daripada bukti sumber sebelum membandingkan tahun.
            </Empty>
          )}
        </Panel>
        <Panel
          title="Pemerhatian berasaskan data"
          sub="Hanya kesimpulan yang disokong sumber"
        >
          <div className="insight-list">
            {explainInsights(m).map((message: string) => (
              <p key={message}>
                <ChartNoAxesCombined size={20} />
                <span>{message}</span>
              </p>
            ))}
            <p>
              <ShieldCheck size={20} />
              <span>
                {m.unverified
                  ? "Pengesahan skop diperlukan sebelum mengesan kemerosotan atau peningkatan bulanan."
                  : "Pengiraan bintang menggunakan baris diterima dan skop yang disahkan."}
              </span>
            </p>
            <p>
              <Users size={20} />
              <span>
                {m.active} daripada {m.students.length} murid mempunyai bacaan
                dalam eksport terpilih. Ini bukan ukuran kehadiran.
              </span>
            </p>
            <p>
              <Info size={20} />
              <span>
                {m.reviewCount} baris memerlukan semakan. {m.blocked.length}{" "}
                identiti dikecualikan daripada pengiraan kerana pertindihan.
              </span>
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
export function Achievements({ ctx }: any) {
  const { data } = ctx,
    m = data.metrics;
  return (
    <>
      <div className="achievement-hero">
        <span className="eyebrow">GALERI PENCAPAIAN NILAM</span>
        <h2>Usaha kecil. Pencapaian bermakna.</h2>
        <p>
          Kenali lima tahap bintang dan langkah menuju pencapaian seterusnya.
        </p>
      </div>
      <div className="badge-gallery">
        {data.rule.thresholds.map((n: number, i: number) => (
          <div className="badge-card" key={i}>
            <Badge level={i + 1} />
            <b>
              {fmt(n)}
              {i === 4 ? "+" : ""} bahan
            </b>
            <p>{data.rule.marks[i]} markah PAJSK peringkat sekolah</p>
            <small>
              {data.rule.certified
                ? "Rujukan disahkan pentadbir"
                : "Peraturan sekolah · belum disahkan rasmi"}
            </small>
          </div>
        ))}
      </div>
      <div className="notice">
        <ShieldCheck size={18} />
        <p>
          Bintang dikira daripada bacaan diluluskan dalam skop layak. Bawah{" "}
          {data.rule.thresholds[0]} bahan: <b>Belum layak</b> untuk markah
          PAJSK.
        </p>
      </div>
      <Panel
        title="Pencapaian murid"
        sub={
          m.unverified
            ? "Pengesahan tempoh diperlukan sebelum bintang diberikan"
            : "Mengikut skop terpilih"
        }
      >
        <div className="achievement-students">
          {m.students.map((s: any) => (
            <button key={s.id} onClick={() => ctx.go("profil/" + s.id)}>
              <span className="avatar">{initials(s.name)}</span>
              <div>
                <b>{pretty(s.name)}</b>
                <p>
                  {s.achievement.level == null
                    ? "Tempoh belum disahkan"
                    : s.achievement.level === 5
                      ? "TAHNIAH! ANDA TELAH MENCAPAI 5 BINTANG NILAM!"
                      : `${s.achievement.remaining} bahan lagi menuju ${s.achievement.level + 1} Bintang`}
                </p>
                <progress max={100} value={s.achievement.progress} />
              </div>
              <span>
                {s.achievement.level == null ? (
                  <Lock size={20} />
                ) : (
                  <>
                    <Star size={20} fill="currentColor" />
                    {s.achievement.level}
                  </>
                )}
              </span>
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}

function StudentHome({ ctx }: any) {
  const { data, go } = ctx,
    s = data.metrics.students[0],
    a = s?.achievement || { level: null, progress: 0 };
  return (
    <>
      <div className="achievement-hero">
        <span className="eyebrow">RUANG MURID</span>
        <h2>
          Selamat membaca,{" "}
          {pretty(data.students[0]?.name?.split(" ")[0] || "rakan pembaca")}!
        </h2>
        <p>Jom terokai bacaan dan lihat kemajuan anda bersama guru.</p>
      </div>
      <div className="kpis">
        <Kpi
          title="Bacaan dalam sumber"
          value={s?.reported ?? 0}
          sub="Mengikut set data terpilih"
          icon={BookOpen}
        />
        <Kpi
          title="Bacaan bersama guru"
          value={
            data.school_reading_entries.filter(
              (r: any) => r.completion === "complete",
            ).length
          }
          sub="Rekod Bacaan Sekolah"
          icon={GraduationCap}
        />
        <Kpi
          title="Bintang dicapai"
          value={a.level}
          sub={
            a.level == null
              ? "Menunggu pengesahan guru"
              : "Teruskan usaha membaca"
          }
          icon={Star}
        />
        <Kpi
          title="Bahan menuju bintang seterusnya"
          value={a.remaining}
          sub={
            a.level === 5
              ? "Tahniah, 5 Bintang!"
              : "Setiap bacaan membawa kemajuan"
          }
          icon={Target}
        />
      </div>
      <Panel title="Bintang saya">
        <div className="profile-badges">
          {[1, 2, 3, 4, 5].map((n) => (
            <Badge key={n} level={n} locked={a.level == null || a.level < n} />
          ))}
        </div>
        <div className="progress-label">
          <b>
            {a.level == null
              ? "Guru akan mengesahkan tempoh bacaan anda."
              : a.level === 5
                ? "TAHNIAH! ANDA TELAH MENCAPAI 5 BINTANG NILAM!"
                : a.remaining + " bahan lagi ke bintang seterusnya"}
          </b>
        </div>
        <progress max={100} value={a.progress} />
        {data.students[0] && (
          <button
            className="btn full"
            onClick={() => go("profil/" + data.students[0].id)}
          >
            Lihat perjalanan saya <ArrowRight size={20} />
          </button>
        )}
      </Panel>
      <Panel title="Sasaran saya">
        <div className="list-records">
          {data.reading_targets.map((t: any) => (
            <div key={t.id}>
              <Target size={25} />
              <div>
                <b>{t.title}</b>
                <p>
                  {t.target} bahan · {t.start} hingga {t.end}
                </p>
              </div>
            </div>
          ))}
        </div>
        {!data.reading_targets.length && (
          <Empty icon={Target} title="Baca bersama guru">
            Guru boleh membantu anda menetapkan sasaran pertama.
          </Empty>
        )}
      </Panel>
    </>
  );
}
