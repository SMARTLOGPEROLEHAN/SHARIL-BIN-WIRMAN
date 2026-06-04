import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel, ShadingType } from 'docx';
import { saveAs } from 'file-saver';
import { loadLogo, addWatermark } from './exportUtils';

// Helper to format currency
const formatCurrency = (val: number): string => {
  if (val === 0) return '-';
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper to format number
const formatNum = (val: number): string => {
  return val === 0 ? '0' : val.toString();
};

export interface RowA1 {
  category: 'BEKALAN' | 'PERKHIDMATAN' | 'KERJA';
  perancanganBil: number;
  perancanganNilai: number;
  belumPelawaBil: number;
  prosesIklanBil: number;
  prosesPenilaianBil: number;
  prosesJkBil: number;
  belumSstBil: number;
  sstBumiBil: number;
  sstBumiNilai: number;
  sstNonBumiBil: number;
  sstNonBumiNilai: number;
  syorJangkaan: string;
}

export interface RowA2 {
  id: string;
  tenderNo: string;
  category: 'KERJA' | 'BEKALAN' | 'PERKHIDMATAN' | '';
  jenisPeruntukan: string;
  title: string;
  winnerName: string;
  winningPrice: number;
  isCustom?: boolean;
}

// -----------------------------------------------------------------
// 1. EXPORT LAMPIRAN A1 TO PDF
// -----------------------------------------------------------------
export const exportA1ToPDF = async (params: {
  year: string;
  quarterName: string;
  office: string;
  asOfDate: string;
  rows: RowA1[];
}) => {
  const { year, quarterName, office, asOfDate, rows } = params;
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4
  
  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm

  const logo = await loadLogo();
  if (logo) {
    try {
      addWatermark(doc, logo);
      doc.addImage(logo, 'PNG', 12, 6, 14, 14);
    } catch (e) {
      console.error('Watermark/Logo failed:', e);
    }
  }
  
  // Header text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('LAMPIRAN A1', pageWidth - 30, 10, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`LAPORAN PENGURUSAN PEROLEHAN RISDA BAGI SUKU TAHUN ${quarterName.toUpperCase()} ${year}`, pageWidth / 2, 18, { align: 'center' });
  
  // Underline for title
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  const textWidth = doc.getTextWidth(`LAPORAN PENGURUSAN PEROLEHAN RISDA BAGI SUKU TAHUN ${quarterName.toUpperCase()} ${year}`);
  doc.line((pageWidth - textWidth) / 2, 20, (pageWidth + textWidth) / 2, 20);
  
  doc.setFontSize(10);
  doc.text(`Pusat Tanggungjawab : ${office.toUpperCase()}`, 12, 28);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 0, 0); // Red highlight like attachment "Sebut Harga"
  doc.text('Perolehan Secara ', 12, 34);
  const offset1 = doc.getTextWidth('Perolehan Secara ');
  
  doc.setTextColor(220, 0, 0);
  doc.text('Sebut Harga', 12 + offset1, 34);
  const offset2 = doc.getTextWidth('Sebut Harga');
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(` setakat ${asOfDate}`, 12 + offset1 + offset2, 34);

  // Totals Row calculation
  const totalRow: RowA1 = {
    category: 'BEKALAN', // Placeholder, text will be overwritten
    perancanganBil: rows.reduce((acc, r) => acc + r.perancanganBil, 0),
    perancanganNilai: rows.reduce((acc, r) => acc + r.perancanganNilai, 0),
    belumPelawaBil: rows.reduce((acc, r) => acc + r.belumPelawaBil, 0),
    prosesIklanBil: rows.reduce((acc, r) => acc + r.prosesIklanBil, 0),
    prosesPenilaianBil: rows.reduce((acc, r) => acc + r.prosesPenilaianBil, 0),
    prosesJkBil: rows.reduce((acc, r) => acc + r.prosesJkBil, 0),
    belumSstBil: rows.reduce((acc, r) => acc + r.belumSstBil, 0),
    sstBumiBil: rows.reduce((acc, r) => acc + r.sstBumiBil, 0),
    sstBumiNilai: rows.reduce((acc, r) => acc + r.sstBumiNilai, 0),
    sstNonBumiBil: rows.reduce((acc, r) => acc + r.sstNonBumiBil, 0),
    sstNonBumiNilai: rows.reduce((acc, r) => acc + r.sstNonBumiNilai, 0),
    syorJangkaan: ''
  };

  // Build raw rows for autotable
  const bodyRows = [
    ...rows.map(r => {
      const bTotalBil = r.sstBumiBil + r.sstNonBumiBil;
      const bTotalNilai = r.sstBumiNilai + r.sstNonBumiNilai;
      
      return [
        r.category === 'BEKALAN' ? 'Bekalan' : r.category === 'PERKHIDMATAN' ? 'Perkhidmatan' : 'Kerja',
        formatNum(r.perancanganBil),
        formatCurrency(r.perancanganNilai),
        formatNum(r.belumPelawaBil),
        formatNum(r.prosesIklanBil),
        formatNum(r.prosesPenilaianBil),
        formatNum(r.prosesJkBil),
        formatNum(r.belumSstBil),
        formatNum(r.sstBumiBil),
        formatCurrency(r.sstBumiNilai),
        formatNum(r.sstNonBumiBil),
        formatCurrency(r.sstNonBumiNilai),
        formatNum(bTotalBil),
        formatCurrency(bTotalNilai),
        r.syorJangkaan || '-'
      ];
    }),
    [
      'JUMLAH',
      formatNum(totalRow.perancanganBil),
      formatCurrency(totalRow.perancanganNilai),
      formatNum(totalRow.belumPelawaBil),
      formatNum(totalRow.prosesIklanBil),
      formatNum(totalRow.prosesPenilaianBil),
      formatNum(totalRow.prosesJkBil),
      formatNum(totalRow.belumSstBil),
      formatNum(totalRow.sstBumiBil),
      formatCurrency(totalRow.sstBumiNilai),
      formatNum(totalRow.sstNonBumiBil),
      formatCurrency(totalRow.sstNonBumiNilai),
      formatNum(totalRow.sstBumiBil + totalRow.sstNonBumiBil),
      formatCurrency(totalRow.sstBumiNilai + totalRow.sstNonBumiNilai),
      ''
    ]
  ];

  // We use autoTable to construct the 15-column table with multi-layer headers
  autoTable(doc, {
    startY: 40,
    head: [
      [
        { content: 'Kategori Perolehan', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Perancangan Tahunan Keseluruhan', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Belum Pelawa', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Telah Dipelawa', colSpan: 10, styles: { halign: 'center' } },
        { content: 'Syor dan jangkaan selesai', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } }
      ],
      [
        // Sub of Perancangan (empty placeholder because of rowspan 3 on Kategori and Belum Pelawa)
        // Sub of Telah Dipelawa:
        { content: 'Dalam proses iklan', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Dalam proses penilaian', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Dalam proses ke JK Sebut Harga', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Belum Dikeluarkan Surat Setuju Terima', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Telah Dikeluarkan Surat Setuju Terima / Pesanan Tempatan', colSpan: 6, styles: { halign: 'center' } }
      ],
      [
        // Columns under Perancangan
        { content: 'Bil', styles: { halign: 'center' } },
        { content: 'RM', styles: { halign: 'center' } },
         
        // Sub under SST/PT
        { content: 'Bumiputera', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Non-Bumiputera', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Jumlah Besar', colSpan: 2, styles: { halign: 'center' } }
      ],
      [
        // Placeholders/Empty or bottom titles for exact alignments:
        '', // Kategori
        '', // Perancangan Bil
        '', // Perancangan RM
        '', // Belum Pelawa Bil
        '', // Pro iklan
        '', // Pro penil
        '', // Pro JK
        '', // Belum SST
        'Bil', // Bumi Bil
        'RM', // Bumi RM
        'Bil', // NonBumi Bil
        'RM', // NonBumi RM
        'Bil', // Jml Besar Bil
        'RM', // Jml Besar RM
        ''  // Syor
      ]
    ],
    body: bodyRows,
    theme: 'grid',
    styles: {
      fontSize: 7,
      font: 'helvetica',
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      cellPadding: 1.5,
      valign: 'middle'
    },
    headStyles: {
      fillColor: [229, 229, 229],
      fontStyle: 'bold',
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold' }, // Kategori
      1: { cellWidth: 10, halign: 'center' }, // Perancangan Bil
      2: { cellWidth: 22, halign: 'right' },  // Perancangan RM
      3: { cellWidth: 12, halign: 'center' }, // Belum Pelawa Bil
      4: { cellWidth: 14, halign: 'center' }, // Pro Iklan
      5: { cellWidth: 15, halign: 'center' }, // Pro Penilaian
      6: { cellWidth: 15, halign: 'center' }, // Pro JK
      7: { cellWidth: 18, halign: 'center' }, // Belum SST
      8: { cellWidth: 10, halign: 'center' }, // Bumi Bil
      9: { cellWidth: 22, halign: 'right' },  // Bumi RM
      10: { cellWidth: 10, halign: 'center' }, // NonBumi Bil
      11: { cellWidth: 20, halign: 'right' }, // NonBumi RM
      12: { cellWidth: 12, halign: 'center' }, // Jml Besar Bil
      13: { cellWidth: 22, halign: 'right' },  // Jml Besar RM
      14: { cellWidth: 24, halign: 'center' }  // Syor
    },
    didParseCell: (data) => {
      // Remove double borders or clean empty header rows
      if (data.row.section === 'head' && data.row.index === 3) {
        // This is the custom row describing Bil/RM
        // Set content to Bil/RM respectively so we override previous rows securely
        if (data.column.index === 1) data.cell.text = ['Bil'];
        if (data.column.index === 2) data.cell.text = ['RM'];
        if (data.column.index === 3) data.cell.text = ['Bil'];
        if (data.column.index === 4) data.cell.text = ['Bil'];
        if (data.column.index === 5) data.cell.text = ['Bil'];
        if (data.column.index === 6) data.cell.text = ['Bil'];
        if (data.column.index === 7) data.cell.text = ['Bil'];
      }
      
      // Format the bright yellow row for totals
      if (data.row.section === 'body' && data.row.index === 3) {
        data.cell.styles.fillColor = [255, 255, 0]; // Bright Yellow
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: (data) => {
      if (logo) {
        addWatermark(doc, logo);
      }
    }
  });

  // Footer / Approval Signatures
  let finalY = (doc as any).lastAutoTable.finalY || 160;
  if (finalY > 155) {
    doc.addPage();
    if (logo) {
      addWatermark(doc, logo);
    }
    finalY = 20;
  }
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Disahkan oleh', pageWidth - 100, finalY + 15);
  doc.text('.......................................................................', pageWidth - 100, finalY + 25);
  doc.text('(Ketua Pusat Tanggungjawab)', pageWidth - 100, finalY + 31);
  
  // Save file
  doc.save(`LAMPIRAN_A1_SUKUAN_${quarterName.toUpperCase()}_${year}.pdf`);
};

// -----------------------------------------------------------------
// 2. EXPORT LAMPIRAN A2 TO PDF
// -----------------------------------------------------------------
export const exportA2ToPDF = async (params: {
  year: string;
  quarterName: string;
  office: string;
  asOfDate: string;
  rows: RowA2[];
}) => {
  const { year, quarterName, office, asOfDate, rows } = params;
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4
  
  const pageWidth = doc.internal.pageSize.getWidth();

  const logo = await loadLogo();
  if (logo) {
    try {
      addWatermark(doc, logo);
      doc.addImage(logo, 'PNG', 12, 6, 14, 14);
    } catch (e) {
      console.error('Watermark/Logo failed:', e);
    }
  }
  
  // Header text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('LAMPIRAN A2', pageWidth - 30, 10, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`LAPORAN PENGURUSAN PEROLEHAN RISDA BAGI SUKU TAHUN ${quarterName.toUpperCase()} ${year}`, pageWidth / 2, 18, { align: 'center' });
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  const textWidth = doc.getTextWidth(`LAPORAN PENGURUSAN PEROLEHAN RISDA BAGI SUKU TAHUN ${quarterName.toUpperCase()} ${year}`);
  doc.line((pageWidth - textWidth) / 2, 20, (pageWidth + textWidth) / 2, 20);
  
  doc.setFontSize(10);
  doc.text(`Pusat Tanggungjawab : ${office.toUpperCase()}`, 12, 28);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 0, 0);
  doc.text('Perolehan Secara ', 12, 34);
  const offset1 = doc.getTextWidth('Perolehan Secara ');
  
  doc.setTextColor(220, 0, 0);
  doc.text('Sebut Harga', 12 + offset1, 34);
  const offset2 = doc.getTextWidth('Sebut Harga');
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(` setakat ${asOfDate}`, 12 + offset1 + offset2, 34);

  // Pad rows list up to at least 10 rows
  const paddedRows = [...rows];
  while (paddedRows.length < 10) {
    paddedRows.push({
      id: `pad-pdf-${paddedRows.length + 1}`,
      tenderNo: '',
      category: '',
      jenisPeruntukan: '',
      title: '',
      winnerName: '',
      winningPrice: 0
    });
  }

  // Table rows mapping using padded rows
  const bodyRows = paddedRows.map((r, index) => [
    (index + 1).toString(),
    r.tenderNo || '',
    r.category || '',
    r.jenisPeruntukan || '',
    r.title || '',
    r.winnerName || '',
    r.winningPrice === 0 ? '' : formatCurrency(r.winningPrice)
  ]);

  autoTable(doc, {
    startY: 40,
    head: [[
      { content: 'BIL.', styles: { halign: 'center' } },
      { content: 'NO. SEBUTHARGA', styles: { halign: 'left' } },
      { content: 'KATEGORI PEROLEHAN', styles: { halign: 'center' } },
      { content: 'JENIS PERUNTUKAN\n(BLK / KWR)', styles: { halign: 'center' } },
      { content: 'NAMA PROJEK', styles: { halign: 'left' } },
      { content: 'SYARIKAT BERJAYA', styles: { halign: 'left' } },
      { content: 'HARGA TAWARAN (RM)', styles: { halign: 'right' } }
    ]],
    body: bodyRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      font: 'helvetica',
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      cellPadding: 3,
      valign: 'middle'
    },
    headStyles: {
      fillColor: [240, 240, 240],
      fontStyle: 'bold',
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' }, // Bil
      1: { cellWidth: 32, fontStyle: 'bold' }, // No Sebutharga
      2: { cellWidth: 26, halign: 'center' }, // Kategori
      3: { cellWidth: 34, halign: 'center' }, // Peruntukan
      4: { cellWidth: 90 },                  // Nama Projek
      5: { cellWidth: 46 },                  // Syarikat Berjaya
      6: { cellWidth: 32, halign: 'right', fontStyle: 'bold' } // Harga Tawaran
    },
    didDrawPage: (data) => {
      if (logo) {
        addWatermark(doc, logo);
      }
    }
  });

  doc.save(`LAMPIRAN_A2_SUKUAN_${quarterName.toUpperCase()}_${year}.pdf`);
};

