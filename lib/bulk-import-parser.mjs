
import Papa from 'papaparse';
import { unzipSync, zipSync } from 'fflate';
import { norm } from './domain.mjs';

export const MAX_BULK_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 500;
const headers = {
  'NAMA': 'name', 'NAMA MURID': 'name', 'NAMA PENUH MURID': 'name',
  'ID DELIMA': 'delima', 'TAHUN / TINGKATAN': 'level',
  'KELAS': 'className', 'STATUS MURID': 'status', 'ID RUJUKAN MURID': 'reference',
  'KOD SEKOLAH': 'school', 'SCHOOL CODE': 'school', 'CODE': 'school',
  'TAHUN AKADEMIK': 'academicYear',
};
const rosterHeaders = {
  'NAMA PENUH':'name', 'NAMA PELAJAR':'name', 'NAMA PENUH PELAJAR':'name', 'STUDENT NAME':'name',
  'DELIMA ID':'delima', 'ID DELIMA MURID':'delima', 'ID DELIMA PELAJAR':'delima',
  'ID PENGGUNA DELIMA':'delima', 'AKAUN DELIMA':'delima', 'E MEL DELIMA':'delima', 'EMEL DELIMA':'delima',
  'EMAIL DELIMA':'delima', 'ALAMAT E MEL DELIMA':'delima', 'ID DELIMA (EMEL)':'delima',
  'KELAS MURID':'className', 'NAMA KELAS':'className', 'CLASS':'className',
  'TAHUN':'yearOrLevel', 'TAHUN PERSEKOLAHAN':'yearOrLevel', 'DARJAH':'level', 'TINGKATAN':'level', 'TAHAP':'level',
  'SESI AKADEMIK':'academicYear', 'ACADEMIC YEAR':'academicYear',
};
const statuses = {
  'AKTIF':'current', 'BERPINDAH':'transferred', 'TAMAT SEKOLAH':'graduated',
  'BELUM DISAHKAN':'unconfirmed',
};
const unsafe = /[\x00-\x08\x0B\x0C\x0E-\x1F]|^[\s\uFEFF]*[=+@-]/;
const bad = message => { throw Object.assign(new Error(message), {status:400}); };
const label = value => norm(value).replace(/\s*\/\s*/g, ' / ');
const text = value => String(value ?? '').trim();
const hasData = row => row.some(value => text(value));
const valueOf = (value) => {
  if (value == null || typeof value === 'number' || typeof value === 'string') return value;
  if (value.richText) return value.richText.map(part=>part.text).join('');
  bad('Fail Excel mengandungi formula, pautan atau jenis sel yang tidak disokong.');
};

async function workbookRows(bytes) {
  if (bytes[0]!==0x50 || bytes[1]!==0x4b) bad('Kandungan fail XLSX tidak sah.');
  let total = 0, entries = 0;
  try {
    const contents = unzipSync(bytes, {filter(entry) {
      total += entry.originalSize;
      entries++;
      if (total > 8 * 1024 * 1024 || entries > 150) bad('Kandungan Excel terlalu besar.');
      if (/externalLinks|vbaProject|embeddings/i.test(entry.name)) bad('Pautan luaran, makro dan objek terbenam tidak dibenarkan.');
      return true;
    }});
    if (!Object.hasOwn(contents,'[Content_Types].xml') || !Object.hasOwn(contents,'xl/workbook.xml')) bad('Fail XLSX tidak mempunyai struktur buku kerja yang sah.');
    const { default: ExcelJS } = await import('exceljs/dist/exceljs.min.js');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(zipSync(contents,{level:0}));
    const sheets = [];
    for (const sheet of book.worksheets) {
      if (sheet.rowCount > MAX_ROWS + 40 || sheet.columnCount > 48) bad('Had 500 baris data dan 48 lajur untuk satu fail.');
      const rows = Array.from({length:sheet.rowCount},(_,i) =>
        Array.from({length:sheet.columnCount},(_,j)=>valueOf(sheet.getRow(i+1).getCell(j+1).value)));
      if (rows.some(hasData)) sheets.push(rows);
    }
    return sheets;
  } catch (error) {
    if (error.status) throw error;
    bad('Fail Excel rosak atau tidak dapat dibaca.');
  }
}

