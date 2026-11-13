import React, { useEffect, useState } from "react";
import { Eye, EyeOff, BookOpen } from "lucide-react";
import { login, changePassword, backendOrigin } from "../lib/client-api";
export default function StandaloneLogin({ onLogin, error }: any) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [next, setNext] = useState(""),
    [confirm, setConfirm] = useState(""),
    [show, setShow] = useState(false),
    [temporary, setTemporary] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(backendOrigin + "/health", { credentials: "omit", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Health unavailable");
        const health = await response.json() as { ok?: boolean; loginEnabled?: boolean } | null;
        if (!health?.ok || typeof health.loginEnabled !== "boolean") throw new Error("Invalid health");
        setAvailable(health.loginEnabled);
      })
      .catch(() => { if (!controller.signal.aborted) setUnreachable(true); });
    return () => controller.abort();
  }, []);
  return (
    <main className="login-shell">
      <section className="login-art">
        <div className="brand">
          <span className="brand-mark">
            <BookOpen size={28} />
          </span>
          LITRIC
        </div>
        <div>
          <span className="eyebrow">RUANG LITERASI SEKOLAH</span>
          <h1>
            Setiap bacaan,
            <br />
            <em>satu kemajuan.</em>
          </h1>
          <p>
            Every Read Counts.
            <br />
            Every Progress Matters.
          </p>
        </div>
        <small>SK Pendidikan Khas Taiping · ABA6052</small>
      </section>
      <section className="login-content">
        <span className="eyebrow">LITRIC · AKAUN SEKOLAH</span>
        <h2>
          {temporary
            ? "Tukar kata laluan sementara"
            : "Selamat datang ke LITRIC"}
        </h2>
        <p>
          Literacy Intelligence for Tracking, Reporting, Insights &amp;
          Competency
        </p>
        {available === false && <p role="status">Versi rintis: log masuk belum diaktifkan. Rekod murid belum tersedia dalam versi ini.</p>}
        {unreachable && <p role="alert">Pelayan belum dapat dihubungi. Sila muat semula halaman.</p>}
        <form
          className="standalone-login"
          onSubmit={async (e) => {
            e.preventDefault();
            if (available !== true) return;
            setBusy(true);
            setMessage("");
            try {
              if (temporary) {
                if (next !== confirm)
                  throw new Error("Pengesahan kata laluan tidak sepadan.");
                await changePassword(password, next);
                setTemporary(false);
                setPassword("");
                setNext("");
                setConfirm("");
                setMessage("Kata laluan ditukar. Sila log masuk semula.");
              } else {
                const r = await login(username, password);
                if (r.mustChange) setTemporary(true);
                else {
                  setPassword("");
                  await onLogin();
                }
              }
            } catch (e: any) {
              setMessage(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {!temporary && (
            <label>
              Nama pengguna
              <input
                autoComplete="username"
                disabled={available !== true}
                required
                maxLength={64}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
          )}
          {!temporary && (
            <label>
              Kata laluan
              <div className="password-field">
                <input
                  autoComplete="current-password"
                  disabled={available !== true}
                  required
                  maxLength={128}
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={
                    show ? "Sembunyikan kata laluan" : "Tunjukkan kata laluan"
                  }
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </label>
          )}
          {temporary && (
            <>
              <p>
                Untuk melindungi rekod murid, pilih kata laluan baharu sebelum
                meneruskan.
              </p>
              <label>
                Kata laluan baharu
                <input
                  required
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
              </label>
              <label>
                Sahkan kata laluan baharu
                <input
                  required
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
            </>
          )}
          <p role="alert" aria-live="polite">
            {message || (error?.status !== 401 ? error?.message : "")}
          </p>
          <button disabled={busy || available !== true} className="btn primary full">
            {available === false ? "Log masuk belum diaktifkan" : available === null ? "Menyemak pelayan…" : busy
              ? "Sila tunggu…"
              : temporary
                ? "Simpan kata laluan"
                : "Log masuk"}
          </button>
        </form>
        <small>
          {available === false ? "Rintis sahaja · Akses modul memerlukan login yang diaktifkan." : "Akaun sekolah · Sesi tamat selepas 30 minit. Log masuk semula selepas memuat semula halaman."}
        </small>
      </section>
    </main>
  );
}
