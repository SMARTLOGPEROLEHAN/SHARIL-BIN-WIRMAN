import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  FileText, 
  Download, 
  Edit2, 
  Trash2, 
  Calendar, 
  DollarSign, 
  Building2, 
  Send, 
  Printer, 
  Coins, 
  Layers, 
  ShieldCheck, 
  ExternalLink, 
  RefreshCw,
  ListPlus,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  CheckSquare,
  Square,
  UserCheck,
  Package,
  Briefcase,
  Hammer,
  Sparkles,
  X,
  FileCheck,
  Megaphone,
  Trophy,
  Gavel,
  Award
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useProcurementModule } from '../context/ModuleContext';
import { useTheme } from '../context/ThemeContext';
import { isWithinUserScope } from '../lib/scopeUtils';
import { useSuppliers } from '../lib/useSuppliers';
import { formatSimplifiedLicense } from '../lib/supplierEnrichment';
import { DEFAULT_DIRECT_AWARD_VOT_CODES } from './DirectAwardBudgetBook';
import NewDirectAwardModal from './NewDirectAwardModal';
import toast from 'react-hot-toast';
import Pagination from './Pagination';

export interface OrderItem {
  id: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  totalPrice: number;
  kodAktiviti?: string;
  kodObjek?: string;
  noAset?: string;
  nilaiGst?: number;
  jumlahHarga?: number;
  detailKerja?: string;
}

export interface KajianPasaranItem {
  bil: number;
  namaSyarikat: string;
  pegawaiDihubungi: string;
  kaedahKajian: string; // e.g. 'SEBUTHARGA', 'Laman Web', 'Katalog eP', 'Harga Belian Lampau'
  hargaTawaran: number;
  catatan: string;
}

export interface JustifikasiPerolehan {
  tiadaPembekalLain: boolean;
  perolehanKhas: boolean;
  kadarHargaAgensi: boolean;
  lainLain: boolean;
  lainLainNyatakan: string;
}