export async function parseBulkImport(filename, bytes, kind) {
  if (!['nilam','roster'].includes(kind)) bad('Jenis import tidak sah.');
  if (!bytes.length || bytes.length > MAX_BULK_BYTES) bad('Pilih fail CSV atau XLSX sehingga 2 MB.');
  const format = filename.match(/\.(csv|xlsx)$/i)?.[1].toUpperCase();
  let sheets;
  if (format === 'CSV') {
    let input;
    try { input = new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
    catch { bad('CSV mesti menggunakan pengekodan UTF-8.'); }
    if (input.includes('\0')) bad('Kandungan CSV tidak sah.');
    const parsed = Papa.parse(input, {delimiter:',', skipEmptyLines:false});
    if (parsed.errors.length) bad('Struktur CSV tidak sah. Semak petikan dan pemisah koma.');
    sheets = [parsed.data];
  } else if (format === 'XLSX') sheets = await workbookRows(bytes);
  else bad('Format fail yang disokong ialah CSV dan XLSX.');
  const field = name => {
    const normalized=kind==='roster' ? name.replace(/[_-]+/g,' ').replace(/\s+/g,' ') : name;
    return headers[normalized] ?? (kind==='roster' ? rosterHeaders[normalized] : undefined);
  };
  const candidates = sheets.map(rows=>({rows, index:rows.slice(0,20).findIndex(row=>row.some(cell=>field(label(cell))==='name'))})).filter(s=>s.index>=0);
  if (candidates.length !== 1) bad('Satu jadual dengan lajur NAMA diperlukan. Semak helaian dan tajuk lajur.');
  const {rows, index} = candidates[0], heading = rows[index].map(label);
  if (heading.length>48) bad('Had 48 lajur untuk satu fail.');
  const reading = heading.map((name,i)=>({name,i})).filter(h=>h.name.startsWith('REKOD BACAAN'));
  const year = Number(reading[0]?.name.match(/^REKOD BACAAN (\d{4})$/)?.[1]);
  if (kind==='nilam' && (reading.length!==1 || !Number.isInteger(year) || year<2000 || year>2100))
    bad('Satu lajur REKOD BACAAN dengan tahun pelaporan yang sah (2000–2100) diperlukan.');
  if (kind==='roster' && reading.length) bad('Gunakan Import Laporan Bacaan NILAM untuk fail yang mengandungi rekod bacaan.');
  const columns = {};
  heading.forEach((name,i)=>{
    const target = kind==='nilam' && i===reading[0].i ? 'reported' : field(name);
    if (!target) return;
    if (Object.hasOwn(columns,target)) bad('Lajur yang dipetakan berulang. Semak tajuk lajur.');
    columns[target] = i;
  });
  const result = [];
  rows.slice(index+1).forEach((cells,i)=>{
    if (!hasData(cells)) return;
    if (result.length===MAX_ROWS) bad('Had 500 baris data. Bahagikan fail kepada beberapa kelompok.');
    if (cells.slice(heading.length).some(text)) bad('Bilangan lajur tidak sepadan dengan tajuk fail.');
    if (cells.some(v=>unsafe.test(String(v ?? '')) && !/^-?\d+$/.test(text(v)))) bad('Kandungan yang menyerupai formula atau aksara kawalan dikesan.');
    const get = field => text(cells[columns[field]]);
    const yearOrLevel=get('yearOrLevel'), calendarYear=/^\d{4}$/.test(yearOrLevel);
    const source = {name:get('name'), delima:get('delima'), reference:get('reference'), level:get('level')||(!calendarYear?yearOrLevel:''), className:get('className')};
    const issues = [];
    if (!source.name || source.name.length>160 || unsafe.test(source.name)) issues.push('Nama murid diperlukan (maksimum 160 aksara).');
    for (const field of ['delima','reference','level','className']) {
      if (source[field].length>160 || unsafe.test(source[field]) || /[\r\n\t]/.test(source[field])) issues.push('Pengecam, tahun/tingkatan atau kelas tidak sah.');
    }
    const count = get('reported'), reported = /^\d+$/.test(count) && Number.isSafeInteger(Number(count)) && Number(count)<=10000000 ? Number(count) : null;
    if (kind==='nilam' && reported===null) issues.push('Bilangan bacaan mesti integer bukan negatif (sehingga 10 juta).');
    if (Object.hasOwn(columns,'school') && get('school').toUpperCase()!=='ABA6052') issues.push('Kod sekolah mesti ABA6052 pada setiap baris.');
    const yearText = get('academicYear')||(calendarYear?yearOrLevel:''), academicYear = yearText && /^\d{4}$/.test(yearText) && Number(yearText)>=2000 && Number(yearText)<=2100 ? Number(yearText) : null;
    if (yearText && !academicYear) issues.push('Tahun akademik mesti antara 2000 dan 2100.');
    const status = statuses[norm(get('status'))] ?? null;
    if (get('status') && !status) issues.push('Status murid tidak sah.');
    result.push({...source,row:index+i+2,reported,academicYear,status,issues});
  });
  if (!result.length) bad('Fail tidak mengandungi baris murid.');
  return {format, year:kind==='nilam'?year:null, hasSchool:Object.hasOwn(columns,'school'), columns:Object.fromEntries(Object.entries(columns).map(([k,i])=>[k,heading[i]])), rows:result};
}
