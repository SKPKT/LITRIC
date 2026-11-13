
import { db, all, first, statement, requireRole, fail, uid, now } from './server';
import { norm, identityKey } from './domain.mjs';
import { parseBulkImport } from './bulk-import-parser.mjs';
import { annualOverlap, latestAnnualReports, NILAM_DATASET, ROSTER_DATASET } from './nilam-annual.mjs';
import { rosterIssue } from './roster-selection.mjs';

const checksum = async (bytes: Uint8Array) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))].map(n=>n.toString(16).padStart(2,'0')).join('');
const isYear = (year: any) => Number.isInteger(year) && year >= 2000 && year <= 2100;
const datasetFor = (kind: string) => kind==='nilam' ? NILAM_DATASET : ROSTER_DATASET;
const aliasKeys = (r: any) => [identityKey({source_id:r.delima}), r.reference && 'roster-reference:' + identityKey({source_id:r.reference})].filter(Boolean);
const auditStatement = (u: any, action: string, entity: string, details: any, at: string) =>
  statement('INSERT INTO audit_logs(id,school_id,user_id,action,entity_id,detail,created_at) VALUES(?,?,?,?,?,?,?)',uid(),u.school_id,u.id,action,entity,JSON.stringify(details),at);
const noReads = ['duplicate','excluded','rejected'];
const countKeys = ['created','matched','updated','summariesCreated','summariesUpdated','skipped','review'];
const typeLabel = (kind: string) => kind==='nilam' ? 'laporan NILAM' : 'senarai murid';

