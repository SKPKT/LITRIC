import { newTicket, validateTicket, saveTicket, readTicket, removeTicket } from './manual-setup-ticket.mjs';
import { hiddenInput } from './hidden-input.mjs';

const origin = process.env.LITRIC_PRODUCTION_URL || 'https://litric-pilot.g-18197853.workers.dev';
if (!/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(origin)) throw new Error('Origin Worker sekolah tidak sah.');
async function post(ticket, body) {
  try {
    return await fetch(origin + '/api/auth/bootstrap', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Litric-Setup-Key': ticket.setupKey },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20_000), redirect: 'error',
    });
  } catch { throw new Error('Sambungan setup tidak selesai. Tiada kunci atau password dicetak. Jangan ulang jika GPM sudah berjaya diwujudkan.'); }
}
try {
  if (process.argv.includes('--prepare')) {
    const ticket = newTicket(origin);
    saveTicket(ticket);
    // Only the hash and timestamp may leave the encrypted local ticket.
    console.log(JSON.stringify({ LITRIC_BOOTSTRAP_HASH: ticket.hash, LITRIC_BOOTSTRAP_EXPIRES_AT: String(ticket.expiresAt), expiresAtMalaysia: new Date(ticket.expiresAt).toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour12: false }), validForMinutes: 14 }));
  } else {
    const ticket = readTicket(origin);
    const probe = await post(ticket, {});
    if (probe.status === 409) throw new Error('GPM sudah disediakan. Akaun sedia ada tidak diubah.');
    let probeBody;
    try { probeBody = await probe.json(); } catch { throw new Error('Jawapan pelayan setup tidak sah.'); }
    if (probe.status !== 400 || !String(probeBody.error).startsWith('Kata laluan mesti'))
      throw new Error('Pasangan secret belum aktif atau telah tamat. Semak kedua-dua Value dan tekan Deploy di Cloudflare sebelum cuba semula.');
    console.log('Pasangan setup disahkan pada pelayan. Masukkan kata laluan sementara baharu.');
    let password = await hiddenInput('Kata laluan sementara GPM');
    let confirmation = await hiddenInput('Sahkan kata laluan sementara GPM');
    if (password !== confirmation || password.length < 10 || password.length > 128) throw new Error('Kata laluan mesti sepadan dan mempunyai 10–128 aksara.');
    confirmation = '';
    validateTicket(ticket, origin);
    const result = await post(ticket, { password });
    password = '';
    if (result.status === 409) throw new Error('GPM sudah disediakan. Akaun sedia ada tidak diubah.');
    if (!result.ok) throw new Error('Setup belum selesai (HTTP ' + result.status + '). Tiada password dicetak.');
    removeTicket();
    console.log('GPM setup completed. Log masuk sebagai GPM dan wajib tukar kata laluan pertama.');
    console.log('Login: ' + origin);
    console.log('Selepas berjaya, padam kedua-dua LITRIC_BOOTSTRAP_* secrets melalui Cloudflare dan tekan Deploy.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
