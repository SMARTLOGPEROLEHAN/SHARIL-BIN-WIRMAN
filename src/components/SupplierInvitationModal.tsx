import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  CheckSquare, 
  Square, 
  Mail, 
  Phone, 
  Calendar, 
  Clock, 
  DollarSign, 
  Building2, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  UserCheck, 
  Sparkles,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

export type PelawaanStatus = 
  | 'Pelawaan Dihantar' 
  | 'Belum Jawab' 
  | 'Tawaran Diterima' 
  | 'Tidak Menyertai' 
  | 'Tawaran Tamat Tempoh';

export interface PelawaanSupplierItem {
  id: string;
  supplierName: string;
  email: string;
  phone?: string;
  selected: boolean;
  status: PelawaanStatus;
  sentDate?: string;
  bidDate?: string;
  amount?: number;
  quotationRef?: string;
  deliveryPeriod?: string;
  validityDays?: number;
  isCompliant?: boolean;
  notes?: string;
  items?: Array<{
    item: string;
    qty: number;
    unit: string;
    price: number;
    total: number;
  }>;
}

interface SupplierInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: {
    id: string;
    orderNo: string;
    title: string;
    estimatedAmount: number;
    category?: string;
    pelawaanSuppliers?: PelawaanSupplierItem[];
    rfqDate?: string;
    rfqDeadline?: string;
    rfqClosingTime?: string;
  } | null;
  onSendInvitation: (invitationData: {
    recordId: string;
    suppliers: PelawaanSupplierItem[];
    rfqDate: string;
    rfqDeadline: string;
    rfqClosingTime: string;
  }) => void;
}

const DEFAULT_SUPPLIERS: PelawaanSupplierItem[] = [
  {
    id: 'sup-abc',
    supplierName: 'ABC ENTERPRISE',
    email: 'abcenterprise@gmail.com',
    phone: '019-8233441',
    selected: true,
    status: 'Tawaran Diterima',
    sentDate: '02/10/2026',
    bidDate: '04/10/2026',
    amount: 8250,
    quotationRef: 'QTN/ABC/2026/088',
    deliveryPeriod: '5 Hari Bekerja',
    validityDays: 30,
    isCompliant: true,
    notes: 'Harga berpatutan dan mematuhi spesifikasi sepenuhnya.',
    items: [
      { item: 'Kertas A4 80gsm (100 rim)', qty: 100, unit: 'Rim', price: 14.50, total: 1450 },
      { item: 'Pen Ballpoint & Alat Tulis', qty: 50, unit: 'Kotak', price: 28.00, total: 1400 },
      { item: 'Toner Pencetak Laser Original', qty: 6, unit: 'Unit', price: 900.00, total: 5400 }
    ]
  },
  {
    id: 'sup-xyz',
    supplierName: 'XYZ TRADING',
    email: 'xyztrading@gmail.com',
    phone: '013-8877112',
    selected: true,
    status: 'Belum Jawab',
    sentDate: '02/10/2026',
    notes: 'Pelawaan telah dihantar melalui email rasmi. Menunggu maklum balas pembekal.'
  },
  {
    id: 'sup-sabah-maju',
    supplierName: 'SABAH MAJU SDN BHD',
    email: 'sabahmaju@gmail.com',
    phone: '012-7766554',
    selected: true,
    status: 'Tawaran Diterima',
    sentDate: '02/10/2026',
    bidDate: '05/10/2026',
    amount: 8400,
    quotationRef: 'SM/QTN/2026/041',
    deliveryPeriod: '7 Hari Bekerja',
    validityDays: 30,
    isCompliant: true,
    notes: 'Kualiti barangan disahkan standard Jabatan.',
    items: [
      { item: 'Kertas A4 80gsm (100 rim)', qty: 100, unit: 'Rim', price: 15.00, total: 1500 },
      { item: 'Pen Ballpoint & Alat Tulis', qty: 50, unit: 'Kotak', price: 30.00, total: 1500 },
      { item: 'Toner Pencetak Laser Original', qty: 6, unit: 'Unit', price: 900.00, total: 5400 }
    ]
  }
];

