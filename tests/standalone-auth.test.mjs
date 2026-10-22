import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  hashPassword,
  verifyPassword,
  authEndpoint,
  authenticate,
  SESSION_MS,
} from "../lib/standalone-auth.mjs";
function database() {
  const sql = new DatabaseSync(":memory:");
  for (const p of fs.readdirSync("standalone/migrations").sort())
    sql.exec(fs.readFileSync("standalone/migrations/" + p, "utf8"));
  const db = {
    prepare(text) {
      const statement = {
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        first() {
          return sql.prepare(text).get(...this.args) || null;
        },
        all() {
          return { results: sql.prepare(text).all(...this.args) };
        },
        run() {
          return sql.prepare(text).run(...this.args);
        },
      };
      return statement;
    },
    batch(statements) {
      sql.exec("BEGIN");
      try {
        const result = statements.map((s) => s.run());
        sql.exec("COMMIT");
        return result;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { db, sql };
}
const req = (path, body = {}, token = "") =>
  new Request("https://api.example.invalid/api/auth/" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(body),
  });
test("standalone authentication: salted KDF, first-login gate, change, revocation, expiry, logout and rate limit", async () => {
  const { db, sql } = database(),
    password = crypto.randomUUID(),
    replacement = crypto.randomUUID(),
    time = Date.now();
  const hash = await hashPassword(password);
  assert.notEqual(hash, await hashPassword(password));
  assert.ok(await verifyPassword(password, hash));
  assert.equal(await verifyPassword(replacement, hash), false);
  sql
    .prepare("INSERT INTO schools(id,name,code,created_at) VALUES (?,?,?,?)")
    .run("ABA6052", "SEKOLAH UJIAN", "ABA6052", "test");
  sql
    .prepare(
      "INSERT INTO users(id,school_id,email,name,role,active,created_at) VALUES (?,?,?,?,?,?,?)",
    )
    .run(
      "admin",
      "ABA6052",
      "test@example.invalid",
      "PENTADBIR UJIAN",
      "admin",
      1,
      "test",
    );
  sql
    .prepare(
      "INSERT INTO auth_accounts(user_id,username,password_hash,created_at) VALUES (?,?,?,?)",
    )
    .run("admin", "GPM", hash, "test");
  await assert.rejects(
    authenticate(
      new Request("https://api.example.invalid/api/state", {
        headers: {
          "oai-authenticated-user-id": "admin",
          "oai-authenticated-user-email": "test@example.invalid",
        },
      }),
      db,
    ),
    (e) => e.status === 401,
  );
  await assert.rejects(
    authEndpoint(
      req("login", { username: "GPM", password: replacement }),
      db,
      time,
    ),
    (e) => e.status === 401,
  );
  const temporary = await authEndpoint(
    req("login", { username: "GPM", password }),
    db,
    time,
  );
  assert.equal(temporary.mustChange, true);
  await assert.rejects(
    authenticate(req("state", {}, temporary.token), db, { time }),
    (e) => e.status === 428,
  );
  await authEndpoint(
    req(
      "password",
      { currentPassword: password, password: replacement },
      temporary.token,
    ),
    db,
    time,
  );
  await assert.rejects(
    authenticate(req("state", {}, temporary.token), db, { time }),
    (e) => e.status === 401,
  );
  const session = await authEndpoint(
    req("login", { username: "GPM", password: replacement }),
    db,
    time,
  );
  assert.equal(session.mustChange, false);
  assert.equal(
    (await authenticate(req("state", {}, session.token), db, { time })).role,
    "admin",
  );
  const stored = sql.prepare("SELECT * FROM auth_sessions").get();
  assert.notEqual(stored.token_hash, session.token);
  assert.equal(stored.expires_at, time + SESSION_MS);
  await assert.rejects(
    authenticate(req("state", {}, session.token), db, {
      time: time + SESSION_MS,
    }),
    (e) => e.status === 401,
  );
  await authEndpoint(req("logout", {}, session.token), db, time);
  await assert.rejects(
    authenticate(req("state", {}, session.token), db, { time }),
    (e) => e.status === 401,
  );
  sql
    .prepare("UPDATE auth_limits SET attempts=10 WHERE key LIKE ?")
    .run("user:%");
  await assert.rejects(
    authEndpoint(
      req("login", { username: "GPM", password: replacement }),
      db,
      time,
    ),
    (e) => e.status === 429,
  );
  assert.ok(sql.prepare("SELECT COUNT(*) AS n FROM audit_logs").get().n >= 4);
  assert.ok(
    !JSON.stringify(sql.prepare("SELECT * FROM auth_accounts").all()).includes(
      password,
    ),
  );
  sql.close();
});
