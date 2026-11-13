import React, { useState } from 'react';
import { FileSpreadsheet, Search } from 'lucide-react';
import { downloadProtected } from '../../lib/client-api';
import { studentReport } from '../../lib/student-report.mjs';

export function useStudentReport(data:any){
  const [filters,setFilters]=useState({status:'all',academicYear:'',classId:'',star:'all',search:''});
  return {filters,setFilters,report:studentReport(data,filters)};
}
export function StudentReportControls({data,filters,setFilters,notify}:any){
  const [busy,setBusy]=useState(false);
  const change=(key:string,value:string)=>setFilters((v:any)=>({...v,[key]:value}));
  const years=[...new Set([new Date().getFullYear(),...data.students.map((s:any)=>s.academic_year),...data.import_batches.map((b:any)=>b.year),...(data.student_class_history||[]).map((h:any)=>h.year)].filter(Boolean))].sort((a:any,b:any)=>b-a);
  return <section className="student-report-controls" aria-label="Penapis murid dan eksport Excel">
    <label>Carian nama atau kelas<span className="input-icon"><Search size={16}/><input value={filters.search} placeholder="Cari nama murid atau kelas…" onChange={e=>change('search',e.target.value)}/></span></label>
    <label>Status murid<select value={filters.status} onChange={e=>change('status',e.target.value)}><option value="all">Semua murid</option><option value="current">Murid aktif</option><option value="transferred">Murid berpindah</option><option value="graduated">Tamat sekolah</option><option value="archived">Semua arkib</option></select></label>
    <label>Tahun akademik<select value={filters.academicYear} onChange={e=>change('academicYear',e.target.value)}><option value="">Semua tahun</option>{years.map((year:any)=><option key={year} value={year}>{year}</option>)}</select></label>
    <label>Kelas<select value={filters.classId} onChange={e=>change('classId',e.target.value)}><option value="">Semua kelas</option>{data.classes.map((c:any)=><option key={c.id} value={c.id}>{c.name} · {c.year}</option>)}</select></label>
    <label>Pencapaian bintang<select value={filters.star} onChange={e=>change('star',e.target.value)}><option value="all">Semua pencapaian</option>{[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n} Bintang</option>)}<option value="unknown">Belum dapat disahkan</option></select></label>
    <button className="btn primary" disabled={busy} onClick={async()=>{setBusy(true);try{await downloadProtected('/api/report?format=xlsx&'+new URLSearchParams(filters));notify('Fail Excel berjaya dimuat turun.');}catch(e:any){notify(e.message);}finally{setBusy(false);}}}><FileSpreadsheet size={18}/>{busy?'Menjana Excel…':'Eksport Excel'}</button>
    <p className="report-scope-note">Eksport mengikut penapis di atas. Bacaan terkumpul merangkumi semua tahun; rekod tiada atau belum lengkap tidak dianggap sifar pencapaian.</p>
  </section>;
}