export default function SupplierInvitationModal({
  isOpen,
  onClose,
  record,
  onSendInvitation
}: SupplierInvitationModalProps) {
  const [suppliers, setSuppliers] = useState<PelawaanSupplierItem[]>(DEFAULT_SUPPLIERS);
  const [rfqDate, setRfqDate] = useState('02/10/2026');
  const [rfqDeadline, setRfqDeadline] = useState('07/10/2026');
  const [rfqClosingTime, setRfqClosingTime] = useState('5:00 Petang');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');

  // Auto-init dates and suppliers on open
  useEffect(() => {
    if (isOpen) {
      if (record?.pelawaanSuppliers && record.pelawaanSuppliers.length > 0) {
        setSuppliers(record.pelawaanSuppliers);
      } else {
        setSuppliers(DEFAULT_SUPPLIERS);
      }

      if (record?.rfqDate) {
        setRfqDate(record.rfqDate);
      } else {
        setRfqDate('02/10/2026');
      }

      if (record?.rfqDeadline) {
        setRfqDeadline(record.rfqDeadline);
      } else {
        setRfqDeadline('07/10/2026');
      }

      if (record?.rfqClosingTime) {
        setRfqClosingTime(record.rfqClosingTime);
      } else {
        setRfqClosingTime('5:00 Petang');
      }
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const toggleSupplier = (id: string) => {
    setSuppliers(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, selected: !s.selected };
      }
      return s;
    }));
  };

  const handleAddCustomSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim() || !newSupplierEmail.trim()) {
      toast.error('Sila masukkan nama syarikat dan emel pembekal.');
      return;
    }

    const newSup: PelawaanSupplierItem = {
      id: `sup-${Date.now()}`,
      supplierName: newSupplierName.trim().toUpperCase(),
      email: newSupplierEmail.trim().toLowerCase(),
      selected: true,
      status: 'Pelawaan Dihantar',
      sentDate: rfqDate
    };

    setSuppliers(prev => [...prev, newSup]);
    setNewSupplierName('');
    setNewSupplierEmail('');
    setShowAddCustom(false);
    toast.success(`Pembekal ${newSup.supplierName} ditambah ke senarai pelawaan!`);
  };

  const selectedCount = suppliers.filter(s => s.selected).length;

  const handleSend = () => {
    const selectedSuppliers = suppliers.filter(s => s.selected);
    if (selectedSuppliers.length === 0) {
      toast.error('Sila pilih sekurang-kurangnya 1 pembekal (Disyorkan 3 pembekal bagi kajian harga pasaran).');
      return;
    }

    if (selectedSuppliers.length < 3) {
      toast('Perhatian: Tatacara AP 173 mencadangkan kajian pasaran minimum kepada 3 pembekal.', {
        icon: '⚠️',
        duration: 4000
      });
    }

    onSendInvitation({
      recordId: record.id,
      suppliers: selectedSuppliers.map(s => ({
        ...s,
        status: s.status || 'Pelawaan Dihantar',
        sentDate: rfqDate
      })),
      rfqDate,
      rfqDeadline,
      rfqClosingTime
    });

    toast.success(`Pelawaan berjaya dihantar kepada ${selectedSuppliers.length} pembekal terpilih!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Box matching exact ASCII specification */}
      <div className="relative bg-white dark:bg-[#0c1322] border-2 border-amber-500/40 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 text-slate-800 dark:text-slate-100">
        
        {/* HEADER: PELAWA 3 PEMBEKAL */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 p-5 sm:p-6 text-white border-b border-amber-500/30 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="px-3 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-widest">
              1PP PK 2 • KAJIAN PASARAN TAWARAN TERUS
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-center text-white tracking-tight uppercase font-poppins flex items-center justify-center gap-2">
            📢 PELAWA 3 PEMBEKAL
          </h2>
          <p className="text-center text-xs text-amber-300/80 font-medium mt-1">
            Pelawaan tawaran harga rasmi bagi perolehan yang telah diluluskan
          </p>
        </div>

        {/* BODY CONTAINER */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
          
          {/* 1. MAKLUMAT PERMOHONAN HEADER CARD */}
          <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-2 font-mono">
            <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-white/5">
              <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">No. Permohonan :</span>
              <span className="font-black text-amber-500 text-sm">{record.orderNo}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-white/5">
              <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">Perolehan :</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-right truncate max-w-[260px]">
                {record.title}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">Nilai Anggaran :</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                RM {Number(record.estimatedAmount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* 2. PILIH PEMBEKAL SECTION */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-1.5">
                <Building2 size={15} className="text-amber-500" />
                PILIH PEMBEKAL ({selectedCount} Terpilih)
              </span>
              <button
                type="button"
                onClick={() => setShowAddCustom(!showAddCustom)}
                className="text-[11px] text-amber-500 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>Tambah Pembekal</span>
              </button>
            </div>

            {/* Custom Supplier Form (Optional) */}
            {showAddCustom && (
              <form onSubmit={handleAddCustomSupplier} className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-2">
                <span className="text-[11px] font-black uppercase text-amber-500 block">Daftar Pembekal Tambahan:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Nama Syarikat Pembekal"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-lg text-xs font-bold uppercase focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="email"
                    placeholder="Emel Rasmi Pembekal"
                    value={newSupplierEmail}
                    onChange={(e) => setNewSupplierEmail(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddCustom(false)}
                    className="px-2.5 py-1 bg-black/10 dark:bg-white/10 rounded-lg text-[10px] font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-amber-500 text-slate-950 rounded-lg text-[10px] font-black uppercase"
                  >
                    Tambah
                  </button>
                </div>
              </form>
            )}

            {/* List of 3 Suppliers with Checkboxes */}
            <div className="space-y-2.5">
              {suppliers.map((sup) => (
                <div
                  key={sup.id}
                  onClick={() => toggleSupplier(sup.id)}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    sup.selected
                      ? 'bg-amber-500/10 dark:bg-amber-950/20 border-amber-500 text-slate-900 dark:text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 opacity-70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-amber-500">
                      {sup.selected ? (
                        <CheckSquare size={18} className="fill-amber-500 text-slate-950 dark:text-slate-900" />
                      ) : (
                        <Square size={18} className="text-slate-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide">
                        {sup.supplierName}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Mail size={12} className="text-amber-500" /> {sup.email}
                        </span>
                        {sup.phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone size={12} className="text-amber-500" /> {sup.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 shrink-0">
                    {sup.selected ? 'Dipilih' : 'Tidak'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. DATES & TIME SECTION */}
          <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar size={13} className="text-amber-500" /> Tarikh Pelawaan :
                </label>
                <input
                  type="text"
                  value={rfqDate}
                  onChange={(e) => setRfqDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar size={13} className="text-amber-500" /> Tarikh Tutup :
                </label>
                <input
                  type="text"
                  value={rfqDeadline}
                  onChange={(e) => setRfqDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Clock size={13} className="text-amber-500" /> Masa Tutup :
                </label>
                <input
                  type="text"
                  value={rfqClosingTime}
                  onChange={(e) => setRfqClosingTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* 4. ACTION BUTTON: [ HANTAR PELAWAAN ] */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSend}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/25 hover:scale-[1.01] active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Send size={16} className="stroke-[2.5]" />
              <span>[ HANTAR PELAWAAN ]</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-center text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
            >
              Batal
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
