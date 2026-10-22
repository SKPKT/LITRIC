import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
    );
for (const f of walk(process.argv[2] || "dist-pages").filter((f) =>
  /\.(js|html|css|json)$/.test(f),
)) {
  const s = fs.readFileSync(f, "utf8");
  assert.ok(
    !/chatgpt\.site|signin-with-chatgpt|signout-with-chatgpt|oai-authenticated-user|litric-backend|\/bridge\?/.test(
      s,
    ),
    "Legacy production dependency: " + f,
  );
  assert.ok(
    !/scrypt\$32768\$|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}/.test(
      s,
    ),
    "Credential/hash in public bundle: " + f,
  );
}
console.log(
  "PASS: static frontend has no Sites authentication, bridge, old backend, credential or password hash.",
);
