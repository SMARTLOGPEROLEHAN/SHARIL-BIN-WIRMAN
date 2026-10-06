import React, { useState, useEffect, useMemo } from 'react';
import { 
  Coins, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  TrendingUp,
  Building2,
  FileText,
  Layers,
  ChevronRight,
  ShieldCheck,
  X,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, query, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useProcurementModule } from '../context/ModuleContext';
import toast from 'react-hot-toast';

export interface VotPerolehanItem {
  id: string;
  kodVot: string; // e.g. 'B62-020101-1002'
  kategori: 'BEKALAN' | 'PERKHIDMATAN' | 'KERJA';
  butiran: string; // e.g. 'Perolehan Bekalan Alat Tulis & Percetakan Pejabat'
  peruntukanAsal: number;
  belanjaAsal: number;
  tanggunganAsal: number;
  year?: string;
  catatan?: string;
}

// 6 Official Government Vot codes matching exactly the user's reference image
export const DEFAULT_DIRECT_AWARD_VOT_CODES: VotPerolehanItem[] = [
  {
    id: 'vot-1',
    kodVot: 'B62-020101-1002',
    kategori: 'BEKALAN',
    butiran: 'Perolehan Bekalan Alat Tulis & Percetakan Pejabat',
    peruntukanAsal: 120000,
    belanjaAsal: 42500,
    tanggunganAsal: 15400,
    year: '2026'
  },
  {
    id: 'vot-2',
    kodVot: 'B62-020801-2004',
    kategori: 'BEKALAN',
    butiran: 'Perolehan Peralatan Komputer & Perisian ICT',
    peruntukanAsal: 200000,
    belanjaAsal: 88000,
    tanggunganAsal: 38500,
    year: '2026'
  },
  {
    id: 'vot-3',
    kodVot: 'B21-020401-3001',
    kategori: 'PERKHIDMATAN',
    butiran: 'Perkhidmatan Penyelenggaraan Hawa Dingin & Sanitasi',
    peruntukanAsal: 180000,
    belanjaAsal: 65000,
    tanggunganAsal: 24000,
    year: '2026'
  },
  {
    id: 'vot-4',
    kodVot: 'B21-020403-3005',
    kategori: 'PERKHIDMATAN',
    butiran: 'Perkhidmatan Sajian Makanan Mesyuarat & Bengkel',
    peruntukanAsal: 90000,
    belanjaAsal: 32000,
    tanggunganAsal: 12500,
    year: '2026'
  },
  {
    id: 'vot-5',
    kodVot: 'B44-030101-4001',
    kategori: 'KERJA',
    butiran: 'Kerja Pembaikan Kecil Bangunan & Awam (Requisition)',
    peruntukanAsal: 350000,
    belanjaAsal: 142000,
    tanggunganAsal: 68000,
    year: '2026'
  },
  {
    id: 'vot-6',
    kodVot: 'B44-030102-4002',
    kategori: 'KERJA',
    butiran: 'Kerja Penyelenggaraan Elektrik & Pendawaian Kuarters',
    peruntukanAsal: 250000,
    belanjaAsal: 98000,
    tanggunganAsal: 45000,
    year: '2026'
  }
];

