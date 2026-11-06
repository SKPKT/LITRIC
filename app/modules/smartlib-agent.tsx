import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, BookOpen, Check, Clock3, FileCheck2, LockKeyhole, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { apiFetch } from '../../lib/client-api';
import { SmartlibConnection } from './smartlib-connection';
import './smartlib-agent.css';

type AgentResult = ReturnType<typeof import('../../lib/smartlib-agent.mjs').answerAinsQuestion>;
type Message = { role:'teacher'|'agent'; text:string; period?:string };
type AinsRecord = {id:string;name:string;className:string;classification:string;sourceBatchIds:string[]};
type AinsSource = {id:string;filename:string;start:string;end:string;granularity:string};
type MascotState = 'standby'|'analyzing'|'completed';
const stateLabels = { standby:'Standby', analyzing:'Analyzing', completed:'Completed' };
const classifications: Record<string,string> = {
  no_entry_in_available_sources:'Tiada entri dalam sumber tersedia', zero_approved_in_summary:'Ringkasan: sifar bacaan diluluskan',
  requires_review:'Sumber perlu semakan', period_unknown:'Tempoh tidak dapat dipastikan',
  coverage_unavailable:'Liputan disahkan tiada', recorded_entry:'Entri direkodkan',
};
const formatDate = (date?:string|null) => date ? new Date(date).toLocaleString('ms-MY',{timeZone:'Asia/Kuala_Lumpur'}) + ' MYT' : 'Belum disahkan';

export function AgentMascot({ state }: {state:MascotState}) {
  return <div className="agent-mascot" data-state={state} role="img" aria-label={'SMARTLIB Agent — ' + stateLabels[state]}>
    <div className="agent-orbit agent-orbit-back" aria-hidden="true"/>
    <div className="agent-robot" aria-hidden="true">
      <div className="robot-antenna"><span/></div>
      <div className="robot-ear robot-ear-left"/><div className="robot-ear robot-ear-right"/>
      <div className="robot-head"><div className="robot-face"><span className="robot-eye"/><span className="robot-eye"/><span className="robot-smile"/><div className="robot-scan"/></div><span className="robot-head-shine"/></div>
      <div className="robot-neck"/>
      <div className="robot-arm robot-arm-left"/><div className="robot-arm robot-arm-right"/>
      <div className="robot-body"><span className="robot-emblem"><BookOpen size={22}/></span><span className="robot-body-light"/></div>
    </div>
    <div className="agent-orbit agent-orbit-front" aria-hidden="true"/><div className="robot-shadow" aria-hidden="true"/>
  </div>;
}