// -----------------------------------------------------------------
// 3. EXPORT LAMPIRAN A1 TO EXCEL
// -----------------------------------------------------------------
export const exportA1ToExcel = (params: {
  year: string;
  quarterName: string;
  office: string;
  asOfDate: string;
  rows: RowA1[];
}) => {
  const { year, quarterName, office, asOfDate, rows } = params;
  
  const totalRow: RowA1 = {
    category: 'BEKALAN',
    perancanganBil: rows.reduce((acc, r) => acc + r.perancanganBil, 0),
    perancanganNilai: rows.reduce((acc, r) => acc + r.perancanganNilai, 0),
    belumPelawaBil: rows.reduce((acc, r) => acc + r.belumPelawaBil, 0),
    prosesIklanBil: rows.reduce((acc, r) => acc + r.prosesIklanBil, 0),
    prosesPenilaianBil: rows.reduce((acc, r) => acc + r.prosesPenilaianBil, 0),
    prosesJkBil: rows.reduce((acc, r) => acc + r.prosesJkBil, 0),
    belumSstBil: rows.reduce((acc, r) => acc + r.belumSstBil, 0),
    sstBumiBil: rows.reduce((acc, r) => acc + r.sstBumiBil, 0),
    sstBumiNilai: rows.reduce((acc, r) => acc + r.sstBumiNilai, 0),
    sstNonBumiBil: rows.reduce((acc, r) => acc + r.sstNonBumiBil, 0),
    sstNonBumiNilai: rows.reduce((acc, r) => acc + r.sstNonBumiNilai, 0),
    syorJangkaan: ''
  };

  const sheetData = [
    ['LAMPIRAN A1', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [`LAPORAN PENGURUSAN PEROLEHAN RISDA BAGI SUKU TAHUN ${quarterName.toUpperCase()} ${year}`],
    [`Pusat Tanggungjawab: ${office.toUpperCase()}`],
    [`Perolehan Secara Sebut Harga setakat ${asOfDate}`],
    [],
    [
      'Kategori Perolehan',
      'Perancangan Tahunan Keseluruhan',
      '',
      'Belum Pelawa',
      'Telah Dipelawa',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Syor dan jangkaan selesai'
    ],
    [
      '',
      '',
      '',
      '',
      'Dalam proses iklan',
      'Dalam proses penilaian',
      'Dalam proses ke JK Sebut Harga',
      'Belum Dikeluarkan Surat Setuju Terima',
      'Telah Dikeluarkan Surat Setuju Terima / Pesanan Tempatan',
      '',
      '',
      '',
      '',
      ''
    ],
    [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Bumiputera',
      '',
      'Non-Bumiputera',
      '',
      'Jumlah Besar',
      ''
    ],
    [
      '',
      'Bil',
      'Nilai Perolehan (RM)',
      'Bil',
      'Bil',
      'Bil',
      'Bil',
      'Bil',
      'Bil',
      'RM',
      'Bil',
      'RM',
      'Bil',
      'RM'
    ]
  ];

  // Append body
  rows.forEach(r => {
    const bTotalBil = r.sstBumiBil + r.sstNonBumiBil;
    const bTotalNilai = r.sstBumiNilai + r.sstNonBumiNilai;
    sheetData.push([
      r.category === 'BEKALAN' ? 'Bekalan' : r.category === 'PERKHIDMATAN' ? 'Perkhidmatan' : 'Kerja',
      r.perancanganBil.toString(),
      r.perancanganNilai ? r.perancanganNilai.toFixed(2) : '-',
      r.belumPelawaBil.toString(),
      r.prosesIklanBil.toString(),
      r.prosesPenilaianBil.toString(),
      r.prosesJkBil.toString(),
      r.belumSstBil.toString(),
      r.sstBumiBil.toString(),
      r.sstBumiNilai ? r.sstBumiNilai.toFixed(2) : '-',
      r.sstNonBumiBil.toString(),
      r.sstNonBumiNilai ? r.sstNonBumiNilai.toFixed(2) : '-',
      bTotalBil.toString(),
      bTotalNilai ? bTotalNilai.toFixed(2) : '-',
      r.syorJangkaan || '-'
    ]);
  });

  // Append totals
  sheetData.push([
    'JUMLAH',
    totalRow.perancanganBil.toString(),
    totalRow.perancanganNilai ? totalRow.perancanganNilai.toFixed(2) : '-',
    totalRow.belumPelawaBil.toString(),
    totalRow.prosesIklanBil.toString(),
    totalRow.prosesPenilaianBil.toString(),
    totalRow.prosesJkBil.toString(),
    totalRow.belumSstBil.toString(),
    totalRow.sstBumiBil.toString(),
    totalRow.sstBumiNilai ? totalRow.sstBumiNilai.toFixed(2) : '-',
    totalRow.sstNonBumiBil.toString(),
    totalRow.sstNonBumiNilai ? totalRow.sstNonBumiNilai.toFixed(2) : '-',
    (totalRow.sstBumiBil + totalRow.sstNonBumiBil).toString(),
    (totalRow.sstBumiNilai + totalRow.sstNonBumiNilai).toFixed(2),
    ''
  ]);

  sheetData.push([]);
  sheetData.push(['', '', '', '', '', '', '', '', '', 'Disahkan oleh :']);
  sheetData.push(['', '', '', '', '', '', '', '', '', '...................................................']);
  sheetData.push(['', '', '', '', '', '', '', '', '', '(Ketua Pusat Tanggungjawab)']);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Setup merges
  ws['!merges'] = [
    // Header lines
    { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 14 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 14 } },

    // Category merges
    { s: { r: 5, c: 0 }, e: { r: 8, c: 0 } },

    // Perancangan
    { s: { r: 5, c: 1 }, e: { r: 7, c: 2 } },

    // Belum Pelawa
    { s: { r: 5, c: 3 }, e: { r: 8, c: 3 } },

    // Telah Dipelawa main block
    { s: { r: 5, c: 4 }, e: { r: 5, c: 13 } },

    // Telah Dipelawa subdivisions row 1
    { s: { r: 6, c: 4 }, e: { r: 8, c: 4 } }, // iklan
    { s: { r: 6, c: 5 }, e: { r: 8, c: 5 } }, // penilaian
    { s: { r: 6, c: 6 }, e: { r: 8, c: 6 } }, // jk
    { s: { r: 6, c: 7 }, e: { r: 8, c: 7 } }, // sst
    { s: { r: 6, c: 8 }, e: { r: 6, c: 13 } }, // sst block

    // Bumiputera, NonBumi, JumlahBesar subtitles
    { s: { r: 7, c: 8 }, e: { r: 7, c: 9 } },
    { s: { r: 7, c: 10 }, e: { r: 7, c: 11 } },
    { s: { r: 7, c: 12 }, e: { r: 7, c: 13 } },

    // Syor dan jangkaan selesai
    { s: { r: 5, c: 14 }, e: { r: 8, c: 14 } }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'LAMPIRAN A1');
  XLSX.writeFile(wb, `LAMPIRAN_A1_${quarterName.toUpperCase()}_${year}.xlsx`);
};

