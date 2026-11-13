
import { first, db, statement, uid, now, requireRole, fail } from './server';
import { digest } from './domain.mjs';

const batchTables = ['ains_event_registry','ains_activity_records','ains_snapshots','import_errors','nilam_annual_reports','ains_summaries'] as const;

export async function deleteImport(u: any, p: any, commit: boolean) {
  requireRole(u,['admin']);
  const school=u.school_id, id=p.id;
  if (typeof id!=='string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) fail('ID import tidak sah.');
  const batch = await first('SELECT * FROM import_batches WHERE school_id=? AND id=?',school,id);
  if (!batch) fail('Import tidak ditemui.',404);
  const counts = Object.fromEntries(await Promise.all(batchTables.map(async table=>[
    table,(await first('SELECT COUNT(*) AS n FROM '+table+' WHERE school_id=? AND batch_id=?',school,id)).n,
  ])));
  const linked = (await first(
    'SELECT COUNT(*) AS n FROM school_reading_entries WHERE school_id=? AND reconciled_summary_id IN (SELECT id FROM ains_summaries WHERE school_id=? AND batch_id=?)',
    school,school,id,
  )).n;
  const totalsMayChange = batch.status==='active' && !!(counts.ains_summaries || counts.nilam_annual_reports || counts.ains_activity_records);
  const revision = await digest(JSON.stringify([batch,counts,linked]));
  const plan = {id,filename:batch.filename,dataset:batch.dataset,counts,linked,totalsMayChange,revision};
  if (!commit) return plan;
  if (p.confirmed!==true || p.revision!==revision) fail('Semak kesan pemadaman dan sahkan pelan terkini.',409);
  const at=now();
  await db().batch([
    statement('UPDATE school_reading_entries SET reconciled_summary_id=NULL WHERE school_id=? AND reconciled_summary_id IN (SELECT id FROM ains_summaries WHERE school_id=? AND batch_id=?)',school,school,id),
    ...batchTables.map(table=>statement('DELETE FROM '+table+' WHERE school_id=? AND batch_id=?',school,id)),
    statement('DELETE FROM import_batches WHERE school_id=? AND id=?',school,id),
    statement('INSERT INTO audit_logs(id,school_id,user_id,action,entity_id,detail,created_at) VALUES(?,?,?,?,?,?,?)',uid(),school,u.id,'Padam import',id,JSON.stringify({counts,linked,totalsMayChange,sourceChecksum:batch.file_hash}),at),
  ]);
  return {message:'Import berjaya dipadam.',counts};
}
