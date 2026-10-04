import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  Eye, 
  Send, 
  FileText, 
  Paperclip, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Building2, 
  User, 
  Tag, 
  Coins, 
  Clock, 
  Printer, 
  ShieldCheck, 
  ArrowRight,
  FileCheck,
  AlertTriangle,
  UploadCloud,
  FileSpreadsheet
} from 'lucide-react';
import { collection, addDoc, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export interface DirectAwardItem {
  id: string;
  item: string;
  specs: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
}

export interface AttachedDoc {
  id: string;
  type: 'spesifikasi' | 'justifikasi' | 'sebutharga' | 'dokumen_lain';
  title: string;
  fileName?: string;
  fileSize?: string;
  isAttached: boolean;
  required?: boolean;
}

interface NewDirectAwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdId?: string, status?: string) => void;
  initialAllocationCode?: string;
}

export default function NewDirectAwardModal({
  isOpen,
  onClose,
  onSuccess,
  initialAllocationCode
}: NewDirectAwardModalProps) {
  const { user, profile } = useAuth();

  // A. Maklumat Permohonan
  const [orderNo, setOrderNo] = useState('');
  const [requestDate, setRequestDate] = useState('');
  const [department, setDepartment] = useState('Bahagian Perolehan & Pengurusan Aset');
  const [applicantName, setApplicantName] = useState('En. Shahril bin Wirman');
  const [category, setCategory] = useState<'BEKALAN' | 'PERKHIDMATAN' | 'KERJA'>('BEKALAN');
  const [procurementType, setProcurementType] = useState('Pembelian Terus Perkakasan ICT & Peralatan Pejabat');
  const [justification, setJustification] = useState(
    'Penggantian dan pembekalan perkakasan komputer dan pencetak bagi melancarkan operasi kaunter khidmat pekebun kecil dan tugasan rasmi pejabat.'
  );
  const [priority, setPriority] = useState<'Biasa' | 'Segera'>('Biasa');
  const [requiredDate, setRequiredDate] = useState('');
  const [allocationCode, setAllocationCode] = useState('B62-020101-1002');
  const [allocationList, setAllocationList] = useState<any[]>([]);

  // B. Maklumat Barang / Perkhidmatan (User's Exact Example as Default)
  const [items, setItems] = useState<DirectAwardItem[]>([
    {
      id: '1',
      item: 'Komputer',
      specs: 'i5 / 16GB / 512GB',
      qty: 5,
      unit: 'Unit',
      price: 3000,
      total: 15000
    },
    {
      id: '2',
      item: 'Printer',
      specs: 'Laser',
      qty: 2,
      unit: 'Unit',
      price: 1000,
      total: 2000
    }
  ]);

  // C. Dokumen Sokongan
  const [documents, setDocuments] = useState<AttachedDoc[]>([
    {
      id: 'doc-1',
      type: 'spesifikasi',
      title: 'Spesifikasi teknikal',
      fileName: 'Spesifikasi_Teknikal_Komputer_Printer_2026.pdf',
      fileSize: '1.4 MB',
      isAttached: true,
      required: true
    },
    {
      id: 'doc-2',
      type: 'justifikasi',
      title: 'Justifikasi',
      fileName: 'Memo_Justifikasi_Penggantian_Aset_PRD.pdf',
      fileSize: '650 KB',
      isAttached: true,
      required: true
    },
    {
      id: 'doc-3',
      type: 'sebutharga',
      title: 'Sebut harga/rujukan harga jika ada',
      fileName: 'Kajian_Pasaran_Sebut_Harga_Rujukan.pdf',
      fileSize: '2.1 MB',
      isAttached: true,
      required: false
    },
    {
      id: 'doc-4',
      type: 'dokumen_lain',
      title: 'Dokumen lain',
      fileName: 'Salinan_Buku_Vot_Peruntukan_2026.pdf',
      fileSize: '890 KB',
      isAttached: true,
      required: false
    }
  ]);

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize values when opened
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      setRequestDate(today);

      // Auto-generate No. Permohonan
      const randomDigits = Math.floor(100 + Math.random() * 900);
      const generatedNo = `TT/RISDA/${new Date().getFullYear()}/${randomDigits}`;
      setOrderNo(generatedNo);

      // Calculate required date (+14 days)
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 14);
      setRequiredDate(targetDate.toISOString().split('T')[0]);

      // Set user info
      if (user?.displayName) {
        setApplicantName(user.displayName);
      } else if (profile?.name) {
        setApplicantName(profile.name);
      }

      if (profile?.office || profile?.district) {
        setDepartment(`Pejabat RISDA Daerah ${profile.district || profile.office || 'Beaufort'}`);
      }

      if (initialAllocationCode) {
        setAllocationCode(initialAllocationCode);
      }
    }
  }, [isOpen, user, profile, initialAllocationCode]);

  // Load Allocation Codes from Firestore
  useEffect(() => {
    async function loadVots() {
      try {
        const snap = await getDocs(collection(db, 'allocationCodes'));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (list.length > 0) {
          setAllocationList(list);
        }
      } catch (e) {}
    }
    loadVots();
  }, []);

  // Auto-calculation: Kuantiti x Anggaran Harga = Jumlah
  const totalAmount = useMemo(() => {
    return items.reduce((acc, curr) => acc + (curr.total || 0), 0);
  }, [items]);

  // Ceiling check (AP 173 / 1PP PK 2)
  const ceilingLimit = category === 'KERJA' ? 100000 : 50000;
  const isWithinCeiling = totalAmount <= ceilingLimit && totalAmount > 0;

  // Item Handlers
  const handleAddItem = () => {
    const newItem: DirectAwardItem = {
      id: String(Date.now()),
      item: '',
      specs: '',
      qty: 1,
      unit: 'Unit',
      price: 0,
      total: 0
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      toast.error('Borang perlu mempunyai sekurang-kurangnya 1 item barang/perkhidmatan.');
      return;
    }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleItemChange = (id: string, field: keyof DirectAwardItem, val: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      const updated = { ...item, [field]: val };
      if (field === 'qty' || field === 'price') {
        const q = field === 'qty' ? Number(val) || 0 : item.qty;
        const p = field === 'price' ? Number(val) || 0 : item.price;
        // Sistem mengira automatik: Kuantiti × Anggaran Harga = Jumlah
        updated.total = q * p;
      }
      return updated;
    }));
  };

  // Toggle Document Attachment
  const handleToggleDoc = (docId: string) => {
    setDocuments(prev => prev.map(d => {
      if (d.id === docId) {
        return { ...d, isAttached: !d.isAttached };
      }
      return d;
    }));
  };

  // Handle Mock File Upload for Docs
  const handleFileUpload = (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    setDocuments(prev => prev.map(d => {
      if (d.id === docId) {
        return {
          ...d,
          fileName: file.name,
          fileSize: sizeStr,
          isAttached: true
        };
      }
      return d;
    }));
    toast.success(`Dokumen "${file.name}" berjaya dilampirkan!`);
  };

  // Save / Submit logic
  const handleSaveOrSubmit = async (targetStatus: 'DRAF' | 'PERMOHONAN BAHARU') => {
    if (items.some(i => !i.item.trim())) {
      toast.error('Sila lengkapkan butiran barang/perkhidmatan dalam jadual.');
      return;
    }

    if (totalAmount <= 0) {
      toast.error('Jumlah anggaran perolehan mestilah melebihi RM 0.00.');
      return;
    }

    if (totalAmount > ceilingLimit) {
      toast.error(`Jumlah anggaran (RM ${totalAmount.toLocaleString()}) melebihi had siling Tawaran Terus bagi ${category} (RM ${ceilingLimit.toLocaleString()})! Sila kurangkan atau laksanakan sebut harga.`);
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(targetStatus === 'DRAF' ? 'Menyimpan draf permohonan...' : 'Menghantar permohonan baharu...');

    try {
      const payload = {
        orderNo,
        title: items[0]?.item ? `PEROLEHAN ${category} - ${items.map(i => i.item).join(', ').toUpperCase()}` : 'PEROLEHAN TAWARAN TERUS',
        category,
        procurementType,
        department,
        pegawaiPemohon: applicantName,
        kaedahPerolehan: 'Tawaran Terus (1PP PK 2 / AP 173)',
        justifikasi: justification,
        perihalPerolehan: justification,
        keutamaan: priority,
        tarikhDiperlukan: requiredDate,
        requestDate,
        allocationCode,
        estimatedAmount: totalAmount,
        status: targetStatus,
        statusWorkflow: targetStatus === 'DRAF' ? 'draf' : 'permohonan baharu',
        workflowHistory: [
          {
            status: targetStatus,
            date: new Date().toISOString(),
            actor: applicantName,
            note: targetStatus === 'DRAF' ? 'Draf permohonan disimpan' : 'Permohonan baharu didaftarkan dan dihantar'
          }
        ],
        items: items.map((it, idx) => ({
          bil: idx + 1,
          description: it.item,
          specs: it.specs,
          quantity: it.qty,
          unit: it.unit,
          unitPrice: it.price,
          totalPrice: it.total,
          jumlahHarga: it.total
        })),
        documents: documents.filter(d => d.isAttached).map(d => ({
          type: d.type,
          title: d.title,
          fileName: d.fileName,
          fileSize: d.fileSize
        })),
        module: 'tawaran_terus',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user?.uid || 'staff',
        createdEmail: user?.email || '',
        aiCompliance: 98
      };

      const docRef = await addDoc(collection(db, 'order_requests'), payload);

      if (targetStatus === 'DRAF') {
        toast.success(`Draf berjaya disimpan! No. Rujukan: ${orderNo}`, { id: toastId });
      } else {
        toast.success(`Permohonan berjaya dihantar! Status: Permohonan Baharu (${orderNo})`, { id: toastId });
      }

      if (onSuccess) {
        onSuccess(docRef.id, targetStatus);
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving direct award request:', err);
      toast.error('Ralat ketika menyimpan permohonan: ' + (err?.message || 'Sila cuba lagi'), { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
          onClick={onClose} 
        />

        {/* Modal Window */}
        <div className="relative bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-white/10 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh] animate-in fade-in zoom-in-95 duration-200">
          
          {/* HEADER */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white p-5 sm:p-6 border-b border-amber-500/20 relative">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-inner">
                  <FileText size={22} className="stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                      BORANG PEROLEHAN 1PP PK 2
                    </span>
                    <span className="text-[11px] text-slate-300 font-bold uppercase tracking-wide">
                      KAEDAH TAWARAN TERUS
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight mt-1 flex items-center gap-2 font-poppins">
                    📝 PERMOHONAN BAHARU
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Tutup Borang"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* FORM BODY */}
          <div className="p-5 sm:p-6 md:p-8 overflow-y-auto space-y-8 flex-1 text-slate-800 dark:text-slate-100">
            
            {/* ========================================================= */}
            {/* A. MAKLUMAT PERMOHONAN                                    */}
            {/* ========================================================= */}
            <section className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm">
                    A
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Maklumat Permohonan
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                  Langkah 1: Profil & Keperluan
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {/* 1. No. Permohonan — dijana automatik */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>No. Permohonan</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      Dijana Automatik
                    </span>
                  </label>
                  <input
                    type="text"
                    value={orderNo}
                    readOnly
                    className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-black text-amber-500 font-mono tracking-wider cursor-not-allowed"
                  />
                </div>

                {/* 2. Tarikh Permohonan — automatik */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Tarikh Permohonan</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      Automatik
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={requestDate}
                      readOnly
                      className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-not-allowed"
                    />
                    <Calendar size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* 3. Bahagian / Unit — pilihan */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Bahagian / Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/15 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Bahagian Perolehan & Pengurusan Aset">Bahagian Perolehan & Pengurusan Aset</option>
                    <option value="Bahagian Pentadbiran & Kewangan">Bahagian Pentadbiran & Kewangan</option>
                    <option value="Unit Pembangunan Pekebun Kecil">Unit Pembangunan Pekebun Kecil</option>
                    <option value="Unit Tanaman Semula">Unit Tanaman Semula</option>
                    <option value="Unit Khidmat Pengurusan">Unit Khidmat Pengurusan</option>
                    <option value="Pejabat RISDA Daerah Beaufort">Pejabat RISDA Daerah Beaufort</option>
                    <option value="Pejabat RISDA Daerah Keningau">Pejabat RISDA Daerah Keningau</option>
                    <option value="Pejabat RISDA Daerah Tenom">Pejabat RISDA Daerah Tenom</option>
                    <option value="Pejabat RISDA Daerah Papar">Pejabat RISDA Daerah Papar</option>
                    <option value="Pejabat RISDA Daerah Sipitang">Pejabat RISDA Daerah Sipitang</option>
                  </select>
                </div>

                {/* 4. Pegawai Pemohon — automatik/pilihan */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Pegawai Pemohon</span>
                    <span className="text-[10px] text-blue-500 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded">
                      Automatik / Pilihan
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="Nama Pegawai Pemohon"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/15 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                    <User size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* 5. Kategori Perolehan — pilihan */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Kategori Perolehan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/15 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="BEKALAN">Bekalan (Had Siling: RM 50,000)</option>
                    <option value="PERKHIDMATAN">Perkhidmatan (Had Siling: RM 50,000)</option>
                    <option value="KERJA">Kerja (Had Siling: RM 100,000)</option>
                  </select>
                </div>

                {/* 6. Jenis Perolehan — pilihan */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Jenis Perolehan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={procurementType}
                    onChange={(e) => setProcurementType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/15 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Pembelian Terus Perkakasan ICT & Peralatan Pejabat">Pembelian Terus Perkakasan ICT & Peralatan Pejabat</option>
                    <option value="Penyelenggaraan / Pembaikan Pendingin Hawa & Elektrikal">Penyelenggaraan / Pembaikan Pendingin Hawa & Elektrikal</option>
                    <option value="Kerja-Kerja Pembaikan Kecil Bangunan & Fasiliti Awam">Kerja-Kerja Pembaikan Kecil Bangunan & Fasiliti Awam</option>
                    <option value="Pembekalan Bahan Percetakan, Kertas & Alat Tulis Rasmi">Pembekalan Bahan Percetakan, Kertas & Alat Tulis Rasmi</option>
                    <option value="Perkhidmatan Kebersihan & Kawalan Keselamatan">Perkhidmatan Kebersihan & Kawalan Keselamatan</option>
                    <option value="Sewaan Mesin Penyalin & Peralatan">Sewaan Mesin Penyalin & Peralatan</option>
                    <option value="Lain-lain Perolehan Terus (1PP PK 2)">Lain-lain Perolehan Terus (1PP PK 2)</option>
                  </select>
                </div>

                {/* 7. Kaedah Perolehan — Tawaran Terus */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Kaedah Perolehan
                  </label>
                  <div className="w-full px-3.5 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-black text-amber-500 uppercase flex items-center justify-between">
                    <span>Tawaran Terus</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 font-bold">1PP PK 2 / AP 173</span>
                  </div>
                </div>

                {/* 9. Keutamaan — Biasa / Segera */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Keutamaan
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPriority('Biasa')}
                      className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        priority === 'Biasa'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                          : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-white/10 hover:border-slate-400'
                      }`}
                    >
                      <span>🟢 Biasa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority('Segera')}
                      className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        priority === 'Segera'
                          ? 'bg-rose-500 text-white border-rose-400 shadow-sm'
                          : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-white/10 hover:border-slate-400'
                      }`}
                    >
                      <span>🔴 Segera</span>
                    </button>
                  </div>
                </div>

                {/* 10. Tarikh Diperlukan */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Tarikh Diperlukan <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={requiredDate}
                      onChange={(e) => setRequiredDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/15 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                    <Calendar size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* 8. Justifikasi Permohonan — ruangan teks */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Justifikasi Permohonan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Nyatakan sebab dan keperluan perolehan dibuat secara Tawaran Terus..."
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/15 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Kod Vot / Peruntukan */}
              <div className="pt-2 border-t border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Coins size={15} className="text-amber-500" />
                  <span>Kod Vot / Kawalan Peruntukan:</span>
                </div>
                <div className="sm:w-72">
                  <select
                    value={allocationCode}
                    onChange={(e) => setAllocationCode(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/15 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 font-mono"
                  >
                    <option value="B62-020101-1002">B62-020101-1002 (Perolehan Bahan Peralatan & ICT)</option>
                    <option value="B21-010203-2001">B21-010203-2001 (Penyelenggaraan Bangunan & Pendingin Hawa)</option>
                    <option value="B11-030401-3001">B11-030401-3001 (Kerja Pembaikan Kecil Kuarters)</option>
                  </select>
                </div>
              </div>
            </section>


            {/* ========================================================= */}
            {/* B. MAKLUMAT BARANG / PERKHIDMATAN                         */}
            {/* ========================================================= */}
            <section className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm">
                    B
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Maklumat Barang / Perkhidmatan
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Sistem mengira automatik: <strong className="text-amber-500">Kuantiti × Anggaran Harga = Jumlah</strong> dan semua item dijumlahkan secara automatik.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Plus size={14} className="stroke-[3]" />
                  <span>Tambah Item</span>
                </button>
              </div>

              {/* TABLE */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900/80 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider">
                      <th className="py-3 px-3 w-12 text-center">Bil.</th>
                      <th className="py-3 px-3 min-w-[150px]">Butiran</th>
                      <th className="py-3 px-3 min-w-[180px]">Spesifikasi</th>
                      <th className="py-3 px-3 w-24 text-center">Kuantiti</th>
                      <th className="py-3 px-3 w-24 text-center">Unit</th>
                      <th className="py-3 px-3 w-36 text-right">Anggaran Harga</th>
                      <th className="py-3 px-3 w-36 text-right">Jumlah</th>
                      <th className="py-3 px-2 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {items.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                        {/* Bil */}
                        <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>

                        {/* Butiran */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={row.item}
                            onChange={(e) => handleItemChange(row.id, 'item', e.target.value)}
                            placeholder="Contoh: Komputer"
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                          />
                        </td>

                        {/* Spesifikasi */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={row.specs}
                            onChange={(e) => handleItemChange(row.id, 'specs', e.target.value)}
                            placeholder="Contoh: i5 / 16GB / 512GB"
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:border-amber-500"
                          />
                        </td>

                        {/* Kuantiti */}
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="1"
                            value={row.qty}
                            onChange={(e) => handleItemChange(row.id, 'qty', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-black text-center text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                          />
                        </td>

                        {/* Unit */}
                        <td className="py-2.5 px-3">
                          <select
                            value={row.unit}
                            onChange={(e) => handleItemChange(row.id, 'unit', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 text-center focus:outline-none focus:border-amber-500"
                          >
                            <option value="Unit">Unit</option>
                            <option value="Lot">Lot</option>
                            <option value="Pakej">Pakej</option>
                            <option value="Keping">Keping</option>
                            <option value="Rim">Rim</option>
                            <option value="Kotak">Kotak</option>
                            <option value="Set">Set</option>
                          </select>
                        </td>

                        {/* Anggaran Harga */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">RM</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.price}
                              onChange={(e) => handleItemChange(row.id, 'price', e.target.value)}
                              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-right text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                            />
                          </div>
                        </td>

                        {/* Jumlah (Kuantiti x Anggaran Harga) */}
                        <td className="py-2.5 px-3 text-right font-mono font-black text-amber-500 text-xs">
                          RM {row.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Tindakan */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(row.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Padam Baris"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* TOTAL CALCULATION BOX */}
              <div className="bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black uppercase">
                      Pengiraan Automatik
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                      Kuantiti × Anggaran Harga = Jumlah
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Had Ambang Siling Rasmi Tawaran Terus (1PP PK 2): 
                    <strong className="text-slate-800 dark:text-slate-200 ml-1">
                      RM {ceilingLimit.toLocaleString()} ({category})
                    </strong>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Jumlah Anggaran:
                  </span>
                  <span className="text-2xl font-black text-amber-500 font-mono tracking-tight">
                    RM {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {isWithinCeiling ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 size={12} /> Mematuhi Had Siling AP 173
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 mt-0.5">
                      <AlertTriangle size={12} /> Melebihi Had Siling ({category})!
                    </span>
                  )}
                </div>
              </div>
            </section>


            {/* ========================================================= */}
            {/* C. DOKUMEN SOKONGAN                                       */}
            {/* ========================================================= */}
            <section className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm">
                    C
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Dokumen Sokongan
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Lampirkan dokumen berkaitan bagi tujuan semakan integriti dan kelulusan Ketua PTJ.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {documents.map((docItem) => (
                  <div 
                    key={docItem.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      docItem.isAttached 
                        ? 'bg-white dark:bg-slate-950 border-amber-500/40 shadow-sm'
                        : 'bg-white/50 dark:bg-slate-950/40 border-slate-200 dark:border-white/5'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-amber-500 text-base mt-0.5">📎</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                            {docItem.title}
                          </span>
                          {docItem.required && (
                            <span className="text-[10px] text-rose-500 font-bold">*Wajib</span>
                          )}
                        </div>
                        {docItem.isAttached && docItem.fileName ? (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                            <span className="text-emerald-500 font-bold truncate max-w-[180px]">
                              {docItem.fileName}
                            </span>
                            <span>• {docItem.fileSize}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Belum dilampirkan</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase rounded-lg cursor-pointer transition-colors flex items-center gap-1">
                        <UploadCloud size={12} />
                        <span>Pilih</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleFileUpload(docItem.id, e)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleToggleDoc(docItem.id)}
                        className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          docItem.isAttached
                            ? 'text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20'
                            : 'text-slate-400 bg-slate-100 dark:bg-white/5 hover:text-slate-600'
                        }`}
                        title={docItem.isAttached ? 'Nyah-lampirkan' : 'Tandakan telah dilampir'}
                      >
                        <CheckCircle2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>


            {/* ========================================================= */}
            {/* D. TINDAKAN (ACTION BUTTONS)                              */}
            {/* ========================================================= */}
            <section className="bg-slate-900 text-white rounded-2xl p-5 border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-black">
                      D
                    </span>
                    Tindakan Pengurusan
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Selepas tekan <strong>Hantar Permohonan</strong>, status menjadi: 
                    <span className="text-amber-300 font-bold ml-1">
                      permohonan baharu ➔ dalam proses ➔ menunggu kelulusan ➔ selesai / batal
                    </span>
                  </p>
                </div>
              </div>

              {/* THE 4 REQUIRED BUTTONS */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-white/10">
                {/* [💾 Simpan Draf] */}
                <button
                  type="button"
                  onClick={() => handleSaveOrSubmit('DRAF')}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Save size={15} className="text-amber-400" />
                  <span>💾 Simpan Draf</span>
                </button>

                {/* [👁 Pratonton] */}
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  <Eye size={15} className="text-blue-400" />
                  <span>👁 Pratonton</span>
                </button>

                {/* [📤 Hantar Permohonan] */}
                <button
                  type="button"
                  onClick={() => handleSaveOrSubmit('PERMOHONAN BAHARU')}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  <Send size={15} className="stroke-[2.5]" />
                  <span>📤 Hantar Permohonan</span>
                </button>

                {/* [✖ Batal] */}
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2"
                >
                  <X size={15} />
                  <span>✖ Batal</span>
                </button>
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL PRATONTON (OFFICIAL FORM PREVIEW)                   */}
      {/* ========================================================= */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/85 backdrop-blur-md">
          <div className="bg-white text-slate-900 border border-slate-300 w-full max-w-4xl rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 my-auto max-h-[92vh] overflow-y-auto">
            
            {/* Action Bar */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-amber-500 text-slate-950 font-black text-xs uppercase rounded-md">
                  Pratonton Rasmi
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  Borang Permohonan Tawaran Terus (AP 173 / 1PP PK 2)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={14} /> Cetak
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Document Header */}
            <div className="text-center space-y-1 border-b-2 border-slate-900 pb-4">
              <div className="font-bold text-xs uppercase tracking-wider text-slate-700">
                PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH (RISDA)
              </div>
              <div className="text-lg font-black uppercase text-slate-900 tracking-tight">
                BORANG PERMOHONAN PEROLEHAN TAWARAN TERUS KERAJAAN
              </div>
              <div className="text-[11px] font-bold text-slate-600">
                (Tatacara Perolehan Bekalan, Perkhidmatan & Kerja di bawah AP 173 & 1PP PK 2)
              </div>
            </div>

            {/* Meta Info Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 font-bold block">No. Permohonan:</span>
                <span className="font-mono font-black text-amber-600 text-sm">{orderNo}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block">Tarikh Permohonan:</span>
                <span className="font-bold text-slate-800">{requestDate}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block">Bahagian / Unit:</span>
                <span className="font-bold text-slate-800">{department}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block">Pegawai Pemohon:</span>
                <span className="font-bold text-slate-800">{applicantName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block">Kategori & Kaedah:</span>
                <span className="font-bold text-slate-800">{category} • Tawaran Terus</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block">Keutamaan & Tarikh Diperlukan:</span>
                <span className="font-bold text-slate-800">{priority} • {requiredDate}</span>
              </div>
            </div>

            {/* Justification Box */}
            <div className="text-xs space-y-1">
              <span className="font-black uppercase text-slate-700 block">Justifikasi Permohonan:</span>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 italic text-slate-700">
                "{justification}"
              </div>
            </div>

            {/* Table of Items */}
            <div className="space-y-2">
              <span className="font-black uppercase text-xs text-slate-700 block">
                Senarai Barang / Perkhidmatan & Anggaran Harga:
              </span>
              <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                    <th className="p-2 border-r border-slate-300 text-center w-10">Bil.</th>
                    <th className="p-2 border-r border-slate-300">Butiran</th>
                    <th className="p-2 border-r border-slate-300">Spesifikasi</th>
                    <th className="p-2 border-r border-slate-300 text-center w-16">Kuantiti</th>
                    <th className="p-2 border-r border-slate-300 text-center w-16">Unit</th>
                    <th className="p-2 border-r border-slate-300 text-right w-28">Harga Unit (RM)</th>
                    <th className="p-2 text-right w-28">Jumlah (RM)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((it, idx) => (
                    <tr key={it.id}>
                      <td className="p-2 text-center border-r border-slate-200">{idx + 1}</td>
                      <td className="p-2 font-bold border-r border-slate-200">{it.item}</td>
                      <td className="p-2 text-slate-600 border-r border-slate-200">{it.specs}</td>
                      <td className="p-2 text-center border-r border-slate-200 font-mono">{it.qty}</td>
                      <td className="p-2 text-center border-r border-slate-200">{it.unit}</td>
                      <td className="p-2 text-right border-r border-slate-200 font-mono">
                        {it.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-right font-mono font-bold">
                        {it.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                    <td colSpan={6} className="p-2.5 text-right uppercase">
                      Jumlah Keseluruhan Anggaran:
                    </td>
                    <td className="p-2.5 text-right font-mono text-amber-600 text-sm">
                      RM {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Attached Documents */}
            <div className="text-xs space-y-1">
              <span className="font-black uppercase text-slate-700 block">Dokumen Sokongan Dilampirkan:</span>
              <ul className="list-disc pl-5 space-y-0.5 text-slate-600">
                {documents.filter(d => d.isAttached).map(d => (
                  <li key={d.id}>
                    <strong>{d.title}</strong>: {d.fileName} ({d.fileSize})
                  </li>
                ))}
              </ul>
            </div>

            {/* Signature Blocks */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-300 text-center text-xs">
              <div className="space-y-8">
                <span className="font-bold text-slate-600">Disediakan Oleh:</span>
                <div className="border-t border-dashed border-slate-400 pt-1">
                  <div className="font-bold">{applicantName}</div>
                  <div className="text-[10px] text-slate-500">Pegawai Pemohon</div>
                </div>
              </div>
              <div className="space-y-8">
                <span className="font-bold text-slate-600">Disemak Oleh:</span>
                <div className="border-t border-dashed border-slate-400 pt-1">
                  <div className="font-bold">Pegawai Penyemak / Kewangan</div>
                  <div className="text-[10px] text-slate-500">Unit Perolehan PRD</div>
                </div>
              </div>
              <div className="space-y-8">
                <span className="font-bold text-slate-600">Diluluskan Oleh:</span>
                <div className="border-t border-dashed border-slate-400 pt-1">
                  <div className="font-bold">Ketua PTJ / Pegawai Daerah</div>
                  <div className="text-[10px] text-slate-500">Pejabat RISDA Daerah</div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-slate-800 text-white font-bold text-xs uppercase rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Tutup Pratonton
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
