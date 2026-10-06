import React, { useState } from 'react';
import { 
  Trophy, 
  Search, 
  Filter, 
  Calendar, 
  Plus, 
  Building2, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  ChevronRight, 
  Eye, 
  Printer, 
  User, 
  ShieldCheck, 
  Check, 
  RotateCcw, 
  X,
  FileCheck,
  Award,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export type SelectionStatus = 'Menunggu Semakan' | 'Menunggu Kelulusan' | 'Diluluskan' | 'Ditolak';

export interface SelectionItem {
  id: string;
  orderNo: string;
  recommendedSupplier: string;
  recommendedSupplierFull: string;
  amount: number;
  evaluator: string;
  evaluatorDesignation: string;
  status: SelectionStatus;
  date: string;
  category: string;
  unit: string;
  deliveryDays: string;
  validityDays: string;
  justification: string;
  // Summary evaluation comparison
  comparison: {
    criteria: string;
    sabahMaju: string;
    abc: string;
    xyz: string;
  }[];
  // 3-Stage Workflow Signatures
  workflow: {
    preparedBy: {
      name: string;
      designation: string;
      date: string;
      signed: boolean;
    };
    reviewedBy: {
      name: string;
      designation: string;
      date: string;
      signed: boolean;
    };
    approvedBy: {
      name: string;
      designation: string;
      date: string;
      signed: boolean;
    };
  };
}

export const INITIAL_SELECTIONS: SelectionItem[] = [];

interface DirectAwardSelectionManagementProps {
  onGenerateLO?: (item: SelectionItem) => void;
  onNavigateToSection?: (section: string, tab?: string) => void;
}

export default function DirectAwardSelectionManagement({
  onGenerateLO,
  onNavigateToSection
}: DirectAwardSelectionManagementProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<SelectionItem[]>(INITIAL_SELECTIONS);
  const [selectedItem, setSelectedItem] = useState<SelectionItem | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');
  const [dateFilter, setDateFilter] = useState<string>('SEMUA');

  // New Selection Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newOrderNo, setNewOrderNo] = useState('TT-2026-004');
  const [newSupplier, setNewSupplier] = useState('SABAH MAJU SDN. BHD.');
  const [newAmount, setNewAmount] = useState('15500');
  const [newJustification, setNewJustification] = useState('');

  // Full Evaluation Breakdown Modal
  const [showFullEvalModal, setShowFullEvalModal] = useState(false);

  // Filtered Items
  const filteredItems = items.filter(item => {
    const matchSearch = item.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.recommendedSupplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.evaluator.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'SEMUA' || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Workflow Handlers
  const handleReviewWorkflow = (item: SelectionItem) => {
    const reviewerName = user?.displayName || user?.email?.split('@')[0] || 'Ketua Penolong Pengarah';
    const today = new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const updatedWorkflow = {
      ...item.workflow,
      reviewedBy: {
        name: reviewerName,
        designation: 'Ketua Penolong Pengarah (Perolehan)',
        date: today,
        signed: true
      }
    };

    const updated: SelectionItem = {
      ...item,
      status: 'Menunggu Kelulusan',
      workflow: updatedWorkflow
    };

    setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    setSelectedItem(updated);
    toast.success(`Semakan disahkan oleh ${reviewerName}! Status: Menunggu Kelulusan.`);
  };

  const handleApproveWorkflow = (item: SelectionItem) => {
    const approverName = user?.displayName || user?.email?.split('@')[0] || 'Pegawai Pengawal PTJ';
    const today = new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const updatedWorkflow = {
      ...item.workflow,
      approvedBy: {
        name: approverName,
        designation: 'Pegawai Pengawal / Ketua Jabatan PTJ',
        date: today,
        signed: true
      }
    };

    const updated: SelectionItem = {
      ...item,
      status: 'Diluluskan',
      workflow: updatedWorkflow
    };

    setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    setSelectedItem(updated);
    toast.success(`Permohonan ${item.orderNo} telah DILULUSKAN! Pembekal: ${item.recommendedSupplier}.`);
  };

  const handleCreateSelection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderNo || !newSupplier || !newAmount) {
      toast.error('Sila lengkapkan maklumat pemilihan');
      return;
    }

    const newItem: SelectionItem = {
      id: `sel-${Date.now()}`,
      orderNo: newOrderNo,
      recommendedSupplier: newSupplier.split(' ')[0],
      recommendedSupplierFull: newSupplier,
      amount: parseFloat(newAmount) || 0,
      evaluator: user?.displayName || user?.email?.split('@')[0] || 'Pegawai Penilai',
      evaluatorDesignation: 'Penolong Pegawai Tadbir (Perolehan)',
      status: 'Menunggu Semakan',
      date: new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' }),
      category: 'Tawaran Terus',
      unit: 'Unit Bekalan & Operasi',
      deliveryDays: '7 hari',
      validityDays: '30 hari',
      justification: newJustification || 'Pembekal dicadangkan berdasarkan kriteria harga terendah dan mematuhi spesifikasi teknikal.',
      comparison: [
        { criteria: 'Harga', sabahMaju: `RM${newAmount}`, abc: 'RM16,500', xyz: 'RM16,900' },
        { criteria: 'Penghantaran', sabahMaju: '7 hari', abc: '14 hari', xyz: '10 hari' },
        { criteria: 'Spesifikasi', sabahMaju: 'Lengkap', abc: 'Lengkap', xyz: 'Lengkap' },
        { criteria: 'Dokumen', sabahMaju: 'Lengkap', abc: 'Lengkap', xyz: 'Lengkap' },
        { criteria: 'Status', sabahMaju: 'Dicadang', abc: 'Tidak dipilih', xyz: 'Tidak dipilih' }
      ],
      workflow: {
        preparedBy: {
          name: user?.displayName || 'Pegawai Penyedia',
          designation: 'Pegawai Penilai Perolehan',
          date: new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          signed: true
        },
        reviewedBy: { name: '', designation: 'Ketua Penolong Pengarah', date: '', signed: false },
        approvedBy: { name: '', designation: 'Pegawai Pengawal PTJ', date: '', signed: false }
      }
    };

    setItems(prev => [newItem, ...prev]);
    setShowNewModal(false);
    toast.success(`Cadangan Pemilihan Pembekal bagi ${newOrderNo} berjaya didaftarkan!`);
  };

  const getStatusBadge = (st: SelectionStatus) => {
    switch (st) {
      case 'Menunggu Semakan':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            🟡 Menunggu Semakan
          </span>
        );
      case 'Menunggu Kelulusan':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            🟠 Menunggu Kelulusan
          </span>
        );
      case 'Diluluskan':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            🟢 Diluluskan
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            🔴 Ditolak
          </span>
        );
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-10 text-center space-y-4 shadow-sm animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center justify-center mx-auto">
          <Trophy size={28} />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Tiada Perakuan Pemilihan Pembekal
          </h3>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
            Belum ada perakuan pemilihan pembekal yang sedia untuk kelulusan PTJ. Sila lakukan proses penilaian tawaran harga terlebih dahulu.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 animate-in fade-in duration-200">
      
      {/* 1. 📋 SENARAI PEMILIHAN */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm overflow-hidden">
        
        {/* Header Block & Filters */}
        <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight font-poppins flex items-center gap-2">
                <Trophy size={24} className="text-amber-500" />
                📋 SENARAI PEMILIHAN PEMBEKAL
              </h2>
            </div>

            {/* + PEMILIHAN BAHARU */}
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/25 transition-all cursor-pointer flex items-center gap-2 hover:scale-105 active:scale-95 shrink-0"
            >
              <Plus size={16} className="stroke-[3]" />
              <span>PEMILIHAN BAHARU</span>
            </button>
          </div>

          {/* Top Bar: 🔎 Cari | Status ▼ | Tarikh ▼ */}
          <div className="pt-2 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="🔎 Cari No. Permohonan / Pembekal / Penilai..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {/* Status Dropdown */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/10 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-bold text-slate-500">Status :</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="SEMUA">Semua Status ▼</option>
                  <option value="Menunggu Semakan">🟡 Menunggu Semakan</option>
                  <option value="Menunggu Kelulusan">🟠 Menunggu Kelulusan</option>
                  <option value="Diluluskan">🟢 Diluluskan</option>
                </select>
              </div>

              {/* Tarikh Dropdown */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/10 px-3 py-1.5 rounded-xl">
                <Calendar size={13} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500">Tarikh :</span>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="SEMUA">Semua Tarikh ▼</option>
                  <option value="2026-10">Oktober 2026</option>
                  <option value="2026-09">September 2026</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Table: No. Permohonan | Pembekal Dicadang | Nilai | Penilai | Status | Tindakan */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black uppercase text-[11px] tracking-wider">
                <th className="py-3.5 px-6">No. Permohonan</th>
                <th className="py-3.5 px-6">Pembekal Dicadang</th>
                <th className="py-3.5 px-6 text-right">Nilai</th>
                <th className="py-3.5 px-6 text-center">Penilai</th>
                <th className="py-3.5 px-6 text-center">Status</th>
                <th className="py-3.5 px-6 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                    Tiada rekod pemilihan pembekal dijumpai.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr 
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  >
                    {/* No. Permohonan */}
                    <td className="py-4 px-6 font-mono font-black text-amber-500 text-xs sm:text-sm">
                      {item.orderNo}
                    </td>

                    {/* Pembekal Dicadang */}
                    <td className="py-4 px-6">
                      <div className="font-black text-slate-900 dark:text-white uppercase flex items-center gap-2">
                        <Building2 size={15} className="text-amber-500 shrink-0" />
                        <span>{item.recommendedSupplier}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                        {item.recommendedSupplierFull}
                      </span>
                    </td>

                    {/* Nilai */}
                    <td className="py-4 px-6 text-right font-mono font-black text-slate-900 dark:text-white text-sm tabular-nums">
                      RM{item.amount.toLocaleString('ms-MY')}
                    </td>

                    {/* Penilai */}
                    <td className="py-4 px-6 text-center">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {item.evaluator}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {item.date}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6 text-center">
                      {getStatusBadge(item.status)}
                    </td>

                    {/* Tindakan */}
                    <td className="py-4 px-6 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item);
                        }}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 mx-auto"
                      >
                        <Eye size={13} />
                        <span>Buka</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* 2. 📄 PAPARAN CADANGAN PEMBEKAL (Apabila buka satu permohonan) */}
      {selectedItem && (
        <div className="bg-white dark:bg-slate-900 border-2 border-amber-500/40 rounded-3xl shadow-xl overflow-hidden animate-in fade-in duration-200">
          
          {/* Header Cadangan Pembekal */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 p-6 text-white border-b border-amber-500/30 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase">
                  DOKUMEN KELULUSAN PEMILIHAN
                </span>
                <span className="text-xs font-mono text-amber-300 font-bold">
                  {selectedItem.orderNo}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white font-poppins">
                CADANGAN PEMBEKAL
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Meta Permohonan Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-white/10 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">No. Permohonan :</span>
                <strong className="text-amber-500 font-mono text-sm">{selectedItem.orderNo}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Tarikh :</span>
                <strong className="text-slate-900 dark:text-white">{selectedItem.date}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Jenis :</span>
                <strong className="text-slate-900 dark:text-white">{selectedItem.category}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Bahagian / Unit :</span>
                <strong className="text-slate-900 dark:text-white">{selectedItem.unit}</strong>
              </div>
            </div>

            {/* 🏢 Pembekal Dicadangkan Box */}
            <div className="p-6 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                  <Building2 size={16} /> 🏢 PEMBEKAL DICADANGKAN
                </span>
                {getStatusBadge(selectedItem.status)}
              </div>

              <div className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white uppercase font-poppins">
                {selectedItem.recommendedSupplierFull}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-emerald-500/20 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">
                    Nilai Tawaran :
                  </span>
                  <strong className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    RM{selectedItem.amount.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">
                    Tempoh Penghantaran :
                  </span>
                  <strong className="text-base font-black text-slate-900 dark:text-white">
                    {selectedItem.deliveryDays}
                  </strong>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">
                    Tempoh Sah Tawaran :
                  </span>
                  <strong className="text-base font-black text-slate-900 dark:text-white">
                    {selectedItem.validityDays}
                  </strong>
                </div>
              </div>
            </div>

            {/* 3. 📊 RINGKASAN PENILAIAN */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
                  <span>📊</span> RINGKASAN PENILAIAN PEMBEKAL
                </h4>
                <button
                  type="button"
                  onClick={() => setShowFullEvalModal(true)}
                  className="text-xs text-amber-500 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>[ Lihat Penilaian Penuh ]</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black uppercase text-[11px]">
                      <th className="py-2.5 px-4 w-40">Kriteria</th>
                      <th className="py-2.5 px-4 text-center bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 font-black">
                        SABAH MAJU
                      </th>
                      <th className="py-2.5 px-4 text-center">ABC</th>
                      <th className="py-2.5 px-4 text-center">XYZ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                    {selectedItem.comparison.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                        <td className="py-2.5 px-4 font-sans font-bold text-slate-900 dark:text-white">
                          {row.criteria}
                        </td>
                        <td className="py-2.5 px-4 text-center bg-emerald-500/5 font-black text-emerald-600 dark:text-emerald-400">
                          {row.sabahMaju}
                        </td>
                        <td className="py-2.5 px-4 text-center text-slate-600 dark:text-slate-400">
                          {row.abc}
                        </td>
                        <td className="py-2.5 px-4 text-center text-slate-600 dark:text-slate-400">
                          {row.xyz}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 📝 Justifikasi Pemilihan */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1.5">
                <span className="text-xs font-black uppercase text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <span>📝</span> JUSTIFIKASI PEMILIHAN
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  {selectedItem.justification}
                </p>
              </div>
            </div>

            {/* 4. 👤 PENGESAHAN PEGAWAI (3-STAGE WORKFLOW) */}
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={18} className="text-emerald-600" />
                  👤 ALUR KERJA PENGESAHAN PEGAWAI
                </h4>
                <span className="text-[11px] text-slate-500">
                  3 Peringkat Semakan &amp; Kelulusan Rasmi
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. DISEDIAKAN OLEH */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                      1. DISEDIAKAN OLEH
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      <div>
                        <span className="text-slate-400 font-sans block text-[10px]">Nama :</span>
                        <strong className="text-slate-900 dark:text-white">{selectedItem.workflow.preparedBy.name || 'Ahmad bin Razak'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 font-sans block text-[10px]">Jawatan :</span>
                        <span className="text-slate-700 dark:text-slate-300 font-sans">{selectedItem.workflow.preparedBy.designation}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-sans block text-[10px]">Tarikh :</span>
                        <span className="text-slate-700 dark:text-slate-300">{selectedItem.workflow.preparedBy.date}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-white/5">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      <CheckCircle2 size={14} /> Disediakan &amp; Dihantar
                    </span>
                  </div>
                </div>

                {/* 2. DISEMAK OLEH */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                      2. DISEMAK OLEH
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      <div>
                        <span className="text-slate-400 font-sans block text-[10px]">Nama :</span>
                        <strong className="text-slate-900 dark:text-white">
                          {selectedItem.workflow.reviewedBy.name || 'Menunggu tindakan pegawai'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 font-sans block text-[10px]">Jawatan :</span>
                        <span className="text-slate-700 dark:text-slate-300 font-sans">
                          {selectedItem.workflow.reviewedBy.designation || 'Ketua Penolong Pengarah'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-sans block text-[10px]">Tarikh :</span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {selectedItem.workflow.reviewedBy.date || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-white/5">
                    {selectedItem.workflow.reviewedBy.signed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                        <CheckCircle2 size={14} /> Semakan Telah Disahkan
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReviewWorkflow(selectedItem)}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Check size={14} className="stroke-[3]" />
                        <span>🟢 Sahkan Semakan</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. DILULUSKAN OLEH */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                      3. DILULUSKAN OLEH
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      <div>
                        <span className="text-slate-400 font-sans block text-[10px]">Nama :</span>
                        <strong className="text-slate-900 dark:text-white">
                          {selectedItem.workflow.approvedBy.name || 'Menunggu kelulusan PTJ'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 font-sans block text-[10px]">Jawatan :</span>
                        <span className="text-slate-700 dark:text-slate-300 font-sans">
                          {selectedItem.workflow.approvedBy.designation || 'Pegawai Pengawal PTJ'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-sans block text-[10px]">Tarikh :</span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {selectedItem.workflow.approvedBy.date || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-white/5">
                    {selectedItem.workflow.approvedBy.signed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                        <CheckCircle2 size={14} /> Permohonan Diluluskan
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!selectedItem.workflow.reviewedBy.signed}
                        onClick={() => handleApproveWorkflow(selectedItem)}
                        className={`w-full py-2 font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 ${
                          selectedItem.workflow.reviewedBy.signed
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                            : 'bg-slate-200 dark:bg-white/10 text-slate-400 cursor-not-allowed opacity-60'
                        }`}
                      >
                        <Check size={14} className="stroke-[3]" />
                        <span>🟢 Lulus</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Bottom Final Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer size={15} /> Cetak Kertas Pemilihan
              </button>

              <div className="flex items-center gap-2">
                {selectedItem.status === 'Diluluskan' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onGenerateLO) {
                        onGenerateLO(selectedItem);
                      }
                      if (onNavigateToSection) {
                        onNavigateToSection('pesanan', 'jana');
                      }
                      toast.success(`Membawa ke modul Pesanan Tempatan (LO) bagi ${selectedItem.recommendedSupplier}!`);
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 hover:scale-102 active:scale-98"
                  >
                    <FileCheck size={15} />
                    <span>JANA PESANAN TEMPATAN (LO)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 1: + PEMILIHAN BAHARU */}
      {showNewModal && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 max-w-lg w-full rounded-3xl p-6 sm:p-7 space-y-4 shadow-2xl relative text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <h3 className="font-black text-base uppercase text-slate-900 dark:text-white flex items-center gap-2">
                <Plus size={18} className="text-amber-500" />
                Daftar Cadangan Pemilihan Baharu
              </h3>
              <button 
                onClick={() => setShowNewModal(false)}
                className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSelection} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">No. Permohonan :</label>
                <input
                  type="text"
                  value={newOrderNo}
                  onChange={(e) => setNewOrderNo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Pembekal Dicadangkan :</label>
                <select
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl font-bold"
                >
                  <option value="SABAH MAJU SDN. BHD.">SABAH MAJU SDN. BHD.</option>
                  <option value="ABC ENTERPRISE">ABC ENTERPRISE</option>
                  <option value="XYZ TRADING">XYZ TRADING</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Nilai Tawaran (RM) :</label>
                <input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Justifikasi Pemilihan :</label>
                <textarea
                  rows={3}
                  value={newJustification}
                  onChange={(e) => setNewJustification(e.target.value)}
                  placeholder="Nyatakan alasan ringkas cadangan pemilihan pembekal ini..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-white/10 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase rounded-xl shadow-md"
                >
                  Daftar Pemilihan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LIHAT PENILAIAN PENUH */}
      {showFullEvalModal && selectedItem && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 max-w-2xl w-full rounded-3xl p-6 sm:p-7 space-y-4 shadow-2xl relative text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <h3 className="font-black text-sm uppercase text-slate-900 dark:text-white flex items-center gap-2">
                <FileText size={18} className="text-amber-500" />
                Laporan Penilaian Penuh: {selectedItem.orderNo}
              </h3>
              <button 
                onClick={() => setShowFullEvalModal(false)}
                className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-white/10 font-mono text-xs space-y-3">
              <div className="border-b border-dashed border-slate-300 dark:border-white/10 pb-2">
                <strong className="text-slate-900 dark:text-white text-sm font-sans block">
                  TATACARA PENGURUSAN PEROLEHAN KERAJAAN (1PP PK 2)
                </strong>
                <span className="text-[10px] text-slate-500 font-sans">
                  Kajian Pasaran Minimum 3 Pembekal &amp; Penilaian Harga / Spesifikasi
                </span>
              </div>

              <div className="space-y-1 text-slate-700 dark:text-slate-300 font-sans">
                <p>• <strong>Pembekal Terpilih:</strong> {selectedItem.recommendedSupplierFull}</p>
                <p>• <strong>Harga Tawaran:</strong> RM{selectedItem.amount.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</p>
                <p>• <strong>Tempoh Penghantaran:</strong> {selectedItem.deliveryDays}</p>
                <p>• <strong>Pematuhan Spesifikasi:</strong> 100% Mematuhi semua butiran teknikal</p>
                <p>• <strong>Pendaftaran Syarikat:</strong> Aktif di bawah Suruhanjaya Syarikat Malaysia (SSM) &amp; MOF</p>
                <p>• <strong>Status Cukai:</strong> Berdaftar dan patuh SST</p>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-400 text-xs font-sans">
                ✓ Pegawai Penilai mengesahkan bahawa tiada sebarang konflik kepentingan dan proses penilaian dibuat secara adil, saksama dan telus.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToSection) {
                    onNavigateToSection('penilaian', 'perbandingan');
                  }
                  setShowFullEvalModal(false);
                }}
                className="px-4 py-2 bg-amber-500 text-slate-950 font-black text-xs uppercase rounded-xl shadow-sm"
              >
                Buka Matriks Penilaian
              </button>
              <button
                type="button"
                onClick={() => setShowFullEvalModal(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
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
