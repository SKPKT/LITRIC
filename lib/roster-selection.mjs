
export function suggestedRosterAction(row) {
  return row.matchedId ? 'match' : 'create';
}

export function rosterIssue(row, decision, profile, year) {
  if (row.imported) return 'Baris telah diimport.';
  if (row.issues.length) return row.issues.join(' ');
  const {action, reason} = decision;
  const create = action==='create';
  if (!['create','match','update'].includes(action)) return 'Pilih tindakan.';
  if (create && row.matchedId) return 'Pengecam sudah dipautkan. Pilih Paut Profil atau Paut dan Kemaskini.';
  if (!create && (!profile || profile.merged_into)) return 'Pilih profil murid yang sah.';
  if (!create && row.matchedId && row.matchedId!==profile.id) return 'Pengecam sudah dimiliki oleh profil lain.';
  if (create && row.duplicateName && !row.hasIdentifier) return 'Nama berulang memerlukan pengecam unik.';
  const manualLink = !create && row.manual;
  if ((manualLink || row.conflict || row.duplicateName || create && row.exactName)
    && (typeof reason!=='string' || reason.trim().length<10 || reason.length>500))
    return 'Catat bukti identiti (10–500 aksara).';
  if (action==='update' && year && profile.academic_year && year<profile.academic_year)
    return 'Tahun lebih lama daripada profil. Pilih Paut Profil.';
  if (action==='update' && year && year!==profile.academic_year && profile.class_id && !row.className)
    return 'Isi kelas dalam fail untuk menukar tahun profil.';
  if ((create || action==='update') && row.className && !year && !profile?.academic_year)
    return 'Isi tahun akademik untuk menyimpan kelas.';
  return '';
}
