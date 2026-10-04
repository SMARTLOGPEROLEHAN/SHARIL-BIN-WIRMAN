import React, { useState } from 'react';
import { 
  BarChart3, 
  Download, 
  Printer, 
  FileText, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Building2, 
  Coins, 
  Search, 
  Filter, 
  Layers, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Eye,
  FileCheck,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import DirectAwardCompleteDossierModal from './DirectAwardCompleteDossierModal';

interface DirectAwardReportViewProps {
  records: any[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onNavigateToSection?: (section: string, tab?: string) => void;
}

export default function DirectAwardReportView({
  records = [],
  activeTab = 'ringkasan',
  onTabChange,
  onNavigateToSection
}: DirectAwardReportViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('SEMUA');
  const [selectedRecordForDossier, setSelectedRecordForDossier] = useState<any | null>(null);

  // Filter records
  const filtered = records.filter(r => {
    if (selectedCategory !== 'SEMUA' && r.category !== selectedCategory) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchOrder = (r.orderNo || '').toLowerCase().includes(q);
      const matchPo = (r.poNo || '').toLowerCase().includes(q);
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchSup = (r.supplierName || '').toLowerCase().includes(q);
      if (!matchOrder && !matchPo && !matchTitle && !matchSup) return false;
    }
    return true;
  });

  // Calculate totals
  const totalCount = records.length;
  const totalAmount = records.reduce((sum, r) => sum + (Number(r.estimatedAmount) || 0), 0);
  const completedCount = records.filter(r => r.status === 'SELESAI' || r.status === 'LULUS' || r.status === 'DIBAYAR').length;
  const inProgressCount = records.filter(r => r.status === 'DALAM PROSES' || r.status === 'DALAM SEMAKAN' || r.status === 'MENUNGGU KELULUSAN').length;

  const handleExportExcel = () => {
    const exportData = filtered.map((r, idx) => ({
      'Bil': idx + 1,
      'No. Permohonan': r.orderNo,
      'No. PO (LO)': r.poNo || '-',
      'Tajuk Perolehan': r.title,
      'Kategori': r.category,
      'Pembekal Terpilih': r.supplierName,
      'Kod Vot': r.allocationCode,
      'Nilai Perolehan (RM)': r.estimatedAmount,
      'Tarikh Permohonan': r.requestDate,
      'Tarikh Kelulusan': r.approvedDate || '-',
      'Status': r.status,
      'Integrasi Kewangan': r.financeStatus || 'BELUM DIHANTAR',
      'No. Baucar': r.noBaucar || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan_Tawaran_Terus');
    XLSX.writeFile(wb, `Laporan_Tawaran_Terus_RISDA_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Laporan Tawaran Terus berjaya dieksport ke fail Excel!');
  };

  const handlePrintMasterReport = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>LAPORAN INDUK TAWARAN TERUS RISDA</title>
        <style>
          @media print {
            @page { size: A4 landscape; margin: 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 15px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .title { font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 0; }
          .subtitle { font-size: 10px; color: #444; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9.5px; }
          th, td { border: 1px solid #333; padding: 5px 6px; text-align: left; }
          th { background: #f2f2f2; text-transform: uppercase; text-align: center; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">LAPORAN INDUK PEROLEHAN TAWARAN TERUS (1PP PK 2 / AP 173 / AP 176)</div>
          <div class="subtitle">PEJABAT RISDA DAERAH BEAUFORT • TARIKH CETAKAN: ${new Date().toLocaleDateString('ms-MY')}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">Bil</th>
              <th style="width: 110px;">No. Permohonan</th>
              <th style="width: 90px;">No. PO (LO)</th>
              <th>Tajuk Perolehan</th>
              <th style="width: 70px;">Kategori</th>
              <th>Pembekal Terpilih</th>
              <th style="width: 80px;" class="text-right">Nilai (RM)</th>
              <th style="width: 80px;" class="text-center">Status</th>
              <th style="width: 90px;">No. Baucar</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((r, i) => `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td style="font-family: monospace; font-weight: bold;">${r.orderNo}</td>
                <td style="font-family: monospace;">${r.poNo || '-'}</td>
                <td>${r.title}</td>
                <td class="text-center">${r.category}</td>
                <td><strong>${r.supplierName}</strong></td>
                <td class="text-right" style="font-family: monospace;">RM ${Number(r.estimatedAmount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</td>
                <td class="text-center font-bold">${r.status}</td>
                <td style="font-family: monospace;">${r.noBaucar || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="6" class="text-right">JUMLAH KESELURUHAN (RM):</th>
              <th class="text-right" style="font-family: monospace;">RM ${totalAmount.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</th>
              <th colspan="2"></th>
            </tr>
          </tfoot>
        </table>
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
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Jumlah Rekod Dossier</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{totalCount} Perolehan</div>
            <div className="text-xs font-bold text-slate-400">Semua Peringkat</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center font-black">
            <BarChart3 size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Jumlah Nilai Komitmen</span>
            <div className="text-2xl font-black text-amber-500">RM {totalAmount.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</div>
            <div className="text-xs font-bold text-slate-400">Di Bawah Kod Vot</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center font-black">
            <DollarSign size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Perolehan Selesai Lengkap</span>
            <div className="text-2xl font-black text-emerald-500">{completedCount} Selesai</div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Dari Permohonan ke Baucar</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center font-black">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Dalam Aliran Kerja</span>
            <div className="text-2xl font-black text-blue-500">{inProgressCount} Dalam Proses</div>
            <div className="text-xs font-bold text-blue-600 dark:text-blue-400">Peringkat 1 hingga 8</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center font-black">
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* 2. SEARCH, FILTER & EXPORT BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-96">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari no. permohonan, tajuk, pembekal, PO..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-black/5 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-500 placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['SEMUA', 'BEKALAN', 'PERKHIDMATAN', 'KERJA'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                    : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintMasterReport}
              className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Printer size={14} /> Cetak Laporan
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download size={14} /> Excel
            </button>
          </div>
        </div>
      </div>

      {/* 3. MASTER PROCUREMENT DOSSIER TABLE (REKOD KESELURUHAN DARI AWAL HINGGA SELESAI) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm overflow-hidden text-slate-800 dark:text-slate-100">
        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight uppercase text-slate-900 dark:text-white flex items-center gap-2">
              <FileCheck size={20} className="text-amber-500" />
              <span>Rekod Induk Kitaran Hayat Perolehan Tawaran Terus</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Jejak setiap perolehan melalui 9 peringkat alur kerja dari Permohonan hingga Arkib Selesai.
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-xl self-start sm:self-auto">
            {filtered.length} Rekod Tersedia
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-black/5 dark:bg-black/40 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-[11px] font-black uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">Bil</th>
                <th className="py-3.5 px-4">No. Rujukan &amp; PO</th>
                <th className="py-3.5 px-4">Tajuk &amp; Vot</th>
                <th className="py-3.5 px-4">Pembekal Dipilih</th>
                <th className="py-3.5 px-4 text-right">Nilai (RM)</th>
                <th className="py-3.5 px-4 text-center">Peringkat Kitaran Hayat</th>
                <th className="py-3.5 px-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filtered.map((rec, idx) => {
                const isCompleted = rec.status === 'SELESAI' || rec.status === 'LULUS' || rec.status === 'DIBAYAR';
                return (
                  <tr key={rec.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4 text-center font-mono font-bold text-slate-400">
                      {idx + 1}
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-mono font-black text-slate-900 dark:text-white text-xs">
                        {rec.orderNo}
                      </div>
                      {rec.poNo ? (
                        <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          PO: {rec.poNo}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 font-medium">
                          Tarikh: {rec.requestDate}
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4 max-w-xs">
                      <div className="font-bold text-slate-900 dark:text-white uppercase line-clamp-2 text-xs">
                        {rec.title}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          rec.category === 'BEKALAN' ? 'bg-blue-500/15 text-blue-500' :
                          rec.category === 'PERKHIDMATAN' ? 'bg-emerald-500/15 text-emerald-500' :
                          'bg-amber-500/15 text-amber-500'
                        }`}>
                          {rec.category}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {rec.allocationCode}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900 dark:text-white uppercase text-xs">
                        {rec.supplierName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {rec.supplierCode || 'MOF / CIDB'}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-black text-amber-500 tabular-nums text-xs">
                      RM {Number(rec.estimatedAmount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 size={12} />
                        <span>{isCompleted ? 'Peringkat 9: SELESAI' : 'Dalam Aliran Kerja'}</span>
                      </div>
                      {rec.noBaucar && (
                        <div className="text-[10px] font-mono text-slate-500 mt-1">
                          Baucar: {rec.noBaucar}
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedRecordForDossier(rec)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <FileText size={13} />
                        <span>Dossier Penuh</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* COMPLETE DOSSIER MODAL */}
      {selectedRecordForDossier && (
        <DirectAwardCompleteDossierModal
          record={selectedRecordForDossier}
          orderNo={selectedRecordForDossier.orderNo}
          onClose={() => setSelectedRecordForDossier(null)}
        />
      )}
    </div>
  );
}
