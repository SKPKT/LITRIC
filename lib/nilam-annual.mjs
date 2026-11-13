
export const NILAM_DATASET = 'Laporan Bacaan NILAM';
export const ROSTER_DATASET = 'Senarai Murid';

export function latestAnnualReports(rows, batches) {
  const byId = new Map(batches.map(b=>[b.id,b]));
  const latest = new Map();
  for (const row of rows) {
    const batch = byId.get(row.batch_id);
    if (batch?.status !== 'active') continue;
    const key = JSON.stringify([row.canonical_id || row.student_id, row.report_year]);
    const old = latest.get(key);
    if (!old || (batch.created_at + batch.id) > (byId.get(old.batch_id).created_at + old.batch_id)) latest.set(key,row);
  }
  return [...latest.values()];
}

export function annualOverlap(rows, batches, studentId, year) {
  const active = new Map(batches.filter(b=>b.status==='active' && b.dataset!==NILAM_DATASET && (b.year==null || Number(b.year)===year)).map(b=>[b.id,b]));
  return rows.some(r=>active.has(r.batch_id) && (r.canonical_id || r.student_id)===studentId && !['duplicate','rejected','excluded'].includes(r.status));
}

export function readingDataWithAnnualReports(data) {
  const nilam = latestAnnualReports(data.nilam_annual_reports || [],data.import_batches);
  if (!nilam.length) return data.ains_summaries;
  const legacy = data.ains_summaries;
  const current = nilam.map(r=>{
    const overlaps = annualOverlap(legacy,data.import_batches,r.canonical_id || r.student_id,r.report_year);
    const verified = data.import_batches.find(b=>b.id===r.batch_id)?.star_eligible && !overlaps;
    return {
      ...r, nilam_reported:r.reported, nilam_overlap:overlaps,
      approved:verified ? r.reported : null, rejected:0, measures:'{}', raw:'{}',
      status: overlaps ? 'review' : 'accepted',
    };
  });
  return [...data.ains_summaries,...current];
}
