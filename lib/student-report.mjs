import { aggregate, norm, validScope } from './domain.mjs';

export const STATUS_LABELS = { current: 'Aktif', transferred: 'Berpindah', graduated: 'Tamat Sekolah', former: 'Tamat Sekolah', unconfirmed: 'Belum disahkan' };
export function studentReport(data, filters = {}, date = new Date()) {
  const year = Number(filters.academicYear || date.getUTCFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Tahun akademik tidak sah.');
  if (filters.status && !['all','current','transferred','graduated','archived'].includes(filters.status)) throw new Error('Status murid tidak sah.');
  if (filters.star && !['all','unknown','0','1','2','3','4','5'].includes(String(filters.star))) throw new Error('Tahap bintang tidak sah.');
  const batches = new Map(data.import_batches.map(b => [b.id,b]));
  const rows = data.ains_summaries.filter(r => batches.get(r.batch_id)?.status === 'active' && !['duplicate','rejected','excluded'].includes(r.status));
  const byStudent = new Map();
  for (const r of rows) { const id=r.canonical_id||r.student_id; if(!byStudent.has(id))byStudent.set(id,[]); byStudent.get(id).push(r); }
  const students = data.students.filter(s => !s.merged_into).map(s => {
    const history=(data.student_class_history||[]).filter(h=>(h.canonical_id||h.student_id)===s.id && Number(h.year)===year).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    return {...s, class_id: filters.academicYear ? (history[0]?.class_id || (Number(s.academic_year)===year ? s.class_id : null)) : s.class_id};
  }).filter(s => {
    const rr=byStudent.get(s.id)||[];
    const enrolled=!filters.academicYear || Number(s.academic_year)===year || (data.student_class_history||[]).some(h=>(h.canonical_id||h.student_id)===s.id&&Number(h.year)===year) || rr.some(r=>Number(batches.get(r.batch_id)?.year)===year);
    const status=filters.status||'all';
    return enrolled && (!filters.classId||s.class_id===filters.classId) && (!filters.search||norm(s.name+' '+(data.classes.find(c=>c.id===s.class_id)?.name||'')).includes(norm(filters.search))) &&
      (status==='all'||(status==='current' ? s.status==='current'&&!s.archived_at : status==='archived' ? !!s.archived_at : status==='graduated' ? ['former','graduated'].includes(s.status) : s.status===status));
  });
  const base={students, rows:data.ains_summaries, batches:data.import_batches, rule:data.rule};
  const lifetime=aggregate({...base,filters:{}}), annual=aggregate({...base,filters:{year:String(year)}});
  const years=[...new Set(rows.map(r=>batches.get(r.batch_id)?.year).filter(Boolean))].sort((a,b)=>a-b);
  const yearly=years.map(y=>({year:Number(y),metrics:aggregate({...base,filters:{year:String(y)}})}));
  let records=students.map(s=>{
    const rr=byStudent.get(s.id)||[], l=lifetime.students.find(x=>x.id===s.id), a=annual.students.find(x=>x.id===s.id);
    const pending=rr.some(r=>r.status!=='accepted' || batches.get(r.batch_id)?.verification!=='verified' || !batches.get(r.batch_id)?.star_eligible || !batches.get(r.batch_id)?.coverage_complete || !validScope(batches.get(r.batch_id)));
    const verified=rr.length>0 && l?.eligible!=null && !pending;
    const achievement=verified ? l.achievement : {level:null,marks:null,next:null,remaining:null};
    const verification=!rr.length?'Tiada rekod AINS':lifetime.blocked.includes(s.id)?'Pertindihan sumber':!verified?'Belum dapat disahkan / sejarah belum lengkap':data.rule.certified?'Disahkan':'Data disahkan; peraturan sekolah belum diperakui';
    const history=yearly.map(y=>{const v=y.metrics.students.find(x=>x.id===s.id);const source=rr.filter(r=>Number(batches.get(r.batch_id)?.year)===y.year);return {year:y.year,total:v?.eligible??null,reported:v?.reported??null,sources:[...new Set(source.map(r=>batches.get(r.batch_id)?.filename))].join('; '),verification:!v?'Tiada rekod AINS':v.eligible==null||source.some(r=>r.status!=='accepted'||batches.get(r.batch_id)?.verification!=='verified'||!batches.get(r.batch_id)?.coverage_complete)?'Belum dapat disahkan':'Jumlah disahkan'};}).filter(h=>h.sources);
    const unknown=rr.filter(r=>!batches.get(r.batch_id)?.year);
    if(unknown.length)history.push({year:'Belum disahkan',total:null,reported:null,sources:[...new Set(unknown.map(r=>batches.get(r.batch_id)?.filename))].join('; '),verification:'Tempoh belum disahkan'});
    return {...s,className:data.classes.find(c=>c.id===s.class_id)?.name||'Belum dipetakan',statusLabel:s.archived_at&&s.status==='current'?'Diarkib':STATUS_LABELS[s.status]||'Belum disahkan',hasAins:!!rr.length,annual:a?.eligible??null,total:l?.eligible??null,achievement,verification,verified,history};
  }).filter(s=>!filters.star||filters.star==='all'||(filters.star==='unknown'?s.achievement.level==null:String(s.achievement.level)===String(filters.star)));
  records.sort((a,b)=>a.name.localeCompare(b.name));
  return {year,records,statistics:{active:records.filter(s=>s.status==='current'&&!s.archived_at).length,withAins:records.filter(s=>s.hasAins).length,approved:records.reduce((n,s)=>n+(s.total??0),0),unknown:records.filter(s=>s.achievement.level==null).length,stars:Array.from({length:6},(_,level)=>records.filter(s=>s.achievement.level===level).length)}};
}

export const safeExcelText = value => {
  const text=String(value??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
  return /^[\s\uFEFF]*[=+\-@]/.test(text) ? "'"+text : text;
};
