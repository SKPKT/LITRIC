import { norm } from './domain.mjs';
export function planIdentities(rows, students, aliases, decisions = {}) {
  const fail=message=>{throw Object.assign(new Error(message),{status:409});};
  if (!decisions || typeof decisions!=='object' || Array.isArray(decisions)) fail('Pemetaan identiti tidak sah.');
  const people=new Map(students.map(s=>[s.id,s]));
  const canonical=id=>{const seen=new Set();while(people.get(id)?.merged_into&&!seen.has(id)){seen.add(id);id=people.get(id).merged_into;}return id;};
  const bySource=new Map(aliases.map(a=>[a.source_id,a]));
  const issues=[], targets=new Map();
  for(const r of rows){
    if(['rejected','duplicate'].includes(r.status))continue;
    const alias=bySource.get(r.sourceId), decision=decisions[String(r.rowNumber)];
    if(decision && (decision.confirmed!==true || typeof decision.reason!=='string' || decision.reason.trim().length<10 || decision.reason.length>1000))fail('Sahkan bukti padanan identiti dan sebab sekurang-kurangnya 10 aksara.');
    if(decision && decision.studentId!=='new' && (!people.has(decision.studentId)||people.get(decision.studentId).merged_into))fail('Profil padanan tidak dibenarkan.');
    if(alias && decision && canonical(alias.student_id)!==decision.studentId)fail('Pengecam telah dipautkan. Gunakan semakan gabungan identiti untuk mengekalkan sejarah.');
    const candidates=students.filter(s=>!s.merged_into&&norm(s.name)===norm(r.name));
    if(alias?.verified){targets.set(r.rowNumber,{studentId:canonical(alias.student_id)});continue;}
    if(decision){targets.set(r.rowNumber,{studentId:decision.studentId==='new'?null:decision.studentId,manual:true,reason:decision.reason.trim(),alias});continue;}
    if(alias || !r.sourceId || candidates.length){issues.push({rowNumber:r.rowNumber,name:r.name,sourceId:r.sourceId,candidates:candidates.map(s=>s.id),message:alias?'Pengecam belum disahkan.':!r.sourceId?'Pengecam sumber tiada. Pilih identiti dengan bukti.':'Nama tepat sudah ada; sahkan pengecam tanpa memadankan nama secara automatik.'});continue;}
    targets.set(r.rowNumber,{studentId:null});
  }
  return {issues,targets};
}
