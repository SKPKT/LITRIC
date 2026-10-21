"use client";
import {useEffect, useState} from "react";
import {BookOpen, ShieldCheck} from "lucide-react";
import {BRIDGE_PROTOCOL, MAX_BODY, MAX_RESPONSE, allowedParent, trustedMessage, validApiPath} from "../../lib/bridge-policy.mjs";
export default function BackendBridge() {
  const [message, setMessage] = useState("Mengesahkan sambungan…");
  const [login, setLogin] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(location.search), origin = query.get("origin") || "", channel = query.get("channel") || "", peer = window.opener;
    if (!peer || !allowedParent(origin, location.origin) || !/^[a-f0-9-]{36}$/.test(channel)) {
      setMessage("Buka sambungan ini melalui butang log masuk LITRIC. Jika log masuk memutuskan sambungan, kembali ke LITRIC dan tekan Sambungkan semula.");
      return;
    }
    let active = true, requests = 0;
    const seen = new Set<string>();
    const send = (payload: any, transfer: Transferable[] = []) => peer.postMessage({protocol: BRIDGE_PROTOCOL, channel, ...payload}, origin, transfer);
    const listener = async (event: MessageEvent) => {
      if (!trustedMessage(event, peer, origin, channel, "request")) return;
      const m = event.data;
      if (typeof m.id !== "string" || m.id.length > 64 || seen.has(m.id) || !validApiPath(m.path, m.method) || requests >= 8) return;
      seen.add(m.id); if (seen.size > 1000) seen.delete(seen.values().next().value!);
      requests++;
      try {
        let body: any = undefined;
        const headers: Record<string,string> = {};
        if (m.method === "POST") {
          if (m.form) {
            if (m.path !== "/api/file" || !Array.isArray(m.form) || m.form.length > 10) throw new Error("Borang tidak sah.");
            let size = 0; body = new FormData();
            for (const entry of m.form) {
              if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || !(typeof entry[1] === "string" || entry[1] instanceof Blob)) throw new Error("Borang tidak sah.");
              size += typeof entry[1] === "string" ? entry[1].length : entry[1].size;
              if (size > MAX_BODY) throw new Error("Bukti terlalu besar.");
              body.append(entry[0], entry[1]);
            }
          } else {
            if (typeof m.body !== "string" || new TextEncoder().encode(m.body).length > MAX_BODY) throw new Error("Permintaan terlalu besar atau tidak sah.");
            JSON.parse(m.body); body = m.body; headers["Content-Type"] = "application/json";
          }
        }
        const r = await fetch(m.path, {method: m.method, body, headers, cache: "no-store", credentials: "same-origin", redirect: "error"});
        const chunks: Uint8Array[] = []; let size = 0;
        const reader = r.body?.getReader();
        if (reader) while (true) {
          const {done, value} = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > MAX_RESPONSE) { await reader.cancel(); throw new Error("Fail melebihi had sambungan 32 MB. Gunakan aplikasi backend."); }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        const h: Record<string,string> = {};
        for (const name of ["content-type", "content-disposition"]) { const v = r.headers.get(name); if (v) h[name] = v; }
        if (active) send({type: "response", id: m.id, status: r.status, headers: h, bytes: bytes.buffer}, [bytes.buffer]);
      } catch {
        if (active) send({type: "response", id: m.id, error: "Permintaan tidak berjaya. Semak sesi backend atau gunakan aplikasi backend secara terus."});
      } finally { requests--; }
    };
    fetch("/api/state", {cache: "no-store", credentials: "same-origin", redirect: "error"}).then(async r => {
      if (!r.ok) { setLogin(r.status === 401); throw Object.assign(new Error((await r.json() as any).error || "Akses diperlukan."), {status: r.status}); }
      if (!active) return;
      // Discard the check response; all data still travels through authorized API requests.
      window.addEventListener("message", listener);
      setMessage("Disambungkan dengan selamat. Kembali ke LITRIC dan biarkan tetingkap ini terbuka sepanjang penggunaan.");
      send({type: "ready"});
    }).catch(e => {
      if (!active) return;
      setMessage(e.message || "Log masuk diperlukan."); setLogin(true);
      send({type: "ready", error: "Sila log masuk pada backend, kemudian sambungkan semula LITRIC.", status: e.status || 401});
    });
    return () => { active = false; window.removeEventListener("message", listener); };
  }, []);
  return <main className="bridge-shell"><div className="brand"><BookOpen/> LITRIC</div><ShieldCheck size={44} className="green-text"/><h1>Sambungan sekolah selamat</h1><p role="status">{message}</p>{login && <a className="btn primary" target="_top" href={"/signin-with-chatgpt?return_to=" + encodeURIComponent(typeof location !== "undefined" ? location.pathname + location.search : "/bridge")}>Log masuk dengan ChatGPT</a>}<p><a href="/" target="_blank" rel="noreferrer">Buka aplikasi backend</a></p><small>Every Read Counts. Every Progress Matters.</small></main>;
}