export function SmartlibAgent({ data }: {data:any}) {
  const today = new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});
  const [start,setStart] = useState(today.slice(0,4)+'-01-01'), [end,setEnd] = useState(today), [classId,setClassId] = useState('');
  const [question,setQuestion] = useState(''), [messages,setMessages] = useState<Message[]>([]);
  const [result,setResult] = useState<AgentResult|null>(null), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [reviewChecked,setReviewChecked] = useState(false);
  const [planReview,setPlanReview] = useState<{name:string;at:string}|null>(null);
  const controller = useRef<AbortController|null>(null);
  const log = useRef<HTMLDivElement|null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; },[messages,busy]);
  const state:MascotState = busy ? 'analyzing' : result ? 'completed' : 'standby';
  const reset = () => { setResult(null); setMessages([]); setError(''); setReviewChecked(false); setPlanReview(null); };
  const classes = data.classes.filter((c:any) => data.user.role === 'admin' || data.students.some((s:any) => s.class_id === c.id));
  async function ask(value:string) {
    if (busy || !value.trim()) return;
    if (!start || !end || start > end || end > today) { setError('Pilih julat tarikh sah dahulu.'); return; }
    setBusy(true); setError(''); setQuestion(''); setResult(null);
    setReviewChecked(false); setPlanReview(null);
    setMessages(previous => [...previous.slice(-8),{role:'teacher',text:value,period:start+' → '+end}]);
    const request = new AbortController(); controller.current = request;
    const timeout = setTimeout(() => request.abort(), 20_000);
    try {
      const response = await apiFetch('/api/smartlib/agent',{
        method:'POST',headers:{'Content-Type':'application/json'},signal:request.signal,
        body:JSON.stringify({question:value,start,end,classId}),
      });
      const answer:any = await response.json();
      if (!response.ok) throw new Error(answer.error || 'Analisis tidak berjaya.');
      if (request.signal.aborted) return;
      setResult(answer);
      setMessages(previous => [...previous,{role:'agent',text:answer.answer,period:answer.analysis.period.start+' → '+answer.analysis.period.end}]);
    } catch (failure:any) {
      setError(request.signal.aborted ? 'Permintaan dihentikan atau mengambil masa terlalu lama. Tiada hasil analisis disahkan.' : failure.message);
    } finally { clearTimeout(timeout); if (controller.current === request) { controller.current = null; setBusy(false); } }
  }
  return <div className="agent-workspace">
    <div className="agent-grid">
      <section className="agent-introduction" aria-labelledby="agent-title">
        <div className="agent-eyebrow"><Sparkles size={15}/> RAKAN LITERASI GURU</div>
        <h2 id="agent-title">SMARTLIB <span>Agent</span></h2>
        <p>Daripada rekod bacaan,<br/><strong>kepada langkah bermakna.</strong></p>
        <AgentMascot state={state}/>
        <div className={'agent-state agent-state-'+state} role="status"><span/>{stateLabels[state]}{state === 'completed' && ' · semakan AINS'}</div>
        <div className="agent-trust"><ShieldCheck size={17}/><span>Berpandukan bukti.<br/>Keputusan kekal di tangan guru.</span></div>
      </section>
      <section className="agent-conversation" aria-labelledby="agent-conversation-title" aria-busy={busy}>
        <header><div><span className="agent-eyebrow">RUANG PERBUALAN</span><h3 id="agent-conversation-title">Apa yang ingin cikgu terokai?</h3></div><MessageCircle size={22}/></header>
        <div className="agent-period">
          <label>Dari<input type="date" value={start} max={end} disabled={busy} onChange={e=>{setStart(e.target.value);reset();}}/></label>
          <label>Hingga<input type="date" value={end} min={start} max={today} disabled={busy} onChange={e=>{setEnd(e.target.value);reset();}}/></label>
          <label>Kelas semasa<select value={classId} disabled={busy} onChange={e=>{setClassId(e.target.value);reset();}}><option value="">Semua dalam skop akses</option>{classes.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </div>
        <div className="agent-messages" ref={log} role="log" tabIndex={0} aria-label="Perbualan bersama SMARTLIB Agent" aria-live="polite" aria-relevant="additions">
          {!messages.length && <div className="agent-conversation-empty"><span className="agent-mini-mark"><Sparkles size={23}/></span><h4>Mari fahami rekod yang tersedia.</h4><p>Tanya tentang AINS dalam tempoh pilihan. Saya akan nyatakan sumber, batas data dan perkara yang belum dapat disahkan.</p><p className="agent-unavailable"><LockKeyhole size={14}/> SMARTLIB Integration: NOT VERIFIED</p></div>}
          {messages.map((message,i)=><article className={'agent-message agent-message-'+message.role} key={i}><span>{message.role==='teacher'?'Anda':'SMARTLIB Agent'}<small>{message.period}</small></span><p>{message.text}</p></article>)}
          {busy && <div className="agent-processing" role="status"><span/>Menyemak skop akses, tempoh dan sumber AINS…</div>}
        </div>
        {error && <p className="agent-error" role="alert">{error}</p>}
        <div className="agent-prompts">{['Analisis AINS','Murid tanpa entri AINS','Pelan galakan membaca','Buku SMARTLIB tersedia'].map(prompt=><button key={prompt} disabled={busy} onClick={()=>void ask(prompt)}>{prompt}</button>)}</div>
        <form className="agent-question" onSubmit={e=>{e.preventDefault();void ask(question);}}>
          <label className="sr-only" htmlFor="agent-question">Soalan untuk SMARTLIB Agent</label>
          <textarea id="agent-question" rows={2} maxLength={2000} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Tanya tentang rekod AINS atau draf tindakan guru…" disabled={busy} required/>
          <button className="btn primary" disabled={busy||!question.trim()} aria-label="Hantar soalan"><ArrowUp size={20}/></button>
        </form>
        <p className="agent-method"><LockKeyhole size={12}/> Pengiraan dan peraturan pelayan atas data disahkan. Model bahasa generatif belum dikonfigurasi. Soalan tidak disimpan sebagai sejarah kekal.</p>
      </section>
    </div>

    <SmartlibConnection/>
    <div className="agent-freshness"><span><FileCheck2 size={16}/> Laporan AINS terkini: <b>{result?.analysis.latestAinsReportingDate || 'Belum disahkan'}</b></span><span><Clock3 size={16}/> SMARTLIB disegerakkan: <b>Belum disahkan</b></span><span>Analisis terakhir: <b>{formatDate(result?.generatedAt)}</b></span></div>
    <div className="agent-insights">
      <section className="agent-insight"><div className="agent-section-title"><span>01</span><h3>Analisis Bacaan AINS</h3></div>
        {result ? <><div className="agent-counts"><div><b>{result.analysis.studentCount}</b><span>Murid dalam skop</span></div><div><b>{result.analysis.counts.no_entry_in_available_sources}</b><span>Tiada entri dalam sumber tersedia</span></div><div><b>{result.analysis.counts.zero_approved_in_summary}</b><span>Ringkasan sifar diluluskan</span></div></div>
          <p className="muted">{result.analysis.period.start} → {result.analysis.period.end}. {result.analysis.coverageComplete?'Liputan sumber lengkap.':'Liputan sumber belum lengkap.'}</p>
          <p className="agent-caution">{result.analysis.caution}</p>
          <details><summary>Semak murid &amp; bukti ({result.analysis.records.length})</summary><div className="agent-student-list" role="region" tabIndex={0} aria-label="Senarai murid dan bukti AINS">{result.analysis.records.map((record:AinsRecord)=><article key={record.id}><strong>{record.name}</strong><span>{record.className} · {classifications[record.classification]}</span><small>Sumber: {record.sourceBatchIds.join(', ') || 'Tiada bukti yang mencukupi'}</small></article>)}</div></details>
          <details><summary>Sumber laporan ({result.analysis.sources.length})</summary>{result.analysis.sources.map((source:AinsSource)=><p key={source.id}>{source.filename} · {source.start} → {source.end} · {source.granularity}</p>)}<p>{result.analysis.unverifiedSourceCount} sumber aktif belum dapat digunakan sebagai bukti disahkan.</p></details>
        </> : <p className="muted">Pilih tempoh dan jalankan analisis. Tiada angka atau hasil contoh dipaparkan.</p>}
      </section>
      <section className="agent-insight"><div className="agent-section-title"><span>02</span><h3>Cadangan Buku SMARTLIB</h3></div><div className="agent-blocked"><BookOpen size={27}/><strong>Katalog belum disahkan</strong><p>Judul, ID buku dan naskhah tersedia hanya boleh dipaparkan selepas bacaan katalog dan sirkulasi produksi berjaya disahkan.</p></div></section>
      <section className="agent-insight"><div className="agent-section-title"><span>03</span><h3>Pinjaman Lewat</h3></div><div className="agent-blocked"><Clock3 size={27}/><strong>Rekod pinjaman tidak tersedia</strong><p>Tiada bilangan lewat direka. Tarikh patut pulang dan status pemulangan mesti disahkan daripada rekod SMARTLIB sebenar.</p></div></section>
      <section className="agent-insight"><div className="agent-section-title"><span>04</span><h3>Pelan Galakan Membaca</h3></div>
        {result?.followUpPlan.length ? <><p className="agent-draft">{planReview ? 'DISEMAK GURU · SESI INI SAHAJA' : 'DRAF · UNTUK SEMAKAN GURU'}</p><ol className="agent-plan">{result.followUpPlan.map(step=><li key={step.title}><strong>{step.title}</strong><p>{step.detail}</p></li>)}</ol>
          <div className="agent-plan-review">
            {planReview ? <p role="status">Disemak oleh {planReview.name} · {formatDate(planReview.at)}. Semakan sesi ini tidak disimpan sebagai kelulusan kekal atau rekod program.</p> : <>
              <label><input type="checkbox" checked={reviewChecked} onChange={e=>setReviewChecked(e.target.checked)}/>Saya telah menyemak bukti AINS dan kesesuaian pelan ini.</label>
              <button className="btn" disabled={!reviewChecked} onClick={()=>setPlanReview({name:data.user.name || 'Guru',at:new Date().toISOString()})}><Check size={16}/> Sahkan semakan pelan</button>
              <p className="muted">Semakan untuk sesi ini sahaja. Rekodkan keputusan program yang diluluskan melalui aliran kerja sekolah; jumlah NILAM tidak berubah.</p>
            </>}
          </div>
        </> : <p className="muted">Minta pelan selepas memilih tempoh laporan. Pelan khusus hanya disediakan jika sumber disahkan menyokong kumpulan susulan.</p>}
      </section>
      <section className="agent-insight agent-actions"><div className="agent-section-title"><span>05</span><h3>Cadangan Tindakan Guru</h3></div>
        {result ? <><p>{result.focusStudentIds.length ? `${result.focusStudentIds.length} murid dalam draf susulan. Semak senarai dan bukti dahulu.` : 'Semak liputan dan pengesahan sumber sebelum memilih murid untuk susulan.'}</p><p><Check size={16}/> Pastikan rekod luar AINS turut dipertimbangkan.</p><p><Check size={16}/> Tentukan bahan dan sokongan bersama murid; jangan infer keupayaan atau diagnosis.</p><p><Check size={16}/> Sahkan bacaan sebenar melalui aliran kerja sedia ada. Pinjaman tidak mengubah jumlah NILAM.</p></> : <p className="muted">Tindakan guru akan dirangka berdasarkan hasil analisis sebenar, dengan sumber dan had bukti.</p>}
      </section>
    </div>
  </div>;
}