// -----------------------------------------------------------------
// 4. EXPORT LAMPIRAN A2 TO EXCEL
// -----------------------------------------------------------------
export const exportA2ToExcel = (params: {
  year: string;
  quarterName: string;
  office: string;
  asOfDate: string;
  rows: RowA2[];
}) => {
  const { year, quarterName, office, asOfDate, rows } = params;

  const sheetData = [
    ['LAMPIRAN A2', '', '', '', '', '', ''],
    [`LAPORAN PENGURUSAN PEROLEHAN RISDA BAGI SUKU TAHUN ${quarterName.toUpperCase()} ${year}`],
    [`Pusat Tanggungjawab: ${office.toUpperCase()}`],
    [`Perolehan Secara Sebut Harga setakat ${asOfDate}`],
    [],
    ['BIL.', 'NO. SEBUTHARGA', 'KATEGORI PEROLEHAN', 'JENIS PERUNTUKAN (BLK / KWR)', 'NAMA PROJEK', 'SYARIKAT BERJAYA', 'HARGA TAWARAN (RM)']
  ];

  // Pad rows list up to at least 10 rows
  const paddedRows = [...rows];
  while (paddedRows.length < 10) {
    paddedRows.push({
      id: `pad-xlsx-${paddedRows.length + 1}`,
      tenderNo: '',
      category: '',
      jenisPeruntukan: '',
      title: '',
      winnerName: '',
      winningPrice: 0
    });
  }

  paddedRows.forEach((r, idx) => {
    sheetData.push([
      (idx + 1).toString(),
      r.tenderNo || '',
      r.category || '',
      r.jenisPeruntukan || '',
      r.title || '',
      r.winnerName || '',
      r.winningPrice ? r.winningPrice.toFixed(2) : ''
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!merges'] = [
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } }
  ];

  // Set custom width
  ws['!cols'] = [
    { wch: 6 },  // Bil
    { wch: 20 }, // Tender No
    { wch: 18 }, // Kategori
    { wch: 24 }, // Peruntukan
    { wch: 60 }, // Tajuk Projek
    { wch: 30 }, // Syarikat Berjaya
    { wch: 20 }  // Harga
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'LAMPIRAN A2');
  XLSX.writeFile(wb, `LAMPIRAN_A2_${quarterName.toUpperCase()}_${year}.xlsx`);
};

// -----------------------------------------------------------------
// 5. EXPORT LAMPIRAN A1 TO WORD (DOCX)
// -----------------------------------------------------------------
export const exportA1ToWord = (params: {
  year: string;
  quarterName: string;
  office: string;
  asOfDate: string;
  rows: RowA1[];
}) => {
  const { year, quarterName, office, asOfDate, rows } = params;

  const totalRow: RowA1 = {
    category: 'BEKALAN',
    perancanganBil: rows.reduce((acc, r) => acc + r.perancanganBil, 0),
    perancanganNilai: rows.reduce((acc, r) => acc + r.perancanganNilai, 0),
    belumPelawaBil: rows.reduce((acc, r) => acc + r.belumPelawaBil, 0),
    prosesIklanBil: rows.reduce((acc, r) => acc + r.prosesIklanBil, 0),
    prosesPenilaianBil: rows.reduce((acc, r) => acc + r.prosesPenilaianBil, 0),
    prosesJkBil: rows.reduce((acc, r) => acc + r.prosesJkBil, 0),
    belumSstBil: rows.reduce((acc, r) => acc + r.belumSstBil, 0),
    sstBumiBil: rows.reduce((acc, r) => acc + r.sstBumiBil, 0),
    sstBumiNilai: rows.reduce((acc, r) => acc + r.sstBumiNilai, 0),
    sstNonBumiBil: rows.reduce((acc, r) => acc + r.sstNonBumiBil, 0),
    sstNonBumiNilai: rows.reduce((acc, r) => acc + r.sstNonBumiNilai, 0),
    syorJangkaan: ''
  };

  // Construct table rows for word
  const headerRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Kategori", bold: true, size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Plan (Bil)", bold: true, size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Plan (RM)", bold: true, size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Blm Pelawa", bold: true, size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Proses Iklan", bold: true, size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Proses Penil", bold: true, size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Proses JK", bold: true, size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Belum SST", bold: true, size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bumi (Bil)", bold: true, size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bumi (RM)", bold: true, size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NonBumi (Bil)", bold: true, size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NonBumi (RM)", bold: true, size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Jml Besar (Bil)", bold: true, size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Jml Besar (RM)", bold: true, size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Syor", bold: true, size: 16 })] })] })
    ]
  });

  const wordRows = rows.map(r => {
    const bTotalBil = r.sstBumiBil + r.sstNonBumiBil;
    const bTotalNilai = r.sstBumiNilai + r.sstNonBumiNilai;
    return new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.category === 'BEKALAN' ? 'Bekalan' : r.category === 'PERKHIDMATAN' ? 'Perkhidmatan' : 'Kerja', bold: true, size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(r.perancanganBil), size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(r.perancanganNilai), size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(r.belumPelawaBil), size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(r.prosesIklanBil), size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(r.prosesPenilaianBil), size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(r.prosesJkBil), size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(r.belumSstBil), size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(r.sstBumiBil), size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(r.sstBumiNilai), size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(r.sstNonBumiBil), size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(r.sstNonBumiNilai), size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(bTotalBil), size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(bTotalNilai), size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.syorJangkaan || '-', size: 16 })] })] })
      ]
    });
  });

  const totalsRowWord = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "JUMLAH", bold: true, size: 16 })] })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(totalRow.perancanganBil), bold: true, size: 16 })] })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(totalRow.perancanganNilai), bold: true, size: 16 })] })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(totalRow.belumPelawaBil), bold: true, size: 16 })] })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(totalRow.prosesIklanBil), bold: true, size: 16 })] })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(totalRow.prosesPenilaianBil), bold: true, size: 16 })] })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(totalRow.prosesJkBil), bold: true, size: 16 })] })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(totalRow.belumSstBil), bold: true, size: 16 })] })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(totalRow.sstBumiBil), bold: true, size: 16 })] })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(totalRow.sstBumiNilai), bold: true, size: 16 })] })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(totalRow.sstNonBumiBil), bold: true, size: 16 })] })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(totalRow.sstNonBumiNilai), bold: true, size: 16 })] })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNum(totalRow.sstBumiBil + totalRow.sstNonBumiBil), bold: true, size: 16 })] })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(totalRow.sstBumiNilai + totalRow.sstNonBumiNilai), bold: true, size: 16 })] })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } }),
      new TableCell({ children: [new Paragraph({ text: "" })], shading: { fill: "FFFF00", type: ShadingType.CLEAR } })
    ]
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            width: "297mm",
            height: "210mm"
          },
          margin: {
            top: "12mm",
            bottom: "12mm",
            left: "12mm",
            right: "12mm"
          }
        }
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: `LAMPIRAN A1\n`, size: 16, bold: true }),
            new TextRun({ text: `LAPORAN PENGURUSAN PEROLEHAN RISDA BAGI SUKU TAHUN ${quarterName.toUpperCase()} ${year}\n`, bold: true, size: 24, underline: {} })
          ],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [
            new TextRun({ text: `Pusat Tanggungjawab : `, bold: true, size: 18 }),
            new TextRun({ text: office.toUpperCase(), size: 18 })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Perolehan Secara Sebut Harga setakat ${asOfDate}`, size: 18, bold: true })
          ]
        }),
        new Paragraph({ text: "" }),
        new Table({
          rows: [headerRow, ...wordRows, totalsRowWord],
          width: { size: 100, type: WidthType.PERCENTAGE }
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [
            new TextRun({ text: "Disahkan oleh,\n\n\n\n\n................................................................\n", size: 18 }),
            new TextRun({ text: "(Ketua Pusat Tanggungjawab)\n", bold: true, size: 18 })
          ],
          alignment: AlignmentType.RIGHT
        } as any)
      ]
    }]
  });

  Packer.toBlob(doc).then(blob => {
    saveAs(blob, `LAMPIRAN_A1_SUKUAN_${quarterName.toUpperCase()}_${year}.docx`);
  });
};

// -----------------------------------------------------------------
// 6. EXPORT LAMPIRAN A2 TO WORD (DOCX)
// -----------------------------------------------------------------
export const exportA2ToWord = (params: {
  year: string;
  quarterName: string;
  office: string;
  asOfDate: string;
  rows: RowA2[];
}) => {
  const { year, quarterName, office, asOfDate, rows } = params;

  const headerRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "BIL.", bold: true, size: 18 })], alignment: AlignmentType.CENTER })], width: { size: 5, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NO. SEBUTHARGA", bold: true, size: 18 })] })], width: { size: 15, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "KATEGORI PEROLEHAN", bold: true, size: 18 })], alignment: AlignmentType.CENTER })], width: { size: 15, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "JENIS PERUNTUKAN (BLK / KWR)", bold: true, size: 18 })], alignment: AlignmentType.CENTER })], width: { size: 15, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NAMA PROJEK", bold: true, size: 18 })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "SYARIKAT BERJAYA", bold: true, size: 18 })] })], width: { size: 10, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "HARGA TAWARAN (RM)", bold: true, size: 18 })], alignment: AlignmentType.RIGHT })], width: { size: 10, type: WidthType.PERCENTAGE } })
    ]
  });

  // Pad rows list up to at least 10 rows
  const paddedRows = [...rows];
  while (paddedRows.length < 10) {
    paddedRows.push({
      id: `pad-word-${paddedRows.length + 1}`,
      tenderNo: '',
      category: '',
      jenisPeruntukan: '',
      title: '',
      winnerName: '',
      winningPrice: 0
    });
  }

  const wordRows = paddedRows.map((r, index) => new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (index + 1).toString(), size: 18 })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.tenderNo || '', bold: true, size: 18 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.category || '', size: 18 })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.jenisPeruntukan || '', size: 18 })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.title || '', size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.winnerName || '', size: 18 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.winningPrice === 0 ? '' : formatCurrency(r.winningPrice), size: 18 })], alignment: AlignmentType.RIGHT })] })
    ]
  }));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            width: "297mm",
            height: "210mm"
          },
          margin: {
            top: "12mm",
            bottom: "12mm",
            left: "12mm",
            right: "12mm"
          }
        }
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: `LAMPIRAN A2\n`, size: 16, bold: true }),
            new TextRun({ text: `LAPORAN PENGURUSAN PEROLEHAN RISDA BAGI SUKU TAHUN ${quarterName.toUpperCase()} ${year}\n`, bold: true, size: 24, underline: {} })
          ],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [
            new TextRun({ text: `Pusat Tanggungjawab : `, bold: true, size: 18 }),
            new TextRun({ text: office.toUpperCase(), size: 18 })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Perolehan Secara Sebut Harga setakat ${asOfDate}`, size: 18, bold: true })
          ]
        }),
        new Paragraph({ text: "" }),
        new Table({
          rows: [headerRow, ...wordRows],
          width: { size: 100, type: WidthType.PERCENTAGE }
        })
      ]
    }]
  });

  Packer.toBlob(doc).then(blob => {
    saveAs(blob, `LAMPIRAN_A2_SUKUAN_${quarterName.toUpperCase()}_${year}.docx`);
  });
};

