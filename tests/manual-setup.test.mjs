import test from 'node:test';
import assert from 'node:assert/strict';
import { newTicket, validateTicket, SETUP_WINDOW_MS } from '../scripts/manual-setup-ticket.mjs';
const origin = 'https://litric-pilot.example.workers.dev';
test('manual setup ticket binds its hash to a random key and a 14-minute lifetime', () => {
  const time = Date.now(), a = newTicket(origin, time), b = newTicket(origin, time);
  assert.notEqual(a.setupKey, b.setupKey);
  assert.notEqual(a.hash, b.hash);
  assert.equal(a.expiresAt - time, SETUP_WINDOW_MS);
  assert.equal(validateTicket(a, origin, time), a);
  assert.throws(() => validateTicket({ ...a, setupKey: b.setupKey }, origin, time), /tidak sah/);
  assert.throws(() => validateTicket(a, 'https://other.example.workers.dev', time), /tidak sah/);
});
test('manual setup rejects expired, excessive or seconds-based expiry without leaking the key', () => {
  const time = Date.now(), ticket = newTicket(origin, time);
  for (const expiry of [time, time - 1, time + 16 * 60_000, Math.floor(time / 1000)]) {
    assert.throws(() => validateTicket({ ...ticket, expiresAt: expiry }, origin, time), error => !error.message.includes(ticket.setupKey) && /tempoh|tamat/.test(error.message));
  }
});
