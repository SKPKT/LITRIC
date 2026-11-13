
import React, { useRef, useState } from 'react';
import { Check, Upload } from 'lucide-react';
import { Modal } from '../litric';
import { apiFetch } from '../../lib/client-api';
import { rosterIssue, suggestedRosterAction } from '../../lib/roster-selection.mjs';

const actions = {create:'Cipta Profil Baru',match:'Paut Profil',update:'Paut dan Kemaskini'};
type Action = keyof typeof actions;
type Decision = {action:Action,studentId?:string,reason?:string};
const emptySet = () => new Set<number>();

export default function RosterImport({ data, refresh, onClose }: any) {
  const [file,setFile]=useState<File|null>(null), [preview,setPreview]=useState<any>(null);
  const [busy,setBusy]=useState(''), [error,setError]=useState(''), [result,setResult]=useState<any>(null);
  const [decisions,setDecisions]=useState<Record<number,Decision>>({}), [bulk,setBulk]=useState('');
  const [selected,setSelected]=useState(emptySet), [provenance,setProvenance]=useState(false);
  const [year,setYear]=useState(''), [enrolled,setEnrolled]=useState(false);
  const sending=useRef(false);
  const people=data.students.filter((s:any)=>!s.merged_into);
  const profiles=new Map<string,any>(people.map((s:any)=>[s.id,s]));
  const rows=(preview?.rows||[]).map((row:any)=>{
    const decision=decisions[row.row] || {action:suggestedRosterAction(row)};
    const profile=profiles.get(row.matchedId || decision.studentId);
    const issue=rosterIssue(row,decision,profile,row.academicYear || (!profile?.academic_year && year ? Number(year):null));
    return {row,decision,profile,issue};
  });
  const ready=rows.filter((item:any)=>!item.issue);
  const distinctTargets=(items:any[])=>{
    const targets=new Set<string>();
    return items.filter(({decision,profile})=>{
      if (decision.action==='create') return true;
      if (targets.has(profile.id)) return false;
      targets.add(profile.id);
      return true;
    });
  };
  const selectable=distinctTargets(ready);
  const selectedReady=distinctTargets(ready.filter(({row}:any)=>selected.has(row.row)));
  const selectedRows=new Set(selectedReady.map(({row}:any)=>row.row));
  const attention=rows.filter(({row,issue}:any)=>!!issue&&!row.imported).length;
  const selectAll=()=>setSelected(new Set(selectable.map(({row}:any)=>row.row)));
  function toggle(row:number, profileId:string|undefined, checked:boolean) {
    setSelected(previous=>{
      const next=new Set(previous);
      if (!checked) next.delete(row);
      else {
        if (profileId) for (const item of rows) {
          if (item.decision.action!=='create' && item.profile?.id===profileId) next.delete(item.row.row);
        }
        next.add(row);
      }
      return next;
    });
  }
  function edit(row:number, decision:Decision) {
    setDecisions(previous=>({...previous,[row]:decision}));
    toggle(row,undefined,false);
  }
  function applyBulk(action:string) {
    setBulk(action);
    if (!action) {
      setDecisions({});
      return;
    }
    setDecisions(previous=>{
      const next={...previous};
      for (const {row} of rows) {
        if (row.imported || row.issues.length) continue;
        if (action==='create' ? row.matchedId || row.exactName || row.duplicateName : !row.matchedId || row.manual) continue;
        next[row.row]={action:action as Action,studentId:row.matchedId};
      }
      return next;
    });
  }
  async function send(source:File, commit=false) {
    if (sending.current) return;
    sending.current=true;
    setBusy(commit?'Menyimpan murid…':'Membaca fail…');
    setError('');
    try {
      const form=new FormData();
      form.set('file',source);
      form.set('kind','roster');
      if (commit) form.set('options',JSON.stringify({
        revision:preview.revision, provenance, academicYear:year, confirmEnrolled:enrolled,
        selection:selectedReady.map(({row}:any)=>row.row),
        decisions:Object.fromEntries(selectedReady.map(({row,decision}:any)=>[row.row,decision])),
      }));
      const response=await apiFetch('/api/bulk/'+(commit?'commit':'preview'),{method:'POST',body:form});
      const value:any=await response.json();
      if (!response.ok) {
        if (commit && response.status===409) {
          const latest=await apiFetch('/api/bulk/preview',{method:'POST',body:form});
          if (latest.ok) setPreview(await latest.json());
          throw new Error('Data telah berubah. Semak pilihan terkini dan tekan Sahkan Import semula.');
        }
        throw new Error(value.error);
      }
      if (commit) {
        if (value.batchId) {
          setResult(value);
          await refresh();
        } else {
          setError(value.resultRows.filter((r:any)=>r.result==='Perlu semakan').map((r:any)=>'Baris '+r.row+' — '+r.notes).join(' '));
        }
      } else {
        setPreview(value);
        setDecisions({});
        setBulk('');
        setSelected(emptySet());
      }
    } catch (e:any) {setError(e.message||'Import tidak dapat diteruskan.');}
    finally {sending.current=false;setBusy('');}
  }
  const invalidYear=!!year && (!/^\d{4}$/.test(year) || Number(year)<2000 || Number(year)>2100);
  return <Modal title="Import Senarai Murid" wide onClose={()=>{if(!sending.current)onClose();}}>
    <div className="roster-import">
      {result ? <>
        <h3 role="status">Import Murid Berjaya!</h3>
        <ul className="roster-result">
          <li>{result.stats.created} profil baharu dicipta.</li>
          <li>{result.stats.matched-result.stats.updated} profil berjaya dipautkan.</li>
          <li>{result.stats.updated} profil berjaya dikemas kini.</li>
          <li>{result.stats.review} rekod memerlukan semakan.</li>
        </ul>
        <details><summary>Keputusan setiap murid yang dipilih</summary>
          <ul className="roster-result">{result.resultRows.filter((r:any)=>r.result!=='Dilangkau').map((r:any)=>{
            const row=preview.rows.find((p:any)=>p.row===r.row);
            return <li key={r.row}>{row?.name||'Baris '+r.row} — {r.result}{r.notes?' · '+r.notes:''}</li>;
          })}</ul>
        </details>
        <button className="btn primary" onClick={onClose}>Kembali ke Pengurusan Murid</button>
      </> : <>
        <label className="roster-upload"><Upload size={17}/><span>Pilih fail Excel atau CSV</span>
          <input type="file" accept=".csv,.xlsx" disabled={!!busy} onChange={e=>{
            const source=e.target.files?.[0]||null;
            setFile(source);setPreview(null);setError('');setProvenance(false);
            if(source)void send(source);
          }}/>
        </label>
        {busy&&<p role="status" className="notice">{busy}</p>}
        {!preview&&!busy&&!error&&<p className="muted">Had 2 MB dan 500 baris. Pratonton dibuka sebaik sahaja fail dipilih.</p>}
        {preview&&<>
          <p className="roster-file"><strong>{preview.filename}</strong> · {rows.length} baris</p>
          {!preview.hasSchool&&<label className="bulk-check"><input type="checkbox" checked={provenance} disabled={!!busy} onChange={e=>setProvenance(e.target.checked)}/> Saya sahkan fail ini ialah senarai murid sekolah ABA6052.</label>}
          <div className="roster-options">
            <label>Tindakan pukal<select disabled={!!busy} value={bulk} onChange={e=>applyBulk(e.target.value)}>
              <option value="">Cadangan mengikut identiti</option>
              {Object.entries(actions).map(([key,label])=><option key={key} value={key}>{label}</option>)}
            </select></label>
            <label>Tahun akademik jika tiada dalam fail<input type="number" min={2000} max={2100} placeholder="Contoh: 2026" disabled={!!busy} value={year} onChange={e=>setYear(e.target.value)}/></label>
          </div>
          {rows.some(({row,decision}:any)=>!row.imported&&decision.action==='create')&&<label className="bulk-check"><input type="checkbox" disabled={!!busy} checked={enrolled} onChange={e=>setEnrolled(e.target.checked)}/> Tandakan profil baharu sebagai Aktif jika kelas dan tahun lengkap serta enrolmen disahkan.</label>}
          <div className="button-row">
            <label className="bulk-check"><input type="checkbox" disabled={!selectable.length||!!busy} checked={selectable.length>0&&selectedReady.length===selectable.length} onChange={e=>e.target.checked?selectAll():setSelected(emptySet())}/> Tandakan Semua</label>
            <button className="text-btn" disabled={!selected.size||!!busy} onClick={()=>setSelected(emptySet())}>Nyahpilih Semua</button>
          </div>
          <div className="table-scroll" role="region" aria-label="Pratonton murid" tabIndex={0}>
            <table className="roster-table">
              <thead><tr><th scope="col">✓</th><th scope="col">Nama Murid</th><th scope="col">ID DELIMa</th><th scope="col">Kelas</th><th scope="col">Tindakan</th><th scope="col">Status</th></tr></thead>
              <tbody>{rows.map(({row,decision,profile,issue}:any)=>{
                const fixed=!!row.matchedId, linking=decision.action!=='create';
                const needsEvidence=linking&&row.manual || row.duplicateName || !linking&&row.exactName;
                return <tr key={row.row}>
                  <td><input type="checkbox" aria-label={'Pilih murid baris '+row.row} disabled={!!issue||!!busy}
                    checked={selectedRows.has(row.row)} onChange={e=>toggle(row.row,linking?profile?.id:undefined,e.target.checked)}/></td>
                  <td><strong>{row.name||'Nama tiada'}</strong><small className="block muted">Baris {row.row}</small></td>
                  <td>{row.delima||'—'}</td>
                  <td>{row.className||'—'}{(row.academicYear||row.level)&&<small className="block muted">{row.academicYear||('Tahun / tingkatan '+row.level)}</small>}</td>
                  <td>{!row.issues.length&&!row.imported&&<>
                    <select aria-label={'Tindakan baris '+row.row} disabled={!!busy} value={decision.action} onChange={e=>edit(row.row,{action:e.target.value as Action,studentId:row.matchedId})}>
                      {Object.entries(actions).filter(([key])=>key!=='create'||!fixed).map(([key,label])=><option value={key} key={key}>{label}</option>)}
                    </select>
                    {linking&&!fixed&&<select aria-label={'Profil baris '+row.row} disabled={!!busy} value={decision.studentId||''} onChange={e=>edit(row.row,{...decision,studentId:e.target.value,reason:''})}>
                      <option value="">Pilih profil</option>
                      {people.map((p:any)=><option key={p.id} value={p.id}>{p.name} · {data.classes.find((c:any)=>c.id===p.class_id)?.name||'Tiada kelas'}{p.archived_at?' · Arkib':''}</option>)}
                    </select>}
                    {linking&&fixed&&<small className="block muted">{row.matchedName}</small>}
                    {needsEvidence&&<input aria-label={'Bukti identiti baris '+row.row} disabled={!!busy} placeholder="Catat bukti identiti" value={decision.reason||''} maxLength={500} onChange={e=>edit(row.row,{...decision,reason:e.target.value})}/>}
                  </>}</td>
                  <td><strong>{row.imported?'Telah diimport':row.duplicate?'Pendua':row.conflict?'Konflik':issue?'Perlu semakan':fixed?'Sedia · Profil sedia ada':'Sedia'}</strong>
                    {issue&&!row.imported&&<small className="block muted">{issue}</small>}
                    {!issue&&!row.hasIdentifier&&!linking&&<small className="block muted">Profil tanpa ID DELIMa</small>}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </>}
        {error&&<p role="alert" className="notice danger">{error}</p>}
        <div className="roster-footer">
          <span aria-live="polite">{selectedReady.length} dipilih · {attention} perlu semakan</span>
          <div className="button-row">
            <button className="btn" disabled={!!busy} onClick={onClose}>Batal</button>
            <button className="btn primary" disabled={!preview||!file||!!busy||!selectedReady.length||invalidYear||!preview.hasSchool&&!provenance} onClick={()=>{if(file)void send(file,true);}}>
              <Check size={17}/> Sahkan Import ({selectedReady.length} Murid)
            </button>
          </div>
        </div>
      </>}
    </div>
  </Modal>;
}
