import ExcelJS from 'exceljs';
import { studentReport, safeExcelText } from './student-report.mjs';

const COLORS={purple:'FF4C1D95',violet:'FF7C3AED',lavender:'FFEDE9FE',white:'FFFFFFFF',text:'FF24143D'};
export async function nilamWorkbook(data:any, filters:any, generated=new Date()) {
  const report=studentReport(data,filters,generated), wb=new ExcelJS.Workbook();
  wb.creator='LITRIC'; wb.created=generated; wb.title='LAPORAN PENCAPAIAN NILAM — LITRIC';
  const date=generated.toLocaleString('en-GB',{timeZone:'Asia/Kuala_Lumpur',hour12:false});
  const selection=[`Tahun laporan: ${report.year}`,`Status: ${filters.status||'all'}`,`Kelas: ${data.classes.find((c:any)=>c.id===filters.classId)?.name||'Semua'}`,`Bintang: ${filters.star||'Semua'}`,`Carian: ${filters.search||'Semua'}`].join(' · ');
  function sheet(name:string, headers:string[], rows:any[][], widths:number[]) {
    const ws=wb.addWorksheet(name,{views:[{state:'frozen',ySplit:7}],pageSetup:{orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:7'}});
    [wb.title,'SEKOLAH KEBANGSAAN PENDIDIKAN KHAS TAIPING','Kod sekolah: ABA6052',`Dijana: ${date} (Malaysia)`,selection,'Jumlah terkumpul merentas semua tahun; kosong / belum disahkan bukan bukti sifar bacaan.'].forEach((line,i)=>{ws.addRow([safeExcelText(line)]);ws.mergeCells(i+1,1,i+1,headers.length);});
    ws.getRow(1).height=32;ws.getRow(1).font={name:'Manrope',bold:true,size:16,color:{argb:COLORS.white}};ws.getRow(1).getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:COLORS.purple}};
    ws.addRow(headers); ws.getRow(7).height=42;
    rows.forEach(row=>ws.addRow(row.map(v=>typeof v==='number'?v:safeExcelText(v))));
    ws.columns.forEach((c,i)=>{c.width=widths[i]||25;});
    ws.eachRow((row,i)=>{if(i!==1)row.font={name:'Manrope',size:11,color:{argb:COLORS.text},bold:i===7};row.alignment={vertical:'middle',wrapText:true};if(i>=7){row.eachCell({includeEmpty:true},cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:i===7?COLORS.purple:i%2===0?COLORS.lavender:COLORS.white}};if(i===7)cell.font={name:'Manrope',bold:true,color:{argb:COLORS.white}};if(typeof cell.value==='number')cell.numFmt='#,##0';});if(i>7)row.height=34;}});
    ws.autoFilter={from:{row:7,column:1},to:{row:Math.max(7,ws.rowCount),column:headers.length}};
    ws.headerFooter.oddFooter='LITRIC · ABA6052 | &P / &N';
  }
  sheet('Ringkasan Pencapaian',['Bil.','Nama Penuh Murid','Kelas','Tahun Persekolahan','Status Murid','Jumlah Bacaan Tahun Semasa','Jumlah Bacaan Terkumpul','Pencapaian Bintang NILAM','Markah PAJSK','Baki Bacaan Ke Bintang Seterusnya','Status Pengesahan Data'],report.records.map((s:any,i:number)=>[i+1,s.name,s.className,filters.academicYear?report.year:s.academic_year||'Belum disahkan',s.statusLabel,s.annual??(s.hasAins?'Belum disahkan':'Tiada rekod AINS'),s.total??(s.hasAins?'Belum disahkan':'Tiada rekod AINS'),s.achievement.level==null?'Belum dapat disahkan':`${s.achievement.level} Bintang${data.rule.certified?'':' (peraturan sekolah)'}`,s.verified&&data.rule.certified?s.achievement.marks??'Tiada markah':'Belum disahkan',s.achievement.remaining??'Belum dapat disahkan',s.verification]),[8,38,24,22,22,26,26,32,22,30,48]);
  let index=0;
  sheet('Sejarah Bacaan Tahunan',['Bil.','Nama Murid','ID Dalaman Murid','Tahun','Jumlah Bacaan Diluluskan','Sumber Data AINS','Status Pengesahan','Bacaan Sumber (belum semestinya disahkan)'],report.records.flatMap((s:any)=>s.history.length?s.history.map((h:any)=>[++index,s.name,s.id,h.year,h.total??'Belum disahkan',h.sources,h.verification,h.reported??'Belum disahkan']):[[++index,s.name,s.id,report.year,'Tiada rekod AINS','Tiada rekod AINS','Belum dapat disahkan','Tiada rekod AINS']]),[8,38,42,12,28,60,36,32]);
  const st=report.statistics;
  sheet('Statistik Sekolah',['Statistik (mengikut penapis)','Bilangan / Jumlah'],[['Jumlah murid aktif',st.active],['Jumlah murid mempunyai rekod AINS',st.withAins],['Jumlah bacaan diluluskan (disahkan sahaja)',st.approved],...st.stars.map((n:number,i:number)=>[i===0?'Bilangan murid belum mencapai 1 bintang':`Bilangan murid mencapai ${i} bintang`,n]),['Bilangan murid belum dapat disahkan',st.unknown],['Peraturan PAJSK',data.rule.certified?'Disahkan sekolah':'Belum diperakui; markah tidak dikeluarkan']], [72,38]);
  return {bytes:await wb.xlsx.writeBuffer(),count:report.records.length,date:generated.toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'})};
}
