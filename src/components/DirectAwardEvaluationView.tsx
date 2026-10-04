import React, { useState } from 'react';
import { 
  FileText, 
  Scale, 
  Save, 
  ArrowRight, 
  CheckCircle2, 
  CheckSquare, 
  Square, 
  Eye, 
  Building2, 
  Download, 
  Printer, 
  X, 
  Clock, 
  DollarSign, 
  Award,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface SupplierEvaluationData {
  id: string;
  name: string;
  shortName: string;
  price: number;
  validity: string;
  delivery: string;
  specCompliant: boolean;
  docComplete: boolean;
  regNo: string;
  notes: string;
  criteria: {
    priceReasonable: boolean;
    specCompliant: boolean;
    deliveryReasonable: boolean;
    docsComplete: boolean;
    otherTerms: boolean;
  };
  docs: {
    sebutharga: { name: string; size: string; ref: string };
    ssm: { name: string; size: string; ref: string };
    sst: { name: string; size: string; ref: string };
    spec: { name: string; size: string; ref: string };
    katalog: { name: string; size: string; ref: string };
  };
}

const DEFAULT_SUPPLIERS_EVALUATION: SupplierEvaluationData[] = [];

interface DirectAwardEvaluationViewProps {
  orderNo?: string;
  orderTitle?: string;
  closingDate?: string;
  onProceedToSelection?: (recommendedSupplier: string, price: number, justification: string) => void;
  onSaveEvaluation?: (data: any) => void;
}

export default function DirectAwardEvaluationView({
  orderNo = 'TT-2026-00125',
  orderTitle = 'Pembekalan Komputer Desktop',
  closingDate = '02/10/2026',
  onProceedToSelection,
  onSaveEvaluation
}: DirectAwardEvaluationViewProps) {
  const [suppliers, setSuppliers] = useState<SupplierEvaluationData[]>(DEFAULT_SUPPLIERS_EVALUATION);
  const [recommendedSupplier, setRecommendedSupplier] = useState<string>('SABAH MAJU SDN BHD');
  const [justification, setJustification] = useState<string>(
    'Syarikat SABAH MAJU SDN BHD diperakukan sebagai pembekal terpilih kerana menawarkan harga terendah iaitu RM15,500.00 (penjimatan RM1,500.00 daripada siling anggaran jabatan), tempoh penghantaran paling pantas (7 hari bekerja), serta memenuhi 100% spesifikasi teknikal komputer desktop dan monitor pejabat yang ditetapkan selaras tatacara 1PP PK 2 / AP 173.'
  );

  // In-System Document Viewer Modal State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeDocSupIndex, setActiveDocSupIndex] = useState(2); // Default to Sabah Maju or selected
  const [activeDocType, setActiveDocType] = useState<'sebutharga' | 'ssm' | 'sst' | 'spec' | 'katalog'>('sebutharga');

  // Toggle criteria checkbox
  const handleToggleCriteria = (supId: string, key: keyof SupplierEvaluationData['criteria']) => {
    setSuppliers(prev => prev.map(s => {
      if (s.id === supId) {
        return {
          ...s,
          criteria: {
            ...s.criteria,
            [key]: !s.criteria[key]
          }
        };
      }
      return s;
    }));
  };

  // Update supplier notes
  const handleNoteChange = (supId: string, value: string) => {
    setSuppliers(prev => prev.map(s => s.id === supId ? { ...s, notes: value } : s));
  };

  // Quick Open Document Modal
  const openDocumentViewer = (supIndex: number, docType: 'sebutharga' | 'ssm' | 'sst' | 'spec' | 'katalog') => {
    setActiveDocSupIndex(supIndex);
    setActiveDocType(docType);
    setViewerOpen(true);
  };

  // Handle Save
  const handleSave = () => {
    const payload = {
      orderNo,
      orderTitle,
      closingDate,
      suppliers,
      recommendedSupplier,
      justification,
      savedAt: new Date().toISOString()
    };
    if (onSaveEvaluation) {
      onSaveEvaluation(payload);
    }
    toast.success('Draf Penilaian Pegawai berjaya disimpan dalam sistem!');
  };

  // Handle Proceed
  const handleProceed = () => {
    const selectedObj = suppliers.find(s => s.name === recommendedSupplier) || suppliers[2];
    handleSave();
    if (onProceedToSelection) {
      onProceedToSelection(recommendedSupplier, selectedObj.price, justification);
    }
    toast.success(`Penilaian selesai! Membawa ke peringkat Pemilihan Pembekal bagi ${recommendedSupplier}.`);
  };

  const selectedSupplierObj = suppliers.find(s => s.name === recommendedSupplier) || suppliers[2];

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 animate-in fade-in duration-200">
      
      {/* 1. KAD UTAMA: PERBANDINGAN TAWARAN */}
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-white/10 rounded-3xl shadow-md overflow-hidden">
        
        {/* Banner Tajuk */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 p-6 text-white border-b border-amber-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                1PP PK 2 • MODUL TAWARAN TERUS
              </span>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-poppins mt-1 text-white">
                ⚖️ PERBANDINGAN TAWARAN
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-white/10 text-xs font-mono text-amber-300 font-bold border border-amber-500/30">
                Format AP 173
              </span>
            </div>
          </div>

          <div className="h-[1px] bg-white/15 my-4" />

          {/* Maklumat Permohonan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-sans font-bold">No. Permohonan :</span>
              <span className="font-black text-amber-400 text-sm">{orderNo}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-sans font-bold">Perkara :</span>
              <span className="font-bold text-white font-sans truncate">{orderTitle}</span>
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
              <span className="text-slate-400 font-sans font-bold">Tarikh Tutup :</span>
              <span className="font-bold text-slate-200">{closingDate}</span>
            </div>
          </div>
        </div>

        {/* 2. JADUAL PERBANDINGAN TAWARAN PEMBEKAL */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black uppercase text-[11px] tracking-wider">
                <th className="py-3.5 px-6 w-56 bg-slate-200/50 dark:bg-slate-800">
                  Kriteria / Parameter
                </th>
                {suppliers.map((sup, idx) => (
                  <th key={sup.id} className="py-3.5 px-6 text-center">
                    <span className="font-black text-slate-900 dark:text-white uppercase block text-xs sm:text-sm">
                      {sup.shortName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono font-normal">
                      {sup.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5 font-mono text-xs">
              {/* Harga Tawaran */}
              <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                <td className="py-3 px-6 font-sans font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/50">
                  Harga Tawaran
                </td>
                {suppliers.map(sup => (
                  <td key={sup.id} className="py-3 px-6 text-center">
                    <span className={`text-sm sm:text-base font-black ${
                      sup.price === 15500 
                        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded' 
                        : 'text-slate-900 dark:text-white'
                    }`}>
                      RM{sup.price.toLocaleString('ms-MY')}
                    </span>
                    {sup.price === 15500 && (
                      <span className="block text-[10px] text-emerald-600 font-bold font-sans">
                        (Terendah)
                      </span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Tempoh Sah */}
              <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                <td className="py-3 px-6 font-sans font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/50">
                  Tempoh Sah
                </td>
                {suppliers.map(sup => (
                  <td key={sup.id} className="py-3 px-6 text-center font-bold text-slate-700 dark:text-slate-300">
                    {sup.validity}
                  </td>
                ))}
              </tr>

              {/* Penghantaran */}
              <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                <td className="py-3 px-6 font-sans font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/50">
                  Penghantaran
                </td>
                {suppliers.map(sup => (
                  <td key={sup.id} className="py-3 px-6 text-center font-bold">
                    <span className={sup.delivery === '7 hari' ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-700 dark:text-slate-300'}>
                      {sup.delivery}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Spesifikasi */}
              <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                <td className="py-3 px-6 font-sans font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/50">
                  Spesifikasi
                </td>
                {suppliers.map(sup => (
                  <td key={sup.id} className="py-3 px-6 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      ✓ Patuh
                    </span>
                  </td>
                ))}
              </tr>

              {/* Dokumen Sokongan */}
              <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                <td className="py-3 px-6 font-sans font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/50">
                  Dokumen Sokongan
                </td>
                {suppliers.map(sup => (
                  <td key={sup.id} className="py-3 px-6 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      ✓ Lengkap
                    </span>
                  </td>
                ))}
              </tr>

              {/* Sebutharga Link */}
              <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                <td className="py-3 px-6 font-sans font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/50">
                  Sebutharga
                </td>
                {suppliers.map((sup, idx) => (
                  <td key={sup.id} className="py-3 px-6 text-center">
                    <button
                      type="button"
                      onClick={() => openDocumentViewer(idx, 'sebutharga')}
                      className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-bold font-sans transition-colors cursor-pointer inline-flex items-center gap-1"
                      title="Tekan untuk lihat dokumen Sebutharga"
                    >
                      <span>📄 Sebutharga</span>
                    </button>
                  </td>
                ))}
              </tr>

              {/* SSM Link */}
              <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                <td className="py-3 px-6 font-sans font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/50">
                  SSM
                </td>
                {suppliers.map((sup, idx) => (
                  <td key={sup.id} className="py-3 px-6 text-center">
                    <button
                      type="button"
                      onClick={() => openDocumentViewer(idx, 'ssm')}
                      className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold font-sans transition-colors cursor-pointer inline-flex items-center gap-1"
                      title="Tekan untuk lihat dokumen SSM"
                    >
                      <span>📄 SSM</span>
                    </button>
                  </td>
                ))}
              </tr>

              {/* SST Link */}
              <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                <td className="py-3 px-6 font-sans font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/50">
                  SST
                </td>
                {suppliers.map((sup, idx) => (
                  <td key={sup.id} className="py-3 px-6 text-center">
                    <button
                      type="button"
                      onClick={() => openDocumentViewer(idx, 'sst')}
                      className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold font-sans transition-colors cursor-pointer inline-flex items-center gap-1"
                      title="Tekan untuk lihat dokumen SST"
                    >
                      <span>📄 SST</span>
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3. BAHAGIAN PENILAIAN SETIAP PEMBEKAL (KRITERIA CHECKBOX & CATATAN) */}
        <div className="p-6 border-t-2 border-slate-200 dark:border-white/10 bg-slate-50/40 dark:bg-slate-950/40 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
              <Scale size={18} className="text-amber-500" />
              PENILAIAN SETIAP PEMBEKAL (SEMAKAN KRITERIA 1PP PK 2)
            </h3>
            <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
              Tandakan kriteria yang dipenuhi oleh pembekal
            </span>
          </div>

          {/* Matrix Kriteria Semakan */}
          <div className="overflow-x-auto border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black uppercase text-[11px]">
                  <th className="py-2.5 px-4 w-48">Kriteria Penilaian</th>
                  {suppliers.map(s => (
                    <th key={s.id} className="py-2.5 px-4 text-center">
                      {s.shortName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {/* 1. Harga */}
                <tr>
                  <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                    Harga Bawah Siling / Berpatutan
                  </td>
                  {suppliers.map(s => (
                    <td key={s.id} className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleCriteria(s.id, 'priceReasonable')}
                        className="cursor-pointer text-amber-500 hover:scale-110 transition-transform"
                      >
                        {s.criteria.priceReasonable ? (
                          <CheckSquare size={18} className="fill-amber-500 text-white" />
                        ) : (
                          <Square size={18} className="text-slate-400" />
                        )}
                      </button>
                    </td>
                  ))}
                </tr>

                {/* 2. Spesifikasi */}
                <tr>
                  <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                    Spesifikasi Teknikal Patuh 100%
                  </td>
                  {suppliers.map(s => (
                    <td key={s.id} className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleCriteria(s.id, 'specCompliant')}
                        className="cursor-pointer text-amber-500 hover:scale-110 transition-transform"
                      >
                        {s.criteria.specCompliant ? (
                          <CheckSquare size={18} className="fill-amber-500 text-white" />
                        ) : (
                          <Square size={18} className="text-slate-400" />
                        )}
                      </button>
                    </td>
                  ))}
                </tr>

                {/* 3. Tempoh penghantaran */}
                <tr>
                  <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                    Tempoh Penghantaran Munasabah
                  </td>
                  {suppliers.map(s => (
                    <td key={s.id} className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleCriteria(s.id, 'deliveryReasonable')}
                        className="cursor-pointer text-amber-500 hover:scale-110 transition-transform"
                      >
                        {s.criteria.deliveryReasonable ? (
                          <CheckSquare size={18} className="fill-amber-500 text-white" />
                        ) : (
                          <Square size={18} className="text-slate-400" />
                        )}
                      </button>
                    </td>
                  ))}
                </tr>

                {/* 4. Dokumen lengkap */}
                <tr>
                  <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                    Dokumen Lengkap &amp; Sah (SSM/SST/MOF)
                  </td>
                  {suppliers.map(s => (
                    <td key={s.id} className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleCriteria(s.id, 'docsComplete')}
                        className="cursor-pointer text-amber-500 hover:scale-110 transition-transform"
                      >
                        {s.criteria.docsComplete ? (
                          <CheckSquare size={18} className="fill-amber-500 text-white" />
                        ) : (
                          <Square size={18} className="text-slate-400" />
                        )}
                      </button>
                    </td>
                  ))}
                </tr>

                {/* 5. Syarat lain */}
                <tr>
                  <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                    Syarat Lain (Waranti / Servis)
                  </td>
                  {suppliers.map(s => (
                    <td key={s.id} className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleCriteria(s.id, 'otherTerms')}
                        className="cursor-pointer text-amber-500 hover:scale-110 transition-transform"
                      >
                        {s.criteria.otherTerms ? (
                          <CheckSquare size={18} className="fill-amber-500 text-white" />
                        ) : (
                          <Square size={18} className="text-slate-400" />
                        )}
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* 4. PENILAIAN PEGAWAI (RUANG CATATAN SETIAP PEMBEKAL) */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
              <span>📝</span> CATATAN PENILAIAN PEGAWAI MENGIKUT PEMBEKAL:
            </h4>

            <div className="space-y-3.5">
              {suppliers.map(sup => (
                <div 
                  key={sup.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 space-y-1.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs uppercase text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 size={13} className="text-amber-500" />
                      {sup.name}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
                      RM{sup.price.toLocaleString('ms-MY')} • {sup.delivery}
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0 mt-1">
                      Catatan:
                    </span>
                    <textarea
                      rows={2}
                      value={sup.notes}
                      onChange={(e) => handleNoteChange(sup.id, e.target.value)}
                      placeholder="Masukkan catatan penilaian teknikal / harga bagi pembekal ini..."
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. RUANG JUSTIFIKASI PENILAIAN PEGAWAI */}
          <div className="p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 space-y-3">
            <h4 className="text-xs font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider flex items-center gap-1.5">
              <Award size={16} /> JUSTIFIKASI PENILAIAN
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pembekal yang dicadangkan:
              </label>
              <select
                value={recommendedSupplier}
                onChange={(e) => setRecommendedSupplier(e.target.value)}
                className="w-full sm:w-80 px-3 py-2 bg-white dark:bg-slate-900 border-2 border-amber-500/40 rounded-xl text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.name} — RM{s.price.toLocaleString('ms-MY')} ({s.delivery})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Justifikasi Penilaian Pegawai:
              </label>
              <textarea
                rows={3}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Nyatakan alasan dan justifikasi pemilihan (cth: harga terendah, mematuhi spesifikasi, tempoh penghantaran terpantas)..."
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-amber-500 leading-relaxed"
              />
            </div>
          </div>

          {/* 6. BUTANG TINDAKAN BAWAH */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {/* [📄 LIHAT DOKUMEN] */}
              <button
                type="button"
                onClick={() => setViewerOpen(true)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileText size={15} />
                <span>[📄 LIHAT DOKUMEN]</span>
              </button>

              {/* [📝 PENILAIAN] */}
              <button
                type="button"
                onClick={() => {
                  toast.success('Borang semakan kriteria sedia untuk dinilai.');
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>[📝 PENILAIAN]</span>
              </button>

              {/* [💾 SIMPAN] */}
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5 hover:scale-102 active:scale-98"
              >
                <Save size={15} />
                <span>[💾 SIMPAN]</span>
              </button>
            </div>

            {/* [TERUSKAN KE PEMILIHAN PEMBEKAL] */}
            <button
              type="button"
              onClick={handleProceed}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-600/25 transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-102 active:scale-98"
            >
              <span>[TERUSKAN KE PEMILIHAN PEMBEKAL]</span>
              <ArrowRight size={16} className="stroke-[3]" />
            </button>
          </div>

        </div>

      </div>

      {/* 7. MODAL PAPARAN DOKUMEN (IN-SYSTEM DOCUMENT VIEWER TANPA KELUAR SISTEM) */}
      {viewerOpen && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity"
            onClick={() => setViewerOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative bg-white dark:bg-[#0c1322] border-2 border-amber-500/40 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh] animate-in fade-in zoom-in-95 duration-200 text-slate-800 dark:text-slate-100">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 p-5 sm:p-6 text-white border-b border-amber-500/30 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase">
                    PAPARAN DOKUMEN SAH
                  </span>
                  <span className="text-[11px] font-mono text-amber-300">
                    {orderNo}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black uppercase text-white tracking-tight flex items-center gap-2">
                  <FileCheck size={20} className="text-amber-500" />
                  PAPARAN DOKUMEN TAWARAN PEMBEKAL
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setViewerOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-Header: Pilih Pembekal & Kategori Dokumen */}
            <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Tabs Pembekal */}
              <div className="flex items-center gap-2 overflow-x-auto">
                {suppliers.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveDocSupIndex(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer whitespace-nowrap ${
                      activeDocSupIndex === idx
                        ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                        : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-amber-500'
                    }`}
                  >
                    {s.shortName}
                  </button>
                ))}
              </div>

              {/* Tabs Jenis Dokumen */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {(['sebutharga', 'ssm', 'sst', 'spec', 'katalog'] as const).map(dt => (
                  <button
                    key={dt}
                    type="button"
                    onClick={() => setActiveDocType(dt)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                      activeDocType === dt
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                        : 'bg-black/5 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {dt === 'sebutharga' ? 'Sebutharga' : dt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Document Preview Canvas */}
            <div className="p-6 overflow-y-auto space-y-4 max-h-[60vh] bg-slate-100/50 dark:bg-slate-950/70">
              {(() => {
                const currentSup = suppliers[activeDocSupIndex] || suppliers[0];
                const currentDocInfo = currentSup.docs[activeDocType];

                return (
                  <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5 text-xs sm:text-sm">
                    {/* Header Dokumen Rasmi */}
                    <div className="text-center pb-4 border-b-2 border-slate-900 dark:border-white/20 space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        KERAJAAN MALAYSIA • TATACARA PEROLEHAN 1PP PK 2 / AP 173
                      </span>
                      <h4 className="text-base sm:text-lg font-black uppercase text-slate-900 dark:text-white">
                        {activeDocType === 'sebutharga' && 'BORANG SEBUT HARGA TAWARAN RASMI'}
                        {activeDocType === 'ssm' && 'PERAKUAN PENDAFTARAN PERNIAGAAN / SYARIKAT (SSM)'}
                        {activeDocType === 'sst' && 'PENYATA PENDAFTARAN CUKAI JUALAN DAN PERKHIDMATAN (SST)'}
                        {activeDocType === 'spec' && 'JADUAL SPESIFIKASI TEKNIKAL BARANGAN DITAWARKAN'}
                        {activeDocType === 'katalog' && 'KATALOG PRODUK & BROSUR TEKNIKAL'}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono">
                        No. Rujukan Fail: <strong>{currentDocInfo.ref}</strong> • Saiz: {currentDocInfo.size}
                      </p>
                    </div>

                    {/* Metadata Pembekal */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl font-mono text-xs">
                      <div>
                        <span className="text-slate-400 block font-sans text-[10px] font-bold uppercase">Nama Syarikat Pembekal:</span>
                        <strong className="text-slate-900 dark:text-white uppercase font-sans">{currentSup.name}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-sans text-[10px] font-bold uppercase">No. Pendaftaran:</span>
                        <strong className="text-slate-900 dark:text-white">{currentSup.regNo}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-sans text-[10px] font-bold uppercase">Tajuk Perolehan:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-sans">{orderTitle}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-sans text-[10px] font-bold uppercase">Harga Tawaran:</span>
                        <strong className="text-emerald-600 dark:text-emerald-400 text-sm">RM{currentSup.price.toLocaleString('ms-MY')}</strong>
                      </div>
                    </div>

                    {/* Isi Kandungan Dokumen Mengikut Jenis */}
                    <div className="p-4 border border-slate-200 dark:border-white/10 rounded-xl space-y-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                      {activeDocType === 'sebutharga' && (
                        <div className="space-y-2">
                          <p><strong>Pengesahan Tawaran Sebutharga:</strong></p>
                          <p className="leading-relaxed">
                            Dengan ini disahkan bahawa syarikat <strong>{currentSup.name}</strong> bersetuju membekalkan Komputer Desktop dan kelengkapan berkaitan mengikut harga tawaran <strong>RM{currentSup.price.toLocaleString('ms-MY')}</strong> dalam tempoh sah laku <strong>{currentSup.validity}</strong> dan tempoh pembekalan <strong>{currentSup.delivery}</strong>.
                          </p>
                          <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-700 dark:text-emerald-400 text-xs">
                            ✓ Ditandatangani oleh Pengarah Urusan &amp; Cop Rasmi Syarikat pada 02/10/2026.
                          </div>
                        </div>
                      )}

                      {activeDocType === 'ssm' && (
                        <div className="space-y-2">
                          <p><strong>Perakuan Suruhanjaya Syarikat Malaysia:</strong></p>
                          <p className="leading-relaxed">
                            Syarikat ini berdaftar di bawah Akta Pendaftaran Perniagaan 1956 / Akta Syarikat 2016 dengan status <strong>AKTIF</strong>. Kod Bidang Perolehan merangkumi Pembekalan Peralatan ICT dan Komputer.
                          </p>
                          <div className="mt-3 p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-700 dark:text-blue-400 text-xs">
                            ✓ Status sah laku SSM telah disahkan secara dalam talian.
                          </div>
                        </div>
                      )}

                      {activeDocType === 'sst' && (
                        <div className="space-y-2">
                          <p><strong>Pendaftaran Jabatan Kastam Diraja Malaysia (JKDM):</strong></p>
                          <p className="leading-relaxed">
                            No. Pendaftaran SST: <strong>{currentDocInfo.ref}</strong>. Pembekal berdaftar di bawah Akta Cukai Jualan 2018 / Cukai Perkhidmatan 2018.
                          </p>
                          <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-700 dark:text-emerald-400 text-xs">
                            ✓ Penyata cukai terkini berstatus patuh dan aktif.
                          </div>
                        </div>
                      )}

                      {activeDocType === 'spec' && (
                        <div className="space-y-2">
                          <p><strong>Pematuhan Spesifikasi Teknikal:</strong></p>
                          <ul className="list-disc pl-5 space-y-1">
                            <li>Pemproses: Intel Core i5 Generasi Terkini (Mematuhi)</li>
                            <li>Memori: 16GB DDR4 RAM (Mematuhi)</li>
                            <li>Storan: 512GB PCIe NVMe SSD (Mematuhi)</li>
                            <li>Monitor: 24" Full HD LED Anti-Glare (Mematuhi)</li>
                            <li>Papan Kekunci &amp; Tetikus: USB Standard Berwayar (Mematuhi)</li>
                          </ul>
                        </div>
                      )}

                      {activeDocType === 'katalog' && (
                        <div className="space-y-2">
                          <p><strong>Brosur &amp; Lembaran Data Pengeluar:</strong></p>
                          <p className="leading-relaxed">
                            Lampiran brosur asli daripada pengeluar rasmi mengandungi perincian port sambungan, pensijilan keselamatan CE/FCC, dan tempoh waranti perkakasan selama 3 tahun.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Cop & Watermark Pengesahan */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-white/10 text-xs text-slate-500">
                      <span>Fail Asli: <strong>{currentDocInfo.name}</strong></span>
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 size={14} /> Dokumen Disahkan Sah &amp; Lengkap
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer Modal Viewer */}
            <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const currentSup = suppliers[activeDocSupIndex] || suppliers[0];
                  const currentDocInfo = currentSup.docs[activeDocType];
                  const element = document.createElement('a');
                  const file = new Blob([
                    `KERAJAAN MALAYSIA - DOKUMEN TAWARAN SEBUT HARGA\n` +
                    `No. Permohonan: ${orderNo}\n` +
                    `Perolehan: ${orderTitle}\n` +
                    `Pembekal: ${currentSup.name} (${currentSup.regNo})\n` +
                    `Nama Dokumen: ${currentDocInfo.name}\n` +
                    `No. Rujukan: ${currentDocInfo.ref}\n`
                  ], { type: 'text/plain' });
                  element.href = URL.createObjectURL(file);
                  element.download = currentDocInfo.name.replace('.pdf', '') + '_Sah.txt';
                  document.body.appendChild(element);
                  element.click();
                  document.body.removeChild(element);
                  toast.success(`Memuat turun ${currentDocInfo.name}...`);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download size={14} /> Muat Turun Fail
              </button>

              <button
                type="button"
                onClick={() => setViewerOpen(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Tutup Paparan
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
