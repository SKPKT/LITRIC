// Export current source WITHOUT Git history or original pupil data. Run from private checkout.
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
const args = process.argv.slice(2), refresh = args.includes("--refresh");
const root = process.cwd(), target = path.resolve(args.find(a => a !== "--refresh") || "../LITRIC");
assert.ok(target !== root && !target.startsWith(root + path.sep), "Export must be outside private checkout");
if (fs.existsSync(target) && fs.readdirSync(target).length) {
  assert.ok(refresh && !fs.existsSync(path.join(target,".git")), "Use a new/empty export directory; --refresh only updates a sanitized non-repository export");
  const previousSeed = JSON.parse(fs.readFileSync(path.join(target,"lib/seed-data.json")));
  assert.equal(Array.isArray(previousSeed) && previousSeed.length === 0, true, "Refusing to overwrite private seed");
  assert.equal(JSON.parse(fs.readFileSync(path.join(target,"package.json"))).name,"litric");
}
fs.mkdirSync(target,{recursive:true});
const names = execFileSync("git",["ls-files","--cached","--others","--exclude-standard","-z"],{encoding:"utf8"}).split("\0").filter(Boolean);
for (const rel of names) {
  if (rel === "lib/seed-data.json" || !fs.existsSync(rel) || rel.startsWith(".git/")) continue;
  const source = path.resolve(root,rel), dest = path.resolve(target,rel);
  assert.ok(dest.startsWith(target + path.sep));
  assert.ok(!fs.lstatSync(source).isSymbolicLink());
  fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.copyFileSync(source,dest);
}
fs.writeFileSync(path.join(target,"lib/seed-data.json"),"[]\n");
// Private migration validation uses supplied sources; it is explicitly skipped for public packages.
const seed = JSON.parse(fs.readFileSync(path.join(root,"lib/seed-data.json")));
const privateTokens = new Set(seed.flatMap(b => b.rows.flatMap(r => [r.email,r.name])).filter(Boolean));
function check(dir) {
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    if (["node_modules","dist","dist-pages",".git",".next",".vinext",".wrangler",".sites-runtime"].includes(e.name)) continue;
    const file = path.join(dir,e.name);
    if(e.isDirectory()) check(file);
    else if(/\.(tsx?|mjs|md|json|ya?ml|html)$/.test(file)) {
      const content=fs.readFileSync(file,"utf8");
      for(const token of privateTokens) assert.ok(!content.includes(token), `Private pupil identity in ${path.relative(target,file)}`);
    }
  }
}
check(target);
execFileSync(process.execPath,[path.join(target,"scripts/check-public-source.mjs")],{cwd:target,stdio:"inherit"});
console.log(`Public source prepared: ${target}. Initialize a NEW Git history here; never push private checkout history.`);
