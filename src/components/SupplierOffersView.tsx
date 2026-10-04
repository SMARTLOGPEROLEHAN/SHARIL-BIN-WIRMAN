import React, { useState } from 'react';
import { 
  Scale, 
  Eye, 
  Printer, 
  CheckCircle2, 
  Building2, 
  FileText, 
  Clock, 
  Calendar,
  DollarSign,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import SupplierOfferDetailModal, { SupplierOfferDetail } from './SupplierOfferDetailModal';
import SupplierComparisonModal from './SupplierComparisonModal';

export const DEFAULT_OFFERS: SupplierOfferDetail[] = [];

interface SupplierOffersViewProps {
  orderNo?: string;
  orderTitle?: string;
  closingDate?: string;
  onSelectWinningSupplier?: (supplierName: string, price: number) => void;
  onProceedToEvaluation?: () => void;
}

export default function SupplierOffersView({
  orderNo = 'TT/2026/00125',
  orderTitle = 'Pembekalan Komputer',
  closingDate = '05/10/2026 5:00 PM',
  onSelectWinningSupplier,
  onProceedToEvaluation
}: SupplierOffersViewProps) {
  const [selectedOfferId, setSelectedOfferId] = useState<string>('off-abc');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [offers] = useState<SupplierOfferDetail[]>(DEFAULT_OFFERS);

  if (offers.length === 0) {
    return (
      <div className="bg-risda-card border border-risda-border rounded-3xl p-10 text-center space-y-4 shadow-sm animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center justify-center mx-auto">
          <Scale size={28} />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Tiada Tawaran Pembekal Direkodkan
          </h3>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
            Belum ada bidaan sebut harga pembekal yang diterima bagi sesi ini. Sila buat pelawaan kepada sekurang-kurangnya 3 pembekal di modul Pelawaan terlebih dahulu.
          </p>
        </div>
      </div>
    );
  }

  const currentSelectedOffer = offers.find(o => o.id === selectedOfferId) || offers[0];

  const handlePrintSchedule = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>JADUAL PEMBUKAAN SEBUT HARGA - ${orderNo}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 30px; color: #111; font-size: 12px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
          .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
          .header h3 { margin: 5px 0 0; font-size: 13px; font-weight: normal; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .meta-table td { padding: 5px 8px; font-size: 12px; }
          .data-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .data-table th, .data-table td { border: 1px solid #222; padding: 8px 10px; font-size: 11px; }
          .data-table th { background: #f2f2f2; text-transform: uppercase; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .sig-box { margin-top: 50px; display: flex; justify-content: space-between; }
          .sig-col { width: 45%; border-top: 1px dashed #000; padding-top: 8px; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>JADUAL PEMBUKAAN SEBUT HARGA / TAWARAN TERUS</h2>
          <h3>TATACARA PENGURUSAN PEROLEHAN KERAJAAN (1PP PK 2 / AP 173)</h3>
        </div>

        <table class="meta-table">
          <tr>
            <td style="width: 25%;"><strong>NO. PERMOHONAN:</strong></td>
            <td style="width: 25%; font-family: monospace; font-weight: bold;">${orderNo}</td>
            <td style="width: 25%;"><strong>TARIKH TUTUP:</strong></td>
            <td style="width: 25%;">${closingDate}</td>
          </tr>
          <tr>
            <td><strong>PERKARA:</strong></td>
            <td colspan="3" style="font-weight: bold;">${orderTitle}</td>
          </tr>
        </table>

        <table class="data-table">
          <thead>
            <tr>
              <th class="text-center" style="width: 40px;">Bil</th>
              <th>Nama Pembekal</th>
              <th class="text-right">Harga Tawaran (RM)</th>
              <th class="text-center">Tempoh Penghantaran</th>
              <th class="text-center">Tarikh & Masa Hantar</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${offers.map((o, idx) => `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td><strong>${o.supplierName}</strong><br><small style="color: #555;">${o.regNo}</small></td>
                <td class="text-right" style="font-family: monospace; font-weight: bold;">RM ${o.price.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</td>
                <td class="text-center">${o.deliveryDays}</td>
                <td class="text-center">${o.submissionDate} ${o.submissionTime}</td>
                <td class="text-center">${o.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 20px; font-size: 11px;">
          <em>Nota: Semua sebut harga telah disemak dan mematuhi spesifikasi teknikal jabatan sepenuhnya.</em>
        </div>

        <div class="sig-box">
          <div class="sig-col">
            <strong>Disediakan Oleh (Urus Setia Perolehan):</strong><br><br><br>
            Nama:<br>
            Jawatan:<br>
            Tarikh:
          </div>
          <div class="sig-col">
            <strong>Disahkan Oleh (Pegawai Pelulus PTJ):</strong><br><br><br>
            Nama:<br>
            Jawatan:<br>
            Tarikh:
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 animate-in fade-in duration-200">
      
      {/* 1. MAIN CARD MATCHING EXACT ASCII SPECIFICATION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm overflow-hidden">
        
        {/* Header Block */}
        <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                  MODUL TAWARAN TERUS
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  SEMUA TAWARAN DITERIMA
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight font-poppins">
                TAWARAN PEMBEKAL
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>3 / 3 Tawaran Diterima</span>
              </span>
            </div>
          </div>

          <div className="h-[1px] bg-slate-200 dark:bg-white/10 my-4" />

          {/* Meta Info: No. Permohonan, Perkara, Tarikh Tutup */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">No. Permohonan :</span>
              <span className="font-black text-amber-500 text-sm">{orderNo}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">Perkara :</span>
              <span className="font-bold text-slate-900 dark:text-white font-sans">{orderTitle}</span>
            </div>

            <div className="flex items-center gap-2 sm:justify-end">
              <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">Tarikh Tutup :</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{closingDate}</span>
            </div>
          </div>
        </div>

        {/* 2. TABLE MATCHING EXACT ASCII SPECIFICATION */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black uppercase text-[11px] tracking-wider">
                <th className="py-3.5 px-6">Pembekal</th>
                <th className="py-3.5 px-6">Harga</th>
                <th className="py-3.5 px-6">Hantar</th>
                <th className="py-3.5 px-6 text-center">Status</th>
                <th className="py-3.5 px-6 text-right">Pilih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {offers.map((offer) => {
                const isSelected = selectedOfferId === offer.id;
                return (
                  <tr 
                    key={offer.id}
                    onClick={() => setSelectedOfferId(offer.id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected 
                        ? 'bg-amber-500/10 dark:bg-amber-950/20' 
                        : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Pembekal */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2.5">
                        <input 
                          type="radio"
                          name="selected_offer"
                          checked={isSelected}
                          onChange={() => setSelectedOfferId(offer.id)}
                          className="w-4 h-4 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                        <div>
                          <span className="font-black text-slate-900 dark:text-white uppercase block">
                            {offer.supplierName}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {offer.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Harga */}
                    <td className="py-4 px-6 font-mono font-black text-slate-900 dark:text-white text-sm sm:text-base tabular-nums">
                      RM{offer.price.toLocaleString('ms-MY')}
                    </td>

                    {/* Hantar */}
                    <td className="py-4 px-6 font-bold text-slate-700 dark:text-slate-300">
                      {offer.deliveryDays}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        {offer.status}
                      </span>
                    </td>

                    {/* Tindakan Baris */}
                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOfferId(offer.id);
                          setShowDetailModal(true);
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye size={13} />
                        <span>Buka</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 3. BOTTOM ACTION BUTTONS: [ ⚖️ BANDINGKAN TAWARAN ]   [ 👁️ LIHAT ]   [ 📄 CETAK ] */}
        <div className="p-5 sm:p-6 border-t border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Pembekal Terpilih:</span>
            <strong className="text-slate-900 dark:text-white uppercase font-sans">
              {currentSelectedOffer.supplierName} (RM{currentSelectedOffer.price.toLocaleString('ms-MY')})
            </strong>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* [ ⚖️ BANDINGKAN TAWARAN ] */}
            <button
              type="button"
              onClick={() => setShowCompareModal(true)}
              className="px-4 sm:px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-2 hover:scale-102 active:scale-98"
            >
              <Scale size={15} className="stroke-[2.5]" />
              <span>[ ⚖️ BANDINGKAN TAWARAN ]</span>
            </button>

            {/* [ 👁️ LIHAT ] */}
            <button
              type="button"
              onClick={() => setShowDetailModal(true)}
              className="px-4 sm:px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2 hover:scale-102 active:scale-98"
            >
              <Eye size={15} className="stroke-[2.5]" />
              <span>[ 👁️ LIHAT ]</span>
            </button>

            {/* [ 📄 CETAK ] */}
            <button
              type="button"
              onClick={handlePrintSchedule}
              className="px-4 sm:px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2 hover:scale-102 active:scale-98"
            >
              <Printer size={15} className="stroke-[2.5]" />
              <span>[ 📄 CETAK ]</span>
            </button>

            {/* [ ⚖️ TERUSKAN KE PENILAIAN ] */}
            {onProceedToEvaluation && (
              <button
                type="button"
                onClick={onProceedToEvaluation}
                className="px-4 sm:px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 hover:scale-102 active:scale-98"
              >
                <Scale size={15} className="stroke-[2.5]" />
                <span>[ ⚖️ TERUSKAN KE PENILAIAN ➡️ ]</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Modal 1: 👁️ BILA TEKAN "LIHAT" (Halaman Lengkap Maklumat Tawaran, Spesifikasi & Dokumen Sokongan) */}
      <SupplierOfferDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        offer={currentSelectedOffer}
        orderNo={orderNo}
        orderTitle={orderTitle}
        onSelectAsWinner={(winnerName, price) => {
          if (onSelectWinningSupplier) {
            onSelectWinningSupplier(winnerName, price);
          }
          toast.success(`${winnerName} dipilih sebagai pembekal untuk perolehan ini!`);
        }}
      />

      {/* Modal 2: ⚖️ BANDINGKAN TAWARAN (Perbandingan 3 Pembekal Side-by-Side) */}
      <SupplierComparisonModal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        offers={offers}
        orderNo={orderNo}
        orderTitle={orderTitle}
        onSelectWinner={(winnerName, price) => {
          if (onSelectWinningSupplier) {
            onSelectWinningSupplier(winnerName, price);
          }
          toast.success(`${winnerName} dipilih sebagai pembekal untuk perolehan ini!`);
        }}
      />

    </div>
  );
}
