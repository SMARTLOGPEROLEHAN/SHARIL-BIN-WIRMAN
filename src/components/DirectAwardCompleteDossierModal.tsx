import React from 'react';
import { 
  X, 
  Printer, 
  CheckCircle2, 
  FileText, 
  Megaphone, 
  Inbox, 
  Scale, 
  Trophy, 
  ShieldCheck, 
  FileCheck, 
  BarChart3, 
  Coins, 
  Building2, 
  Calendar, 
  Clock, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DirectAwardCompleteDossierModalProps {
  orderNo?: string;
  onClose: () => void;
  record?: any;
}

export default function DirectAwardCompleteDossierModal({
  orderNo = 'TT-2026-00125',
  onClose,
  record
}: DirectAwardCompleteDossierModalProps) {
  const data = record || {
    orderNo: 'TT-2026-00125',
    poNo: '2645070125',
    title: 'Pembekalan Komputer Desktop dan Monitor',
    category: 'BEKALAN',
    supplierName: 'SABAH MAJU SDN BHD',
    supplierCode: 'MOF 357-02033456',
    allocationCode: 'B62-020101-1002',
    estimatedAmount: 15500,
    unitOffice: 'Pejabat RISDA Daerah Beaufort',
    requestDate: '02/10/2026',
    approvedDate: '02/10/2026',
    loGeneratedDate: '03/10/2026',
    status: 'SELESAI',
    noBaucar: 'BV/RISDA/2026/044',
    tarikhDibayar: '03/10/2026'
  };

  const handlePrintDossier = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>DOSSIER PEROLEHAN LENGKAP TAWARAN TERUS - ${data.orderNo}</title>
        <style>
          @media print {
            @page { size: A4 portrait; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 10.5px; color: #111; line-height: 1.35; margin: 0; padding: 10px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; }
          .inst-name { font-size: 13px; font-weight: bold; text-transform: uppercase; margin: 0; }
          .title { font-size: 15px; font-weight: bold; text-transform: uppercase; margin: 4px 0; }
          .subtitle { font-size: 10px; font-weight: bold; color: #333; }
          
          .section-block { border: 1px solid #333; margin-bottom: 12px; page-break-inside: avoid; }
          .section-header { background: #f0f0f0; border-bottom: 1px solid #333; padding: 4px 8px; font-weight: bold; text-transform: uppercase; font-size: 10.5px; }
          .section-content { padding: 8px; font-size: 10px; }

          .grid-2 { display: flex; justify-content: space-between; gap: 10px; }
          .col { flex: 1; }

          table.data-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9.5px; }
          table.data-table th, table.data-table td { border: 1px solid #333; padding: 4px 6px; }
          table.data-table th { background: #fafafa; text-align: left; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }

          .badge { display: inline-block; padding: 2px 6px; border: 1px solid #222; font-size: 9px; font-weight: bold; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="inst-name">PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH (RISDA)</div>
          <div class="title">DOSSIER REKOD LENGKAP PEROLEHAN TAWARAN TERUS</div>
          <div class="subtitle">TATACARA PENGURUSAN PEROLEHAN KERAJAAN (1PP PK 2 / AP 173 / AP 176)</div>
        </div>

        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; font-size: 11px;">
          <div><strong>NO. RUJUKAN:</strong> ${data.orderNo}</div>
          <div><strong>NO. PESANAN (PO):</strong> ${data.poNo || '2645070125'}</div>
          <div><strong>STATUS:</strong> <span class="badge">SELESAI (LENGKAP)</span></div>
        </div>

        <!-- 1. PERMOHONAN -->
        <div class="section-block">
          <div class="section-header">1. Maklumat Permohonan Awal</div>
          <div class="section-content">
            <div class="grid-2">
              <div class="col">
                <strong>Tajuk Perolehan:</strong> ${data.title}<br>
                <strong>Kategori:</strong> ${data.category} (≤RM50,000)<br>
                <strong>Pusat Tanggungjawab:</strong> ${data.unitOffice}
              </div>
              <div class="col">
                <strong>Tarikh Permohonan:</strong> ${data.requestDate}<br>
                <strong>Kod Vot / Peruntukan:</strong> ${data.allocationCode}<br>
                <strong>Nilai Anggaran Jabatan:</strong> RM ${Number(data.estimatedAmount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        <!-- 2. KELULUSAN 1 -->
        <div class="section-block">
          <div class="section-header">2. Kelulusan Permohonan Memulakan Pelawaan (AP 173)</div>
          <div class="section-content">
            Disemak dan disahkan bahawa peruntukan tahunan mencukupi. Diluluskan oleh Pegawai Pengawal/Ketua PTJ untuk pelawaan minimum 3 pembekal.
            <br><strong>Status:</strong> DILULUSKAN | <strong>Tarikh:</strong> ${data.approvedDate}
          </div>
        </div>

        <!-- 3. PELAWAAN 3 PEMBEKAL -->
        <div class="section-block">
          <div class="section-header">3. Pelawaan Sebut Harga Kepada 3 Pembekal (AP 173)</div>
          <div class="section-content">
            <table class="data-table">
              <tr>
                <th style="width: 30px;">Bil</th>
                <th>Nama Pembekal Berdaftar</th>
                <th>Emel Rasmi</th>
                <th>Tarikh Pelawaan</th>
                <th>Status Respons</th>
              </tr>
              <tr>
                <td class="text-center">1</td>
                <td>ABC ENTERPRISE</td>
                <td>abcenterprise@gmail.com</td>
                <td>02/10/2026</td>
                <td>🟢 Tawaran Diterima</td>
              </tr>
              <tr>
                <td class="text-center">2</td>
                <td>XYZ TRADING</td>
                <td>xyztrading@gmail.com</td>
                <td>02/10/2026</td>
                <td>🟢 Tawaran Diterima</td>
              </tr>
              <tr>
                <td class="text-center">3</td>
                <td>SABAH MAJU SDN BHD</td>
                <td>sabahmaju@gmail.com</td>
                <td>02/10/2026</td>
                <td>🟢 Tawaran Diterima</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- 4 & 5. TAWARAN & PENILAIAN -->
        <div class="section-block">
          <div class="section-header">4 & 5. Penerimaan Tawaran & Matriks Penilaian</div>
          <div class="section-content">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Kriteria Penilaian</th>
                  <th class="text-center">SABAH MAJU (Pemenang)</th>
                  <th class="text-center">ABC ENTERPRISE</th>
                  <th class="text-center">XYZ TRADING</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Harga Tawaran (RM)</strong></td>
                  <td class="text-center font-bold">RM 15,500.00 (Terendah)</td>
                  <td class="text-center">RM 15,800.00</td>
                  <td class="text-center">RM 16,200.00</td>
                </tr>
                <tr>
                  <td><strong>Tempoh Penghantaran</strong></td>
                  <td class="text-center font-bold">7 Hari</td>
                  <td class="text-center">14 Hari</td>
                  <td class="text-center">10 Hari</td>
                </tr>
                <tr>
                  <td><strong>Pematuhan Spesifikasi</strong></td>
                  <td class="text-center">Lengkap (100%)</td>
                  <td class="text-center">Lengkap (100%)</td>
                  <td class="text-center">Lengkap (100%)</td>
                </tr>
                <tr>
                  <td><strong>Dokumen SSM & SST</strong></td>
                  <td class="text-center">Lengkap Disahkan</td>
                  <td class="text-center">Lengkap Disahkan</td>
                  <td class="text-center">Lengkap Disahkan</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 6 & 7. PEMILIHAN & KELULUSAN 2 -->
        <div class="section-block">
          <div class="section-header">6 & 7. Pemilihan Pembekal & Pengesahan Perakuan</div>
          <div class="section-content">
            <strong>Pembekal Dipilih:</strong> ${data.supplierName} (${data.supplierCode})<br>
            <strong>Nilai Tawaran Disetujui:</strong> RM ${Number(data.estimatedAmount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}<br>
            <strong>Justifikasi Pemilihan:</strong> Pembekal SABAH MAJU dicadangkan berdasarkan tawaran harga paling menguntungkan kerajaan, pematuhan spesifikasi teknikal 100%, tempoh penghantaran paling pantas (7 hari) serta dokumen sokongan yang lengkap dan teratur.
          </div>
        </div>

        <!-- 8. JANA LO -->
        <div class="section-block">
          <div class="section-header">8. Pesanan Tempatan (LO Kerajaan) & Bayaran</div>
          <div class="section-content">
            <div class="grid-2">
              <div class="col">
                <strong>No. Pesanan Tempatan (PO):</strong> ${data.poNo || '2645070125'}<br>
                <strong>Tarikh LO Dikeluarkan:</strong> ${data.loGeneratedDate || '03/10/2026'}<br>
                <strong>Status Kewangan:</strong> SELESAI DIBAYAR
              </div>
              <div class="col">
                <strong>No. Baucar Bayaran:</strong> ${data.noBaucar || 'BV/RISDA/2026/044'}<br>
                <strong>Tarikh Bayaran:</strong> ${data.tarikhDibayar || '03/10/2026'}<br>
                <strong>Pusat Pembayar:</strong> Unit Kewangan RISDA
              </div>
            </div>
          </div>
        </div>

        <!-- 9. SELESAI & ARKIB -->
        <div class="section-block">
          <div class="section-header">9. Perakuan Penutupan Rekod Perolehan (SELESAI)</div>
          <div class="section-content" style="text-align: center;">
            Perolehan ini telah selesai sepenuhnya mengikut semua tatacara perolehan kerajaan 1PP PK 2, AP 173 dan AP 176. Rekod disimpan dalam Fail Induk Perolehan Pejabat RISDA Daerah.
          </div>
        </div>
      </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 text-slate-800 dark:text-slate-100 animate-fadeIn">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-black uppercase">
                STATUS: SELESAI LENGKAP
              </span>
              <span className="text-xs font-mono font-bold text-slate-400">
                1PP PK 2 / AP 173 / AP 176
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white mt-1">
              Dossier Rekod Perolehan Lengkap
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Satu rekod bersambung dari Permohonan hingga Selesai Bayaran bagi <strong>{data.orderNo}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintDossier}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <Printer size={15} /> Cetak Dossier Penuh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 9-STAGE TIMELINE CARDS */}
        <div className="space-y-3 text-xs">
          
          {/* Stage 1: Permohonan */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 font-black">
              1
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 dark:text-white uppercase font-black">1. Permohonan Tawaran Terus</strong>
                <span className="font-mono text-slate-400">{data.requestDate}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Permohonan didaftarkan bagi: <strong>{data.title}</strong> (Vot: {data.allocationCode}) dengan anggaran RM {Number(data.estimatedAmount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}.
              </p>
            </div>
          </div>

          {/* Stage 2: Kelulusan 1 */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 font-black">
              2
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 dark:text-white uppercase font-black">2. Kelulusan Permohonan (AP 173)</strong>
                <span className="text-emerald-500 font-bold">🟢 DILULUSKAN</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Disahkan oleh Ketua PTJ untuk meneruskan pelawaan kepada sekurang-kurangnya 3 pembekal berdaftar.
              </p>
            </div>
          </div>

          {/* Stage 3: Pelawaan 3 Pembekal */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0 font-black">
              3
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 dark:text-white uppercase font-black">3. Pelawaan 3 Pembekal</strong>
                <span className="font-mono text-blue-500">3 Pembekal</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Pelawaan rasmi dihantar kepada <strong>ABC ENTERPRISE</strong>, <strong>XYZ TRADING</strong>, dan <strong>SABAH MAJU SDN BHD</strong>.
              </p>
            </div>
          </div>

          {/* Stage 4: Tawaran Diterima */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-500 flex items-center justify-center shrink-0 font-black">
              4
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 dark:text-white uppercase font-black">4. Tawaran Diterima</strong>
                <span className="font-mono text-purple-400">3 Respons</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Ketiga-tiga pembekal mengemukakan sebut harga rasmi bersama sijil SSM/SST dan katalog spesifikasi sebelum tarikh tutup.
              </p>
            </div>
          </div>

          {/* Stage 5: Penilaian */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 font-black">
              5
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 dark:text-white uppercase font-black">5. Penilaian Tawaran (Kajian Pasaran)</strong>
                <span className="text-amber-500 font-bold">Matriks Lengkap</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Perbandingan: SABAH MAJU (RM15,500 | 7 hari), ABC (RM15,800 | 14 hari), XYZ (RM16,200 | 10 hari). Kesemua pembekal mematuhi spesifikasi 100%.
              </p>
            </div>
          </div>

          {/* Stage 6: Pemilihan */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 font-black">
              6
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 dark:text-white uppercase font-black">6. Pemilihan Pembekal</strong>
                <span className="font-bold text-emerald-500">{data.supplierName}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                SABAH MAJU SDN BHD dicadangkan berdasarkan harga tawaran terendah yang menguntungkan kerajaan dan penghantaran paling pantas.
              </p>
            </div>
          </div>

          {/* Stage 7: Kelulusan 2 */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-500 flex items-center justify-center shrink-0 font-black">
              7
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 dark:text-white uppercase font-black">7. Kelulusan Pemilihan (Workflow PTJ)</strong>
                <span className="text-teal-500 font-bold">🟢 DILULUSKAN</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Disediakan oleh Pegawai Perolehan, disahkan oleh Pegawai Penyemak dan diluluskan oleh Pegawai Daerah RISDA (Ketua PTJ).
              </p>
            </div>
          </div>

          {/* Stage 8: Jana LO */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 font-black">
              8
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 dark:text-white uppercase font-black">8. Jana Pesanan Tempatan (LO)</strong>
                <span className="font-mono font-bold text-emerald-500">PO: {data.poNo || '2645070125'}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Pesanan Kerajaan dikeluarkan, dihantar ke Unit Kewangan dan bayaran disahkan dengan No. Baucar <strong>{data.noBaucar || 'BV/RISDA/2026/044'}</strong>.
              </p>
            </div>
          </div>

          {/* Stage 9: Laporan & Selesai */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-2 border-emerald-500/40 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 font-black">
              ✓
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <strong className="text-emerald-600 dark:text-emerald-400 uppercase font-black">9. Laporan & Selesai (Arkib Induk)</strong>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px]">SELESAI</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Seluruh kitaran hayat perolehan telah lengkap direkodkan dan diarkibkan dalam Laporan Perolehan Tawaran Terus Jabatan.
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase rounded-xl cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
