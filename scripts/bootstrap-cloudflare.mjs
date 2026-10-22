import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { hiddenInput } from './hidden-input.mjs';
import { needsWranglerLogin, setupFailure } from './cloudflare-setup-error.mjs';
const origin = process.env.LITRIC_PRODUCTION_URL;
if (!origin || new URL(origin).origin !== origin || !origin.startsWith('https://') || !new URL(origin).hostname.endsWith('.workers.dev'))
  throw new Error('Set LITRIC_PRODUCTION_URL to the exact school-controlled HTTPS workers.dev origin.');
const configPath = 'standalone/wrangler.generated.jsonc';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (!new URL(origin).hostname.startsWith(config.name + '.')) throw new Error('Worker name and setup origin differ.');
if (config.vars?.LITRIC_LOGIN_ENABLED === 'false') throw new Error('Deploy the Durable Object backend with login enabled before setup.');
const execute = (args, input) => spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args, '--config', configPath], {
  input, encoding: 'utf8', windowsHide: true,
});
// Refresh/check the same OAuth connection before asking for a private password.
// Child processes are non-interactive, so they cannot open a missing login flow.
let preflight = execute(['secret', 'list']);
if (preflight.status !== 0 && needsWranglerLogin(preflight) && !process.argv.includes('--check') && process.stdin.isTTY) {
  console.log('Sesi Wrangler belum tersedia dalam terminal ini. Log masuk Cloudflare dahulu.');
  console.log('Jika pelayar tidak terbuka, buka URL yang Wrangler paparkan. Tekan Authorize pada akaun sekolah dan tunggu di sini.');
  console.log('Jangan taip kata laluan GPM sehingga permintaan input tersembunyi muncul.');
  const login = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'login', '--scopes', 'account:read', 'user:read', 'workers:write', 'workers_scripts:write', 'd1:write'], { stdio: 'inherit', windowsHide: true });
  if (login.status !== 0) throw new Error('Login Cloudflare belum selesai. Cuba semula setup; jangan taip kata laluan pada prompt PS.');
  preflight = execute(['secret', 'list']);
}
if (preflight.status !== 0) throw new Error(setupFailure(preflight));
if (process.argv.includes('--check')) {
  console.log('Cloudflare sedia untuk setup GPM. Tiada kata laluan diminta atau secret dipasang.');
  process.exit(0);
}
const setupKey = randomBytes(32).toString('hex');
const secretNames = ['LITRIC_BOOTSTRAP_HASH', 'LITRIC_BOOTSTRAP_EXPIRES_AT'];
let password = await hiddenInput('Kata laluan sementara GPM');
let confirm = await hiddenInput('Sahkan kata laluan sementara GPM');
if (password !== confirm || password.length < 10) throw new Error('Passwords must match and contain at least 10 characters.');
confirm = '';
let installed = false;
try {
  const secrets = JSON.stringify({
    LITRIC_BOOTSTRAP_HASH: createHash('sha256').update(setupKey).digest('hex'),
    LITRIC_BOOTSTRAP_EXPIRES_AT: String(Date.now() + 10 * 60_000),
  });
  const upload = execute(['secret', 'bulk'], secrets);
  if (upload.status !== 0) throw new Error(setupFailure(upload));
  installed = true;
  const result = await fetch(origin + '/api/auth/bootstrap', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Litric-Setup-Key': setupKey },
    body: JSON.stringify({ password }),
  });
  password = '';
  if (result.status === 409) throw new Error('GPM already exists. Existing credentials were not overwritten.');
  if (!result.ok) throw new Error('Server setup failed (HTTP ' + result.status + '). No password or secret has been logged.');
  console.log('GPM setup completed. First login MUST change the temporary password before opening student modules.');
  console.log('Login: ' + origin);
} finally {
  password = '';
  if (installed) {
    let removed = true;
    for (const name of secretNames) if (execute(['secret', 'delete', name], 'y\n').status !== 0) removed = false;
    if (!removed) console.error('Remove the two LITRIC_BOOTSTRAP_* secrets in Cloudflare. They expire within 10 minutes, and existing GPM prevents reuse.');
  }
}
