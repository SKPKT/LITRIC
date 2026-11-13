
import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { parseBulkImport } from '../lib/bulk-import-parser.mjs';
import { aggregate } from '../lib/domain.mjs';
import { latestAnnualReports, readingDataWithAnnualReports, NILAM_DATASET } from '../lib/nilam-annual.mjs';
import { studentReport } from '../lib/student-report.mjs';

const headings = 'NAMA,ID DELIMA,TAHUN / TINGKATAN,KELAS,REKOD BACAAN 2026';
const csv = (value,kind='nilam')=>parseBulkImport('rekaan.csv',new TextEncoder().encode(value),kind);

test('NILAM CSV reads 24 anonymized rows, six missing placements and a valid zero',async()=>{
  const rows=Array.from({length:24},(_,i)=>'"Murid rekaan, '+i+'",anon'+i+'@example.invalid,'+(i<18?'4,Kelas Rekaan':',')+','+i);
  const r=await csv('\uFEFF'+[headings,...rows].join('\r\n'));
  assert.equal(r.year,2026);
  assert.equal(r.rows.length,24);
  assert.equal(r.rows.filter(x=>!x.level&&!x.className).length,6);
  assert.equal(new Set(r.rows.map(x=>x.delima)).size,24);
  assert.equal(r.rows[0].name,'Murid rekaan, 0');
  assert.equal(r.rows[0].reported,0);
  assert.equal(r.rows.flatMap(x=>x.issues).length,0);
});

test('Reject ambiguous reporting years, malformed CSV, invalid counts and foreign school code',async()=>{
  assert.equal((await csv(headings.replace('2026','2027')+'\rRekaan,id,4,A,10')).year,2027);
  for (const h of [headings+',REKOD BACAAN 2027',headings.replace('2026','209'),headings.replace('2026','2199')])
    await assert.rejects(csv(h+'\nRekaan,id,4,A,10'),/tahun pelaporan/);
  await assert.rejects(csv(headings+'\n"Rekaan,id,4,A,10'),/Struktur CSV/);
  await assert.rejects(csv(headings+'\n=1+1,id,4,A,10'),/formula/);
  const data=await csv(headings+',KOD SEKOLAH\nA,a,1,A,-1,ABA6052\nB,b,2,B,abc,ABA6052\nC,c,3,C,1.5,ABA6052\nD,d,4,D,0,OTHER');
  assert.deepEqual(data.rows.map(r=>r.reported),[null,null,null,0]);
  assert.equal(data.rows.filter(r=>r.issues.length).length,4);
});

test('Excel roster preserves identifier text and rejects cached formulas',async()=>{
  const wb=new ExcelJS.Workbook(),s=wb.addWorksheet('SENARAI MURID');
  s.addRow(['NAMA','ID DELIMA','TAHUN / TINGKATAN','KELAS','STATUS MURID','ID RUJUKAN MURID']);
  s.addRow(['Rekaan','0001',4,'Kelas A','Aktif','0002']);
  const r=await parseBulkImport('roster.xlsx',new Uint8Array(await wb.xlsx.writeBuffer()),'roster');
  assert.equal(r.rows[0].delima,'0001');
  assert.equal(r.rows[0].reference,'0002');
  assert.equal(r.rows[0].status,'current');
  s.getCell('D2').value={formula:'1+1',result:2};
  await assert.rejects(parseBulkImport('roster.xlsx',new Uint8Array(await wb.xlsx.writeBuffer()),'roster'),/formula/);
});

test('Annual corrections replace by pupil and year, block overlap and preserve verified history',()=>{
  const batch=(id,year,verified,dataset=NILAM_DATASET)=>({id,filename:id+'.csv',dataset,year,status:'active',created_at:id,granularity:'annual',verification:verified?'verified':'unverified',star_eligible:verified,coverage_complete:verified,period_start:year+'-01-01',period_end:year+'-12-31'});
  const student={id:'pupil',name:'Rekaan',status:'current'};
  const batches=[batch('a',2025,true,'AINS'),batch('b',2026,true),batch('c',2026,false)];
  const nilam=[{batch_id:'b',student_id:'pupil',report_year:2026,reported:200},{batch_id:'c',student_id:'pupil',report_year:2026,reported:150}];
  const ains=[{batch_id:'a',student_id:'pupil',approved:150,status:'accepted',measures:'{}',rejected:0}];
  const data={students:[student],classes:[],import_batches:batches,ains_summaries:ains,nilam_annual_reports:nilam,rule:{thresholds:[144,288,432,576,720],marks:[3,4,5,6,7],certified:false}};
  const report=()=>studentReport({...data,ains_summaries:readingDataWithAnnualReports(data)},{academicYear:2026}).records[0];
  assert.equal(latestAnnualReports(nilam,batches)[0].reported,150);
  assert.equal(report().history.at(-1).reported,150);
  assert.equal(report().achievement.level,null);
  Object.assign(batches[2],{verification:'verified',star_eligible:true,coverage_complete:true});
  assert.equal(report().total,300);
  assert.equal(report().achievement.level,2);
  batches.push(batch('d',2026,true,'AINS 2026'));
  ains.push({...ains[0],batch_id:'d',approved:70});
  assert.equal(report().verification,'Pertindihan sumber');
  assert.equal(report().achievement.level,null);
  const m=aggregate({students:[student],rows:readingDataWithAnnualReports(data),batches});
  assert.equal(m.reported,220);
  assert.equal(m.eligible,220);
});
