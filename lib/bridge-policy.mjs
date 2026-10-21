// The Pages owner controls every site on this origin. Paths are not security boundaries.
export const PAGES_ORIGIN = "https://skpkt.github.io";
export const BRIDGE_PROTOCOL = "litric-v1";
export const MAX_BODY = 12 * 1024 * 1024;
export const MAX_RESPONSE = 32 * 1024 * 1024;
const reads = new Set(["state", "certificate/pdf", "certificate/verify", "report", "errors", "source", "file", "backup", "smartlib"]);
const writes = new Set(["seed", "import/preview", "import/commit", "batch/rollback", "batch/restore", "batch/verify", "row/resolve", "student", "class", "identity/merge", "identity/undo", "observation", "target", "reading", "reading/reconcile", "programme", "settings", "rules", "user", "certificate", "certificate/revoke", "book/save", "file"]);
export function allowedParent(origin, backendOrigin) {
  if (origin === PAGES_ORIGIN) return true;
  // Local QA is allowed only when BOTH windows are local.
  try {
    const a = new URL(origin), b = new URL(backendOrigin);
    return [a,b].every(u => ["localhost", "127.0.0.1"].includes(u.hostname) && u.protocol === "http:") && a.port === "4173";
  } catch { return false; }
}
export function validApiPath(path, method = "GET") {
  if (typeof path !== "string" || path.length > 8192 || !/^\/api\/[a-z0-9/]+(?:\?[^#]*)?$/.test(path) || path.includes("\\")) return false;
  const name = path.slice(5).split("?")[0];
  return (method === "GET" ? reads : method === "POST" ? writes : new Set()).has(name);
}
export function trustedMessage(event, peer, origin, channel, type) {
  return event.source === peer && event.origin === origin && event.data?.protocol === BRIDGE_PROTOCOL && event.data?.channel === channel && event.data?.type === type;
}
