import React from 'react';
import { 
  X, 
  Scale, 
  CheckCircle2, 
  TrendingDown, 
  Clock, 
  Award, 
  Printer, 
  Building2,
  AlertCircle,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SupplierOfferDetail } from './SupplierOfferDetailModal';

interface SupplierComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  offers: SupplierOfferDetail[];
  orderNo?: string;
  orderTitle?: string;
  onSelectWinner?: (supplierName: string, price: number) => void;
}

export default function SupplierComparisonModal({
  isOpen,
  onClose,
  offers,
  orderNo = 'TT/2026/00125',
  orderTitle = 'Pembekalan Komputer',
  onSelectWinner
}: SupplierComparisonModalProps) {
  if (!isOpen) return null;

  const lowestPrice = Math.min(...offers.map(o => o.price));
  const fastestDelivery = offers.reduce((prev, curr) => {
    const prevDays = parseInt(prev.deliveryDays) || 999;
    const currDays = parseInt(curr.deliveryDays) || 999;
    return currDays < prevDays ? curr : prev;
  }, offers[0]);

  const handlePrintComparison = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Main Dialog */}
      <div className="relative bg-white dark:bg-[#0c1322] border-2 border-amber-500/40 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh] animate-in fade-in zoom-in-95 duration-200 text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 p-5 sm:p-6 text-white border-b border-amber-500/30 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
              1PP PK 2 / AP 173 • KAJIAN PASARAN
            </span>
            <span className="text-[11px] font-mono text-amber-300 font-bold">
              {orderNo}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase font-poppins flex items-center gap-2">
            ⚖️ PERBANDINGAN TAWARAN SEBUT HARGA
          </h2>
          <p className="text-xs text-amber-300/80 font-medium mt-1">
            Penilaian Perbandingan 3 Pembekal • {orderTitle}
          </p>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 text-xs sm:text-sm">
          
          {/* Summary Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <TrendingDown size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Harga Terendah</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                  RM{lowestPrice.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  ({offers.find(o => o.price === lowestPrice)?.supplierName})
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Penghantaran Terpantas</span>
                <span className="font-black text-blue-600 dark:text-blue-400 text-sm">
                  {fastestDelivery.deliveryDays}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  ({fastestDelivery.supplierName})
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Award size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Cadangan Penilaian</span>
                <span className="font-black text-amber-600 dark:text-amber-400 text-sm">
                  ABC Enterprise / Sabah Maju
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Nilai Faedah Terbaik (Best Value)
                </span>
              </div>
            </div>
          </div>

          {/* Comparison Matrix Table */}
          <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black uppercase text-[11px]">
                    <th className="py-3 px-4 w-44">Kriteria Penilaian</th>
                    {offers.map(o => (
                      <th key={o.id} className="py-3 px-4 text-center">
                        <div className="font-black text-slate-900 dark:text-white uppercase">
                          {o.supplierName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono font-normal">
                          {o.regNo}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                  {/* Harga Tawaran */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-sans font-bold text-slate-800 dark:text-slate-200">
                      💰 Harga Tawaran (RM)
                    </td>
                    {offers.map(o => (
                      <td key={o.id} className="py-3 px-4 text-center">
                        <span className={`text-sm font-black ${
                          o.price === lowestPrice 
                            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded' 
                            : 'text-slate-900 dark:text-white'
                        }`}>
                          RM{o.price.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                        </span>
                        {o.price === lowestPrice && (
                          <span className="block text-[10px] text-emerald-600 font-bold font-sans">
                            (Harga Terendah)
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Tempoh Penghantaran */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-sans font-bold text-slate-800 dark:text-slate-200">
                      🚚 Tempoh Penghantaran
                    </td>
                    {offers.map(o => (
                      <td key={o.id} className="py-3 px-4 text-center font-sans font-bold text-slate-800 dark:text-slate-200">
                        {o.deliveryDays}
                      </td>
                    ))}
                  </tr>

                  {/* Tempoh Sah Tawaran */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-sans font-bold text-slate-800 dark:text-slate-200">
                      📅 Tempoh Sah Tawaran
                    </td>
                    {offers.map(o => (
                      <td key={o.id} className="py-3 px-4 text-center font-sans text-slate-700 dark:text-slate-300">
                        {o.validityDays}
                      </td>
                    ))}
                  </tr>

                  {/* Tarikh & Masa Hantar */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-sans font-bold text-slate-800 dark:text-slate-200">
                      ⏱️ Tarikh &amp; Masa Hantar
                    </td>
                    {offers.map(o => (
                      <td key={o.id} className="py-3 px-4 text-center text-[11px] text-slate-600 dark:text-slate-400">
                        {o.submissionDate} ({o.submissionTime})
                      </td>
                    ))}
                  </tr>

                  {/* Kepatuhan Spesifikasi */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-sans font-bold text-slate-800 dark:text-slate-200">
                      ✓ Kepatuhan Spesifikasi
                    </td>
                    {offers.map(o => (
                      <td key={o.id} className="py-3 px-4 text-center font-sans">
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                          <CheckCircle2 size={13} /> 100% Mematuhi
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Dokumen Sokongan */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-sans font-bold text-slate-800 dark:text-slate-200">
                      📄 Dokumen Sokongan
                    </td>
                    {offers.map(o => (
                      <td key={o.id} className="py-3 px-4 text-center font-sans text-xs text-slate-700 dark:text-slate-300">
                        {o.documents.length} Dokumen Lengkap (SSM/SST/Quotation/Katalog)
                      </td>
                    ))}
                  </tr>

                  {/* Tindakan Pemilihan */}
                  <tr className="bg-slate-50/80 dark:bg-slate-900/60">
                    <td className="py-4 px-4 font-sans font-black text-slate-900 dark:text-white">
                      🏆 Cadangan Tindakan
                    </td>
                    {offers.map(o => (
                      <td key={o.id} className="py-4 px-4 text-center font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectWinner) {
                              onSelectWinner(o.supplierName, o.price);
                              onClose();
                            }
                          }}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer hover:scale-102 active:scale-98"
                        >
                          Pilih Pembekal Ini
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Justification Box */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1.5">
            <span className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Award size={14} /> Catatan &amp; Syor Jawatankuasa Penilaian:
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              Ketiga-tiga pembekal memenuhi spesifikasi teknikal komputer dan monitor yang ditetapkan. <strong>Sabah Maju</strong> menawarkan harga terendah iaitu RM15,500.00, manakala <strong>ABC Enterprise</strong> menawarkan harga berpatutan RM15,800.00 dengan tempoh penghantaran lebih pantas (14 hari). Pegawai Pelulus boleh memilih pembekal terbaik mengikut keperluan mendesak operasi.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={handlePrintComparison}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer size={15} /> Cetak Borang Perbandingan
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