export default function DirectAwardBudgetBook() {
  const { role, district } = useAuth();
  const isAdmin = role === 'admin' || role === 'pentadbir';

  const [votList, setVotList] = useState<VotPerolehanItem[]>(DEFAULT_DIRECT_AWARD_VOT_CODES);
  const [orderRequests, setOrderRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'SEMUA' | 'BEKALAN' | 'PERKHIDMATAN' | 'KERJA'>('SEMUA');

  // Modal State for Adding/Editing Vot
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<VotPerolehanItem | null>(null);
  const [formData, setFormData] = useState({
    kodVot: '',
    kategori: 'BEKALAN' as 'BEKALAN' | 'PERKHIDMATAN' | 'KERJA',
    butiran: '',
    peruntukanAsal: 0,
    belanjaAsal: 0,
    tanggunganAsal: 0,
    catatan: ''
  });

  // Modal State for Viewing Detailed Orders per Vot
  const [selectedVotForOrders, setSelectedVotForOrders] = useState<VotPerolehanItem | null>(null);

  useEffect(() => {
    fetchVotCodes();
    fetchOrderRequests();
  }, []);

  const fetchVotCodes = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'directAwardVotCodes'));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const loaded: VotPerolehanItem[] = [];
        snapshot.forEach(docSnap => {
          loaded.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        // Sort according to predetermined order if present
        setVotList(loaded);
      } else {
        setVotList(DEFAULT_DIRECT_AWARD_VOT_CODES);
      }
    } catch (err) {
      console.warn('Using default direct award vot codes:', err);
      setVotList(DEFAULT_DIRECT_AWARD_VOT_CODES);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderRequests = async () => {
    try {
      const q = query(collection(db, 'orderRequests'));
      const snapshot = await getDocs(q);
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setOrderRequests(list);
    } catch (err) {
      console.warn('Could not fetch order requests for live commitments:', err);
    }
  };

  // Compute live additions from Tawaran Terus order requests
  const computedRows = useMemo(() => {
    return votList.map(item => {
      const cleanKod = item.kodVot.toUpperCase().replace(/\s+/g, '');
      const prefix = item.kodVot.split('-')[0] || '';

      // Match orders linked to this kodVot
      const matchedOrders = orderRequests.filter(ord => {
        const ordCode = (ord.allocationCode || ord.kodAktivitiObjek || '').toUpperCase().replace(/\s+/g, '');
        if (!ordCode) return false;
        if (ordCode.includes(cleanKod) || cleanKod.includes(ordCode)) return true;
        if (prefix && ordCode.startsWith(prefix) && ord.category === item.kategori) return true;
        return false;
      });

      // Additional commitments from approved or sent orders
      let liveTanggungan = 0;
      let liveBelanja = 0;

      matchedOrders.forEach(ord => {
        const amt = Number(ord.estimatedAmount) || 0;
        if (ord.status === 'DIBAYAR' || ord.financeStatus === 'DIBAYAR') {
          liveBelanja += amt;
        } else if (
          ord.status === 'LULUS' || 
          ord.status === 'DIHANTAR KE KEWANGAN' || 
          ord.financeStatus === 'DIHANTAR' ||
          ord.financeStatus === 'DISAHKAN KEWANGAN'
        ) {
          liveTanggungan += amt;
        }
      });

      const totalPeruntukan = item.peruntukanAsal;
      const totalBelanja = item.belanjaAsal + liveBelanja;
      const totalTanggungan = item.tanggunganAsal + liveTanggungan;
      const bakiBersih = Math.max(0, totalPeruntukan - totalBelanja - totalTanggungan);
      
      const usedAmount = totalBelanja + totalTanggungan;
      const penggunaanPct = totalPeruntukan > 0 
        ? Math.min(100, Math.round((usedAmount / totalPeruntukan) * 100)) 
        : 0;

      return {
        ...item,
        peruntukan: totalPeruntukan,
        belanja: totalBelanja,
        tanggungan: totalTanggungan,
        bakiBersih: bakiBersih,
        penggunaanPct: penggunaanPct,
        matchedOrdersCount: matchedOrders.length,
        matchedOrders: matchedOrders
      };
    });
  }, [votList, orderRequests]);

  // Overall Totals for the 4 Metric Cards
  const totalPeruntukanAsal = useMemo(() => {
    return computedRows.reduce((sum, r) => sum + r.peruntukan, 0);
  }, [computedRows]);

  const totalPerbelanjaanSebenar = useMemo(() => {
    return computedRows.reduce((sum, r) => sum + r.belanja, 0);
  }, [computedRows]);

  const totalTanggunganKomited = useMemo(() => {
    return computedRows.reduce((sum, r) => sum + r.tanggungan, 0);
  }, [computedRows]);

  const totalBakiBersih = useMemo(() => {
    return Math.max(0, totalPeruntukanAsal - totalPerbelanjaanSebenar - totalTanggunganKomited);
  }, [totalPeruntukanAsal, totalPerbelanjaanSebenar, totalTanggunganKomited]);

  // Filtered rows for the table
  const filteredRows = useMemo(() => {
    return computedRows.filter(r => {
      const matchCat = selectedCategory === 'SEMUA' || r.kategori === selectedCategory;
      const matchSearch = searchTerm === '' || 
        r.kodVot.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.butiran.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [computedRows, selectedCategory, searchTerm]);

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const rowsData = computedRows.map((r, idx) => ({
        'Bil': idx + 1,
        'Kod Vot': r.kodVot,
        'Kategori': r.kategori,
        'Butiran Perolehan': r.butiran,
        'Peruntukan (RM)': r.peruntukan,
        'Belanja Sebenar (RM)': r.belanja,
        'Tanggungan Komited (RM)': r.tanggungan,
        'Baki Bersih Boleh Guna (RM)': r.bakiBersih,
        'Penggunaan (%)': `${r.penggunaanPct}%`
      }));

      // Add summary row
      rowsData.push({
        'Bil': '' as any,
        'Kod Vot': 'JUMLAH KESELURUHAN' as any,
        'Kategori': '' as any,
        'Butiran Perolehan': 'RINGKASAN BUKU VOT 2026',
        'Peruntukan (RM)': totalPeruntukanAsal,
        'Belanja Sebenar (RM)': totalPerbelanjaanSebenar,
        'Tanggungan Komited (RM)': totalTanggunganKomited,
        'Baki Bersih Boleh Guna (RM)': totalBakiBersih,
        'Penggunaan (%)': `${Math.round(((totalPerbelanjaanSebenar + totalTanggunganKomited) / (totalPeruntukanAsal || 1)) * 100)}%`
      });

      const ws = XLSX.utils.json_to_sheet(rowsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Buku Vot Tawaran Terus');
      XLSX.writeFile(wb, `Buku_Vot_Tawaran_Terus_2026.xlsx`);
      toast.success('Buku Vot berjaya dieksport ke format Excel');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Gagal mengeksport fail Excel');
    }
  };

  // Print View
  const handlePrint = () => {
    window.print();
  };

  // Open Edit Modal
  const handleOpenEdit = (item: VotPerolehanItem) => {
    setEditingItem(item);
    setFormData({
      kodVot: item.kodVot,
      kategori: item.kategori,
      butiran: item.butiran,
      peruntukanAsal: item.peruntukanAsal,
      belanjaAsal: item.belanjaAsal,
      tanggunganAsal: item.tanggunganAsal,
      catatan: item.catatan || ''
    });
    setShowModal(true);
  };

  // Open New Modal
  const handleOpenNew = () => {
    setEditingItem(null);
    setFormData({
      kodVot: '',
      kategori: 'BEKALAN',
      butiran: '',
      peruntukanAsal: 100000,
      belanjaAsal: 0,
      tanggunganAsal: 0,
      catatan: ''
    });
    setShowModal(true);
  };

  // Save Vot code
  const handleSaveVot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.kodVot.trim() || !formData.butiran.trim()) {
      toast.error('Sila lengkapkan Kod Vot dan Butiran Perolehan');
      return;
    }

    try {
      const id = editingItem ? editingItem.id : `vot-${Date.now()}`;
      const payload: VotPerolehanItem = {
        id,
        kodVot: formData.kodVot.trim().toUpperCase(),
        kategori: formData.kategori,
        butiran: formData.butiran.trim(),
        peruntukanAsal: Number(formData.peruntukanAsal) || 0,
        belanjaAsal: Number(formData.belanjaAsal) || 0,
        tanggunganAsal: Number(formData.tanggunganAsal) || 0,
        year: '2026',
        catatan: formData.catatan
      };

      await setDoc(doc(db, 'directAwardVotCodes', id), payload);

      setVotList(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = payload;
          return updated;
        }
        return [...prev, payload];
      });

      setShowModal(false);
      toast.success(editingItem ? 'Kod Vot berjaya dikemaskini' : 'Kod Vot baharu berjaya disimpan');
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Ralat ketika menyimpan kod vot');
    }
  };

  // Reset to default 6 official records
  const handleResetToDefault = async () => {
    if (!confirm('Adakah anda pasti mahu menetapkan semula Buku Vot kepada 6 Vot Rasmi Kerajaan seperti asal?')) {
      return;
    }
    try {
      setLoading(true);
      for (const item of DEFAULT_DIRECT_AWARD_VOT_CODES) {
        await setDoc(doc(db, 'directAwardVotCodes', item.id), item);
      }
      setVotList(DEFAULT_DIRECT_AWARD_VOT_CODES);
      toast.success('Buku Vot telah diselaraskan semula ke rekod rasmi 2026');
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Ralat ketika menetapkan semula data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-950 dark:text-white tracking-tight font-poppins">
            Buku Vot Bajet & Kawalan Peruntukan Tawaran Terus
          </h1>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1 font-semibold">
            Pemantauan baki peruntukan, perbelanjaan sebenar dan tanggungan komited bagi Bekalan, Perkhidmatan & Kerja (AP 95).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              fetchVotCodes();
              fetchOrderRequests();
              toast.success('Buku Vot & baki komited dikemaskini');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
            title="Muat semula baki komited"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Kemaskini</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
          >
            <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400 font-bold" />
            <span>Eksport Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
          >
            <Printer size={15} className="text-sky-600 dark:text-sky-400 font-bold" />
            <span>Cetak</span>
          </button>

          {isAdmin && (
            <button
              onClick={handleOpenNew}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
            >
              <Plus size={15} className="stroke-[3]" />
              <span>Vot Baharu</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Main Metric Cards (Matching selected theme) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: JUMLAH PERUNTUKAN ASAL */}
        <div className="bg-risda-card border border-risda-border rounded-2xl p-5 shadow-xs transition-all hover:shadow-md">
          <div className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            JUMLAH PERUNTUKAN ASAL
          </div>
          <div className="text-2xl sm:text-[28px] font-black text-slate-950 dark:text-white mt-1.5 tracking-tight font-poppins">
            RM {totalPeruntukanAsal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-semibold">
            Vot Rasmi Tahun 2026
          </div>
        </div>

        {/* Card 2: PERBELANJAAN SEBENAR */}
        <div className="bg-risda-card border border-risda-border rounded-2xl p-5 shadow-xs transition-all hover:shadow-md">
          <div className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            PERBELANJAAN SEBENAR
          </div>
          <div className="text-2xl sm:text-[28px] font-black text-slate-950 dark:text-white mt-1.5 tracking-tight font-poppins">
            RM {totalPerbelanjaanSebenar.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-semibold">
            Baucar Bayaran Disahkan
          </div>
        </div>

        {/* Card 3: TANGGUNGAN KOMITED (LO) */}
        <div className="bg-risda-card border border-risda-border rounded-2xl p-5 shadow-xs transition-all hover:shadow-md">
          <div className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            TANGGUNGAN KOMITED (LO)
          </div>
          <div className="text-2xl sm:text-[28px] font-black text-[#ea580c] dark:text-amber-400 mt-1.5 tracking-tight font-poppins">
            RM {totalTanggunganKomited.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-semibold">
            Pesanan Tempatan Terbit
          </div>
        </div>

        {/* Card 4: BAKI BERSIH BOLEH GUNA */}
        <div className="bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 dark:border-emerald-700/80 rounded-2xl p-5 shadow-xs transition-all hover:shadow-md">
          <div className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            BAKI BERSIH BOLEH GUNA
          </div>
          <div className="text-2xl sm:text-[28px] font-black text-emerald-700 dark:text-emerald-300 mt-1.5 tracking-tight font-poppins">
            RM {totalBakiBersih.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 font-bold">
            Baki Semasa Tawaran Terus
          </div>
        </div>
      </div>

      {/* Main Table Container Card */}
      <div className="bg-risda-card border border-risda-border rounded-2xl shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-950 dark:text-white tracking-tight">
                Senarai Vot Perolehan Mengikut Kod Objek Kerajaan
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-semibold">
                Sebarang permohonan Tawaran Terus akan mengunci tanggungan komited secara automatik mengikut Arahan Perbendaharaan.
              </p>
            </div>

            {/* Category Filter Pills & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700">
                {(['SEMUA', 'BEKALAN', 'PERKHIDMATAN', 'KERJA'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari kod / butiran..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8.5 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-950 dark:text-white font-bold focus:outline-none focus:border-risda-orange w-44 sm:w-56"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-black text-slate-950 dark:text-white bg-slate-100 dark:bg-slate-800/80 uppercase tracking-wider">
                <th className="py-4 px-5 font-black">Kod Vot</th>
                <th className="py-4 px-4 font-black">Kategori &amp; Butiran Perolehan</th>
                <th className="py-4 px-4 font-black text-right">Peruntukan (RM)</th>
                <th className="py-4 px-4 font-black text-right">Belanja (RM)</th>
                <th className="py-4 px-4 font-black text-right">Tanggungan (RM)</th>
                <th className="py-4 px-4 font-black text-right">Baki Bersih (RM)</th>
                <th className="py-4 px-5 font-black text-right">Penggunaan (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-xs font-semibold">
              {filteredRows.map((row) => {
                // Category styling badges
                let badgeClass = 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-700';
                if (row.kategori === 'PERKHIDMATAN') {
                  badgeClass = 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700';
                } else if (row.kategori === 'KERJA') {
                  badgeClass = 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700';
                }

                // Progress bar color based on percentage (matching image: <50% green, >=50% orange)
                const isHighUsage = row.penggunaanPct >= 50;
                const barColor = isHighUsage ? 'bg-amber-500' : 'bg-emerald-500';

                return (
                  <tr 
                    key={row.id} 
                    className="hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                    onClick={() => row.matchedOrdersCount > 0 && setSelectedVotForOrders(row)}
                  >
                    {/* 1. Kod Vot */}
                    <td className="py-4 px-5 whitespace-nowrap">
                      <div className="font-mono font-black text-blue-700 dark:text-sky-400 text-xs sm:text-sm tracking-tight">
                        {row.kodVot}
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(row);
                            }}
                            className="text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 size={12} /> Ubah
                          </button>
                        </div>
                      )}
                    </td>

                    {/* 2. Kategori & Butiran Perolehan */}
                    <td className="py-4 px-4 min-w-[280px]">
                      <div className="font-black text-slate-950 dark:text-white text-xs sm:text-sm leading-snug">
                        {row.butiran}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-black uppercase rounded-md border tracking-wider shadow-xs ${badgeClass}`}>
                          {row.kategori}
                        </span>
                        {row.matchedOrdersCount > 0 && (
                          <span className="text-xs text-amber-900 dark:text-amber-200 font-extrabold bg-amber-100 dark:bg-amber-950/70 px-2.5 py-0.5 rounded-md border border-amber-300 dark:border-amber-700 shadow-xs">
                            {row.matchedOrdersCount} Permohonan Terkunci
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. Peruntukan (RM) */}
                    <td className="py-4 px-4 text-right whitespace-nowrap font-black text-slate-950 dark:text-white text-xs sm:text-sm">
                      RM {row.peruntukan.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* 4. Belanja (RM) */}
                    <td className="py-4 px-4 text-right whitespace-nowrap font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                      RM {row.belanja.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* 5. Tanggungan (RM) */}
                    <td className="py-4 px-4 text-right whitespace-nowrap font-black text-[#ea580c] dark:text-amber-400 text-xs sm:text-sm">
                      RM {row.tanggungan.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* 6. Baki Bersih (RM) */}
                    <td className="py-4 px-4 text-right whitespace-nowrap font-black text-[#15803d] dark:text-emerald-400 text-xs sm:text-sm">
                      RM {row.bakiBersih.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* 7. Penggunaan (%) */}
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2.5">
                        <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${barColor}`} 
                            style={{ width: `${Math.min(100, row.penggunaanPct)}%` }}
                          />
                        </div>
                        <span className="font-black text-slate-950 dark:text-white text-xs sm:text-sm min-w-[32px] text-right">
                          {row.penggunaanPct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                    Tiada kod vot perolehan yang sepadan dengan carian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary & Reset */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Menunjukkan {filteredRows.length} daripada {votList.length} Vot Perolehan Rasmi Kerajaan
            </span>
          </div>

          {isAdmin && (
            <button
              onClick={handleResetToDefault}
              className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-amber-500 transition-colors cursor-pointer"
            >
              Set Semula Data Asal 6 Vot Kerajaan
            </button>
          )}
        </div>
      </div>

      {/* MODAL: Tambah / Edit Kod Vot */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight mb-4">
              {editingItem ? 'Kemaskini Vot Perolehan' : 'Daftar Vot Perolehan Baharu'}
            </h3>

            <form onSubmit={handleSaveVot} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-1.5">
                    Kod Vot
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: B62-020101-1002"
                    value={formData.kodVot}
                    onChange={(e) => setFormData({ ...formData, kodVot: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-1.5">
                    Kategori
                  </label>
                  <select
                    value={formData.kategori}
                    onChange={(e) => setFormData({ ...formData, kategori: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="BEKALAN">BEKALAN</option>
                    <option value="PERKHIDMATAN">PERKHIDMATAN</option>
                    <option value="KERJA">KERJA</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-1.5">
                  Butiran Perolehan
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Contoh: Perolehan Bekalan Alat Tulis & Percetakan Pejabat"
                  value={formData.butiran}
                  onChange={(e) => setFormData({ ...formData, butiran: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-1.5">
                    Peruntukan (RM)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.peruntukanAsal}
                    onChange={(e) => setFormData({ ...formData, peruntukanAsal: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-1.5">
                    Belanja Asal (RM)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.belanjaAsal}
                    onChange={(e) => setFormData({ ...formData, belanjaAsal: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-1.5">
                    Tanggungan Asal (RM)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.tanggunganAsal}
                    onChange={(e) => setFormData({ ...formData, tanggunganAsal: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-risda-orange"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-risda-orange text-white rounded-xl text-xs font-black hover:bg-risda-orange-hover shadow-md cursor-pointer"
                >
                  Simpan Kod Vot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Paparan Permohonan Terkunci bagi Kod Vot */}
      {selectedVotForOrders && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => setSelectedVotForOrders(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={18} />
            </button>

            <div className="mb-4">
              <span className="font-mono text-xs font-bold text-sky-600 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded border border-sky-200/60">
                {selectedVotForOrders.kodVot}
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight mt-1.5">
                {selectedVotForOrders.butiran}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Senarai permohonan Tawaran Terus yang mengunci tanggungan komited / perbelanjaan di bawah kod ini.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 pr-1">
              {(selectedVotForOrders as any).matchedOrders?.map((ord: any) => (
                <div key={ord.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                        {ord.orderNo || ord.poNo || 'Permohonan'}
                      </span>
                      <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-md shadow-xs ${
                        ord.status === 'DIBAYAR' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700' 
                          : 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700'
                      }`}>
                        {ord.status}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-semibold mt-1">
                      {ord.title || ord.perihalPerolehan}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1">
                      Pembekal: <strong className="text-slate-900 dark:text-white">{ord.supplierName || ord.pembekalDipilih || 'Belum dipilih'}</strong> • Tarikh: {ord.requestDate || '-'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-xs sm:text-sm text-slate-950 dark:text-white tabular-nums">
                      RM {Number(ord.estimatedAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 font-bold mt-0.5">
                      {ord.status === 'DIBAYAR' ? 'Perbelanjaan' : 'Tanggungan LO'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedVotForOrders(null)}
                className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
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
