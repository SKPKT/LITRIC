import { BRIDGE_PROTOCOL, validApiPath, trustedMessage } from "./bridge-policy.mjs";
declare const __LITRIC_PAGES__: boolean;
declare const __LITRIC_BACKEND__: string;
export const isPages = typeof __LITRIC_PAGES__ !== "undefined" && __LITRIC_PAGES__;
export const backendOrigin = typeof __LITRIC_BACKEND__ !== "undefined" ? __LITRIC_BACKEND__ : "";
let peer: Window | null = null;
let channel = "";
let ready = false;
let connecting: Promise<void> | null = null;
let watcher: ReturnType<typeof setInterval> | undefined;
const pending = new Map<string, {resolve: (r: Response) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>}>();
const authError = () => Object.assign(new Error("Sambungkan tetingkap backend dan log masuk untuk meneruskan."), {status: 401});
export function disconnectBackend() {
  ready = false;
  if (watcher) clearInterval(watcher);
  watcher = undefined;
  for (const p of pending.values()) { clearTimeout(p.timer); p.reject(authError()); }
  pending.clear();
  if (peer && !peer.closed) peer.close();
  peer = null;
  if (typeof window !== "undefined") window.dispatchEvent?.(new Event("litric:disconnected"));
}
export function connectBackend(): Promise<void> {
  if (!isPages) return Promise.resolve();
  if (connecting) { peer?.focus(); return connecting; }
  if (ready && peer && !peer.closed) return Promise.resolve();
  disconnectBackend();
  channel = crypto.randomUUID();
  connecting = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => finish(authError()), 180000);
    const listen = (event: MessageEvent) => {
      if (!trustedMessage(event, peer, backendOrigin, channel, "ready")) return;
      if (event.data.error) return finish(Object.assign(new Error(event.data.error), {status: event.data.status || 401}));
      ready = true;
      watcher = setInterval(() => { if (!peer || peer.closed) disconnectBackend(); }, 1000);
      finish();
    };
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      window.removeEventListener("message", listen);
      connecting = null;
      error ? reject(error) : resolve();
    };
    window.addEventListener("message", listen);
    // Called only by a user click; keep this window open for same-origin authenticated requests.
    peer = window.open(`${backendOrigin}/bridge?channel=${channel}&origin=${encodeURIComponent(location.origin)}`, "litric-backend", "popup,width=520,height=660");
    if (!peer) finish(new Error("Pelayar menyekat tetingkap sambungan. Benarkan pop-up untuk LITRIC."));
  });
  return connecting.finally(() => { connecting = null; });
}
if (typeof window !== "undefined" && isPages) {
  window.addEventListener("message", (event) => {
    if (!trustedMessage(event, peer, backendOrigin, channel, "response")) return;
    const p = pending.get(event.data.id);
    if (!p) return;
    pending.delete(event.data.id); clearTimeout(p.timer);
    if (event.data.error) p.reject(new Error(event.data.error));
    else {
      if (event.data.status === 401) disconnectBackend();
      p.resolve(new Response(event.data.bytes, {status: event.data.status, headers: event.data.headers}));
    }
  });
  window.addEventListener("pagehide", disconnectBackend);
}
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  if (!validApiPath(path, method)) throw new Error("Laluan API tidak dibenarkan.");
  if (!isPages) return fetch(path, {...init, credentials: "same-origin", cache: "no-store"});
  if (!ready || !peer || peer.closed) { ready = false; throw authError(); }
  let body: any = init.body;
  let form: any[] | undefined;
  if (body instanceof FormData) { form = [...body.entries()]; body = undefined; }
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(authError()); }, 120000);
    pending.set(id, {resolve, reject, timer});
    try {
      peer!.postMessage({protocol: BRIDGE_PROTOCOL, type: "request", channel, id, path, method, body, form}, backendOrigin);
    } catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
}
export async function downloadProtected(path: string) {
  const r = await apiFetch(path);
  if (!r.ok) throw Object.assign(new Error((await r.json() as any).error || "Muat turun tidak berjaya."), {status: r.status});
  const blob = await r.blob();
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url;
  a.download = r.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || "LITRIC-fail";
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
