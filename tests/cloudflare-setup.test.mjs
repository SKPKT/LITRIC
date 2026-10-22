import test from 'node:test';
import assert from 'node:assert/strict';
import { needsWranglerLogin, setupFailure } from '../scripts/cloudflare-setup-error.mjs';

test('setup diagnoses unavailable non-interactive OAuth without reflecting private command output', () => {
  const privateValue = crypto.randomUUID();
  const message = setupFailure({ stderr: "In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN " + privateValue });
  assert.match(message, /Sesi Wrangler/);
  assert.equal(message.includes(privateValue), false);
  assert.equal(message.includes('CLOUDFLARE_API_TOKEN'), false);
  assert.equal(needsWranglerLogin({ stderr: 'In a non-interactive environment' }), true);
});

test('setup distinguishes network, permissions and process failures without leaking output', () => {
  const privateValue = crypto.randomUUID();
  assert.match(setupFailure({ stderr: 'ECONNRESET ' + privateValue }), /Sambungan/);
  assert.match(setupFailure({ stderr: 'HTTP 403 ' + privateValue }), /izin Workers Scripts/);
  assert.equal(needsWranglerLogin({ stderr: 'ECONNRESET' }), false);
  assert.equal(needsWranglerLogin({ stderr: 'HTTP 403' }), false);
  assert.match(setupFailure({ error: { code: 'ENOENT' } }), /tidak ditemui/);
  assert.equal(setupFailure({ stdout: privateValue }).includes(privateValue), false);
});
