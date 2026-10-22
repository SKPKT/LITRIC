// Return fixed guidance only: Wrangler output can contain private values.
export function needsWranglerLogin(result) {
  const output = String(result.stdout || '') + '\n' + String(result.stderr || '');
  return /non-interactive environment|not authenticated|not logged in|authentication error|invalid access token|\b10000\b/i.test(output);
}
export function setupFailure(result) {
  const output = String(result.stdout || '') + '\n' + String(result.stderr || '');
  if (needsWranglerLogin(result))
    return 'Sesi Wrangler tidak tersedia atau telah tamat. Jalankan arahan Wrangler login untuk akaun sekolah, kemudian cuba semula. Tidak perlu menghantar token atau kata laluan dalam chat.';
  if (/ECONNRESET|ENOTFOUND|ETIMEDOUT|fetch failed|network error/i.test(output))
    return 'Sambungan ke Cloudflare gagal. Semak Internet dan cuba semula. Tiada kata laluan atau secret dicetak.';
  if (/\b403\b|permission|not authorized/i.test(output))
    return 'Cloudflare menolak izin Workers Scripts. Sahkan semula Wrangler dengan skop workers_scripts:write pada akaun sekolah.';
  if (result.error?.code === 'ENOENT')
    return 'Proses Node/Wrangler tidak ditemui. Jalankan setup daripada direktori projek menggunakan laluan Node yang dibekalkan.';
  return 'Arahan Cloudflare tidak berjaya. Jalankan semakan --check sebelum setup semula. Tiada kata laluan atau secret dicetak.';
}
