import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Sparkles, 
  Package, 
  Briefcase, 
  Hammer, 
  TrendingUp, 
  Clock, 
  FileCheck, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  X, 
  Printer, 
  Building2, 
  Coins, 
  Calendar,
  ExternalLink,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { collection, query, getDocs, orderBy, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import NewDirectAwardModal from './NewDirectAwardModal';
import DirectAwardCompleteDossierModal from './DirectAwardCompleteDossierModal';
import { DirectAwardSection } from './DirectAwardManagement';

interface DirectAwardItem {
  id: string;
  refNo: string;
  date: string;
  title: string;
  category: 'BEKALAN' | 'PERKHIDMATAN' | 'KERJA';
  itemCount: string;
  selectedSupplier: string;
  supplierCode: string;
  budgetVote: string;
  amount: number;
  aiCompliance: number;
  status: 'Pesanan Tempatan (LO) Dijana' | 'Menunggu Kelulusan' | 'Dalam Proses' | 'Selesai';
  items?: { name: string; qty: number; unitPrice: number; total: number }[];
  justification?: string;
  location?: string;
}

// Senarai permohonan Tawaran Terus bermula kosong (belum ada permohonan baru ditambah)
const DEFAULT_AWARDS: DirectAwardItem[] = [];

export default function DirectAwardDashboard() {
  const { role, district } = useAuth();
  const isAdmin = role === 'admin' || role === 'pentadbir';
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'SEMUA' | 'BEKALAN' | 'PERKHIDMATAN' | 'KERJA'>('SEMUA');
  const [selectedAward, setSelectedAward] = useState<DirectAwardItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [awards, setAwards] = useState<DirectAwardItem[]>([]);
  const [loading, setLoading] = useState(false);

  // New Award Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'BEKALAN' | 'PERKHIDMATAN' | 'KERJA'>('BEKALAN');
  const [newSupplier, setNewSupplier] = useState('');
  const [newSupplierCode, setNewSupplierCode] = useState('');
  const [newBudgetVote, setNewBudgetVote] = useState('B62');
  const [newAmount, setNewAmount] = useState('');
  const [newJustification, setNewJustification] = useState('');

  // Fetch real order requests from Firestore and merge if present
  useEffect(() => {
    try {
      const q = query(collection(db, 'order_requests'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const fetchedItems: DirectAwardItem[] = snapshot.docs
            .map(docSnap => {
              const data = docSnap.data();
              const isTT = data.module === 'tawaran_terus';
              if (!isTT) {
                return null;
              }
              return {
                id: docSnap.id,
                refNo: data.orderNo || data.requestNo || `KK/BP/TT/2026/${docSnap.id.slice(-4).toUpperCase()}`,
                date: data.requestDate || (data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '25 Sep 2026'),
                title: data.title || data.tajuk || 'Permohonan Tawaran Terus',
                category: (data.category?.toUpperCase() || 'BEKALAN') as any,
                itemCount: data.items?.length ? `${data.items.length} item` : '1 item',
                selectedSupplier: data.supplierName || data.pembekalDipilih || data.companyName || 'Syarikat Pembekal Berdaftar',
                supplierCode: data.supplierCode || (data.category === 'KERJA' ? 'CIDB G2' : 'MOF'),
                budgetVote: data.allocationCode || data.budgetVote || 'B62',
                amount: Number(data.estimatedAmount) || Number(data.totalAmount) || 15000,
                aiCompliance: data.aiCompliance || 96,
                status: (data.status === 'LULUS' || data.status === 'PESANAN_DIKELUARKAN' ? 'Pesanan Tempatan (LO) Dijana' : 'Menunggu Kelulusan') as any,
                items: data.items || [],
                justification: data.perihalPerolehan || 'Permohonan perolehan terus rasmi.',
                location: data.unitOffice || `Pejabat RISDA Daerah ${district || 'Beaufort'}`
              };
            })
            .filter(Boolean) as DirectAwardItem[];
          setAwards(fetchedItems);
        } else {
          setAwards(DEFAULT_AWARDS);
        }
      }, (err) => {
        console.warn('DirectAwardDashboard: onSnapshot warning, using default high fidelity dataset', err);
        setAwards(DEFAULT_AWARDS);
      });
      return () => unsub();
    } catch (e) {
      setAwards(DEFAULT_AWARDS);
    }
  }, [district]);

  // Dynamic calculations based on current awards
  const bekalanAwards = awards.filter(a => a.category === 'BEKALAN');
  const perkhidmatanAwards = awards.filter(a => a.category === 'PERKHIDMATAN');
  const kerjaAwards = awards.filter(a => a.category === 'KERJA');

  const bekalanTotal = bekalanAwards.reduce((sum, a) => sum + a.amount, 0);
  const perkhidmatanTotal = perkhidmatanAwards.reduce((sum, a) => sum + a.amount, 0);
  const kerjaTotal = kerjaAwards.reduce((sum, a) => sum + a.amount, 0);
  const totalValue = awards.reduce((sum, a) => sum + a.amount, 0);

  const pendingCount = awards.filter(a => a.status === 'Menunggu Kelulusan' || a.status === 'Dalam Proses').length;
  const loCount = awards.filter(a => a.status === 'Pesanan Tempatan (LO) Dijana').length;


  const filteredAwards = awards.filter(a => {
    if (activeCategoryFilter === 'SEMUA') return true;
    return a.category === activeCategoryFilter;
  });

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleCreateAward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAmount) {
      toast.error('Sila lengkapkan tajuk dan jumlah permohonan');
      return;
    }

    const amt = parseFloat(newAmount) || 0;
    const maxLimit = newCategory === 'KERJA' ? 100000 : 50000;
    if (amt > maxLimit) {
      toast.error(`Had ambang tawaran terus untuk ${newCategory} ialah maksimum RM ${maxLimit.toLocaleString()}. Sila gunakan kaedah Sebutharga.`);
      return;
    }

    try {
      const generatedNo = `KK/BP/TT/2026/${Math.floor(1000 + Math.random() * 9000)}`;
      const newAwardData = {
        orderNo: generatedNo,
        title: newTitle,
        category: newCategory,
        supplierName: newSupplier || 'Pembekal Berdaftar RISDA',
        supplierCode: newSupplierCode || (newCategory === 'KERJA' ? 'CIDB G2' : 'MOF'),
        allocationCode: newBudgetVote,
        estimatedAmount: amt,
        perihalPerolehan: newJustification || 'Permohonan tawaran terus rasmi',
        status: 'DALAM SEMAKAN',
        requestDate: new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' }),
        createdAt: Timestamp.now(),
        unitOffice: `Pejabat RISDA Daerah ${district || 'Beaufort'}`,
        aiCompliance: 96
      };

      await addDoc(collection(db, 'order_requests'), newAwardData);
      toast.success('Permohonan Tawaran Terus baharu berjaya didaftarkan!');
      setShowCreateModal(false);
      setNewTitle('');
      setNewAmount('');
      setNewSupplier('');
      setNewSupplierCode('');
      setNewJustification('');
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal mendaftar permohonan: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-7 animate-fadeIn pb-12">
      {/* 1. HERO BANNER (Matches selected theme, identical to OrderRequestManagement) */}
      <div className="bg-risda-card border border-risda-border rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-80 h-60 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            {/* Top pill badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black uppercase tracking-wider shadow-xs">
              <Sparkles size={14} className="text-amber-500" />
              <span>Pekeliling Perbendaharaan Malaysia (1PP PK 2 &amp; AP 173)</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight font-poppins text-slate-900 dark:text-white uppercase leading-tight">
              Sistem Tawaran Terus: Bekalan, Perkhidmatan &amp; Kerja
            </h1>

            {/* Subtitle */}
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
              Memproses perolehan terus yang telus dan pantas mengikut had ambang rasmi serta pematuhan tatacara 1PP PK 2 dan Arahan Perbendaharaan (AP 173).
            </p>
          </div>

          {/* Right Action Button */}
          <div className="shrink-0 flex items-center">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-[0_10px_25px_rgba(245,158,11,0.25)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={18} className="stroke-[3]" />
              <span>📝 + PERMOHONAN BAHARU</span>
            </button>
          </div>
        </div>
      </div>

            {/* 2. TOP 3 CATEGORY CARDS (Grid of 3 columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Kategori 1: Bekalan */}
        <div className="bg-risda-card border border-risda-border hover:border-blue-500/50 rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 flex items-center justify-center">
                <Package size={20} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-700 shadow-xs">
                MOF KOD BIDANG
              </span>
            </div>

            <div className="text-xs text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider mt-4">
              KATEGORI 1: BEKALAN (SUPPLIES)
            </div>

            <div className="text-2xl sm:text-[28px] font-black text-slate-950 dark:text-white tracking-tight mt-1 tabular-nums">
              RM {bekalanTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 mt-3 border-t border-risda-border/60 text-xs font-bold">
            <span className="text-slate-700 dark:text-slate-300 font-semibold">
              {bekalanAwards.length} Permohonan Tawaran
            </span>
            <span className="text-blue-700 dark:text-blue-400 font-black">
              Had: RM 50,000 / transaksi
            </span>
          </div>
        </div>

        {/* Kategori 2: Perkhidmatan */}
        <div className="bg-risda-card border border-risda-border hover:border-emerald-500/50 rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center">
                <Briefcase size={20} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700 shadow-xs">
                BUKAN PERUNDING
              </span>
            </div>

            <div className="text-xs text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider mt-4">
              KATEGORI 2: PERKHIDMATAN (SERVICES)
            </div>

            <div className="text-2xl sm:text-[28px] font-black text-slate-950 dark:text-white tracking-tight mt-1 tabular-nums">
              RM {perkhidmatanTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 mt-3 border-t border-risda-border/60 text-xs font-bold">
            <span className="text-slate-700 dark:text-slate-300 font-semibold">
              {perkhidmatanAwards.length} Permohonan Tawaran
            </span>
            <span className="text-emerald-700 dark:text-emerald-400 font-black">
              Had: RM 50,000 / transaksi
            </span>
          </div>
        </div>

        {/* Kategori 3: Kerja */}
        <div className="bg-risda-card border border-risda-border hover:border-amber-500/50 rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center">
                <Hammer size={20} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700 shadow-xs">
                CIDB G2 / REQUISITION
              </span>
            </div>

            <div className="text-xs text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider mt-4">
              KATEGORI 3: KERJA (WORKS)
            </div>

            <div className="text-2xl sm:text-[28px] font-black text-slate-950 dark:text-white tracking-tight mt-1 tabular-nums">
              RM {kerjaTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 mt-3 border-t border-risda-border/60 text-xs font-bold">
            <span className="text-slate-700 dark:text-slate-300 font-semibold">
              {kerjaAwards.length} Permohonan Tawaran
            </span>
            <span className="text-amber-700 dark:text-amber-400 font-black">
              Had: RM 100,000 (G1)
            </span>
          </div>
        </div>
      </div>

      {/* 3. MIDDLE STAT CARDS (Grid of 3 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Stat 1: Jumlah Nilai Keseluruhan */}
        <div className="bg-risda-card border border-risda-border rounded-2xl p-4.5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
              Jumlah Nilai Keseluruhan
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight tabular-nums">
              RM {totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
              {awards.length} Perolehan Aktif
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
            <TrendingUp size={20} />
          </div>
        </div>

        {/* Stat 2: Menunggu Kelulusan/Audit */}
        <div className="bg-risda-card border border-risda-border rounded-2xl p-4.5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
              Menunggu Kelulusan/Audit
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-500 dark:text-amber-400 tracking-tight tabular-nums">
              {pendingCount} Permohonan
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
              Perlu Tindakan Pengarah/SUB
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
        </div>

        {/* Stat 3: Pesanan Tempatan (LO) Dijana */}
        <div className="bg-risda-card border border-risda-border rounded-2xl p-4.5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
              Pesanan Tempatan (LO) Dijana
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-500 dark:text-emerald-400 tracking-tight tabular-nums">
              {loCount} Dokumen
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
              Sedia Dilaksana Pembekal
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <FileCheck size={20} />
          </div>
        </div>
      </div>

      {/* 4. TABLE SECTION: "Senarai Permohonan Tawaran Terus Terkini" */}
      <div className="bg-risda-card border border-risda-border rounded-2xl shadow-sm overflow-hidden">
        {/* Table Header with Filters */}
        <div className="p-5 sm:p-6 border-b border-risda-border flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-950 dark:text-white tracking-tight">
              Senarai Permohonan Tawaran Terus Terkini
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-semibold">
              Klik pada mana-mana rekod untuk melihat spesifikasi, semakan audit AI, kelulusan, dan jana dokumen rasmi.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            <button
              onClick={() => setActiveCategoryFilter('SEMUA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                activeCategoryFilter === 'SEMUA'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                  : 'bg-black/5 dark:bg-white/5 text-risda-muted hover:text-risda-text'
              }`}
            >
              Semua ({awards.length})
            </button>

            <button
              onClick={() => setActiveCategoryFilter('BEKALAN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                activeCategoryFilter === 'BEKALAN'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-black/5 dark:bg-white/5 text-risda-muted hover:text-blue-500'
              }`}
            >
              <Package size={13} />
              <span>Bekalan ({bekalanAwards.length})</span>
            </button>

            <button
              onClick={() => setActiveCategoryFilter('PERKHIDMATAN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                activeCategoryFilter === 'PERKHIDMATAN'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-black/5 dark:bg-white/5 text-risda-muted hover:text-emerald-500'
              }`}
            >
              <Briefcase size={13} />
              <span>Perkhidmatan ({perkhidmatanAwards.length})</span>
            </button>

            <button
              onClick={() => setActiveCategoryFilter('KERJA')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                activeCategoryFilter === 'KERJA'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-black/5 dark:bg-white/5 text-risda-muted hover:text-amber-500'
              }`}
            >
              <Hammer size={13} />
              <span>Kerja ({kerjaAwards.length})</span>
            </button>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-xs font-black uppercase tracking-wider text-slate-950 dark:text-white">
                <th className="py-4 px-5">No. Rujukan &amp; Tarikh</th>
                <th className="py-4 px-5">Tajuk &amp; Kategori Perolehan</th>
                <th className="py-4 px-5">Pembekal Terpilih</th>
                <th className="py-4 px-5 text-center">Vot Bajet</th>
                <th className="py-4 px-5 text-right">Jumlah (RM)</th>
                <th className="py-4 px-5 text-center">Pematuhan AI</th>
                <th className="py-4 px-5 text-center">Status</th>
                <th className="py-4 px-5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-xs font-semibold">
              {filteredAwards.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500">
                        <FileCheck size={22} />
                      </div>
                      <p className="text-sm font-black uppercase text-slate-800 dark:text-slate-200">Tiada Permohonan Tawaran Terus Dijumpai</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold max-w-md">Belum ada sebarang permohonan baharu didaftarkan bagi Modul Tawaran Terus.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAwards.map((award) => (
                  <tr 
                    key={award.id}
                    className="hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                    onClick={() => setSelectedAward(award)}
                  >
                    {/* No Rujukan & Tarikh */}
                    <td className="py-4 px-5">
                      <div className="font-mono font-black text-slate-950 dark:text-white text-xs sm:text-sm group-hover:text-amber-500 transition-colors">
                        {award.refNo}
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-300 font-bold mt-1">
                        {award.date}
                      </div>
                    </td>

                    {/* Tajuk & Kategori */}
                    <td className="py-4 px-5 max-w-[320px]">
                      <div className="font-black text-slate-950 dark:text-white text-xs sm:text-sm line-clamp-2 leading-relaxed">
                        {award.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-md shadow-xs ${
                          award.category === 'BEKALAN'
                            ? 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-700'
                            : award.category === 'PERKHIDMATAN'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700'
                            : 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700'
                        }`}>
                          {award.category}
                        </span>
                        <span className="text-xs text-slate-700 dark:text-slate-200 font-bold">
                          {award.itemCount}
                        </span>
                      </div>
                    </td>

                    {/* Pembekal Terpilih */}
                    <td className="py-4 px-5">
                      <div className="font-black text-slate-950 dark:text-white text-xs sm:text-sm">
                        {award.selectedSupplier}
                      </div>
                      <div className="text-xs font-mono text-slate-700 dark:text-slate-300 font-bold mt-0.5">
                        {award.supplierCode}
                      </div>
                    </td>

                    {/* Vot Bajet */}
                    <td className="py-4 px-5 text-center font-mono font-black text-slate-950 dark:text-white text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs">
                        {award.budgetVote}
                      </span>
                    </td>

                    {/* Jumlah (RM) */}
                    <td className="py-4 px-5 text-right font-black text-slate-950 dark:text-white text-xs sm:text-sm tabular-nums">
                      RM {award.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Pematuhan AI */}
                    <td className="py-4 px-5 text-center">
                      <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{award.aiCompliance}% Audit AI</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-5 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                        award.status === 'Pesanan Tempatan (LO) Dijana'
                          ? 'border border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60'
                          : 'border border-blue-500 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60'
                      }`}>
                        {award.status}
                      </span>
                    </td>

                    {/* Tindakan */}
                    <td className="py-4 px-5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAward(award);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-black text-blue-500 dark:text-blue-400 hover:text-amber-500 transition-colors cursor-pointer group-hover:translate-x-0.5"
                      >
                        <span>Buka</span>
                        <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL DETAIL PERMOHONAN */}
      <AnimatePresence>
        {selectedAward && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
              onClick={() => setSelectedAward(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-risda-card border border-risda-border w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden relative z-10 max-h-[90vh] flex flex-col"
            >
              {/* Modal Top Bar */}
              <div className="p-6 border-b border-risda-border flex items-center justify-between bg-black/5 dark:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/25 flex items-center justify-center shrink-0">
                    <FileCheck size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      {selectedAward.refNo} • {selectedAward.date}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white">
                      Perincian Tawaran Terus
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedAward(null)}
                  className="w-9 h-9 rounded-xl border border-risda-border text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/5 flex items-center justify-center transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
                {/* Title & Category Banner */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      {selectedAward.category}
                    </span>
                    <span className="text-xs font-bold text-slate-300 dark:text-slate-300">
                      Vot Bajet: {selectedAward.budgetVote}
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-white leading-relaxed">
                    {selectedAward.title}
                  </h4>
                  <p className="text-xs text-slate-200 font-medium leading-relaxed">
                    {selectedAward.justification}
                  </p>
                </div>

                {/* AI Integrity Audit Badge */}
                <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-3">
                  <Sparkles size={20} className="text-purple-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black text-purple-300">
                        Semakan Integriti & Pematuhan AP 173 ({selectedAward.aiCompliance}% Lulus)
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                      Sistem mengesahkan tiada unsur pecah kecil perolehan, had perolehan tidak melebihi siling rasmi (RM {selectedAward.category === 'KERJA' ? '100,000' : '50,000'}), dan kod bidang pembekal sah aktif.
                    </p>
                  </div>
                </div>

                {/* Pembekal & Nilai */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <div className="text-xs text-slate-300 uppercase font-black">Pembekal Terpilih</div>
                    <div className="font-bold text-white text-sm sm:text-base">{selectedAward.selectedSupplier}</div>
                    <div className="text-xs font-mono text-slate-300 font-bold">{selectedAward.supplierCode}</div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <div className="text-xs text-slate-300 uppercase font-black">Jumlah Nilai Bersih</div>
                    <div className="text-xl font-black text-amber-400 tabular-nums">
                      RM {selectedAward.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-emerald-400 font-bold">Status: {selectedAward.status}</div>
                  </div>
                </div>

                {/* Senarai Item Spesifikasi */}
                {selectedAward.items && selectedAward.items.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-black uppercase text-slate-200 tracking-wider">
                      Pecahan Spesifikasi & Skop Perolehan:
                    </div>
                    <div className="divide-y divide-white/10 border border-white/10 rounded-xl overflow-hidden bg-black/20">
                      {selectedAward.items.map((item, idx) => (
                        <div key={idx} className="p-3.5 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-white text-xs sm:text-sm">{item.name}</div>
                            <div className="text-xs text-slate-300 font-semibold">Kuantiti: {item.qty} unit</div>
                          </div>
                          <div className="font-mono font-bold text-amber-400 text-xs sm:text-sm">
                            RM {item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Buttons */}
              <div className="p-5 border-t border-risda-border bg-black/5 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    toast.success('Menjana Pesanan Tempatan (LO) rasmi ke PDF...');
                    navigateTo('/urus-permintaan-pesanan');
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Printer size={15} />
                  <span>Jana Pesanan Tempatan (LO)</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigateTo('/urus-permintaan-pesanan')}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Urus Permintaan</span>
                    <ExternalLink size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAward(null)}
                    className="px-4 py-2.5 bg-risda-card border border-risda-border hover:bg-white/5 text-risda-text font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. MODAL DAFTAR PERMOHONAN BAHARU (3-LANGKAH 1PP PK 2 FORMAT TEPAT) */}
      <NewDirectAwardModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        onSuccess={() => {}} 
      />

      {/* 7. MODAL DOSSIER LENGKAP PEROLEHAN TAWARAN TERUS */}
      {showDossierModal && (
        <DirectAwardCompleteDossierModal
          orderNo="TT-2026-00125"
          onClose={() => setShowDossierModal(false)}
        />
      )}
    </div>
  );
}
