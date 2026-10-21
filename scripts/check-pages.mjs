import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const out = path.resolve("dist-pages");
const walk = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(d,e.name)) : [path.join(d,e.name)]);
const html = fs.readFileSync(path.join(out,"index.html"),"utf8");
assert.match(html, /<title>LITRIC/);
assert.match(html, /\/LITRIC\/assets\//);
for (const match of html.matchAll(/(?:src|href)="(\/LITRIC\/[^"#?]+)"/g)) assert.ok(fs.existsSync(path.join(out, match[1].slice(8))), match[1]);
assert.ok(fs.existsSync(path.join(out,"404.html")));
assert.ok(fs.existsSync(path.join(out,"manifest.webmanifest")));
const manifest = JSON.parse(fs.readFileSync(path.join(out,"manifest.webmanifest")));
assert.equal(manifest.short_name,"LITRIC");
for (const file of walk(out)) {
  assert.ok(!/\.(map|csv|xlsx|sql|sqlite|db|zip)$/i.test(file), `Private/server artifact: ${file}`);
  if (/\.(js|css|html|json|webmanifest)$/.test(file)) {
    const text = fs.readFileSync(file,"utf8");
    assert.ok(!/seed-data|oai-authenticated-user-email|LITRIX_ADMIN_EMAIL|LITRIC_ADMIN_EMAIL/.test(text), `Server content in ${file}`);
  }
}
const seed = JSON.parse(fs.readFileSync("lib/seed-data.json"));
const identities = new Set(seed.flatMap(b => b.rows.flatMap(r => [r.email, r.name])).filter(Boolean));
const assets = walk(out).filter(f => /\.(js|html|json|webmanifest)$/.test(f)).map(f => fs.readFileSync(f,"utf8"));
for (const id of identities) assert.ok(!assets.some(x => x.includes(id)), "Private pupil identity in static artifact");
console.log("PASS: /LITRIC/ assets, metadata, fallback and static privacy checks");
