import { DurableObject, env } from "cloudflare:workers";
import { GET as api } from "../app/api/[...path]/route";
import { authEndpoint } from "../lib/standalone-auth.mjs";
import { bootstrapEndpoint } from "../lib/standalone-bootstrap.mjs";
const readPaths = new Set(["state", "report", "backup", "errors", "source"]);
const writePaths = new Set([
  "import/commit",
  "import/preview",
  "batch/verify",
  "batch/rollback",
  "batch/restore",
  "row/resolve",
  "student",
  "student/archive",
  "class",
  "identity/merge",
  "identity/undo",
  "rules",
  "observation",
]);
function failure(error: any) {
  return Response.json(
    { error: error.status ? error.message : "Ralat pelayan. Cuba semula." },
    { status: error.status || 500 },
  );
}

// A private SQLite-backed Durable Object gives the backend its own CPU budget
// on Workers Free. D1 remains the authoritative student/auth database.
export class LitricSchoolService extends DurableObject<any> {
  private pending: Promise<void> = Promise.resolve();
  async fetch(request: Request): Promise<Response> {
    const previous = this.pending;
    let release!: () => void;
    this.pending = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const path = new URL(request.url).pathname;
      if (path === "/api/auth/bootstrap")
        return Response.json(await bootstrapEndpoint(request, this.env.DB, this.env));
      if (path.startsWith("/api/auth/"))
        return Response.json(await authEndpoint(request, this.env.DB));
      return await api(request);
    } catch (error) {
      return failure(error);
    } finally {
      release();
    }
  }
}
export default {
  async fetch(request: Request): Promise<Response> {
    const config = env as any;
    const origin = request.headers.get("origin");
    const allowed = config.FRONTEND_ORIGIN || new URL(request.url).origin;
    const headers = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": "max-age=31536000",
    });
    if (origin === allowed) {
      headers.set("Access-Control-Allow-Origin", allowed);
      headers.set("Vary", "Origin");
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      headers.set(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      headers.set("Access-Control-Expose-Headers", "Content-Disposition");
    }
    const pathname = new URL(request.url).pathname;
    if (!pathname.startsWith("/api/") && pathname !== "/health") {
      if (!config.ASSETS)
        return new Response("Frontend belum dibina.", { status: 503 });
      return config.ASSETS.fetch(request);
    }
    let response: Response;
    try {
      if (config.LITRIC_AUTH_MODE !== "standalone" || !allowed || !config.DB)
        throw Object.assign(new Error("Konfigurasi pelayan belum lengkap."), {
          status: 503,
        });
      if (origin && origin !== allowed)
        throw Object.assign(new Error("Asal permintaan tidak dibenarkan."), {
          status: 403,
        });
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers });
      const path = new URL(request.url).pathname;
      if (path === "/health") response = Response.json({
        ok: true,
        loginEnabled: config.LITRIC_LOGIN_ENABLED !== "false",
      });
      else if (path.startsWith("/api/auth/")) {
        if (config.LITRIC_LOGIN_ENABLED === "false")
          throw Object.assign(new Error("Versi rintis: log masuk belum diaktifkan."), { status: 503 });
        if (!config.SCHOOL_SERVICE) throw Object.assign(new Error("Backend belum dikonfigurasi."), { status: 503 });
        response = await config.SCHOOL_SERVICE.getByName("ABA6052").fetch(request);
      }
      else {
        if (config.LITRIC_LOGIN_ENABLED === "false")
          throw Object.assign(new Error("Log masuk belum diaktifkan."), { status: 401 });
        const key = path.replace(/^\/api\//, "");
        if (
          !(
            request.method === "GET"
              ? readPaths
              : request.method === "POST"
                ? writePaths
                : new Set()
          ).has(key)
        )
          throw Object.assign(new Error("Laluan tidak ditemui."), {
            status: 404,
          });
        if (!config.SCHOOL_SERVICE) throw Object.assign(new Error("Backend belum dikonfigurasi."), { status: 503 });
        response = await config.SCHOOL_SERVICE.getByName("ABA6052").fetch(request);
      }
    } catch (error: any) {
      response = failure(error);
    }
    response = new Response(response.body, response);
    for (const [k, v] of headers) response.headers.set(k, v);
    return response;
  },
};
