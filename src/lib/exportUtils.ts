import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel, VerticalAlign, ImageRun } from 'docx';
import { saveAs } from 'file-saver';

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr || dateStr === '-' || dateStr === 'TIADA') return dateStr || '-';
  
  try {
    // Standardize ISO format if it's just YYYY-MM-DD
    const standardized = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
    const d = new Date(standardized);
    if (isNaN(d.getTime())) return dateStr;
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    const days = ['AHAD', 'ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT', 'SABTU'];
    const dayName = days[d.getDay()];
    
    return `${day}/${month}/${year} (${dayName})`;
  } catch (e) {
    return dateStr;
  }
};

interface AdData {
  id?: string;
  tenderNo: string;
  title: string;
  state: string;
  office: string;
  closingDate: string;
  closingTime?: string;
  closingVenue?: string;
  briefingDate?: string;
  briefingTime?: string;
  briefingVenue?: string;
  visitDate?: string;
  visitVenue?: string;
  docStartDate?: string;
  docEndDate?: string;
  docVenue?: string;
  publishedDate?: string;
  licenseRequirements?: string;
  licenses?: {
    cidbSpkk: boolean;
    cidbPkk: boolean;
    stb: boolean;
    mof: boolean;
    tcc: boolean;
    pukonsa: boolean;
    kuhean: boolean;
    others?: string;
  };
  licenseDescriptions?: {
    cidbSpkk: string;
    cidbPkk: string;
    stb: string;
    mof: string;
    tcc: string;
    pukonsa: string;
    kuhean: string;
    others: string;
  };
  winner?: {
    companyName: string;
    representativeName?: string;
    contractStartDate?: string;
    contractEndDate?: string;
    location?: string;
    decisionDate?: string;
  };
  contractStartDate?: string;
  contractEndDate?: string;
  location?: string;
}

export interface ResultData {
  tenderNo: string;
  title: string;
  office: string;
  winnerName: string;
  startDate: string;
  endDate: string;
  location: string;
}

export interface AttendanceRecord {
  id?: string;
  companyName: string;
  ownerName: string;
  companyAddress: string;
  phoneNumber: string;
  email?: string;
  icNumber: string;
  timestamp: string;
  tenderNo?: string;
  docSeriesNo?: string; // For submission list
}

export const exportToExcel = (ad: AdData) => {
  const data = [
    ['MAKLUMAT IKLAN SEBUT HARGA'],
    [''],
    ['NO. SEBUT HARGA', ad.tenderNo],
    ['TAJUK PROJEK', ad.title],
    ['NEGERI', ad.state],
    ['PEJABAT', ad.office],
    ['TARIKH IKLAN', formatDate(ad.publishedDate)],
    [''],
    ['KEPERLUAN LESEN & SIJIL'],
    ['KEPERLUAN KHAS', ad.licenseRequirements || '-'],
    ['CIDB (SPKK)', ad.licenses?.cidbSpkk ? 'YA' : 'TIDAK'],
    ['CIDB (PKK)', ad.licenses?.cidbPkk ? 'YA' : 'TIDAK'],
    ['STB', ad.licenses?.stb ? 'YA' : 'TIDAK'],
    ['MOF', ad.licenses?.mof ? 'YA' : 'TIDAK'],
    ['TCC', ad.licenses?.tcc ? 'YA' : 'TIDAK'],
    ['PUKONSA', ad.licenses?.pukonsa ? 'YA' : 'TIDAK'],
    ['KUHEAN', ad.licenses?.kuhean ? 'YA' : 'TIDAK'],
    ['LAIN-LAIN', ad.licenses?.others || '-'],
    [''],
    ['MAKLUMAT TAKLIMAT & LAWATAN TAPAK'],
    ['TARIKH TAKLIMAT', formatDate(ad.briefingDate)],
    ['WAKTU TAKLIMAT', ad.briefingTime || '-'],
    ['TEMPAT TAKLIMAT', ad.briefingVenue || '-'],
    ['TARIKH LAWATAN', formatDate(ad.visitDate)],
    ['TEMPAT LAWATAN', ad.visitVenue || '-'],
    [''],
    ['PEMEROLEHAN DOKUMEN'],
    ['TARIKH MULA', formatDate(ad.docStartDate)],
    ['TARIKH AKHIR', formatDate(ad.docEndDate)],
    ['TEMPAT/KAUNTER', ad.docVenue || '-'],
    [''],
    ['PENUTUP SEBUT HARGA'],
    ['TARIKH TUTUP', formatDate(ad.closingDate)],
    ['WAKTU TUTUP', ad.closingTime || '12.00 TENGAH HARI'],
    ['TEMPAT TUTUP', ad.closingVenue || ad.docVenue || '-'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Iklan');
  XLSX.writeFile(wb, `Iklan_${ad.tenderNo.replace(/\//g, '_')}.xlsx`);
};

export const loadLogo = (): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Try fallback APIs if primary local fails
      const fallbackUrl1 = '/api/logo';
      const fallbackUrl2 = 'https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png';
      if (img.src !== fallbackUrl1 && !img.src.endsWith(fallbackUrl1)) {
        img.src = fallbackUrl1;
      } else if (img.src !== fallbackUrl2 && !img.src.endsWith(fallbackUrl2)) {
        img.src = fallbackUrl2;
      } else {
        resolve(null);
      }
    };
    // Prioritize the local file in the PUBLIC folder
    img.src = '/PUBLIC/intrologo_RISDA.png';
  });
};

export const loadQR = (adId?: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const url = adId 
      ? `${window.location.origin}/?adId=${adId}` 
      : `${window.location.origin}/`;

    QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
    .then((dataUrl) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        resolve(null);
      };
      img.src = dataUrl;
    })
    .catch((err) => {
      console.error('Client-side QR generation failed in PDF export, trying API fallback...', err);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = adId ? `/api/qr-code.png?adId=${adId}&origin=${encodeURIComponent(window.location.origin)}` : '/api/qr-code.png';
    });
  });
};

export const addWatermark = (
  doc: jsPDF, 
  logo: HTMLImageElement | null, 
  customY?: number, 
  customSize?: number, 
  customX?: number
) => {
  if (!logo) return;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Calculate size dynamically: 48% of the smaller dimension, up to 100mm
  const size = customSize !== undefined ? customSize : Math.min(100, Math.min(pageWidth, pageHeight) * 0.48);
  const x = customX !== undefined ? customX : (pageWidth - size) / 2;
  const y = customY !== undefined ? customY : (pageHeight - size) / 2;

  try {
    // Elegant faint opacity (0.05 is standard, very subtle and does not distract the reader)
    doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
    doc.addImage(logo, 'PNG', x, y, size, size);
    // Restore opacity
    doc.setGState(new (doc as any).GState({ opacity: 1 }));
  } catch (err) {
    console.error('Watermark failed:', err);
  }
};

const loadLogoAsBuffer = async (): Promise<Uint8Array | null> => {
  const img = await loadLogo();
  if (!img) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    
    // Convert to blob then to buffer
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(new Uint8Array(reader.result));
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(blob);
      }, 'image/png');
    });
  } catch (err) {
    console.error('Failed to process logo buffer:', err);
    return null;
  }
};