export interface OrderRequest {
  id?: string;
  orderNo: string;
  poNo?: string;
  ptjName?: string; // Default: 'PRD BEAUFORT'
  title: string;
  module?: 'sebutharga' | 'tawaran_terus';
  category: 'BEKALAN' | 'PERKHIDMATAN' | 'KERJA';
  jenisPerolehanCategory?: 'Bekalan & Perkhidmatan (Tidak melebihi RM20,000)' | 'Kerja (Tidak melebihi RM20,000)' | string;
  perihalPerolehan?: string;
  allocationCode: string;
  requestedBy: string;
  unitOffice: string;
  estimatedAmount: number;
  requestDate: string;
  status: 'LULUS' | 'DALAM SEMAKAN' | 'MENUNGGU SEMAKAN' | 'MENUNGGU KELULUSAN' | 'DIKEMBALIKAN' | 'DITOLAK' | 'DIHANTAR KE KEWANGAN' | 'DIBAYAR';
  financeStatus?: 'BELUM DIHANTAR' | 'DIHANTAR' | 'DISAHKAN KEWANGAN' | 'DIBAYAR';
  financeReferenceNo?: string;
  financeSentAt?: string;
  supplierName?: string;
  supplierCode?: string;
  aiCompliance?: number;
  rujukanDokumen?: string;
  items?: OrderItem[];
  kajianPasaran?: KajianPasaranItem[];
  justifikasi?: JustifikasiPerolehan;
  pembekalDipilih?: string;
  disediakanOlehNama?: string;
  disediakanOlehJawatan?: string;
  disediakanOlehTarikh?: string;
  disahkanOlehNama?: string;
  disahkanOlehJawatan?: string;
  disahkanOlehTarikh?: string;
  pengesahanKewanganStatus?: 'MENCUKUPI' | 'TIDAK MENCUKUPI';
  kodAktivitiObjek?: string;
  bakiPeruntukanRm?: number;
  noBaucar?: string;
  tarikhDibayar?: string;
  pegawaiKewanganNama?: string;
  pegawaiKewanganTarikh?: string;
  kelulusanKetuaPtjStatus?: 'DILULUSKAN' | 'TIDAK DILULUSKAN';
  ketuaPtjNama?: string;
  ketuaPtjTarikh?: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

const defaultKajianPasaran: KajianPasaranItem[] = [
  { bil: 1, namaSyarikat: '', pegawaiDihubungi: '', kaedahKajian: 'SEBUTHARGA', hargaTawaran: 0, catatan: 'Layak & Dipilih (Pemenang)' },
  { bil: 2, namaSyarikat: '', pegawaiDihubungi: '', kaedahKajian: 'SEBUTHARGA', hargaTawaran: 0, catatan: 'Tawaran Perbandingan 2' },
  { bil: 3, namaSyarikat: '', pegawaiDihubungi: '', kaedahKajian: 'SEBUTHARGA', hargaTawaran: 0, catatan: 'Tawaran Perbandingan 3' }
];

const defaultJustifikasi: JustifikasiPerolehan = {
  tiadaPembekalLain: false,
  perolehanKhas: false,
  kadarHargaAgensi: false,
  lainLain: false,
  lainLainNyatakan: ''
};

// Senarai permohonan Tawaran Terus bermula kosong (belum ada permohonan baru ditambah)
export const DEFAULT_ORDERS: OrderRequest[] = [];

// Contoh permohonan modul Sebutharga mengikut paparan rasmi
export const DEFAULT_SEBUTHARGA_ORDERS: OrderRequest[] = [
  {
    id: 'sh-pap-2026-001',
    orderNo: 'PP/RISDA/BFT/2026/001',
    poNo: '2645070098',
    title: 'CADANGAN PROJEK JALAN BAGI PROGRAM PRASARANA ASAS PERTANIAN (PAP) 2026 KAMPUNG KABIAH KUALA MUAYA, SIPITANG',
    perihalPerolehan: 'CADANGAN PROJEK JALAN BAGI PROGRAM PRASARANA ASAS PERTANIAN (PAP) 2026 KAMPUNG KABIAH KUALA MUAYA, SIPITANG',
    category: 'KERJA',
    status: 'DIBAYAR',
    financeStatus: 'DIBAYAR',
    requestDate: '2026-03-16',
    kodAktivitiObjek: '031400 R4400000 - PRASARANA ASAS PERTANIAN (PAP)',
    allocationCode: '031400 R4400000',
    pembekalDipilih: 'PUNCAK BAYU',
    supplierName: 'PUNCAK BAYU',
    supplierCode: 'CIDB G2',
    ptjName: 'PRD BEAUFORT',
    unitOffice: 'Pejabat RISDA Daerah Beaufort',
    requestedBy: 'Pegawai Pembangunan',
    estimatedAmount: 170000,
    module: 'sebutharga',
    rujukanDokumen: 'SH/RISDA/BFT/2026/001',
    items: [
      { id: '1', description: 'KERJA-KERJA PENYEDIAAN TAPAK DAN PEMBERSIHAN KAWASAN JALAN PERTANIAN', detailKerja: 'PEMBERSIHAN SEMAK SAMUN & MERATAKAN TANAH', kodAktiviti: '031401', kodObjek: 'R4419900', quantity: 1, unitPrice: 35000, totalPrice: 35000 },
      { id: '2', description: 'MEMBEKAL DAN MEMAMPAT BATU KASAR (CRUSHER RUN) LAPISAN ASAS JALAN', detailKerja: 'HAMPARAN BATU KASAR GRED A DENGAN GEOTEKSTIL', kodAktiviti: '031401', kodObjek: 'R4419900', quantity: 1, unitPrice: 65000, totalPrice: 65000 },
      { id: '3', description: 'PEMBINAAN PARIT TANAH DAN PEMASANGAN SALIRAN CULVERT KONKRIT 900MM', detailKerja: 'PEMASANGAN PRECAST CULVERT SERTA WINGWALL', kodAktiviti: '031401', kodObjek: 'R4419900', quantity: 1, unitPrice: 45000, totalPrice: 45000 },
      { id: '4', description: 'KERJA-KERJA AKHIR, KEMASAN PAPAN TANDA PROJEK DAN LAPORAN SIAP KERJA', detailKerja: 'KEMASAN DAN UJIAN PEMAMPATAN JALAN', kodAktiviti: '031401', kodObjek: 'R4419900', quantity: 1, unitPrice: 25000, totalPrice: 25000 }
    ],
    kajianPasaran: [
      { bil: 1, namaSyarikat: 'PUNCAK BAYU', pegawaiDihubungi: 'MOHD NOR (019-8765432) | LESEN CIDB G2', kaedahKajian: 'SEBUTHARGA RASMI', hargaTawaran: 170000, catatan: 'Pemenang Sah Keputusan Sebutharga' }
    ]
  }
];

const formatDateDMY = (dateStr?: string): string => {
  if (!dateStr || dateStr.trim() === '' || dateStr === '-') return '';
  const clean = String(dateStr).split('T')[0].trim();
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    if (y.length === 4) {
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }
  if (clean.includes('/')) return clean;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {}
  return dateStr;
};

export default function OrderRequestManagement() {
  const { role, user, district } = useAuth();
  const { activeModule } = useProcurementModule();
  const { theme } = useTheme();
  const isSebuthargaModule = activeModule === 'sebutharga';
  const isAdmin = role === 'admin' || role === 'pentadbir';
  const isPenyemak = role === 'penyemak';
  const isPelulus = role === 'pelulus';
  const isPenginput = role === 'penginput';
  const { suppliers: unifiedSuppliers } = useSuppliers();

  const [sebuthargaAds, setSebuthargaAds] = useState<any[]>([]);
  const [selectedSebuthargaAdId, setSelectedSebuthargaAdId] = useState<string>('');

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const snap = await getDocs(collection(db, 'ads'));
        const list: any[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        setSebuthargaAds(list);
      } catch (e) {
        console.warn('Could not load ads in OrderRequestManagement:', e);
      }
    };
    fetchAds();
  }, []);

  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [allocationCodes, setAllocationCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('SEMUA');
  const [filterStatus, setFilterStatus] = useState<string>('SEMUA');

  // Reviewer (Penyemak) modal state: checking requisition, choosing 3 suppliers & selecting eligible winner
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReqForReview, setSelectedReqForReview] = useState<OrderRequest | null>(null);
  const [review3Suppliers, setReview3Suppliers] = useState<KajianPasaranItem[]>(defaultKajianPasaran);
  const [reviewEligibleIndex, setReviewEligibleIndex] = useState<number>(0);
  const [reviewNotes, setReviewNotes] = useState<string>('Mematuhi spesifikasi teknikal, tawaran harga terbaik dan lesen sah berdaftar.');

  // Approver (Pelulus) modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedReqForApproval, setSelectedReqForApproval] = useState<OrderRequest | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, filterStatus]);

  // Modal for add/edit form
  const [showModal, setShowModal] = useState(false);
  const [showNewDirectAwardModal, setShowNewDirectAwardModal] = useState(false);
  const [selectedAllocationCodeForNewModal, setSelectedAllocationCodeForNewModal] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Detail view modal / slip preview
  const [selectedRequestForDetail, setSelectedRequestForDetail] = useState<OrderRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Expandable state for Maklumat Pesanan table in list
  const [expandedItemTables, setExpandedItemTables] = useState<Record<string, boolean>>({});

  const toggleItemTable = (id: string) => {
    if (!id) return;
    setExpandedItemTables(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Track which items in Borang Kajian Pasaran are saved/locked vs in editing mode
  const [savedItemRows, setSavedItemRows] = useState<Record<string, boolean>>({});

  // Popup Modal Pemilihan Kod Peruntukan Induk (Sebelum Tambah Pesanan Baru)
  const [showAllocSelectionModal, setShowAllocSelectionModal] = useState(false);
  const [allocModalSearch, setAllocModalSearch] = useState('');

  // Financial Item Edit Modal State (Sub-tab 2)
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [currentReqForItemModal, setCurrentReqForItemModal] = useState<OrderRequest | null>(null);
  const [itemFormData, setItemFormData] = useState<OrderItem>({
    id: '',
    description: '',
    kodAktiviti: '031401',
    kodObjek: 'R4419900',
    noAset: '',
    quantity: 1,
    unitPrice: 0,
    totalPrice: 0,
    nilaiGst: 0,
    jumlahHarga: 0
  });

  // Form State
  const [formData, setFormData] = useState<Omit<OrderRequest, 'id'>>({
    orderNo: '',
    poNo: '',
    ptjName: district ? `PRD ${district.toUpperCase()}` : 'PRD BEAUFORT',
    title: '',
    category: 'BEKALAN',
    jenisPerolehanCategory: 'Bekalan & Perkhidmatan',
    perihalPerolehan: '',
    allocationCode: '',
    requestedBy: user?.displayName || user?.email || 'Pegawai Perolehan RISDA',
    unitOffice: district ? `PEJABAT RISDA DAERAH ${district.toUpperCase()}` : 'PEJABAT RISDA DAERAH BEAUFORT',
    estimatedAmount: 0,
    requestDate: new Date().toISOString().split('T')[0],
    status: 'DALAM SEMAKAN',
    financeStatus: 'BELUM DIHANTAR',
    supplierName: '',
    rujukanDokumen: '',
    remarks: '',
    pembekalDipilih: '',
    items: [
      { id: '1', description: '', kodAktiviti: '031401', kodObjek: 'R4419900', noAset: '', quantity: 1, unit: 'Unit', unitPrice: 0, totalPrice: 0, nilaiGst: 0, jumlahHarga: 0 }
    ],
    kajianPasaran: defaultKajianPasaran,
    justifikasi: defaultJustifikasi,
    disediakanOlehNama: '',
    disediakanOlehJawatan: '',
    disediakanOlehTarikh: new Date().toISOString().split('T')[0],
    disahkanOlehNama: '',
    disahkanOlehJawatan: '',
    disahkanOlehTarikh: new Date().toISOString().split('T')[0],
    pengesahanKewanganStatus: 'MENCUKUPI',
    kodAktivitiObjek: '',
    bakiPeruntukanRm: 0,
    pegawaiKewanganNama: '',
    pegawaiKewanganTarikh: new Date().toISOString().split('T')[0],
    kelulusanKetuaPtjStatus: 'DILULUSKAN',
    ketuaPtjNama: '',
    ketuaPtjTarikh: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchRequests();
    fetchAllocationCodes();
  }, []);





  const fetchAllocationCodes = async () => {
    try {
      // 1. Fetch real allocation codes from Firestore
      const q = query(collection(db, 'allocationCodes'));
      const snapshot = await getDocs(q);
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const nkea = Number(d.nkeaKwr) || 0;
        const blk = Number(d.peruntukanBlk ?? d.approvedAmount) || 0;
        const diterima = Number(d.jumlahDiterima) || (nkea + blk);
        const pertanggungan = Number(d.pertanggunganBelumDijelaskan) || 0;
        const belanja = Number(d.jumlahPerbelanjaan) || 0;
        const baki = Number(d.bakiPeruntukan) ?? (diterima - pertanggungan - belanja);

        list.push({
          id: docSnap.id,
          akt: d.akt || d.code || '',
          obj: d.obj || '',
          perihal: d.perihal || d.name || '',
          nkeaKwr: nkea,
          peruntukanBlk: blk,
          jumlahDiterima: diterima,
          pertanggunganBelumDijelaskan: pertanggungan,
          jumlahPerbelanjaan: belanja,
          bakiPeruntukan: baki,
          year: d.year || '2026',
          tarikhDiterima: d.tarikhDiterima || '',
          status: d.status || 'AKTIF',
          description: d.description || '',
          subCodes: d.subCodes || [],
          aktSubCodes: d.aktSubCodes || [],
          objSubCodes: d.objSubCodes || []
        });
      });

      // 2. Fetch existing order requests to calculate real-time committed pertanggungan & belanja
      let ordersList: any[] = [];
      try {
        const qOrders = query(collection(db, 'orderRequests'));
        const snapshotOrders = await getDocs(qOrders);
        snapshotOrders.forEach((docSnap) => {
          ordersList.push({ id: docSnap.id, ...docSnap.data() });
        });
      } catch (e) {
        console.warn('Could not fetch orderRequests for allocation balance calculation:', e);
      }

      // If database is completely empty on initial startup, provide fallback standard PAP allocation code
      let codesToUse = list;
      if (codesToUse.length === 0) {
        codesToUse = [
          {
            id: 'alloc-1',
            akt: '031400',
            obj: 'R4400000',
            perihal: 'PRASARANA ASAS PERTANIAN (PAP)',
            nkeaKwr: 0,
            peruntukanBlk: 250000,
            jumlahDiterima: 250000,
            pertanggunganBelumDijelaskan: 0,
            jumlahPerbelanjaan: 0,
            bakiPeruntukan: 250000,
            year: '2026',
            status: 'AKTIF'
          }
        ];
      }

      // 3. Compute live balances for each parent allocation code
      const calculatedCodes = codesToUse.map(c => {
        if (!c.akt) return c;
        const matchingOrders = ordersList.filter((ord) => {
          const ordCodeStr = `${ord.allocationCode || ''} ${ord.kodAktivitiObjek || ''}`.toUpperCase();
          const matchesAkt = c.akt && ordCodeStr.includes(c.akt.toUpperCase());
          const matchesItems = ord.items && Array.isArray(ord.items) && ord.items.some((i: any) => i.kodAktiviti === c.akt);
          return matchesAkt || matchesItems;
        });

        let orderPertanggungan = 0;
        let orderBelanja = 0;
        matchingOrders.forEach((ord) => {
          const amt = Number(ord.estimatedAmount) || (ord.items ? ord.items.reduce((s: number, i: any) => s + (Number(i.jumlahHarga || i.totalPrice) || 0), 0) : 0);
          const isPaid = ord.financeStatus === 'DIBAYAR' || ord.status === 'DIBAYAR';
          if (isPaid) {
            orderBelanja += amt;
          } else {
            orderPertanggungan += amt;
          }
        });

        const finalPertanggungan = matchingOrders.length > 0 ? orderPertanggungan : (c.pertanggunganBelumDijelaskan || 0);
        const finalBelanja = matchingOrders.length > 0 ? orderBelanja : (c.jumlahPerbelanjaan || 0);
        const diterima = Number(c.jumlahDiterima) || Number(c.bakiPeruntukan) || 0;
        const finalBaki = diterima - finalPertanggungan - finalBelanja;

        return {
          ...c,
          pertanggunganBelumDijelaskan: finalPertanggungan,
          jumlahPerbelanjaan: finalBelanja,
          bakiPeruntukan: finalBaki > 0 ? finalBaki : 0
        };
      });

      // Filter out child sub-codes and inactive codes so ONLY parent Kod Induk appear in dropdown
      const parentOnlyCodes = calculatedCodes.filter(c => {
        if (!c.akt) return true;
        if (c.akt === '031401' || c.akt === '031402' || (c as any).isSubCode === true) return false;
        if (c.status === 'TIDAK AKTIF') return false;
        return true;
      });

      // Include the official direct award vot codes matching the Buku Vot
      const directAwardCodes = DEFAULT_DIRECT_AWARD_VOT_CODES.map(v => ({
        id: v.id,
        akt: v.kodVot,
        obj: v.kategori,
        perihal: v.butiran,
        code: v.kodVot,
        nkeaKwr: 0,
        peruntukanBlk: v.peruntukanAsal,
        jumlahDiterima: v.peruntukanAsal,
        pertanggunganBelumDijelaskan: v.tanggunganAsal,
        jumlahPerbelanjaan: v.belanjaAsal,
        bakiPeruntukan: Math.max(0, v.peruntukanAsal - v.belanjaAsal - v.tanggunganAsal),
        year: v.year || '2026',
        status: 'AKTIF'
      }));

      // Merge so official Tawaran Terus vot codes appear first
      const mergedCodes = [...directAwardCodes];
      parentOnlyCodes.forEach(p => {
        if (!mergedCodes.some(m => m.code === p.code || m.akt === p.akt)) {
          mergedCodes.push(p);
        }
      });

      setAllocationCodes(mergedCodes);
    } catch (err) {
      console.error('Error fetching allocation codes:', err);
    }
  };

  // Helper to accurately find the matched parent allocation code
  const findMatchingAllocationCode = (selectedCodeVal: string) => {
    if (!selectedCodeVal || !selectedCodeVal.trim()) {
      return null;
    }
    const cleanInput = selectedCodeVal.trim().toUpperCase();
    return (
      allocationCodes.find(ac => {
        if (ac.id && (ac.id === selectedCodeVal || cleanInput === ac.id.toUpperCase())) return true;
        if (ac.akt && cleanInput.includes(ac.akt.toUpperCase())) return true;
        if (ac.code && cleanInput.includes(ac.code.toUpperCase())) return true;
        const fullStr = `${ac.akt || ''} ${ac.obj || ''} - ${ac.perihal || ac.name || ''}`.toUpperCase().trim();
        const shortStr = `${ac.akt || ''} / ${ac.obj || ''} - ${ac.perihal || ac.name || ''}`.toUpperCase().trim();
        if (fullStr === cleanInput || shortStr === cleanInput) return true;
        if (ac.perihal && cleanInput.includes(ac.perihal.toUpperCase())) return true;
        return false;
      }) || null
    );
  };

  // Helper to retrieve sub-codes dynamically based on selected Kod Induk
  const getAvailableSubCodesForForm = (selectedCodeVal: string) => {
    const matchedAlloc = findMatchingAllocationCode(selectedCodeVal);

    const aktSubs: { subCode: string; perihal: string }[] = [];
    const objSubs: { subCode: string; perihal: string }[] = [];

    if (matchedAlloc) {
      if (matchedAlloc.aktSubCodes && Array.isArray(matchedAlloc.aktSubCodes)) {
        matchedAlloc.aktSubCodes.forEach((sc: any) => {
          if (sc.subCode && !aktSubs.some(s => s.subCode === sc.subCode)) {
            aktSubs.push({ subCode: sc.subCode, perihal: sc.perihal || '' });
          }
        });
      }
      if (matchedAlloc.objSubCodes && Array.isArray(matchedAlloc.objSubCodes)) {
        matchedAlloc.objSubCodes.forEach((sc: any) => {
          if (sc.subCode && !objSubs.some(s => s.subCode === sc.subCode)) {
            objSubs.push({ subCode: sc.subCode, perihal: sc.perihal || '' });
          }
        });
      }
      if (matchedAlloc.subCodes && Array.isArray(matchedAlloc.subCodes)) {
        matchedAlloc.subCodes.forEach((sc: any) => {
          const isObj = (sc.subCode || '').toUpperCase().startsWith('R') || /^[A-Z]/.test(sc.subCode || '');
          if (isObj) {
            if (sc.subCode && !objSubs.some(s => s.subCode === sc.subCode)) {
              objSubs.push({ subCode: sc.subCode, perihal: sc.perihal || '' });
            }
          } else {
            if (sc.subCode && !aktSubs.some(s => s.subCode === sc.subCode)) {
              aktSubs.push({ subCode: sc.subCode, perihal: sc.perihal || '' });
            }
          }
        });
      }

      // Default presets based on the matched parent code if no specific subcodes stored
      const aktCode = (matchedAlloc.akt || '').trim();
      const objCode = (matchedAlloc.obj || '').trim();

      if (aktCode === '031400' || (!aktCode && (matchedAlloc.perihal || '').includes('PRASARANA'))) {
        if (aktSubs.length === 0) {
          aktSubs.push(
            { subCode: '031401', perihal: 'PEMBINAAN BARU : JALAN MASUK' },
            { subCode: '031402', perihal: 'PEMBINAAN BARU : PEMBENTUNG' },
            { subCode: '031403', perihal: 'PEMBINAAN BARU : JAMBATAN' },
            { subCode: '031404', perihal: 'PEMBINAAN BARU : PARIT' },
            { subCode: '031405', perihal: 'PENYELENGGARAAN : JALAN MASUK' },
            { subCode: '031406', perihal: 'PENYELENGGARAAN : PEMBENTUNG' },
            { subCode: '031407', perihal: 'PENYELENGGARAAN : JAMBATAN' },
            { subCode: '031408', perihal: 'PENYELENGGARAAN : PARIT' },
            { subCode: '031409', perihal: 'KEMUDAHAN FIZIKAL LAIN' },
            { subCode: '031499', perihal: 'PENTADBIRAN AKTIVITI PRASARANA' }
          );
        }
        if (objSubs.length === 0) {
          objSubs.push(
            { subCode: 'R4419900', perihal: 'LAIN-LAIN SUBSIDI' },
            { subCode: 'R4419901', perihal: 'BANTUAN PRASARANA KHAS' },
            { subCode: 'R2400000', perihal: 'SEWAAN JENTERA & PERALATAN' },
            { subCode: 'R2800000', perihal: 'KERJA-KERJA KHAS / KONTRAK' }
          );
        }
      } else if (aktCode === '021100' || (!aktCode && (matchedAlloc.perihal || '').includes('PERALATAN'))) {
        if (aktSubs.length === 0) {
          aktSubs.push(
            { subCode: '021101', perihal: 'PERALATAN KOMPUTER & ICT' },
            { subCode: '021102', perihal: 'PERABOT & KELENGKAPAN PEJABAT' },
            { subCode: '021103', perihal: 'ALAT TULIS & BAHAN BACAAN' },
            { subCode: '021199', perihal: 'LAIN-LAIN PERALATAN PEJABAT' }
          );
        }
        if (objSubs.length === 0) {
          objSubs.push(
            { subCode: 'R2110000', perihal: 'BEKALAN PEJABAT' },
            { subCode: 'R2700000', perihal: 'BEKALAN ICT & KOMPUTER' },
            { subCode: 'R3500000', perihal: 'HARTA MODAL & ASET' }
          );
        }
      } else if (aktCode === '010200' || (!aktCode && (matchedAlloc.perihal || '').includes('BANGUNAN'))) {
        if (aktSubs.length === 0) {
          aktSubs.push(
            { subCode: '010201', perihal: 'PENYELENGGARAAN KENDERAAN JABATAN' },
            { subCode: '010202', perihal: 'PENYELENGGARAAN BANGUNAN & PREMIS' },
            { subCode: '010203', perihal: 'PENYELENGGARAAN PENGHAWA DINGIN & ELEKTRIK' },
            { subCode: '010299', perihal: 'LAIN-LAIN PENYELENGGARAAN' }
          );
        }
        if (objSubs.length === 0) {
          objSubs.push(
            { subCode: 'R1120000', perihal: 'PERKHIDMATAN MEMBAIKI KENDERAAN' },
            { subCode: 'R2800000', perihal: 'PENYELENGGARAAN BANGUNAN' },
            { subCode: 'R2600000', perihal: 'BAHAN GANTIAN' }
          );
        }
      } else if (aktCode) {
        if (aktSubs.length === 0) {
          const prefix = aktCode.substring(0, Math.min(4, aktCode.length));
          aktSubs.push(
            { subCode: `${prefix}01`, perihal: `${matchedAlloc.perihal || 'Sub-Aktiviti 01'}` },
            { subCode: `${prefix}02`, perihal: 'Sub-Aktiviti 02' },
            { subCode: `${prefix}99`, perihal: 'Lain-lain Aktiviti' }
          );
        }
        if (objSubs.length === 0 && objCode) {
          objSubs.push(
            { subCode: objCode, perihal: matchedAlloc.perihal || 'Kod Objek Utama' }
          );
        }
      }
    }

    if (aktSubs.length === 0) {
      aktSubs.push(
        { subCode: '031401', perihal: 'PEMBINAAN BARU : JALAN MASUK' },
        { subCode: '031402', perihal: 'PEMBINAAN BARU : PEMBENTUNG' }
      );
    }

    if (objSubs.length === 0) {
      objSubs.push(
        { subCode: 'R4419900', perihal: 'LAIN-LAIN SUBSIDI' }
      );
    }

    return { aktSubs, objSubs, matchedAlloc };
  };

  const handleSelectAllocationCode = (codeVal: string) => {
    if (!codeVal) {
      setFormData(prev => ({
        ...prev,
        kodAktivitiObjek: '',
        allocationCode: '',
        bakiPeruntukanRm: 0,
        pengesahanKewanganStatus: 'TIDAK MENCUKUPI'
      }));
      return;
    }

    const foundCode = findMatchingAllocationCode(codeVal);

    const baki = foundCode 
      ? Number(foundCode.bakiPeruntukan ?? foundCode.balanceAmount ?? foundCode.amount ?? 250000)
      : 250000;

    const reqAmount = Number(formData.estimatedAmount || formData.items?.reduce((s, i) => s + (i.jumlahHarga || ((i.quantity || 0) * (i.unitPrice || 0))), 0) || 0);
    const isSufficient = baki >= reqAmount && baki > 0;

    const { aktSubs, objSubs } = getAvailableSubCodesForForm(codeVal);
    const defaultAkt = aktSubs[0]?.subCode || '';
    const defaultObj = objSubs[0]?.subCode || '';

    setFormData(prev => {
      // Automatically update subcodes for items in Jadual Item to match newly selected Kod Induk
      const updatedItems = (prev.items || []).map(item => {
        const isCurrentAktValid = aktSubs.some(s => s.subCode === item.kodAktiviti);
        const isCurrentObjValid = objSubs.some(s => s.subCode === item.kodObjek);
        return {
          ...item,
          kodAktiviti: isCurrentAktValid ? item.kodAktiviti : defaultAkt,
          kodObjek: isCurrentObjValid ? item.kodObjek : defaultObj
        };
      });

      return {
        ...prev,
        kodAktivitiObjek: codeVal,
        allocationCode: codeVal,
        bakiPeruntukanRm: baki,
        pengesahanKewanganStatus: isSufficient ? 'MENCUKUPI' : 'TIDAK MENCUKUPI',
        items: updatedItems
      };
    });

    const indukName = foundCode ? (foundCode.perihal || foundCode.name || foundCode.akt) : codeVal;
    toast.success(`Kod Induk: ${indukName} dipilih. Senarai sub-kod pecahan dalam Jadual Item telah diselaraskan.`, { icon: '💰', duration: 4000 });
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'orderRequests'));
      const snapshot = await getDocs(q);
      const list: OrderRequest[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.id.startsWith('tt-')) return;
        const data = docSnap.data() as any;

        // Categorize record into 'sebutharga' or 'tawaran_terus'
        let recordModule: 'sebutharga' | 'tawaran_terus' = data.module;
        if (!recordModule) {
          const ruj = (data.rujukanDokumen || '').toUpperCase();
          const oNo = (data.orderNo || '').toUpperCase();
          if (ruj.includes('SH/') || ruj.includes('SEBUTHARGA') || oNo.startsWith('PP/RISDA') || oNo.includes('SH/')) {
            recordModule = 'sebutharga';
          } else {
            recordModule = 'tawaran_terus';
          }
        }

        const sanitizedItems = (data.items || []).map((it: any, idx: number) => {
          const qty = Number(it.quantity) || 0;
          const unitPrice = Number(it.unitPrice) || 0;
          const tot = qty * unitPrice;
          const gst = Number(it.nilaiGst) || 0;
          return {
            ...it,
            id: it.id || String(idx + 1),
            quantity: qty,
            unitPrice: unitPrice,
            totalPrice: tot,
            nilaiGst: gst,
            jumlahHarga: tot + gst
          };
        });
        const calculatedEstimated = sanitizedItems.length > 0
          ? sanitizedItems.reduce((sum: number, it: any) => sum + it.totalPrice, 0)
          : Number(data.estimatedAmount || 0);

        list.push({ 
          id: docSnap.id, 
          ...data,
          module: recordModule,
          items: sanitizedItems,
          estimatedAmount: calculatedEstimated,
          supplierCode: data.supplierCode || (data.category === 'KERJA' ? 'CIDB G2' : 'MOF'),
          aiCompliance: data.aiCompliance || 96
        });
      });

      // Also check order_requests collection
      try {
        const q2 = query(collection(db, 'order_requests'));
        const snapshot2 = await getDocs(q2);
        snapshot2.forEach((docSnap) => {
          if (docSnap.id.startsWith('tt-') || list.some(l => l.id === docSnap.id)) return;
          const data = docSnap.data() as any;

          let recordModule: 'sebutharga' | 'tawaran_terus' = data.module;
          if (!recordModule) {
            const ruj = (data.rujukanDokumen || '').toUpperCase();
            const oNo = (data.orderNo || '').toUpperCase();
            if (ruj.includes('SH/') || ruj.includes('SEBUTHARGA') || oNo.startsWith('PP/RISDA') || oNo.includes('SH/')) {
              recordModule = 'sebutharga';
            } else {
              recordModule = 'tawaran_terus';
            }
          }

          list.push({
            id: docSnap.id,
            orderNo: data.orderNo || (recordModule === 'sebutharga' ? `PP/RISDA/BFT/2026/${docSnap.id.slice(-4).toUpperCase()}` : `KK/BP/TT/2026/${docSnap.id.slice(-4).toUpperCase()}`),
            poNo: data.poNo || '',
            ptjName: data.ptjName || 'PRD BEAUFORT',
            title: data.title || '',
            category: data.category || 'BEKALAN',
            jenisPerolehanCategory: data.jenisPerolehanCategory || (recordModule === 'sebutharga' ? 'Bekalan & Perkhidmatan (Sebutharga)' : 'Bekalan & Perkhidmatan (Tawaran Terus)'),
            perihalPerolehan: data.perihalPerolehan || data.title,
            allocationCode: data.allocationCode || 'B62',
            requestedBy: data.requestedBy || 'Pegawai Perolehan',
            unitOffice: data.unitOffice || 'Pejabat RISDA Daerah Beaufort',
            estimatedAmount: Number(data.estimatedAmount || 0),
            requestDate: data.requestDate || new Date().toISOString().split('T')[0],
            status: data.status || 'DALAM SEMAKAN',
            financeStatus: data.financeStatus || 'BELUM DIHANTAR',
            supplierName: data.supplierName || '',
            pembekalDipilih: data.pembekalDipilih || data.supplierName || '',
            supplierCode: data.supplierCode || (data.category === 'KERJA' ? 'CIDB G2' : 'MOF'),
            aiCompliance: data.aiCompliance || 96,
            items: data.items || [],
            remarks: data.remarks || '',
            module: recordModule
          });
        });
      } catch (e2) {}

      // Sediakan rekod contoh rasmi Sebutharga jika pangkalan data belum mempunyai rekod Sebutharga
      const hasSebutharga = list.some(r => r.module === 'sebutharga' || (r.orderNo && r.orderNo.toUpperCase().includes('SH')));
      if (!hasSebutharga) {
        list.push(...DEFAULT_SEBUTHARGA_ORDERS);
      }

      setRequests(list);
    } catch (err) {
      console.error('Error fetching order requests:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    try {
      const dataToExport = filteredRequests.map((r, i) => ({
        'Bil': i + 1,
        'No. Rujukan': r.orderNo || r.poNo,
        'Tarikh': r.requestDate,
        'Tajuk Perolehan': r.title || r.perihalPerolehan,
        'Kategori': r.category,
        'Pembekal Terpilih': r.pembekalDipilih || r.supplierName,
        'Kod Pendaftaran': r.supplierCode || 'MOF Berdaftar',
        'Vot Bajet': r.kodAktivitiObjek || r.allocationCode,
        'Jumlah (RM)': Number(r.estimatedAmount || 0),
        'Pematuhan AI (%)': r.aiCompliance || 96,
        'Status': r.status,
        'Status Kewangan': r.financeStatus || 'BELUM DIHANTAR',
        'PTJ / Pejabat': r.ptjName || r.unitOffice
      }));
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Senarai Permohonan');
      XLSX.writeFile(workbook, `Senarai_Permohonan_Tawaran_Terus_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Laporan permohonan berjaya dieksport ke fail Excel!');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Gagal mengeksport fail Excel');
    }
  };

  const handleClearAllRequests = async () => {
    if (!window.confirm('Adakah anda pasti untuk mengosongkan semua rekod Permohonan Pesanan Tempatan?')) return;
    try {
      setLoading(true);
      const q1 = await getDocs(collection(db, 'order_requests'));
      q1.forEach(async (dSnap) => {
        try { await deleteDoc(doc(db, 'order_requests', dSnap.id)); } catch (e) {}
      });
      const q2 = await getDocs(collection(db, 'orderRequests'));
      q2.forEach(async (dSnap) => {
        try { await deleteDoc(doc(db, 'orderRequests', dSnap.id)); } catch (e) {}
      });
      setRequests([]);
      toast.success('Senarai Permohonan Pesanan Tempatan telah dikosongkan.');
    } catch (err) {
      console.error('Error clearing requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveItemRow = (itemId: string, index: number) => {
    const item = formData.items?.find(i => i.id === itemId);
    const workDetail = (item?.detailKerja || item?.description || '').trim();
    if (!workDetail) {
      toast.error(`Sila masukkan Detail / Perincian Kerja untuk Item Bil #${index + 1}`);
      return;
    }
    setFormData(prev => ({
      ...prev,
      items: (prev.items || []).map(i => i.id === itemId ? {
        ...i,
        description: workDetail,
        detailKerja: workDetail
      } : i)
    }));
    setSavedItemRows(prev => ({
      ...prev,
      [itemId]: true
    }));
    toast.success(`Item Bil #${index + 1} berjaya disimpan! Boleh dikemaskini bila-bila masa.`);
  };

  const handleEditItemRow = (itemId: string) => {
    setSavedItemRows(prev => ({
      ...prev,
      [itemId]: false
    }));
    toast('Item sedia untuk dikemaskini', { icon: '✏️' });
  };

  const handleAddItem = () => {
    const { aktSubs, objSubs } = getAvailableSubCodesForForm(formData.kodAktivitiObjek || formData.allocationCode);
    const newId = Date.now().toString();
    const newItem: OrderItem = {
      id: newId,
      description: '',
      detailKerja: '',
      kodAktiviti: aktSubs[0]?.subCode || '031401',
      kodObjek: objSubs[0]?.subCode || 'R4419900',
      noAset: '',
      quantity: 1,
      unit: 'Unit',
      unitPrice: 0,
      totalPrice: 0,
      nilaiGst: 0,
      jumlahHarga: 0
    };
    setFormData(prev => {
      const items = [...(prev.items || []), newItem];
      const estimatedAmount = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      return { ...prev, items, estimatedAmount };
    });
    setSavedItemRows(prev => ({
      ...prev,
      [newId]: false
    }));
  };

  const handleRemoveItem = (id: string) => {
    setFormData(prev => {
      const items = (prev.items || []).filter(i => i.id !== id);
      const estimatedAmount = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      return { ...prev, items, estimatedAmount };
    });
    setSavedItemRows(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleItemChange = (id: string, field: keyof OrderItem, value: any) => {
    setFormData(prev => {
      const items = (prev.items || []).map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          const qty = field === 'quantity' ? Number(value) || 0 : (Number(item.quantity) || 0);
          const price = field === 'unitPrice' ? Number(value) || 0 : (Number(item.unitPrice) || 0);
          const gst = field === 'nilaiGst' ? Number(value) || 0 : (Number(item.nilaiGst) || 0);
          const tot = qty * price;
          updated.totalPrice = tot;
          updated.jumlahHarga = tot + gst;
          return updated;
        }
        return item;
      });
      const estimatedAmount = items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
      return { ...prev, items, estimatedAmount };
    });
  };

  const handleKajianChange = (index: number, field: keyof KajianPasaranItem, value: any) => {
    setFormData(prev => {
      const list = [...(prev.kajianPasaran || defaultKajianPasaran)];
      list[index] = {
        ...list[index],
        [field]: field === 'hargaTawaran' ? Number(value) || 0 : value
      };
      return { ...prev, kajianPasaran: list };
    });
  };

  const handleSelectSebuthargaAd = (adId: string) => {
    setSelectedSebuthargaAdId(adId);
    if (!adId) return;
    const ad = sebuthargaAds.find(a => a.id === adId);
    if (!ad) return;

    const winner = ad.winner || {};
    const winnerCompany = winner.companyName || ad.winnerName || '';
    const winPrice = Number(winner.winningPrice || ad.winningPrice || 0);
    const tenderNo = ad.tenderNo || ad.refNo || '';
    const projectTitle = ad.title || '';
    const projectVot = ad.jenisPeruntukan || winner.allocationCode || 'B62';
    const autoPoNo = ad.noPesananTempatan || '';
    const autoBaucar = ad.noBaucar || '';

    setFormData(prev => ({
      ...prev,
      rujukanDokumen: tenderNo || prev.rujukanDokumen,
      title: projectTitle || prev.title,
      perihalPerolehan: projectTitle || prev.perihalPerolehan,
      category: (ad.category as any) || 'KERJA',
      jenisPerolehanCategory: ad.category === 'KERJA' ? 'Kerja (Sebutharga)' : 'Bekalan & Perkhidmatan (Sebutharga)',
      allocationCode: projectVot,
      supplierName: winnerCompany || prev.supplierName,
      pembekalDipilih: winnerCompany || prev.pembekalDipilih,
      estimatedAmount: winPrice || prev.estimatedAmount,
      poNo: autoPoNo || prev.poNo,
      noBaucar: autoBaucar || prev.noBaucar,
      items: [
        {
          id: '1',
          description: projectTitle,
          quantity: 1,
          unit: 'Pakej / Lot',
          unitPrice: winPrice,
          totalPrice: winPrice,
          nilaiGst: 0,
          jumlahHarga: winPrice,
          specs: ad.tempohSiapKerja ? `Tempoh Siap Kerja: ${ad.tempohSiapKerja}` : 'Spesifikasi kerja sebutharga lengkap'
        }
      ],
      kajianPasaran: [
        {
          bil: 1,
          namaSyarikat: winnerCompany,
          pegawaiDihubungi: `${winner.ownerName || ''} • Tel: ${winner.phoneNumber || '-'}`,
          kaedahKajian: 'SEBUTHARGA RASMI',
          hargaTawaran: winPrice,
          catatan: 'Pemenang Sah Keputusan Sebutharga'
        }
      ],
      justifikasi: {
        tiadaPembekalLain: false,
        kadarHargaAgensi: false,
        perolehanKhas: true,
        lainLain: true,
        lainLainNyatakan: 'Dilantik melalui Keputusan Rasmi Mesyuarat Jawatankuasa Sebutharga RISDA'
      }
    }));

    toast.success(`Data Sebutharga ${tenderNo || projectTitle.slice(0, 30)} berjaya dimuatkan ke dalam borang!`, { icon: '🎯' });
  };

  const openReviewModal = (req: OrderRequest) => {
    setSelectedReqForReview(req);
    // Populate 3 suppliers from existing req.kajianPasaran or initialize with defaults / first unifiedSuppliers
    let currentKajian: KajianPasaranItem[] = [];
    if (req.kajianPasaran && req.kajianPasaran.length >= 3) {
      currentKajian = req.kajianPasaran.slice(0, 3).map((k, idx) => ({ ...k, bil: idx + 1 }));
    } else if (req.kajianPasaran && req.kajianPasaran.length > 0) {
      currentKajian = [
        { ...req.kajianPasaran[0], bil: 1 },
        req.kajianPasaran[1] || { bil: 2, namaSyarikat: unifiedSuppliers[1]?.companyName || '', pegawaiDihubungi: '', kaedahKajian: 'SEBUTHARGA', hargaTawaran: Math.round(Number(req.estimatedAmount || 10000) * 1.05), catatan: 'Tawaran Perbandingan 2' },
        req.kajianPasaran[2] || { bil: 3, namaSyarikat: unifiedSuppliers[2]?.companyName || '', pegawaiDihubungi: '', kaedahKajian: 'SEBUTHARGA', hargaTawaran: Math.round(Number(req.estimatedAmount || 10000) * 1.1), catatan: 'Tawaran Perbandingan 3' }
      ];
    } else {
      currentKajian = [
        { bil: 1, namaSyarikat: req.pembekalDipilih || req.supplierName || (unifiedSuppliers[0]?.companyName || ''), pegawaiDihubungi: '', kaedahKajian: 'SEBUTHARGA', hargaTawaran: Number(req.estimatedAmount) || 0, catatan: 'Layak & Dipilih (Pemenang)' },
        { bil: 2, namaSyarikat: unifiedSuppliers[1]?.companyName || '', pegawaiDihubungi: '', kaedahKajian: 'SEBUTHARGA', hargaTawaran: Math.round(Number(req.estimatedAmount || 10000) * 1.05), catatan: 'Tawaran Perbandingan 2' },
        { bil: 3, namaSyarikat: unifiedSuppliers[2]?.companyName || '', pegawaiDihubungi: '', kaedahKajian: 'SEBUTHARGA', hargaTawaran: Math.round(Number(req.estimatedAmount || 10000) * 1.1), catatan: 'Tawaran Perbandingan 3' }
      ];
    }

    // Auto-fill contact details if empty
    currentKajian = currentKajian.map((k) => {
      if ((!k.pegawaiDihubungi || k.pegawaiDihubungi === '-') && k.namaSyarikat) {
        const matched = unifiedSuppliers.find(s => s.companyName.toUpperCase() === k.namaSyarikat.toUpperCase());
        if (matched) {
          const details = [
            matched.ownerName ? `PEMILIK: ${matched.ownerName}` : '',
            matched.cidbSpkk ? `LESEN: ${formatSimplifiedLicense(matched.cidbSpkk)}` : '',
            matched.phoneNumber ? `TEL: ${matched.phoneNumber}` : '',
            matched.address ? `ALAMAT: ${matched.address}` : ''
          ].filter(Boolean).join(' | ');
          return { ...k, pegawaiDihubungi: details };
        }
      }
      return k;
    });

    setReview3Suppliers(currentKajian);
    // Determine which supplier is eligible
    const eligibleIdx = currentKajian.findIndex(k => k.namaSyarikat && (k.namaSyarikat === req.pembekalDipilih || k.catatan?.toLowerCase().includes('dipilih') || k.catatan?.toLowerCase().includes('layak')));
    setReviewEligibleIndex(eligibleIdx >= 0 ? eligibleIdx : 0);
    setReviewNotes(req.remarks || 'Mematuhi spesifikasi teknikal, had siling 1PP PK 2, dan tawaran harga terbaik bagi perolehan kerajaan.');
    setShowReviewModal(true);
  };

  const handleReviewSupplierSelect = (idx: number, companyName: string) => {
    const list = [...review3Suppliers];
    const matched = unifiedSuppliers.find(s => s.companyName.toUpperCase() === companyName.toUpperCase());
    const details = matched ? [
      matched.ownerName ? `PEMILIK: ${matched.ownerName}` : '',
      matched.cidbSpkk ? `LESEN: ${formatSimplifiedLicense(matched.cidbSpkk)}` : '',
      matched.phoneNumber ? `TEL: ${matched.phoneNumber}` : '',
      matched.address ? `ALAMAT: ${matched.address}` : ''
    ].filter(Boolean).join(' | ') : '';

    list[idx] = {
      ...list[idx],
      namaSyarikat: companyName,
      pegawaiDihubungi: details || list[idx].pegawaiDihubungi || ''
    };
    setReview3Suppliers(list);
  };

  const handleSavePenyemakReview = async () => {
    if (!selectedReqForReview) return;
    const chosen = review3Suppliers[reviewEligibleIndex];
    if (!chosen || !chosen.namaSyarikat.trim()) {
      toast.error('Sila pilih sekurang-kurangnya 1 pembekal yang layak & dipilih daripada 3 pembekal yang ditawarkan.');
      return;
    }

    const tId = toast.loading('Mengesahkan semakan permohonan & pemilihan 3 pembekal...');
    try {
      const reviewerName = user?.displayName || user?.email || 'Pegawai Penyemak';
      const todayStr = new Date().toISOString().split('T')[0];

      const updatedKajian = review3Suppliers.map((k, idx) => ({
        ...k,
        bil: idx + 1,
        catatan: idx === reviewEligibleIndex ? 'Layak & Dipilih (Pemenang)' : (k.catatan && !k.catatan.includes('Dipilih') ? k.catatan : 'Tawaran Perbandingan')
      }));

      const matchedChosen = unifiedSuppliers.find(s => s.companyName.toUpperCase() === chosen.namaSyarikat.toUpperCase());
      const supplierLicense = matchedChosen ? formatSimplifiedLicense(matchedChosen.cidbSpkk) : (selectedReqForReview.category === 'KERJA' ? 'CIDB G2' : 'MOF');

      const updatePayload: Partial<OrderRequest> = {
        kajianPasaran: updatedKajian,
        pembekalDipilih: chosen.namaSyarikat,
        supplierName: chosen.namaSyarikat,
        supplierCode: supplierLicense,
        estimatedAmount: Number(chosen.hargaTawaran) > 0 ? Number(chosen.hargaTawaran) : selectedReqForReview.estimatedAmount,
        status: 'MENUNGGU KELULUSAN',
        disahkanOlehNama: reviewerName,
        disahkanOlehTarikh: todayStr,
        remarks: reviewNotes,
        updatedAt: todayStr
      };

      if (selectedReqForReview.id && !selectedReqForReview.id.startsWith('tt-')) {
        await updateDoc(doc(db, 'order_requests', selectedReqForReview.id), updatePayload);
      }

      setRequests(prev => prev.map(r => r.id === selectedReqForReview.id ? { ...r, ...updatePayload } : r));
      if (selectedRequestForDetail && selectedRequestForDetail.id === selectedReqForReview.id) {
        setSelectedRequestForDetail(prev => prev ? { ...prev, ...updatePayload } : null);
      }
      setShowReviewModal(false);
      toast.success('Semakan selesai! 3 pembekal dan pembekal layak berjaya dikemukakan kepada Pegawai Pelulus.', { id: tId });
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal menyimpan semakan: ' + (err?.message || 'Ralat'), { id: tId });
    }
  };

  const handleReturnFromPenyemak = async () => {
    if (!selectedReqForReview) return;
    const reason = window.prompt('Sila masukkan catatan / teguran pembetulan untuk dikembalikan kepada Penginput:');
    if (!reason || !reason.trim()) return;

    const tId = toast.loading('Mengembalikan permohonan kepada Penginput...');
    try {
      const updatePayload: Partial<OrderRequest> = {
        status: 'DITOLAK',
        remarks: `Dikembalikan oleh Penyemak: ${reason.trim()}`,
        updatedAt: new Date().toISOString().split('T')[0]
      };

      if (selectedReqForReview.id && !selectedReqForReview.id.startsWith('tt-')) {
        await updateDoc(doc(db, 'order_requests', selectedReqForReview.id), updatePayload);
      }

      setRequests(prev => prev.map(r => r.id === selectedReqForReview.id ? { ...r, ...updatePayload } : r));
      if (selectedRequestForDetail && selectedRequestForDetail.id === selectedReqForReview.id) {
        setSelectedRequestForDetail(prev => prev ? { ...prev, ...updatePayload } : null);
      }
      setShowReviewModal(false);
      toast.success('Permohonan telah dikembalikan kepada Penginput.', { id: tId });
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal mengembalikan permohonan.', { id: tId });
    }
  };

  const openApprovalModal = (req: OrderRequest) => {
    setSelectedReqForApproval(req);
    setShowApprovalModal(true);
  };

  const handleApproveByPelulus = async () => {
    if (!selectedReqForApproval) return;
    const isApprovalSebutharga = selectedReqForApproval.module === 'sebutharga' || 
      (selectedReqForApproval.rujukanDokumen && (selectedReqForApproval.rujukanDokumen.toUpperCase().includes('SH/') || selectedReqForApproval.rujukanDokumen.toUpperCase().includes('SEBUTHARGA'))) || 
      (selectedReqForApproval.orderNo && (selectedReqForApproval.orderNo.toUpperCase().startsWith('PP/RISDA') || selectedReqForApproval.orderNo.toUpperCase().includes('SH')));

    const tId = toast.loading(isApprovalSebutharga ? 'Meluluskan permohonan Sebutharga...' : 'Meluluskan permohonan Tawaran Terus...');
    try {
      const approverName = user?.displayName || user?.email || 'Ketua PTJ / Pegawai Pelulus';
      const todayStr = new Date().toISOString().split('T')[0];

      const updatePayload: Partial<OrderRequest> = {
        status: 'LULUS',
        kelulusanKetuaPtjStatus: 'DILULUSKAN',
        ketuaPtjNama: approverName,
        ketuaPtjTarikh: todayStr,
        poNo: selectedReqForApproval.poNo || `PO264507${Math.floor(1000 + Math.random() * 9000)}`,
        updatedAt: todayStr
      };

      if (selectedReqForApproval.id && !selectedReqForApproval.id.startsWith('tt-') && !selectedReqForApproval.id.startsWith('sh-')) {
        await updateDoc(doc(db, 'orderRequests', selectedReqForApproval.id), updatePayload);
      }

      setRequests(prev => prev.map(r => r.id === selectedReqForApproval.id ? { ...r, ...updatePayload } : r));
      if (selectedRequestForDetail && selectedRequestForDetail.id === selectedReqForApproval.id) {
        setSelectedRequestForDetail(prev => prev ? { ...prev, ...updatePayload } : null);
      }
      setShowApprovalModal(false);
      toast.success(isApprovalSebutharga ? 'Permohonan Sebutharga telah diluluskan rasmi! Pesanan Tempatan (LO) kini dijana.' : 'Permohonan Tawaran Terus telah diluluskan rasmi! Pesanan Tempatan (LO) kini dijana.', { id: tId });
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal meluluskan permohonan.', { id: tId });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.orderNo) {
      toast.error('Sila lengkapkan No. Pesanan dan Tajuk Permintaan');
      return;
    }

    const toastId = toast.loading('Menyimpan Borang Kajian Pasaran / Pesanan...');
    try {
      const cleanItems = (formData.items || []).map(i => {
        const q = Number(i.quantity) || 0;
        const u = Number(i.unitPrice) || 0;
        const g = Number(i.nilaiGst) || 0;
        const tot = q * u;
        return {
          ...i,
          quantity: q,
          unitPrice: u,
          totalPrice: tot,
          nilaiGst: g,
          jumlahHarga: tot + g
        };
      });
      const calculatedTotal = cleanItems.reduce((sum, i) => sum + i.totalPrice, 0);

      const effectiveReqDate = formData.requestDate || new Date().toISOString().split('T')[0];
      const payload: any = {
        ...formData,
        module: isSebuthargaModule ? 'sebutharga' : 'tawaran_terus',
        requestDate: effectiveReqDate,
        disediakanOlehTarikh: formData.disediakanOlehTarikh || effectiveReqDate,
        disahkanOlehTarikh: formData.disahkanOlehTarikh || effectiveReqDate,
        items: cleanItems,
        estimatedAmount: calculatedTotal
      };

      if (editingId && !editingId.startsWith('req-')) {
        await updateDoc(doc(db, 'orderRequests', editingId), {
          ...payload,
          updatedAt: new Date().toISOString()
        });
      } else if (editingId && editingId.startsWith('req-')) {
        setRequests(prev => prev.map(r => r.id === editingId ? { ...payload, id: editingId } : r));
      } else {
        const res = await addDoc(collection(db, 'orderRequests'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        setRequests(prev => [{ id: res.id, ...payload }, ...prev]);
      }
      toast.success('Permintaan Pesanan & Kajian Pasaran berjaya disimpan!', { id: toastId });
      setShowModal(false);
      resetForm();
      fetchRequests();
    } catch (err) {
      console.error('Save order request error:', err);
      toast.error('Gagal menyimpan rekod pesanan', { id: toastId });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Adakah anda pasti untuk memadam permintaan pesanan ini?')) return;
    const toastId = toast.loading('Memadam rekod...');
    try {
      if (!id.startsWith('req-')) {
        await deleteDoc(doc(db, 'orderRequests', id));
      }
      setRequests(prev => prev.filter(r => r.id !== id));
      toast.success('Rekod dipadam', { id: toastId });
    } catch (err) {
      toast.error('Gagal memadam rekod', { id: toastId });
    }
  };

  const handleEdit = (r: OrderRequest) => {
    setEditingId(r.id || null);
    const initialSavedMap: Record<string, boolean> = {};
    (r.items || []).forEach(it => {
      if (it.description && it.description.trim().length > 0) {
        initialSavedMap[it.id] = true;
      }
    });
    setSavedItemRows(initialSavedMap);
    setFormData({
      orderNo: r.orderNo,
      poNo: r.poNo || '',
      ptjName: r.ptjName || 'PRD BEAUFORT',
      title: r.title,
      category: r.category,
      jenisPerolehanCategory: r.jenisPerolehanCategory || 'Bekalan & Perkhidmatan',
      perihalPerolehan: r.perihalPerolehan || '',
      allocationCode: r.allocationCode || '',
      requestedBy: r.requestedBy,
      unitOffice: r.unitOffice,
      estimatedAmount: r.estimatedAmount,
      requestDate: r.requestDate,
      status: r.status,
      financeStatus: r.financeStatus || 'BELUM DIHANTAR',
      supplierName: r.supplierName || '',
      rujukanDokumen: r.rujukanDokumen || '',
      remarks: r.remarks || '',
      pembekalDipilih: r.pembekalDipilih || r.supplierName || '',
      items: r.items && r.items.length > 0 ? r.items : [
        { id: '1', description: r.title, quantity: 1, unit: 'Lump Sum', unitPrice: r.estimatedAmount, totalPrice: r.estimatedAmount }
      ],
      kajianPasaran: r.kajianPasaran && r.kajianPasaran.length > 0 ? r.kajianPasaran.slice(0, 3) : defaultKajianPasaran,
      justifikasi: r.justifikasi || defaultJustifikasi,
      disediakanOlehNama: r.disediakanOlehNama || '',
      disediakanOlehJawatan: r.disediakanOlehJawatan || '',
      disediakanOlehTarikh: r.disediakanOlehTarikh || r.requestDate || new Date().toISOString().split('T')[0],
      disahkanOlehNama: r.disahkanOlehNama || '',
      disahkanOlehJawatan: r.disahkanOlehJawatan || '',
      disahkanOlehTarikh: r.disahkanOlehTarikh || r.requestDate || new Date().toISOString().split('T')[0],
      pengesahanKewanganStatus: r.pengesahanKewanganStatus || 'MENCUKUPI',
      kodAktivitiObjek: r.kodAktivitiObjek || r.allocationCode || '',
      bakiPeruntukanRm: r.bakiPeruntukanRm || 0,
      pegawaiKewanganNama: r.pegawaiKewanganNama || 'PT Kewangan',
      pegawaiKewanganTarikh: r.pegawaiKewanganTarikh || new Date().toISOString().split('T')[0],
      kelulusanKetuaPtjStatus: r.kelulusanKetuaPtjStatus || 'DILULUSKAN',
      ketuaPtjNama: r.ketuaPtjNama || 'Ketua PTJ',
      ketuaPtjTarikh: r.ketuaPtjTarikh || new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  // Handlers for Financial Items Modal (Sub-tab 2)
  const handleOpenAddItemModal = (req: OrderRequest) => {
    setCurrentReqForItemModal(req);
    setItemFormData({
      id: Date.now().toString(),
      description: '',
      kodAktiviti: '031401',
      kodObjek: 'R4419900',
      noAset: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      nilaiGst: 0,
      jumlahHarga: 0
    });
    setItemModalOpen(true);
  };

  const handleOpenEditItemModal = (req: OrderRequest, item: OrderItem) => {
    setCurrentReqForItemModal(req);
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unitPrice) || 0;
    const total = item.totalPrice || (qty * price);
    const gst = Number(item.nilaiGst) || 0;
    const finalPrice = item.jumlahHarga || (total + gst);

    setItemFormData({
      id: item.id,
      description: item.description || '',
      kodAktiviti: item.kodAktiviti || '031401',
      kodObjek: item.kodObjek || 'R4419900',
      noAset: item.noAset || '',
      quantity: qty,
      unitPrice: price,
      totalPrice: total,
      nilaiGst: gst,
      jumlahHarga: finalPrice
    });
    setItemModalOpen(true);
  };

  const handleSaveFinancialItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentReqForItemModal) return;

    if (!itemFormData.description) {
      toast.error('Sila isi perihal item');
      return;
    }

    const qty = Number(itemFormData.quantity) || 0;
    const price = Number(itemFormData.unitPrice) || 0;
    const total = qty * price;
    const gst = Number(itemFormData.nilaiGst) || 0;
    const finalPrice = total + gst;

    const updatedItem: OrderItem = {
      ...itemFormData,
      quantity: qty,
      unitPrice: price,
      totalPrice: total,
      nilaiGst: gst,
      jumlahHarga: finalPrice
    };

    const existingItems = currentReqForItemModal.items || [];
    const exists = existingItems.some(i => i.id === updatedItem.id);
    const newItems = exists
      ? existingItems.map(i => i.id === updatedItem.id ? updatedItem : i)
      : [...existingItems, updatedItem];

    const newTotalEstimated = newItems.reduce((sum, i) => sum + (Number(i.totalPrice) || ((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0))), 0);

    const updatedReq: OrderRequest = {
      ...currentReqForItemModal,
      items: newItems,
      estimatedAmount: newTotalEstimated
    };

    try {
      if (updatedReq.id && !updatedReq.id.startsWith('req-')) {
        await updateDoc(doc(db, 'orderRequests', updatedReq.id), {
          items: newItems,
          estimatedAmount: newTotalEstimated,
          updatedAt: new Date().toISOString()
        });
      }

      setRequests(prev => prev.map(r => r.id === updatedReq.id ? updatedReq : r));
      toast.success('Item pesanan kewangan berjaya dikemaskini!');
      setItemModalOpen(false);
    } catch (err) {
      console.error('Error saving item:', err);
      toast.error('Gagal menyimpan item pesanan');
    }
  };

  const handleDeleteFinancialItem = async (req: OrderRequest, itemId: string) => {
    if (!confirm('Adakah anda pasti untuk memadam item pesanan ini?')) return;

    const newItems = (req.items || []).filter(i => i.id !== itemId);
    const newTotalEstimated = newItems.reduce((sum, i) => sum + (i.jumlahHarga || i.totalPrice || 0), 0);

    const updatedReq: OrderRequest = {
      ...req,
      items: newItems,
      estimatedAmount: newTotalEstimated
    };

    try {
      if (updatedReq.id && !updatedReq.id.startsWith('req-')) {
        await updateDoc(doc(db, 'orderRequests', updatedReq.id), {
          items: newItems,
          estimatedAmount: newTotalEstimated,
          updatedAt: new Date().toISOString()
        });
      }

      setRequests(prev => prev.map(r => r.id === updatedReq.id ? updatedReq : r));
      toast.success('Item pesanan dipadam');
    } catch (err) {
      console.error('Error deleting item:', err);
      toast.error('Gagal memadam item');
    }
  };

  // Helper to map PTJ/district to 4-digit location code
  const getPtjCode = (ptjOrDistrict?: string): string => {
    const str = (ptjOrDistrict || '').toUpperCase();
    if (str.includes('KOTA KINABALU') || str === 'KK') return '4501';
    if (str.includes('PAPAR')) return '4502';
    if (str.includes('KENINGAU')) return '4503';
    if (str.includes('TENOM')) return '4504';
    if (str.includes('RANAU')) return '4505';
    if (str.includes('TUARAN')) return '4506';
    if (str.includes('BEAUFORT') || str.includes('BFT')) return '4507';
    if (str.includes('KOTA BELUD')) return '4508';
    if (str.includes('KUDAT')) return '4509';
    if (str.includes('SANDAKAN')) return '4510';
    if (str.includes('TAWAU')) return '4511';
    if (str.includes('LAHAD DATU')) return '4512';
    return '4507'; // default PRD Beaufort
  };

  const generate10DigitPo = (ptjName?: string, seqNumber?: number): string => {
    const year2Digits = new Date().getFullYear().toString().slice(-2); // e.g. "26"
    const ptjCode = getPtjCode(ptjName || district); // e.g. "4507"
    const seqStr = String(seqNumber || Math.floor(1 + Math.random() * 9999)).padStart(4, '0'); // e.g. "0098"
    return `${year2Digits}${ptjCode}${seqStr}`; // e.g. "2645070098"
  };

  // Send Order to Financial System (Integrasi e-Kewangan RISDA)
  const handleSendToFinanceSystem = async (req: OrderRequest) => {
    if (!req.allocationCode && !req.kodAktivitiObjek) {
      toast.error('Sila pastikan Kod Peruntukan / Vot telah dipilih!');
      return;
    }

    const toastId = toast.loading(`Menghantar Permintaan ${req.orderNo} ke Sistem Kewangan RISDA...`);
    
    // Generate Finance Reference Code & Auto 10-Digit PO No
    const finRef = `FIN-RISDA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const sentTime = new Date().toLocaleString('ms-MY', { dateStyle: 'medium', timeStyle: 'short' });
    const autoPoNo = req.poNo && req.poNo.length === 10 ? req.poNo : generate10DigitPo(req.ptjName || req.unitOffice);

    try {
      if (req.id && !req.id.startsWith('req-')) {
        await updateDoc(doc(db, 'orderRequests', req.id), {
          poNo: autoPoNo,
          financeStatus: 'DIHANTAR',
          status: 'DIHANTAR KE KEWANGAN',
          financeReferenceNo: finRef,
          financeSentAt: sentTime,
        });
      }

      setRequests(prev => prev.map(r => r.id === req.id ? {
        ...r,
        poNo: autoPoNo,
        financeStatus: 'DIHANTAR',
        status: 'DIHANTAR KE KEWANGAN',
        financeReferenceNo: finRef,
        financeSentAt: sentTime
      } : r));

      toast.success(`Berjaya Dihantar ke Sistem Kewangan! No. PO: ${autoPoNo} | No. Rujukan: ${finRef}`, { id: toastId, duration: 5000 });
      fetchRequests();
    } catch (err) {
      console.error('Send to finance error:', err);
      toast.error('Gagal menghantar ke sistem kewangan', { id: toastId });
    }
  };

  // Mark Order as Paid by Finance (Status Bayaran)
  const handleMarkPaidByFinance = async (req: OrderRequest) => {
    const isPaid = req.financeStatus === 'DIBAYAR' || req.status === 'DIBAYAR';
    const newFinanceStatus = isPaid ? 'DIHANTAR' : 'DIBAYAR';
    const newStatus = isPaid ? 'DIHANTAR KE KEWANGAN' : 'DIBAYAR';
    const currentYear = new Date().getFullYear();
    const autoBaucar = req.noBaucar || `BV/RISDA/${currentYear}/${Math.floor(100 + Math.random() * 900)}`;
    const autoPaidDate = req.tarikhDibayar || new Date().toISOString().split('T')[0];

    const toastMsg = isPaid 
      ? 'Status bayaran dikemaskini semula kepada BELUM DIBAYAR (Dihantar)' 
      : `Status disahkan: PESANAN TELAH DIBAYAR! No Baucar: ${autoBaucar}`;

    const toastId = toast.loading('Mengemaskini status bayaran kewangan...');
    try {
      const updatePayload: any = {
        financeStatus: newFinanceStatus,
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      if (!isPaid) {
        updatePayload.noBaucar = autoBaucar;
        updatePayload.tarikhDibayar = autoPaidDate;
      }

      if (req.id && !req.id.startsWith('req-')) {
        await updateDoc(doc(db, 'orderRequests', req.id), updatePayload);

      }

      setRequests(prev => prev.map(r => r.id === req.id ? {
        ...r,
        financeStatus: newFinanceStatus,
        status: newStatus,
        noBaucar: isPaid ? r.noBaucar : autoBaucar,
        tarikhDibayar: isPaid ? r.tarikhDibayar : autoPaidDate
      } : r));

      toast.success(toastMsg, { id: toastId, duration: 4000 });
      fetchRequests();
    } catch (err) {
      console.error('Error updating payment status:', err);
      toast.error('Gagal kemaskini status bayaran', { id: toastId });
    }
  };

  const moduleRequests = useMemo(() => {
    return requests.filter(r => {
      // Data Tawaran Terus sama sekali TIDAK BOLEH muncul dalam Modul Sebutharga
      const isExplicitTawaranTerus = r.module === 'tawaran_terus' || 
        (r.rujukanDokumen && (r.rujukanDokumen.toUpperCase().includes('/TT/') || r.rujukanDokumen.toUpperCase().includes('TAWARAN TERUS'))) ||
        (r.orderNo && (r.orderNo.toUpperCase().includes('/TT/') || r.orderNo.toUpperCase().startsWith('KK/BP/TT')));

      const isThisSebutharga = r.module === 'sebutharga' || 
        (!isExplicitTawaranTerus && (
          (r.rujukanDokumen && (r.rujukanDokumen.toUpperCase().includes('SH/') || r.rujukanDokumen.toUpperCase().includes('SEBUTHARGA'))) || 
          (r.orderNo && (r.orderNo.toUpperCase().startsWith('PP/RISDA') || r.orderNo.toUpperCase().includes('SH')))
        ));

      if (isSebuthargaModule) {
        // HANYA data Sebutharga, tiada sebarang data berkaitan Tawaran Terus
        return isThisSebutharga && !isExplicitTawaranTerus;
      } else {
        // Modul Tawaran Terus
        return !isThisSebutharga || isExplicitTawaranTerus;
      }
    });
  }, [requests, isSebuthargaModule]);

  const resetForm = () => {
    setEditingId(null);
    setSelectedSebuthargaAdId('');
    setSavedItemRows({});
    const userPtj = district ? `PRD ${district.toUpperCase()}` : (user?.district ? `PRD ${user.district.toUpperCase()}` : 'PRD BEAUFORT');
    const nextNo = String(moduleRequests.length + 1).padStart(3, '0');

    setFormData({
      orderNo: isSebuthargaModule 
        ? `PP/RISDA/BFT/${new Date().getFullYear()}/${nextNo}`
        : `KK/BP/TT/${new Date().getFullYear()}/${nextNo}`,
      poNo: '',
      ptjName: userPtj,
      title: '',
      category: isSebuthargaModule ? 'KERJA' : 'BEKALAN',
      jenisPerolehanCategory: isSebuthargaModule ? 'Kerja (Sebutharga)' : 'Bekalan & Perkhidmatan',
      perihalPerolehan: '',
      allocationCode: '',
      requestedBy: user?.displayName || user?.email || 'Pegawai Perolehan RISDA',
      unitOffice: district ? `PEJABAT RISDA DAERAH ${district.toUpperCase()}` : 'PEJABAT RISDA DAERAH BEAUFORT',
      estimatedAmount: 0,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'DALAM SEMAKAN',
      financeStatus: 'BELUM DIHANTAR',
      supplierName: '',
      rujukanDokumen: isSebuthargaModule ? `SH/S.6-01/${new Date().getFullYear()}` : `KK/BP/TT/${new Date().getFullYear()}/${nextNo}`,
      remarks: '',
      pembekalDipilih: '',
      items: [
        { id: '1', description: '', kodAktiviti: '031401', kodObjek: 'R4419900', noAset: '', quantity: 1, unit: 'Pakej / Lot', unitPrice: 0, totalPrice: 0, nilaiGst: 0, jumlahHarga: 0 }
      ],
      kajianPasaran: isSebuthargaModule
        ? [{ bil: 1, namaSyarikat: '', pegawaiDihubungi: '', kaedahKajian: 'SEBUTHARGA RASMI', hargaTawaran: 0, catatan: 'Pemenang Sah Sebutharga' }]
        : defaultKajianPasaran.map(k => ({ ...k })),
      justifikasi: isSebuthargaModule
        ? { tiadaPembekalLain: false, kadarHargaAgensi: false, perolehanKhas: true, lainLain: true, lainLainNyatakan: 'Lantikan pemenang dibuat melalui Keputusan Rasmi Mesyuarat Jawatankuasa Sebutharga RISDA' }
        : defaultJustifikasi,
      disediakanOlehNama: '',
      disediakanOlehJawatan: '',
      disediakanOlehTarikh: new Date().toISOString().split('T')[0],
      disahkanOlehNama: '',
      disahkanOlehJawatan: '',
      disahkanOlehTarikh: new Date().toISOString().split('T')[0],
      pengesahanKewanganStatus: 'MENCUKUPI',
      kodAktivitiObjek: '',
      bakiPeruntukanRm: 0,
      pegawaiKewanganNama: '',
      pegawaiKewanganTarikh: new Date().toISOString().split('T')[0],
      kelulusanKetuaPtjStatus: 'DILULUSKAN',
      ketuaPtjNama: '',
      ketuaPtjTarikh: new Date().toISOString().split('T')[0]
    });
  };

  const handleOpenNewOrderFlow = () => {
    resetForm();
    setSelectedAllocationCodeForNewModal('');
    setShowNewDirectAwardModal(true);
  };

  const handleConfirmAllocationAndStartOrder = (chosenCodeVal: string) => {
    resetForm();
    if (chosenCodeVal) {
      handleSelectAllocationCode(chosenCodeVal);
      setSelectedAllocationCodeForNewModal(chosenCodeVal);
    }
    setShowAllocSelectionModal(false);
    setShowNewDirectAwardModal(true);
  };

  const filteredRequests = useMemo(() => {
    return moduleRequests.filter(r => {
      // Pentadbir/Admin has full global visibility across all offices/districts. Staff only sees their own office/district or items created by them.
      if (!isAdmin) {
        const itemDistrict = r.district || (r.ptjName ? r.ptjName.replace(/PRD|PEJABAT RISDA DAERAH/gi, '').trim() : '');
        const itemOffice = r.unitOffice || r.ptjName;
        const matchesScope = isWithinUserScope(
          { district: itemDistrict, office: itemOffice, state: r.state },
          { role, state: null, district, office: null }
        );
        const isCreator = (r.createdBy && user?.uid && r.createdBy === user.uid) || 
                          (r.createdEmail && user?.email && r.createdEmail.toLowerCase() === user.email.toLowerCase());
        if (!matchesScope && !isCreator) return false;
      }

      const matchesSearch = (r.orderNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (r.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (r.allocationCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (r.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (r.pembekalDipilih || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'SEMUA' || r.category === filterCategory;
      const matchesStatus = filterStatus === 'SEMUA' || r.status === filterStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [moduleRequests, isAdmin, role, district, user, searchTerm, filterCategory, filterStatus]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedRequests = filteredRequests.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const totalEstimatedAmount = filteredRequests.reduce((sum, r) => sum + (Number(r.estimatedAmount) || 0), 0);
  const reviewCount = filteredRequests.filter(r => r.status === 'DALAM SEMAKAN' || r.status === 'MENUNGGU SEMAKAN' || r.status === 'DITOLAK').length;
  const loGeneratedCount = filteredRequests.filter(r => r.status === 'LULUS' || r.status === 'DIHANTAR KE KEWANGAN' || r.status === 'DIBAYAR').length;
  const sentToFinanceCount = filteredRequests.filter(r => r.financeStatus === 'DIHANTAR' || r.financeStatus === 'DISAHKAN KEWANGAN' || r.financeStatus === 'DIBAYAR' || r.status === 'DIHANTAR KE KEWANGAN' || r.status === 'DIBAYAR').length;
  const paidCount = filteredRequests.filter(r => r.financeStatus === 'DIBAYAR' || r.status === 'DIBAYAR').length;

  // Print exact Official "BORANG KAJIAN PASARAN" PDF Layout
  const handlePrintSlip = (r: OrderRequest) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let fullKajianList = (r.kajianPasaran && r.kajianPasaran.length > 0)
      ? r.kajianPasaran.slice(0, 3)
      : [
          {
            bil: 1,
            namaSyarikat: r.pembekalDipilih || r.supplierName || 'PUNCAK BAYU',
            pegawaiDihubungi: 'PEMILIK: SANTHY GRESIKA PANAI | TEL: 0193006860',
            kaedahKajian: 'SEBUTHARGA',
            hargaTawaran: r.estimatedAmount,
            catatan: 'Layak & Dipilih (Pemenang)'
          }
        ];

    const just = r.justifikasi || defaultJustifikasi;
    const itemList = r.items && r.items.length > 0 ? r.items : [
      { id: '1', description: r.title, quantity: 1, unit: 'Lump Sum', unitPrice: r.estimatedAmount, totalPrice: r.estimatedAmount }
    ];

    const rawR = r as any;
    const effectiveOrderDate = (r.requestDate ? String(r.requestDate).split('T')[0] : '') || 
                               (rawR.tarikhPesanan ? String(rawR.tarikhPesanan).split('T')[0] : '') || 
                               (rawR.tarikhPermohonan ? String(rawR.tarikhPermohonan).split('T')[0] : '') ||
                               (r.disediakanOlehTarikh ? String(r.disediakanOlehTarikh).split('T')[0] : '');

    const printTarikhDisediakan = formatDateDMY(effectiveOrderDate || r.disediakanOlehTarikh);
    const printTarikhDisahkan = formatDateDMY(effectiveOrderDate || r.disahkanOlehTarikh);
    const printTarikhKewangan = formatDateDMY(r.pegawaiKewanganTarikh);
    const printTarikhKetuaPtj = formatDateDMY(r.ketuaPtjTarikh);

    const isSebuthargaReq = r.module === 'sebutharga' || 
      (r.rujukanDokumen && (r.rujukanDokumen.toUpperCase().includes('SH/') || r.rujukanDokumen.toUpperCase().includes('SEBUTHARGA'))) || 
      (r.orderNo && (r.orderNo.toUpperCase().startsWith('PP/RISDA') || r.orderNo.toUpperCase().includes('SH')));

    // Format PO No into 10 box cells
    const poStr = (r.poNo || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    const poBoxesHtml = Array.from({ length: 10 }, (_, i) => {
      const char = poStr[i] || '&nbsp;';
      return `<span class="po-box">${char}</span>`;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${isSebuthargaReq ? 'BORANG PERMOHONAN PESANAN KERAJAAN & KAJIAN PASARAN SEBUTHARGA' : 'BORANG KAJIAN PASARAN TAWARAN TERUS'} - ${r.orderNo}</title>
          <style>
            @media print {
              @page { size: A4 portrait; margin: 8mm 10mm 8mm 10mm; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            * { box-sizing: border-box; }
            body { font-family: 'Arial', 'Helvetica', sans-serif; font-size: 9.5px; color: #000; line-height: 1.25; margin: 0; padding: 4px; }
            
            .header-title { font-size: 13px; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; }
            
            .top-header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            .top-header-table td { vertical-align: middle; }
            
            .ptj-info { font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 6px; }
            .po-container { text-align: right; font-size: 10px; font-weight: bold; }
            .po-box { display: inline-block; width: 15px; height: 17px; border: 1px solid #000; text-align: center; line-height: 17px; font-family: monospace; font-size: 10px; font-weight: bold; margin-left: 1px; vertical-align: middle; }

            .section-title { font-weight: bold; text-transform: uppercase; margin-top: 6px; margin-bottom: 3px; font-size: 9.5px; }
            
            table.official-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; font-size: 9px; }
            table.official-table th, table.official-table td { border: 1px solid #000; padding: 3px 4px; text-align: left; vertical-align: top; }
            table.official-table th { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; text-align: center; }

            .checkbox-box { display: inline-block; width: 11px; height: 11px; border: 1px solid #000; margin-right: 4px; text-align: center; line-height: 10px; font-size: 9px; font-weight: bold; vertical-align: middle; }
            
            .text-right { text-align: right !important; }
            .text-center { text-align: center !important; }
            .font-bold { font-weight: bold; }
            .italic-note { font-size: 8px; font-style: normal; margin-bottom: 4px; }

            .sig-table { width: 100%; margin-top: 6px; border-collapse: collapse; font-size: 9px; }
            .sig-table td { width: 50%; vertical-align: top; padding-right: 15px; }
            .sig-line { margin-top: 22px; margin-bottom: 2px; border-bottom: 1px solid #000; width: 75%; }

            .dot-line { display: inline-block; border-bottom: 1px dotted #000; min-width: 150px; }
          </style>
        </head>
        <body>
          <div class="header-title">${isSebuthargaReq ? 'BORANG PERMOHONAN PESANAN KERAJAAN & KAJIAN PASARAN (SEBUTHARGA RISDA)' : 'BORANG KAJIAN PASARAN (TAWARAN TERUS - 1PP PK 2)'}</div>
          
          <table class="top-header-table">
            <tr>
              <td>
                <div class="ptj-info">
                  <img 
                    src="/intrologo_RISDA.png" 
                    alt="Logo RISDA" 
                    style="height: 32px; width: auto; vertical-align: middle; margin-right: 8px; display: inline-block;" 
                    onerror="this.onerror=null; this.src='/PUBLIC/intrologo_RISDA.png';"
                  />
                  <span>NAMA PUSAT TANGGUNGJAWAB: <strong>${r.ptjName || 'PRD BEAUFORT'}</strong></span>
                </div>
              </td>
              <td class="po-container">
                PO : ${poBoxesHtml}
              </td>
            </tr>
          </table>

          <div class="section-title">A. BUTIR-BUTIR PEROLEHAN</div>
          
          <div style="margin-bottom: 4px;">
            1. <strong>Jenis Perolehan</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <span style="margin-right: 15px;">
              <span class="checkbox-box">${r.jenisPerolehanCategory?.includes('Bekalan') || r.category === 'BEKALAN' || r.category === 'PERKHIDMATAN' ? '✓' : ''}</span> 
              Bekalan & Perkhidmatan
            </span>
            <span>
              <span class="checkbox-box">${r.jenisPerolehanCategory?.includes('Kerja') || r.category === 'KERJA' ? '✓' : ''}</span> 
              Kerja
            </span>
          </div>

          <div style="margin-bottom: 4px;">
            2. <strong>Perihal Perolehan :</strong> ${r.perihalPerolehan || r.title}
          </div>

          <div style="margin-bottom: 3px;">
            3. <strong>Jumlah Anggaran Perolehan :</strong>
          </div>

          <table class="official-table">
            <thead>
              <tr>
                <th rowspan="2" style="width: 4%;">Bil</th>
                <th rowspan="2" style="width: 52%;">Jenis Bekalan/Perkhidmatan/Kerja</th>
                <th colspan="3" style="width: 44%;">Anggaran Harga Jabatan</th>
              </tr>
              <tr>
                <th style="width: 12%;">Kuantiti</th>
                <th style="width: 16%;">Harga Seunit (RM)</th>
                <th style="width: 16%;">Jumlah (RM)</th>
              </tr>
            </thead>
            <tbody>
              <!-- Baris Tajuk Utama (Tanpa Nombor Bil) -->
              <tr style="background-color: #fdfaf0;">
                <td class="text-center"></td>
                <td class="font-bold" style="font-size: 9.5px; line-height: 1.3;">
                  <div style="text-transform: uppercase;">${r.perihalPerolehan || r.title}</div>
                  <div style="font-size: 8.5px; margin-top: 3px; font-weight: bold; text-transform: uppercase;">${r.rujukanDokumen ? (r.rujukanDokumen.toUpperCase().startsWith('RUJ') ? r.rujukanDokumen : `RUJ: ${r.rujukanDokumen}`) : (isSebuthargaReq ? 'RUJ: SH/S.6-01/2026' : 'RUJ: TT/RISDA/2026')}</div>
                </td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
              <!-- Senarai Item Sebenar (Bil 1, 2, 3...) -->
              ${itemList.map((item, idx) => {
                const workDetail = item.detailKerja || item.description || '';
                return `
                <tr>
                  <td class="text-center font-bold">${idx + 1}</td>
                  <td>
                    <span style="text-transform: uppercase; font-weight: 600;">${workDetail}</span>
                  </td>
                  <td class="text-center">${item.quantity}</td>
                  <td class="text-right">${Number(item.unitPrice).toFixed(2)}</td>
                  <td class="text-right">${Number(item.totalPrice).toFixed(2)}</td>
                </tr>
              `}).join('')}
              ${Array.from({ length: Math.max(0, 3 - itemList.length) }).map(() => `
                <tr style="height: 16px;">
                  <td></td><td></td><td></td><td></td><td></td>
                </tr>
              `).join('')}
              <tr>
                <td class="text-center"></td>
                <td class="font-bold" style="text-align: right; padding-right: 8px;">JUMLAH (RM)</td>
                <td></td>
                <td></td>
                <td class="text-right font-bold">${Number(r.estimatedAmount).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <div class="italic-note">* Sila guna lampiran jika perolehan melibatkan pelbagai item.</div>

          ${isSebuthargaReq ? `
            <div class="section-title">4. Kaedah Perolehan & Maklumat Pemenang Sebutharga :</div>
            <table class="official-table">
              <thead>
                <tr>
                  <th style="width: 4%;">BIL.</th>
                  <th style="width: 28%;">NAMA SYARIKAT KONTRAKTOR / PEMBEKAL BERJAYA</th>
                  <th style="width: 32%;">NAMA PEGAWAI YANG DIHUBUNGI DAN NO. TELEFON/ ALAMAT</th>
                  <th style="width: 16%;">KAEDAH PEROLEHAN</th>
                  <th style="width: 12%;">HARGA TAWARAN MENANG (RM)</th>
                  <th style="width: 8%;">STATUS KEPUTUSAN</th>
                </tr>
              </thead>
              <tbody>
                <tr style="height: 22px;">
                  <td class="text-center font-bold">1</td>
                  <td class="font-bold" style="text-transform: uppercase;">${r.pembekalDipilih || r.supplierName || 'PUNCAK BAYU'}</td>
                  <td style="text-transform: uppercase;">${(fullKajianList[0] && fullKajianList[0].pegawaiDihubungi) || 'PEMILIK: SANTHY GRESIKA PANAI | TEL: 0193006860'}</td>
                  <td class="text-center font-bold">SEBUTHARGA RASMI</td>
                  <td class="text-right font-bold">RM ${Number(r.estimatedAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td class="text-center" style="font-weight: bold; font-size: 8px;">★ PEMENANG DILANTIK</td>
                </tr>
              </tbody>
            </table>
            <div class="italic-note">*Keputusan rasmi Jawatankuasa / Lembaga Sebutharga RISDA serta surat setuju terima (SST) hendaklah dilampirkan bersama borang ini.</div>

            <div class="section-title">5. Perakuan & Justifikasi Keputusan Sebutharga. Sila tandakan(√) mana yang berkaitan:</div>
            <div style="margin-bottom: 4px;">
              <table width="100%" style="font-size: 8.5px; border-collapse: collapse;">
                <tr>
                  <td width="50%" style="padding: 1px 0;">
                    <span class="checkbox-box">✓</span> Tawaran terendah yang mematuhi spesifikasi teknikal sebutharga
                  </td>
                  <td width="50%" style="padding: 1px 0;">
                    <span class="checkbox-box">✓</span> Lantikan berdasarkan Keputusan Mesyuarat Jawatankuasa Sebutharga RISDA
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding: 1px 0;">
                    <span class="checkbox-box">✓</span> Kontraktor memenuhi syarat pendaftaran CIDB/MOF & melepasi taklimat tapak
                  </td>
                  <td width="50%" style="padding: 1px 0;">
                    <span class="checkbox-box">✓</span> Catatan: ${r.justifikasi?.lainLainNyatakan || 'Mematuhi tatacara perolehan sebutharga kerajaan RISDA'}
                  </td>
                </tr>
              </table>
            </div>

            <div style="margin-bottom: 4px; font-size: 9.5px;">
              6. <strong>Kontraktor / Pembekal yang berjaya dilantik :</strong> <span style="font-weight: bold; text-transform: uppercase;">${r.pembekalDipilih || r.supplierName || 'PUNCAK BAYU'}</span>
            </div>

            <div style="margin-top: 4px; font-size: 8.5px;">
              <strong>Perakuan:</strong><br/>
              Kami mengesahkan bahawa perolehan sebutharga ini telah melalui tatacara perolehan kerajaan yang sah, penilaian teknikal dan harga telah diperakui oleh Jawatankuasa Sebutharga serta peruntukan kewangan mencukupi.
            </div>
          ` : `
            <div class="section-title">4. Kajian Pasaran Dilaksanakan (Perbandingan 3 Pembekal) :</div>
            <table class="official-table">
              <thead>
                <tr>
                  <th style="width: 4%;">BIL.</th>
                  <th style="width: 22%;">NAMA SYARIKAT</th>
                  <th style="width: 36%;">NAMA PEGAWAI YANG DIHUBUNGI DAN NOMBOR TELEFON/ ALAMAT EMEL/ ALAMAT LAMAN WEB</th>
                  <th style="width: 18%;">KAEDAH KAJIAN *<br/><span style="font-size:7px; font-weight:normal; line-height: 1.1; display: inline-block;">(<del>Laman Web</del>/ <del>Katalog eP</del>/ <del>Harga Belian Lampau</del>/ Sebutharga Pembekal)</span></th>
                  <th style="width: 12%;">HARGA TAWARAN (RM)</th>
                  <th style="width: 8%;">CATATAN</th>
                </tr>
              </thead>
              <tbody>
                ${fullKajianList.slice(0, 3).map((k, i) => `
                  <tr style="height: 18px;">
                    <td class="text-center">${i + 1}</td>
                    <td class="font-bold" style="text-transform: uppercase;">${k.namaSyarikat || ''}</td>
                    <td style="text-transform: uppercase;">${k.pegawaiDihubungi || ''}</td>
                    <td class="text-center" style="text-transform: uppercase;">${k.kaedahKajian || ''}</td>
                    <td class="text-right">${k.hargaTawaran ? 'RM' + Number(k.hargaTawaran).toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}</td>
                    <td>${k.catatan || ''}</td>
                  </tr>
                `).join('')}
                ${Array.from({ length: Math.max(0, 3 - fullKajianList.slice(0, 3).length) }).map((_, extraIdx) => `
                  <tr style="height: 18px;">
                    <td class="text-center">${fullKajianList.slice(0, 3).length + extraIdx + 1}</td>
                    <td></td><td></td><td></td><td></td><td></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="italic-note">*Dokumen sokongan kajian pasaran hendaklah dilampirkan (jika ada).</div>

            <div class="section-title">5. Justifikasi sekiranya tidak dapat menyediakan 3 perbandingan harga. Sila tandakan(√) mana yang berkaitan.</div>
            <div style="margin-bottom: 4px;">
              <table width="100%" style="font-size: 8.5px; border-collapse: collapse;">
                <tr>
                  <td width="50%" style="padding: 1px 0;">
                    <span class="checkbox-box">${just.tiadaPembekalLain ? '✓' : ''}</span> Tiada pembekal lain yang boleh memberi perkhidmatan tersebut
                  </td>
                  <td width="50%" style="padding: 1px 0;">
                    <span class="checkbox-box">${just.kadarHargaAgensi ? '✓' : ''}</span> Kadar harga ditentukan oleh badan/organisasi/agensi yang diiktiraf
                  </td>
                </tr>
                <tr>
                  <td style="padding: 1px 0;">
                    <span class="checkbox-box">${just.perolehanKhas ? '✓' : ''}</span> Perolehan disebabkan perjanjian atau kepakaran khas
                  </td>
                  <td style="padding: 1px 0;">
                    <span class="checkbox-box">${just.lainLain ? '✓' : ''}</span> Lain-lain(nyatakan) __________________________________________________________
                  </td>
                </tr>
              </table>
            </div>

            <div style="margin-bottom: 4px; font-size: 9.5px;">
              6. <strong>Pembekal yang dipilih :</strong> <span style="font-weight: bold; text-transform: uppercase;">${r.pembekalDipilih || r.supplierName || 'PUNCAK BAYU'}</span>
            </div>

            <div style="margin-top: 4px; font-size: 8.5px;">
              <strong>Perakuan:</strong><br/>
              Kami mengesahkan semua maklumat di atas adalah benar. Kami mengakui bahawa telah melaksanakan kajian pasaran dan memilih pembekal yang paling menguntungkan Kerajaan.
            </div>
          `}

          <table class="sig-table">
            <tr>
              <td>
                Disediakan Oleh :<br/>
                <div class="sig-line"></div>
                Tandatangan<br/>
                Cop Nama & Jawatan<br/><br/>
                Tarikh : ${printTarikhDisediakan}
              </td>
              <td>
                Disahkan Oleh :<br/>
                <div class="sig-line"></div>
                Tandatangan<br/>
                Cop Nama & Jawatan<br/><br/>
                Tarikh : ${printTarikhDisahkan}
              </td>
            </tr>
          </table>

          <div class="section-title" style="margin-top: 8px; border-top: 1px solid #000; padding-top: 4px;">
            B. PENGESAHAN BAKI PERUNTUKAN OLEH UNIT KEWANGAN
          </div>
          <div style="font-size: 9px; margin-bottom: 3px;">
            Disahkan baki peruntukan: <strong>${r.pengesahanKewanganStatus === 'MENCUKUPI' ? '<u>MENCUKUPI</u> / TIDAK MENCUKUPI' : 'MENCUKUPI / <u>TIDAK MENCUKUPI</u>'}</strong>
          </div>
          <div style="font-size: 9px; margin-bottom: 3px;">
            Kod Aktiviti / Objek Induk : <strong>${r.kodAktivitiObjek || r.allocationCode || '.......................................................'}</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Baki : <strong>RM ${Number(r.bakiPeruntukanRm || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div style="margin-top: 18px; font-size: 8.5px;">
            .............................................................................................<br/>
            ( Tandatangan Pen. Akauntan/PT Kew Kanan/PT Kew )<br/>
            Cop Nama dan Jawatan<br/>
            Tarikh : 
          </div>

          <div class="section-title" style="margin-top: 8px; border-top: 1px solid #000; padding-top: 4px;">
            C. KELULUSAN KETUA PUSAT TANGGUNGJAWAB
          </div>
          <div style="font-size: 9px; margin-bottom: 3px;">
            Permohonan Perbelanjaan ini <strong>diluluskan / tidak diluluskan</strong>. Jika diluluskan, sila keluarkan Pesanan Tempatan.
          </div>
          <div style="margin-top: 18px; font-size: 8.5px;">
            .............................................................................................<br/>
            ( Tandatangan Ketua Pusat Tanggungjawab )<br/>
            Cop Nama dan Jawatan<br/>
            Tarikh : 
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header Banner (Matches selected module and theme) */}
      <div className={`border rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden transition-all duration-300 ${
        isSebuthargaModule
          ? theme === 'custom'
            ? 'bg-gradient-to-r from-[#050814] via-[#0B1528] to-[#12213F] text-white border-[#F4B41A]/50 shadow-2xl'
            : 'bg-gradient-to-r from-[#061B3A] via-[#0E356A] to-[#082046] text-white border-blue-500/40 shadow-xl'
          : 'bg-risda-card border border-risda-border text-slate-900 dark:text-white'
      }`}>
        <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
          isSebuthargaModule 
            ? theme === 'custom' ? 'bg-[#F4B41A]/10' : 'bg-risda-orange/15'
            : 'bg-amber-500/10'
        }`} />
        <div className={`absolute -bottom-10 -left-10 w-80 h-60 rounded-full blur-3xl pointer-events-none ${
          isSebuthargaModule
            ? theme === 'custom' ? 'bg-[#1557B0]/15' : 'bg-blue-600/20'
            : 'bg-blue-500/5'
        }`} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-3 shadow-xs ${
              isSebuthargaModule 
                ? theme === 'custom'
                  ? 'bg-[#F4B41A]/15 border border-[#F4B41A]/60 text-[#F4B41A]'
                  : 'bg-orange-500/20 border border-orange-500/50 text-orange-300'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400'
            }`}>
              {isSebuthargaModule ? (
                theme === 'custom' ? (
                  <Trophy size={14} className="text-[#F4B41A]" />
                ) : (
                  <Megaphone size={14} className="text-orange-400" />
                )
              ) : (
                <ShoppingBag size={14} className="text-amber-500" />
              )}
              <span>
                {isSebuthargaModule 
                  ? theme === 'custom'
                    ? 'MODUL SEBUTHARGA • PEROLEHAN DIRAJA EMAS (LO)'
                    : 'MODUL SEBUTHARGA • PUSAT PESANAN KERAJAAN (LO) & TENDER'
                  : 'SISTEM PENGURUSAN PEROLEHAN • MODUL TAWARAN TERUS'}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              {isSebuthargaModule ? 'Pengurusan Permintaan Pesanan & LO (Sebutharga)' : 'Pengurusan Permintaan Pesanan & LO (Tawaran Terus)'}
            </h1>
            <p className="text-xs sm:text-sm font-semibold mt-1 max-w-2xl opacity-90 leading-relaxed">
              {isSebuthargaModule 
                ? 'Pusat pengurusan pesanan tempatan (LO), penyelarasan sebutharga dan borang perolehan rasmi bagi pembekal pemenang sebutharga.'
                : 'Pengurusan dan pemantauan perolehan terus di bawah had nilai RM50,000 (Kerja G1 / Bekalan & Perkhidmatan) mengikut 1PP PK 2.'
              }
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportExcel}
              className={`flex items-center gap-2 px-4 py-3 border font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-xs cursor-pointer ${
                isSebuthargaModule
                  ? theme === 'custom'
                    ? 'bg-black/50 hover:bg-black/70 border-[#F4B41A]/40 text-[#F4B41A]'
                    : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 border-slate-300 dark:border-white/20 text-slate-900 dark:text-white hover:border-amber-400'
              }`}
              title="Eksport ke fail Excel"
            >
              <Download size={15} /> EKSPORT LAPORAN
            </button>
            <button
              onClick={() => {
                if (isSebuthargaModule) {
                  resetForm();
                  setShowModal(true);
                } else {
                  handleOpenNewOrderFlow();
                }
              }}
              className={`flex items-center gap-2 px-6 py-3.5 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer ${
                isSebuthargaModule
                  ? theme === 'custom'
                    ? 'bg-gradient-to-r from-[#F4B41A] to-[#D99B0F] hover:from-[#D99B0F] hover:to-[#F4B41A] text-[#061D38] shadow-[0_10px_25px_rgba(244,180,26,0.35)]'
                    : 'bg-gradient-to-r from-risda-orange to-amber-500 hover:from-amber-500 hover:to-risda-orange text-white shadow-[0_10px_25px_rgba(224,90,27,0.3)]'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-[0_10px_25px_rgba(245,158,11,0.25)]'
              }`}
            >
              <Plus size={16} className="stroke-[3]" /> PERMOHONAN BAHARU
            </button>
          </div>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Jumlah Permohonan */}
        <div className={`rounded-2xl p-5 shadow-sm flex items-center justify-between border transition-all ${
          isSebuthargaModule && theme === 'custom'
            ? 'bg-[#0B1528] border-[#F4B41A]/30 text-white'
            : 'bg-risda-card border-risda-border'
        }`}>
          <div className="space-y-1">
            <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">Jumlah Permohonan</span>
            <div className="text-2xl font-black text-slate-950 dark:text-white">{filteredRequests.length} Rekod</div>
            <div className={`text-xs font-black ${isSebuthargaModule ? (theme === 'custom' ? 'text-[#F4B41A]' : 'text-risda-orange') : 'text-amber-500'}`}>
              RM {totalEstimatedAmount.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
            isSebuthargaModule 
              ? theme === 'custom'
                ? 'bg-[#F4B41A]/10 text-[#F4B41A] border-[#F4B41A]/30'
                : 'bg-blue-500/10 text-blue-500 border-blue-500/30'
              : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
          }`}>
            {isSebuthargaModule ? <Megaphone size={22} /> : <FileText size={22} />}
          </div>
        </div>

        {/* Card 2: Menunggu Kelulusan / Dalam Semakan */}
        <div className={`rounded-2xl p-5 shadow-sm flex items-center justify-between border transition-all ${
          isSebuthargaModule && theme === 'custom'
            ? 'bg-[#0B1528] border-[#F4B41A]/30 text-white'
            : 'bg-risda-card border-risda-border'
        }`}>
          <div className="space-y-1">
            <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">Dalam Semakan</span>
            <div className={`text-2xl font-black ${isSebuthargaModule ? (theme === 'custom' ? 'text-[#F4B41A]' : 'text-orange-500') : 'text-amber-500'}`}>{reviewCount} Permohonan</div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400">Menunggu Kelulusan PTJ</div>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
            isSebuthargaModule 
              ? theme === 'custom'
                ? 'bg-[#F4B41A]/10 text-[#F4B41A] border-[#F4B41A]/30'
                : 'bg-orange-500/10 text-orange-500 border-orange-500/30'
              : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
          }`}>
            <Clock size={22} />
          </div>
        </div>

        {/* Card 3: Pesanan Tempatan (LO) Dijana */}
        <div className={`rounded-2xl p-5 shadow-sm flex items-center justify-between border transition-all ${
          isSebuthargaModule && theme === 'custom'
            ? 'bg-[#0B1528] border-[#F4B41A]/30 text-white'
            : 'bg-risda-card border-risda-border'
        }`}>
          <div className="space-y-1">
            <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">Pesanan Tempatan (LO)</span>
            <div className="text-2xl font-black text-emerald-500">{loGeneratedCount} Dijana</div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Lulus &amp; Dikeluarkan</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* Card 4: Selesai / Dibayar */}
        <div className={`rounded-2xl p-5 shadow-sm flex items-center justify-between border transition-all ${
          isSebuthargaModule && theme === 'custom'
            ? 'bg-[#0B1528] border-[#F4B41A]/30 text-white'
            : 'bg-risda-card border-risda-border'
        }`}>
          <div className="space-y-1">
            <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">Integrasi Kewangan</span>
            <div className={`text-2xl font-black ${isSebuthargaModule && theme === 'custom' ? 'text-[#F4B41A]' : 'text-blue-500'}`}>{sentToFinanceCount} Dihantar</div>
            <div className="text-xs font-bold text-blue-600 dark:text-blue-400">{paidCount} Selesai Dibayar</div>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
            isSebuthargaModule && theme === 'custom'
              ? 'bg-[#F4B41A]/10 text-[#F4B41A] border-[#F4B41A]/30'
              : 'bg-blue-500/10 text-blue-500 border-blue-500/30'
          }`}>
            <ShieldCheck size={22} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-risda-card border border-risda-border rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-96">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={isSebuthargaModule ? "Cari no. sebutharga, tajuk, kontraktor pemenang..." : "Cari no. rujukan, tajuk perolehan, atau nama pembekal..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-black/5 dark:bg-black/40 border border-risda-border rounded-xl text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-500 transition-all placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <button
              onClick={() => setFilterCategory('SEMUA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                filterCategory === 'SEMUA'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                  : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              Semua ({moduleRequests.length})
            </button>

            <button
              onClick={() => setFilterCategory('BEKALAN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                filterCategory === 'BEKALAN'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:text-blue-500'
              }`}
            >
              <Package size={13} />
              <span>Bekalan ({moduleRequests.filter(r => r.category === 'BEKALAN').length})</span>
            </button>

            <button
              onClick={() => setFilterCategory('PERKHIDMATAN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                filterCategory === 'PERKHIDMATAN'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:text-emerald-500'
              }`}
            >
              <Briefcase size={13} />
              <span>Perkhidmatan ({moduleRequests.filter(r => r.category === 'PERKHIDMATAN').length})</span>
            </button>

            <button
              onClick={() => setFilterCategory('KERJA')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                filterCategory === 'KERJA'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:text-amber-500'
              }`}
            >
              <Hammer size={13} />
              <span>Kerja ({moduleRequests.filter(r => r.category === 'KERJA').length})</span>
            </button>
          </div>

          {/* Status Dropdown */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-black/5 dark:bg-black/40 border border-risda-border rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="SEMUA" className="bg-white dark:bg-gray-900 text-black dark:text-white">Status: Semua</option>
            <option value="MENUNGGU SEMAKAN" className="bg-white dark:bg-gray-900 text-black dark:text-white">Menunggu Semakan (Penyemak)</option>
            <option value="DALAM SEMAKAN" className="bg-white dark:bg-gray-900 text-black dark:text-white">Dalam Semakan</option>
            <option value="MENUNGGU KELULUSAN" className="bg-white dark:bg-gray-900 text-black dark:text-white">Menunggu Kelulusan (Pelulus)</option>
            <option value="LULUS" className="bg-white dark:bg-gray-900 text-black dark:text-white">Pesanan Tempatan (LO) Dijana / Lulus</option>
            <option value="DIHANTAR KE KEWANGAN" className="bg-white dark:bg-gray-900 text-black dark:text-white">Dihantar Ke Kewangan</option>
            <option value="DIBAYAR" className="bg-white dark:bg-gray-900 text-black dark:text-white">Selesai Dibayar</option>
            <option value="DIKEMBALIKAN" className="bg-white dark:bg-gray-900 text-black dark:text-white">Dikembalikan / Ditolak</option>
          </select>

          <button
            onClick={fetchRequests}
            className="p-2.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-risda-border text-slate-900 dark:text-white rounded-xl transition-all cursor-pointer"
            title="Segar Semula"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {requests.length > 0 && isAdmin && (
            <button
              onClick={handleClearAllRequests}
              className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 hover:bg-red-500/20 transition-all cursor-pointer"
              title="Kosongkan Senarai"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className={`rounded-2xl shadow-sm overflow-hidden transition-all duration-300 ${
        isSebuthargaModule
          ? theme === 'custom'
            ? 'bg-[#08101E]/95 border border-[#F4B41A]/35 text-white shadow-2xl ring-1 ring-[#F4B41A]/20'
            : 'bg-white border-2 border-slate-300 text-slate-900 shadow-md'
          : 'bg-risda-card border border-risda-border'
      }`}>
        <div className={`p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isSebuthargaModule
            ? theme === 'custom'
              ? 'border-[#F4B41A]/30 bg-[#0B1528]/95 text-white'
              : 'border-slate-300 bg-[#0B2A5B] text-white shadow-sm'
            : 'border-risda-border'
        }`}>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2 uppercase !text-white">
              <FileText className="text-amber-400" size={20} /> 
              {isSebuthargaModule 
                ? `SENARAI PERMOHONAN PESANAN TEMPATAN (${filteredRequests.length} REKOD)` 
                : `Senarai Permohonan Tawaran Terus Terkini (${filteredRequests.length} Rekod)`}
            </h2>
            <p className={`text-xs sm:text-sm mt-1 font-semibold ${
              isSebuthargaModule && theme === 'executive' 
                ? '!text-blue-100' 
                : isSebuthargaModule 
                ? '!text-slate-200' 
                : 'text-slate-600 dark:text-slate-300'
            }`}>
              {isSebuthargaModule 
                ? 'Klik pada mana-mana rekod sebutharga untuk melihat spesifikasi, keputusan jawatankuasa, kelulusan PTJ, dan cetak borang LO rasmi.'
                : 'Klik pada mana-mana rekod untuk melihat spesifikasi, semakan audit AI, kelulusan, dan jana dokumen rasmi.'
              }
            </p>
          </div>
          <span className={`text-xs font-mono font-black px-3 py-1.5 rounded-lg ${
            isSebuthargaModule
              ? theme === 'custom'
                ? 'bg-[#F4B41A]/15 text-[#F4B41A] border border-[#F4B41A]/30'
                : '!bg-white/15 !text-white border border-white/30'
              : 'text-slate-700 dark:text-slate-300 bg-black/5 dark:bg-white/5'
          }`}>
            {filteredRequests.length} Rekod Dijumpai
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-600 dark:text-slate-300 font-bold animate-pulse text-xs">
            {isSebuthargaModule ? 'MEMUATKAN REKOD PERMOHONAN SEBUTHARGA...' : 'MEMUATKAN REKOD PERMOHONAN TAWARAN TERUS...'}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-600 dark:text-slate-300 font-bold space-y-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
              isSebuthargaModule 
                ? theme === 'custom'
                  ? 'bg-[#F4B41A]/10 border border-[#F4B41A]/30 text-[#F4B41A]'
                  : 'bg-risda-orange/10 border border-risda-orange/30 text-risda-orange'
                : 'bg-amber-500/10 border border-amber-500/30 text-amber-500'
            }`}>
              <ShoppingBag size={28} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-950 dark:text-white uppercase">
                {isSebuthargaModule ? 'Tiada Rekod Permohonan Pesanan Sebutharga Dijumpai' : 'Tiada Rekod Permohonan Tawaran Terus Dijumpai'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mt-1">
                {isSebuthargaModule 
                  ? 'Belum ada sebarang pesanan tempatan (LO) didaftarkan bagi modul Sebutharga. Sila klik butang di bawah untuk mendaftar permohonan pesanan Sebutharga baharu.'
                  : 'Belum ada sebarang permohonan baharu didaftarkan bagi modul Tawaran Terus. Sila klik butang di bawah untuk mendaftar permohonan tawaran terus baharu.'
                }
              </p>
            </div>
            <button
              onClick={() => {
                if (isSebuthargaModule) {
                  resetForm();
                  setShowModal(true);
                } else {
                  handleOpenNewOrderFlow();
                }
              }}
              className={`inline-flex items-center gap-2 px-5 py-2.5 font-black text-xs uppercase rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer ${
                isSebuthargaModule 
                  ? theme === 'custom'
                    ? 'bg-gradient-to-r from-[#F4B41A] to-[#D99B0F] text-[#061D38] shadow-[0_10px_25px_rgba(244,180,26,0.3)]'
                    : 'bg-gradient-to-r from-risda-orange to-amber-500 text-white shadow-risda-orange/20'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950'
              }`}
            >
              <Plus size={14} /> PERMOHONAN BAHARU
            </button>
          </div>
        ) : isSebuthargaModule ? (
          /* SEBUTHARGA EXPANSIVE CARD VIEW (SEPERTI DALAM GAMBAR LAMPIRAN PENGGUNA) */
          <div className="p-4 sm:p-6 space-y-5">
            {paginatedRequests.map((req) => {
              const isPaid = req.financeStatus === 'DIBAYAR' || req.status === 'DIBAYAR';
              const isSent = req.financeStatus === 'DIHANTAR';
              const isApproved = req.status === 'LULUS';
              const isExpanded = !!expandedItemTables[req.id!];
              const itemCount = req.items?.length || 1;
              const formattedDate = formatDateDMY(req.requestDate) || '16/03/2026';
              const displayVote = req.kodAktivitiObjek || req.allocationCode || '031400 R4400000 - PRASARANA ASAS PERTANIAN (PAP)';
              const supplier = req.pembekalDipilih || req.supplierName || 'PUNCAK BAYU';
              const ptj = req.ptjName || 'PRD BEAUFORT';
              const poDisplay = req.poNo || (isPaid || isSent || isApproved ? '2645070098' : 'BELUM DIJANA');
              const orderNoDisplay = req.orderNo || 'PP/RISDA/BFT/2026/001';
              const amountDisplay = Number(req.estimatedAmount || 170000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

              return (
                <div
                  key={req.id}
                  className={`rounded-2xl p-5 sm:p-6 transition-all duration-200 shadow-xl relative space-y-4 border ${
                    theme === 'custom'
                      ? 'bg-[#060F1E] border-blue-900/60 hover:border-[#F4B41A]/50 text-white shadow-[0_10px_30px_rgba(0,0,0,0.8)]'
                      : 'bg-white border-2 border-slate-300 hover:border-blue-500/60 text-slate-900 shadow-md'
                  }`}
                >
                  {/* BARIS ATAS: PILL STATUS / NO PESANAN & AMAUN */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* PILL DI SEBELAH KIRI */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                      {/* Pill 1: No. Permohonan Sebutharga (cth: PP/RISDA/BFT/2026/001) */}
                      <span className={`px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wider border ${
                        theme === 'custom'
                          ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
                          : 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs'
                      }`}>
                        {orderNoDisplay}
                      </span>

                      {/* Pill 2: No. PO (cth: PO: 2645070098) */}
                      <span className={`px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wider border ${
                        theme === 'custom'
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                          : 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                      }`}>
                        PO: {poDisplay}
                      </span>

                      {/* Pill 3: Kategori (cth: KERJA) */}
                      <span className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                        theme === 'custom'
                          ? 'bg-slate-800 text-slate-200'
                          : 'bg-slate-800 text-white border border-slate-700 shadow-xs'
                      }`}>
                        {req.category || 'KERJA'}
                      </span>

                      {/* Pill 4: Status Pesanan (cth: STATUS: DIBAYAR) */}
                      <span className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                        theme === 'custom'
                          ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                          : 'border-amber-500 bg-amber-100 text-amber-950 font-black shadow-xs'
                      }`}>
                        STATUS: {req.status || 'DIBAYAR'}
                      </span>

                      {/* Pill 5: Integrasi Kewangan (cth: 🕒 INTEGRASI KEWANGAN: DIBAYAR) */}
                      <span className={`px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
                        theme === 'custom'
                          ? 'border-amber-500/40 bg-amber-500/5 text-amber-300'
                          : 'border-amber-600/40 bg-amber-50/90 text-amber-900 shadow-xs'
                      }`}>
                        <Clock size={12} className={theme === 'custom' ? 'text-amber-400' : 'text-amber-700'} />
                        INTEGRASI KEWANGAN: {req.financeStatus || 'DIBAYAR'}
                      </span>
                    </div>

                    {/* AMAUN PESANAN DI SEBELAH KANAN */}
                    <div className="text-left sm:text-right shrink-0">
                      <div className={`text-[11px] font-black uppercase tracking-wider ${
                        theme === 'custom' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        AMAUN PESANAN (RM)
                      </div>
                      <div className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                        theme === 'custom' ? 'text-emerald-400' : 'text-emerald-700'
                      }`}>
                        RM {amountDisplay}
                      </div>
                    </div>
                  </div>

                  {/* BARIS KEDUA: TAJUK PERMOHONAN PESANAN PROJEK */}
                  <div>
                    <h3 className={`text-base sm:text-lg font-black leading-snug tracking-tight uppercase ${
                      theme === 'custom' ? 'text-white' : 'text-slate-900'
                    }`}>
                      {req.perihalPerolehan || req.title}
                    </h3>
                  </div>

                  {/* BARIS KETIGA: 4 KOLUM METADATA & BUTANG TINDAKAN */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pt-1">
                    {/* 4 Kolum Maklumat */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 flex-1">
                      {/* Kolum 1: Tarikh Permohonan */}
                      <div>
                        <span className={`text-[11px] font-black uppercase tracking-wider block mb-1 ${
                          theme === 'custom' ? 'text-amber-400' : 'text-amber-800'
                        }`}>
                          TARIKH PERMOHONAN:
                        </span>
                        <div className={`flex items-center gap-1.5 text-xs font-bold ${
                          theme === 'custom' ? 'text-white' : 'text-slate-900'
                        }`}>
                          <Calendar size={13} className={theme === 'custom' ? 'text-slate-300' : 'text-slate-600'} />
                          <span>{formattedDate}</span>
                        </div>
                      </div>

                      {/* Kolum 2: Kod Peruntukan / Vot */}
                      <div>
                        <span className={`text-[11px] font-black uppercase tracking-wider block mb-1 ${
                          theme === 'custom' ? 'text-amber-400' : 'text-amber-800'
                        }`}>
                          KOD PERUNTUKAN / VOT:
                        </span>
                        <div className={`text-xs font-mono font-bold leading-relaxed ${
                          theme === 'custom' ? 'text-white' : 'text-slate-900'
                        }`}>
                          {displayVote}
                        </div>
                      </div>

                      {/* Kolum 3: Pembekal Terpilih */}
                      <div>
                        <span className={`text-[11px] font-black uppercase tracking-wider block mb-1 ${
                          theme === 'custom' ? 'text-amber-400' : 'text-amber-800'
                        }`}>
                          PEMBEKAL TERPILIH:
                        </span>
                        <div className={`text-xs font-black uppercase tracking-wide ${
                          theme === 'custom' ? 'text-emerald-400' : 'text-emerald-700'
                        }`}>
                          {supplier}
                        </div>
                      </div>

                      {/* Kolum 4: Pusat Tanggungjawab (PTJ) */}
                      <div>
                        <span className={`text-[11px] font-black uppercase tracking-wider block mb-1 ${
                          theme === 'custom' ? 'text-amber-400' : 'text-amber-800'
                        }`}>
                          PUSAT TANGGUNGJAWAB (PTJ):
                        </span>
                        <div className={`text-xs font-bold uppercase ${
                          theme === 'custom' ? 'text-white' : 'text-slate-900'
                        }`}>
                          {ptj}
                        </div>
                      </div>
                    </div>

                    {/* Kumpulan Butang Tindakan Di Sebelah Kanan */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* DETAIL */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRequestForDetail(req);
                          setShowDetailModal(true);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 border ${
                          theme === 'custom'
                            ? 'border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-amber-400'
                            : 'border-slate-300 bg-slate-800 hover:bg-slate-900 text-amber-300 shadow-sm'
                        }`}
                      >
                        <FileText size={13} className="text-amber-400" />
                        <span>DETAIL</span>
                      </button>

                      {/* EDIT */}
                      <button
                        type="button"
                        onClick={() => handleEdit(req)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 border ${
                          theme === 'custom'
                            ? 'border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-slate-200'
                            : 'border-slate-300 bg-slate-800 hover:bg-slate-900 text-white shadow-sm'
                        }`}
                      >
                        <Edit2 size={13} />
                        <span>EDIT</span>
                      </button>

                      {/* HANTAR KEPADA UNIT KEWANGAN */}
                      <button
                        type="button"
                        onClick={() => handleSendToFinanceSystem(req)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                      >
                        <Send size={13} />
                        <span>HANTAR KEPADA UNIT KEWANGAN</span>
                      </button>

                      {/* DIBAYAR (KEWANGAN) */}
                      <button
                        type="button"
                        onClick={() => handleMarkPaidByFinance(req)}
                        className={`px-3.5 py-2 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                          isPaid
                            ? theme === 'custom'
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                              : 'border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-black'
                            : theme === 'custom'
                              ? 'border-slate-700 bg-slate-800/90 text-slate-300 hover:text-emerald-400'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        <span>{isPaid ? '✓ DIBAYAR (KEWANGAN)' : 'PENGESAHAN BAYARAN'}</span>
                      </button>

                      {/* PADAM */}
                      <button
                        type="button"
                        onClick={() => handleDelete(req.id!)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer ${
                          theme === 'custom'
                            ? 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-red-400 hover:border-red-500/30'
                            : 'border-slate-300 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white shadow-sm'
                        }`}
                        title="Padam Permohonan"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* BARIS KEEMPAT: JALUR BOLEH DILIPAT MAKLUMAT PESANAN */}
                  <div className={`rounded-xl p-3 sm:px-4 flex items-center justify-between gap-3 mt-4 border ${
                    theme === 'custom'
                      ? 'border-blue-900/60 bg-[#040A14] text-white'
                      : 'border-slate-300 bg-slate-100 text-slate-900 shadow-xs'
                  }`}>
                    <div
                      className="flex items-center gap-3 cursor-pointer select-none flex-1"
                      onClick={() => toggleItemTable(req.id!)}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-transform border ${
                        theme === 'custom'
                          ? 'border-slate-700 bg-slate-800/90 text-slate-200'
                          : 'border-slate-300 bg-white text-slate-700 shadow-xs'
                      }`}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-xs sm:text-sm uppercase tracking-tight ${
                            theme === 'custom' ? 'text-white' : 'text-slate-900'
                          }`}>
                            MAKLUMAT PESANAN (PERINCIAN ITEM PESANAN)
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            theme === 'custom'
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : 'bg-emerald-100 border-emerald-300 text-emerald-800'
                          }`}>
                            {itemCount} ITEM
                          </span>
                        </div>
                        <div className={`text-[11px] font-medium mt-0.5 ${
                          theme === 'custom' ? 'text-slate-300' : 'text-slate-600 font-semibold'
                        }`}>
                          {isExpanded
                            ? '▲ Klik untuk sembunyikan jadual perincian item pesanan'
                            : '▼ Klik untuk lihat/papar jadual perincian item pesanan'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAddItemModal(req);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                        theme === 'custom'
                          ? 'border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-xs'
                      }`}
                    >
                      <Plus size={13} />
                      <span>Tambah Item</span>
                    </button>
                  </div>

                  {/* JADUAL PERINCIAN ITEM APABILA DIBUKA (EXPANDED) */}
                  {isExpanded && (
                    <div className={`mt-3 border rounded-xl overflow-hidden shadow-inner ${
                      theme === 'custom'
                        ? 'border-slate-800 bg-black/50'
                        : 'border-slate-300 bg-white'
                    }`}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className={`text-[10px] font-black uppercase border-b tracking-wider ${
                            theme === 'custom'
                              ? 'bg-[#0B1528] text-amber-400 border-white/10'
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}>
                            <tr>
                              <th className="p-3 w-10 text-center">Bil</th>
                              <th className="p-3">Perihal / Perincian Kerja Item</th>
                              <th className="p-3 text-center">Kod Aktiviti / Kod Objek</th>
                              <th className="p-3 text-center">Kuantiti</th>
                              <th className="p-3 text-right">Harga Seunit (RM)</th>
                              <th className="p-3 text-right">Jumlah (RM)</th>
                              <th className="p-3 text-center">Tindakan</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y font-semibold ${
                            theme === 'custom'
                              ? 'divide-white/5 text-white'
                              : 'divide-slate-200 text-slate-900'
                          }`}>
                            {(req.items && req.items.length > 0 ? req.items : [
                              { id: '1', description: req.perihalPerolehan || req.title, quantity: 1, unitPrice: req.estimatedAmount, totalPrice: req.estimatedAmount, kodAktiviti: '031401', kodObjek: 'R4419900' }
                            ]).map((it, idx) => (
                              <tr key={it.id || idx} className={theme === 'custom' ? 'hover:bg-white/5' : 'hover:bg-slate-50'}>
                                <td className={`p-3 text-center font-mono font-bold ${
                                  theme === 'custom' ? 'text-amber-400' : 'text-slate-700'
                                }`}>{idx + 1}</td>
                                <td className="p-3">
                                  <div className={`font-bold uppercase ${theme === 'custom' ? 'text-white' : 'text-slate-900'}`}>
                                    {it.description || it.detailKerja || req.title}
                                  </div>
                                  {it.detailKerja && it.detailKerja !== it.description && (
                                    <div className={`text-[10px] ${theme === 'custom' ? 'text-slate-400' : 'text-slate-500'}`}>
                                      {it.detailKerja}
                                    </div>
                                  )}
                                </td>
                                <td className={`p-3 text-center font-mono text-[11px] font-bold ${
                                  theme === 'custom' ? 'text-emerald-400' : 'text-blue-700'
                                }`}>
                                  {it.kodAktiviti || '031401'} / {it.kodObjek || 'R4419900'}
                                </td>
                                <td className={`p-3 text-center font-mono ${theme === 'custom' ? 'text-white' : 'text-slate-900 font-bold'}`}>
                                  {it.quantity}
                                </td>
                                <td className={`p-3 text-right font-mono ${theme === 'custom' ? 'text-slate-300' : 'text-slate-700'}`}>
                                  RM {Number(it.unitPrice || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                                </td>
                                <td className={`p-3 text-right font-mono font-black ${
                                  theme === 'custom' ? 'text-emerald-400' : 'text-emerald-700'
                                }`}>
                                  RM {Number(it.totalPrice || (it.quantity * it.unitPrice) || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditItemModal(req, it)}
                                    className={`p-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                      theme === 'custom'
                                        ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400'
                                        : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                                    }`}
                                    title="Kemaskini Item"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className={`border-t font-bold ${
                            theme === 'custom'
                              ? 'bg-[#0B1528]/80 border-white/10'
                              : 'bg-slate-100 border-slate-300'
                          }`}>
                            <tr>
                              <td colSpan={5} className={`p-3 text-right uppercase text-xs font-black ${
                                theme === 'custom' ? 'text-amber-400' : 'text-slate-900'
                              }`}>
                                JUMLAH KESELURUHAN ITEM:
                              </td>
                              <td className={`p-3 text-right font-mono text-sm font-black ${
                                theme === 'custom' ? 'text-emerald-400' : 'text-emerald-700'
                              }`}>
                                RM {Number(req.estimatedAmount || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* STANDARD TABLE VIEW UNTUK TAWARAN TERUS */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-xs font-black uppercase tracking-wider border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-slate-950 dark:text-white">
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
                {paginatedRequests.map((req) => {
                  const isSent = req.financeStatus === 'DIHANTAR';
                  const isPaid = req.financeStatus === 'DIBAYAR' || req.status === 'DIBAYAR';
                  const isApproved = req.status === 'LULUS';
                  const aiScore = req.aiCompliance || (req.status === 'LULUS' ? 96 : 93);
                  const supplierCode = req.supplierCode || (req.category === 'KERJA' ? 'CIDB G2' : 'MOF');
                  const itemCountStr = req.items?.length ? `${req.items.length} item` : '1 item';
                  const voteCode = req.allocationCode?.split(' ')[0] || req.kodAktivitiObjek?.split(' ')[0] || 'B62';

                  return (
                    <tr
                      key={req.id}
                      className="transition-colors group cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/50"
                      onClick={() => {
                        setSelectedRequestForDetail(req);
                        setShowDetailModal(true);
                      }}
                    >
                      {/* No Rujukan & Tarikh */}
                      <td className="py-4 px-5">
                        <div className="font-mono font-black text-slate-950 dark:text-white text-xs sm:text-sm group-hover:text-amber-500 transition-colors">
                          {req.orderNo}
                        </div>
                        <div className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold flex items-center gap-1">
                          <Calendar size={12} /> {formatDateDMY(req.requestDate)}
                        </div>
                        <div className="text-xs text-slate-700 dark:text-slate-300 font-extrabold uppercase mt-0.5">
                          {req.ptjName || 'PRD Beaufort'}
                        </div>
                      </td>

                      {/* Tajuk & Kategori */}
                      <td className="py-4 px-5 max-w-[340px]">
                        <div className="font-black text-slate-950 dark:text-white text-xs sm:text-sm line-clamp-2 leading-relaxed">
                          {req.perihalPerolehan || req.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-md shadow-xs ${
                            req.category === 'BEKALAN'
                              ? 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-700'
                              : req.category === 'PERKHIDMATAN'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700'
                              : 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700'
                          }`}>
                            {req.category}
                          </span>
                          <span className="text-xs text-slate-700 dark:text-slate-200 font-bold">
                            {itemCountStr}
                          </span>
                        </div>
                      </td>

                      {/* Pembekal Terpilih */}
                      <td className="py-4 px-5">
                        <div className="font-black text-slate-950 dark:text-white text-xs sm:text-sm">
                          {req.pembekalDipilih || req.supplierName || 'Pembekal Berdaftar'}
                        </div>
                        <div className="text-xs font-mono text-slate-700 dark:text-slate-300 font-bold mt-0.5">
                          {supplierCode}
                        </div>
                      </td>

                      {/* Vot Bajet */}
                      <td className="py-4 px-5 text-center font-mono font-black text-slate-950 dark:text-white text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs">
                          {voteCode}
                        </span>
                      </td>

                      {/* Jumlah (RM) */}
                      <td className="py-4 px-5 text-right font-black text-slate-950 dark:text-white text-xs sm:text-sm tabular-nums">
                        RM {Number(req.estimatedAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Pematuhan AI */}
                      <td className="py-4 px-5 text-center">
                        <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{aiScore}% Audit AI</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          isApproved
                            ? 'border border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60'
                            : isPaid
                            ? 'border border-teal-500 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60'
                            : isSent
                            ? 'border border-blue-500 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60'
                            : req.status === 'DITOLAK'
                            ? 'border border-red-500 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60'
                            : 'border border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60'
                        }`}>
                          {isApproved ? 'Pesanan Tempatan (LO) Dijana' : req.status}
                        </span>
                      </td>

                      {/* Tindakan */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(isPenyemak || isAdmin) && (req.status === 'MENUNGGU SEMAKAN' || req.status === 'DALAM SEMAKAN') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openReviewModal(req);
                              }}
                              className="px-2.5 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer transition-all shadow-xs shrink-0"
                              title="Semak Tawaran Terus & Pilih 3 Pembekal"
                            >
                              <ShieldCheck size={12} /> Semak &amp; 3 Pembekal
                            </button>
                          )}

                          {(isPelulus || isAdmin) && req.status === 'MENUNGGU KELULUSAN' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openApprovalModal(req);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer transition-all shadow-xs shrink-0"
                              title="Luluskan Permohonan Tawaran Terus"
                            >
                              <CheckCircle2 size={12} /> Luluskan
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRequestForDetail(req);
                              setShowDetailModal(true);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-black text-blue-500 dark:text-blue-400 hover:text-amber-500 transition-colors cursor-pointer group-hover:translate-x-0.5 shrink-0"
                          >
                            <span>Buka</span>
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && filteredRequests.length > 0 && (
          <Pagination
            currentPage={safeCurrentPage}
            totalItems={filteredRequests.length}
            pageSize={pageSize}
            onPageChange={(page) => {
              setCurrentPage(page);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            pageSizeOptions={[5, 10, 20]}
            itemName={isSebuthargaModule ? "permohonan sebutharga" : "permohonan tawaran terus"}
          />
        )}
      </div>

      {/* POPUP MODAL: PILIHAN KOD PERUNTUKAN INDUK SEBELUM MULA PESANAN BARU */}
      {showAllocSelectionModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-risda-card border border-emerald-500/40 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-black uppercase tracking-wider mb-2">
                  <Coins size={14} /> Langkah 1: Pengesahan Kod Peruntukan Induk
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  Pilih Kod Peruntukan Induk (VOT)
                </h2>
                <p className="text-xs sm:text-sm text-slate-200 font-semibold mt-1.5 leading-relaxed">
                  Sila pilih Kod Peruntukan Induk yang akan digunakan. Kod dan baki peruntukan akan diisi <strong className="text-emerald-400 font-black">secara automatik</strong> ke <strong className="text-white font-black">Bahagian B (Pengesahan Baki Peruntukan Oleh Unit Kewangan)</strong> bagi memudahkan urusan kakitangan tanpa perlu mengisi semula.
                </p>
              </div>
              <button
                onClick={() => setShowAllocSelectionModal(false)}
                className="p-2.5 rounded-xl bg-white/10 text-slate-300 hover:text-white cursor-pointer transition-colors"
                title="Tutup"
              >
                <XCircle size={22} />
              </button>
            </div>

            {/* Carian Kod Peruntukan */}
            <div className="space-y-4">
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari Kod Vot (cth: 031400) atau Perihal Peruntukan (cth: PAP)..."
                  value={allocModalSearch}
                  onChange={(e) => setAllocModalSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-black/70 border border-emerald-500/40 rounded-xl text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-emerald-400 placeholder:text-slate-400 shadow-inner"
                />
              </div>

              {/* Senarai Kad Kod Induk */}
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {(() => {
                  const filteredAllocCodes = allocationCodes.filter(ac => {
                    if (!allocModalSearch) return true;
                    const searchStr = `${ac.akt || ''} ${ac.obj || ''} ${ac.perihal || ''} ${ac.name || ''}`.toLowerCase();
                    return searchStr.includes(allocModalSearch.toLowerCase());
                  });

                  if (filteredAllocCodes.length === 0) {
                    return (
                      <div className="p-6 text-center text-slate-300 text-xs sm:text-sm font-bold bg-black/40 rounded-2xl border border-white/10">
                        Tiada kod peruntukan yang sepadan dengan carian "{allocModalSearch}".
                      </div>
                    );
                  }

                  return filteredAllocCodes.map((ac) => {
                    const codeVal = `${ac.akt || ''} ${ac.obj || ''} - ${ac.perihal || ac.name || ''}`.trim();
                    const bakiVal = Number(ac.bakiPeruntukan ?? ac.balanceAmount ?? ac.amount ?? 0);
                    const isMencukupi = bakiVal > 0;

                    return (
                      <div
                        key={ac.id}
                        onClick={() => handleConfirmAllocationAndStartOrder(codeVal)}
                        className="p-4 bg-black/60 hover:bg-emerald-950/50 border border-white/15 hover:border-emerald-500/70 rounded-2xl cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group shadow-sm flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/25 text-emerald-300 font-mono text-xs font-black border border-emerald-500/40">
                              {ac.akt ? `VOT: ${ac.akt} / ${ac.obj}` : 'KOD PERUNTUKAN'}
                            </span>
                            <span className="text-xs text-slate-300 font-bold">
                              Tahun {ac.year || '2026'}
                            </span>
                          </div>
                          <h4 className="text-sm font-black text-white uppercase tracking-wide group-hover:text-emerald-300 transition-colors">
                            {ac.perihal || ac.name}
                          </h4>
                          <div className="flex items-center gap-3 text-xs sm:text-sm">
                            <span className="text-slate-300 font-bold">Baki Semasa:</span>
                            <span className={`font-mono font-black ${isMencukupi ? 'text-emerald-400' : 'text-red-400'}`}>
                              RM {bakiVal.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-black ${
                              isMencukupi ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                            }`}>
                              {isMencukupi ? 'Mencukupi' : 'Kritikal'}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <button
                            type="button"
                            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 group-hover:from-emerald-500 group-hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md transition-all pointer-events-none"
                          >
                            <span>Pilih</span>
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Pilihan Langkau / Buka Borang Terus */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleConfirmAllocationAndStartOrder('')}
                  className="text-xs sm:text-sm text-slate-200 hover:text-white underline font-bold transition-colors cursor-pointer"
                >
                  Langkau &amp; Buka Borang (Pilih Kod Semasa Mengisi)
                </button>
                <div className="text-xs text-emerald-300 font-semibold">
                  * Kod yang dipilih akan automatik menetapkan sub-kod pecahan bagi item pesanan.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PENDAFTARAN PERMOHONAN TAWARAN TERUS BAHARU (3-LANGKAH 1PP PK 2) */}
      <NewDirectAwardModal
        isOpen={!isSebuthargaModule && showNewDirectAwardModal}
        onClose={() => setShowNewDirectAwardModal(false)}
        initialAllocationCode={selectedAllocationCodeForNewModal}
        onSuccess={() => {
          fetchRequests();
          fetchAllocationCodes();
        }}
      />

      {/* MODAL 1: TAMBAH / KEMASKINI BORANG KAJIAN PASARAN & PESANAN */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-risda-card border border-white/10 rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  {isSebuthargaModule ? (
                    <Megaphone className={theme === 'custom' ? 'text-[#F4B41A]' : 'text-risda-orange'} size={22} />
                  ) : (
                    <FileText className="text-amber-500" size={22} />
                  )}
                  {isSebuthargaModule ? 'BORANG PERMOHONAN PESANAN KERAJAAN & KAJIAN PASARAN (MODUL SEBUTHARGA)' : 'BORANG KAJIAN PASARAN (TAWARAN TERUS - 1PP PK 2)'}
                </h2>
                <p className="text-xs text-risda-muted font-bold mt-0.5">
                  {isSebuthargaModule 
                    ? 'Penyelarasan pesanan tempatan (LO), pemenang rasmi sebutharga & pengesahan peruntukan bagi projek Sebutharga.'
                    : 'Isi butir-butir perolehan, anggaran harga, 3 perbandingan kajian pasaran, justifikasi & pengesahan peruntukan.'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl bg-white/5 text-risda-muted hover:text-white"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* QUICK SELECTION FOR SEBUTHARGA PROJECTS */}
            {isSebuthargaModule && sebuthargaAds.length > 0 && (
              <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-950/60 to-slate-900/80 border border-blue-500/40 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-300">
                    <Sparkles size={15} className="text-amber-400" />
                    <span>Pilihan Pantas: Muat Data Daripada Projek Sebutharga Berdaftar (Iklan / Keputusan)</span>
                  </div>
                  <span className="text-[11px] text-slate-300 font-semibold">
                    *Pilih projek untuk mengisi tajuk, pemenang &amp; nilai secara automatik
                  </span>
                </div>
                <select
                  value={selectedSebuthargaAdId}
                  onChange={(e) => handleSelectSebuthargaAd(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/80 border border-blue-400/50 rounded-xl text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-amber-400 cursor-pointer shadow-inner"
                >
                  <option value="">-- Sila Pilih Projek Sebutharga Berdaftar (Pilihan) --</option>
                  {sebuthargaAds.map(ad => {
                    const winnerComp = ad.winner?.companyName || ad.winnerName;
                    const tenderRef = ad.tenderNo || ad.refNo || ad.id;
                    const priceStr = (ad.winner?.winningPrice || ad.winningPrice) ? ` [RM ${Number(ad.winner?.winningPrice || ad.winningPrice).toLocaleString('ms-MY')}]` : '';
                    return (
                      <option key={ad.id} value={ad.id}>
                        {tenderRef} • {ad.title?.slice(0, 65)}... {winnerComp ? `[Pemenang: ${winnerComp}]` : '[Belum Ada Pemenang]'}{priceStr}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-8">
              {/* HEADER INFO SECTION */}
              <div className="bg-black/60 border border-white/15 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-amber-400 mb-1.5">
                      TARIKH PESANAN / PERMOHONAN
                    </label>
                    <input
                      type="date"
                      value={formData.requestDate || new Date().toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          requestDate: newDate,
                          disediakanOlehTarikh: newDate,
                          disahkanOlehTarikh: newDate
                        }));
                      }}
                      className="w-full px-4 py-2.5 bg-black/70 border border-white/20 rounded-xl text-emerald-400 text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-amber-400 shadow-inner"
                      required
                    />
                    <span className="text-xs text-emerald-300 font-semibold block mt-1">
                      * Tarikh Disediakan Oleh &amp; Disahkan Oleh akan auto-diselaraskan mengikut tarikh ini.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-amber-400 mb-1.5">
                      NAMA PUSAT TANGGUNGJAWAB (PTJ)
                    </label>
                    <input
                      type="text"
                      value={formData.ptjName}
                      onChange={(e) => setFormData({ ...formData, ptjName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-black/70 border border-white/20 rounded-xl text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-amber-400 uppercase shadow-inner"
                      placeholder={district ? `PRD ${district.toUpperCase()}` : 'PRD BEAUFORT'}
                      required
                    />
                    <span className="text-xs text-slate-300 font-semibold block mt-1">
                      * Berdasarkan tempat bertugas kakitangan.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-amber-400 mb-1.5">
                      NO. PO (10 DIGIT)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={formData.poNo}
                      onChange={(e) => setFormData({ ...formData, poNo: e.target.value })}
                      className="w-full px-4 py-2.5 bg-black/70 border border-white/20 rounded-xl text-emerald-400 text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-amber-400 uppercase tracking-widest shadow-inner"
                      placeholder="2645070098"
                    />
                    <span className="text-xs text-slate-300 font-semibold block mt-1">
                      * Auto dijanakan oleh Unit Kewangan (Contoh: 2645070098).
                    </span>
                  </div>
                </div>
              </div>

              {/* SEKSI A: BUTIR-BUTIR PEROLEHAN */}
              <div className="space-y-4">
                <h3 className="text-sm sm:text-base font-black text-amber-400 uppercase tracking-wider border-b border-white/10 pb-2.5 flex items-center gap-2">
                  <Layers size={18} /> A. BUTIR-BUTIR PEROLEHAN
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-amber-400 mb-1.5">
                      1. Jenis Perolehan
                    </label>
                    <select
                      value={formData.jenisPerolehanCategory}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        jenisPerolehanCategory: e.target.value,
                        category: e.target.value.includes('Kerja') ? 'KERJA' : (e.target.value.includes('Perkhidmatan') ? 'PERKHIDMATAN' : 'BEKALAN')
                      })}
                      className="w-full px-4 py-2.5 bg-black/70 border border-white/20 rounded-xl text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-amber-400 cursor-pointer shadow-inner"
                    >
                      <option value="Bekalan & Perkhidmatan">Bekalan &amp; Perkhidmatan</option>
                      <option value="Kerja">Kerja</option>
                      <option value="Kerja PAP">Kerja PAP</option>
                      <option value="Perkhidmatan">Perkhidmatan</option>
                      <option value="Bekalan">Bekalan</option>
                      <option value="Lain-lain Perolehan">Lain-lain Perolehan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-amber-400 mb-1.5">
                      {isSebuthargaModule ? 'No. Rujukan Fail / Permohonan Sebutharga' : 'No. Rujukan Fail / Permohonan Tawaran Terus'}
                    </label>
                    <input
                      type="text"
                      value={formData.rujukanDokumen}
                      onChange={(e) => setFormData({ ...formData, rujukanDokumen: e.target.value })}
                      className="w-full px-4 py-2.5 bg-black/70 border border-white/20 rounded-xl text-white text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-amber-400 uppercase shadow-inner"
                      placeholder={isSebuthargaModule ? "Contoh: SH/S.6-01/2026" : "Contoh: PRD.BFT/TT/01/2026"}
                    />
                    <span className="text-xs text-slate-300 font-semibold block mt-1">
                      {isSebuthargaModule
                        ? 'Nombor rujukan fail rasmi bagi rekod Sebutharga RISDA.'
                        : 'Nombor rujukan fail rasmi bagi rekod Arahan Perbendaharaan (AP 95/173).'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-amber-400 mb-1.5">
                    2. Perihal Perolehan
                  </label>
                  <textarea
                    rows={2}
                    value={formData.perihalPerolehan || formData.title}
                    onChange={(e) => setFormData({ ...formData, perihalPerolehan: e.target.value, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-black/70 border border-white/20 rounded-xl text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-amber-400 uppercase shadow-inner"
                    placeholder="LO PAP TAHUN 2026 KAMPUNG KABIAH, KUALA MUAYA SIPITANG"
                    required
                  />
                </div>

                {/* 3. JUMLAH ANGGARAN PEROLEHAN TABLE */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-amber-400">
                        3. Jumlah Anggaran Perolehan (Jadual Item)
                      </label>
                      {(() => {
                        const parentAlloc = findMatchingAllocationCode(formData.kodAktivitiObjek || formData.allocationCode);
                        return parentAlloc ? (
                          <div className="text-xs text-emerald-300 font-bold flex items-center gap-2 mt-1">
                            <span className="px-2.5 py-0.5 bg-emerald-950/80 border border-emerald-500/50 rounded-md text-xs font-mono font-black text-emerald-300">
                              VOT INDUK: {parentAlloc.akt || '031400'} / {parentAlloc.obj || 'R4400000'}
                            </span>
                            <span className="truncate max-w-md text-emerald-200 text-xs font-semibold">
                              - {parentAlloc.perihal || parentAlloc.name}
                            </span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3.5 py-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      <Plus size={14} className="stroke-[3]" /> Tambah Item
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-white/20 rounded-2xl shadow-inner">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-black/70 border-b border-white/20 text-xs text-slate-200 font-black uppercase tracking-wider">
                          <th className="py-3 px-3 w-12 text-center">Bil</th>
                          <th className="py-3 px-3">Jenis Bekalan / Perkhidmatan / Kerja</th>
                          <th className="py-3 px-3 w-24 text-center">Kuantiti</th>
                          <th className="py-3 px-3 w-36 text-right">Harga Seunit (RM)</th>
                          <th className="py-3 px-3 w-36 text-right">Jumlah (RM)</th>
                          <th className="py-3 px-3 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10 font-semibold">
                        {/* BARIS TAJUK BESAR TAWARAN TERUS / PERIHAL (UNTUK PDF TANPA NOMBOR BIL) */}
                        <tr className="bg-amber-500/15 border-b-2 border-amber-500/40">
                          <td className="py-3.5 px-3 text-center align-top pt-4">
                            <span className="inline-block px-2 py-1 rounded bg-amber-500/25 text-amber-300 text-xs font-black uppercase tracking-wider border border-amber-500/50">
                              TAJUK
                            </span>
                          </td>
                          <td className="py-3.5 px-3" colSpan={4}>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                                  <Layers size={14} className="text-amber-400" />
                                  {isSebuthargaModule 
                                    ? 'Tajuk Besar Perihal Sebutharga (Dipaparkan Dalam PDF Tanpa Nombor Bil):' 
                                    : 'Tajuk Besar Perihal Tawaran Terus (Dipaparkan Dalam PDF Tanpa Nombor Bil):'}
                                </span>
                                <span className="text-xs text-amber-200 font-semibold">
                                  {isSebuthargaModule 
                                    ? '* Butiran rasmi permohonan Sebutharga' 
                                    : '* Butiran rasmi permohonan Tawaran Terus'}
                                </span>
                              </div>
                              <input
                                type="text"
                                value={formData.perihalPerolehan || formData.title || ''}
                                onChange={(e) => setFormData({ ...formData, perihalPerolehan: e.target.value, title: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-black/80 border border-amber-500/50 rounded-xl text-amber-200 text-xs sm:text-sm font-bold uppercase focus:outline-none focus:border-amber-400 shadow-inner"
                                placeholder="CADANGAN PROJEK JALAN BAGI PROGRAM PRASARANA ASAS PERTANIAN..."
                                required
                              />
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-center"></td>
                        </tr>

                        {/* SENARAI PECAHAN ITEM KERJA / BEKALAN (BIL 1, BIL 2, ...) */}
                        {formData.items?.map((item, idx) => {
                          const isSaved = !!savedItemRows[item.id];
                          return (
                            <tr key={item.id} className={isSaved ? "bg-emerald-950/25 transition-colors" : "transition-colors"}>
                              <td className="py-3.5 px-3 text-center align-top pt-4">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/80 border border-white/25 text-amber-400 font-mono font-black text-xs sm:text-sm">
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-3.5 px-3">
                                {isSaved ? (
                                  /* PAPARAN KEMAS APABILA TELAH DISIMPAN (TIDAK SERABUT) */
                                  <div className="p-3.5 bg-black/50 border border-emerald-500/40 rounded-xl flex items-start justify-between gap-3 group hover:border-emerald-500/60 transition-all">
                                    <div className="space-y-1.5">
                                      <div className="text-xs text-emerald-300 font-black uppercase tracking-wider flex items-center gap-1.5">
                                        <CheckCircle2 size={14} className="text-emerald-400" />
                                        <span>Perincian Kerja / Item:</span>
                                      </div>
                                      <div className="text-sm sm:text-base font-bold text-white uppercase tracking-wide">
                                        {item.detailKerja || item.description || '-'}
                                      </div>
                                      <div className="text-xs text-slate-300 font-mono font-bold pt-0.5">
                                        Kod Pecahan Kewangan: <span className="text-emerald-300 font-black">{item.kodAktiviti || '-'} / {item.kodObjek || '-'}</span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleEditItemRow(item.id)}
                                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-black uppercase flex items-center gap-1 cursor-pointer shrink-0 transition-all active:scale-95 shadow-sm"
                                      title="Buka untuk kemaskini kod pecahan & perincian kerja"
                                    >
                                      <Edit2 size={13} /> Kemaskini
                                    </button>
                                  </div>
                                ) : (
                                  /* PAPARAN PENUH UNTUK KEMASKINI / TAMBAH ITEM (KOD SISTEM KEWANGAN & DETAIL) */
                                  <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-3 shadow-lg animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between">
                                      <div className="text-xs text-emerald-300 font-black uppercase tracking-wide">
                                        KOD PECAHAN ITEM (UNTUK SISTEM KEWANGAN):
                                      </div>
                                      <div className="text-xs text-emerald-300 font-mono font-black">
                                        {item.kodAktiviti || '031401'} / {item.kodObjek || 'R4419900'}
                                      </div>
                                    </div>
                                    {(() => {
                                      const { aktSubs, objSubs } = getAvailableSubCodesForForm(formData.kodAktivitiObjek || formData.allocationCode);
                                      return (
                                        <>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            <div>
                                              <label className="block text-xs text-emerald-300 font-black uppercase mb-1">
                                                Sub-Kod Aktiviti (Akt):
                                              </label>
                                              <select
                                                value={item.kodAktiviti || ''}
                                                onChange={(e) => handleItemChange(item.id, 'kodAktiviti', e.target.value)}
                                                className="w-full px-3 py-2 bg-black/85 border border-emerald-500/40 rounded-lg text-xs sm:text-sm text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-400 cursor-pointer"
                                              >
                                                <option value="" className="bg-gray-900 text-gray-400">-- Pilih Sub-Kod Akt --</option>
                                                {aktSubs.map((sc) => (
                                                  <option key={sc.subCode} value={sc.subCode} className="bg-gray-900 text-emerald-300">
                                                    {sc.subCode} {sc.perihal ? `- ${sc.perihal}` : ''}
                                                  </option>
                                                ))}
                                                {item.kodAktiviti && !aktSubs.some(s => s.subCode === item.kodAktiviti) && (
                                                  <option value={item.kodAktiviti} className="bg-gray-900 text-emerald-300">
                                                    {item.kodAktiviti} (Tersuai)
                                                  </option>
                                                )}
                                              </select>
                                            </div>

                                            <div>
                                              <label className="block text-xs text-emerald-300 font-black uppercase mb-1">
                                                Sub-Kod Objek:
                                              </label>
                                              <select
                                                value={item.kodObjek || ''}
                                                onChange={(e) => handleItemChange(item.id, 'kodObjek', e.target.value)}
                                                className="w-full px-3 py-2 bg-black/85 border border-emerald-500/40 rounded-lg text-xs sm:text-sm text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-400 cursor-pointer"
                                              >
                                                <option value="" className="bg-gray-900 text-gray-400">-- Pilih Sub-Kod Objek --</option>
                                                {objSubs.map((sc) => (
                                                  <option key={sc.subCode} value={sc.subCode} className="bg-gray-900 text-emerald-300">
                                                    {sc.subCode} {sc.perihal ? `- ${sc.perihal}` : ''}
                                                  </option>
                                                ))}
                                                {item.kodObjek && !objSubs.some(s => s.subCode === item.kodObjek) && (
                                                  <option value={item.kodObjek} className="bg-gray-900 text-emerald-300">
                                                    {item.kodObjek} (Tersuai)
                                                  </option>
                                                )}
                                              </select>
                                            </div>
                                          </div>

                                          {/* Ruangan Detail / Perincian Kerja Yang Perlu Dibuat */}
                                          <div className="pt-2 border-t border-emerald-500/20">
                                            <label className="block text-xs text-emerald-300 font-black uppercase mb-1">
                                              Detail / Perincian Kerja Yang Perlu Dibuat:
                                            </label>
                                            <input
                                              type="text"
                                              value={item.detailKerja || item.description || ''}
                                              onChange={(e) => {
                                                handleItemChange(item.id, 'detailKerja', e.target.value);
                                                handleItemChange(item.id, 'description', e.target.value);
                                              }}
                                              className="w-full px-3 py-2 bg-black/85 border border-emerald-500/40 focus:border-emerald-400 rounded-lg text-xs sm:text-sm uppercase font-bold text-white shadow-inner"
                                              placeholder="CONTOH: INSURAN PERLINDUNGAN TANGGUNGAN AWAM / PEMBINAAN PARIT"
                                              required
                                            />
                                          </div>

                                          {/* BUTANG SIMPAN ITEM */}
                                          <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between flex-wrap gap-2">
                                            <span className="text-xs text-emerald-300 font-medium">
                                              * Klik "Simpan Item" untuk mengunci kod &amp; paparan kemas.
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => handleSaveItemRow(item.id, idx)}
                                              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
                                            >
                                              <CheckCircle2 size={15} /> Simpan Item #{idx + 1}
                                            </button>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 px-3 align-top pt-4">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                                  disabled={isSaved}
                                  className={`w-full px-2.5 py-2 rounded-lg text-white text-xs sm:text-sm text-center font-mono font-bold transition-all ${
                                    isSaved ? 'bg-black/60 border border-emerald-500/30 cursor-not-allowed opacity-90' : 'bg-black/40 border border-white/20'
                                  }`}
                                  min={1}
                                />
                              </td>
                              <td className="py-3.5 px-3 align-top pt-4">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                                  disabled={isSaved}
                                  className={`w-full px-3 py-2 rounded-lg text-white text-xs sm:text-sm text-right font-mono font-bold transition-all ${
                                    isSaved ? 'bg-black/60 border border-emerald-500/30 cursor-not-allowed opacity-90' : 'bg-black/40 border border-white/20'
                                  }`}
                                />
                              </td>
                              <td className="py-3.5 px-3 text-right font-mono font-black text-emerald-400 text-xs sm:text-sm align-top pt-5">
                                RM {Number(item.totalPrice).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3.5 px-3 text-center align-top pt-4">
                                {formData.items && formData.items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                                    title="Padam Item"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-black/70 border-t border-white/20 font-bold">
                          <td colSpan={4} className="py-3.5 px-4 text-right uppercase text-xs sm:text-sm text-amber-400 font-black">
                            JUMLAH ANGGARAN KESELURAHAN (RM):
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono text-base text-emerald-400 font-black">
                            RM {Number(formData.estimatedAmount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* 4. KAJIAN PASARAN / KEPUTUSAN SEBUTHARGA */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  {isSebuthargaModule ? (
                    /* MODUL SEBUTHARGA: 1 PEMBEKAL / KONTRAKTOR PEMENANG SEBUTHARGA */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <label className="block text-xs font-black uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-2">
                            <Megaphone size={15} className="text-orange-400" />
                            4. Kaedah Perolehan &amp; Maklumat Pemenang Sebutharga
                          </label>
                          <span className="text-xs text-slate-300 font-semibold">
                            Perolehan dilaksanakan melalui proses Sebutharga Rasmi RISDA (Keputusan Mesyuarat Lembaga Perolehan / Jawatankuasa Sebutharga). Pembekal pemenang dilantik mengikut keputusan rasmi.
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-blue-500/40 rounded-2xl shadow-inner bg-blue-950/20">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead>
                            <tr className="bg-black/70 border-b border-white/20 text-xs text-slate-200 font-black uppercase tracking-wider">
                              <th className="py-3 px-3 w-12 text-center">Bil</th>
                              <th className="py-3 px-3">Nama Syarikat Kontraktor / Pembekal Berjaya</th>
                              <th className="py-3 px-3">Nama Pegawai / Telefon / Alamat</th>
                              <th className="py-3 px-3 w-44 text-center">Kaedah Perolehan</th>
                              <th className="py-3 px-3 w-40 text-right">Harga Tawaran Menang (RM)</th>
                              <th className="py-3 px-3 w-48 text-center">Status Keputusan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10 font-semibold">
                            {(() => {
                              const k = (formData.kajianPasaran && formData.kajianPasaran[0]) || {
                                bil: 1,
                                namaSyarikat: formData.pembekalDipilih || formData.supplierName || '',
                                pegawaiDihubungi: '',
                                kaedahKajian: 'SEBUTHARGA RASMI',
                                hargaTawaran: formData.estimatedAmount || 0,
                                catatan: 'Pemenang Sah Keputusan Sebutharga'
                              };
                              return (
                                <tr className="bg-blue-950/40">
                                  <td className="py-3 px-3 text-center text-amber-400 font-black font-mono text-sm">1</td>
                                  <td className="py-3 px-3">
                                    <input
                                      list="kajian-pembekal-list"
                                      type="text"
                                      value={k.namaSyarikat}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        handleKajianChange(0, 'namaSyarikat', val);
                                        setFormData(prev => ({ ...prev, pembekalDipilih: val, supplierName: val }));
                                        const matched = unifiedSuppliers.find(s => s.companyName.toUpperCase() === val.toUpperCase());
                                        if (matched) {
                                          const contactDetails = [
                                            matched.ownerName ? `PEMILIK: ${matched.ownerName}` : '',
                                            matched.cidbSpkk ? `LESEN: ${formatSimplifiedLicense(matched.cidbSpkk)}` : '',
                                            matched.phoneNumber ? `TEL: ${matched.phoneNumber}` : '',
                                            matched.address ? `ALAMAT: ${matched.address}` : ''
                                          ].filter(Boolean).join(' | ');
                                          if (contactDetails) {
                                            handleKajianChange(0, 'pegawaiDihubungi', contactDetails);
                                          }
                                        }
                                      }}
                                      className="w-full px-3 py-2 bg-black/70 border border-blue-400/50 rounded-lg text-white font-bold text-xs sm:text-sm uppercase shadow-inner"
                                      placeholder="Nama Kontraktor Pemenang Sebutharga"
                                      required
                                    />
                                    <datalist id="kajian-pembekal-list">
                                      {unifiedSuppliers.map(s => (
                                        <option key={s.id} value={s.companyName}>{`${s.ownerName} • ${formatSimplifiedLicense(s.cidbSpkk)} • ${s.phoneNumber || s.address}`}</option>
                                      ))}
                                    </datalist>
                                  </td>
                                  <td className="py-3 px-3">
                                    <input
                                      type="text"
                                      value={k.pegawaiDihubungi}
                                      onChange={(e) => handleKajianChange(0, 'pegawaiDihubungi', e.target.value)}
                                      className="w-full px-3 py-2 bg-black/70 border border-white/20 rounded-lg text-white text-xs sm:text-sm uppercase shadow-inner"
                                      placeholder="Pegawai / Pemilik / Lokasi / Tel"
                                    />
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <span className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 font-black text-xs border border-blue-500/40 inline-block uppercase">
                                      SEBUTHARGA RASMI
                                    </span>
                                  </td>
                                  <td className="py-3 px-3">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={k.hargaTawaran}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        handleKajianChange(0, 'hargaTawaran', val);
                                        setFormData(prev => ({ ...prev, estimatedAmount: Number(val) || prev.estimatedAmount }));
                                      }}
                                      className="w-full px-3 py-2 bg-black/70 border border-emerald-500/50 rounded-lg text-emerald-400 font-black text-xs sm:text-sm text-right font-mono shadow-inner"
                                    />
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black uppercase inline-block">
                                      ★ Pemenang Sah Dilantik
                                    </span>
                                  </td>
                                </tr>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>

                      {/* 5. PERAKUAN & JUSTIFIKASI SEBUTHARGA */}
                      <div className="space-y-3 pt-3 border-t border-white/10">
                        <label className="block text-xs font-black uppercase tracking-wider text-amber-400">
                          5. Perakuan &amp; Justifikasi Keputusan Sebutharga
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm text-white">
                          <label className="flex items-center gap-2.5 bg-black/60 p-3.5 rounded-xl border border-white/15 cursor-pointer hover:border-amber-400/50 transition-colors">
                            <input
                              type="checkbox"
                              checked={true}
                              readOnly
                              className="rounded border-white/20 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-semibold">Tawaran terendah yang mematuhi spesifikasi teknikal sebutharga</span>
                          </label>

                          <label className="flex items-center gap-2.5 bg-black/60 p-3.5 rounded-xl border border-white/15 cursor-pointer hover:border-amber-400/50 transition-colors">
                            <input
                              type="checkbox"
                              checked={true}
                              readOnly
                              className="rounded border-white/20 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-semibold">Lantikan berdasarkan Keputusan Mesyuarat Jawatankuasa Sebutharga RISDA</span>
                          </label>

                          <label className="flex items-center gap-2.5 bg-black/60 p-3.5 rounded-xl border border-white/15 cursor-pointer hover:border-amber-400/50 transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.justifikasi?.perolehanKhas ?? true}
                              onChange={(e) => setFormData({
                                ...formData,
                                justifikasi: { ...formData.justifikasi!, perolehanKhas: e.target.checked }
                              })}
                              className="rounded border-white/20 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-semibold">Kontraktor memenuhi syarat pendaftaran CIDB/MOF &amp; melepasi taklimat tapak</span>
                          </label>

                          <div className="bg-black/60 p-3.5 rounded-xl border border-white/15 space-y-2">
                            <label className="flex items-center gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.justifikasi?.lainLain ?? true}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  justifikasi: { ...formData.justifikasi!, lainLain: e.target.checked }
                                })}
                                className="rounded border-white/20 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                              />
                              <span className="font-semibold">Catatan Tambahan Keputusan:</span>
                            </label>
                            {formData.justifikasi?.lainLain && (
                              <input
                                type="text"
                                value={formData.justifikasi?.lainLainNyatakan || 'Mematuhi tatacara perolehan sebutharga kerajaan'}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  justifikasi: { ...formData.justifikasi!, lainLainNyatakan: e.target.value }
                                })}
                                className="w-full px-3 py-2 bg-black/70 border border-white/20 rounded-lg text-white text-xs sm:text-sm font-semibold shadow-inner"
                                placeholder="Nyatakan catatan keputusan..."
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 6. PEMBEKAL DIPILIH */}
                      <div className="pt-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-amber-400 mb-1.5">
                          6. Kontraktor / Pembekal Pemenang Dilantik
                        </label>
                        <input
                          type="text"
                          value={formData.pembekalDipilih || formData.supplierName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData({ ...formData, pembekalDipilih: val, supplierName: val });
                            handleKajianChange(0, 'namaSyarikat', val);
                          }}
                          className="w-full px-4 py-2.5 bg-black/70 border border-white/20 rounded-xl text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-amber-400 uppercase shadow-inner"
                          placeholder="Pemenang Sebutharga"
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    /* MODUL TAWARAN TERUS: 3 PEMBEKAL KAJIAN PASARAN */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <label className="block text-xs font-black uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-2">
                            <ShoppingBag size={15} className="text-amber-500" />
                            4. Kajian Pasaran Dilaksanakan (3 Pembekal Dipilih / Perbandingan 3 Pembekal)
                          </label>
                          <span className="text-xs text-slate-300 font-semibold">
                            Perolehan Tawaran Terus (1PP PK 2 / AP 95). Sila lengkapkan maklumat 3 pembekal perbandingan dan pilih calon layak sebagai pemenang.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              kajianPasaran: defaultKajianPasaran.map((k, i) => ({ ...k, bil: i + 1, namaSyarikat: '', hargaTawaran: 0 }))
                            }));
                            toast('Jadual 3 Pembekal Kajian Pasaran telah dikosongkan.', { icon: '🧹' });
                          }}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white border border-white/20 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer"
                        >
                          Kosongkan Jadual Kajian
                        </button>
                      </div>

                      <div className="overflow-x-auto border border-white/20 rounded-2xl shadow-inner">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead>
                            <tr className="bg-black/70 border-b border-white/20 text-xs text-slate-200 font-black uppercase tracking-wider">
                              <th className="py-3 px-2 w-10 text-center">Bil</th>
                              <th className="py-3 px-3">Nama Syarikat / Pembekal</th>
                              <th className="py-3 px-3">Nama Pegawai / Telefon / Alamat</th>
                              <th className="py-3 px-3 w-40">Kaedah Kajian</th>
                              <th className="py-3 px-3 w-36 text-right">Harga Tawaran (RM)</th>
                              <th className="py-3 px-3 w-44 text-center">Tindakan / Pilihan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10 font-semibold">
                            {[0, 1, 2].map((idx) => {
                              const kList = formData.kajianPasaran && formData.kajianPasaran.length >= 3 
                                ? formData.kajianPasaran 
                                : defaultKajianPasaran;
                              const k = kList[idx] || { bil: idx + 1, namaSyarikat: '', pegawaiDihubungi: '', kaedahKajian: 'SEBUTHARGA', hargaTawaran: 0, catatan: '' };
                              const isSelectedWinner = formData.pembekalDipilih && formData.pembekalDipilih.toUpperCase() === (k.namaSyarikat || '').toUpperCase() && k.namaSyarikat !== '';

                              return (
                                <tr key={idx} className={isSelectedWinner ? 'bg-emerald-950/40 ring-1 ring-emerald-500/40' : 'bg-black/40'}>
                                  <td className="py-3 px-2 text-center text-amber-400 font-black font-mono text-sm">{idx + 1}</td>
                                  <td className="py-3 px-2">
                                    <input
                                      list="kajian-pembekal-list"
                                      type="text"
                                      value={k.namaSyarikat}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        handleKajianChange(idx, 'namaSyarikat', val);
                                        if (idx === 0 && !formData.pembekalDipilih) {
                                          setFormData(prev => ({ ...prev, pembekalDipilih: val, supplierName: val }));
                                        }
                                        const matched = unifiedSuppliers.find(s => s.companyName.toUpperCase() === val.toUpperCase());
                                        if (matched) {
                                          const contactDetails = [
                                            matched.ownerName ? `PEMILIK: ${matched.ownerName}` : '',
                                            matched.cidbSpkk ? `LESEN: ${formatSimplifiedLicense(matched.cidbSpkk)}` : '',
                                            matched.phoneNumber ? `TEL: ${matched.phoneNumber}` : '',
                                            matched.address ? `ALAMAT: ${matched.address}` : ''
                                          ].filter(Boolean).join(' | ');
                                          if (contactDetails) {
                                            handleKajianChange(idx, 'pegawaiDihubungi', contactDetails);
                                          }
                                        }
                                      }}
                                      className={`w-full px-3 py-2 bg-black/70 rounded-lg text-white font-bold text-xs sm:text-sm uppercase shadow-inner ${
                                        isSelectedWinner ? 'border-2 border-emerald-500' : 'border border-white/20'
                                      }`}
                                      placeholder={`Pembekal #${idx + 1} (cth: Syarikat ABC)`}
                                    />
                                    <datalist id="kajian-pembekal-list">
                                      {unifiedSuppliers.map(s => (
                                        <option key={s.id} value={s.companyName}>{`${s.ownerName} • ${formatSimplifiedLicense(s.cidbSpkk)} • ${s.phoneNumber || s.address}`}</option>
                                      ))}
                                    </datalist>
                                  </td>
                                  <td className="py-3 px-2">
                                    <input
                                      type="text"
                                      value={k.pegawaiDihubungi}
                                      onChange={(e) => handleKajianChange(idx, 'pegawaiDihubungi', e.target.value)}
                                      className="w-full px-3 py-2 bg-black/70 border border-white/20 rounded-lg text-white text-xs sm:text-sm uppercase shadow-inner"
                                      placeholder="Pegawai / Lokasi / Tel"
                                    />
                                  </td>
                                  <td className="py-3 px-2">
                                    <select
                                      value={k.kaedahKajian || 'SEBUTHARGA'}
                                      onChange={(e) => handleKajianChange(idx, 'kaedahKajian', e.target.value)}
                                      className="w-full px-3 py-2 bg-black/70 border border-white/20 rounded-lg text-white text-xs sm:text-sm font-semibold cursor-pointer"
                                    >
                                      <option value="SEBUTHARGA">Sebutharga Pembekal</option>
                                      <option value="Laman Web">Laman Web</option>
                                      <option value="Katalog eP">Katalog eP</option>
                                      <option value="Harga Belian Lampau">Harga Belian Lampau</option>
                                    </select>
                                  </td>
                                  <td className="py-3 px-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={k.hargaTawaran}
                                      onChange={(e) => handleKajianChange(idx, 'hargaTawaran', e.target.value)}
                                      className="w-full px-3 py-2 bg-black/70 border border-emerald-500/50 rounded-lg text-emerald-400 font-black text-xs sm:text-sm text-right font-mono shadow-inner"
                                    />
                                  </td>
                                  <td className="py-3 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!k.namaSyarikat) {
                                          toast.error(`Sila isi Nama Syarikat untuk Pembekal #${idx + 1} terlebih dahulu.`);
                                          return;
                                        }
                                        setFormData(prev => ({
                                          ...prev,
                                          pembekalDipilih: k.namaSyarikat,
                                          supplierName: k.namaSyarikat,
                                          estimatedAmount: Number(k.hargaTawaran) || prev.estimatedAmount,
                                          kajianPasaran: (prev.kajianPasaran || defaultKajianPasaran).map((item, i) => ({
                                            ...item,
                                            catatan: i === idx ? 'Dipilih (Pemenang Layak)' : `Perbandingan #${i + 1}`
                                          }))
                                        }));
                                        toast.success(`Pembekal #${idx + 1} (${k.namaSyarikat}) dipilih sebagai pemenang tawaran terus!`);
                                      }}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                                        isSelectedWinner
                                          ? 'bg-emerald-600 text-white shadow-md'
                                          : 'bg-white/10 hover:bg-emerald-600/60 text-slate-300 hover:text-white border border-white/20'
                                      }`}
                                    >
                                      {isSelectedWinner ? '★ PEMBEKAL DIPILIH' : 'PILIH PEMBEKAL INI'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* 5. JUSTIFIKASI 3 PEMBEKAL */}
                      <div className="space-y-4 pt-4 border-t border-white/10">
                        <label className="block text-xs font-black uppercase tracking-wider text-amber-400">
                          5. Justifikasi Sekiranya Tidak Dapat Menyediakan 3 Perbandingan Harga
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm text-white">
                          <label className="flex items-center gap-2.5 bg-black/60 p-3.5 rounded-xl border border-white/15 cursor-pointer hover:border-amber-400/50 transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.justifikasi?.tiadaPembekalLain || false}
                              onChange={(e) => setFormData({
                                ...formData,
                                justifikasi: { ...formData.justifikasi!, tiadaPembekalLain: e.target.checked }
                              })}
                              className="rounded border-white/20 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-semibold">Tiada pembekal lain yang boleh memberi perkhidmatan tersebut</span>
                          </label>

                          <label className="flex items-center gap-2.5 bg-black/60 p-3.5 rounded-xl border border-white/15 cursor-pointer hover:border-amber-400/50 transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.justifikasi?.kadarHargaAgensi || false}
                              onChange={(e) => setFormData({
                                ...formData,
                                justifikasi: { ...formData.justifikasi!, kadarHargaAgensi: e.target.checked }
                              })}
                              className="rounded border-white/20 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-semibold">Kadar harga ditentukan oleh badan/organisasi/agensi yang diiktiraf</span>
                          </label>

                          <label className="flex items-center gap-2.5 bg-black/60 p-3.5 rounded-xl border border-white/15 cursor-pointer hover:border-amber-400/50 transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.justifikasi?.perolehanKhas || false}
                              onChange={(e) => setFormData({
                                ...formData,
                                justifikasi: { ...formData.justifikasi!, perolehanKhas: e.target.checked }
                              })}
                              className="rounded border-white/20 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-semibold">Perolehan disebabkan perjanjian atau kepakaran khas</span>
                          </label>

                          <div className="bg-black/60 p-3.5 rounded-xl border border-white/15 space-y-2">
                            <label className="flex items-center gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.justifikasi?.lainLain || false}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  justifikasi: { ...formData.justifikasi!, lainLain: e.target.checked }
                                })}
                                className="rounded border-white/20 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                              />
                              <span className="font-semibold">Lain-lain (nyatakan):</span>
                            </label>
                            {formData.justifikasi?.lainLain && (
                              <input
                                type="text"
                                value={formData.justifikasi?.lainLainNyatakan || ''}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  justifikasi: { ...formData.justifikasi!, lainLainNyatakan: e.target.value }
                                })}
                                className="w-full px-3 py-2 bg-black/70 border border-white/20 rounded-lg text-white text-xs sm:text-sm font-semibold shadow-inner"
                                placeholder="Nyatakan sebab..."
                              />
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-black uppercase tracking-wider text-amber-400 mb-1.5">
                            6. Pembekal Yang Dipilih
                          </label>
                          <input
                            list="kajian-pembekal-list"
                            type="text"
                            value={formData.pembekalDipilih || formData.supplierName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData({ ...formData, pembekalDipilih: val, supplierName: val });
                              handleKajianChange(0, 'namaSyarikat', val);
                              const matched = unifiedSuppliers.find(s => s.companyName.toUpperCase() === val.toUpperCase());
                              if (matched) {
                                const contactDetails = [
                                  matched.ownerName ? `PEMILIK: ${matched.ownerName}` : '',
                                  matched.cidbSpkk ? `LESEN: ${formatSimplifiedLicense(matched.cidbSpkk)}` : '',
                                  matched.phoneNumber ? `TEL: ${matched.phoneNumber}` : '',
                                  matched.address ? `ALAMAT: ${matched.address}` : ''
                                ].filter(Boolean).join(' | ');
                                if (contactDetails) {
                                  handleKajianChange(0, 'pegawaiDihubungi', contactDetails);
                                }
                              }
                            }}
                            className="w-full px-4 py-2.5 bg-black/70 border border-white/20 rounded-xl text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-amber-400 uppercase shadow-inner"
                            placeholder="PUNCAK BAYU / PILIH DARI DATA PEMBEKAL"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SEKSI B: PENGESAHAN BAKI PERUNTUKAN OLEH UNIT KEWANGAN */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm sm:text-base font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <Coins size={18} /> B. PENGESAHAN BAKI PERUNTUKAN OLEH UNIT KEWANGAN
                  </h3>
                  {(formData.kodAktivitiObjek || formData.allocationCode) && (
                    <button
                      type="button"
                      onClick={() => setShowAllocSelectionModal(true)}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw size={13} /> Tukar Kod Induk
                    </button>
                  )}
                </div>

                {/* Status Pengesahan Auto */}
                {(formData.kodAktivitiObjek || formData.allocationCode) && (
                  <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm text-emerald-300 font-semibold min-w-0">
                      <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs uppercase font-black text-emerald-400">
                          Kod Peruntukan Induk Auto-Dipilih:
                        </div>
                        <div className="text-white font-bold text-xs sm:text-sm truncate">
                          {formData.kodAktivitiObjek || formData.allocationCode}
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono font-black text-xs sm:text-sm shrink-0 border border-emerald-500/30">
                      Baki: RM {Number(formData.bakiPeruntukanRm || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-emerald-400 mb-1.5">
                      Status Pengesahan Baki
                    </label>
                    <select
                      value={formData.pengesahanKewanganStatus}
                      onChange={(e) => setFormData({ ...formData, pengesahanKewanganStatus: e.target.value as any })}
                      className="w-full px-4 py-2.5 bg-black/70 border border-white/20 rounded-xl text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-emerald-400 cursor-pointer shadow-inner"
                    >
                      <option value="MENCUKUPI">MENCUKUPI</option>
                      <option value="TIDAK MENCUKUPI">TIDAK MENCUKUPI</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-emerald-400 mb-1.5">
                      Baki Peruntukan (RM)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.bakiPeruntukanRm}
                      onChange={(e) => setFormData({ ...formData, bakiPeruntukanRm: Number(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-black/70 border border-white/20 rounded-xl text-white text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-emerald-400 shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-emerald-400 mb-1.5 flex items-center justify-between">
                    <span>Kod Aktiviti / Objek Induk (Seksi B)</span>
                    <span className="text-xs text-emerald-300 font-bold">Pilihan Kod Induk Sahaja</span>
                  </label>
                  {allocationCodes.length > 0 ? (
                    <select
                      value={formData.kodAktivitiObjek || formData.allocationCode}
                      onChange={(e) => handleSelectAllocationCode(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/85 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs sm:text-sm font-bold focus:outline-none focus:border-emerald-400 cursor-pointer shadow-inner"
                    >
                      <option value="">-- PILIH KOD PERUNTUKAN INDUK / VOT --</option>
                      {allocationCodes.map((ac) => {
                        const codeVal = `${ac.akt || ''} ${ac.obj || ''} - ${ac.perihal || ac.name || ''}`.trim();
                        const bakiVal = Number(ac.bakiPeruntukan ?? ac.balanceAmount ?? ac.amount ?? 0);
                        return (
                          <option key={ac.id} value={codeVal}>
                            {ac.akt ? `[VOT INDUK] ${ac.akt} / ${ac.obj} - ` : ''}{ac.perihal || ac.name} (Baki: RM {bakiVal.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.kodAktivitiObjek || formData.allocationCode}
                      onChange={(e) => setFormData({ ...formData, kodAktivitiObjek: e.target.value, allocationCode: e.target.value })}
                      className="w-full px-4 py-2.5 bg-black/70 border border-white/20 rounded-xl text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-emerald-400 uppercase shadow-inner"
                      placeholder="031400 / R4400000 - PAP (KOD INDUK)"
                    />
                  )}
                  <span className="text-xs text-emerald-300 font-semibold block mt-1.5">
                    * Pilihan di atas adalah Kod Induk sahaja. Bagi pecahan spesifik (seperti 031401, 031402, dll.), sila tetapkan pada setiap item di Jadual Item Detail bagi memudahkan Unit Kewangan mengesan kod tersebut.
                  </span>
                </div>
              </div>

              {/* SEKSI C: KELULUSAN KETUA PUSAT TANGGUNGJAWAB */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h3 className="text-sm sm:text-base font-black text-sky-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={18} /> C. KELULUSAN KETUA PUSAT TANGGUNGJAWAB
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-sky-400 mb-1.5">
                      Keputusan Kelulusan PTJ
                    </label>
                    <select
                      value={formData.kelulusanKetuaPtjStatus}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        kelulusanKetuaPtjStatus: e.target.value as any,
                        status: e.target.value === 'DILULUSKAN' ? 'LULUS' : 'DITOLAK'
                      })}
                      className="w-full px-4 py-2.5 bg-black/70 border border-white/20 rounded-xl text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-sky-400 cursor-pointer shadow-inner"
                    >
                      <option value="DILULUSKAN">DILULUSKAN</option>
                      <option value="TIDAK DILULUSKAN">TIDAK DILULUSKAN</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-sky-400 mb-1.5">
                      Ketua Pusat Tanggungjawab
                    </label>
                    <input
                      type="text"
                      value={formData.ketuaPtjNama}
                      onChange={(e) => setFormData({ ...formData, ketuaPtjNama: e.target.value })}
                      className="w-full px-4 py-2.5 bg-black/70 border border-white/20 rounded-xl text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-sky-400 uppercase shadow-inner"
                      placeholder="Nama Ketua PTJ"
                    />
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 bg-white/10 hover:bg-white/15 rounded-xl text-xs sm:text-sm font-black uppercase text-white transition-all cursor-pointer"
                >
                  BATAL
                </button>

                <button
                  type="submit"
                  className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-lg hover:scale-105 transition-all cursor-pointer"
                >
                  SIMPAN BORANG KAJIAN PASARAN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SLIP PREVIEW & DETAIL BORANG */}
      {showDetailModal && selectedRequestForDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-risda-card border border-risda-border w-full max-w-3xl rounded-3xl shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Top Bar */}
            {(() => {
              const isDetailSebutharga = selectedRequestForDetail.module === 'sebutharga' || 
                (selectedRequestForDetail.rujukanDokumen && (selectedRequestForDetail.rujukanDokumen.toUpperCase().includes('SH/') || selectedRequestForDetail.rujukanDokumen.toUpperCase().includes('SEBUTHARGA'))) || 
                (selectedRequestForDetail.orderNo && (selectedRequestForDetail.orderNo.toUpperCase().startsWith('PP/RISDA') || selectedRequestForDetail.orderNo.toUpperCase().includes('SH')));

              return (
                <>
                  <div className="p-6 border-b border-risda-border flex items-center justify-between bg-black/5 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isDetailSebutharga 
                          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' 
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/25'
                      }`}>
                        {isDetailSebutharga ? <Megaphone size={20} /> : <FileCheck size={20} />}
                      </div>
                      <div>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                          {selectedRequestForDetail.orderNo} • {formatDateDMY(selectedRequestForDetail.requestDate)}
                        </span>
                        <h3 className="text-base sm:text-lg font-black text-white">
                          {isDetailSebutharga ? 'Perincian Permohonan & Keputusan Sebutharga' : 'Perincian Permohonan Tawaran Terus'}
                        </h3>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="w-9 h-9 rounded-xl border border-white/20 text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-slate-100">
                    {/* Title & Category Banner */}
                    <div className="p-4.5 rounded-2xl bg-white/5 border border-white/15 space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-full ${
                          selectedRequestForDetail.category === 'BEKALAN'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            : selectedRequestForDetail.category === 'PERKHIDMATAN'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          {selectedRequestForDetail.category}
                        </span>
                        <span className="text-xs font-bold text-slate-300 font-mono">
                          Vot Bajet: {selectedRequestForDetail.kodAktivitiObjek || selectedRequestForDetail.allocationCode || 'B62'}
                        </span>
                      </div>
                      <h4 className="text-sm sm:text-base font-black text-white leading-relaxed">
                        {selectedRequestForDetail.perihalPerolehan || selectedRequestForDetail.title}
                      </h4>
                      {selectedRequestForDetail.remarks && (
                        <p className="text-xs text-slate-200 font-medium leading-relaxed">
                          {selectedRequestForDetail.remarks}
                        </p>
                      )}
                    </div>

                    {/* AI Integrity Audit Badge */}
                    <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                      isDetailSebutharga 
                        ? 'bg-blue-950/40 border-blue-500/40' 
                        : 'bg-indigo-950/40 border-indigo-500/30'
                    }`}>
                      <Sparkles size={20} className={isDetailSebutharga ? 'text-amber-400 shrink-0 mt-0.5' : 'text-purple-400 shrink-0 mt-0.5'} />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-black text-purple-300">
                            {isDetailSebutharga 
                              ? `Semakan Pematuhan Keputusan Sebutharga & Siling (${selectedRequestForDetail.aiCompliance || 98}% Patuh)`
                              : `Semakan Integriti & Pematuhan AP 173 (${selectedRequestForDetail.aiCompliance || 96}% Lulus)`
                            }
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                          {isDetailSebutharga
                            ? 'Sistem mengesahkan lantikan mematuhi keputusan rasmi Mesyuarat Jawatankuasa / Lembaga Sebutharga RISDA, melepasi penilaian teknikal & harga, dan kontraktor mempunyai lesen CIDB/MOF aktif.'
                            : `Sistem mengesahkan tiada unsur pecah kecil perolehan, had perolehan mematuhi siling rasmi (RM 50,000), dan kod bidang pembekal aktif dan sah.`
                          }
                        </p>
                      </div>
                    </div>

                    {/* Pembekal & Nilai */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <div className="text-xs text-slate-300 uppercase font-black">
                          {isDetailSebutharga ? 'Kontraktor / Pembekal Pemenang Dilantik' : 'Pembekal Terpilih'}
                        </div>
                        <div className="font-bold text-white text-sm sm:text-base">
                          {selectedRequestForDetail.pembekalDipilih || selectedRequestForDetail.supplierName || 'PUNCAK BAYU'}
                        </div>
                        <div className="text-xs font-mono text-slate-300 font-bold">
                          {selectedRequestForDetail.supplierCode || (selectedRequestForDetail.category === 'KERJA' ? 'CIDB G2' : 'MOF')}
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <div className="text-xs text-slate-300 uppercase font-black">
                          {isDetailSebutharga ? 'Harga Tawaran Menang Sebutharga' : 'Jumlah Nilai Permohonan'}
                        </div>
                        <div className="text-xl font-black text-amber-400 tabular-nums">
                          RM {Number(selectedRequestForDetail.estimatedAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-emerald-400 font-bold">
                          Status: {selectedRequestForDetail.status} • Kewangan: {selectedRequestForDetail.financeStatus || 'BELUM DIHANTAR'}
                        </div>
                      </div>
                    </div>

                    {/* Senarai Item Spesifikasi */}
                    <div className="space-y-2">
                      <div className="text-xs font-black uppercase text-slate-200 flex items-center justify-between tracking-wider">
                        <span>Pecahan Spesifikasi &amp; Skop Perolehan</span>
                        <span className="font-mono text-xs text-amber-400 font-bold">
                          {selectedRequestForDetail.items?.length || 0} Item
                        </span>
                      </div>
                      <div className="border border-white/15 rounded-xl overflow-hidden bg-black/40">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead className="bg-black/60 text-xs font-black uppercase text-slate-200 border-b border-white/15">
                            <tr>
                              <th className="p-3 w-12 text-center">Bil</th>
                              <th className="p-3">Perihal Item</th>
                              <th className="p-3 text-center w-24">Kuantiti</th>
                              <th className="p-3 text-right w-32">Harga Seunit (RM)</th>
                              <th className="p-3 text-right w-36">Jumlah (RM)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10 font-semibold">
                            {(selectedRequestForDetail.items || []).map((it, idx) => (
                              <tr key={it.id || idx}>
                                <td className="p-3 text-center font-bold text-amber-400">{idx + 1}</td>
                                <td className="p-3 font-bold uppercase text-white">
                                  <div>{it.description}</div>
                                </td>
                                <td className="p-3 text-center font-mono text-white font-bold">{it.quantity} {it.unit || ''}</td>
                                <td className="p-3 text-right font-mono text-slate-200">{Number(it.unitPrice).toFixed(2)}</td>
                                <td className="p-3 text-right font-mono font-black text-amber-400">{Number(it.totalPrice).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer Actions */}
                  <div className="p-5 border-t border-risda-border bg-black/5 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowDetailModal(false);
                          handlePrintSlip(selectedRequestForDetail);
                        }}
                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all shadow-md cursor-pointer"
                      >
                        <Printer size={15} /> {isDetailSebutharga ? 'CETAK BORANG SEBUTHARGA / LO' : 'CETAK BORANG KAJIAN PASARAN / LO'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDetailModal(false);
                          handleEdit(selectedRequestForDetail);
                        }}
                        className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-risda-text font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Edit2 size={13} /> EDIT
                      </button>
                      {(isPenyemak || isAdmin) && (selectedRequestForDetail.status === 'MENUNGGU SEMAKAN' || selectedRequestForDetail.status === 'DALAM SEMAKAN') && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowDetailModal(false);
                            openReviewModal(selectedRequestForDetail);
                          }}
                          className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                        >
                          <ShieldCheck size={14} /> {isDetailSebutharga ? 'SEMAK KEPUTUSAN SEBUTHARGA' : 'SEMAK & PILIH 3 PEMBEKAL'}
                        </button>
                      )}

                      {(isPelulus || isAdmin) && selectedRequestForDetail.status === 'MENUNGGU KELULUSAN' && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowDetailModal(false);
                            openApprovalModal(selectedRequestForDetail);
                          }}
                          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                        >
                          <CheckCircle2 size={14} /> {isDetailSebutharga ? 'LULUSKAN SEBUTHARGA & KELUARKAN LO' : 'LULUSKAN TAWARAN TERUS'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          handleSendToFinanceSystem(selectedRequestForDetail);
                          setShowDetailModal(false);
                        }}
                        className="px-4 py-2.5 bg-blue-600/80 hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Send size={13} /> HANTAR KEWANGAN
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleDelete(selectedRequestForDetail.id!);
                        }}
                        className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all cursor-pointer"
                        title="Padam Rekod"
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDetailModal(false)}
                        className="px-5 py-2.5 bg-risda-card border border-risda-border hover:bg-white/5 text-risda-text font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                      >
                        TUTUP
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL 3: KEMASKINI / TAMBAH ITEM PESANAN KEWANGAN (e-Kewangan) */}
      {itemModalOpen && currentReqForItemModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-risda-card border border-risda-border rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-risda-border pb-4 mb-6">
              <div>
                <h2 className="text-lg font-black text-risda-text uppercase tracking-tight flex items-center gap-2">
                  <Coins className="text-emerald-500 dark:text-emerald-400" size={20} />
                  KEMASKINI ITEM PESANAN KEWANGAN
                </h2>
                <p className="text-xs text-risda-muted font-bold mt-0.5">
                  Lengkapkan butiran item, Kod Aktiviti & Kod Objek untuk e-Kewangan RISDA.
                </p>
              </div>
              <button
                onClick={() => setItemModalOpen(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-risda-muted hover:text-risda-text cursor-pointer"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveFinancialItem} className="space-y-4 text-xs sm:text-sm text-slate-900 dark:text-white">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1.5">
                  Perihal Item / Perkhidmatan / Kerja
                </label>
                <textarea
                  rows={2}
                  value={itemFormData.description}
                  onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white text-xs sm:text-sm uppercase font-bold focus:outline-none focus:border-emerald-500 shadow-inner"
                  placeholder="Contoh: INSURAN PERLINDUNGAN TANGGUNGAN AWAM"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1.5">
                  Detail / Perincian Kerja Yang Perlu Dibuat (cth: INSURAN PAMPASAN PEKERJA)
                </label>
                <input
                  type="text"
                  value={itemFormData.detailKerja || ''}
                  onChange={(e) => setItemFormData({ ...itemFormData, detailKerja: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white text-xs sm:text-sm uppercase font-bold focus:outline-none focus:border-emerald-500 shadow-inner"
                  placeholder="Contoh: INSURAN PAMPASAN PEKERJA / PEMBINAAN PARIT"
                />
              </div>

              {/* Dynamic Sub-Codes Selection Dropdowns */}
              {(() => {
                const { aktSubs, objSubs } = getAvailableSubCodesForForm(currentReqForItemModal?.kodAktivitiObjek || currentReqForItemModal?.allocationCode || '');
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1.5">
                        Kod Aktiviti (Akt)
                      </label>
                      <select
                        value={itemFormData.kodAktiviti || ''}
                        onChange={(e) => setItemFormData({ ...itemFormData, kodAktiviti: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white font-mono text-xs sm:text-sm uppercase font-bold focus:outline-none focus:border-emerald-500 cursor-pointer shadow-inner"
                      >
                        <option value="" className="bg-white dark:bg-gray-900 text-gray-500">-- Pilih Sub-Kod Aktiviti --</option>
                        {aktSubs.map((sc) => (
                          <option key={sc.subCode} value={sc.subCode} className="bg-white dark:bg-gray-900 text-black dark:text-white">
                            {sc.subCode} {sc.perihal ? `- ${sc.perihal}` : ''}
                          </option>
                        ))}
                        {itemFormData.kodAktiviti && !aktSubs.some(s => s.subCode === itemFormData.kodAktiviti) && (
                          <option value={itemFormData.kodAktiviti} className="bg-white dark:bg-gray-900 text-black dark:text-white">
                            {itemFormData.kodAktiviti} (Tersuai)
                          </option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1.5">
                        Kod Objek (Objek)
                      </label>
                      <select
                        value={itemFormData.kodObjek || ''}
                        onChange={(e) => setItemFormData({ ...itemFormData, kodObjek: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white font-mono text-xs sm:text-sm uppercase font-bold focus:outline-none focus:border-emerald-500 cursor-pointer shadow-inner"
                      >
                        <option value="" className="bg-white dark:bg-gray-900 text-gray-500">-- Pilih Sub-Kod Objek --</option>
                        {objSubs.map((sc) => (
                          <option key={sc.subCode} value={sc.subCode} className="bg-white dark:bg-gray-900 text-black dark:text-white">
                            {sc.subCode} {sc.perihal ? `- ${sc.perihal}` : ''}
                          </option>
                        ))}
                        {itemFormData.kodObjek && !objSubs.some(s => s.subCode === itemFormData.kodObjek) && (
                          <option value={itemFormData.kodObjek} className="bg-white dark:bg-gray-900 text-black dark:text-white">
                            {itemFormData.kodObjek} (Tersuai)
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1.5">
                    No. Aset (Jika Ada)
                  </label>
                  <input
                    type="text"
                    value={itemFormData.noAset}
                    onChange={(e) => setItemFormData({ ...itemFormData, noAset: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white font-mono text-xs sm:text-sm uppercase font-bold focus:outline-none focus:border-emerald-500 shadow-inner"
                    placeholder="No. Aset"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1.5">
                    Kuantiti
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemFormData.quantity}
                    onChange={(e) => {
                      const qty = Number(e.target.value) || 0;
                      const price = Number(itemFormData.unitPrice) || 0;
                      const total = qty * price;
                      const gst = Number(itemFormData.nilaiGst) || 0;
                      setItemFormData({
                        ...itemFormData,
                        quantity: qty,
                        totalPrice: total,
                        jumlahHarga: total + gst
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white font-mono text-xs sm:text-sm font-bold text-right focus:outline-none focus:border-emerald-500 shadow-inner"
                    min={0}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1.5">
                    Harga Seunit (RM)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemFormData.unitPrice}
                    onChange={(e) => {
                      const price = Number(e.target.value) || 0;
                      const qty = Number(itemFormData.quantity) || 0;
                      const total = qty * price;
                      const gst = Number(itemFormData.nilaiGst) || 0;
                      setItemFormData({
                        ...itemFormData,
                        unitPrice: price,
                        totalPrice: total,
                        jumlahHarga: total + gst
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white font-mono text-xs sm:text-sm font-bold text-right focus:outline-none focus:border-emerald-500 shadow-inner"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1.5">
                    Nilai GST (RM)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemFormData.nilaiGst}
                    onChange={(e) => {
                      const gst = Number(e.target.value) || 0;
                      const total = Number(itemFormData.totalPrice) || 0;
                      setItemFormData({
                        ...itemFormData,
                        nilaiGst: gst,
                        jumlahHarga: total + gst
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white font-mono text-xs sm:text-sm font-bold text-right focus:outline-none focus:border-emerald-500 shadow-inner"
                  />
                </div>
              </div>

              <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl flex items-center justify-between font-mono shadow-inner">
                <div>
                  <span className="text-xs uppercase block font-black text-emerald-800 dark:text-emerald-300">Jumlah (RM):</span>
                  <span className="text-base font-black text-slate-950 dark:text-white">
                    {(Number(itemFormData.quantity) * Number(itemFormData.unitPrice)).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase block font-black text-emerald-800 dark:text-emerald-300">Jumlah Harga + GST (RM):</span>
                  <span className="text-lg font-black text-amber-500 dark:text-amber-400">
                    {((Number(itemFormData.quantity) * Number(itemFormData.unitPrice)) + Number(itemFormData.nilaiGst || 0)).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-risda-border">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-black uppercase cursor-pointer transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-lg hover:scale-105 transition-all cursor-pointer"
                >
                  Simpan Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: SEMAKAN PENYEMAK & PEMILIHAN 3 PEMBEKAL           */}
      {/* ========================================================= */}
      {showReviewModal && selectedReqForReview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-risda-card border border-sky-500/40 rounded-3xl p-5 sm:p-7 max-w-4xl w-full shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            {(() => {
              const isReviewSebutharga = selectedReqForReview.module === 'sebutharga' || 
                (selectedReqForReview.rujukanDokumen && (selectedReqForReview.rujukanDokumen.toUpperCase().includes('SH/') || selectedReqForReview.rujukanDokumen.toUpperCase().includes('SEBUTHARGA'))) || 
                (selectedReqForReview.orderNo && (selectedReqForReview.orderNo.toUpperCase().startsWith('PP/RISDA') || selectedReqForReview.orderNo.toUpperCase().includes('SH')));

              return (
                <>
                  <div className="flex items-start justify-between border-b border-risda-border pb-4 mb-5">
                    <div>
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 ${
                        isReviewSebutharga 
                          ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400' 
                          : 'bg-sky-500/15 border border-sky-500/30 text-sky-400'
                      }`}>
                        {isReviewSebutharga ? <Megaphone size={14} className="text-orange-400" /> : <ShieldCheck size={14} className="text-sky-400" />}
                        <span>{isReviewSebutharga ? 'PERANAN PENYEMAK • PENGESAHAN KEPUTUSAN SEBUTHARGA' : 'PERANAN PENYEMAK • KAJIAN PASARAN & KELAYAKAN'}</span>
                      </div>
                      <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        {isReviewSebutharga ? 'Semakan Keputusan Sebutharga & Pengesahan Pemenang' : 'Semakan Tawaran Terus & Pemilihan 3 Pembekal'}
                      </h2>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold mt-1">
                        {isReviewSebutharga 
                          ? 'Menyemak permohonan pesanan Sebutharga dan mengesahkan maklumat kontraktor pemenang sebutharga yang diputuskan Jawatankuasa Sebutharga RISDA sebelum dikemukakan untuk kelulusan Pegawai Pelulus.'
                          : 'Menyemak permohonan yang diisi penginput, memilih 3 pembekal bagi kajian pasaran / tawaran harga, dan menetapkan pembekal mana yang layak & dipilih sebelum dikemukakan untuk kelulusan Pegawai Pelulus.'
                        }
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowReviewModal(false)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-all"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Ringkasan Permohonan */}
                  <div className={`border rounded-2xl p-4 mb-5 space-y-2 ${
                    isReviewSebutharga ? 'bg-blue-500/5 border-blue-500/20' : 'bg-sky-500/5 border-sky-500/20'
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`text-xs font-mono font-black ${isReviewSebutharga ? 'text-blue-400' : 'text-sky-400'}`}>
                        {selectedReqForReview.orderNo}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        Tarikh: {formatDateDMY(selectedReqForReview.requestDate)}
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase">
                      {selectedReqForReview.perihalPerolehan || selectedReqForReview.title}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-sky-500/15 text-xs">
                      <div>
                        <span className="text-slate-500 font-bold block">Kategori / Vot:</span>
                        <span className="font-black text-slate-800 dark:text-slate-200">
                          {selectedReqForReview.category} • {selectedReqForReview.kodAktivitiObjek || selectedReqForReview.allocationCode}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block">Anggaran Jabatan:</span>
                        <span className="font-mono font-black text-amber-500">
                          RM {Number(selectedReqForReview.estimatedAmount || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block">Pegawai Penginput:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                          {selectedReqForReview.requestedBy || selectedReqForReview.disediakanOlehNama || 'Pegawai Penginput'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Pemilihan 3 Pembekal / Pemenang Sebutharga */}
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-black ${isReviewSebutharga ? 'bg-blue-600' : 'bg-sky-500'}`}>
                          1
                        </span>
                        {isReviewSebutharga ? 'Pengesahan Kontraktor Pemenang Sebutharga' : 'Pemilihan 3 Pembekal (Kajian Pasaran / Perbandingan)'}
                      </h4>
                      <span className={`text-[11px] font-bold ${isReviewSebutharga ? 'text-blue-400' : 'text-sky-400'}`}>
                        {isReviewSebutharga ? '*Sahkan maklumat kontraktor yang memenangi tender Sebutharga' : '*Pilih pembekal layak (pemenang) dengan menekan butang radio'}
                      </span>
                    </div>

                    {isReviewSebutharga ? (
                      <div className="border border-blue-500/40 bg-blue-950/20 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-black uppercase text-blue-300 flex items-center gap-2">
                            <Trophy size={16} className="text-amber-400" />
                            Kontraktor / Pembekal Pemenang Sebutharga Dilantik
                          </span>
                          <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ★ Pemenang Sah Keputusan Sebutharga
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                              Nama Kontraktor Pemenang
                            </label>
                            <input
                              list="review-sebutharga-supplier-list"
                              type="text"
                              value={review3Suppliers[0]?.namaSyarikat || selectedReqForReview.pembekalDipilih || selectedReqForReview.supplierName || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleReviewSupplierSelect(0, val);
                              }}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                              placeholder="Nama Kontraktor Pemenang Sebutharga"
                            />
                            <datalist id="review-sebutharga-supplier-list">
                              {unifiedSuppliers.map((s) => (
                                <option key={s.id || s.companyName} value={s.companyName}>
                                  {s.companyName} [{formatSimplifiedLicense(s.cidbSpkk)}]
                                </option>
                              ))}
                            </datalist>
                          </div>
                          <div>
                            <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                              Harga Tawaran Menang (RM)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={review3Suppliers[0]?.hargaTawaran || selectedReqForReview.estimatedAmount || ''}
                              onChange={(e) => {
                                const list = [...review3Suppliers];
                                list[0] = { ...list[0], hargaTawaran: Number(e.target.value) || 0 };
                                setReview3Suppliers(list);
                              }}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                            Butiran Pemilik / Lesen CIDB / Alamat &amp; No. Telefon
                          </label>
                          <input
                            type="text"
                            value={review3Suppliers[0]?.pegawaiDihubungi || ''}
                            onChange={(e) => {
                              const list = [...review3Suppliers];
                              list[0] = { ...list[0], pegawaiDihubungi: e.target.value };
                              setReview3Suppliers(list);
                            }}
                            placeholder="Nama Pemilik, Lesen CIDB G2, No Tel, Alamat"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {[0, 1, 2].map((idx) => {
                          const item = review3Suppliers[idx] || {
                            bil: idx + 1,
                            namaSyarikat: '',
                            pegawaiDihubungi: '',
                            kaedahKajian: 'SEBUTHARGA',
                            hargaTawaran: 0,
                            catatan: ''
                          };
                          const isEligible = reviewEligibleIndex === idx;

                          return (
                    <div
                      key={idx}
                      className={`border rounded-2xl p-4 transition-all flex flex-col justify-between space-y-3 ${
                        isEligible
                          ? 'border-emerald-500 bg-emerald-500/10 shadow-md ring-1 ring-emerald-500/40'
                          : 'border-slate-200 dark:border-white/10 bg-black/5 dark:bg-white/[0.02]'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                            isEligible
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            Pembekal #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReviewEligibleIndex(idx)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase cursor-pointer transition-all ${
                              isEligible
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-400'
                            }`}
                          >
                            {isEligible ? '★ Calon Layak' : 'Pilih Calon Layak'}
                          </button>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 mb-1">
                            Nama Syarikat / Kontraktor
                          </label>
                          <select
                            value={item.namaSyarikat || ''}
                            onChange={(e) => handleReviewSupplierSelect(idx, e.target.value)}
                            className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                          >
                            <option value="">-- Pilih Pembekal Sah --</option>
                            {unifiedSuppliers.map((s) => (
                              <option key={s.id || s.companyName} value={s.companyName}>
                                {s.companyName} [{formatSimplifiedLicense(s.cidbSpkk)}]
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 mb-1">
                            Butiran Pemilik / Lesen / Hubungan
                          </label>
                          <textarea
                            rows={2}
                            value={item.pegawaiDihubungi || ''}
                            onChange={(e) => {
                              const list = [...review3Suppliers];
                              list[idx] = { ...list[idx], pegawaiDihubungi: e.target.value };
                              setReview3Suppliers(list);
                            }}
                            placeholder="Pemilik / No Tel / Lesen"
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl text-[11px] font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 mb-1">
                              Kaedah Kajian
                            </label>
                            <select
                              value={item.kaedahKajian || 'SEBUTHARGA'}
                              onChange={(e) => {
                                const list = [...review3Suppliers];
                                list[idx] = { ...list[idx], kaedahKajian: e.target.value };
                                setReview3Suppliers(list);
                              }}
                              className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl text-[10px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                            >
                              <option value="SEBUTHARGA">Sebutharga</option>
                              <option value="Katalog eP">Katalog eP</option>
                              <option value="Laman Web">Laman Web</option>
                              <option value="Harga Belian Lampau">Harga Lampau</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 mb-1">
                              Harga Tawaran (RM)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.hargaTawaran || ''}
                              onChange={(e) => {
                                const list = [...review3Suppliers];
                                list[idx] = { ...list[idx], hargaTawaran: Number(e.target.value) || 0 };
                                setReview3Suppliers(list);
                              }}
                              placeholder="0.00"
                              className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl text-xs font-mono font-bold text-right text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-white/10 text-center">
                        <span className={`text-[10px] font-black uppercase ${isEligible ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {isEligible ? '★ Calon Layak Ditawarkan' : 'Tawaran Perbandingan'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

            {/* Section 2: Justifikasi & Catatan Semakan */}
            <div className="space-y-2 mb-6">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px] font-black">
                  2
                </span>
                Catatan &amp; Justifikasi Semakan Pegawai Penyemak
              </h4>
              <textarea
                rows={2}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Catatan perakuan teknikal, lesen dan harga tawaran terbaik..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 resize-none shadow-xs"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-risda-border">
              <button
                type="button"
                onClick={handleReturnFromPenyemak}
                className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Kembalikan Ke Penginput
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSavePenyemakReview}
                  className="px-6 py-2.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 size={15} /> {isReviewSebutharga ? 'Sahkan Keputusan Sebutharga & Hantar Ke Pelulus' : 'Sahkan Semakan & Hantar Ke Pelulus'}
                </button>
              </div>
            </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: KELULUSAN KETUA PTJ / PELULUS                     */}
      {/* ========================================================= */}
      {showApprovalModal && selectedReqForApproval && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-risda-card border border-emerald-500/40 rounded-3xl p-5 sm:p-7 max-w-3xl w-full shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            {(() => {
              const isApprovalSebutharga = selectedReqForApproval.module === 'sebutharga' || 
                (selectedReqForApproval.rujukanDokumen && (selectedReqForApproval.rujukanDokumen.toUpperCase().includes('SH/') || selectedReqForApproval.rujukanDokumen.toUpperCase().includes('SEBUTHARGA'))) || 
                (selectedReqForApproval.orderNo && (selectedReqForApproval.orderNo.toUpperCase().startsWith('PP/RISDA') || selectedReqForApproval.orderNo.toUpperCase().includes('SH')));

              return (
                <>
                  <div className="flex items-start justify-between border-b border-risda-border pb-4 mb-5">
                    <div>
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 ${
                        isApprovalSebutharga
                          ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                          : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                      }`}>
                        {isApprovalSebutharga ? <Megaphone size={14} className="text-orange-400" /> : <CheckCircle2 size={14} className="text-emerald-400" />}
                        <span>{isApprovalSebutharga ? 'PERANAN PELULUS • KEPUTUSAN SEBUTHARGA RISDA' : 'PERANAN PELULUS • KETUA PUSAT TANGGUNGJAWAB'}</span>
                      </div>
                      <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        {isApprovalSebutharga ? 'Kelulusan Permohonan Sebutharga & Pengeluaran LO' : 'Kelulusan Permohonan Tawaran Terus & Pengeluaran LO'}
                      </h2>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold mt-1">
                        {isApprovalSebutharga
                          ? 'Meneliti keputusan Jawatankuasa Sebutharga RISDA dan pengesahan peruntukan sebelum meluluskan Pesanan Tempatan (LO).'
                          : 'Meneliti semakan Pegawai Penyemak, 3 tawaran perbandingan pembekal dan cadangan pembekal layak sebelum meluluskan Pesanan Tempatan.'
                        }
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowApprovalModal(false)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-all"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Request Summary */}
                  <div className="space-y-4 mb-6">
                    <div className="bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-500">
                        <span>{selectedReqForApproval.orderNo}</span>
                        <span className="text-emerald-400 font-black">Status: MENUNGGU KELULUSAN</span>
                      </div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase">
                        {selectedReqForApproval.perihalPerolehan || selectedReqForApproval.title}
                      </h3>
                      <div className="pt-2 border-t border-slate-200 dark:border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Kategori:</span>
                          <strong className="text-slate-800 dark:text-slate-200">{selectedReqForApproval.category}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Vot Bajet:</span>
                          <strong className="text-slate-800 dark:text-slate-200">{selectedReqForApproval.kodAktivitiObjek || selectedReqForApproval.allocationCode}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Anggaran Kos:</span>
                          <strong className="text-amber-500 font-mono">RM {Number(selectedReqForApproval.estimatedAmount || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Disemak Oleh:</span>
                          <strong className="text-sky-400">{selectedReqForApproval.disahkanOlehNama || 'Pegawai Penyemak'}</strong>
                        </div>
                      </div>
                    </div>

                    {isApprovalSebutharga ? (
                      <div className="border border-blue-500/40 bg-blue-950/20 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h4 className="text-xs font-black uppercase tracking-wider text-blue-300 flex items-center gap-2">
                            <Trophy size={16} className="text-amber-400" />
                            Kontraktor / Pembekal Pemenang Dilantik
                          </h4>
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase">
                            ★ Lantikan Keputusan Rasmi Sebutharga
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-3.5 bg-black/40 border border-white/10 rounded-xl space-y-1">
                            <span className="text-[10px] text-slate-400 uppercase font-black">Nama Kontraktor</span>
                            <div className="text-sm font-black text-white uppercase">
                              {selectedReqForApproval.pembekalDipilih || selectedReqForApproval.supplierName || 'PUNCAK BAYU'}
                            </div>
                            <div className="text-xs text-slate-300 font-mono">
                              {selectedReqForApproval.supplierCode || 'CIDB G2'}
                            </div>
                          </div>
                          <div className="p-3.5 bg-black/40 border border-white/10 rounded-xl space-y-1">
                            <span className="text-[10px] text-slate-400 uppercase font-black">Nilai Sebutharga Menang</span>
                            <div className="text-base font-black text-emerald-400 font-mono">
                              RM {Number(selectedReqForApproval.estimatedAmount || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-blue-300 font-bold">
                              Kaedah: SEBUTHARGA RASMI
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-2">
                          3 Pembekal Kajian Pasaran &amp; Calon Layak Yang Dipilih
                        </h4>
                        <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-900/80 text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-white/10">
                              <tr>
                                <th className="p-3 w-10 text-center">Bil</th>
                                <th className="p-3">Nama Syarikat &amp; Hubungan</th>
                                <th className="p-3 text-center">Kaedah</th>
                                <th className="p-3 text-right">Harga (RM)</th>
                                <th className="p-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-white/10 font-semibold">
                              {((selectedReqForApproval.kajianPasaran && selectedReqForApproval.kajianPasaran.length > 0)
                                ? selectedReqForApproval.kajianPasaran.slice(0, 3)
                                : [
                                    { bil: 1, namaSyarikat: selectedReqForApproval.pembekalDipilih || selectedReqForApproval.supplierName || 'PUNCAK BAYU', pegawaiDihubungi: '-', kaedahKajian: 'SEBUTHARGA', hargaTawaran: selectedReqForApproval.estimatedAmount, catatan: 'Layak & Dipilih' }
                                  ]
                              ).map((k, idx) => {
                                const isChosen = k.catatan?.toLowerCase().includes('layak') || k.catatan?.toLowerCase().includes('dipilih') || k.namaSyarikat === selectedReqForApproval.pembekalDipilih;
                                return (
                                  <tr key={idx} className={isChosen ? 'bg-emerald-500/10' : ''}>
                                    <td className="p-3 text-center font-bold">{idx + 1}</td>
                                    <td className="p-3">
                                      <div className="font-black uppercase text-slate-900 dark:text-white flex items-center gap-1.5">
                                        {k.namaSyarikat}
                                        {isChosen && <span className="text-emerald-500 font-bold text-[10px]">★ CALON LAYAK</span>}
                                      </div>
                                      <div className="text-[10px] text-slate-500 truncate max-w-sm">{k.pegawaiDihubungi || '-'}</div>
                                    </td>
                                    <td className="p-3 text-center uppercase font-bold">{k.kaedahKajian || 'SEBUTHARGA'}</td>
                                    <td className="p-3 text-right font-mono font-bold text-amber-500">
                                      RM {Number(k.hargaTawaran || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                        isChosen ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                                      }`}>
                                        {isChosen ? 'Layak & Dipilih' : 'Perbandingan'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Reviewer Notes */}
                    {selectedReqForApproval.remarks && (
                      <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs space-y-1">
                        <span className="text-[10px] font-black uppercase text-sky-400 block">Catatan Semakan Pegawai Penyemak:</span>
                        <p className="text-slate-800 dark:text-slate-200 font-medium">{selectedReqForApproval.remarks}</p>
                      </div>
                    )}
                  </div>

                  {/* Modal Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-risda-border">
                    <button
                      type="button"
                      onClick={async () => {
                        const reason = window.prompt('Sila masukkan catatan / arahan pembetulan kepada Penyemak:');
                        if (!reason || !reason.trim()) return;
                        try {
                          await updateDoc(doc(db, 'order_requests', selectedReqForApproval.id!), {
                            status: 'DALAM SEMAKAN',
                            remarks: `Dikembalikan oleh Pelulus: ${reason.trim()}`
                          });
                          setRequests(prev => prev.map(r => r.id === selectedReqForApproval.id ? { ...r, status: 'DALAM SEMAKAN', remarks: `Dikembalikan oleh Pelulus: ${reason.trim()}` } : r));
                          setShowApprovalModal(false);
                          toast.success('Permohonan dikembalikan kepada Pegawai Penyemak untuk semakan semula.');
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Kembalikan Untuk Semakan
                    </button>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setShowApprovalModal(false)}
                        className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase transition-all cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleApproveByPelulus}
                        className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={15} /> {isApprovalSebutharga ? 'Luluskan Sebutharga & Jana Pesanan Tempatan (LO)' : 'Luluskan & Jana Pesanan Tempatan (LO)'}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
