import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
test("Pages transport authenticates its peer, transfers JSON/files/downloads and fails closed", async () => {
  const handlers = new Map(); let opened, sent, blocked = false;
  const peer = {closed:false, focus(){},close(){this.closed=true;},postMessage(data,origin){sent={data,origin};}};
  const browser = {
    addEventListener(type,fn){if(!handlers.has(type))handlers.set(type,new Set());handlers.get(type).add(fn);},
    removeEventListener(type,fn){handlers.get(type)?.delete(fn);},
    open(url){opened=url;peer.closed=false;return blocked?null:peer;},
  };
  const emit = data => {for(const fn of handlers.get("message")||[])fn(data);};
  const original = {window:globalThis.window,location:globalThis.location};
  globalThis.window=browser;globalThis.location={origin:"https://skpkt.github.io"};
  globalThis.__LITRIC_PAGES__=true; globalThis.__LITRIC_BACKEND__="https://backend.example";
  let source=fs.readFileSync(new URL("../lib/client-api.ts",import.meta.url),"utf8");
  source=source.replace('"./bridge-policy.mjs"',JSON.stringify(new URL("../lib/bridge-policy.mjs",import.meta.url).href));
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const api=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  try {
    await assert.rejects(api.apiFetch("/api/state"),e=>e.status===401);
    let ready=false; const connecting=api.connectBackend().then(()=>{ready=true;});
    const channel=new URL(opened).searchParams.get("channel");
    const packet={protocol:"litric-v1",channel,type:"ready"};
    emit({source:{},origin:"https://backend.example",data:packet});
    emit({source:peer,origin:"https://evil.invalid",data:packet});
    await Promise.resolve();assert.equal(ready,false);
    emit({source:peer,origin:"https://backend.example",data:packet}); await connecting;
    const request=api.apiFetch("/api/state?year=2025");
    assert.equal(sent.origin,"https://backend.example");assert.equal(sent.data.method,"GET");
    const response={protocol:"litric-v1",channel,type:"response",id:sent.data.id,status:200,headers:{"content-type":"application/json"},bytes:new TextEncoder().encode('{"authorized":true}').buffer};
    let resolved=false;request.then(()=>{resolved=true;});
    emit({source:peer,origin:"https://evil.invalid",data:response});await Promise.resolve();assert.equal(resolved,false);
    emit({source:peer,origin:"https://backend.example",data:response});assert.deepEqual(await (await request).json(),{authorized:true});
    const form=new FormData();form.set("programme_id","fixture");form.set("file",new Blob(["fixture"],{type:"image/png"}),"fixture.png");
    const upload=api.apiFetch("/api/file",{method:"POST",body:form});
    assert.equal(sent.data.form[1][1].name,"fixture.png"); assert.equal(sent.data.body,undefined);
    emit({source:peer,origin:"https://backend.example",data:{...response,id:sent.data.id}});assert.equal((await upload).status,200);
    const pdf=api.apiFetch("/api/certificate/pdf?id=fixture");
    emit({source:peer,origin:"https://backend.example",data:{...response,id:sent.data.id,headers:{"content-type":"application/pdf"},bytes:new Uint8Array([37,80,68,70]).buffer}});
    assert.equal(await (await pdf).text(),"%PDF");
    const waiting=api.apiFetch("/api/state");api.disconnectBackend();await assert.rejects(waiting,e=>e.status===401);assert.equal(peer.closed,true);
    blocked=true;await assert.rejects(api.connectBackend(),/pop-up/);
    blocked=false;const retry=api.connectBackend();const newChannel=new URL(opened).searchParams.get("channel");
    emit({source:peer,origin:"https://backend.example",data:{...packet,channel:newChannel}});await retry;
    await assert.rejects(api.apiFetch("https://evil.invalid/api/state"),/tidak dibenarkan/);
  } finally {
    api.disconnectBackend();globalThis.window=original.window;globalThis.location=original.location;
    delete globalThis.__LITRIC_PAGES__;delete globalThis.__LITRIC_BACKEND__;
  }
});