export const exportToPDF = async (ad: AdData) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Outer Blue Border
  doc.setDrawColor(0, 51, 153); // Deep blue (#003399)
  doc.setLineWidth(1.5);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
  
  // Logo
  const logo = await loadLogo();
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', pageWidth / 2 - 12, 10, 24, 24);
      // Add watermark
      addWatermark(doc, logo);
    } catch (e) {
      console.error('Failed to add logo to PDF:', e);
    }
  }

  // QR Code (Top Right)
  const qrImage = await loadQR(ad.id);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(pageWidth - 40, 10, 25, 25);
  if (qrImage) {
    try {
      doc.addImage(qrImage, 'PNG', pageWidth - 40, 10, 25, 25);
    } catch (e) {
      console.error('Failed to add QR image to PDF:', e);
      doc.setFontSize(6);
      doc.setTextColor(0, 0, 0);
      doc.text('QR CODE', pageWidth - 27.5, 22.5, { align: 'center' });
    }
  } else {
    doc.setFontSize(6);
    doc.setTextColor(0, 0, 0);
    doc.text('QR CODE', pageWidth - 27.5, 22.5, { align: 'center' });
  }

  // Header Title
  doc.setTextColor(0, 48, 96); // Dark blue
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('KENYATAAN SEBUT HARGA', pageWidth / 2, 42, { align: 'center' });
  
  doc.setFontSize(22);
  doc.text(ad.tenderNo, pageWidth / 2, 52, { align: 'center' });
  
  // Yellow Project Title Box
  doc.setFillColor(255, 255, 0); // Bright Yellow
  doc.rect(10, 58, pageWidth - 20, 15, 'F');
  doc.rect(10, 58, pageWidth - 20, 15, 'S');
  
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  const splitTitle = doc.splitTextToSize(ad.title.toUpperCase(), pageWidth - 30);
  doc.text(splitTitle, pageWidth / 2, 65, { align: 'center' });
  
  // Intro Text
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('1. Sebutharga adalah dipelawa daripada kontraktor tempatan bagi menawarkan kerja seperti tajuk di atas', 10, 78);
  doc.text('dan syarat-syarat berikut:', 10, 82);

  // Main Info Section with 3 Sub-Tables structure
  const getLicenseList = () => {
    const lines: string[] = [];
    const desc = ad.licenseDescriptions;
    const lic = ad.licenses;
    if (!lic || !desc) return '';

    lines.push('RISDA');
    if (lic.cidbSpkk) lines.push(`• ${desc.cidbSpkk}`);
    if (lic.stb) lines.push(`• ${desc.stb}`);
    if (lic.tcc) lines.push(`• ${desc.tcc}`);
    
    if (lic.pukonsa || lic.kuhean || lic.cidbPkk) {
      lines.push('');
      lines.push('            ATAU');
      lines.push('');
      if (lic.pukonsa) lines.push(`• ${desc.pukonsa}`);
      if (lic.kuhean) lines.push(`• ${desc.kuhean}`);
      if (lic.cidbPkk) lines.push(`• ${desc.cidbPkk}`);
      if (lic.tcc && (lic.pukonsa || lic.kuhean || lic.cidbPkk)) lines.push(`• ${desc.tcc}`);
    }

    if (lic.others) {
      lines.push(`• ${lic.others}`);
    }

    return lines.join('\n');
  };

  const venueContent = `PENDAFTARAN :\n${ad.briefingVenue?.toUpperCase() || ad.office.toUpperCase()}\n\nLAWATAN TAPAK :\n${ad.visitVenue?.toUpperCase() || ad.title.toUpperCase()}`;
  const docVenueContent = `Unit Kewangan\n${ad.docVenue || ad.office}`;

  autoTable(doc, {
    startY: 85,
    margin: { left: 10, right: 10 },
    head: [[
      { content: 'Wajib Berdaftar Dengan Kelayakan Berikut:', styles: { halign: 'center' } },
      { content: 'Wajib Hadir & Dengar Taklimat Tapak Pada', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Dokumen Sebut Harga boleh diperolehi secara percuma pada tempoh dan tempat berikut:', colSpan: 2, styles: { halign: 'center' } }
    ]],
    body: [
      [
        { content: getLicenseList(), rowSpan: 3, styles: { cellWidth: 55, valign: 'middle' } },
        { content: 'Waktu', styles: { fillColor: [245, 245, 245], cellWidth: 20, halign: 'center', valign: 'middle' } },
        { content: ad.briefingTime || '10.00 Pagi', styles: { fontStyle: 'bold', cellWidth: 45, halign: 'center', valign: 'middle' } },
        { content: 'Mula', styles: { fillColor: [245, 245, 245], cellWidth: 20, halign: 'center', valign: 'middle' } },
        { content: formatDate(ad.docStartDate), styles: { fontStyle: 'bold', cellWidth: 50, halign: 'center', valign: 'middle' } }
      ],
      [
        { content: 'Tarikh', styles: { fillColor: [245, 245, 245], halign: 'center', valign: 'middle' } },
        { content: formatDate(ad.briefingDate), styles: { fontStyle: 'bold', halign: 'center', valign: 'middle' } },
        { content: 'Hingga', styles: { fillColor: [245, 245, 245], halign: 'center', valign: 'middle' } },
        { content: formatDate(ad.docEndDate), styles: { fontStyle: 'bold', halign: 'center', valign: 'middle' } }
      ],
      [
        { content: 'Tempat', styles: { fillColor: [245, 245, 245], halign: 'center', valign: 'middle' } },
        { content: venueContent, styles: { fontSize: 7.5, fontStyle: 'bold', minCellHeight: 30, halign: 'center', valign: 'middle' } },
        { content: 'Tempat', styles: { fillColor: [245, 245, 245], halign: 'center', valign: 'middle' } },
        { content: docVenueContent, styles: { fontSize: 7.5, fontStyle: 'bold', halign: 'center', valign: 'middle' } }
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontSize: 8.5, fontStyle: 'bold', lineWidth: 0.1 },
    styles: { fontSize: 8, cellPadding: 2, valign: 'top', overflow: 'linebreak', textColor: [0, 0, 0] },
  });

  const tableFinalY = (doc as any).lastAutoTable.finalY + 3;

  // Paragraph 2
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('2. Dokumen Sebut Harga hanya diberikan kepada kontraktor yang memenuhi syarat-syarat berikut:', 10, tableFinalY);
  
  const bulletX = 15;
  let textY = tableFinalY + 4;
  
  const terms = [
    { label: 'a.', text: 'Hanya Penama didalam Sijil Asal CIDB, PUKONSA & STB yang masih SAH tempoh pendaftaran sahaja yang boleh hadir mendengar taklimat tapak dan tidak boleh mewakilkan pegawai selain penama;' },
    { label: 'b.', text: 'Hadir taklimat tapak dan membawa SLIP KEHADIRAN ASAL taklimat tapak.' },
    { label: 'c.', text: 'Membawa Sijil Asal CIDB, PUKONSA & STB yang sah tempoh lakunya berserta SATU salinan fotostat.' },
    { label: 'd.', text: 'Kontraktor diminta untuk mengimbas QR Code yang tertera di atas dan mengisi Borang Hadir Taklimat Tapak secara atas talian untuk pengesahan kehadiran selewatnya satu hari sebelum tarikh taklimat tapak dijalankan.' },
    { label: 'e.', text: 'Sijil TCC (Tax Compliance Certificate) berstatus "PATUH"' },
  ];

  terms.forEach(term => {
    doc.setFont('helvetica', 'bold');
    doc.text(term.label, bulletX, textY);
    doc.setFont('helvetica', 'normal');
    const splitTerm = doc.splitTextToSize(term.text, pageWidth - bulletX - 10);
    doc.text(splitTerm, bulletX + 5, textY);
    textY += (splitTerm.length * 3.5) + 1;
  });

  doc.text('    * Hanya bentuk perniagaan pemilikan tunggal SAHAJA TCC atas nama pemilik dibenarkan.', 20, textY);
  doc.text('       Selain daripada itu, TCC DIWAJIBKAN atas nama syarikat', 20, textY + 3.5);

  textY += 10;

  // Shopping Hours Table
  autoTable(doc, {
    startY: textY,
    margin: { left: 10, right: 10 },
    head: [['Hari', 'Waktu Pengambilan / Pembelian Dokumen']],
    body: [
      ['Isnin hingga Khamis', '9.00 pagi – 12.00 tengahari & 2.30 petang – 4.30 petang'],
      ['Jumaat', '9.00 pagi – 11.45 tengahari & 2.30 petang – 4.30 petang']
    ],
    theme: 'grid',
    headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontSize: 8.5, fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 8, halign: 'center', cellPadding: 1, textColor: [0, 0, 0] },
    columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: pageWidth - 70 } }
  });

  // Closing yellow header
  textY = (doc as any).lastAutoTable.finalY;
  doc.setFillColor(255, 255, 204); // Light yellow
  doc.rect(10, textY, pageWidth - 20, 6, 'F');
  doc.rect(10, textY, pageWidth - 20, 6, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('SEBUT HARGA TUTUP PADA', pageWidth / 2, textY + 4, { align: 'center' });

  // Closing info table
  autoTable(doc, {
    startY: textY + 6,
    margin: { left: 10, right: 10 },
    head: [['WAKTU', 'TARIKH', 'TEMPAT']],
    body: [[
      ad.closingTime || '12.00 TENGAH HARI', 
      formatDate(ad.closingDate), 
      `${ad.closingVenue || ad.docVenue || ad.office}`
    ]],
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8.5, fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 8.5, halign: 'center', valign: 'middle', cellPadding: 2, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 40 }, 2: { cellWidth: pageWidth - 100 } }
  });

  textY = (doc as any).lastAutoTable.finalY + 5;

  // Paragraph 3
  doc.setFontSize(9);
  const para3Text = '3. Dokumen Sebut harga yang telah sempurna diisi dan ditandatangani hendaklah dimasukkan ke dalam sampul surat yang berlakri dengan nombor dan tajuk sebutharga dicatatkan dan dimasukkan ke dalam peti sebutharga di tempat sepertimana jadual di atas.';
  const splitPara3 = doc.splitTextToSize(para3Text, pageWidth - 20);
  doc.text(splitPara3, 10, textY, { align: 'justify', maxWidth: pageWidth - 20 });

  // Warning Text
  doc.setTextColor(255, 0, 0);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  const warningText = 'PERINGATAN : “PEMBERI & PENERIMA RASUAH ADALAH SALAH DI BAWAH AKTA SURUHANJAYA PENCEGAH RASUAH MALAYSIA (AKTA 694)”';
  const splitWarning = doc.splitTextToSize(warningText, pageWidth - 20);
  doc.text(splitWarning, pageWidth / 2, 280, { align: 'center' });

  // Footer Date
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(`TARIKH IKLAN : ${formatDate(ad.publishedDate).toUpperCase()}`, pageWidth / 2, 290, { align: 'center' });

  doc.save(`Iklan_${ad.tenderNo.replace(/\//g, '_')}.pdf`);
};

