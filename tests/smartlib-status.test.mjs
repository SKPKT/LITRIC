import test from "node:test";
import assert from "node:assert/strict";
import { SMARTLIB_SOURCE_URL, unverifiedSmartlibStatus } from "../lib/smartlib-status.mjs";

test("missing endpoint or service credential cannot report a live connection", () => {
  for (const [settings, env] of [
    [{}, {}],
    [{ smartlibUrl: "https://backend.example.invalid" }, {}],
    [{}, { SMARTLIB_API_KEY: crypto.randomUUID() }],
  ]) {
    const status = unverifiedSmartlibStatus(settings, env);
    assert.equal(status.status, "not_configured");
    assert.equal(status.connected, false);
    assert.equal(status.verified, false);
    assert.equal(status.catalogueRecordsRead, null);
    assert.equal(status.lastSuccessfulConnectionAt, null);
    assert.equal(status.lastCatalogueSyncAt, null);
  }
});

test("configured URL, credential and forged settings cannot stand in for live evidence", () => {
  const secret = crypto.randomUUID();
  const status = unverifiedSmartlibStatus({
    smartlibUrl: "https://untrusted.example.invalid/?token=" + secret,
    connected: true,
    lastCatalogueSyncAt: new Date().toISOString(),
    catalogueRecordsRead: 999,
    smartlibToken: secret,
  }, { SMARTLIB_API_KEY: secret });
  assert.equal(status.status, "disconnected");
  assert.equal(status.connected, false);
  assert.equal(status.circulationVerified, false);
  assert.equal(status.verified, false);
  assert.equal(status.readOnly, true);
  assert.equal(status.health, "not_verified");
  assert.equal(status.sourceUrl, SMARTLIB_SOURCE_URL);
  assert.equal(status.lastCatalogueSyncAt, null);
  assert.equal(status.catalogueRecordsRead, null);
  assert.equal(JSON.stringify(status).includes(secret), false);
  assert.equal(JSON.stringify(status).includes("untrusted.example.invalid"), false);
  assert.equal(status.message, "SMARTLIB Integration: NOT VERIFIED");
});
