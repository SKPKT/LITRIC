import { validScope } from './domain.mjs';

export const MISSING_AINS_CAUTION = 'Tiada rekod AINS tidak membuktikan murid tidak membaca. Semak rekod guru, bacaan berbantu dan sumber luar AINS sebelum membuat kesimpulan.';
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const truth = value => value === true || value === 1;
const overlaps = (a, start, end) => a.period_start <= end && a.period_end >= start;
const nextDay = value => new Date(Date.parse(value) + 86_400_000).toISOString().slice(0,10);
const studentId = row => row.canonical_id || row.student_id;

function completeCoverage(batches, start, end) {
  let cursor = start;
  for (const batch of batches.filter(b => truth(b.coverage_complete)).sort((a,b) => a.period_start.localeCompare(b.period_start))) {
    if (batch.period_end < cursor) continue;
    if (batch.period_start > cursor) return false;
    if (batch.period_end >= end) return true;
    cursor = nextDay(batch.period_end);
  }
  return false;
}

/** Called only after loadData(user) has applied school, class and canonical
 * identity restrictions. No network calls, loans-to-reading conversion, model
 * prompts or writes. Summary periods are never treated as event dates.
 */
export function analyseAins(data, options = {}, clock = new Date()) {
  const today = clock.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
  const start = options.start ?? today.slice(0,4) + '-01-01', end = options.end ?? today;
  if (!day(start) || !day(end) || start > end || end > today)
    throw Object.assign(new Error('Pilih julat tarikh sah yang tidak melebihi hari ini.'), { status: 400 });
  const classId = options.classId ?? '';
  if (typeof classId !== 'string' || classId.length > 150)
    throw Object.assign(new Error('Penapis kelas tidak sah.'), { status: 400 });
  const students = data.students.filter(s => s.status === 'current' && !s.archived_at && !s.merged_into && (!classId || s.class_id === classId));
  const accessible = new Set(students.map(s => s.id));
  const active = data.import_batches.filter(b => b.status === 'active');
  const verified = active.filter(b => b.verification === 'verified' && validScope(b)
    && (b.snapshot_date || b.period_end) <= today);
  const selected = verified.filter(b => overlaps(b,start,end));
  const verifiedIds = new Set(verified.map(b => b.id));
  const selectedMap = new Map(selected.map(b => [b.id,b]));
  const activeMap = new Map(active.map(b => [b.id,b]));
  const seen = new Map(), uncertain = new Set(), needsReview = new Set();
  for (const row of data.ains_summaries) {
    const id = studentId(row), batch = activeMap.get(row.batch_id);
    if (!accessible.has(id) || !batch || ['duplicate','rejected','excluded'].includes(row.status)) continue;
    if (!verifiedIds.has(batch.id)) {
      if (!validScope(batch) || overlaps(batch,start,end)) needsReview.add(id);
      continue;
    }
    if (!selectedMap.has(batch.id)) continue;
    if (row.status !== 'accepted') { needsReview.add(id); continue; }
    if (batch.granularity === 'event') {
      let raw;
      try { raw = typeof row.raw === 'string' ? JSON.parse(row.raw) : row.raw; } catch { uncertain.add(id); continue; }
      if (!Array.isArray(raw?.events) || raw.events.some(e => !day(e.reading_date))) { uncertain.add(id); continue; }
      if (raw.events.some(e => e.reading_date >= start && e.reading_date <= end))
        seen.set(id, [...(seen.get(id) || []), { batchId: batch.id, zeroApproved: false }]);
    } else if (batch.period_start >= start && batch.period_end <= end) {
      if (!Number.isSafeInteger(row.approved) || row.approved < 0) { needsReview.add(id); continue; }
      seen.set(id, [...(seen.get(id) || []), { batchId: batch.id, zeroApproved: row.approved === 0 }]);
    } else {
      // An annual total cannot establish whether a particular month had entries.
      uncertain.add(id);
    }
  }
  const records = students.map(s => {
    const evidence = seen.get(s.id) || [];
    const classification = evidence.length ? evidence.every(e => e.zeroApproved) ? 'zero_approved_in_summary' : 'recorded_entry'
      : needsReview.has(s.id) ? 'requires_review' : uncertain.has(s.id) ? 'period_unknown'
      : !selected.length ? 'coverage_unavailable' : 'no_entry_in_available_sources';
    return { id: s.id, name: s.name, className: data.classes.find(c => c.id === s.class_id)?.name || 'Kelas belum dipetakan',
      classification, sourceBatchIds: [...new Set(evidence.map(e => e.batchId))] };
  });
  const counts = Object.fromEntries(['recorded_entry','zero_approved_in_summary','requires_review','period_unknown','coverage_unavailable','no_entry_in_available_sources']
    .map(key => [key,records.filter(r => r.classification === key).length]));
  return {
    period: { start,end,classId }, rosterScope: 'Murid semasa dalam skop akses guru; kelas semasa',
    studentCount: records.length, counts, records,
    coverageComplete: completeCoverage(selected,start,end),
    latestAinsReportingDate: verified.map(b => b.snapshot_date || b.period_end).sort().at(-1) || null,
    latestAinsImportAt: active.map(b => b.created_at).filter(Boolean).sort().at(-1) || null,
    unverifiedSourceCount: active.filter(b => !verifiedIds.has(b.id)).length,
    sources: selected.map(b => ({ id:b.id, filename:b.filename, start:b.period_start, end:b.period_end,
      reportingDate:b.snapshot_date || b.period_end, granularity:b.granularity, coverageComplete:truth(b.coverage_complete) })),
    caution: MISSING_AINS_CAUTION,
    limitations: [
      'Analisis menggunakan sumber AINS yang diimport dan disahkan sahaja. Tarikh import bukan tarikh laporan.',
      'Ringkasan tahunan tidak dipecahkan kepada bulan tanpa bukti tarikh peristiwa.',
      'Pinjaman buku tidak menambah jumlah bacaan atau pencapaian NILAM.',
      'Tiada inferens tentang diagnosis, keupayaan atau minat murid dibuat.',
    ],
  };
}