export const exportToWord = async (ad: AdData) => {
  const lic = ad.licenses;
  const desc = ad.licenseDescriptions;
  if (!lic || !desc) return;

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: "KENYATAAN SEBUT HARGA", bold: true, size: 28 })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: ad.tenderNo, bold: true, size: 32 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: ad.title.toUpperCase(), bold: true, color: "000000" })],
                    alignment: AlignmentType.CENTER
                  })],
                  shading: { fill: "FFFF00" },
                  margins: { top: 200, bottom: 200, left: 200, right: 200 }
                })
              ]
            })
          ],
          columnWidths: [9000],
        }),
        new Paragraph({ text: "", spacing: { before: 200 } }),
        new Paragraph({
          children: [new TextRun("1. Sebutharga adalah dipelawa daripada kontraktor tempatan bagi menawarkan kerja seperti tajuk di atas dan syarat-syarat berikut:")],
          spacing: { after: 200 },
        }),
        // Main Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Wajib Berdaftar Dengan Kelayakan:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Wajib Hadir Taklimat:", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Dokumen Sebut Harga:", bold: true })] })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ 
                  children: [
                    lic.cidbSpkk ? new Paragraph({ children: [new TextRun(`• ${desc.cidbSpkk || "CIDB (SPKK)"}`)] }) : null,
                    lic.cidbPkk ? new Paragraph({ children: [new TextRun(`• ${desc.cidbPkk || "CIDB (PKK)"}`)] }) : null,
                    lic.stb ? new Paragraph({ children: [new TextRun(`• ${desc.stb || "SIJIL TARAF BUMIPUTERA (STB)"}`)] }) : null,
                    lic.mof ? new Paragraph({ children: [new TextRun(`• ${desc.mof || "SIJIL AKUAN PENDAFTARAN SYARIKAT (MOF)"}`)] }) : null,
                    lic.tcc ? new Paragraph({ children: [new TextRun(`• ${desc.tcc || "SIJIL PEMATUHAN CUKAI (TCC)"}`)] }) : null,
                    lic.pukonsa ? new Paragraph({ children: [new TextRun(`• ${desc.pukonsa || "PUKONSA"}`)] }) : null,
                    lic.kuhean ? new Paragraph({ children: [new TextRun(`• ${desc.kuhean || "KUHEAN"}`)] }) : null,
                  ].filter((p): p is Paragraph => p !== null)
                }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun(`Tarikh: ${formatDate(ad.briefingDate)}`)] }), new Paragraph({ children: [new TextRun(`Masa: ${ad.briefingTime || '-'}`)] }), new Paragraph({ children: [new TextRun(`Tempat: ${ad.briefingVenue || '-'}`)] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun(`Mula: ${formatDate(ad.docStartDate)}`)] }), new Paragraph({ children: [new TextRun(`Akhir: ${formatDate(ad.docEndDate)}`)] }), new Paragraph({ children: [new TextRun(`Tempat: ${ad.docVenue || '-'}`)] })] }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "", spacing: { before: 400 } }),
        new Paragraph({ children: [new TextRun({ text: "SEBUT HARGA TUTUP PADA", bold: true })], alignment: AlignmentType.CENTER }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "WAKTU", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TARIKH", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TEMPAT", bold: true })] })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun(ad.closingTime || '12.00 PM')] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun(formatDate(ad.closingDate))] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun(ad.closingVenue || ad.docVenue || '-')] })] }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "", spacing: { before: 400 } }),
        new Paragraph({
          children: [new TextRun({ text: "TARIKH IKLAN: " + (formatDate(ad.publishedDate)), bold: true })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Iklan_${ad.tenderNo.replace(/\//g, '_')}.docx`);
};

export const exportResultToPDF = async (res: ResultData) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Outer Black Border (Page 1) to match preview border-slate-900
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1.5);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
  
  // Format Office name cleanly to avoid duplication
  let officeClean = res.office.toUpperCase().trim();
  if (officeClean.startsWith("PEJABAT RISDA DAERAH")) {
    officeClean = officeClean.substring("PEJABAT RISDA DAERAH".length).trim();
  } else if (officeClean.startsWith("RISDA")) {
    officeClean = officeClean.substring("RISDA".length).trim();
  }
  // Remove any redundant "DAERAH" prefixes
  if (officeClean.startsWith("DAERAH")) {
    officeClean = officeClean.substring("DAERAH".length).trim();
  }

  const headerOfficeName = officeClean ? officeClean : "PRD";
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`URUSETIA PEROLEHAN PRD ${headerOfficeName}`, pageWidth - 15, 13, { align: 'right' });
  
  // Header - Right aligned info, Logo centered
  const logo = await loadLogo();
  if (logo) {
    doc.addImage(logo, 'PNG', pageWidth / 2 - 12, 18, 24, 24);
  }
  
  // Title
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('HEBAHAN', pageWidth / 2, 54, { align: 'center' });
  doc.setLineWidth(1.5);
  const titleTextWidth = doc.getTextWidth('HEBAHAN');
  doc.line(pageWidth / 2 - titleTextWidth / 2, 57, pageWidth / 2 + titleTextWidth / 2, 57);
  
  // Subtitle
  doc.setFontSize(13);
  doc.text('PEMBIDA YANG BERJAYA BAGI SEBUTHARGA', pageWidth / 2, 70, { align: 'center' });
  doc.setLineWidth(0.5);
  const subtitleWidth = doc.getTextWidth('PEMBIDA YANG BERJAYA BAGI SEBUTHARGA');
  doc.line(pageWidth / 2 - subtitleWidth / 2 - 5, 72, pageWidth / 2 + subtitleWidth / 2 + 5, 72);
  
  const officeDisplayText = `PEJABAT RISDA DAERAH ${officeClean}`;
  doc.text(officeDisplayText, pageWidth / 2, 79, { align: 'center' });
  const officeWidth = doc.getTextWidth(officeDisplayText);
  doc.line(pageWidth / 2 - officeWidth / 2 - 5, 81, pageWidth / 2 + officeWidth / 2 + 5, 81);

  // Dynamic Box Calculations to center the box vertically on the remaining page space
  const tajukText = res.title.toUpperCase();
  const winnerText = res.winnerName.toUpperCase();
  const tempohText = `${formatDate(res.startDate)} SEHINGGA ${formatDate(res.endDate)}`.toUpperCase();
  const tempatText = res.location.toUpperCase();

  // Width for text wrapping to fit elegantly inside the box (which has 15mm margins on sides)
  const wrapWidth = pageWidth - 102; // 210 - 102 = 108mm wrapping space
  const tajukLines = doc.splitTextToSize(tajukText, wrapWidth);
  const winnerLines = doc.splitTextToSize(winnerText, wrapWidth);
  const tempohLines = doc.splitTextToSize(tempohText, wrapWidth);
  const tempatLines = doc.splitTextToSize(tempatText, wrapWidth);

  // Line height/spacing rules
  const rowHeight = 6.2;
  const itemPadding = 9; // Gap between sections inside the box
  
  // Calculate dynamic heights corresponding to each element
  const h1 = rowHeight; // NO SEBUTHARGA is 1 line
  const h2 = tajukLines.length * rowHeight;
  const h3 = winnerLines.length * rowHeight;
  const h4 = tempohLines.length * rowHeight;
  const h5 = tempatLines.length * rowHeight;

  const totalContentHeight = h1 + itemPadding + h2 + itemPadding + h3 + itemPadding + h4 + itemPadding + h5;
  const boxPaddingTopBottom = 16; // Elegant internal padding
  const boxHeight = totalContentHeight + (boxPaddingTopBottom * 2);

  const boxY = 86;

  // Draw Box with thick black border
  doc.setLineWidth(1.5);
  doc.setDrawColor(0, 0, 0);
  doc.rect(15, boxY, pageWidth - 30, boxHeight);

  // Add box-centered watermark inside the box for elegant visual balance
  if (logo) {
    const boxWatermarkSize = Math.min(80, Math.min(pageWidth - 40, boxHeight) * 0.60);
    const watermarkX = (pageWidth - boxWatermarkSize) / 2;
    const watermarkY = boxY + (boxHeight - boxWatermarkSize) / 2;
    addWatermark(doc, logo, watermarkY, boxWatermarkSize, watermarkX);
  }

  // Positions inside the box
  let currentY = boxY + boxPaddingTopBottom + 4;
  const labelX = 23;
  const colonX = 66;
  const valueX = 69;

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);

  // 1. NO SEBUTHARGA
  doc.setFont('helvetica', 'bold');
  doc.text('NO SEBUTHARGA', labelX, currentY);
  doc.text(':', colonX, currentY);
  doc.setTextColor(0, 51, 153); // Royal Blue
  doc.text(res.tenderNo.toUpperCase(), valueX, currentY);

  // 2. TAJUK SEBUTHARGA
  currentY += h1 + itemPadding;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('TAJUK SEBUTHARGA', labelX, currentY);
  doc.text(':', colonX, currentY);
  doc.text(tajukLines, valueX, currentY);

  // 3. KONTRAKTOR
  currentY += h2 + itemPadding;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('KONTRAKTOR', labelX, currentY);
  doc.text(':', colonX, currentY);
  doc.setTextColor(0, 102, 51); // Elegant Green (#006633)
  doc.text(winnerLines, valueX, currentY);

  // 4. TEMPOH KERJA
  currentY += h3 + itemPadding;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('TEMPOH KERJA', labelX, currentY);
  doc.text(':', colonX, currentY);
  doc.text(tempohLines, valueX, currentY);

  // 5. TEMPAT
  currentY += h4 + itemPadding;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('TEMPAT', labelX, currentY);
  doc.text(':', colonX, currentY);
  doc.text(tempatLines, valueX, currentY);

  doc.save(`Keputusan_${res.tenderNo.replace(/\//g, '_')}.pdf`);
};

