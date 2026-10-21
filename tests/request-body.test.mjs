import test from "node:test";
import assert from "node:assert/strict";
import {readLimitedBody} from "../lib/request-body.mjs";
test("bounded API body preserves valid bytes", async () => {
  const r = new Request("https://backend.example/api/import/commit",{method:"POST",body:'{"rows":[]}'});
  assert.equal(new TextDecoder().decode(await readLimitedBody(r,100)), '{"rows":[]}');
});
test("bounded API body rejects declared and streamed excess", async () => {
  const r = new Request("https://backend.example",{method:"POST",headers:{"content-length":"100"},body:"abc"});
  await assert.rejects(readLimitedBody(r,4),e=>e.status===413);
  let cancelled = false;
  const stream = new ReadableStream({start(c){c.enqueue(new Uint8Array(3));c.enqueue(new Uint8Array(3));},cancel(){cancelled=true;}});
  const chunked = new Request("https://backend.example",{method:"POST",body:stream,duplex:"half"});
  await assert.rejects(readLimitedBody(chunked,4),e=>e.status===413);
  assert.equal(cancelled,true);
});
