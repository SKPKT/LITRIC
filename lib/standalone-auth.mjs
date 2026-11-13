import { readLimitedBody } from "./request-body.mjs";
import { scrypt } from "@noble/hashes/scrypt.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
export const KDF = {
  N: 32768,
  r: 8,
  p: 3,
  dkLen: 32,
  maxmem: 40 * 1024 * 1024,
};
const reject = (message, status = 401) => {
  throw Object.assign(new Error(message), { status });
};
export const sha = async (value) =>
  bytesToHex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", utf8ToBytes(value))),
  );
export async function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128
  )
    reject("Kata laluan mesti 10–128 aksara.", 400);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await scrypt(utf8ToBytes(password), salt, KDF);
  return `scrypt$32768$8$3$${bytesToHex(salt)}$${bytesToHex(key)}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || password.length > 128) return false;
  const parts = String(encoded).split("$");
  if (
    parts.length !== 6 ||
    parts.slice(0, 4).join("$") !== "scrypt$32768$8$3" ||
    !/^[a-f0-9]{32}$/.test(parts[4]) ||
    !/^[a-f0-9]{64}$/.test(parts[5])
  )
    return false;
  const key = await scrypt(utf8ToBytes(password), hexToBytes(parts[4]), KDF);
  const wanted = hexToBytes(parts[5]);
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key[i] ^ wanted[i];
  key.fill(0);
  return diff === 0;
}
export const SESSION_MS = 30 * 60 * 1000;
const one = (db, sql, ...args) =>
  db
    .prepare(sql)
    .bind(...args)
    .first();
const run = (db, sql, ...args) =>
  db
    .prepare(sql)
    .bind(...args)
    .run();
const at = () => new Date().toISOString();
async function audit(db, id, action) {
  await run(
    db,
    "INSERT INTO audit_logs (id,school_id,user_id,action,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?)",
    crypto.randomUUID(),
    "ABA6052",
    id || "anonymous",
    action,
    null,
    "{}",
    at(),
  );
}
async function limit(db, key, max, time) {
  await run(
    db,
    `INSERT INTO auth_limits (key,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END`,
    key,
    time + 900000,
    time,
    time,
  );
  const row = await one(db, "SELECT * FROM auth_limits WHERE key=?", key);
  if (row.attempts > max)
    reject("Terlalu banyak percubaan. Cuba semula selepas 15 minit.", 429);
}
export async function authenticate(
  request,
  db,
  { allowTemporary = false, time = Date.now() } = {},
) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) reject("Sila log masuk.");
  const row = await one(
    db,
    `SELECT u.*,a.must_change,a.password_version,s.password_version AS session_version,s.expires_at FROM auth_sessions s JOIN users u ON u.id=s.user_id JOIN auth_accounts a ON a.user_id=u.id WHERE s.token_hash=?`,
    await sha(token),
  );
  if (
    !row ||
    !row.active ||
    row.school_id !== "ABA6052" ||
    row.expires_at <= time ||
    row.password_version !== row.session_version
  )
    reject("Sesi tamat. Sila log masuk semula.");
  if (row.must_change && !allowTemporary)
    reject("Tukar kata laluan sementara dahulu.", 428);
  return row;
}
export async function authEndpoint(request, db, time = Date.now()) {
  const path = new URL(request.url).pathname;
  if (request.method !== "POST") reject("Kaedah tidak dibenarkan.", 405);
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("application/json")) reject("JSON diperlukan.", 415);
  const bytes = await readLimitedBody(request, 4096);
  if (bytes.byteLength > 4096) reject("Permintaan terlalu besar.", 413);
  let body;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    reject("JSON tidak sah.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    reject("JSON tidak sah.", 400);
  if (path === "/api/auth/login") {
    const username = String(body.username || "")
      .trim()
      .toUpperCase()
      .slice(0, 64);
    const ip = request.headers.get("cf-connecting-ip") || "local";
    await run(db, "DELETE FROM auth_limits WHERE reset_at<=?", time);
    await limit(db, `ip:${await sha(ip)}`, 30, time);
    await limit(db, `user:${await sha(username)}`, 10, time);
    const account = await one(
      db,
      "SELECT a.*,u.active FROM auth_accounts a JOIN users u ON u.id=a.user_id WHERE a.username=?",
      username,
    );
    // Unknown usernames perform the same KDF, using a fixed non-secret dummy hash.
    const dummy =
      "scrypt$32768$8$3$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";
    const valid = await verifyPassword(
      body.password,
      account?.password_hash || dummy,
    );
    if (!valid || !account?.active) {
      await audit(db, account?.user_id, "Log masuk gagal");
      reject("Nama pengguna atau kata laluan tidak sah.");
    }
    const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
    const expiresAt = time + SESSION_MS;
    await db.batch([
      db.prepare("DELETE FROM auth_sessions WHERE expires_at<=?").bind(time),
      db
        .prepare("DELETE FROM auth_sessions WHERE user_id=?")
        .bind(account.user_id),
      db
        .prepare(
          "INSERT INTO auth_sessions (token_hash,user_id,password_version,expires_at,created_at) VALUES (?,?,?,?,?)",
        )
        .bind(
          await sha(token),
          account.user_id,
          account.password_version,
          expiresAt,
          time,
        ),
    ]);
    await audit(db, account.user_id, "Log masuk berjaya");
    return { token, expiresAt, mustChange: !!account.must_change };
  }
  const user = await authenticate(request, db, { allowTemporary: true, time });
  if (path === "/api/auth/logout") {
    await run(db, "DELETE FROM auth_sessions WHERE user_id=?", user.id);
    await audit(db, user.id, "Log keluar");
    return { ok: true };
  }
  if (path === "/api/auth/password") {
    await limit(db, `password:${user.id}`, 10, time);
    const account = await one(
      db,
      "SELECT * FROM auth_accounts WHERE user_id=?",
      user.id,
    );
    if (!(await verifyPassword(body.currentPassword, account.password_hash)))
      reject("Kata laluan semasa tidak sah.");
    if (
      body.password === body.currentPassword ||
      String(body.password).length < 12
    )
      reject("Pilih kata laluan baharu sekurang-kurangnya 12 aksara.", 400);
    const hash = await hashPassword(body.password);
    await db.batch([
      db
        .prepare(
          "UPDATE auth_accounts SET password_hash=?,must_change=0,password_version=password_version+1 WHERE user_id=?",
        )
        .bind(hash, user.id),
      db.prepare("DELETE FROM auth_sessions WHERE user_id=?").bind(user.id),
    ]);
    await audit(db, user.id, "Kata laluan ditukar; semua sesi dibatalkan");
    return { ok: true };
  }
  reject("Laluan tidak ditemui.", 404);
}
