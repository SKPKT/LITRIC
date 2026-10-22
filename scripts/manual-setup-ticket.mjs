import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';

export const SETUP_WINDOW_MS = 14 * 60_000;
const ticketFile = () => path.join(os.homedir(), 'AppData', 'Local', 'LITRIC', 'gpm-setup.dpapi');
export function newTicket(origin, time = Date.now()) {
  const setupKey = randomBytes(32).toString('hex');
  return { origin, setupKey, hash: createHash('sha256').update(setupKey).digest('hex'), expiresAt: time + SETUP_WINDOW_MS };
}
export function validateTicket(ticket, origin, time = Date.now()) {
  if (!ticket || ticket.origin !== origin || !/^[a-f0-9]{64}$/.test(ticket.setupKey || '') || ticket.hash !== createHash('sha256').update(ticket.setupKey).digest('hex'))
    throw new Error('Tiket setup tidak sah. Jana pasangan baharu.');
  if (!Number.isSafeInteger(ticket.expiresAt) || ticket.expiresAt <= time || ticket.expiresAt > time + 15 * 60_000)
    throw new Error('Tiket setup tamat atau tempohnya tidak sah. Jana pasangan baharu.');
  return ticket;
}
function dpapi(input, decrypt = false) {
  if (process.platform !== 'win32') throw new Error('Setup manual ini memerlukan akaun Windows yang menyediakan tiket.');
  const common = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $text=[Console]::In.ReadToEnd(); ";
  const operation = decrypt
    ? '$data=[Convert]::FromBase64String($text); $plain=[Security.Cryptography.ProtectedData]::Unprotect($data,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain)); [Array]::Clear($plain,0,$plain.Length);'
    : '$plain=[Text.Encoding]::UTF8.GetBytes($text); $data=[Security.Cryptography.ProtectedData]::Protect($plain,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($data)); [Array]::Clear($plain,0,$plain.Length);';
  const executable = path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const result = spawnSync(executable, ['-NoProfile', '-NonInteractive', '-Command', common + operation], { input, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('Tiket Windows tidak dapat diproses. Tiada kunci setup dicetak.');
  return result.stdout;
}
export function saveTicket(ticket) {
  const encrypted = dpapi(JSON.stringify(ticket));
  fs.mkdirSync(path.dirname(ticketFile()), { recursive: true });
  fs.writeFileSync(ticketFile(), encrypted, { mode: 0o600 });
}
export function readTicket(origin, time = Date.now()) {
  try { return validateTicket(JSON.parse(dpapi(fs.readFileSync(ticketFile(), 'utf8'), true)), origin, time); }
  catch { throw new Error('Tiket setup tiada, tidak boleh dibuka oleh akaun Windows ini, atau telah tamat. Jana pasangan baharu.'); }
}
export function removeTicket() { fs.rmSync(ticketFile(), { force: true }); }
