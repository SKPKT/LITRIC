import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
const seed = JSON.parse(fs.readFileSync("lib/seed-data.json"));
assert.equal(Array.isArray(seed) && seed.length === 0, true, "Use npm run export:public first. The private checkout MUST NOT be pushed to GitHub.");
const skip = new Set([".git","node_modules","dist","dist-pages",".next",".vinext",".wrangler",".sites-runtime","dist-api","dist-worker"]);
function visit(dir) {
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    if (skip.has(e.name)) continue;
    const file = path.join(dir,e.name);
    if (e.isDirectory()) { assert.notEqual(e.name,"private-data"); visit(file); continue; }
    const syntheticCSV = file.replaceAll("\\","/") === "tests/fixtures/sample.csv" && createHash("sha256").update(fs.readFileSync(file,"utf8").replace(/\r\n/g,"\n")).digest("hex") === "d2e8ddab21ebd824ddc46858bfd32ce35a409c3d0121ab16d0aa69087351213e";
    assert.ok(syntheticCSV || !/\.(csv|xlsx|sqlite3?|db|zip|tar|pem|key)$/i.test(e.name), `Private/binary input: ${file}`);
    assert.ok(!/^\.env/.test(e.name) && !/^\.dev\.vars(?!\.example$)/.test(e.name), `Environment input: ${file}`);
    if (/\.(tsx?|mjs|json|md|ya?ml|html)$/.test(file)) {
      const content = fs.readFileSync(file,"utf8");
      assert.ok(!/(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|sk-proj-[A-Za-z0-9_-]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(content), `Possible credential: ${file}`);
      // Upstream dependency metadata may include its maintainer contact.
      const emails = path.basename(file) === "package-lock.json" ? [] : content.match(/[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
      assert.ok(emails.every(e => e.endsWith("@sites.test") || e.endsWith("@example.invalid") || e.endsWith("@example.com")), `Non-fixture email: ${file}`);
    }
  }
}
visit(".");
console.log("PASS: empty private seed, verified synthetic fixture, no private inputs, credentials or non-fixture application emails");
