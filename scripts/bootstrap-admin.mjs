import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { hashPassword } from "../lib/standalone-auth.mjs";
const remote = process.argv.includes("--remote");
const config = remote
  ? "standalone/wrangler.generated.jsonc"
  : "standalone/wrangler.jsonc";
if (remote && !fs.existsSync(config))
  throw new Error("Run npm run configure:cloudflare before remote bootstrap.");
if (!remote && !process.argv.includes("--local"))
  throw new Error(
    "Specify --local or --remote. Use only the NEW isolated school database.",
  );
async function secret() {
  if (!process.stdin.isTTY) {
    let text = "";
    for await (const part of process.stdin) {
      text += part;
      if (text.length > 512) throw new Error("Input too long.");
    }
    return text.trimEnd();
  }
  process.stderr.write("Initial administrator password (hidden): ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const read = (chunk) => {
      for (const c of chunk.toString()) {
        if (c === "\u0003") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          reject(new Error("Cancelled."));
          return;
        }
        if (c === "\r" || c === "\n") {
          process.stdin.off("data", read);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stderr.write("\n");
          resolve(value);
          return;
        }
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else if (c >= " ") value += c;
      }
    };
    process.stdin.on("data", read);
  });
}
let password = await secret();
const hash = await hashPassword(password);
password = "";
const id = crypto.randomUUID(),
  date = new Date().toISOString();
const q = (x) => "'" + String(x).replaceAll("'", "''") + "'";
const sql = `
INSERT OR IGNORE INTO schools(id,name,code,created_at) VALUES ('ABA6052','SK Pendidikan Khas Taiping','ABA6052',${q(date)});
INSERT INTO users(id,school_id,email,name,role,class_ids,active,created_at) SELECT ${q(id)},'ABA6052','gpm@example.invalid','GPM','admin','[]',1,${q(date)} WHERE NOT EXISTS (SELECT 1 FROM auth_accounts WHERE username='GPM');
INSERT INTO auth_accounts(user_id,username,password_hash,must_change,created_at) SELECT ${q(id)},'GPM',${q(hash)},1,${q(date)} WHERE EXISTS (SELECT 1 FROM users WHERE id=${q(id)}) AND NOT EXISTS (SELECT 1 FROM auth_accounts WHERE username='GPM');
INSERT OR IGNORE INTO settings(school_id,data) VALUES ('ABA6052','{"schoolName":"SK Pendidikan Khas Taiping","schoolCode":"ABA6052"}');
INSERT OR IGNORE INTO star_rule_versions(id,school_id,thresholds,marks,certified,created_at,created_by) VALUES ('default-ABA6052','ABA6052','[144,288,432,576,720]','[3,4,5,6,7]',0,${q(date)},${q(id)});
`;
// Only the salted hash reaches this short-lived file. Never print SQL or password.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "litric-bootstrap-")),
  file = path.join(dir, "bootstrap.sql");
try {
  fs.writeFileSync(file, sql, { mode: 0o600 });
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "litric-school",
      "--config",
      config,
      remote ? "--remote" : "--local",
      "--file",
      file,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(
      "Bootstrap failed. Check database configuration and whether GPM already exists. No password or SQL has been logged.",
    );
  console.log(
    "One-time GPM setup completed. Existing GPM credentials are never overwritten. New accounts must change password at first login.",
  );
} finally {
  if (fs.realpathSync(path.dirname(dir)) !== fs.realpathSync(os.tmpdir())) throw new Error("Unexpected temporary directory.");
    fs.rmSync(dir, { recursive: true, force: true });
}