export const exportResultToWord = async (res: ResultData) => {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: `URUSETIA PEROLEHAN PRD ${res.office.toUpperCase()}`, bold: true, size: 20 })],
          alignment: AlignmentType.RIGHT,
        }),
        new Paragraph({
          children: [new TextRun({ text: "HEBAHAN", bold: true, size: 56, underline: {} })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 800, after: 400 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "PEMBIDA YANG BERJAYA BAGI SEBUTHARGA", bold: true, size: 28, underline: {} })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: `PEJABAT RISDA DAERAH ${res.office.toUpperCase()}`, bold: true, size: 28, underline: {} })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ spacing: { before: 400 } }),
                    new Table({
                      width: { size: 100, type: WidthType.PERCENTAGE },
                      borders: BorderStyle.NONE as any,
                      rows: [
                        new TableRow({
                          children: [
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NO SEBUTHARGA", bold: true })] })], borders: BorderStyle.NONE as any, width: { size: 30, type: WidthType.PERCENTAGE } }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun(`: ${res.tenderNo}`)] })], borders: BorderStyle.NONE as any }),
                          ]
                        }),
                        new TableRow({
                          children: [
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TAJUK SEBUTHARGA", bold: true })] })], borders: BorderStyle.NONE as any }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun(`: ${res.title.toUpperCase()}`)] })], borders: BorderStyle.NONE as any }),
                          ]
                        }),
                        new TableRow({
                          children: [
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "KONTRAKTOR", bold: true })] })], borders: BorderStyle.NONE as any }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun(`: ${res.winnerName.toUpperCase()}`)] })], borders: BorderStyle.NONE as any }),
                          ]
                        }),
                        new TableRow({
                          children: [
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TEMPOH KERJA", bold: true })] })], borders: BorderStyle.NONE as any }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun(`: ${formatDate(res.startDate)} SEHINGGA ${formatDate(res.endDate)}`)] })], borders: BorderStyle.NONE as any }),
                          ]
                        }),
                        new TableRow({
                          children: [
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TEMPAT", bold: true })] })], borders: BorderStyle.NONE as any }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun(`: ${res.location.toUpperCase()}`)] })], borders: BorderStyle.NONE as any }),
                          ]
                        }),
                      ]
                    }),
                    new Paragraph({ spacing: { after: 400 } }),
                  ],
                  margins: { left: 400, right: 400 }
                })
              ]
            })
          ]
        })
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Keputusan_${res.tenderNo.replace(/\//g, '_')}.docx`);
};

// Export Attendance List
export const exportAttendanceListToExcel = (ad: AdData, records: AttendanceRecord[]) => {
  // Sort records by docSeriesNo (registration order) and fallback to timestamp
  const sortedRecords = [...records].sort((a, b) => {
    const aNo = parseInt(a.docSeriesNo || '0');
    const bNo = parseInt(b.docSeriesNo || '0');
    if (aNo !== bNo && aNo !== 0 && bNo !== 0) return aNo - bNo;
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return aTime - bTime;
  });

  const data = [
    ['SENARAI KEHADIRAN TAKLIMAT'],
    [`NO SEBUTHARGA: ${ad.tenderNo}`],
    [`TAJUK: ${ad.title.toUpperCase()}`],
    [''],
    ['NO SIRI', 'NAMA SYARIKAT', 'NO. TEL SYARIKAT', 'NAMA/ TANDATANGAN']
  ];

  sortedRecords.forEach((rec, idx) => {
    data.push([(idx + 1).toString(), rec.companyName.toUpperCase(), rec.phoneNumber, '']);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kehadiran');
  XLSX.writeFile(wb, `Kehadiran_${ad.tenderNo.replace(/\//g, '_')}.xlsx`);
};

export const exportAttendanceListToPDF = async (ad: AdData, records: AttendanceRecord[]) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Sort records by docSeriesNo (registration order) and fallback to timestamp
  const sortedRecords = [...records].sort((a, b) => {
    const aNo = parseInt(a.docSeriesNo || '0');
    const bNo = parseInt(b.docSeriesNo || '0');
    if (aNo !== bNo && aNo !== 0 && bNo !== 0) return aNo - bNo;
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return aTime - bTime;
  });

  // Outer Blue Border (Page 1)
  doc.setDrawColor(0, 51, 153); // Deep blue (#003399)
  doc.setLineWidth(1.5);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

  // Header
  const logo = await loadLogo();
  if (logo) {
    doc.addImage(logo, 'PNG', pageWidth / 2 - 12, 10, 24, 24);
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('R I S D A', pageWidth / 2, 40, { align: 'center' });
  doc.setFontSize(10);
  doc.text('(PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH)', pageWidth / 2, 45, { align: 'center' });
  doc.text('(KEMENTERIAN KEMAJUAN DESA DAN WILAYAH)', pageWidth / 2, 50, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text('SENARAI KEHADIRAN TAKLIMAT', pageWidth / 2, 65, { align: 'center' });
  
  doc.setFontSize(11);
  doc.text(`NO SEBUTHARGA : ${ad.tenderNo}`, 20, 75);
  
  const splitTitle = doc.splitTextToSize(`TAJUK: ${ad.title.toUpperCase()}`, pageWidth - 40);
  doc.text(splitTitle, 20, 82);
  
  const tablesStartY = 82 + (splitTitle.length * 6);

  autoTable(doc, {
    startY: tablesStartY,
    margin: { top: 15, bottom: 15, left: 15, right: 15 },
    head: [['NO. SIRI', 'NAMA SYARIKAT', 'NO. TEL SYARIKAT', 'NAMA PEMILIK/\nTANDATANGAN']],
    body: [
      ...sortedRecords.map((rec, idx) => [
        (idx + 1).toString(),
        rec.companyName.toUpperCase(),
        rec.phoneNumber,
        '' // Blank for manual entry
      ]),
      // Add 10 empty rows for manual entry
      ...Array.from({ length: 10 }).map((_, idx) => [
        (sortedRecords.length + idx + 1).toString(),
        '',
        '',
        ''
      ])
    ],
    theme: 'grid',
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, halign: 'center' },
    styles: { fontSize: 9, cellPadding: 8, textColor: [0, 0, 0], lineWidth: 0.1, minCellHeight: 20 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 25, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 40 },
      3: { halign: 'center', cellWidth: 40 }
    },
    didDrawPage: (data) => {
      // Draw outer blue border on every page
      doc.setDrawColor(0, 51, 153); // Deep blue (#003399)
      doc.setLineWidth(1.5);
      doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
      
      // Draw watermark on all pages
      if (logo) {
        addWatermark(doc, logo);
      }
    }
  });

  doc.save(`Kehadiran_${ad.tenderNo.replace(/\//g, '_')}.pdf`);
};

export const exportAttendanceListToWord = async (ad: AdData, records: AttendanceRecord[]) => {
  // Sort records by docSeriesNo (registration order) and fallback to timestamp
  const sortedRecords = [...records].sort((a, b) => {
    const aNo = parseInt(a.docSeriesNo || '0');
    const bNo = parseInt(b.docSeriesNo || '0');
    if (aNo !== bNo && aNo !== 0 && bNo !== 0) return aNo - bNo;
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return aTime - bTime;
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: "R I S D A", bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
        new Paragraph({ children: [new TextRun({ text: "(PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH)", size: 20 })], alignment: AlignmentType.CENTER }),
        new Paragraph({ children: [new TextRun({ text: "(KEMENTERIAN KEMAJUAN DESA DAN WILAYAH)", size: 20 })], alignment: AlignmentType.CENTER }),
        new Paragraph({ children: [new TextRun({ text: "SENARAI KEHADIRAN TAKLIMAT", bold: true, size: 28, underline: {} })], alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 } }),
        new Paragraph({ children: [new TextRun({ text: `NO SEBUTHARGA : ${ad.tenderNo}`, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `TAJUK: ${ad.title.toUpperCase()}`, bold: true })], spacing: { after: 400 } }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NO SIRI", bold: true })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NAMA SYARIKAT", bold: true })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NO. TEL SYARIKAT", bold: true })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NAMA/ TANDATANGAN", bold: true })], alignment: AlignmentType.CENTER })] }),
              ]
            }),
            ...sortedRecords.map((rec, idx) => new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun((idx + 1).toString())], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun(rec.companyName.toUpperCase())] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun(rec.phoneNumber)], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun("")], alignment: AlignmentType.CENTER })] }),
              ]
            }))
          ]
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Kehadiran_${ad.tenderNo.replace(/\//g, '_')}.docx`);
};

// Export Submission List
export const exportSubmissionListToExcel = (ad: AdData, records: AttendanceRecord[]) => {
  // Sort records by docSeriesNo (registration order) and fallback to timestamp
  const sortedRecords = [...records].sort((a, b) => {
    const aNo = parseInt(a.docSeriesNo || '0');
    const bNo = parseInt(b.docSeriesNo || '0');
    if (aNo !== bNo && aNo !== 0 && bNo !== 0) return aNo - bNo;
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return aTime - bTime;
  });

  const data = [
    ['BORANG SERAHAN DOKUMEN SEBUTHARGA'],
    [`NO SEBUTHARGA: ${ad.tenderNo}`],
    [`TAJUK: ${ad.title.toUpperCase()}`],
    [''],
    ['NO SIRI', 'NAMA SYARIKAT', 'NO. SIRI SEBUTHARGA', 'T/TANGAN & COP SYARIKAT']
  ];

  sortedRecords.forEach((rec, idx) => {
    data.push([(idx + 1).toString(), rec.companyName.toUpperCase(), rec.docSeriesNo || '-', '']);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Serahan');
  XLSX.writeFile(wb, `Serahan_${ad.tenderNo.replace(/\//g, '_')}.xlsx`);
};

export const exportSubmissionListToPDF = async (ad: AdData, records: AttendanceRecord[]) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Sort records by docSeriesNo (registration order) and fallback to timestamp
  const sortedRecords = [...records].sort((a, b) => {
    const aNo = parseInt(a.docSeriesNo || '0');
    const bNo = parseInt(b.docSeriesNo || '0');
    if (aNo !== bNo && aNo !== 0 && bNo !== 0) return aNo - bNo;
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return aTime - bTime;
  });

  // Outer Blue Border (Page 1)
  doc.setDrawColor(0, 51, 153); // Deep blue (#003399)
  doc.setLineWidth(1.5);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

  // Header
  const logo = await loadLogo();
  if (logo) {
    doc.addImage(logo, 'PNG', pageWidth / 2 - 12, 10, 24, 24);
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('R I S D A', pageWidth / 2, 40, { align: 'center' });
  doc.setFontSize(10);
  doc.text('(PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH)', pageWidth / 2, 45, { align: 'center' });
  doc.text('(KEMENTERIAN KEMAJUAN DESA DAN WILAYAH)', pageWidth / 2, 50, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text('BORANG SERAHAN DOKUMEN SEBUTHARGA', pageWidth / 2, 65, { align: 'center' });
  
  doc.setFontSize(11);
  doc.text(`NO SEBUTHARGA : ${ad.tenderNo}`, 20, 75);
  
  const splitTitle = doc.splitTextToSize(`TAJUK: ${ad.title.toUpperCase()}`, pageWidth - 40);
  doc.text(splitTitle, 20, 82);
  
  const tablesStartY = 82 + (splitTitle.length * 6);

  autoTable(doc, {
    startY: tablesStartY,
    margin: { top: 15, bottom: 15, left: 15, right: 15 },
    head: [['NO. SIRI', 'NAMA SYARIKAT', 'NO. SIRI\nSEBUTHARGA', 'T/TANGAN & COP\nSYARIKAT']],
    body: [
      ...sortedRecords.map((rec, idx) => [
        (idx + 1).toString(),
        rec.companyName.toUpperCase(),
        rec.docSeriesNo || '',
        ''
      ]),
      // Add 10 empty rows for manual entry
      ...Array.from({ length: 10 }).map((_, idx) => [
        (sortedRecords.length + idx + 1).toString(),
        '',
        '',
        ''
      ])
    ],
    theme: 'grid',
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, halign: 'center' },
    styles: { fontSize: 9, cellPadding: 8, textColor: [0, 0, 0], lineWidth: 0.1, minCellHeight: 20 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 25, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 40 },
      3: { halign: 'center', cellWidth: 40 }
    },
    didDrawPage: (data) => {
      // Draw outer blue border on every page
      doc.setDrawColor(0, 51, 153); // Deep blue (#003399)
      doc.setLineWidth(1.5);
      doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
      
      // Draw watermark on all pages
      if (logo) {
        addWatermark(doc, logo);
      }
    }
  });

  doc.save(`Serahan_${ad.tenderNo.replace(/\//g, '_')}.pdf`);
};

export const exportSubmissionListToWord = async (ad: AdData, records: AttendanceRecord[]) => {
  // Sort records by docSeriesNo (registration order) and fallback to timestamp
  const sortedRecords = [...records].sort((a, b) => {
    const aNo = parseInt(a.docSeriesNo || '0');
    const bNo = parseInt(b.docSeriesNo || '0');
    if (aNo !== bNo && aNo !== 0 && bNo !== 0) return aNo - bNo;
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return aTime - bTime;
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: "R I S D A", bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
        new Paragraph({ children: [new TextRun({ text: "(PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH)", size: 20 })], alignment: AlignmentType.CENTER }),
        new Paragraph({ children: [new TextRun({ text: "(KEMENTERIAN KEMAJUAN DESA DAN WILAYAH)", size: 20 })], alignment: AlignmentType.CENTER }),
        new Paragraph({ children: [new TextRun({ text: "BORANG SERAHAN DOKUMEN SEBUTHARGA", bold: true, size: 28, underline: {} })], alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 } }),
        new Paragraph({ children: [new TextRun({ text: `NO SEBUTHARGA : ${ad.tenderNo}`, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `TAJUK: ${ad.title.toUpperCase()}`, bold: true })], spacing: { after: 400 } }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NO SIRI", bold: true })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NAMA SYARIKAT", bold: true })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NO. SIRI SEBUTHARGA", bold: true })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "T/TANGAN & COP SYARIKAT", bold: true })], alignment: AlignmentType.CENTER })] }),
              ]
            }),
            ...sortedRecords.map((rec, idx) => new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun((idx + 1).toString())], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun(rec.companyName.toUpperCase())] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun(rec.docSeriesNo || '')], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun("")], alignment: AlignmentType.CENTER })] }),
              ]
            }))
          ]
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Serahan_${ad.tenderNo.replace(/\//g, '_')}.docx`);
};

export const exportIndividualSiteVisitForm = async (ad: AdData, rec: AttendanceRecord, serialNo?: string) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = await loadLogo();

  const drawCopy = (offsetY: number, titleCopy: string) => {
    // Add watermark for each copy
    if (logo) {
      const pWidth = doc.internal.pageSize.getWidth();
      try {
        doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
        doc.addImage(logo, 'PNG', pWidth / 2 - 40, offsetY + 40, 80, 80);
        doc.setGState(new (doc as any).GState({ opacity: 1 }));
      } catch (err) {
        console.error('Copy watermark failed:', err);
      }
    }

    // Logo
    if (logo) {
      doc.addImage(logo, 'PNG', 15, offsetY + 6, 16, 16);
    }

    // Header Right
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(titleCopy, pageWidth - 15, offsetY + 10, { align: 'right' });

    // Main Header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH (RISDA)', 35, offsetY + 16);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('BORANG LAWATAN TAPAK UNTUK:-', 15, offsetY + 28);

    // Project Title
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    const splitTitle = doc.splitTextToSize(ad.title.toUpperCase(), pageWidth - 30);
    doc.text(splitTitle, 15, offsetY + 33);
    
    const titleLines = splitTitle.length;
    const projectInfoY = offsetY + 35 + (titleLines * 4.5);

    // Info Section
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    // No. Tawaran row
    doc.text('No. Tawaran', 15, projectInfoY);
    doc.text(':', 45, projectInfoY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(ad.tenderNo, 50, projectInfoY);
    
    // Tarikh row
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Tarikh/Masa Lawatan :', 85, projectInfoY);
    doc.text(`${formatDate(ad.visitDate)} / ${ad.briefingTime || '10.00 Pagi'}`, 118, projectInfoY);
    
    // Office row
    const officeY = projectInfoY + 4;
    doc.text(`${ad.visitVenue?.toUpperCase() || `PEJABAT RISDA ${ad.office.toUpperCase()}`}`, 118, officeY);

    //Nama Syarikat
    const companyY = officeY + 6;
    doc.text('Nama Syarikat', 15, companyY);
    doc.text(':', 45, companyY);
    doc.line(50, companyY + 1, pageWidth - 15, companyY + 1);
    doc.setFont('helvetica', 'bold');
    doc.text(rec.companyName.toUpperCase(), 50, companyY);

    // Alamat Syarikat
    const addressY = companyY + 6;
    doc.setFont('helvetica', 'normal');
    doc.text('Alamat Syarikat', 15, addressY);
    doc.text(':', 45, addressY);
    doc.line(50, addressY + 1, pageWidth - 15, addressY + 1);
    doc.line(50, addressY + 7, pageWidth - 15, addressY + 7);
    doc.line(50, addressY + 13, pageWidth - 15, addressY + 13);
    
    if (rec.companyAddress) {
      doc.setFontSize(7);
      const splitAddress = doc.splitTextToSize(rec.companyAddress, pageWidth - 65);
      doc.text(splitAddress, 50, addressY);
    }

    // Tel & Fax
    const telY = addressY + 19;
    doc.text('No.Telefon Syarikat', 15, telY);
    doc.text(':', 45, telY);
    doc.line(50, telY + 1, 85, telY + 1);
    doc.text(rec.phoneNumber, 50, telY);

    doc.text('No.Fax :', 90, telY);
    doc.line(100, telY + 1, pageWidth - 15, telY + 1);

    // Nama Pemilik
    const nameY = telY + 6;
    doc.text('Nama Pemilik', 15, nameY);
    doc.text(':', 45, nameY);
    doc.line(50, nameY + 1, pageWidth - 15, nameY + 1);
    doc.setFont('helvetica', 'bold');
    doc.text((rec.ownerName || (rec as any).representativeName || '').toUpperCase(), 50, nameY);

    // IC & Kelas
    const icY = nameY + 6;
    doc.setFont('helvetica', 'normal');
    doc.text('No. Kad Pengenalan', 15, icY);
    doc.text(':', 45, icY);
    doc.line(50, icY + 1, 85, icY + 1);
    doc.text(rec.icNumber || '', 50, icY);

    doc.setFontSize(7);
    doc.text('KELAS :', 90, icY);
    
    const getKelasText = () => {
      const lines: string[] = [];
      const lic = ad.licenses;
      const desc = ad.licenseDescriptions;
      if (!lic || !desc) return '';

      const group1 = [];
      if (lic.cidbSpkk) group1.push(desc.cidbSpkk);
      if (lic.stb) group1.push(desc.stb);
      
      const group2 = [];
      if (lic.pukonsa) group2.push(desc.pukonsa);
      if (lic.kuhean) group2.push(desc.kuhean);
      if (lic.cidbPkk) group2.push(desc.cidbPkk);

      let text = '';
      if (group1.length > 0) text += group1.join(' & ');
      if (group1.length > 0 && group2.length > 0) text += ' ATAU ';
      if (group2.length > 0) text += group2.join(' & ');
      if (lic.tcc) {
        text += (text ? '\n' : '') + desc.tcc;
      }
      if (lic.others) {
        text += (text ? '\n' : '') + lic.others;
      }
      return text;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    const kelasLines = doc.splitTextToSize(getKelasText(), 100);
    doc.text(kelasLines, 103, icY);

    // Tandatangan
    const signY = icY + 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Tandatangan', 15, signY);
    doc.text(':', 45, signY);
    doc.line(50, signY + 1, 85, signY + 1);

    // Untuk Kegunaan RISDA
    const footerY = signY + 12;
    doc.setFont('helvetica', 'bold');
    doc.text('Untuk Kegunaan RISDA :-', 15, footerY);

    doc.setFont('helvetica', 'normal');
    doc.text('Nama Pegawai', 15, footerY + 6);
    doc.text(':', 45, footerY + 6);
    doc.line(50, footerY + 7, 85, footerY + 7);

    doc.text('Tandatangan & Cop', 15, footerY + 12);
    doc.text(':', 45, footerY + 12);
    doc.line(50, footerY + 13, 85, footerY + 13);

    // Box with NO.
    doc.rect(90, footerY + 2, 65, 18);
    doc.setFontSize(16);
    doc.text('NO.', 95, footerY + 10);
    if (serialNo) {
      doc.setFontSize(24);
      doc.text(serialNo, 120, footerY + 13);
    }

    // Bottom line
    doc.setLineDashPattern([2, 1], 0);
    doc.line(15, offsetY + 135, pageWidth - 15, offsetY + 135);
    doc.setLineDashPattern([], 0);
  };

  drawCopy(0, 'SALINAN RISDA');
  drawCopy(145, 'SALINAN PEMBEKAL/KONTRAKTOR');

  doc.save(`Borang_Lawatan_${rec.companyName.replace(/\s+/g, '_')}.pdf`);
};

export const exportIndividualSiteVisitFormToWord = async (ad: AdData, rec: AttendanceRecord, serialNo?: string) => {
  const logoBuffer = await loadLogoAsBuffer();

  const createCopyChildren = (titleCopy: string) => {
    const children: any[] = [];

    // Header Right
    children.push(new Paragraph({
      children: [new TextRun({ text: titleCopy, bold: true, size: 16 })],
      alignment: AlignmentType.RIGHT,
    }));

    // Logo & Main Title (side-by-side using borderless table)
    if (logoBuffer) {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: BorderStyle.NONE as any,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: logoBuffer,
                        transformation: { width: 45, height: 45 },
                      } as any)
                    ]
                  })
                ],
                width: { size: 10, type: WidthType.PERCENTAGE },
                borders: BorderStyle.NONE as any,
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ 
                        text: "PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH (RISDA)", 
                        bold: true, 
                        size: 20, // 10pt
                      })
                    ]
                  })
                ],
                width: { size: 90, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                borders: BorderStyle.NONE as any,
              })
            ]
          })
        ]
      }));
    } else {
      children.push(new Paragraph({
        children: [new TextRun({ text: "PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH (RISDA)", bold: true, size: 20 })],
        alignment: AlignmentType.LEFT,
      }));
    }

    children.push(new Paragraph({
      children: [new TextRun({ text: "BORANG LAWATAN TAPAK UNTUK:-", bold: true, size: 18 })],
      spacing: { before: 150, after: 100 }
    }));

    children.push(new Paragraph({
      children: [new TextRun({ text: ad.title.toUpperCase(), bold: true, size: 20, underline: {} })],
      spacing: { before: 100, after: 200 }
    }));

    // Main Info Table
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: BorderStyle.NONE as any,
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "No. Tawaran", size: 18 })] })], width: { size: 20, type: WidthType.PERCENTAGE }, borders: BorderStyle.NONE as any }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `: ${ad.tenderNo}`, bold: true, size: 24 })] })], width: { size: 40, type: WidthType.PERCENTAGE }, borders: BorderStyle.NONE as any }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Tarikh/Masa Lawatan : ${formatDate(ad.visitDate)} / ${ad.briefingTime || '10.00 Pagi'}`, size: 18 })], alignment: AlignmentType.RIGHT })], borders: BorderStyle.NONE as any }),
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: "" })], borders: BorderStyle.NONE as any }),
            new TableCell({ children: [new Paragraph({ text: "" })], borders: BorderStyle.NONE as any }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ad.visitVenue?.toUpperCase() || `PEJABAT RISDA ${ad.office.toUpperCase()}`, size: 18 })], alignment: AlignmentType.RIGHT })], borders: BorderStyle.NONE as any }),
          ]
        }),
      ]
    }));

    children.push(new Paragraph({ spacing: { before: 200 } }));

    // Form Section
    const createRow = (label: string, value: string, isLine: boolean = true) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: label, size: 18 })] })], width: { size: 30, type: WidthType.PERCENTAGE }, borders: BorderStyle.NONE as any }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `: ${value}`, bold: true, size: 18 })] })], borders: isLine ? { bottom: { style: BorderStyle.THICK, size: 1, color: "000000" } } : BorderStyle.NONE as any }),
      ]
    });

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        createRow("Nama Syarikat", rec.companyName.toUpperCase()),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Alamat Syarikat", size: 18 })] })], borders: BorderStyle.NONE as any }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `: ${rec.companyAddress || ''}`, size: 14 })] })], borders: { bottom: { style: BorderStyle.THICK, size: 1, color: "000000" } } }),
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: "" })], borders: BorderStyle.NONE as any }),
            new TableCell({ children: [new Paragraph({ text: "" })], borders: { bottom: { style: BorderStyle.THICK, size: 1, color: "000000" } } }),
          ]
        }),
      ]
    }));

    children.push(new Paragraph({ spacing: { before: 100 } }));

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "No.Telefon Syarikat", size: 18 })] })], width: { size: 30, type: WidthType.PERCENTAGE }, borders: BorderStyle.NONE as any }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `: ${rec.phoneNumber}`, size: 18 })] })], borders: { bottom: { style: BorderStyle.THICK, size: 1, color: "000000" } } }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: "No.Fax : ", size: 18 })], alignment: AlignmentType.CENTER })], 
              borders: BorderStyle.NONE as any 
            }),
            new TableCell({ children: [new Paragraph({ text: "" })], borders: { bottom: { style: BorderStyle.THICK, size: 1, color: "000000" } } }),
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Nama Pemilik", size: 18 })] })], borders: BorderStyle.NONE as any }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `: ${(rec.ownerName || (rec as any).representativeName || '').toUpperCase()}`, bold: true, size: 18 })] })], columnSpan: 3, borders: { bottom: { style: BorderStyle.THICK, size: 1, color: "000000" } } }),
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "No. Kad Pengenalan", size: 18 })] })], borders: BorderStyle.NONE as any }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `: ${rec.icNumber || ''}`, size: 18 })] })], borders: { bottom: { style: BorderStyle.THICK, size: 1, color: "000000" } } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: " KELAS :", bold: true, size: 14 })] })], verticalAlign: VerticalAlign.TOP, borders: BorderStyle.NONE as any }),
            new TableCell({ 
              children: (() => {
                const lines: Paragraph[] = [];
                const lic = ad.licenses;
                const desc = ad.licenseDescriptions;
                if (!lic || !desc) return [];

                const group1 = [];
                if (lic.cidbSpkk) group1.push(desc.cidbSpkk);
                if (lic.stb) group1.push(desc.stb);
                
                const group2 = [];
                if (lic.pukonsa) group2.push(desc.pukonsa);
                if (lic.kuhean) group2.push(desc.kuhean);
                if (lic.cidbPkk) group2.push(desc.cidbPkk);

                if (group1.length > 0) {
                  lines.push(new Paragraph({ children: [new TextRun({ text: group1.join(' & ') + (group2.length > 0 ? ' ATAU' : ''), bold: true, size: 12 })] }));
                }
                if (group2.length > 0) {
                  lines.push(new Paragraph({ children: [new TextRun({ text: group2.join(' & '), bold: true, size: 12 })] }));
                }
                if (lic.tcc) {
                  lines.push(new Paragraph({ children: [new TextRun({ text: desc.tcc, bold: true, size: 12 })] }));
                }
                if (lic.others) {
                  lines.push(new Paragraph({ children: [new TextRun({ text: lic.others, bold: true, size: 12 })] }));
                }
                return lines;
              })(),
              borders: BorderStyle.NONE as any
            }),
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tandatangan", size: 18 })] })], borders: BorderStyle.NONE as any }),
            new TableCell({ children: [new Paragraph({ text: ":" })], columnSpan: 3, borders: { bottom: { style: BorderStyle.THICK, size: 1, color: "000000" } } }),
          ]
        }),
      ]
    }));

    children.push(new Paragraph({ spacing: { before: 300 } }));

    children.push(new Paragraph({ children: [new TextRun({ text: "Untuk Kegunaan RISDA :-", bold: true, size: 18 })] }));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ 
              children: [
                new Paragraph({ children: [new TextRun({ text: "Nama Pegawai : ", size: 18 })] }),
                new Paragraph({ children: [new TextRun({ text: "", size: 18 })], border: { bottom: { style: BorderStyle.THICK, size: 1, color: "000000" } } }),
                new Paragraph({ children: [new TextRun({ text: "Tandatangan & Cop :", size: 18 })], spacing: { before: 200 } }),
                new Paragraph({ children: [new TextRun({ text: "", size: 18 })], border: { bottom: { style: BorderStyle.THICK, size: 1, color: "000000" } } }),
              ], 
              width: { size: 60, type: WidthType.PERCENTAGE },
              borders: BorderStyle.NONE as any
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: "NO.", bold: true, size: 32 }), new TextRun({ text: serialNo ? `  ${serialNo}` : "", bold: true, size: 48 })], alignment: AlignmentType.CENTER })], 
              verticalAlign: VerticalAlign.CENTER,
              width: { size: 40, type: WidthType.PERCENTAGE } 
            }),
          ]
        }),
      ]
    }));

    children.push(new Paragraph({ text: "---------------------------------------------------------------------------------------------------------------------------------", spacing: { before: 200, after: 200 } }));
    
    return children;
  };

  const doc = new Document({
    sections: [{
      children: [
        ...createCopyChildren("SALINAN RISDA"),
        ...createCopyChildren("SALINAN PEMBEKAL/KONTRAKTOR")
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Borang_Lawatan_${rec.companyName.replace(/\s+/g, '_')}.docx`);
};

