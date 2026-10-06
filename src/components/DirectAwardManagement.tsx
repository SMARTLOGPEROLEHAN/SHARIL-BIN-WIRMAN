import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Sparkles, 
  Package, 
  Briefcase, 
  Hammer, 
  Clock, 
  FileCheck, 
  ShieldCheck, 
  CheckCircle2, 
  X, 
  Printer, 
  Building2, 
  Coins, 
  Calendar,
  AlertCircle,
  FileText,
  Megaphone,
  Inbox,
  Scale,
  Trophy,
  BarChart3,
  Download,
  Trash2,
  Edit2,
  ExternalLink,
  ChevronRight,
  Filter,
  Eye,
  Check,
  Send,
  ArrowRight,
  FileSpreadsheet,
  Layers
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { DEFAULT_DIRECT_AWARD_VOT_CODES } from './DirectAwardBudgetBook';
import NewDirectAwardModal from './NewDirectAwardModal';
import SupplierInvitationModal, { PelawaanSupplierItem, PelawaanStatus } from './SupplierInvitationModal';
import QuotationDetailModal from './QuotationDetailModal';
import SupplierInvitationStatusTable from './SupplierInvitationStatusTable';
import SupplierOffersView from './SupplierOffersView';
import DirectAwardEvaluationView from './DirectAwardEvaluationView';
import DirectAwardSelectionManagement from './DirectAwardSelectionManagement';
import DirectAwardLocalOrderManagement from './DirectAwardLocalOrderManagement';

export type DirectAwardSection = 'permohonan' | 'pelawaan' | 'tawaran' | 'penilaian' | 'pemilihan' | 'pesanan' | 'laporan';

interface DirectAwardRecord {
  id: string;
  orderNo: string;
  poNo?: string;
  title: string;
  category: 'BEKALAN' | 'PERKHIDMATAN' | 'KERJA';
  supplierName: string;
  supplierCode?: string;
  allocationCode: string;
  estimatedAmount: number;
  perihalPerolehan?: string;
  status: 'PERMOHONAN BAHARU' | 'DALAM PROSES' | 'MENUNGGU KELULUSAN' | 'SELESAI' | 'BATAL' | 'DRAF' | 'DALAM SEMAKAN' | 'LULUS' | 'DIBAYAR' | 'DITOLAK';
  financeStatus?: 'BELUM DIHANTAR' | 'DIHANTAR' | 'DIBAYAR';
  requestDate: string;
  unitOffice?: string;
  aiCompliance?: number;
  approvedBy?: string;
  approvedDate?: string;
  loGeneratedDate?: string;
  financeReferenceNo?: string;
  noBaucar?: string;
  // Quotation bids / Market Survey
  quotations?: {
    supplierName: string;
    contact?: string;
    amount: number;
    dateReceived: string;
    isWinner?: boolean;
    isCompliant?: boolean;
    status: 'LENGKAP' | 'MENUNGGU' | 'TIDAK_LENGKAP';
    notes?: string;
  }[];
  // Pelawaan / RFQ
  rfqDate?: string;
  rfqDeadline?: string;
  rfqClosingTime?: string;
  rfqStatus?: 'AKTIF' | 'TAMAT' | 'DRAF';
  pelawaanSuppliers?: PelawaanSupplierItem[];
}

const INITIAL_RECORDS: DirectAwardRecord[] = [];

// Section items configuration matching user's exact specification
export const SECTIONS_CONFIG: Record<DirectAwardSection, { title: string; icon: any; tabs: { id: string; label: string }[] }> = {
  permohonan: {
    title: 'PERMOHONAN TAWARAN TERUS',
    icon: FileText,
    tabs: [
      { id: 'baharu', label: 'Permohonan Baharu' },
      { id: 'proses', label: 'Dalam Proses' },
      { id: 'kelulusan', label: 'Menunggu Kelulusan' },
      { id: 'selesai', label: 'Selesai' }
    ]
  },
  pelawaan: {
    title: 'PELAWAAN TAWARAN HARGA',
    icon: Megaphone,
    tabs: [
      { id: 'baharu', label: 'Pelawaan Baharu' },
      { id: 'aktif', label: 'Pelawaan Aktif' },
      { id: 'tamat', label: 'Pelawaan Tamat' },
      { id: 'sejarah', label: 'Sejarah Pelawaan' }
    ]
  },
  tawaran: {
    title: 'PENGURUSAN TAWARAN PEMBEKAL',
    icon: Inbox,
    tabs: [
      { id: 'semua', label: 'Semua Tawaran' },
      { id: 'diterima', label: 'Tawaran Diterima' },
      { id: 'menunggu', label: 'Menunggu Tawaran' },
      { id: 'tidak-lengkap', label: 'Tawaran Tidak Lengkap' }
    ]
  },
  penilaian: {
    title: 'PENILAIAN & KAJIAN PASARAN',
    icon: Scale,
    tabs: [
      { id: 'perbandingan', label: 'Perbandingan Tawaran' },
      { id: 'penilaian', label: 'Penilaian Tawaran' },
      { id: 'cadangan', label: 'Cadangan Pembekal' }
    ]
  },
  pemilihan: {
    title: 'PEMILIHAN PEMBEKAL & KELULUSAN',
    icon: Trophy,
    tabs: [
      { id: 'senarai', label: 'Senarai Pemilihan' },
      { id: 'dipilih', label: 'Pembekal Dipilih' },
      { id: 'kelulusan', label: 'Kelulusan PTJ' }
    ]
  },
  pesanan: {
    title: 'PESANAN TEMPATAN / LO KERAJAAN',
    icon: FileCheck,
    tabs: [
      { id: 'jana', label: 'Jana LO' },
      { id: 'dikeluarkan', label: 'LO Dikeluarkan' },
      { id: 'kewangan', label: 'LO Dihantar ke Unit Kewangan' }
    ]
  },
  laporan: {
    title: 'LAPORAN & STATISTIK TAWARAN TERUS',
    icon: BarChart3,
    tabs: [
      { id: 'ringkasan', label: 'Laporan Tawaran Terus' },
      { id: 'pembekal', label: 'Laporan Pembekal' },
      { id: 'perbelanjaan', label: 'Laporan Perbelanjaan' },
      { id: 'lo', label: 'Laporan LO' }
    ]
  }
};