export async function processBulkImport(u: any, kind: string, file: File, options: any, commit: boolean) {
  requireRole(u,['admin']);
  const school = u.school_id;
  if (school!=='ABA6052') fail('Skop sekolah tidak dibenarkan.',403);
  const filename = file.name.split(/[\\/]/).at(-1)!.trim();
  if (!filename || filename.length>240 || /[\x00-\x1f]/.test(filename)) fail('Nama fail tidak sah.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = await parseBulkImport(filename,bytes,kind);
  const hash = await checksum(bytes);
  const dataset = datasetFor(kind);
  const past = await all('SELECT id,stats,created_at FROM import_batches WHERE school_id=? AND dataset=? AND file_hash=? ORDER BY created_at DESC',school,dataset,hash);
  const existing = past[0];
  const selective = kind==='roster' && Array.isArray(options.selection);
  const imported = new Set(past.flatMap(b=>(JSON.parse(b.stats).resultRows||[]).filter((r:any)=>r.result!=='Dilangkau' && r.result!=='Perlu semakan').map((r:any)=>r.row)));
  if (existing && commit && !selective) return {duplicate:true,batchId:existing.id,...JSON.parse(existing.stats),createdAt:existing.created_at};
  const [students, aliases, classes, batches, nilam, summaries] = await Promise.all([
    all('SELECT * FROM students WHERE school_id=?',school),
    all('SELECT * FROM student_aliases WHERE school_id=?',school),
    all('SELECT * FROM classes WHERE school_id=?',school),
    all('SELECT id,year,status,dataset,created_at,verification,star_eligible FROM import_batches WHERE school_id=?',school),
    all('SELECT * FROM nilam_annual_reports WHERE school_id=?',school),
    all('SELECT student_id,batch_id,status FROM ains_summaries WHERE school_id=?',school),
  ]);
  const profiles = new Map(students.map(s=>[s.id,s]));
  const canonical = (id: string) => profiles.get(id)?.merged_into || id;
  const lookup = new Map(aliases.map(a=>[identityKey({source_id:a.source_id}),a]));
  const latest = new Map(latestAnnualReports(nilam.map(r=>({...r,canonical_id:canonical(r.student_id)})),batches)
    .filter(r=>r.report_year===parsed.year).map(r=>[r.canonical_id,r]));
  const historical = summaries.map(r=>({...r,canonical_id:canonical(r.student_id)}));
  const usedKeys = new Map<string,number>();
  const rows = parsed.rows.map((r: any)=>{
    const keys = aliasKeys(r);
    for (const key of keys) usedKeys.set(key,(usedKeys.get(key)||0)+1);
    const identified = keys.map(key=>lookup.get(key)).filter(Boolean);
    const targets = [...new Set(identified.map(a=>canonical(a.student_id)))];
    const matched = targets.length===1 ? profiles.get(targets[0]) : null;
    const exactNames = students.filter(s=>!s.merged_into && norm(s.name)===norm(r.name));
    const duplicateName = parsed.rows.some((other:any)=>other.row!==r.row && norm(other.name)===norm(r.name));
    const conflict = targets.length>1 || !!matched && norm(matched.name)!==norm(r.name);
    const manual = conflict || !matched || identified.some(a=>!a.verified) || identified.length!==keys.length;
    const previous = matched ? latest.get(matched.id) : null;
    const missing = !r.level || !r.className;
    return {
      ...r, keys, targets, matchedId:matched?.id || '', matchedName:matched?.name || '',
      duplicateName, exactName:exactNames.length>0, conflict, manual, missing,
      previous:previous?.reported ?? null,
      overlap:parsed.year && matched ? annualOverlap(historical,batches,matched.id,parsed.year) : false,
      protectedStatus:!!matched && (!!matched.archived_at || ['transferred','graduated','former'].includes(matched.status)),
    };
  });
  const view = rows.map(r=>{
    const duplicate = r.keys.some((key:string)=>usedKeys.get(key)!>1);
    const issues = [...r.issues,...(duplicate?['Pengecam berulang dalam fail.']:[]),...(r.targets.length>1?['Pengecam dipautkan kepada profil berlainan. Selesaikan identiti dahulu.']:[])];
    return {...r, duplicate,issues,hasIdentifier:r.keys.length>0,imported:kind==='roster'&&imported.has(r.row)};
  });
  const summary = {
    rows:view.length, complete:view.filter(r=>!r.missing).length, missing:view.filter(r=>r.missing).length,
    duplicates:view.filter(r=>r.duplicate).length, invalidCounts:view.filter(r=>kind==='nilam'&&r.reported===null).length,
    matched:view.filter(r=>r.matchedId).length, newStudents:view.filter(r=>!r.matchedId&&!r.conflict).length,
    replacements:view.filter(r=>r.previous!==null).length, overlaps:view.filter(r=>r.overlap).length,
    review:view.filter(r=>r.missing || r.issues.length || r.manual || r.overlap || r.previous!==null && r.reported<r.previous).length,
  };
  // The revision includes database-dependent identity and coverage state. A stale preview cannot commit.
  const revision = await checksum(new TextEncoder().encode(JSON.stringify([hash,view,students.map(s=>[s.id,s.updated_at]),batches,classes])));
  if (!commit) return {filename,hash,revision,year:parsed.year,format:parsed.format,columns:parsed.columns,hasSchool:parsed.hasSchool,existing:!!existing,summary,
    priorByStudent:Object.fromEntries([...latest].map(([id,r])=>[id,r.reported])),
    overlappingStudents:parsed.year?students.filter(s=>!s.merged_into&&annualOverlap(historical,batches,s.id,parsed.year)).map(s=>s.id):[],
    rows:view.map(({keys,targets,...r})=>r),
  };
  if (options.revision!==revision) fail('Data telah berubah. Jalankan pratonton semula sebelum mengesahkan import.',409);
  if (!parsed.hasSchool && options.provenance!==true) fail('Sahkan bahawa fail ini ialah rekod sekolah ABA6052.');
  if (!options.decisions || typeof options.decisions!=='object' || Array.isArray(options.decisions)) fail('Keputusan baris diperlukan.');
  const defaultYear = options.academicYear ? Number(options.academicYear) : null;
  if (defaultYear!==null && !isYear(defaultYear)) fail('Tahun akademik tidak sah.');
  const selected = new Set<number>();
  if (selective) {
    const available = new Set(view.map(r=>r.row));
    for (const row of options.selection) {
      if (!Number.isInteger(row) || !available.has(row) || selected.has(row)) fail('Pilihan murid tidak sah.');
      selected.add(row);
    }
    if (!selected.size) fail('Pilih sekurang-kurangnya seorang murid.');
  }
  const at = now(), batchId=uid();
  const writes: any[] = [], resultRows: any[] = [], replacements: any[] = [];
  const stats = Object.fromEntries(countKeys.map(k=>[k,0])) as Record<string,number>;
  const processed = new Set<string>(), newNames = new Set<string>();
  const auditRows: any[] = [];
  const savedRows: number[] = [];
  const classFor = (name: string, year: number) => {
    let c = classes.find(c=>norm(c.name)===norm(name)&&c.year===year);
    if (!c) {
      c={id:uid(),name,year};
      classes.push(c);
      writes.push(statement('INSERT INTO classes(id,school_id,name,year) VALUES(?,?,?,?)',c.id,school,name,year));
    }
    return c.id;
  };
  for (const r of view) {
    const d = options.decisions[r.row] || {};
    const action = selective && !selected.has(r.row) ? 'skip' : d.action || '';
    if (action==='skip') {
      stats.skipped++;
      if (selective ? !r.imported && (r.issues.length || r.conflict || r.manual && r.matchedId || r.exactName && !r.matchedId || r.duplicateName) : r.missing || r.manual || r.overlap || r.issues.length) stats.review++;
      resultRows.push({row:r.row,result:'Dilangkau',notes:r.issues.join(' ') || 'Dipilih untuk semakan atau dilangkau.'});
      continue;
    }
    const target = action==='create' ? null : profiles.get(d.studentId || r.matchedId);
    const year = r.academicYear || (selective && target?.academic_year ? null : defaultYear) || (kind==='nilam' && !r.missing ? parsed.year : null);
    if (selective) {
      const issue = rosterIssue(r,d,target,year)
        || (target && processed.has(target.id) ? 'Profil ini sudah dipilih pada baris lain.' : '')
        || (action==='create' && newNames.has(norm(r.name)) && !r.hasIdentifier ? 'Nama berulang memerlukan pengecam unik.' : '');
      if (issue) {
        stats.review++;
        resultRows.push({row:r.row,result:'Perlu semakan',notes:issue});
        continue;
      }
    }
    if (r.issues.length) fail('Baris '+r.row+': langkau atau betulkan isu yang ditunjukkan.');
    if (!['create','match','update'].includes(action) || (kind==='nilam' && action==='update')) fail('Baris '+r.row+': pilih keputusan padanan atau langkau.');
    const creating = action==='create';
    if (!creating && (!target || target.merged_into)) fail('Baris '+r.row+': pilih profil murid yang sah.');
    if (r.targets.length && (creating || r.targets[0]!==target.id)) fail('Baris '+r.row+': pengecam sedia ada tidak boleh dialihkan.',409);
    if (!selective && (r.manual || creating || action==='update') && d.confirmed!==true) fail('Baris '+r.row+': sahkan bukti identiti atau perubahan profil.');
    if (!selective && (r.conflict || r.exactName && creating || r.duplicateName || !r.keys.length) && (typeof d.reason!=='string' || d.reason.trim().length<10 || d.reason.length>500))
      fail('Baris '+r.row+': catat sebab padanan atau bukti identiti (10–500 aksara).');
    const student = target?.id || uid();
    if (processed.has(student)) fail('Beberapa baris merujuk profil murid yang sama. Pilih satu baris.',409);
    processed.add(student);
    if (creating && newNames.has(norm(r.name)) && (!r.keys.length || !d.reason?.trim())) fail('Baris '+r.row+': nama berulang memerlukan pengecam dan bukti individu berlainan.');
    if (creating) newNames.add(norm(r.name));
    const level = r.level || target?.school_year_level || null;
    if (creating) {
      const enrolled = selective ? options.confirmEnrolled===true && !!r.className : d.enrolled===true && !r.missing;
      const status = kind==='roster' && enrolled && year ? (r.status || 'current') :
        kind==='roster' && ['transferred','graduated'].includes(r.status) ? r.status : 'unconfirmed';
      const classId = r.className && year ? classFor(r.className,year) : null;
      writes.push(statement('INSERT INTO students(id,school_id,name,class_id,academic_year,school_year_level,status,archived_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
        student,school,r.name,classId,year,level,status,['transferred','graduated'].includes(status)?at:null,at,at));
      if (classId) writes.push(statement('INSERT INTO student_class_history(id,school_id,student_id,class_id,year,created_at) VALUES(?,?,?,?,?,?)',uid(),school,student,classId,year,at));
      stats.created++;
    } else {
      stats.matched++;
      if (action==='update') {
        if (year && target.academic_year && year<target.academic_year) fail('Baris '+r.row+': tahun lebih lama daripada profil. Pilih Paut sahaja.');
        const nextYear = year || target.academic_year;
        const classId = r.className && nextYear ? classFor(r.className,nextYear) : target.class_id;
        if (nextYear!==target.academic_year && target.class_id && !r.className) fail('Baris '+r.row+': kelas diperlukan untuk menukar tahun profil.');
        writes.push(statement('UPDATE students SET name=?,class_id=?,academic_year=?,school_year_level=?,updated_at=? WHERE id=? AND school_id=?',r.name,classId,nextYear,level,at,student,school));
        if (classId && nextYear) writes.push(statement('INSERT INTO student_class_history(id,school_id,student_id,class_id,year,created_at) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM student_class_history WHERE school_id=? AND student_id=? AND class_id=? AND year=?)',uid(),school,student,classId,nextYear,at,school,student,classId,nextYear));
        stats.updated++;
      }
    }
    for (const key of r.keys) {
      const alias = lookup.get(key);
      if (!alias) writes.push(statement('INSERT INTO student_aliases(id,school_id,student_id,source_id,original_name,verified) VALUES(?,?,?,?,?,1)',uid(),school,student,key,r.name));
      else if (!alias.verified) writes.push(statement('UPDATE student_aliases SET verified=1 WHERE id=? AND school_id=?',alias.id,school));
    }
    const overlap = kind==='nilam' && annualOverlap(historical,batches,student,parsed.year);
    if (kind==='nilam') {
      const previous = latest.get(student);
      if (previous && (options.replace!==true || d.replace!==true)) fail('Baris '+r.row+': semak jumlah lama dan baharu sebelum mengesahkan penggantian.');
      writes.push(statement('INSERT INTO nilam_annual_reports(id,school_id,batch_id,student_id,report_year,reported,school_year_level,class_name,row_number) VALUES(?,?,?,?,?,?,?,?,?)',
        uid(),school,batchId,student,parsed.year,r.reported,r.level||null,r.className||null,r.row));
      if (previous) {
        stats.summariesUpdated++;
        replacements.push({row:r.row,before:previous.reported,after:r.reported,previousBatch:previous.batch_id});
      } else stats.summariesCreated++;
    }
    const placementMissing = selective ? creating && (!year || !r.className) : r.missing || creating && (!year || !d.enrolled);
    if (placementMissing || overlap || kind==='nilam') stats.review++;
    const notes = [placementMissing && 'Tahun/kelas perlu semakan.', overlap && 'Liputan AINS bertindih.', kind==='nilam' && 'Kelulusan bacaan belum disahkan.'].filter(Boolean).join(' ');
    savedRows.push(r.row);
    if (selective) auditRows.push({row:r.row,studentId:student,action,manual:!creating&&r.manual});
    resultRows.push({row:r.row,result:creating?'Profil baharu':action==='update'?'Profil dikemas kini':'Profil dipadankan',notes});
  }
  if (!processed.size) {
    if (selective) return {stats,resultRows,message:'Tiada murid disimpan. Semak keputusan baris yang dipilih.'};
    fail('Tiada baris dipilih untuk disimpan.');
  }
  const staff = u.name;
  const results = {kind,filename,checksum:hash,year:parsed.year,source:parsed.format,stats,resultRows,staff};
  const periodStart = parsed.year ? parsed.year+'-01-01' : null;
  const batch = statement(
    'INSERT INTO import_batches(id,school_id,dataset,filename,fingerprint,file_hash,source_type,granularity,year,period_start,verification,status,stats,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    batchId,school,dataset,filename,kind+':'+hash+(selective?':'+savedRows.join(','):''),hash,parsed.format,kind==='nilam'?'annual':'roster',parsed.year,periodStart,'unverified','active',JSON.stringify(results),u.id,at,
  );
  await db().batch([batch,...writes,auditStatement(u,'Import '+typeLabel(kind),batchId,{...results,resultRows:undefined,replacements,...(selective?{rows:auditRows}:{})},at)]);
  return {batchId,...results,createdAt:at,message:'Import berjaya disimpan.'};
}

export async function verifyNilamAnnual(u: any, p: any) {
  requireRole(u,['admin']);
  const school=u.school_id;
  const batch = await first('SELECT * FROM import_batches WHERE id=? AND school_id=? AND dataset=? AND status=?',p.id,school,NILAM_DATASET,'active');
  if (!batch) fail('Laporan aktif tidak ditemui.',404);
  if (p.confirmApproved!==true || p.confirmComplete!==true || typeof p.note!=='string' || p.note.trim().length<12 || p.note.length>500)
    fail('Sahkan jumlah bacaan diluluskan, liputan setahun penuh dan catat rujukan bukti.');
  const [nilam,batches,legacy,students] = await Promise.all([
    all('SELECT * FROM nilam_annual_reports WHERE school_id=?',school),
    all('SELECT * FROM import_batches WHERE school_id=?',school),
    all('SELECT student_id,batch_id,status FROM ains_summaries WHERE school_id=?',school),
    all('SELECT id,merged_into FROM students WHERE school_id=?',school),
  ]);
  const people = new Map(students.map(s=>[s.id,s.merged_into || s.id]));
  const current = latestAnnualReports(nilam.map(r=>({...r,canonical_id:people.get(r.student_id)})),batches).filter(r=>r.batch_id===p.id);
  if (!current.length) fail('Semua baris dalam laporan ini sudah digantikan.',409);
  if (current.length!==nilam.filter(r=>r.batch_id===p.id).length)
    fail('Sebahagian laporan telah digantikan. Sahkan laporan gantian; untuk baki baris, import fail pembetulan yang meliputi murid berkenaan.',409);
  if (current.some(r=>annualOverlap(legacy.map(a=>({...a,canonical_id:people.get(a.student_id)})),batches,r.canonical_id,r.report_year)))
    fail('Liputan sumber AINS bertindih atau belum diketahui. Selesaikan liputan dahulu.',409);
  const at=now();
  await db().batch([
    statement("UPDATE import_batches SET period_end=?,verification='verified',coverage_complete=1,star_eligible=1,verified_by=?,verification_note=? WHERE id=? AND school_id=?",batch.year+'-12-31',u.id,p.note.trim(),p.id,school),
    auditStatement(u,'Sahkan jumlah tahunan NILAM',p.id,{year:batch.year,rows:current.length},at),
  ]);
  return {message:'Jumlah bacaan tahunan disahkan.'};
}