export const exportIndividualSiteVisitFormToExcel = (ad: AdData, rec: AttendanceRecord, serialNo?: string) => {
  const ws_data = [
    ['', '', 'SALINAN RISDA'],
    ['PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH (RISDA)'],
    ['BORANG LAWATAN TAPAK UNTUK:-'],
    [ad.title.toUpperCase()],
    [''],
    ['No. Tawaran', `: ${ad.tenderNo}`, '', 'Tarikh/Masa Lawatan :', `${formatDate(ad.visitDate)} / ${ad.briefingTime || '10.00 Pagi'}`],
    ['', '', '', '', ad.visitVenue?.toUpperCase() || `PEJABAT RISDA ${ad.office.toUpperCase()}`],
    [''],
    ['MAKLUMAT SYARIKAT'],
    ['Nama Syarikat', `: ${rec.companyName.toUpperCase()}`],
    ['Alamat Syarikat', `: ${rec.companyAddress || ''}`],
    ['', ''],
    ['No.Telefon Syarikat', `: ${rec.phoneNumber}`, 'No.Fax :', ''],
    ['Nama Pemilik', `: ${(rec.ownerName || (rec as any).representativeName || '').toUpperCase()}`],
    ['No. Kad Pengenalan', `: ${rec.icNumber || ''}`, 'KELAS :', (() => {
      const lic = ad.licenses;
      const desc = ad.licenseDescriptions;
      if (!lic || !desc) return '';
      const group1 = [];
      if (lic.cidbSpkk) group1.push(desc.cidbSpkk);
      if (lic.stb) group1.push(desc.stb);
      const group2 = [];
      if (lic.pukonsa) group2.push(desc.pukonsa);
      if (lic.kuhean) group2.push(desc.kuhean);
      if (lic.cidbPkk) group2.push(desc.cidbPkk);

      let text = '';
      if (group1.length > 0) text += group1.join(' & ');
      if (group1.length > 0 && group2.length > 0) text += ' ATAU ';
      if (group2.length > 0) text += group2.join(' & ');
      return text;
    })()],
    ['', '', '', ad.licenses?.tcc ? (ad.licenseDescriptions?.tcc || 'TCC') : ''],
    ['', '', '', ad.licenses?.others ? ad.licenses.others : ''],
    ['Tandatangan', ':'],
    [''],
    ['Untuk Kegunaan RISDA :-', '', '', 'NO.', serialNo || ''],
    ['Nama Pegawai', ':'],
    ['Tandatangan & Cop', ':'],
    [''],
    ['----------------------------------------------------------------------------------------------------'],
    ['', '', 'SALINAN PEMBEKAL/KONTRAKTOR'],
    ['PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH (RISDA)'],
    ['BORANG LAWATAN TAPAK UNTUK:-'],
    [ad.title.toUpperCase()],
    [''],
    ['No. Tawaran', `: ${ad.tenderNo}`, '', 'Tarikh/Masa Lawatan :', `${formatDate(ad.visitDate)} / ${ad.briefingTime || '10.00 Pagi'}`],
    ['', '', '', '', ad.visitVenue?.toUpperCase() || `PEJABAT RISDA ${ad.office.toUpperCase()}`],
    [''],
    ['MAKLUMAT SYARIKAT'],
    ['Nama Syarikat', `: ${rec.companyName.toUpperCase()}`],
    ['Alamat Syarikat', `: ${rec.companyAddress || ''}`],
    ['', ''],
    ['No.Telefon Syarikat', `: ${rec.phoneNumber}`, 'No.Fax :', ''],
    ['Nama Pemilik', `: ${(rec.ownerName || (rec as any).representativeName || '').toUpperCase()}`],
    ['No. Kad Pengenalan', `: ${rec.icNumber || ''}`, 'KELAS :', (() => {
      const lic = ad.licenses;
      const desc = ad.licenseDescriptions;
      if (!lic || !desc) return '';
      const group1 = [];
      if (lic.cidbSpkk) group1.push(desc.cidbSpkk);
      if (lic.stb) group1.push(desc.stb);
      const group2 = [];
      if (lic.pukonsa) group2.push(desc.pukonsa);
      if (lic.kuhean) group2.push(desc.kuhean);
      if (lic.cidbPkk) group2.push(desc.cidbPkk);

      let text = '';
      if (group1.length > 0) text += group1.join(' & ');
      if (group1.length > 0 && group2.length > 0) text += ' ATAU ';
      if (group2.length > 0) text += group2.join(' & ');
      return text;
    })()],
    ['', '', '', ad.licenses?.tcc ? (ad.licenseDescriptions?.tcc || 'TCC') : ''],
    ['', '', '', ad.licenses?.others ? ad.licenses.others : ''],
    ['Tandatangan', ':'],
    [''],
    ['Untuk Kegunaan RISDA :-', '', '', 'NO.', serialNo || ''],
    ['Nama Pegawai', ':'],
    ['Tandatangan & Cop', ':'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  
  // Setting column widths
  const wscols = [
    { wch: 20 },
    { wch: 40 },
    { wch: 15 },
    { wch: 40 }
  ];
  ws['!cols'] = wscols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Borang_Lawatan');
  XLSX.writeFile(wb, `Borang_Lawatan_${rec.companyName.replace(/\s+/g, '_')}.xlsx`);
};