export const WORKFLOW_STAGES: {
  id: DirectAwardSection;
  step: number;
  label: string;
  hint: string;
  icon: any;
}[] = [
  { id: 'permohonan', step: 1, label: 'Permohonan', hint: 'Daftar & Kelulusan', icon: FileText },
  { id: 'pelawaan', step: 2, label: 'Pelawaan', hint: 'Kajian 3 Pembekal', icon: Megaphone },
  { id: 'tawaran', step: 3, label: 'Tawaran Harga', hint: 'Bidaan Pembekal', icon: Inbox },
  { id: 'penilaian', step: 4, label: 'Penilaian', hint: 'Spesifikasi & Harga', icon: Scale },
  { id: 'pemilihan', step: 5, label: 'Pemilihan', hint: 'Perakuan PTJ', icon: Trophy },
  { id: 'pesanan', step: 6, label: 'Pesanan / LO', hint: 'Jana Local Order', icon: FileCheck },
  { id: 'laporan', step: 7, label: 'Laporan', hint: 'Statistik & Vot', icon: BarChart3 }
];

interface Props {
  activeSection?: DirectAwardSection;
  initialTab?: string;
}

export default function DirectAwardManagement({ activeSection = 'permohonan', initialTab }: Props) {
  const { user, role, district } = useAuth();
  const isAdmin = role === 'admin' || role === 'pentadbir';
  const isPelulus = role === 'pelulus' || isAdmin;
  const isPenyemak = role === 'penyemak' || isAdmin;

  // Active section & tab
  const [section, setSection] = useState<DirectAwardSection>(activeSection);
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (initialTab) return initialTab;
    const conf = SECTIONS_CONFIG[activeSection];
    return conf ? conf.tabs[0].id : 'baharu';
  });

  const currentStepIndex = WORKFLOW_STAGES.findIndex(s => s.id === section);
  const nextStage = WORKFLOW_STAGES[currentStepIndex + 1];

  const handleNavigateToSection = (targetSection: DirectAwardSection, targetTab?: string) => {
    setSection(targetSection);
    const conf = SECTIONS_CONFIG[targetSection];
    const defaultTab = targetTab || (conf ? conf.tabs[0].id : 'baharu');
    setActiveTab(defaultTab);
    window.location.hash = defaultTab;
    try {
      window.history.pushState({}, '', `/tt-${targetSection}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {}
  };

  // Records state
  const [records, setRecords] = useState<DirectAwardRecord[]>(INITIAL_RECORDS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('SEMUA');

  // Form states for Permohonan Baharu
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<'BEKALAN' | 'PERKHIDMATAN' | 'KERJA'>('BEKALAN');
  const [formSupplier, setFormSupplier] = useState('');
  const [formSupplierCode, setFormSupplierCode] = useState('');
  const [formVote, setFormVote] = useState('B62-020101-1002');
  const [formAmount, setFormAmount] = useState('');
  const [formJustification, setFormJustification] = useState('');

  // Form states for Pelawaan Baharu
  const [pelawaanTitle, setPelawaanTitle] = useState('');
  const [pelawaanDeadline, setPelawaanDeadline] = useState('');
  const [pelawaanSuppliers, setPelawaanSuppliers] = useState('');
  const [pelawaanCategory, setPelawaanCategory] = useState<'BEKALAN' | 'PERKHIDMATAN' | 'KERJA'>('BEKALAN');

  // Modal states
  const [previewRecord, setPreviewRecord] = useState<DirectAwardRecord | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPelawaanModal, setShowPelawaanModal] = useState(false);
  const [selectedRecordForPelawaan, setSelectedRecordForPelawaan] = useState<DirectAwardRecord | null>(null);
  const [selectedSupplierForQuotation, setSelectedSupplierForQuotation] = useState<PelawaanSupplierItem | null>(null);
  const [showGenerateLOModal, setShowGenerateLOModal] = useState(false);

  // Sync section and tab from props and hash
  useEffect(() => {
    if (activeSection) {
      setSection(activeSection);
      const conf = SECTIONS_CONFIG[activeSection];
      const h = window.location.hash.replace('#', '');
      if (h && conf && conf.tabs.some(t => t.id === h)) {
        setActiveTab(h);
      } else if (conf) {
        setActiveTab(conf.tabs[0].id);
      }
    }
  }, [activeSection]);

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.replace('#', '');
      if (h) setActiveTab(h);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Fetch real records from Firestore if available
  useEffect(() => {
    try {
      const q = query(collection(db, 'order_requests'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const list: DirectAwardRecord[] = [];
          snapshot.docs.forEach(d => {
            const data = d.data();
            const isTT = data.module === 'tawaran_terus';
            if (isTT) {
              list.push({
                id: d.id,
                orderNo: data.orderNo || `KK/BP/TT/2026/${d.id.slice(-4)}`,
                poNo: data.poNo,
                title: data.title || data.perihalPerolehan || 'Tawaran Terus RISDA',
                category: data.category || 'BEKALAN',
                supplierName: data.supplierName || data.pembekalDipilih || 'Pembekal Berdaftar',
                supplierCode: data.supplierCode || (data.category === 'KERJA' ? 'CIDB G1' : 'MOF'),
                allocationCode: data.allocationCode || 'B62-020101-1002',
                estimatedAmount: Number(data.estimatedAmount) || 0,
                perihalPerolehan: data.perihalPerolehan || '',
                status: data.status || 'DALAM SEMAKAN',
                financeStatus: data.financeStatus || 'BELUM DIHANTAR',
                requestDate: data.requestDate || new Date().toISOString().split('T')[0],
                unitOffice: data.unitOffice || `Pejabat RISDA Daerah ${district || 'Beaufort'}`,
                aiCompliance: data.aiCompliance || 95,
                approvedBy: data.approvedBy,
                approvedDate: data.approvedDate,
                loGeneratedDate: data.loGeneratedDate,
                financeReferenceNo: data.financeReferenceNo,
                noBaucar: data.noBaucar,
                quotations: data.quotations || [],
                pelawaanSuppliers: data.pelawaanSuppliers || [],
                rfqDate: data.rfqDate || data.requestDate,
                rfqDeadline: data.rfqDeadline || '2026-04-10',
                rfqStatus: data.rfqStatus || 'AKTIF'
              });
            }
          });
          setRecords(list);
        } else {
          setRecords([]);
        }
      }, () => {});
      return () => unsub();
    } catch (e) {}
  }, [district]);

  // Section items configuration matching user's exact specification
  const sectionsConfig: Record<DirectAwardSection, { title: string; icon: any; tabs: { id: string; label: string }[] }> = {
    permohonan: {
      title: 'PERMOHONAN TAWARAN TERUS',
      icon: FileText,
      tabs: [
        { id: 'baharu', label: 'Permohonan Baharu' },
        { id: 'proses', label: 'Dalam Proses' },
        { id: 'kelulusan', label: 'Menunggu Kelulusan' },
        { id: 'selesai', label: 'Selesai' }
      ]
    },
    pelawaan: {
      title: 'PELAWAAN TAWARAN HARGA',
      icon: Megaphone,
      tabs: [
        { id: 'baharu', label: 'Pelawaan Baharu' },
        { id: 'aktif', label: 'Pelawaan Aktif' },
        { id: 'tamat', label: 'Pelawaan Tamat' },
        { id: 'sejarah', label: 'Sejarah Pelawaan' }
      ]
    },
    tawaran: {
      title: 'PENGURUSAN TAWARAN PEMBEKAL',
      icon: Inbox,
      tabs: [
        { id: 'semua', label: 'Semua Tawaran' },
        { id: 'diterima', label: 'Tawaran Diterima' },
        { id: 'menunggu', label: 'Menunggu Tawaran' },
        { id: 'tidak-lengkap', label: 'Tawaran Tidak Lengkap' }
      ]
    },
    penilaian: {
      title: 'PENILAIAN & KAJIAN PASARAN',
      icon: Scale,
      tabs: [
        { id: 'perbandingan', label: 'Perbandingan Tawaran' },
        { id: 'penilaian', label: 'Penilaian Tawaran' },
        { id: 'cadangan', label: 'Cadangan Pembekal' }
      ]
    },
    pemilihan: {
      title: 'PEMILIHAN PEMBEKAL & KELULUSAN',
      icon: Trophy,
      tabs: [
        { id: 'senarai', label: 'Senarai Pemilihan' },
        { id: 'dipilih', label: 'Pembekal Dipilih' },
        { id: 'kelulusan', label: 'Kelulusan PTJ' }
      ]
    },
    pesanan: {
      title: 'PESANAN TEMPATAN / LO KERAJAAN',
      icon: FileCheck,
      tabs: [
        { id: 'jana', label: 'Jana LO' },
        { id: 'dikeluarkan', label: 'LO Dikeluarkan' },
        { id: 'kewangan', label: 'LO Dihantar ke Unit Kewangan' }
      ]
    },
    laporan: {
      title: 'LAPORAN & STATISTIK TAWARAN TERUS',
      icon: BarChart3,
      tabs: [
        { id: 'ringkasan', label: 'Laporan Tawaran Terus' },
        { id: 'pembekal', label: 'Laporan Pembekal' },
        { id: 'perbelanjaan', label: 'Laporan Perbelanjaan' },
        { id: 'lo', label: 'Laporan LO' }
      ]
    }
  };

  const currentSectionConfig = sectionsConfig[section] || sectionsConfig.permohonan;

  // Handle Create Permohonan Baharu
  const handleCreatePermohonan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formAmount) {
      toast.error('Sila lengkapkan tajuk dan nilai permohonan!');
      return;
    }

    const amt = parseFloat(formAmount) || 0;
    const maxThreshold = 50000;
    if (amt > maxThreshold) {
      toast.error(`Had siling Tawaran Terus ialah RM 50,000. Nilai melebihi had perlu melalui kaedah Sebutharga!`);
      return;
    }

    const nextNo = `KK/BP/TT/2026/${String(records.length + 1).padStart(3, '0')}`;
    const newRecord: DirectAwardRecord = {
      id: `tt-${Date.now()}`,
      orderNo: nextNo,
      title: formTitle.toUpperCase(),
      category: formCategory,
      supplierName: formSupplier || 'Pembekal Berdaftar RISDA',
      supplierCode: formSupplierCode || (formCategory === 'KERJA' ? 'CIDB G1' : 'MOF 010101'),
      allocationCode: formVote,
      estimatedAmount: amt,
      perihalPerolehan: formJustification || 'Permohonan tawaran terus rasmi bagi operasi jabatan.',
      status: 'DALAM SEMAKAN',
      financeStatus: 'BELUM DIHANTAR',
      requestDate: new Date().toISOString().split('T')[0],
      unitOffice: `Pejabat RISDA Daerah ${district || 'Beaufort'}`,
      aiCompliance: 96,
      quotations: [
        { supplierName: formSupplier || 'Pembekal Berdaftar RISDA', contact: '019-XXXXXXX', amount: amt, dateReceived: new Date().toISOString().split('T')[0], isWinner: true, isCompliant: true, status: 'LENGKAP' }
      ],
      rfqDate: new Date().toISOString().split('T')[0],
      rfqDeadline: '2026-04-15',
      rfqStatus: 'AKTIF'
    };

    try {
      await addDoc(collection(db, 'order_requests'), {
        ...newRecord,
        module: 'tawaran_terus',
        createdAt: Timestamp.now()
      });
    } catch (e) {
      // Local fallback
    }

    setRecords(prev => [newRecord, ...prev]);
    toast.success(`Permohonan Baharu ${nextNo} berjaya didaftarkan!`);
    setFormTitle('');
    setFormAmount('');
    setFormSupplier('');
    setFormSupplierCode('');
    setFormJustification('');
    setActiveTab('proses');
  };

  // Workflow 1: Move from PERMOHONAN BAHARU to DALAM PROSES
  const handleProcessRequest = async (rec: DirectAwardRecord) => {
    const updated: Partial<DirectAwardRecord> = {
      status: 'DALAM PROSES'
    };
    try {
      if (rec.id && !rec.id.startsWith('tt-')) {
        await updateDoc(doc(db, 'order_requests', rec.id), updated);
      }
    } catch (e) {}
    setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, ...updated } : r));
    toast.success(`Permohonan ${rec.orderNo} diproses! Status: DALAM PROSES`);
  };

  // Workflow 2: Move from DALAM PROSES to MENUNGGU KELULUSAN
  const handleSubmitForApproval = async (rec: DirectAwardRecord) => {
    const updated: Partial<DirectAwardRecord> = {
      status: 'MENUNGGU KELULUSAN'
    };
    try {
      if (rec.id && !rec.id.startsWith('tt-')) {
        await updateDoc(doc(db, 'order_requests', rec.id), updated);
      }
    } catch (e) {}
    setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, ...updated } : r));
    toast.success(`Permohonan ${rec.orderNo} dihantar untuk semakan & KELULUSAN PTJ!`);
  };

  // Workflow 3: Cancel Request (BATAL)
  const handleCancelRequest = async (rec: DirectAwardRecord) => {
    if (!window.confirm(`Adakah anda pasti mahu membatalkan permohonan ${rec.orderNo}?`)) return;
    const updated: Partial<DirectAwardRecord> = {
      status: 'BATAL'
    };
    try {
      if (rec.id && !rec.id.startsWith('tt-')) {
        await updateDoc(doc(db, 'order_requests', rec.id), updated);
      }
    } catch (e) {}
    setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, ...updated } : r));
    toast.error(`Permohonan ${rec.orderNo} telah DIBATALKAN.`);
  };

  // Handle Approve Record (Move to SELESAI & Generate LO)
  const handleApprove = async (rec: DirectAwardRecord) => {
    const today = new Date().toISOString().split('T')[0];
    const newPo = `264507${Math.floor(1000 + Math.random() * 9000)}`;
    const updated: Partial<DirectAwardRecord> = {
      status: 'SELESAI',
      approvedBy: user?.displayName || user?.email || 'Ketua PTJ',
      approvedDate: today,
      poNo: rec.poNo || newPo,
      loGeneratedDate: today
    };

    try {
      if (rec.id && !rec.id.startsWith('tt-')) {
        await updateDoc(doc(db, 'order_requests', rec.id), updated);
      }
    } catch (e) {}

    setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, ...updated } : r));
    toast.success(`Permohonan ${rec.orderNo} telah DILULUSKAN (SELESAI)! No. LO: ${rec.poNo || newPo}`);
  };

  // Open Pelawaan Modal for an approved record
  const handleOpenPelawaan = (rec: DirectAwardRecord) => {
    setSelectedRecordForPelawaan(rec);
    setShowPelawaanModal(true);
  };

  // Handle Send Pelawaan
  const handleSendPelawaan = async (invitationData: {
    recordId: string;
    suppliers: PelawaanSupplierItem[];
    rfqDate: string;
    rfqDeadline: string;
    rfqClosingTime: string;
  }) => {
    const updated: Partial<DirectAwardRecord> = {
      pelawaanSuppliers: invitationData.suppliers,
      rfqDate: invitationData.rfqDate,
      rfqDeadline: invitationData.rfqDeadline,
      rfqClosingTime: invitationData.rfqClosingTime,
      rfqStatus: 'AKTIF'
    };

    try {
      if (invitationData.recordId && !invitationData.recordId.startsWith('tt-')) {
        await updateDoc(doc(db, 'order_requests', invitationData.recordId), updated);
      }
    } catch (e) {}

    setRecords(prev => prev.map(r => r.id === invitationData.recordId ? { ...r, ...updated } : r));
    setShowPelawaanModal(false);
    toast.success('Pelawaan 3 pembekal berjaya dihantar! Membawa ke modul Pelawaan Tawaran Harga.');
    handleNavigateToSection('pelawaan', 'aktif');
  };

  // Update Supplier Status in Table
  const handleUpdateSupplierStatus = (recordId: string, supplierId: string, newStatus: PelawaanStatus) => {
    setRecords(prev => prev.map(r => {
      if (r.id === recordId && r.pelawaanSuppliers) {
        return {
          ...r,
          pelawaanSuppliers: r.pelawaanSuppliers.map(s => s.id === supplierId ? { ...s, status: newStatus } : s)
        };
      }
      return r;
    }));
  };

  // Handle Send to Finance
  const handleSendToFinance = async (rec: DirectAwardRecord) => {
    const finRef = `FIN-RISDA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const updated: Partial<DirectAwardRecord> = {
      financeStatus: 'DIHANTAR',
      financeReferenceNo: finRef
    };

    try {
      if (rec.id && !rec.id.startsWith('tt-')) {
        await updateDoc(doc(db, 'order_requests', rec.id), updated);
      }
    } catch (e) {}

    setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, ...updated } : r));
    toast.success(`LO ${rec.poNo || rec.orderNo} berjaya dihantar ke Unit Kewangan! No Ruj: ${finRef}`);
  };

  // Handle Mark as Paid
  const handleMarkPaid = async (rec: DirectAwardRecord) => {
    const baucarNo = `BV/RISDA/2026/${Math.floor(100 + Math.random() * 900)}`;
    const updated: Partial<DirectAwardRecord> = {
      status: 'DIBAYAR',
      financeStatus: 'DIBAYAR',
      noBaucar: baucarNo
    };

    try {
      if (rec.id && !rec.id.startsWith('tt-')) {
        await updateDoc(doc(db, 'order_requests', rec.id), updated);
      }
    } catch (e) {}

    setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, ...updated } : r));
    toast.success(`Bayaran disahkan untuk LO ${rec.poNo || rec.orderNo}! No Baucar: ${baucarNo}`);
  };

  // Print Official Local Order Slip
  const handlePrintLO = (rec: DirectAwardRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>PESANAN TEMPATAN KERAJAAN (LO) - ${rec.poNo || rec.orderNo}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 25px; color: #111; font-size: 12px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .title { font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 5px 0; }
          .subtitle { font-size: 11px; font-weight: bold; color: #333; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          .meta-table td { padding: 4px 6px; font-size: 11px; }
          .item-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          .item-table th, .item-table td { border: 1px solid #333; padding: 6px; text-align: left; font-size: 11px; }
          .item-table th { background: #f2f2f2; text-transform: uppercase; }
          .text-right { text-align: right; }
          .signature-box { display: flex; justify-content: space-between; margin-top: 40px; }
          .sign-col { width: 45%; border-top: 1px dashed #333; padding-top: 5px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size: 14px; font-weight: bold;">PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH (RISDA)</div>
          <div class="title">PESANAN KERAJAAN (LOCAL ORDER) - TAWARAN TERUS</div>
          <div class="subtitle">TATACARA PENGURUSAN PEROLEHAN KERAJAAN (AP 173 / 1PP PK 2)</div>
        </div>

        <table class="meta-table">
          <tr>
            <td style="width: 20%;"><strong>NO. PESANAN (LO):</strong></td>
            <td style="width: 30%; color: #0066cc; font-weight: bold;">${rec.poNo || '2645070098'}</td>
            <td style="width: 20%;"><strong>TARIKH:</strong></td>
            <td style="width: 30%;">${rec.approvedDate || rec.requestDate}</td>
          </tr>
          <tr>
            <td><strong>NO. PERMOHONAN:</strong></td>
            <td>${rec.orderNo}</td>
            <td><strong>PUSAT TANGGUNGJAWAB:</strong></td>
            <td>${rec.unitOffice || 'PRD BEAUFORT'}</td>
          </tr>
          <tr>
            <td><strong>KEPADA (PEMBEKAL):</strong></td>
            <td><strong>${rec.supplierName}</strong></td>
            <td><strong>KOD BIDANG / LESEN:</strong></td>
            <td>${rec.supplierCode || 'MOF / CIDB'}</td>
          </tr>
          <tr>
            <td><strong>KOD VOT / PERUNTUKAN:</strong></td>
            <td>${rec.allocationCode}</td>
            <td><strong>KAEDAH PEROLEHAN:</strong></td>
            <td>TAWARAN TERUS (${rec.category})</td>
          </tr>
        </table>

        <div style="font-weight: bold; margin-top: 10px; margin-bottom: 5px;">PERIHAL / SKOP PEROLEHAN:</div>
        <div style="border: 1px solid #ccc; padding: 8px; background: #fafafa; margin-bottom: 12px;">
          ${rec.title}<br/>
          <small style="color: #555;">${rec.perihalPerolehan || 'Perolehan bekalan / perkhidmatan / kerja bagi keperluan rasmi jabatan.'}</small>
        </div>

        <table class="item-table">
          <thead>
            <tr>
              <th style="width: 8%; text-align: center;">BIL</th>
              <th>KETERANGAN BEKALAN / PERKHIDMATAN / KERJA</th>
              <th style="width: 15%; text-align: center;">KUANTITI</th>
              <th style="width: 20%; text-align: right;">JUMLAH (RM)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: center;">1</td>
              <td>${rec.title}</td>
              <td style="text-align: center;">1 Pakej / Lot</td>
              <td class="text-right">${Number(rec.estimatedAmount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th colspan="3" class="text-right">JUMLAH KESELURUHAN (RM):</th>
              <th class="text-right" style="color: #0066cc;">RM ${Number(rec.estimatedAmount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</th>
            </tr>
          </tfoot>
        </table>

        <div class="signature-box">
          <div class="sign-col">
            <strong>DISEDIAKAN OLEH:</strong><br/>
            Nama: Pegawai Perolehan<br/>
            Jawatan: Pembantu Tadbir Perolehan<br/>
            Tarikh: ${rec.requestDate}
          </div>
          <div class="sign-col">
            <strong>DILULUSKAN OLEH (KETUA PTJ):</strong><br/>
            Nama: ${rec.approvedBy || 'Pegawai Pelulus Berkuasa'}<br/>
            Jawatan: Ketua Pusat Tanggungjawab<br/>
            Tarikh: ${rec.approvedDate || rec.requestDate}
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  // Filter records based on active tab and search
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch = r.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (r.poNo || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = selectedCategory === 'SEMUA' || r.category === selectedCategory;

      if (!matchSearch || !matchCategory) return false;

      // Filter by section & tab
      if (section === 'permohonan') {
        if (activeTab === 'baharu') return r.status === 'PERMOHONAN BAHARU' || r.status === 'DRAF';
        if (activeTab === 'proses') return r.status === 'DALAM PROSES' || r.status === 'DALAM SEMAKAN';
        if (activeTab === 'kelulusan') return r.status === 'MENUNGGU KELULUSAN';
        if (activeTab === 'selesai') return r.status === 'LULUS' || r.status === 'SELESAI' || r.status === 'DIBAYAR';
      }

      if (section === 'pelawaan') {
        if (activeTab === 'baharu') return true;
        if (activeTab === 'aktif') return r.rfqStatus === 'AKTIF';
        if (activeTab === 'tamat') return r.rfqStatus === 'TAMAT';
        if (activeTab === 'sejarah') return true;
      }

      if (section === 'tawaran') {
        if (activeTab === 'diterima') return r.quotations?.some(q => q.status === 'LENGKAP');
        if (activeTab === 'menunggu') return r.quotations?.some(q => q.status === 'MENUNGGU');
        if (activeTab === 'tidak-lengkap') return r.quotations?.some(q => q.status === 'TIDAK_LENGKAP');
      }

      if (section === 'penilaian') {
        return true;
      }

      if (section === 'pemilihan') {
        if (activeTab === 'dipilih') return !!r.supplierName;
        if (activeTab === 'kelulusan') return r.status === 'MENUNGGU KELULUSAN' || r.status === 'LULUS';
      }

      if (section === 'pesanan') {
        if (activeTab === 'jana') return r.status === 'LULUS' || r.status === 'MENUNGGU KELULUSAN';
        if (activeTab === 'dikeluarkan') return !!r.poNo;
        if (activeTab === 'kewangan') return r.financeStatus === 'DIHANTAR' || r.financeStatus === 'DIBAYAR';
      }

      return true;
    });
  }, [records, section, activeTab, searchTerm, selectedCategory]);

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* 1. SECTION HEADER BANNER */}
      <div className="bg-risda-card border border-risda-border rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0">
              {React.createElement(currentSectionConfig.icon, { size: 22 })}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight font-poppins">
                {currentSectionConfig.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {section === 'permohonan' && (
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={16} className="stroke-[3]" />
                <span>PERMOHONAN BAHARU</span>
              </button>
            )}

            {section === 'pelawaan' && (
              <button
                type="button"
                onClick={() => {
                  const approvedRec = records.find(r => r.status === 'SELESAI' || r.status === 'LULUS') || records[0];
                  if (!approvedRec) {
                    toast.error('Sila buat permohonan baharu terlebih dahulu.');
                    setShowNewModal(true);
                    return;
                  }
                  handleOpenPelawaan(approvedRec);
                }}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Megaphone size={16} className="stroke-[2.5]" />
                <span>PELAWA PEMBEKAL</span>
              </button>
            )}

            {section === 'pesanan' && (
              <button
                type="button"
                onClick={() => setShowGenerateLOModal(true)}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={16} className="stroke-[3]" />
                <span>JANA PESANAN TEMPATAN (LO)</span>
              </button>
            )}

            <div className="px-4 py-3 bg-black/5 dark:bg-white/5 border border-risda-border rounded-2xl text-right">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Jumlah Rekod</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">{filteredRecords.length} Rekod</span>
            </div>
          </div>
        </div>

        {/* 2. SUB-TABS NAVIGATION BAR */}
        
        <div className="flex items-center gap-2 overflow-x-auto pt-6 mt-6 border-t border-risda-border [scrollbar-width:none]">
          {currentSectionConfig.tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  window.location.hash = tab.id;
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black scale-102'
                    : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-black/10'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. CONTENT AREA BASED ON SECTION & TAB */}

      {/* B. STATUS PELAWAAN PEMBEKAL (Dipaparkan di tab Pelawaan) */}
      {section === 'pelawaan' && (
        (() => {
          const activePelawaanRec = records.find(r => r.pelawaanSuppliers && r.pelawaanSuppliers.length > 0);
          if (!activePelawaanRec || !activePelawaanRec.pelawaanSuppliers || activePelawaanRec.pelawaanSuppliers.length === 0) {
            return (
              <div className="bg-risda-card border border-risda-border rounded-3xl p-10 text-center space-y-4 shadow-sm animate-fadeIn">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center justify-center mx-auto">
                  <Megaphone size={28} />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Tiada Pelawaan Pembekal Aktif
                  </h3>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                    Belum ada pelawaan tawaran harga yang dihantar kepada pembekal. Sila cipta permohonan baharu di tab Permohonan, luluskan, dan klik butang "+ Pelawa Pembekal".
                  </p>
                </div>
              </div>
            );
          }
          return (
            <div className="space-y-3">
              <SupplierInvitationStatusTable
                orderNo={activePelawaanRec.orderNo}
                title={activePelawaanRec.title}
                estimatedAmount={activePelawaanRec.estimatedAmount}
                suppliers={activePelawaanRec.pelawaanSuppliers}
                onViewQuotation={(sup) => {
                  setSelectedRecordForPelawaan(activePelawaanRec);
                  setSelectedSupplierForQuotation(sup);
                }}
                onUpdateStatus={(supId, newSt) => handleUpdateSupplierStatus(activePelawaanRec.id, supId, newSt)}
                onResendInvitation={(sup) => {
                  toast.success(`Peringatan pelawaan dihantar semula ke emel ${sup.email}!`);
                }}
                onProceedToOffers={() => {
                  handleNavigateToSection('tawaran', 'semua');
                }}
              />
            </div>
          );
        })()
      )}

      {/* C. MODUL TAWARAN PEMBEKAL (SEMUA TAWARAN) */}
      {section === 'tawaran' && (
        <SupplierOffersView
          orderNo="TT/2026/00125"
          orderTitle="Pembekalan Komputer"
          closingDate="05/10/2026 5:00 PM"
          onSelectWinningSupplier={(winnerName, price) => {
            setRecords(prev => prev.map(r => (r.orderNo === 'TT/2026/00125' || r.orderNo === 'TP-2026-00125') ? {
              ...r,
              supplierName: winnerName,
              estimatedAmount: price,
              status: 'SELESAI'
            } : r));
            toast.success(`Pembekal ${winnerName} dipilih (RM ${price.toLocaleString()})! Membawa ke peringkat Pemilihan Pembekal.`);
            handleNavigateToSection('pemilihan', 'dipilih');
          }}
          onProceedToEvaluation={() => {
            handleNavigateToSection('penilaian', 'kriteria');
          }}
        />
      )}

      {/* D. MODUL PENILAIAN & PERBANDINGAN TAWARAN */}
      {section === 'penilaian' && (
        <DirectAwardEvaluationView
          orderNo="TT-2026-00125"
          orderTitle="Pembekalan Komputer Desktop"
          closingDate="02/10/2026"
          onProceedToSelection={(recommendedSupplier, price, justification) => {
            setRecords(prev => prev.map(r => (r.orderNo === 'TT-2026-00125' || r.orderNo === 'TT/2026/00125' || r.orderNo === 'TP-2026-00125') ? {
              ...r,
              supplierName: recommendedSupplier,
              estimatedAmount: price,
              perihalPerolehan: `${r.perihalPerolehan || ''} [Justifikasi: ${justification}]`,
              status: 'SELESAI'
            } : r));
            toast.success(`Pembekal ${recommendedSupplier} diperakukan. Membawa ke Pemilihan Pembekal!`);
            handleNavigateToSection('pemilihan', 'dipilih');
          }}
          onSaveEvaluation={(data) => {
            toast.success('Penilaian Pegawai berjaya disimpan!');
          }}
        />
      )}

      {/* E. MODUL PEMILIHAN PEMBEKAL & KELULUSAN PTJ */}
      {section === 'pemilihan' && (
        <DirectAwardSelectionManagement
          onGenerateLO={(item) => {
            const today = new Date().toISOString().split('T')[0];
            const newPo = `264507${Math.floor(1000 + Math.random() * 9000)}`;
            const updatedRec: DirectAwardRecord = {
              id: `tt-${Date.now()}`,
              orderNo: item.orderNo,
              poNo: newPo,
              title: item.justification ? `Perolehan bagi ${item.orderNo}` : 'Perolehan Tawaran Terus',
              category: 'BEKALAN',
              supplierName: item.recommendedSupplierFull,
              allocationCode: 'B62-020101-1002',
              estimatedAmount: item.amount,
              status: 'SELESAI',
              financeStatus: 'BELUM DIHANTAR',
              requestDate: today,
              unitOffice: item.unit,
              approvedBy: item.workflow.approvedBy.name || 'Pegawai Pengawal PTJ',
              approvedDate: today,
              loGeneratedDate: today
            };
            setRecords(prev => [updatedRec, ...prev]);
            handleNavigateToSection('pesanan', 'jana');
          }}
          onNavigateToSection={(targetSection, targetTab) => {
            handleNavigateToSection(targetSection as any, targetTab);
          }}
        />
      )}

      {/* F. MODUL PESANAN TEMPATAN / LO KERAJAAN (SEPERTI SEBUTHARGA, DIRUJUK MELALUI PERMOHONAN) */}
      {section === 'pesanan' && (
        <DirectAwardLocalOrderManagement
          records={records}
          activeTab={activeTab}
          isOpenGenerateModal={showGenerateLOModal}
          onCloseGenerateModal={() => setShowGenerateLOModal(false)}
          onNavigateToLaporan={() => handleNavigateToSection('laporan', 'ringkasan')}
          onTabChange={(tab) => {
            setActiveTab(tab);
            window.location.hash = tab;
          }}
          onUpdateRecord={(recordId, updates) => {
            setRecords(prev => prev.map(r => r.id === recordId ? { ...r, ...updates } : r));
          }}
          onCreateRecord={(newRec) => {
            setRecords(prev => [newRec, ...prev]);
          }}
        />
      )}

      {/* G. SEARCH & FILTER BAR AND GENERAL DATA TABLE (Untuk seksyen permohonan dan laporan) */}
      {section !== 'tawaran' && section !== 'penilaian' && section !== 'pemilihan' && section !== 'pelawaan' && section !== 'pesanan' && (
        <>
          <div className="bg-risda-card border border-risda-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari rujukan, tajuk, atau pembekal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-black/5 dark:bg-black/40 border border-risda-border rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {['SEMUA', 'BEKALAN', 'PERKHIDMATAN', 'KERJA'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                  : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-amber-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* C. GENERAL DATA TABLE / WORKFLOW VIEW */}
      <div className="bg-risda-card border border-risda-border rounded-3xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-black/5 dark:bg-black/40 border-b border-risda-border text-slate-700 dark:text-slate-300 text-[11px] font-black uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">Bil</th>
                  <th className="py-3.5 px-4">No. Rujukan &amp; Tarikh</th>
                  <th className="py-3.5 px-4">Tajuk Perolehan</th>
                  <th className="py-3.5 px-4">Pembekal &amp; Kod Bidang</th>
                  <th className="py-3.5 px-4 text-right">Nilai (RM)</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-risda-border">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center justify-center mx-auto">
                          <FileText size={22} />
                        </div>
                        <div className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                          Tiada Rekod Tawaran Terus Ditemui
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                          Belum ada permohonan yang didaftarkan. Klik butang di bawah untuk memulakan permohonan tawaran terus baharu.
                        </p>
                        {section === 'permohonan' && (
                          <button
                            type="button"
                            onClick={() => setShowNewModal(true)}
                            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5 hover:scale-102"
                          >
                            <Plus size={14} className="stroke-[3]" />
                            <span>Permohonan Baharu</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec, idx) => (
                    <tr key={rec.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-mono font-black text-slate-900 dark:text-white text-xs">
                          {rec.orderNo}
                        </div>
                        {rec.poNo && (
                          <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                            PO: {rec.poNo}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 font-medium">
                          {rec.requestDate}
                        </div>
                      </td>

                      <td className="py-4 px-4 max-w-md">
                        <div className="font-bold text-slate-900 dark:text-white uppercase line-clamp-2">
                          {rec.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            rec.category === 'BEKALAN' ? 'bg-blue-500/15 text-blue-500' :
                            rec.category === 'PERKHIDMATAN' ? 'bg-emerald-500/15 text-emerald-500' :
                            'bg-amber-500/15 text-amber-500'
                          }`}>
                            {rec.category}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Vot: {rec.allocationCode}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200 uppercase">
                          {rec.supplierName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {rec.supplierCode || 'CIDB / MOF'}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right font-mono font-black text-amber-500 tabular-nums">
                        RM {Number(rec.estimatedAmount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          rec.status === 'LULUS' || rec.status === 'SELESAI' || rec.status === 'DIBAYAR'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : rec.status === 'MENUNGGU KELULUSAN'
                            ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30'
                            : rec.status === 'DALAM PROSES' || rec.status === 'DALAM SEMAKAN'
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                            : rec.status === 'PERMOHONAN BAHARU'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-black'
                            : rec.status === 'BATAL'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                            : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30'
                        }`}>
                          {rec.status}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* 1. Workflow: PERMOHONAN BAHARU -> DALAM PROSES */}
                          {rec.status === 'PERMOHONAN BAHARU' && (
                            <button
                              onClick={() => handleProcessRequest(rec)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                              title="Proses Permohonan"
                            >
                              <ArrowRight size={12} /> Proses
                            </button>
                          )}

                          {/* 2. Workflow: DALAM PROSES -> MENUNGGU KELULUSAN */}
                          {(rec.status === 'DALAM PROSES' || rec.status === 'DALAM SEMAKAN') && (
                            <button
                              onClick={() => handleSubmitForApproval(rec)}
                              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                              title="Hantar untuk Kelulusan PTJ"
                            >
                              <Send size={12} /> Hantar Kelulusan
                            </button>
                          )}

                          {/* 3. Workflow: MENUNGGU KELULUSAN -> SELESAI */}
                          {rec.status === 'MENUNGGU KELULUSAN' && (
                            <button
                              onClick={() => handleApprove(rec)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                              title="Luluskan & Selesai (Jana LO)"
                            >
                              <CheckCircle2 size={13} /> Luluskan
                            </button>
                          )}

                          {/* 4. Tindakan Batal Permohonan */}
                          {rec.status !== 'SELESAI' && rec.status !== 'LULUS' && rec.status !== 'DIBAYAR' && rec.status !== 'BATAL' && (
                            <button
                              onClick={() => handleCancelRequest(rec)}
                              className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all cursor-pointer"
                              title="Batalkan Permohonan"
                            >
                              <X size={13} />
                            </button>
                          )}

                          {/* Selepas Permohonan Diluluskan: Paparkan butang + PELAWA PEMBEKAL */}
                          {(rec.status === 'LULUS' || rec.status === 'SELESAI') && (
                            <button
                              onClick={() => handleOpenPelawaan(rec)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-sm hover:scale-102 active:scale-98"
                              title="Pelawa 3 Pembekal"
                            >
                              <Megaphone size={12} className="stroke-[2.5]" />
                              <span>PELAWA PEMBEKAL</span>
                            </button>
                          )}

                          {/* Cetak LO if approved / selesai */}
                          {(rec.status === 'LULUS' || rec.status === 'SELESAI' || rec.status === 'DIBAYAR') && (
                            <button
                              onClick={() => handlePrintLO(rec)}
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                              title="Cetak Pesanan Tempatan (LO)"
                            >
                              <Printer size={15} />
                            </button>
                          )}

                          {/* Hantar ke Kewangan */}
                          {(rec.status === 'LULUS' || rec.status === 'SELESAI') && rec.financeStatus !== 'DIHANTAR' && rec.financeStatus !== 'DIBAYAR' && (
                            <button
                              onClick={() => handleSendToFinance(rec)}
                              className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer"
                              title="Hantar ke Unit Kewangan"
                            >
                              <Send size={15} />
                            </button>
                          )}

                          {/* Sahkan Bayaran */}
                          {rec.financeStatus === 'DIHANTAR' && (
                            <button
                              onClick={() => handleMarkPaid(rec)}
                              className="p-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-all cursor-pointer"
                              title="Sahkan Bayaran Selesai"
                            >
                              <Coins size={15} />
                            </button>
                          )}

                          {/* Lihat Detail */}
                          <button
                            onClick={() => setPreviewRecord(rec)}
                            className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-black/10 transition-all cursor-pointer"
                            title="Papar Butiran"
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        </>
      )}

      {/* D. PREVIEW & DETAIL MODAL */}
      {previewRecord && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-risda-card border border-risda-border rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-start justify-between border-b border-risda-border pb-4">
              <div>
                <span className="text-xs font-mono font-bold text-amber-500 uppercase">
                  {previewRecord.orderNo}
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase mt-0.5">
                  Perincian Tawaran Terus
                </h3>
              </div>
              <button
                onClick={() => setPreviewRecord(null)}
                className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-risda-border space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-500">Tajuk Projek / Perolehan:</span>
                <div className="font-bold text-slate-900 dark:text-white">{previewRecord.title}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-risda-border">
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Kategori:</span>
                  <strong className="text-slate-900 dark:text-white">{previewRecord.category}</strong>
                </div>

                <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-risda-border">
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Vot Peruntukan:</span>
                  <strong className="font-mono text-slate-900 dark:text-white">{previewRecord.allocationCode}</strong>
                </div>

                <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-risda-border">
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Pembekal Terpilih:</span>
                  <strong className="text-slate-900 dark:text-white">{previewRecord.supplierName}</strong>
                </div>

                <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-risda-border">
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Nilai Perolehan:</span>
                  <strong className="text-amber-500 font-mono text-base">RM {Number(previewRecord.estimatedAmount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>

              {previewRecord.quotations && previewRecord.quotations.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 block">
                    Jadual Kajian Pasaran / Tawaran Harga Pembekal:
                  </span>
                  <div className="border border-risda-border rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-black/5 dark:bg-white/5 text-[10px] font-black uppercase">
                        <tr>
                          <th className="p-2.5">Syarikat</th>
                          <th className="p-2.5 text-right">Harga (RM)</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-risda-border">
                        {previewRecord.quotations.map((q, i) => (
                          <tr key={i} className={q.isWinner ? 'bg-emerald-500/10' : ''}>
                            <td className="p-2.5 font-bold uppercase">{q.supplierName}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-amber-500">
                              {q.amount ? `RM ${Number(q.amount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                q.status === 'LENGKAP' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'
                              }`}>
                                {q.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end items-center gap-3 pt-4 border-t border-risda-border flex-wrap">
              {(previewRecord.status === 'LULUS' || previewRecord.status === 'SELESAI') && (
                <button
                  type="button"
                  onClick={() => {
                    handleOpenPelawaan(previewRecord);
                    setPreviewRecord(null);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-102 active:scale-98"
                >
                  <Megaphone size={14} className="stroke-[2.5]" /> PELAWA PEMBEKAL
                </button>
              )}

              {(previewRecord.status === 'LULUS' || previewRecord.status === 'SELESAI' || previewRecord.status === 'DIBAYAR') && (
                <button
                  onClick={() => handlePrintLO(previewRecord)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} /> Cetak LO
                </button>
              )}
              <button
                onClick={() => setPreviewRecord(null)}
                className="px-4 py-2 bg-black/10 dark:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DAFTAR PERMOHONAN BAHARU (A, B, C, D) */}
      <NewDirectAwardModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onSuccess={(createdId, targetSt) => {
          setActiveTab('baharu');
        }}
      />

      {/* MODAL PELAWA 3 PEMBEKAL */}
      <SupplierInvitationModal
        isOpen={showPelawaanModal}
        onClose={() => setShowPelawaanModal(false)}
        record={selectedRecordForPelawaan}
        onSendInvitation={handleSendPelawaan}
      />

      {/* MODAL LIHAT TAWARAN PEMBEKAL */}
      <QuotationDetailModal
        isOpen={!!selectedSupplierForQuotation}
        onClose={() => setSelectedSupplierForQuotation(null)}
        supplier={selectedSupplierForQuotation}
        orderNo={selectedRecordForPelawaan?.orderNo || 'TP-2026-00125'}
        orderTitle={selectedRecordForPelawaan?.title || 'Bekalan Alat Tulis'}
        estimatedAmount={selectedRecordForPelawaan?.estimatedAmount || 8500}
        onSelectWinningSupplier={(winnerName, winnerAmt) => {
          if (selectedRecordForPelawaan) {
            setRecords(prev => prev.map(r => r.id === selectedRecordForPelawaan.id ? {
              ...r,
              supplierName: winnerName,
              estimatedAmount: winnerAmt || r.estimatedAmount,
              status: 'SELESAI'
            } : r));
          }
          toast.success(`Pembekal ${winnerName} berjaya dipilih (RM ${winnerAmt.toLocaleString()})! Membawa ke peringkat Pemilihan Pembekal.`);
          setSection('pemilihan');
          setActiveTab('dipilih');
        }}
      />
    </div>
  );
}