// -----------------------------------------------------------------
// 3. EXPORT LAPORAN TAHUNAN (13-COLUMN SPREADSHEET AS SHOWN IN SCREENSHOT)
// -----------------------------------------------------------------
export interface RowAnnual {
  id: string;
  title: string;
  category: 'KERJA' | 'PERKHIDMATAN' | 'BEKALAN';
  tenderNo: string;
  tarikhSetujuTerima: string;
  tarikhSiapKerja: string;
  tempohSiapKerja: string;
  winnerName: string;
  winningPrice: number;
  noBaucar: string;
  tarikhDibayar: string;
  tarikhSiapBaru: string;
  statusPelaksanaan: string;
  isCustom?: boolean;
}

export const exportAnnualToPDF = async (params: {
  year: string;
  office: string;
  rows: RowAnnual[];
}) => {
  const { year, office, rows } = params;
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4
  const pageWidth = doc.internal.pageSize.getWidth();

  const logo = await loadLogo();
  if (logo) {
    try {
      addWatermark(doc, logo);
      doc.addImage(logo, 'PNG', 12, 6, 14, 14);
    } catch (e) {
      console.error('Watermark/Logo failed:', e);
    }
  }
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('LAPORAN TAHUNAN', pageWidth - 15, 10, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`LAPORAN TAHUNAN PEROLEHAN BAGI TAHUN ${year}`, pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Pusat Tanggungjawab : ${office.toUpperCase()}`, 15, 26);
  
  const headers = [
    [
      'BIL',
      'TAJUK SEBUTHARGA',
      'KERJA /\nPERKHIDMATAN /\nBEKALAN',
      'NO SEBUTHARGA',
      'TARIKH SETUJU\nTERIMA',
      'TARIKH SIAP\nKERJA',
      'TEMPOH SIAP\nKERJA',
      'NAMA SYARIKAT\nBERJAYA',
      'NILAI TAWARAN\n(RM)',
      'NO BAUCAR\nBAYARAN',
      'TARIKH\nDIBAYAR',
      'TARIKH SIAP\nKERJA BARU\n(SEKIRANYA\nADA EOT)',
      'STATUS'
    ]
  ];
  
  const body = rows.map((r, idx) => [
    idx + 1,
    r.title || '-',
    r.category || '-',
    r.tenderNo || '-',
    r.tarikhSetujuTerima || '-',
    r.tarikhSiapKerja || '-',
    r.tempohSiapKerja || '-',
    r.winnerName || '-',
    r.winningPrice ? r.winningPrice.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00',
    r.noBaucar || '-',
    r.tarikhDibayar || '-',
    r.tarikhSiapBaru || '-',
    r.statusPelaksanaan || '-'
  ]);
  
  autoTable(doc, {
    startY: 32,
    head: headers,
    body: body,
    theme: 'grid',
    styles: {
      fontSize: 6.5,
      cellPadding: 1.5,
      textColor: [0, 0, 0],
      lineColor: [40, 40, 40],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [250, 178, 30], // #FAB21E (RISDA Gold/Orange)
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' }, // BIL
      1: { cellWidth: 55 }, // TAJUK
      2: { cellWidth: 18, halign: 'center' }, // KATEGORI
      3: { cellWidth: 22, halign: 'center' }, // NO SEBUTHARGA
      4: { cellWidth: 16, halign: 'center' }, // SETUJU TERIMA
      5: { cellWidth: 16, halign: 'center' }, // SIAP KERJA
      6: { cellWidth: 16, halign: 'center' }, // TEMPOH SIAP
      7: { cellWidth: 25, halign: 'center' }, // SYARIKAT
      8: { cellWidth: 20, halign: 'right' }, // HARGA
      9: { cellWidth: 20, halign: 'center' }, // NO BAUCAR
      10: { cellWidth: 16, halign: 'center' }, // TARIKH DIBAYAR
      11: { cellWidth: 20, halign: 'center' }, // SIAP BARU (EOT)
      12: { cellWidth: 18, halign: 'center' } // STATUS
    },
    didDrawPage: (data) => {
      if (logo) {
        addWatermark(doc, logo);
      }
    }
  });
  
  doc.save(`LAPORAN_TAHUNAN_PEROLEHAN_${year}.pdf`);
};

export const exportAnnualToExcel = (params: {
  year: string;
  office: string;
  rows: RowAnnual[];
}) => {
  const { year, rows } = params;
  
  const headers = [
    'BIL', 
    'TAJUK SEBUTHARGA', 
    'KERJA / PERKHIDMATAN / BEKALAN', 
    'NO SEBUTHARGA', 
    'TARIKH SETUJU TERIMA', 
    'TARIKH SIAP KERJA', 
    'TEMPOH SIAP KERJA', 
    'NAMA SYARIKAT BERJAYA', 
    'NILAI TAWARAN (RM)', 
    'NO BAUCAR BAYARAN', 
    'TARIKH DIBAYAR', 
    'TARIKH SIAP KERJA BARU (SEKIRANYA ADA EOT)', 
    'STATUS'
  ];
  
  const data = rows.map((r, idx) => ({
    'BIL': idx + 1,
    'TAJUK SEBUTHARGA': r.title || '-',
    'KERJA / PERKHIDMATAN / BEKALAN': r.category || '-',
    'NO SEBUTHARGA': r.tenderNo || '-',
    'TARIKH SETUJU TERIMA': r.tarikhSetujuTerima || '-',
    'TARIKH SIAP KERJA': r.tarikhSiapKerja || '-',
    'TEMPOH SIAP KERJA': r.tempohSiapKerja || '-',
    'NAMA SYARIKAT BERJAYA': r.winnerName || '-',
    'NILAI TAWARAN (RM)': r.winningPrice || 0,
    'NO BAUCAR BAYARAN': r.noBaucar || '-',
    'TARIKH DIBAYAR': r.tarikhDibayar || '-',
    'TARIKH SIAP KERJA BARU (SEKIRANYA ADA EOT)': r.tarikhSiapBaru || '-',
    'STATUS': r.statusPelaksanaan || '-'
  }));
  
  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Tahunan');
  XLSX.writeFile(wb, `LAPORAN_TAHUNAN_PEROLEHAN_${year}.xlsx`);
};

export const exportAnnualToWord = (params: {
  year: string;
  office: string;
  rows: RowAnnual[];
}) => {
  const { year, office, rows } = params;
  
  const headerCells = [
    'BIL', 
    'TAJUK SEBUTHARGA', 
    'KERJA / PERKHIDMATAN / BEKALAN', 
    'NO SEBUTHARGA', 
    'TARIKH SETUJU TERIMA', 
    'TARIKH SIAP KERJA', 
    'TEMPOH SIAP KERJA', 
    'NAMA SYARIKAT BERJAYA', 
    'NILAI TAWARAN (RM)', 
    'NO BAUCAR BAYARAN', 
    'TARIKH DIBAYAR', 
    'TARIKH SIAP KERJA BARU (SEKIRANYA ADA EOT)', 
    'STATUS'
  ].map(text => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 14 })], alignment: AlignmentType.CENTER })],
    shading: { fill: 'FAB21E', type: ShadingType.CLEAR } as any,
  }));
  
  const headerRow = new TableRow({ children: headerCells });
  
  const wordRows = rows.map((r, idx) => new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (idx + 1).toString(), size: 14 })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.title || '-', size: 14 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.category || '-', size: 14 })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.tenderNo || '-', size: 14 })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.tarikhSetujuTerima || '-', size: 14 })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.tarikhSiapKerja || '-', size: 14 })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.tempohSiapKerja || '-', size: 14 })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.winnerName || '-', size: 14 })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(r.winningPrice), size: 14 })], alignment: AlignmentType.RIGHT })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.noBaucar || '-', size: 14 })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.tarikhDibayar || '-', size: 14 })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.tarikhSiapBaru || '-', size: 14 })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.statusPelaksanaan || '-', size: 14 })], alignment: AlignmentType.CENTER })] }),
    ]
  }));
  
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: "297mm", height: "210mm" },
          margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }
        }
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: `LAPORAN TAHUNAN PEROLEHAN BAGI TAHUN ${year}\n`, bold: true, size: 22, underline: {} })
          ],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [
            new TextRun({ text: `Pusat Tanggungjawab : `, bold: true, size: 16 }),
            new TextRun({ text: office.toUpperCase(), size: 16 })
          ]
        }),
        new Paragraph({ text: "" }),
        new Table({
          rows: [headerRow, ...wordRows],
          width: { size: 100, type: WidthType.PERCENTAGE }
        })
      ]
    }]
  });
  
  Packer.toBlob(doc).then(blob => {
    saveAs(blob, `LAPORAN_TAHUNAN_PEROLEHAN_${year}.docx`);
  });
};
