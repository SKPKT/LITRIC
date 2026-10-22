import { hashPassword, sha } from './standalone-auth.mjs';
import { readLimitedBody } from './request-body.mjs';
const fail = (message, status) => { throw Object.assign(new Error(message), { status }); };

export async function bootstrapEndpoint(request, db, config, time = Date.now()) {
  if (request.method !== 'POST') fail('Kaedah tidak dibenarkan.', 405);
  const secret = request.headers.get('x-litric-setup-key') || '';
  const wanted = config.LITRIC_BOOTSTRAP_HASH || '';
  const expires = Number(config.LITRIC_BOOTSTRAP_EXPIRES_AT);
  if (!/^[a-f0-9]{64}$/.test(secret) || !/^[a-f0-9]{64}$/.test(wanted) || !Number.isFinite(expires) || expires <= time || expires > time + 15 * 60_000)
    fail('Tetapan awal tidak tersedia.', 404);
  const supplied = await sha(secret);
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= supplied.charCodeAt(i) ^ wanted.charCodeAt(i);
  if (diff) fail('Tetapan awal tidak tersedia.', 404);
  if (await db.prepare("SELECT user_id FROM auth_accounts WHERE username='GPM'").first())
    fail('Akaun GPM telah disediakan. Setup tidak boleh diulang.', 409);
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail('JSON diperlukan.', 415);
  let body;
  try { body = JSON.parse(new TextDecoder().decode(await readLimitedBody(request, 4096))); }
  catch (error) { if (error.status) throw error; fail('JSON tidak sah.', 400); }
  const hash = await hashPassword(body?.password);
  const id = crypto.randomUUID(), date = new Date(time).toISOString();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO schools(id,name,code,created_at) VALUES ('ABA6052','SK Pendidikan Khas Taiping','ABA6052',?)").bind(date),
    db.prepare("INSERT INTO users(id,school_id,email,name,role,class_ids,active,created_at) SELECT ?,'ABA6052','gpm@example.invalid','GPM','admin','[]',1,? WHERE NOT EXISTS (SELECT 1 FROM auth_accounts WHERE username='GPM')").bind(id, date),
    db.prepare("INSERT INTO auth_accounts(user_id,username,password_hash,must_change,created_at) SELECT ?,'GPM',?,1,? WHERE EXISTS (SELECT 1 FROM users WHERE id=?) AND NOT EXISTS (SELECT 1 FROM auth_accounts WHERE username='GPM')").bind(id, hash, date, id),
    db.prepare("INSERT OR IGNORE INTO settings(school_id,data) VALUES ('ABA6052',?)").bind(JSON.stringify({schoolName:'SK Pendidikan Khas Taiping',schoolCode:'ABA6052'})),
    db.prepare("INSERT OR IGNORE INTO star_rule_versions(id,school_id,thresholds,marks,certified,created_at,created_by) VALUES ('default-ABA6052','ABA6052','[144,288,432,576,720]','[3,4,5,6,7]',0,?,?)").bind(date, id),
    db.prepare("INSERT INTO audit_logs(id,school_id,user_id,action,entity_id,detail,created_at) VALUES (?,'ABA6052',?,'Setup pentadbir GPM',NULL,'{}',?)").bind(crypto.randomUUID(), id, date),
  ]);
  return { ok: true, mustChange: true };
}
