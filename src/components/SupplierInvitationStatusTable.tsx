import React, { useState } from 'react';
import { 
  Eye, 
  Send, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  RotateCcw,
  Building2,
  FileCheck,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PelawaanSupplierItem, PelawaanStatus } from './SupplierInvitationModal';

interface SupplierInvitationStatusTableProps {
  orderNo?: string;
  title?: string;
  estimatedAmount?: number;
  suppliers: PelawaanSupplierItem[];
  onViewQuotation: (supplier: PelawaanSupplierItem) => void;
  onUpdateStatus?: (supplierId: string, newStatus: PelawaanStatus) => void;
  onResendInvitation?: (supplier: PelawaanSupplierItem) => void;
  onProceedToOffers?: () => void;
}

export default function SupplierInvitationStatusTable({
  orderNo = 'TP-2026-00125',
  title = 'Bekalan Alat Tulis',
  estimatedAmount = 8500,
  suppliers,
  onViewQuotation,
  onUpdateStatus,
  onResendInvitation,
  onProceedToOffers
}: SupplierInvitationStatusTableProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const getStatusBadge = (status: PelawaanStatus) => {
    switch (status) {
      case 'Tawaran Diterima':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            🟢 Diterima
          </span>
        );
      case 'Belum Jawab':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            🟡 Belum Jawab
          </span>
        );
      case 'Pelawaan Dihantar':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            🔵 Pelawaan Dihantar
          </span>
        );
      case 'Tidak Menyertai':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            🔴 Tidak Menyertai
          </span>
        );
      case 'Tawaran Tamat Tempoh':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30">
            <span className="w-2 h-2 rounded-full bg-slate-700 dark:bg-slate-400" />
            ⚫ Tawaran Tamat Tempoh
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30">
            {status}
          </span>
        );
    }
  };

  const handleResend = (sup: PelawaanSupplierItem) => {
    if (onResendInvitation) {
      onResendInvitation(sup);
    } else {
      toast.success(`Peringatan pelawaan dihantar semula ke emel ${sup.email}!`);
    }
  };

  const handleStatusChange = (supplierId: string, newStatus: PelawaanStatus) => {
    setActiveDropdown(null);
    if (onUpdateStatus) {
      onUpdateStatus(supplierId, newStatus);
    }
    toast.success(`Status pembekal dikemaskini kepada "${newStatus}"`);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm overflow-hidden text-slate-800 dark:text-slate-100">
      
      {/* HEADER CARD BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 p-4 sm:p-5 text-white border-b border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black uppercase">
              1PP PK 2
            </span>
            <span className="text-[11px] font-mono text-amber-300">
              {orderNo}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-black uppercase tracking-tight mt-0.5 text-white flex items-center gap-2">
            📊 STATUS PELAWAAN PEMBEKAL
          </h3>
          <p className="text-xs text-slate-400">
            {title} • Nilai Anggaran: <strong className="text-amber-400">RM {estimatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-xl bg-white/10 text-xs font-bold text-slate-300">
            {suppliers.filter(s => s.status === 'Tawaran Diterima').length} / {suppliers.length} Tawaran Diterima
          </span>
        </div>
      </div>

      {/* TABLE MATCHING USER SPECIFICATION */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-[11px] font-black uppercase tracking-wider">
              <th className="py-3 px-4 w-12 text-center">Bil</th>
              <th className="py-3 px-4">Pembekal</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/5">
            {suppliers.map((sup, idx) => (
              <tr key={sup.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                {/* Bil */}
                <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                  {idx + 1}
                </td>

                {/* Pembekal */}
                <td className="py-3.5 px-4">
                  <div className="font-black text-slate-900 dark:text-white uppercase flex items-center gap-2">
                    <Building2 size={15} className="text-amber-500 shrink-0" />
                    <span>{sup.supplierName}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    {sup.email} {sup.phone && `• ${sup.phone}`}
                  </div>
                  {sup.amount && (
                    <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                      Tawaran: RM {sup.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </td>

                {/* Status (with Dropdown Simulation Option) */}
                <td className="py-3.5 px-4 text-center">
                  <div className="inline-block relative">
                    <button
                      type="button"
                      onClick={() => setActiveDropdown(activeDropdown === sup.id ? null : sup.id)}
                      className="cursor-pointer hover:opacity-90 flex items-center gap-1 group"
                      title="Klik untuk simulasi status respons pembekal"
                    >
                      {getStatusBadge(sup.status)}
                      <ChevronDown size={13} className="text-slate-400 group-hover:text-amber-500" />
                    </button>

                    {/* Quick Status Switcher Dropdown */}
                    {activeDropdown === sup.id && (
                      <div className="absolute z-20 left-1/2 -translate-x-1/2 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl py-1 text-left text-xs">
                        <div className="px-3 py-1 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-white/5">
                          Tukar Status Pembekal:
                        </div>
                        {(['Tawaran Diterima', 'Belum Jawab', 'Pelawaan Dihantar', 'Tidak Menyertai', 'Tawaran Tamat Tempoh'] as PelawaanStatus[]).map(st => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleStatusChange(sup.id, st)}
                            className={`w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-white/5 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                              sup.status === st ? 'text-amber-500 font-black' : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span>{st === 'Tawaran Diterima' ? '🟢' : st === 'Belum Jawab' ? '🟡' : st === 'Pelawaan Dihantar' ? '🔵' : st === 'Tidak Menyertai' ? '🔴' : '⚫'}</span>
                            <span>{st}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>

                {/* Tindakan: [Lihat Tawaran] atau [Hantar Semula] */}
                <td className="py-3.5 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {sup.status === 'Tawaran Diterima' ? (
                      <button
                        type="button"
                        onClick={() => onViewQuotation(sup)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5 hover:scale-102 active:scale-98"
                      >
                        <Eye size={13} className="stroke-[2.5]" />
                        <span>[Lihat Tawaran]</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleResend(sup)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5 hover:scale-102 active:scale-98"
                      >
                        <Send size={13} className="stroke-[2.5]" />
                        <span>[Hantar Semula]</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* FOOTER BAR: INTERLINK KE TAWARAN PEMBEKAL */}
        <div className="p-4 bg-black/5 dark:bg-white/5 border-t border-risda-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span>Kajian pasaran 3 pembekal lengkap. Anda boleh menyemak butiran bidaan harga di modul Tawaran Pembekal.</span>
          </div>
          {onProceedToOffers && (
            <button
              type="button"
              onClick={onProceedToOffers}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <span>Seterusnya: Semak Bidaan Tawaran Pembekal</span>
              <Send size={14} className="stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
