// HTTP checks only: visual and real OAuth checks require an authorized browser.
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:4173";
const response = await fetch(origin + "/LITRIC/#/profil/fixture");
assert.equal(response.status,200);
const html=await response.text(); let assets=0;
assert.match(html, /LITRIC/);
for(const m of html.matchAll(/(?:src|href)="(\/LITRIC\/[^"#?]+)"/g)) {
  const r = await fetch(origin + m[1]);assert.equal(r.status,200,m[1]);assets++;
}
for(const m of html.matchAll(/href="([^"]+\.css)"/g)) {
  const css=await(await fetch(origin+m[1])).text();
  for(const f of css.matchAll(/url\((\/LITRIC\/[^)]+)\)/g)) {assert.equal((await fetch(origin+f[1])).status,200,f[1]);assets++;}
}
assert.equal((await fetch(origin+"/LITRIC/404.html")).status,200);
const direct=await fetch("http://127.0.0.1:8787/api/state", {headers:{Origin:"https://skpkt.github.io","oai-authenticated-user-id":"local_seedy","oai-authenticated-user-email":"seedy@sites.test"}});
assert.equal(direct.status,403);assert.equal(direct.headers.get("access-control-allow-origin"),null);
console.log(`PASS: Pages entry/hash-route refresh, ${assets} assets returned 200; direct cross-origin backend request denied (403)`);
