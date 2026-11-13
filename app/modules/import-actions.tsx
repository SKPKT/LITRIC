
import React, { useState } from 'react';
import { Trash2, ShieldCheck } from 'lucide-react';
import { Modal, api } from '../litric';

export function DeleteImportButton({batch,mutate,notify}:any) {
  const [plan,setPlan]=useState<any>(null), [busy,setBusy]=useState(false), [error,setError]=useState('');
  async function preview() {
    setBusy(true);
    setError('');
    try {setPlan(await api('batch/delete-preview',{id:batch.id}));}
    catch(e:any){notify(e.message);}
    finally {setBusy(false);}
  }
  async function remove() {
    setBusy(true);
    setError('');
    try {await mutate('batch/delete',{id:plan.id,revision:plan.revision,confirmed:true});setPlan(null);}
    catch(e:any){setError(e.message);}
    finally {setBusy(false);}
  }
  return <>
    <button className="btn import-delete" disabled={busy} onClick={()=>void preview()}><Trash2 size={16}/> Padam</button>
    {plan&&<Modal title="Padam kelompok import" onClose={()=>{if(!busy)setPlan(null);}}>
      <div className="bulk-import-body">
        <p className="import-filename"><b>{plan.filename}</b></p>
        <p>Set data {plan.dataset}</p>
        <p>{plan.counts.ains_summaries} ringkasan AINS · {plan.counts.nilam_annual_reports} ringkasan tahunan NILAM · {plan.counts.ains_activity_records} rekod bacaan individu · {plan.counts.ains_snapshots} petikan AINS · {plan.counts.import_errors} rekod ralat.</p>
        {!!plan.linked&&<p>{plan.linked} rekod bacaan sekolah akan dinyahpaut daripada ringkasan dan dikekalkan.</p>}
        <p className="notice danger">{plan.totalsMayChange?'Jumlah bacaan dan pencapaian NILAM mungkin berubah selepas pemadaman. Laporan terdahulu yang masih sah boleh dipaparkan semula.':'Kelompok ini tidak menyumbang kepada jumlah NILAM semasa.'}</p>
        <p>Profil murid dan rekod daripada kelompok lain dikekalkan.</p>
        {error&&<p role="alert" className="notice danger">{error}</p>}
        <div className="button-row">
          <button className="btn" disabled={busy} onClick={()=>setPlan(null)}>Batal</button>
          <button className="btn import-delete" disabled={busy} onClick={()=>void remove()}><Trash2 size={16}/> {busy?'Memadam…':'Ya, Padam Import'}</button>
        </div>
      </div>
    </Modal>}
  </>;
}

export function VerifyNilamButton({batch,mutate}:any) {
  const [open,setOpen]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const [note,setNote]=useState(''), [confirmApproved,setApproved]=useState(false), [confirmComplete,setComplete]=useState(false);
  return <>
    <button className="btn" onClick={()=>{setError('');setOpen(true);}}><ShieldCheck size={16}/> Sahkan NILAM</button>
    {open&&<Modal title={'Sahkan laporan NILAM '+batch.year} onClose={()=>{if(!busy)setOpen(false);}}>
      <form className="bulk-import-body" onSubmit={async e=>{
        e.preventDefault();setError('');setBusy(true);
        try {await mutate('bulk/verify',{id:batch.id,note,confirmApproved,confirmComplete});setOpen(false);}
        catch(e:any){setError(e.message);}
        finally {setBusy(false);}
      }}>
        <p>Semak bukti kelulusan dan liputan sumber sebelum melayakkan jumlah ini untuk pencapaian NILAM.</p>
        <label className="bulk-check"><input type="checkbox" required checked={confirmApproved} onChange={e=>setApproved(e.target.checked)}/> Sumber mengira bacaan diluluskan sahaja.</label>
        <label className="bulk-check"><input type="checkbox" required checked={confirmComplete} onChange={e=>setComplete(e.target.checked)}/> Laporan meliputi tahun {batch.year} sepenuhnya.</label>
        <label>Rujukan bukti pengesahan<textarea required minLength={12} maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label>
        {error&&<p role="alert" className="notice danger">{error}</p>}
        <div className="button-row"><button type="button" className="btn" disabled={busy} onClick={()=>setOpen(false)}>Batal</button><button className="btn primary" disabled={busy||!confirmApproved||!confirmComplete||note.trim().length<12}>Sahkan jumlah tahunan</button></div>
      </form>
    </Modal>}
  </>;
}
