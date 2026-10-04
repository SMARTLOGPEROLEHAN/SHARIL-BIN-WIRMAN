import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Eye, 
  FileText, 
  Building2, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Printer, 
  ShieldCheck, 
  Paperclip,
  Check,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface SupplierOfferDetail {
  id: string;
  supplierName: string;
  regNo: string;
  address: string;
  phone: string;
  email: string;
  price: number;
  deliveryDays: string;
  validityDays: string;
  submissionDate: string;
  submissionTime: string;
  status: string;
  specifications: Array<{
    bil: number;
    item: string;
    specs: string;
  }>;
  documents: Array<{
    name: string;
    size: string;
    type: string;
  }>;
}

interface SupplierOfferDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: SupplierOfferDetail | null;
  orderNo?: string;
  orderTitle?: string;
  onSelectAsWinner?: (supplierName: string, price: number) => void;
}

export default function SupplierOfferDetailModal({
  isOpen,
  onClose,
  offer,
  orderNo = 'TT/2026/00125',
  orderTitle = 'Pembekalan Komputer',
  onSelectAsWinner
}: SupplierOfferDetailModalProps) {
  const [previewDoc, setPreviewDoc] = useState<{ name: string; size: string; type: string } | null>(null);

  if (!isOpen || !offer) return null;

  const handleDownloadDoc = (docName: string) => {
    const element = document.createElement('a');
    const file = new Blob([
      `KERAJAAN MALAYSIA - DOKUMEN TAWARAN SEBUT HARGA\n` +
      `No. Permohonan: ${orderNo}\n` +
      `Perolehan: ${orderTitle}\n` +
      `Pembekal: ${offer.supplierName} (${offer.regNo})\n` +
      `Nama Dokumen: ${docName}\n` +
      `Tarikh Cetakan: ${new Date().toLocaleDateString('ms-MY')}\n\n` +
      `Disahkan dokumen sah dan mematuhi piawaian perolehan 1PP PK 2 / AP 173.`
    ], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = docName.replace('.pdf', '') + '_Disahkan.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    toast.success(`Memuat turun ${docName}...`);
  };

  const handlePrint = () => {
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
      <div className="relative bg-white dark:bg-[#0c1322] border-2 border-emerald-500/40 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh] animate-in fade-in zoom-in-95 duration-200 text-slate-800 dark:text-slate-100">
        
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-5 sm:p-6 text-white border-b border-emerald-500/30 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
              1PP PK 2 • TAWARAN PEMBEKAL
            </span>
            <span className="text-[11px] font-mono text-emerald-300 font-bold">
              {orderNo}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase font-poppins flex items-center gap-2">
            📋 MAKLUMAT TAWARAN LENGKAP
          </h2>
          <p className="text-xs text-emerald-300/80 font-medium mt-1">
            {offer.supplierName} • {orderTitle}
          </p>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 text-xs sm:text-sm">
          
          {/* Card: MAKLUMAT TAWARAN */}
          <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-100 dark:bg-slate-900/90 px-4 py-2.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
                <Building2 size={15} className="text-amber-500" />
                MAKLUMAT TAWARAN
              </span>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                {offer.status}
              </span>
            </div>

            <div className="p-4 space-y-3 bg-white dark:bg-slate-950/60 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">Nama Pembekal :</span>
                <span className="sm:col-span-2 font-black text-slate-900 dark:text-white uppercase text-sm font-sans">
                  {offer.supplierName}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">No. Pendaftaran :</span>
                <span className="sm:col-span-2 font-bold text-slate-800 dark:text-slate-200">
                  {offer.regNo}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">Alamat :</span>
                <span className="sm:col-span-2 text-slate-800 dark:text-slate-200 font-sans">
                  {offer.address}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">No. Telefon :</span>
                <span className="sm:col-span-2 text-slate-800 dark:text-slate-200">
                  {offer.phone}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">Email :</span>
                <span className="sm:col-span-2 text-blue-600 dark:text-blue-400 underline">
                  {offer.email}
                </span>
              </div>

              {/* HARGA TAWARAN BOX */}
              <div className="my-3 p-4 bg-emerald-500/10 dark:bg-emerald-950/30 border-2 border-emerald-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-sans block">
                    HARGA TAWARAN
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                    RM{offer.price.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 font-sans">
                  <span>✓ Termasuk cukai dan penghantaran ke lokasi PTJ</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">Tempoh Sah Tawaran :</span>
                  <strong className="text-slate-900 dark:text-white">{offer.validityDays}</strong>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">Tempoh Penghantaran :</span>
                  <strong className="text-slate-900 dark:text-white">{offer.deliveryDays}</strong>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">Tarikh Hantar :</span>
                  <strong className="text-slate-900 dark:text-white">{offer.submissionDate}</strong>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">Masa Hantar :</span>
                  <strong className="text-slate-900 dark:text-white">{offer.submissionTime}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* 📦 SPESIFIKASI */}
          <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-100 dark:bg-slate-900/90 px-4 py-2.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
                <span>📦</span> SPESIFIKASI DITAWARKAN
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={13} /> Disahkan Patuh
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black uppercase text-[11px]">
                    <th className="py-2.5 px-4 w-12 text-center">Bil</th>
                    <th className="py-2.5 px-4 w-48">Perkara</th>
                    <th className="py-2.5 px-4">Spesifikasi Pembekal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {offer.specifications.map((spec) => (
                    <tr key={spec.bil} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                      <td className="py-2.5 px-4 text-center font-bold text-slate-400 font-mono">
                        {spec.bil}
                      </td>
                      <td className="py-2.5 px-4 font-black text-slate-900 dark:text-white">
                        {spec.item}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                        {spec.specs}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 📎 DOKUMEN SOKONGAN */}
          <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-100 dark:bg-slate-900/90 px-4 py-2.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
                <span>📎</span> DOKUMEN SOKONGAN PEMBEKAL
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                4 Fail Disahkan
              </span>
            </div>

            <div className="p-4 space-y-2.5 bg-white dark:bg-slate-950/60">
              {offer.documents.map((doc, idx) => (
                <div 
                  key={idx}
                  className="p-3 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-500/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <FileText size={18} />
                    </div>
                    <div>
                      <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white block">
                        📄 {doc.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {doc.size} • {doc.type} • Disahkan oleh SSM/Kementerian Kewangan
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Eye size={13} />
                      <span>[ LIHAT ]</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadDoc(doc.name)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Download size={13} />
                      <span>[ MUAT TURUN ]</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer size={15} /> Cetak Borang Tawaran
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>

              {onSelectAsWinner && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectAsWinner(offer.supplierName, offer.price);
                    onClose();
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 hover:scale-102 active:scale-98"
                >
                  <Check size={14} className="stroke-[3]" />
                  <span>Pilih Pembekal Ini</span>
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Internal Modal: Document Preview */}
      {previewDoc && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 max-w-lg w-full rounded-3xl p-6 space-y-4 shadow-2xl relative text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="text-emerald-500" size={20} />
                <h3 className="font-black text-sm uppercase text-slate-900 dark:text-white">
                  Pratonton Dokumen: {previewDoc.name}
                </h3>
              </div>
              <button 
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-white/10 font-mono text-xs space-y-2">
              <div className="text-center pb-2 border-b border-dashed border-slate-300 dark:border-white/10">
                <strong className="block text-slate-900 dark:text-white uppercase font-sans">
                  {offer.supplierName}
                </strong>
                <span className="text-[10px] text-slate-500">
                  No. Pendaftaran: {offer.regNo}
                </span>
              </div>
              <p className="text-slate-700 dark:text-slate-300">
                <strong>Dokumen:</strong> {previewDoc.name}
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                <strong>Perolehan:</strong> {orderTitle} ({orderNo})
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                <strong>Tarikh Pengesahan:</strong> {offer.submissionDate} {offer.submissionTime}
              </p>
              <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-[11px] font-sans">
                ✓ Sijil sah dan berdaftar di bawah sistem ePerolehan / MOF / CIDB serta sah tempoh laku.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => handleDownloadDoc(previewDoc.name)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                <Download size={13} />
                Muat Turun Dokumen
              </button>
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
