
import React, { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Modal } from '../litric';
import { apiFetch, downloadProtected } from '../../lib/client-api';

const label: Record<string,string> = {
  name:'Nama',delima:'ID DELIMa',reference:'ID rujukan',level:'Tahun / tingkatan',className:'Kelas',
  status:'Status',school:'Kod sekolah',academicYear:'Tahun akademik',reported:'Jumlah dilaporkan',
};
const results: Record<string,string> = {
  created:'Profil dicipta',matched:'Profil dipadankan',updated:'Profil dikemas kini',summariesCreated:'Ringkasan baharu',
  summariesUpdated:'Ringkasan diganti',skipped:'Baris dilangkau',review:'Memerlukan semakan',
};

export default function BulkImport({ kind, data, refresh, notify, onClose }: any) {
  const nilam=kind==='nilam';
  const [file,setFile]=useState<File|null>(null), [preview,setPreview]=useState<any>(null), [result,setResult]=useState<any>(null);
  const [decisions,setDecisions]=useState<Record<number,any>>({}), [year,setYear]=useState(''), [provenance,setProvenance]=useState(false);
  const [busy,setBusy]=useState(''), [error,setError]=useState(''), [page,setPage]=useState(0);
  const edit=(row:number,p:object)=>setDecisions(d=>({...d,[row]:{...d[row],...p}}));
  async function send(commit: boolean) {
    if (!file) return;
    setBusy(commit?'Menyimpan import…':'Membaca dan memadankan fail…');
    setError('');
    try {
      const form=new FormData();
      form.set('file',file);
      form.set('kind',kind);
      if (commit) form.set('options',JSON.stringify({revision:preview.revision,provenance,academicYear:year,replace:true,decisions}));
      const response=await apiFetch('/api/bulk/'+(commit?'commit':'preview'),{method:'POST',body:form});
      const value:any=await response.json();
      if (!response.ok) throw new Error(value.error);
      if (commit) {
        setResult(value);
        notify(value.duplicate?'Fail ini telah diimport.':'Import berjaya disimpan.');
        await refresh();
      } else {
        setPreview(value);
        setPage(0);
        setDecisions(Object.fromEntries(value.rows.map((r:any)=>[r.row,{
          action:r.issues.length?'skip':r.matchedId&&!r.manual?'match':'',
          studentId:r.matchedId,
        }])));
      }
    } catch (e:any) {setError(e.message || 'Import tidak dapat diteruskan.');}
    finally {setBusy('');}
  }
  const people = [...data.students].sort((a:any,b:any)=>a.name.localeCompare(b.name));
  const checkedRows = preview?.rows.filter((r:any)=>decisions[r.row]?.action && decisions[r.row]?.action!=='skip').length || 0;
  const pendingRows = preview?.rows.filter((r:any)=>!decisions[r.row]?.action).length || 0;
  return (
    <Modal title={nilam?'Import Laporan Bacaan NILAM':'Import Senarai Murid'} onClose={()=>{if(!busy)onClose();}} wide>
      <div className="bulk-import-body">
        {busy&&<p role="status" className="notice">{busy}</p>}
        {error&&<p role="alert" className="notice warning">{error}</p>}
        {!result&&<div className="bulk-import-fields">
          <label><strong>Fail CSV atau Excel (XLSX)</strong>
            <input type="file" accept=".csv,.xlsx" disabled={!!busy} onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);setError('');setProvenance(false);setYear('');}}/>
          </label>
          <button className="btn primary" disabled={!file||!!busy} onClick={()=>void send(false)}><FileSpreadsheet size={17}/> Pratonton fail</button>
        </div>}
        {!preview&&!result&&<p className="muted">Sehingga 2 MB dan 500 baris bagi satu fail. Satu jadual diperlukan.</p>}
        {preview&&!result&&<>
          <h3>Semak dan padankan murid</h3>
          <p className="import-filename"><b>{preview.filename}</b> · {preview.format}{preview.year&&' · Tahun pelaporan '+preview.year}</p>
          <p className="muted">{Object.entries(preview.columns).map(([key,heading])=>heading+' → '+label[key]).join(' · ')}</p>
          <div className="bulk-summary">
            {Object.entries({rows:'Baris dikesan',complete:'Tahun/kelas lengkap',missing:'Tahun/kelas perlu semakan',duplicates:'Baris dengan ID pendua',invalidCounts:'Jumlah tidak sah',matched:'Profil dipadankan',newStudents:'Calon profil baharu',replacements:'Ringkasan sedia ada',overlaps:'Liputan bertindih',review:'Perlu semakan'}).map(([k,title])=>
              <div key={k}><b>{preview.summary[k]}</b><span>{title}</span></div>)}
          </div>
          {nilam&&<p className="notice">Jumlah tahunan akan disimpan sebagai bacaan dilaporkan. Pengesahan bacaan diluluskan dan liputan setahun penuh dibuat berasingan.</p>}
          {preview.existing&&<p className="notice">Fail ini sudah direkodkan. Muat turun keputusan daripada Import terkini.</p>}
          {!preview.hasSchool&&<label className="bulk-check"><input type="checkbox" checked={provenance} onChange={e=>setProvenance(e.target.checked)}/> Saya sahkan sumber fail ialah SK Pendidikan Khas Taiping (ABA6052).</label>}
          {!nilam&&<label className="bulk-year">Tahun akademik bagi baris yang tiada tahun kalendar
            <input type="number" min="2000" max="2100" placeholder="Contoh: 2026" value={year} onChange={e=>setYear(e.target.value)}/>
          </label>}
          {preview.rows.some((r:any)=>!r.issues.length&&!r.matchedId&&r.delima&&!r.exactName&&!r.duplicateName)&&
            <button type="button" className="btn" disabled={!!busy} onClick={()=>setDecisions(old=>{
              const next={...old};
              for (const r of preview.rows) if (!next[r.row]?.action && !r.issues.length && !r.matchedId && r.delima && !r.exactName && !r.duplicateName)
                next[r.row]={action:'create'};
              return next;
            })}>Pilih cipta bagi ID DELIMa baharu yang tiada padanan</button>}
          {preview.rows.some((r:any)=>decisions[r.row]?.action==='create'&&!r.issues.length&&r.delima&&!r.exactName&&!r.duplicateName&&!decisions[r.row]?.confirmed)&&
            <button className="btn" disabled={!!busy} onClick={()=>setDecisions(old=>{
              const next={...old};
              for(const r of preview.rows) if(next[r.row]?.action==='create'&&r.delima&&!r.exactName&&!r.duplicateName)
                next[r.row]={...next[r.row],confirmed:true};
              return next;
            })}>Sahkan semua ID baharu yang telah disemak</button>}
          {!nilam&&preview.rows.some((r:any)=>decisions[r.row]?.action==='create'&&!r.missing)&&
            <button className="btn" disabled={!!busy} onClick={()=>setDecisions(old=>{
              const next={...old};
              for(const r of preview.rows) if(next[r.row]?.action==='create'&&!r.missing&&(!r.status||r.status==='current')) next[r.row]={...next[r.row],enrolled:true};
              return next;
            })}>Sahkan enrolmen murid baharu dengan tahun/kelas lengkap</button>}
          <div className="table-scroll">
            <table className="bulk-preview-table">
              <thead><tr><th>Baris / murid</th><th>Tahun / kelas</th>{nilam&&<th>Bacaan</th>}<th>Semakan</th><th>Keputusan GPM</th></tr></thead>
              <tbody>{preview.rows.slice(page*12,(page+1)*12).map((r:any)=>{
                const d=decisions[r.row]||{}, needConfirm=d.action==='create'||d.action==='update'||r.manual;
                const needReason=r.conflict||r.exactName&&d.action==='create'||r.duplicateName||!r.delima&&!r.reference;
                const prior=preview.priorByStudent[d.studentId||r.matchedId]??null;
                const overlap=preview.overlappingStudents.includes(d.studentId||r.matchedId);
                return <tr key={r.row}>
                  <td><b>{r.row}. {r.name||'Nama tiada'}</b><small className="block import-filename">{r.delima||r.reference||'Pengecam tiada'}</small>{r.matchedName&&<small className="block">Profil: {r.matchedName}</small>}</td>
                  <td>{r.level||'Belum diisi'} / {r.className||'Belum diisi'}{r.academicYear&&<small className="block">{r.academicYear}</small>}{r.status&&<small className="block">{{current:'Aktif',transferred:'Berpindah',graduated:'Tamat sekolah',unconfirmed:'Belum disahkan'}[r.status as string]}</small>}</td>
                  {nilam&&<td>{prior!==null&&<small className="block">{prior} →</small>}{r.reported??'Tidak sah'}{prior!==null&&r.reported<prior&&<small className="block">Jumlah menurun</small>}</td>}
                  <td>{r.issues.join(' ')}{r.missing&&<div>Tahun/kelas belum lengkap.</div>}{r.conflict&&<div>Nama atau pengecam bercanggah.</div>}{overlap&&<div>Liputan AINS bertindih.</div>}{r.protectedStatus&&<div>Status arkib dikekalkan.</div>}</td>
                  <td><select aria-label={'Keputusan baris '+r.row} disabled={!!busy} value={d.action||''} onChange={e=>edit(r.row,{action:e.target.value,confirmed:false,replace:false})}>
                    <option value="">Pilih keputusan</option>
                    {!r.issues.length&&<>
                      {!r.matchedId&&<option value="create">Cipta profil baharu</option>}
                      <option value="match">Paut kepada profil</option>
                      {!nilam&&<option value="update">Paut dan kemas kini profil</option>}
                    </>}
                    <option value="skip">Langkau baris</option>
                  </select>
                  {['match','update'].includes(d.action)&&!r.matchedId&&<select aria-label={'Profil untuk baris '+r.row} value={d.studentId||''} disabled={!!busy} onChange={e=>edit(r.row,{studentId:e.target.value,confirmed:false,replace:false})}>
                    <option value="">Pilih profil</option>
                    {people.map((s:any)=><option value={s.id} key={s.id}>{s.name} · {data.classes.find((c:any)=>c.id===s.class_id)?.name||'Kelas belum dipetakan'}{s.archived_at?' · Arkib':''}</option>)}
                  </select>}
                  {d.action&&d.action!=='skip'&&needConfirm&&<label className="bulk-check"><input type="checkbox" disabled={!!busy} checked={!!d.confirmed} onChange={e=>edit(r.row,{confirmed:e.target.checked})}/> {d.action==='update'?'Sahkan kemas kini nama/tahun/kelas':'Sahkan bukti identiti'}</label>}
                  {d.action&&d.action!=='skip'&&needReason&&<input aria-label={'Bukti identiti baris '+r.row} placeholder="Bukti identiti (10 aksara)" maxLength={500} value={d.reason||''} onChange={e=>edit(r.row,{reason:e.target.value})}/>}
                  {!nilam&&d.action==='create'&&!r.missing&&(!r.status||r.status==='current')&&<label className="bulk-check"><input type="checkbox" disabled={!!busy} checked={!!d.enrolled} onChange={e=>edit(r.row,{enrolled:e.target.checked})}/> Enrolmen aktif disahkan</label>}
                  {nilam&&d.action==='match'&&prior!==null&&<label className="bulk-check"><input type="checkbox" disabled={!!busy} checked={!!d.replace} onChange={e=>edit(r.row,{replace:e.target.checked})}/> Sahkan jumlah gantian</label>}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div className="button-row">
            <button className="btn" disabled={page===0||!!busy} onClick={()=>setPage(page-1)}>Sebelumnya</button>
            <span>Halaman {page+1} / {Math.ceil(preview.rows.length/12)}</span>
            <button className="btn" disabled={(page+1)*12>=preview.rows.length||!!busy} onClick={()=>setPage(page+1)}>Seterusnya</button>
          </div>
          <div className="button-row">
            <button className="btn" disabled={!!busy} onClick={onClose}>Batal</button>
            <button className="btn primary" disabled={!!busy||preview.existing||!checkedRows||!!pendingRows||!preview.hasSchool&&!provenance} onClick={()=>void send(true)}>Sahkan import ({checkedRows})</button>
            {!!pendingRows&&<span className="muted">{pendingRows} baris belum dipilih.</span>}
          </div>
        </>}
        {result&&<>
          <h3>{result.duplicate?'Fail telah diimport':'Keputusan import'}</h3>
          <p>{new Date(result.createdAt).toLocaleString('ms-MY')} · {result.staff}</p>
          <div className="bulk-summary">{Object.entries(results).map(([k,title])=><div key={k}><b>{result.stats?.[k]??0}</b><span>{title}</span></div>)}</div>
          {result.resultRows?.filter((r:any)=>r.notes).length>0&&<details><summary>Butiran baris</summary><ul>{result.resultRows.filter((r:any)=>r.notes).map((r:any)=><li key={r.row}>Baris {r.row} · {r.result} · {r.notes}</li>)}</ul></details>}
          <div className="button-row"><button className="btn" onClick={()=>downloadProtected('/api/bulk/result?batch='+result.batchId).catch(e=>setError(e.message))}><Download size={16}/> Muat turun keputusan</button><button className="btn primary" onClick={onClose}>Tutup</button></div>
        </>}
      </div>
    </Modal>
  );
}
