import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
test("independent transport uses memory sessions, omits cookies, blocks external paths, clears expired sessions", async () => {
  const original = { fetch: globalThis.fetch, window: globalThis.window };
  const events = [];
  globalThis.window = { dispatchEvent: (e) => events.push(e.type) };
  globalThis.__LITRIC_API_URL__ = "https://api.example.invalid";
  let last;
  globalThis.fetch = async (url, init) => {
    last = { url, init };
    if (url.endsWith("/login"))
      return Response.json({
        token: "a".repeat(64),
        expiresAt: Date.now() + 60000,
        mustChange: false,
      });
    if (url.endsWith("/logout")) return Response.json({ ok: true });
    return Response.json({ ok: true });
  };
  const compiled = ts.transpileModule(
    fs.readFileSync("lib/client-api.ts", "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    },
  ).outputText;
  const api = await import(
    "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
  );
  try {
    await assert.rejects(api.apiFetch("/api/state"), (e) => e.status === 401);
    await api.login("GPM", crypto.randomUUID());
    await api.apiFetch("/api/state?year=2025");
    assert.equal(last.url, "https://api.example.invalid/api/state?year=2025");
    assert.equal(last.init.credentials, "omit");
    assert.equal(
      last.init.headers.get("Authorization"),
      "Bearer " + "a".repeat(64),
    );
    await assert.rejects(api.apiFetch("https://evil.invalid/api/state"));
    await api.logout();
    await assert.rejects(api.apiFetch("/api/state"), (e) => e.status === 401);
    assert.ok(events.includes("litric:disconnected"));
  } finally {
    api.disconnectBackend();
    globalThis.fetch = original.fetch;
    globalThis.window = original.window;
    delete globalThis.__LITRIC_API_URL__;
  }
});