/** Evidence-based, rule-driven answers; never presented as an external LLM. */
export function answerAinsQuestion(analysis, question, connection, clock = new Date()) {
  if (typeof question !== 'string' || !question.trim() || question.length > 2000)
    throw Object.assign(new Error('Soalan diperlukan; maksimum 2,000 aksara.'), { status: 400 });
  const q = question.toLowerCase();
  const catalogue = /buku|book|katalog|catalog|isbn|ddc|pengarang|author|tajuk|title/.test(q);
  const circulation = /pinjam|loan|overdue|lewat|pulang|return|availability|tersedia|available/.test(q);
  const plan = /pelan|plan|intervensi|intervention|tindakan|action|galakan|follow/.test(q);
  const ains = /ains|analisis|analys|rekod|record|baca|reading|murid|student|entri|entry|liputan|coverage|laporan|report/.test(q);
  const focus = analysis.records.filter(r => ['no_entry_in_available_sources','zero_approved_in_summary'].includes(r.classification));
  const lines = [
    `Tempoh ${analysis.period.start} hingga ${analysis.period.end}: ${analysis.studentCount} murid semasa dalam skop akses anda.`,
    analysis.sources.length
      ? `${analysis.counts.no_entry_in_available_sources} murid tiada entri dalam sumber disahkan yang dapat dinilai; ${analysis.counts.zero_approved_in_summary} murid mempunyai ringkasan dengan sifar bacaan diluluskan. Kedua-dua kategori ini berbeza.`
      : 'Tiada sumber AINS disahkan yang meliputi tempoh ini. Saya tidak boleh menentukan murid tanpa entri bagi tempoh tersebut.',
    `${analysis.counts.period_unknown} murid mempunyai tempoh ringkasan yang tidak cukup terperinci; ${analysis.counts.requires_review} murid memerlukan semakan sumber.`,
    analysis.caution,
  ];
  if (!ains && !plan && !catalogue && !circulation) lines.unshift('Soalan ini belum disokong oleh penganalisis berasaskan peraturan. Saya boleh menyemak AINS, liputan laporan dan draf susulan guru. Ringkasan bukti yang tersedia diberikan di bawah.');
  if (!analysis.coverageComplete) lines.push('Liputan laporan tidak lengkap. Senarai susulan hanya merujuk sumber yang tersedia.');
  if (catalogue || circulation) lines.push('SMARTLIB Integration: NOT VERIFIED. Katalog, ketersediaan, pemulangan dan pinjaman lewat tidak tersedia. Saya tidak akan mencipta judul atau menyimpulkan status pinjaman.');
  const followUpPlan = plan && focus.length ? [
    { title:'Semak bukti bersama guru', detail:'Sahkan tempoh laporan, identiti murid dan bacaan yang direkod di luar AINS sebelum memilih murid untuk sokongan.' },
    { title:'Pilih sokongan yang sesuai', detail:'Cadangan untuk semakan guru: sesi bacaan berbantu ringkas, teks bercetak jelas, bahan visual atau audio mengikut pilihan dan keperluan yang dinyatakan oleh murid; jangan infer diagnosis.' },
    { title:'Pilih buku selepas katalog disahkan', detail:'Guru menentukan bahasa, tahap teks dan minat. Judul serta naskhah tersedia hanya boleh dicadangkan selepas pengesahan SMARTLIB.' },
    { title:'Semak kemajuan', detail:'Guru menetapkan tarikh susulan dan merekod bukti bacaan sebenar melalui aliran kerja sedia ada. Pinjaman sahaja bukan bukti bacaan selesai.' },
  ] : [];
  if (plan) lines.push(followUpPlan.length ? `Draf pelan tersedia untuk ${focus.length} murid; guru mesti menyemak bukti sebelum bertindak.` : 'Tiada bukti mencukupi untuk menghasilkan pelan khusus murid dalam skop ini.');
  return {
    mode:'rule_based_verified_ains', generatedAt:clock.toISOString(), languageModelConfigured:false,
    answer:lines.join('\n\n'), followUpPlan,
    focusStudentIds: plan ? focus.map(r => r.id) : [],
    connection, catalogueRecommendations:[], overdueLoans:null,
    analysis,
  };
}
