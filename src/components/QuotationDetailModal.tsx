import React from 'react';
import { 
  X, 
  CheckCircle2, 
  Printer, 
  Building2, 
  FileText, 
  Calendar, 
  Clock, 
  DollarSign, 
  Award, 
  ShieldCheck, 
  Paperclip,
  Check,
  TrendingDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PelawaanSupplierItem } from './SupplierInvitationModal';

interface QuotationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: PelawaanSupplierItem | null;
  orderNo?: string;
  orderTitle?: string;
  estimatedAmount?: number;
  onSelectWinningSupplier?: (supplierName: string, amount: number) => void;
}

export default function QuotationDetailModal({
  isOpen,
  onClose,
  supplier,
  orderNo = 'TP-2026-00125',
  orderTitle = 'Bekalan Alat Tulis & Percetakan Pejabat',
  estimatedAmount = 8500,
  onSelectWinningSupplier
}: QuotationDetailModalProps) {
  if (!isOpen || !supplier) return null;

  const bidAmount = supplier.amount || 8250;
  const savings = estimatedAmount - bidAmount;
  const savingsPercent = ((savings / estimatedAmount) * 100).toFixed(1);

  const handlePrint = () => {
    window.print();
  };

  const handleSelectWinner = () => {
    if (onSelectWinningSupplier) {
      onSelectWinningSupplier(supplier.supplierName, bidAmount);
    }
    toast.success(`Pembekal ${supplier.supplierName} telah disyorkan sebagai Pembekal Terpilih!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white dark:bg-[#0c1322] border-2 border-emerald-500/40 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 text-slate-800 dark:text-slate-100">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-5 sm:p-6 text-white border-b border-emerald-500/30 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
              DOKUMEN SEBUT HARGA PEMBEKAL
            </span>
            <span className="text-[10px] text-slate-300 font-mono">
              Ref: {supplier.quotationRef || 'QTN/2026/088'}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase font-poppins flex items-center gap-2">
            📋 PERINCIAN TAWARAN PEMBEKAL
          </h2>
          <p className="text-xs text-emerald-300/80 font-medium mt-1">
            {supplier.supplierName} • Diterima pada {supplier.bidDate || '04/10/2026'}
          </p>
        </div>

        {/* BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
          
          {/* Comparison & Savings Banner */}
          <div className="bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block tracking-wider">
                HARGA TAWARAN RASMI
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                RM {bidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Nilai Anggaran Jabatan: RM {estimatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {savings > 0 && (
              <div className="sm:text-right bg-white dark:bg-slate-900/80 p-3 rounded-xl border border-emerald-500/20">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Penjimatan Jabatan</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono flex items-center sm:justify-end gap-1">
                  <TrendingDown size={14} /> RM {savings.toLocaleString()} ({savingsPercent}%)
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  ✓ Bawah Had Ambang
                </span>
              </div>
            )}
          </div>

          {/* Supplier Info Grid */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-200 dark:border-white/5 pb-2">
              <Building2 size={14} className="text-amber-500" />
              Maklumat Pembekal
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700 dark:text-slate-300">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Nama Syarikat:</span>
                <span className="font-black text-slate-900 dark:text-white uppercase">{supplier.supplierName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Emel Rasmi:</span>
                <span className="font-mono">{supplier.email}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">No. Telefon:</span>
                <span className="font-mono">{supplier.phone || '019-XXXXXXX'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Tempoh Penghantaran:</span>
                <span className="font-bold text-slate-900 dark:text-white">{supplier.deliveryPeriod || '5-7 Hari Bekerja'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Kesahan Tawaran:</span>
                <span className="font-bold">{supplier.validityDays || 30} Hari</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Kepatuhan Spesifikasi:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={13} /> 100% Mematuhi Spesifikasi Jabatan
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown Table (BQ Items) */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <FileText size={14} className="text-amber-500" />
              Jadual Harga Tawaran (BQ)
            </h4>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900/80 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold">
                    <th className="p-2.5 w-10 text-center">Bil</th>
                    <th className="p-2.5">Butiran Item</th>
                    <th className="p-2.5 text-center w-20">Kuantiti</th>
                    <th className="p-2.5 text-center w-16">Unit</th>
                    <th className="p-2.5 text-right w-24">Harga (RM)</th>
                    <th className="p-2.5 text-right w-24">Jumlah (RM)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {(supplier.items || [
                    { item: 'Kertas A4 80gsm (100 rim)', qty: 100, unit: 'Rim', price: 14.50, total: 1450 },
                    { item: 'Pen Ballpoint & Alat Tulis', qty: 50, unit: 'Kotak', price: 28.00, total: 1400 },
                    { item: 'Toner Pencetak Laser Original', qty: 6, unit: 'Unit', price: 900.00, total: 5400 }
                  ]).map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                      <td className="p-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="p-2 font-bold text-slate-800 dark:text-slate-200">{it.item}</td>
                      <td className="p-2 text-center font-mono">{it.qty}</td>
                      <td className="p-2 text-center text-slate-500">{it.unit}</td>
                      <td className="p-2 text-right font-mono">{Number(it.price).toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {Number(it.total).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-900 font-black border-t border-slate-200 dark:border-white/10">
                    <td colSpan={5} className="p-2.5 text-right uppercase">
                      Jumlah Tawaran Keseluruhan:
                    </td>
                    <td className="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                      RM {bidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Attached Documents */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Paperclip size={14} className="text-amber-500" />
              Dokumen Tawaran Disertakan
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between">
                <span className="font-mono text-slate-700 dark:text-slate-300 truncate">
                  📄 Borang_Sebut_Harga_Rasmi.pdf
                </span>
                <span className="text-[10px] text-emerald-600 font-bold">1.8 MB</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between">
                <span className="font-mono text-slate-700 dark:text-slate-300 truncate">
                  📄 Brosur_Katalog_Spesifikasi.pdf
                </span>
                <span className="text-[10px] text-emerald-600 font-bold">2.4 MB</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {supplier.notes && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-600 dark:text-amber-400">
              <strong>Catatan Penilaian:</strong> {supplier.notes}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer size={14} /> Cetak Sebut Harga
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={handleSelectWinner}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} /> Pilih Sebagai Pemenang
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
