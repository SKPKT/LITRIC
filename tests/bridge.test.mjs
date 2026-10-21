import test from "node:test";
import assert from "node:assert/strict";
import {allowedParent, trustedMessage, validApiPath, BRIDGE_PROTOCOL} from "../lib/bridge-policy.mjs";
test("bridge trusts exact school Pages origin and refuses lookalikes", () => {
  assert.ok(allowedParent("https://skpkt.github.io","https://backend.example"));
  for (const o of ["https://evil.invalid","http://skpkt.github.io","https://skpkt.github.io.evil.invalid","null","https://skpkt.github.io/"]) assert.ok(!allowedParent(o,"https://backend.example"));
  assert.ok(!allowedParent("http://127.0.0.1:4173","https://backend.example"));
  assert.ok(allowedParent("http://127.0.0.1:4173","http://127.0.0.1:8787"));
});
test("bridge requires exact sender window, origin, channel and protocol", () => {
  const peer = {}, data = {protocol:BRIDGE_PROTOCOL,channel:"one",type:"response"};
  const e = {source:peer,origin:"https://backend.example",data};
  assert.ok(trustedMessage(e,peer,e.origin,"one","response"));
  for(const bad of [{...e,source:{}},{...e,origin:"https://evil.invalid"},{...e,data:{...data,channel:"other"}},{...e,data:{...data,protocol:"other"}}]) assert.ok(!trustedMessage(bad,peer,e.origin,"one","response"));
});
test("relay permits scoped API calls, never arbitrary fetch/auth endpoints", () => {
  assert.ok(validApiPath("/api/state?year=2025&classId=fixture"));
  assert.ok(validApiPath("/api/import/commit","POST"));
  assert.ok(validApiPath("/api/certificate/pdf?id=fixture"));
  for(const p of ["https://evil.invalid/api/state","//evil.invalid/api/state","/signin-with-chatgpt","/api/../state","/api/%2e%2e/state","/api/state#x","/api/state\\x","/api/unknown"]) assert.ok(!validApiPath(p));
  assert.ok(!validApiPath("/api/backup","POST"));
  assert.ok(!validApiPath("/api/state","DELETE"));
});
