
import ExcelJS from 'exceljs/dist/exceljs.min.js';

export async function rosterTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LITRIC';
  const sheet = workbook.addWorksheet('SENARAI MURID',{views:[{state:'frozen',ySplit:4}]});
  sheet.mergeCells('A1:F1');
  sheet.mergeCells('A2:F2');
  sheet.getCell('A1').value='TEMPLAT IMPORT SENARAI MURID — LITRIC';
  sheet.getCell('A1').font={bold:true,size:16,color:{argb:'FFFFFFFF'}};
  sheet.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF4C1D95'}};
  sheet.getRow(1).height=27;
  sheet.getCell('A2').value='ABA6052 • Padam baris contoh rekaan sebelum mengisi senarai murid.';
  sheet.getCell('A2').font={color:{argb:'FF4C1D95'},italic:true};
  sheet.getRow(4).values=['NAMA','ID DELIMA','TAHUN / TINGKATAN','KELAS','STATUS MURID','ID RUJUKAN MURID'];
  sheet.getRow(4).height=23;
  sheet.getRow(4).eachCell((cell:any)=>{
    cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF7C3AED'}};
    cell.font={bold:true,color:{argb:'FFFFFFFF'}};
    cell.alignment={vertical:'middle'};
  });
  sheet.getRow(5).values=['MURID CONTOH REKAAN','contoh@example.invalid','4','4 CONTOH','Aktif','REKAAN-001'];
  [30,31,24,23,23,25].forEach((width,i)=>{
    sheet.getColumn(i+1).width=width;
    sheet.getColumn(i+1).numFmt='@';
  });
  sheet.autoFilter='A4:F5';
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
