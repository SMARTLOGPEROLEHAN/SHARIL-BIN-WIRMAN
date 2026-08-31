import React, { useState, useEffect } from 'react';
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
  UserCheck
} from 'lucide-react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { isWithinUserScope } from '../lib/scopeUtils';
import toast from 'react-hot-toast';

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
  category: 'BEKALAN' | 'PERKHIDMATAN' | 'KERJA';
  jenisPerolehanCategory?: 'Bekalan & Perkhidmatan (Tidak melebihi RM20,000)' | 'Kerja (Tidak melebihi RM20,000)' | string;
  perihalPerolehan?: string;
  allocationCode: string;
  requestedBy: string;
  unitOffice: string;
  estimatedAmount: number;
  requestDate: string;
  status: 'LULUS' | 'DALAM SEMAKAN' | 'DITOLAK' | 'DIHANTAR KE KEWANGAN' | 'DIBAYAR';
  financeStatus?: 'BELUM DIHANTAR' | 'DIHANTAR' | 'DISAHKAN KEWANGAN' | 'DIBAYAR';
  financeReferenceNo?: string;
  financeSentAt?: string;
  supplierName?: string;
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
  { bil: 1, namaSyarikat: '', pegawaiDihubungi: '', kaedahKajian: 'SEBUTHARGA', hargaTawaran: 0, catatan: 'Dipilih (Pemenang)' }
];

const defaultJustifikasi: JustifikasiPerolehan = {
  tiadaPembekalLain: false,
  perolehanKhas: false,
  kadarHargaAgensi: false,
  lainLain: false,
  lainLainNyatakan: ''
};

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
  const isAdmin = role === 'admin' || role === 'pentadbir';

  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [allocationCodes, setAllocationCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('SEMUA');
  const [filterStatus, setFilterStatus] = useState<string>('SEMUA');

  // Modal for add/edit form
  const [showModal, setShowModal] = useState(false);
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
  const [awardedAds, setAwardedAds] = useState<any[]>([]);
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
    fetchAwardedAds();
  }, []);

  const fetchAwardedAds = async () => {
    try {
      const q = query(collection(db, 'ads'));
      const snapshot = await getDocs(q);
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data });
      });

      const mockAwardedAds = [
        {
          id: 'ad-mock-1',
          tenderNo: 'SH/S.6-01/2026',
          title: 'LO PAP TAHUN 2026 KAMPUNG KABIAH, KUALA MUAYA SIPITANG',
          category: 'KERJA',
          winner: {
            companyName: 'PUNCAK BAYU',
            ownerName: 'KO. LONG PASIA, SIPITANG',
            phoneNumber: '019-8831092',
            companyAddress: 'KG LONG PASIA, SIPITANG SABAH',
            winningPrice: 170000
          }
        },
        {
          id: 'ad-mock-2',
          tenderNo: 'SH/BFT-02/2026',
          title: 'PEMBEKALAN BAJA SEBATIAN DAN RACUN RUMPAI PRD BEAUFORT',
          category: 'BEKALAN',
          winner: {
            companyName: 'SYARIKAT PERTANIAN BEAUFORT',
            ownerName: 'HAJI AHMAD BIN HASAN',
            phoneNumber: '087-211452',
            companyAddress: 'LOT 12, PEKAN BEAUFORT SABAH',
            winningPrice: 45000
          }
        },
        {
          id: 'ad-mock-3',
          tenderNo: 'SH/BFT-03/2026',
          title: 'PERKHIDMATAN PENYELENGGARAAN PERALATAN IT & RANGKAIAN PRD BEAUFORT',
          category: 'PERKHIDMATAN',
          winner: {
            companyName: 'BORNEO INFOTECH SERVICES',
            ownerName: 'CIK NORMALA BINTI JUSOH',
            phoneNumber: '013-8822901',
            companyAddress: 'NO 45, BANDAR SIPITANG SABAH',
            winningPrice: 18500
          }
        }
      ];

      const realAwarded = list.filter(a => a.winner?.companyName || a.winner?.namaSyarikat || a.status === 'SELESAI (KEPUTUSAN)');
      
      const combined = [...realAwarded];
      mockAwardedAds.forEach(mock => {
        if (!combined.some(c => c.tenderNo === mock.tenderNo)) {
          combined.push(mock);
        }
      });

      setAwardedAds(combined);
    } catch (err) {
      console.error('Error fetching awarded ads:', err);
    }
  };

  const handleSelectSebuthargaDoc = (tenderNoSelected: string) => {
    if (!tenderNoSelected) {
      setFormData(prev => ({
        ...prev,
        rujukanDokumen: '',
        title: '',
        perihalPerolehan: '',
        estimatedAmount: 0,
        supplierName: '',
        pembekalDipilih: '',
        items: [
          { id: '1', description: '', detailKerja: '', kodAktiviti: '031401', kodObjek: 'R4419900', noAset: '', quantity: 1, unit: 'Unit', unitPrice: 0, totalPrice: 0, nilaiGst: 0, jumlahHarga: 0 }
        ],
        kajianPasaran: defaultKajianPasaran.map(k => ({ ...k }))
      }));
      return;
    }

    const selectedAd = awardedAds.find(a => a.tenderNo === tenderNoSelected || a.id === tenderNoSelected);
    if (!selectedAd) return;

    const tenderNo = selectedAd.tenderNo || tenderNoSelected;
    const title = selectedAd.title || '';
    const winner = selectedAd.winner || {};
    const companyName = winner.companyName || winner.namaSyarikat || selectedAd.pembekalDipilih || 'PUNCAK BAYU';
    
    // Construct owner detail string: Nama Pemilik / Phone / Address
    const ownerParts = [
      winner.ownerName ? `PEMILIK: ${winner.ownerName}` : '',
      winner.companyAddress ? `ALAMAT: ${winner.companyAddress}` : '',
      winner.phoneNumber ? `TEL: ${winner.phoneNumber}` : ''
    ].filter(Boolean);
    const pegawaiDetailStr = ownerParts.length > 0 
      ? ownerParts.join(' | ') 
      : (winner.ownerName || winner.phoneNumber || 'KG. LONG PASIA, SIPITANG');

    const price = Number(winner.winningPrice || winner.hargaTawaran || selectedAd.estimatedAmount) || 0;

    const updatedItems: OrderItem[] = (selectedAd.items && selectedAd.items.length > 0)
      ? selectedAd.items.map((it: any, i: number) => {
          const qty = Number(it.quantity) || 1;
          const up = Number(it.unitPrice) || 0;
          const tot = qty * up;
          const gst = Number(it.nilaiGst) || 0;
          return {
            id: it.id || String(i + 1),
            description: it.detailKerja || it.description || '',
            detailKerja: it.detailKerja || it.description || '',
            kodAktiviti: it.kodAktiviti || '031401',
            kodObjek: it.kodObjek || 'R4419900',
            noAset: it.noAset || '',
            quantity: qty,
            unit: it.unit || 'Unit',
            unitPrice: up,
            totalPrice: tot,
            nilaiGst: gst,
            jumlahHarga: tot + gst
          };
        })
      : [
          {
            id: '1',
            description: '',
            detailKerja: '',
            kodAktiviti: '031401',
            kodObjek: 'R4419900',
            noAset: '',
            quantity: 1,
            unit: 'Unit',
            unitPrice: 0,
            totalPrice: 0,
            nilaiGst: 0,
            jumlahHarga: 0
          }
        ];

    const currentKajian: KajianPasaranItem[] = [
      {
        bil: 1,
        namaSyarikat: companyName,
        pegawaiDihubungi: pegawaiDetailStr,
        kaedahKajian: 'SEBUTHARGA',
        hargaTawaran: price,
        catatan: 'Dipilih (Pemenang)'
      }
    ];

    const category = selectedAd.category === 'KERJA' ? 'KERJA' : (selectedAd.category === 'PERKHIDMATAN' ? 'PERKHIDMATAN' : 'BEKALAN');
    const jenisCat = selectedAd.category === 'KERJA' ? 'Kerja' : (selectedAd.category === 'PERKHIDMATAN' ? 'Perkhidmatan' : 'Bekalan & Perkhidmatan');

    const totalFromItems = updatedItems.reduce((sum, it) => sum + (it.totalPrice || 0), 0);

    setFormData(prev => ({
      ...prev,
      rujukanDokumen: tenderNo.startsWith('RUJ:') ? tenderNo : `RUJ: ${tenderNo}`,
      title: title,
      perihalPerolehan: title,
      category: category as any,
      jenisPerolehanCategory: jenisCat,
      estimatedAmount: totalFromItems > 0 ? totalFromItems : price,
      items: updatedItems,
      kajianPasaran: currentKajian,
      supplierName: companyName,
      pembekalDipilih: companyName
    }));

    toast.success(`Maklumat perolehan, tajuk sebutharga, kajian pasaran & pembekal auto-diselaraskan untuk ${tenderNo}`, { duration: 4000 });
  };

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

      setAllocationCodes(parentOnlyCodes);
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
        const data = docSnap.data() as Omit<OrderRequest, 'id'>;
        const sanitizedItems = (data.items || []).map((it, idx) => {
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
          ? sanitizedItems.reduce((sum, it) => sum + it.totalPrice, 0)
          : Number(data.estimatedAmount || 0);

        list.push({ 
          id: docSnap.id, 
          ...data,
          items: sanitizedItems,
          estimatedAmount: calculatedEstimated
        });
      });

      // Set requests list directly (empty if no orders created yet)
      setRequests(list);
    } catch (err) {
      console.error('Error fetching order requests:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllRequests = async () => {
    if (!window.confirm('Adakah anda pasti untuk mengosongkan semua rekod Permohonan Pesanan Tempatan?')) return;
    try {
      setRequests([]);
      toast.success('Senarai Permohonan Pesanan Tempatan telah dikosongkan.');
    } catch (err) {
      console.error('Error clearing requests:', err);
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
      const payload = {
        ...formData,
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
      kajianPasaran: r.kajianPasaran && r.kajianPasaran.length > 0 ? r.kajianPasaran.slice(0, 1) : defaultKajianPasaran,
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
          updatedAt: new Date().toISOString()
        });

        // Sync PO number to matching ad in ads collection
        try {
          const matchedAd = awardedAds.find(ad => {
            if (!ad) return false;
            const rujukan = (req.rujukanDokumen || '').toUpperCase().trim();
            const tNo = (ad.tenderNo || '').toUpperCase().trim();
            if (rujukan && tNo && (rujukan === tNo || rujukan.includes(tNo) || tNo.includes(rujukan))) return true;
            const cleanReqTitle = (req.title || req.perihalPerolehan || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanAdTitle = (ad.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanReqTitle && cleanAdTitle && (cleanReqTitle.includes(cleanAdTitle) || cleanAdTitle.includes(cleanReqTitle));
          });
          if (matchedAd && matchedAd.id && !matchedAd.id.startsWith('ad-mock-')) {
            const formattedPo = autoPoNo.toUpperCase().startsWith('PO') ? autoPoNo.toUpperCase() : `PO${autoPoNo}`;
            await updateDoc(doc(db, 'ads', matchedAd.id), {
              noPesananTempatan: formattedPo,
              updatedAt: new Date().toISOString()
            });
          }
        } catch (syncErr) {
          console.warn('Sync PO to ads warning:', syncErr);
        }
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

        // Sync voucher and paid date to matching ad in ads collection
        try {
          const matchedAd = awardedAds.find(ad => {
            if (!ad) return false;
            const rujukan = (req.rujukanDokumen || '').toUpperCase().trim();
            const tNo = (ad.tenderNo || '').toUpperCase().trim();
            if (rujukan && tNo && (rujukan === tNo || rujukan.includes(tNo) || tNo.includes(rujukan))) return true;
            const cleanReqTitle = (req.title || req.perihalPerolehan || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanAdTitle = (ad.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanReqTitle && cleanAdTitle && (cleanReqTitle.includes(cleanAdTitle) || cleanAdTitle.includes(cleanReqTitle));
          });
          if (matchedAd && matchedAd.id && !matchedAd.id.startsWith('ad-mock-')) {
            const adUpdatePayload: any = {
              updatedAt: new Date().toISOString()
            };
            if (!isPaid) {
              adUpdatePayload.noBaucar = autoBaucar;
              adUpdatePayload.tarikhDibayar = autoPaidDate;
            }
            await updateDoc(doc(db, 'ads', matchedAd.id), adUpdatePayload);
          }
        } catch (syncErr) {
          console.warn('Sync payment to ads warning:', syncErr);
        }
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

  const resetForm = () => {
    setEditingId(null);
    setSavedItemRows({});
    const userPtj = district ? `PRD ${district.toUpperCase()}` : (user?.district ? `PRD ${user.district.toUpperCase()}` : 'PRD BEAUFORT');
    setFormData({
      orderNo: `PP/RISDA/BFT/${new Date().getFullYear()}/${String(requests.length + 1).padStart(3, '0')}`,
      poNo: '',
      ptjName: userPtj,
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
      kajianPasaran: defaultKajianPasaran.map(k => ({ ...k })),
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
  };

  const handleOpenNewOrderFlow = () => {
    resetForm();
    setAllocModalSearch('');
    setShowAllocSelectionModal(true);
  };

  const handleConfirmAllocationAndStartOrder = (chosenCodeVal: string) => {
    resetForm();
    if (chosenCodeVal) {
      handleSelectAllocationCode(chosenCodeVal);
    }
    setShowAllocSelectionModal(false);
    setShowModal(true);
  };

  const filteredRequests = requests.filter(r => {
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

    const matchesSearch = r.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (r.allocationCode && r.allocationCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (r.supplierName && r.supplierName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (r.pembekalDipilih && r.pembekalDipilih.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === 'SEMUA' || r.category === filterCategory;
    const matchesStatus = filterStatus === 'SEMUA' || r.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalEstimatedAmount = filteredRequests.reduce((sum, r) => sum + (Number(r.estimatedAmount) || 0), 0);
  const sentToFinanceCount = requests.filter(r => r.financeStatus === 'DIHANTAR').length;

  // Print exact Official "BORANG KAJIAN PASARAN" PDF Layout
  const handlePrintSlip = (r: OrderRequest) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const kajianList = (r.kajianPasaran && r.kajianPasaran.length > 0)
      ? r.kajianPasaran.slice(0, 1)
      : [
          {
            bil: 1,
            namaSyarikat: r.pembekalDipilih || r.supplierName || 'PUNCAK BAYU',
            pegawaiDihubungi: 'PEMILIK: SANTHY GRESIKA PANAI | TEL: 0193006860',
            kaedahKajian: 'SEBUTHARGA',
            hargaTawaran: r.estimatedAmount,
            catatan: 'Dipilih (Pemenang)'
          }
        ];
    const fullKajianList = [...kajianList];

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
          <title>BORANG KAJIAN PASARAN - ${r.orderNo}</title>
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
          <div class="header-title">BORANG KAJIAN PASARAN</div>
          
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
                  <div style="font-size: 8.5px; margin-top: 3px; font-weight: bold; text-transform: uppercase;">${r.rujukanDokumen ? (r.rujukanDokumen.toUpperCase().startsWith('RUJ') ? r.rujukanDokumen : `RUJ: ${r.rujukanDokumen}`) : 'RUJ: SH/S.6-01/2026'}</div>
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

          <div class="section-title">4. Kajian Pasaran Dilaksanakan :</div>
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
              ${fullKajianList.slice(0, 1).map((k, i) => `
                <tr style="height: 18px;">
                  <td class="text-center">${i + 1}</td>
                  <td class="font-bold" style="text-transform: uppercase;">${k.namaSyarikat || ''}</td>
                  <td style="text-transform: uppercase;">${k.pegawaiDihubungi || ''}</td>
                  <td class="text-center" style="text-transform: uppercase;">${k.kaedahKajian || ''}</td>
                  <td class="text-right">${k.hargaTawaran ? 'RM' + Number(k.hargaTawaran).toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}</td>
                  <td>${k.catatan || ''}</td>
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
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-risda-card via-black to-risda-card border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-risda-orange/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-risda-orange/10 border border-risda-orange/30 text-risda-orange text-[10px] font-black uppercase tracking-widest mb-3">
              <ShoppingBag size={12} /> Modul Pengurusan Perolehan & Kajian Pasaran
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
              Permohonan Pesanan Tempatan
            </h1>
            <p className="text-xs text-risda-muted font-bold mt-1 max-w-2xl">
              Pengurusan lengkap Borang Permohonan Pesanan Tempatan (Kajian Pasaran) dan Perincian Item Pesanan untuk Penghantaran ke Sistem Kewangan RISDA.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenNewOrderFlow}
              className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-risda-orange to-risda-gold text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-[0_10px_25px_rgba(0,176,255,0.3)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={16} className="stroke-[3]" /> TAMBAH PESANAN BARU
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-risda-card/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-risda-muted font-black uppercase">
            <span>Jumlah Borang Pesanan</span>
            <ShoppingBag size={18} className="text-risda-orange" />
          </div>
          <div className="text-2xl font-black text-white mt-2">{filteredRequests.length} Rekod</div>
        </div>

        <div className="bg-risda-card/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-risda-muted font-black uppercase">
            <span>Anggaran Nilai Keseluruhan</span>
            <DollarSign size={18} className="text-risda-gold" />
          </div>
          <div className="text-2xl font-black text-risda-gold mt-2">
            RM {totalEstimatedAmount.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-risda-card/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-risda-muted font-black uppercase">
            <span>Status Integrasi Kewangan</span>
            <ShieldCheck size={18} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">
            {sentToFinanceCount} / {requests.length} Dihantar
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-risda-card/60 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-risda-muted" />
          <input
            type="text"
            placeholder="Cari No. Pesanan, Tajuk, Pembekal Dipilih atau Vot..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-risda-orange transition-all placeholder:text-white/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-risda-orange"
          >
            <option value="SEMUA">Kategori: Semua</option>
            <option value="BEKALAN">BEKALAN</option>
            <option value="PERKHIDMATAN">PERKHIDMATAN</option>
            <option value="KERJA">KERJA</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-risda-orange"
          >
            <option value="SEMUA">Status: Semua</option>
            <option value="DALAM SEMAKAN">DALAM SEMAKAN</option>
            <option value="LULUS">LULUS</option>
            <option value="DIHANTAR KE KEWANGAN">DIHANTAR KE KEWANGAN</option>
            <option value="DITOLAK">DITOLAK</option>
          </select>

          <button
            onClick={fetchRequests}
            className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all"
            title="Muat Semula"
          >
            <RefreshCw size={14} />
          </button>

          {requests.length > 0 && (
            <button
              onClick={handleClearAllRequests}
              className="px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
              title="Kosongkan Senarai Pesanan"
            >
              <Trash2 size={14} /> Kosongkan Senarai
            </button>
          )}
        </div>
      </div>

      {/* SINGLE UNIFIED VIEW: PERMOHONAN PESANAN TEMPATAN */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
            <FileText className="text-risda-gold" size={20} /> Senarai Permohonan Pesanan Tempatan ({filteredRequests.length} Rekod)
          </h3>
        </div>

        {loading ? (
          <div className="bg-risda-card/80 border border-white/10 rounded-3xl p-12 text-center text-risda-muted font-bold animate-pulse">
            MEMUATKAN REKOD PERMOHONAN PESANAN TEMPATAN...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-risda-card/80 border border-white/10 rounded-3xl p-12 text-center text-risda-muted font-bold space-y-4">
            <div className="w-16 h-16 bg-risda-orange/10 border border-risda-orange/30 rounded-full flex items-center justify-center mx-auto text-risda-orange">
              <ShoppingBag size={28} />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase">Tiada Rekod Permohonan Pesanan Tempatan</p>
              <p className="text-xs text-risda-muted font-normal mt-1">Belum ada pesanan baru dibuat. Sila klik butang di bawah untuk mula membuat pesanan.</p>
            </div>
            <button
              onClick={handleOpenNewOrderFlow}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-risda-orange to-risda-gold text-white font-black text-xs uppercase rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={14} /> TAMBAH PESANAN BARU
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredRequests.map((req) => {
              const isSent = req.financeStatus === 'DIHANTAR';
              const isExpanded = !!expandedItemTables[req.id!];

              return (
                <div
                  key={req.id}
                  className={`bg-risda-card/90 border rounded-3xl p-6 backdrop-blur-md transition-all shadow-xl ${
                    isSent
                      ? 'border-emerald-500/40 bg-emerald-950/10'
                      : 'border-white/10 hover:border-risda-orange/40'
                  }`}
                >
                  {/* Card Header & Primary Info */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="px-3 py-1 bg-risda-orange/10 border border-risda-orange/30 text-risda-orange rounded-xl text-xs font-mono font-black uppercase">
                          {req.orderNo}
                        </span>
                        {req.poNo && (
                          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-mono font-black">
                            PO: {req.poNo}
                          </span>
                        )}
                        <span className="px-3 py-1 bg-white/10 rounded-xl text-[10px] font-black uppercase text-white">
                          {req.category}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                          req.status === 'LULUS'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : req.status === 'DIHANTAR KE KEWANGAN'
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                            : req.status === 'DITOLAK'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>
                          {req.status === 'LULUS' && <CheckCircle2 size={12} />}
                          {req.status === 'DIHANTAR KE KEWANGAN' && <Send size={12} />}
                          {req.status === 'DALAM SEMAKAN' && <Clock size={12} />}
                          STATUS: {req.status}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                          isSent
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/40'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        }`}>
                          {isSent ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          INTEGRASI KEWANGAN: {req.financeStatus || 'BELUM DIHANTAR'}
                        </span>
                      </div>

                      <h4 className="text-base font-black text-white uppercase tracking-tight">
                        {req.perihalPerolehan || req.title}
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 text-xs text-risda-muted font-bold">
                        <div>
                          <span className="text-[10px] text-risda-gold uppercase block">Tarikh Permohonan:</span>
                          <span className="text-white font-semibold flex items-center gap-1 mt-0.5">
                            <Calendar size={13} /> {formatDateDMY(req.requestDate)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-risda-gold uppercase block">Kod Peruntukan / Vot:</span>
                          <span className="text-white font-mono font-bold">{req.kodAktivitiObjek || req.allocationCode || 'Belum Ditetapkan'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-risda-gold uppercase block">Pembekal Terpilih:</span>
                          <span className="text-emerald-300 font-bold uppercase">{req.pembekalDipilih || req.supplierName || 'PUNCAK BAYU'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-risda-gold uppercase block">Pusat Tanggungjawab (PTJ):</span>
                          <span className="text-white">{req.ptjName || 'PRD BEAUFORT'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-start lg:items-end justify-between gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-white/10">
                      <div className="text-left lg:text-right">
                        <span className="text-[10px] text-risda-muted font-black uppercase block">Amaun Pesanan (RM)</span>
                        <span className="text-2xl font-black text-emerald-400 font-mono">
                          RM {Number(req.estimatedAmount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedRequestForDetail(req);
                            setShowDetailModal(true);
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-risda-gold/20 border border-white/10 rounded-xl text-xs font-black uppercase text-risda-gold transition-all"
                          title="Lihat Detail Borang"
                        >
                          <FileText size={14} /> Detail
                        </button>

                        <button
                          onClick={() => handleEdit(req)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-risda-orange/20 border border-white/10 rounded-xl text-xs font-black uppercase text-white transition-all"
                          title="Kemaskini Borang"
                        >
                          <Edit2 size={14} /> Edit
                        </button>

                        <button
                          onClick={() => handleSendToFinanceSystem(req)}
                          disabled={isSent}
                          className={`flex items-center gap-1.5 px-4 py-2 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg ${
                            isSent
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed'
                              : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:scale-105 active:scale-95'
                          }`}
                        >
                          <Send size={14} /> {isSent ? 'SELESAI DIHANTAR' : 'HANTAR KEPADA UNIT KEWANGAN'}
                        </button>

                        {/* Finance Payment Status Button (Bayar Pesanan) */}
                        <button
                          onClick={() => handleMarkPaidByFinance(req)}
                          className={`flex items-center gap-1.5 px-3.5 py-2 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md border ${
                            req.financeStatus === 'DIBAYAR' || req.status === 'DIBAYAR'
                              ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/80 hover:bg-emerald-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                          }`}
                          title="Tandakan status bayaran oleh Unit Kewangan"
                        >
                          <Coins size={14} />
                          {req.financeStatus === 'DIBAYAR' || req.status === 'DIBAYAR' ? '✓ DIBAYAR (KEWANGAN)' : 'SAHKAN BAYARAN KEWANGAN'}
                        </button>

                        <button
                          onClick={() => handleDelete(req.id!)}
                          className="p-2 bg-white/5 hover:bg-red-500/20 border border-white/10 rounded-xl text-risda-muted hover:text-red-400 transition-all"
                          title="Padam"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Detail Breakdown Items Table (e-Kewangan RISDA format - Expandable) */}
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleItemTable(req.id!)}
                        className="flex items-center gap-2.5 text-left group transition-all"
                      >
                        <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 group-hover:border-risda-gold text-risda-gold transition-colors">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                        <div>
                          <h5 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-risda-gold flex items-center gap-2">
                            Maklumat Pesanan (Perincian Item Pesanan)
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              {req.items?.length || 0} Item
                            </span>
                          </h5>
                          <span className="text-[10px] text-risda-muted font-bold block">
                            {isExpanded ? '▲ Klik untuk sembunyikan jadual item' : '▼ Klik untuk lihat/papar jadual perincian item pesanan'}
                          </span>
                        </div>
                      </button>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleOpenAddItemModal(req)}
                          className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-xl text-[11px] font-black text-emerald-300 flex items-center gap-1 transition-all"
                        >
                          <Plus size={13} /> Tambah Item
                        </button>
                        {isSent && req.financeReferenceNo && (
                          <span className="text-emerald-400 font-mono text-[11px] font-bold">
                            No. Rujukan Kewangan: {req.financeReferenceNo} ({req.financeSentAt})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Exact e-Kewangan RISDA Table Layout (Only rendered when expanded) */}
                    {isExpanded && (
                      <div className="overflow-x-auto bg-white rounded-xl text-black border border-gray-300 shadow-md p-1 mt-3 animate-fade-in">
                        {(() => {
                          const itemsList = req.items && req.items.length > 0 ? req.items : [
                            { id: '1', description: req.title, kodAktiviti: '031401', kodObjek: 'R4419900', noAset: '', quantity: 1, unitPrice: req.estimatedAmount, totalPrice: req.estimatedAmount, nilaiGst: 0, jumlahHarga: req.estimatedAmount }
                          ];
                          const totalSum = itemsList.reduce((sum, item) => {
                            const qty = Number(item.quantity) || 0;
                            const up = Number(item.unitPrice) || 0;
                            const tot = qty * up;
                            const gst = Number(item.nilaiGst) || 0;
                            return sum + (tot + gst);
                          }, 0);

                          return (
                            <table className="w-full text-left border-collapse text-[11px] font-sans">
                              <thead>
                                <tr className="bg-gray-100 border-b border-gray-300 text-gray-800 font-bold">
                                  <th className="py-2.5 px-2 border-r border-gray-300 text-center w-12">Bil.Item</th>
                                  <th className="py-2.5 px-3 border-r border-gray-300">Perihal</th>
                                  <th className="py-2.5 px-2 border-r border-gray-300 text-center w-20">Kod Aktviti</th>
                                  <th className="py-2.5 px-2 border-r border-gray-300 text-center w-24">Kod Objek</th>
                                  <th className="py-2.5 px-2 border-r border-gray-300 text-center w-16">No.Aset</th>
                                  <th className="py-2.5 px-2 border-r border-gray-300 text-right w-20">Kuantiti</th>
                                  <th className="py-2.5 px-2 border-r border-gray-300 text-right w-24">Harga/Unit</th>
                                  <th className="py-2.5 px-2 border-r border-gray-300 text-right w-24">Jumlah</th>
                                  <th className="py-2.5 px-2 border-r border-gray-300 text-right w-20">Nilai GST</th>
                                  <th className="py-2.5 px-2 border-r border-gray-300 text-right w-28">Jumlah Harga</th>
                                  <th className="py-2.5 px-2 text-center w-28"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {itemsList.map((item, idx) => {
                                  const qty = Number(item.quantity) || 0;
                                  const unitP = Number(item.unitPrice) || 0;
                                  const total = qty * unitP;
                                  const gst = Number(item.nilaiGst) || 0;
                                  const finalPrice = total + gst;

                                  return (
                                    <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                                      <td className="py-2 px-2 border-r border-gray-200 text-center align-top font-semibold text-gray-700">
                                        {idx + 1}
                                      </td>
                                      <td className="py-2 px-3 border-r border-gray-200 align-top font-semibold uppercase text-gray-900 leading-snug">
                                        <div>{item.description}</div>
                                      </td>
                                      <td className="py-2 px-2 border-r border-gray-200 text-center align-top font-mono text-gray-800">
                                        {item.kodAktiviti || '031401'}
                                      </td>
                                      <td className="py-2 px-2 border-r border-gray-200 text-center align-top font-mono text-gray-800">
                                        {item.kodObjek || 'R4419900'}
                                      </td>
                                      <td className="py-2 px-2 border-r border-gray-200 text-center align-top font-mono text-gray-600">
                                        {item.noAset || ''}
                                      </td>
                                      <td className="py-2 px-2 border-r border-gray-200 text-right align-top font-mono font-semibold text-gray-900">
                                        {qty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-2 px-2 border-r border-gray-200 text-right align-top font-mono font-semibold text-gray-900">
                                        {unitP.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-2 px-2 border-r border-gray-200 text-right align-top font-mono font-semibold text-gray-900">
                                        {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-2 px-2 border-r border-gray-200 text-right align-top font-mono text-gray-600">
                                        {gst.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-2 px-2 border-r border-gray-200 text-right align-top font-mono font-bold text-gray-900">
                                        {finalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-2 px-2 text-center align-top whitespace-nowrap">
                                        <div className="inline-flex items-center gap-1">
                                          <button
                                            onClick={() => handleOpenEditItemModal(req, item)}
                                            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-[10px] border border-gray-400 rounded shadow-xs transition-all"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeleteFinancialItem(req, item.id)}
                                            className="px-2.5 py-1 bg-gray-100 hover:bg-red-50 text-red-700 font-bold text-[10px] border border-gray-400 hover:border-red-400 rounded shadow-xs transition-all"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-gray-400 bg-gray-50 font-bold text-gray-900">
                                  <td colSpan={9} className="py-2.5 px-3 border-r border-gray-300 text-right font-bold text-xs">
                                    Total :
                                  </td>
                                  <td className="py-2.5 px-2 border-r border-gray-300 text-right font-mono text-xs font-black text-gray-900">
                                    {totalSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            </table>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* POPUP MODAL: PILIHAN KOD PERUNTUKAN INDUK SEBELUM MULA PESANAN BARU */}
      {showAllocSelectionModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-risda-card border border-emerald-500/40 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-2">
                  <Coins size={12} /> Langkah 1: Pengesahan Kod Peruntukan Induk
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  Pilih Kod Peruntukan Induk (VOT)
                </h2>
                <p className="text-xs text-risda-muted font-medium mt-1">
                  Sila pilih Kod Peruntukan Induk yang akan digunakan. Kod dan baki peruntukan akan diisi <strong className="text-emerald-400">secara automatik</strong> ke <strong className="text-white">Bahagian B (Pengesahan Baki Peruntukan Oleh Unit Kewangan)</strong> bagi memudahkan urusan kakitangan tanpa perlu mengisi semula.
                </p>
              </div>
              <button
                onClick={() => setShowAllocSelectionModal(false)}
                className="p-2 rounded-xl bg-white/5 text-risda-muted hover:text-white cursor-pointer transition-colors"
                title="Tutup"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Carian Kod Peruntukan */}
            <div className="space-y-4">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-risda-muted" />
                <input
                  type="text"
                  placeholder="Cari Kod Vot (cth: 031400) atau Perihal Peruntukan (cth: PAP)..."
                  value={allocModalSearch}
                  onChange={(e) => setAllocModalSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-black/60 border border-emerald-500/30 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-emerald-400 placeholder:text-white/30"
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
                      <div className="p-6 text-center text-risda-muted text-xs bg-black/30 rounded-2xl border border-white/10">
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
                        className="p-4 bg-black/50 hover:bg-emerald-950/40 border border-white/10 hover:border-emerald-500/60 rounded-2xl cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group shadow-sm flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-black border border-emerald-500/40">
                              {ac.akt ? `VOT: ${ac.akt} / ${ac.obj}` : 'KOD PERUNTUKAN'}
                            </span>
                            <span className="text-[10px] text-risda-muted font-bold">
                              Tahun {ac.year || '2026'}
                            </span>
                          </div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wide group-hover:text-emerald-300 transition-colors">
                            {ac.perihal || ac.name}
                          </h4>
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="text-risda-muted">Baki Semasa:</span>
                            <span className={`font-mono font-black ${isMencukupi ? 'text-emerald-400' : 'text-red-400'}`}>
                              RM {bakiVal.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
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
                  className="text-xs text-risda-muted hover:text-white underline font-semibold transition-colors cursor-pointer"
                >
                  Langkau &amp; Buka Borang (Pilih Kod Semasa Mengisi)
                </button>
                <div className="text-[10px] text-emerald-400/80 font-medium">
                  * Kod yang dipilih akan automatik menetapkan sub-kod pecahan bagi item pesanan.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: TAMBAH / KEMASKINI BORANG KAJIAN PASARAN & PESANAN */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-risda-card border border-white/10 rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <FileText className="text-risda-orange" size={22} />
                  BORANG KAJIAN PASARAN (RISDA PTJ)
                </h2>
                <p className="text-xs text-risda-muted font-bold mt-0.5">
                  Isi butir-butir perolehan, anggaran harga, kajian pasaran, justifikasi & pengesahan peruntukan.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl bg-white/5 text-risda-muted hover:text-white"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
              {/* HEADER INFO SECTION */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
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
                      className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-xl text-emerald-400 text-xs font-mono font-bold focus:outline-none focus:border-risda-orange"
                      required
                    />
                    <span className="text-[9px] text-emerald-400 font-bold block mt-1">
                      * Tarikh Disediakan Oleh & Disahkan Oleh akan auto-diselaraskan mengikut tarikh ini.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                      NAMA PUSAT TANGGUNGJAWAB (PTJ)
                    </label>
                    <input
                      type="text"
                      value={formData.ptjName}
                      onChange={(e) => setFormData({ ...formData, ptjName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-risda-orange uppercase"
                      placeholder={district ? `PRD ${district.toUpperCase()}` : 'PRD BEAUFORT'}
                      required
                    />
                    <span className="text-[9px] text-risda-muted font-bold block mt-1">
                      * Berdasarkan tempat bertugas kakitangan.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                      NO. PO (10 DIGIT)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={formData.poNo}
                      onChange={(e) => setFormData({ ...formData, poNo: e.target.value })}
                      className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-xl text-emerald-400 text-xs font-mono font-bold focus:outline-none focus:border-risda-orange uppercase tracking-widest"
                      placeholder="2645070098"
                    />
                    <span className="text-[9px] text-risda-muted font-bold block mt-1">
                      * Auto dijanakan oleh Unit Kewangan (Contoh: 2645070098).
                    </span>
                  </div>
                </div>
              </div>

              {/* SEKSI A: BUTIR-BUTIR PEROLEHAN */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-risda-gold uppercase tracking-wider border-b border-white/10 pb-2 flex items-center gap-2">
                  <Layers size={16} /> A. BUTIR-BUTIR PEROLEHAN
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                      1. Jenis Perolehan
                    </label>
                    <select
                      value={formData.jenisPerolehanCategory}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        jenisPerolehanCategory: e.target.value,
                        category: e.target.value.includes('Kerja') ? 'KERJA' : (e.target.value.includes('Perkhidmatan') ? 'PERKHIDMATAN' : 'BEKALAN')
                      })}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-risda-orange"
                    >
                      <option value="Bekalan & Perkhidmatan">Bekalan & Perkhidmatan</option>
                      <option value="Kerja">Kerja</option>
                      <option value="Kerja PAP">Kerja PAP</option>
                      <option value="Perkhidmatan">Perkhidmatan</option>
                      <option value="Bekalan">Bekalan</option>
                      <option value="Lain-lain Perolehan">Lain-lain Perolehan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-risda-gold mb-1 flex items-center justify-between">
                      <span>Rujukan Dokumen Sebutharga</span>
                      <span className="text-[9px] text-emerald-400 font-bold">Pilih Iklan Ada Pemenang</span>
                    </label>
                    <div className="space-y-1.5">
                      <select
                        onChange={(e) => handleSelectSebuthargaDoc(e.target.value)}
                        className="w-full px-3 py-2 bg-black/80 border border-risda-gold/50 rounded-xl text-risda-gold text-xs font-bold focus:outline-none focus:border-risda-orange cursor-pointer"
                      >
                        <option value="">-- PILIH SEBUTHARGA / IKLAN PEMENANG --</option>
                        {awardedAds.map((ad) => (
                          <option key={ad.id} value={ad.tenderNo}>
                            {ad.tenderNo} - {ad.title?.slice(0, 40)}... (Pemenang: {ad.winner?.companyName || ad.winner?.namaSyarikat || 'PUNCAK BAYU'})
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={formData.rujukanDokumen}
                        onChange={(e) => setFormData({ ...formData, rujukanDokumen: e.target.value })}
                        className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-risda-orange uppercase"
                        placeholder="RUJ: SH/S.6-01/2026"
                      />
                    </div>
                    <span className="text-[9px] text-emerald-300 font-bold block mt-1">
                      * Memilih dokumen sebutharga akan auto-mengemaskini Tajuk Perihal (2), Jumlah Anggaran (3), Kajian Pasaran / Detail Pemilik & Tel (4) serta Pembekal Dipilih (6).
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                    2. Perihal Perolehan
                  </label>
                  <textarea
                    rows={2}
                    value={formData.perihalPerolehan || formData.title}
                    onChange={(e) => setFormData({ ...formData, perihalPerolehan: e.target.value, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-risda-orange uppercase"
                    placeholder="LO PAP TAHUN 2026 KAMPUNG KABIAH, KUALA MUAYA SIPITANG"
                    required
                  />
                </div>

                {/* 3. JUMLAH ANGGARAN PEROLEHAN TABLE */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-risda-gold">
                        3. Jumlah Anggaran Perolehan (Jadual Item)
                      </label>
                      {(() => {
                        const parentAlloc = findMatchingAllocationCode(formData.kodAktivitiObjek || formData.allocationCode);
                        return parentAlloc ? (
                          <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 mt-0.5">
                            <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-500/40 rounded text-[9px] font-mono">
                              VOT INDUK: {parentAlloc.akt || '031400'} / {parentAlloc.obj || 'R4400000'}
                            </span>
                            <span className="truncate max-w-md text-emerald-300 text-[10px]">
                              - {parentAlloc.perihal || parentAlloc.name}
                            </span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3 py-1 bg-risda-orange/20 text-risda-orange hover:bg-risda-orange/30 border border-risda-orange/40 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} /> Tambah Item
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-white/10 rounded-2xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-black/60 border-b border-white/10 text-[10px] text-risda-muted font-black uppercase">
                          <th className="py-2.5 px-3 w-12">Bil</th>
                          <th className="py-2.5 px-3">Jenis Bekalan / Perkhidmatan / Kerja</th>
                          <th className="py-2.5 px-3 w-20 text-center">Kuantiti</th>
                          <th className="py-2.5 px-3 w-32 text-right">Harga Seunit (RM)</th>
                          <th className="py-2.5 px-3 w-36 text-right">Jumlah (RM)</th>
                          <th className="py-2.5 px-3 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10 font-semibold">
                        {/* BARIS TAJUK BESAR SEBUTHARGA / PERIHAL (UNTUK PDF TANPA NOMBOR BIL) */}
                        <tr className="bg-amber-500/10 border-b-2 border-amber-500/30">
                          <td className="py-3 px-3 text-center align-top pt-3">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase tracking-wider border border-amber-500/40">
                              TAJUK
                            </span>
                          </td>
                          <td className="py-3 px-3" colSpan={4}>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-amber-400 flex items-center gap-1.5">
                                  <Layers size={13} className="text-amber-400" />
                                  Tajuk Besar Perihal Sebutharga (Dipaparkan Dalam PDF Tanpa Nombor Bil):
                                </span>
                                <span className="text-[9px] text-amber-300/80 font-medium">
                                  * Berpandukan Sebutharga yang dipilih
                                </span>
                              </div>
                              <input
                                type="text"
                                value={formData.perihalPerolehan || formData.title || ''}
                                onChange={(e) => setFormData({ ...formData, perihalPerolehan: e.target.value, title: e.target.value })}
                                className="w-full px-3 py-2 bg-black/70 border border-amber-500/40 rounded-xl text-amber-200 text-xs font-bold uppercase focus:outline-none focus:border-amber-400 shadow-inner"
                                placeholder="CADANGAN PROJEK JALAN BAGI PROGRAM PRASARANA ASAS PERTANIAN..."
                                required
                              />
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center"></td>
                        </tr>

                        {/* SENARAI PECAHAN ITEM KERJA / BEKALAN (BIL 1, BIL 2, ...) */}
                        {formData.items?.map((item, idx) => {
                          const isSaved = !!savedItemRows[item.id];
                          return (
                            <tr key={item.id} className={isSaved ? "bg-emerald-950/20 transition-colors" : "transition-colors"}>
                              <td className="py-3 px-3 text-center align-top pt-4">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/70 border border-white/20 text-risda-gold font-mono font-bold text-xs">
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                {isSaved ? (
                                  /* PAPARAN KEMAS APABILA TELAH DISIMPAN (TIDAK SERABUT) */
                                  <div className="p-3 bg-black/40 border border-emerald-500/30 rounded-xl flex items-start justify-between gap-3 group hover:border-emerald-500/50 transition-all">
                                    <div className="space-y-1">
                                      <div className="text-[10px] text-emerald-400 font-black uppercase tracking-wider flex items-center gap-1.5">
                                        <CheckCircle2 size={12} className="text-emerald-400" />
                                        <span>Perincian Kerja / Item:</span>
                                      </div>
                                      <div className="text-sm font-bold text-white uppercase tracking-wide">
                                        {item.detailKerja || item.description || '-'}
                                      </div>
                                      <div className="text-[10px] text-risda-muted font-mono pt-0.5">
                                        Kod Pecahan Kewangan: <span className="text-emerald-300 font-semibold">{item.kodAktiviti || '-'} / {item.kodObjek || '-'}</span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleEditItemRow(item.id)}
                                      className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer shrink-0 transition-all active:scale-95 shadow-sm"
                                      title="Buka untuk kemaskini kod pecahan & perincian kerja"
                                    >
                                      <Edit2 size={11} /> Kemaskini
                                    </button>
                                  </div>
                                ) : (
                                  /* PAPARAN PENUH UNTUK KEMASKINI / TAMBAH ITEM (KOD SISTEM KEWANGAN & DETAIL) */
                                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2.5 shadow-lg animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between">
                                      <div className="text-[10px] text-emerald-400 font-black uppercase tracking-wide">
                                        KOD PECAHAN ITEM (UNTUK SISTEM KEWANGAN):
                                      </div>
                                      <div className="text-[10px] text-emerald-300 font-mono font-bold">
                                        {item.kodAktiviti || '031401'} / {item.kodObjek || 'R4419900'}
                                      </div>
                                    </div>
                                    {(() => {
                                      const { aktSubs, objSubs } = getAvailableSubCodesForForm(formData.kodAktivitiObjek || formData.allocationCode);
                                      return (
                                        <>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                              <label className="block text-[9px] text-emerald-300 font-bold mb-1">
                                                Akt:
                                              </label>
                                              <select
                                                value={item.kodAktiviti || ''}
                                                onChange={(e) => handleItemChange(item.id, 'kodAktiviti', e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-black/80 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-400 cursor-pointer"
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
                                              <label className="block text-[9px] text-emerald-300 font-bold mb-1">
                                                Objek:
                                              </label>
                                              <select
                                                value={item.kodObjek || ''}
                                                onChange={(e) => handleItemChange(item.id, 'kodObjek', e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-black/80 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-400 cursor-pointer"
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
                                          <div className="pt-1.5 border-t border-emerald-500/20">
                                            <label className="block text-[9px] text-emerald-300 font-black uppercase mb-1">
                                              Detail / Perincian Kerja Yang Perlu Dibuat (cth: INSURAN PAMPASAN PEKERJA):
                                            </label>
                                            <input
                                              type="text"
                                              value={item.detailKerja || item.description || ''}
                                              onChange={(e) => {
                                                handleItemChange(item.id, 'detailKerja', e.target.value);
                                                handleItemChange(item.id, 'description', e.target.value);
                                              }}
                                              className="w-full px-2.5 py-1.5 bg-black/80 border border-emerald-500/40 focus:border-emerald-400 rounded-lg text-xs uppercase font-medium text-white shadow-inner"
                                              placeholder="CONTOH: INSURAN PERLINDUNGAN TANGGUNGAN AWAM / PEMBINAAN PARIT / MERATAKAN TANAH"
                                              required
                                            />
                                          </div>

                                          {/* BUTANG SIMPAN ITEM */}
                                          <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between flex-wrap gap-2">
                                            <span className="text-[9px] text-emerald-300/80 font-medium">
                                              * Klik "Simpan Item" untuk mengunci kod &amp; paparan kemas.
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => handleSaveItemRow(item.id, idx)}
                                              className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
                                            >
                                              <CheckCircle2 size={13} /> Simpan Item #{idx + 1}
                                            </button>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 align-top pt-4">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                                  disabled={isSaved}
                                  className={`w-full px-2 py-1.5 rounded-lg text-white text-xs text-center font-mono transition-all ${
                                    isSaved ? 'bg-black/60 border border-emerald-500/30 cursor-not-allowed opacity-90' : 'bg-black/40 border border-white/10'
                                  }`}
                                  min={1}
                                />
                              </td>
                              <td className="py-3 px-3 align-top pt-4">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                                  disabled={isSaved}
                                  className={`w-full px-3 py-1.5 rounded-lg text-white text-xs text-right font-mono transition-all ${
                                    isSaved ? 'bg-black/60 border border-emerald-500/30 cursor-not-allowed opacity-90' : 'bg-black/40 border border-white/10'
                                  }`}
                                />
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400 align-top pt-5">
                                RM {Number(item.totalPrice).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-3 text-center align-top pt-4">
                                {formData.items && formData.items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                                    title="Padam Item"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-black/60 border-t border-white/10 font-bold">
                          <td colSpan={4} className="py-3 px-4 text-right uppercase text-xs text-risda-gold">
                            JUMLAH ANGGARAN KESELURAHAN (RM):
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-sm text-emerald-400 font-black">
                            RM {Number(formData.estimatedAmount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* 4. KAJIAN PASARAN DILAKSANAKAN (SYARIKAT PEMENANG SEBUTHARGA) */}
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-risda-gold">
                        4. Kajian Pasaran Dilaksanakan (Syarikat Pemenang Sebutharga)
                      </label>
                      <span className="text-[9px] text-risda-muted font-semibold">
                        Sebut harga hanya melibatkan 1 pemenang terpilih.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          kajianPasaran: [{ bil: 1, namaSyarikat: '', pegawaiDihubungi: '', kaedahKajian: 'SEBUTHARGA', hargaTawaran: 0, catatan: 'Dipilih (Pemenang)' }]
                        }));
                        toast('Borang Kajian Pasaran telah dikosongkan.', { icon: '🧹' });
                      }}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-risda-muted hover:text-white border border-white/10 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer"
                    >
                      Kosongkan Jadual Kajian
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-white/10 rounded-2xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-black/60 border-b border-white/10 text-[9px] text-risda-muted font-black uppercase">
                          <th className="py-2.5 px-2 w-10 text-center">Bil</th>
                          <th className="py-2.5 px-3">Nama Syarikat Pemenang</th>
                          <th className="py-2.5 px-3">Nama Pegawai / Telefon / Alamat</th>
                          <th className="py-2.5 px-3 w-36">Kaedah Kajian</th>
                          <th className="py-2.5 px-3 w-32 text-right">Harga Tawaran (RM)</th>
                          <th className="py-2.5 px-3 w-28">Catatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10 font-semibold">
                        {(formData.kajianPasaran || defaultKajianPasaran).slice(0, 1).map((k, idx) => (
                          <tr key={idx} className="bg-emerald-950/20">
                            <td className="py-2 px-2 text-center text-risda-gold font-bold font-mono">1</td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={k.namaSyarikat}
                                onChange={(e) => {
                                  handleKajianChange(0, 'namaSyarikat', e.target.value);
                                  setFormData(prev => ({ ...prev, pembekalDipilih: e.target.value, supplierName: e.target.value }));
                                }}
                                className="w-full px-2.5 py-1.5 bg-black/40 border border-emerald-500/40 rounded-lg text-white font-bold text-xs uppercase"
                                placeholder="Nama Syarikat Pemenang"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={k.pegawaiDihubungi}
                                onChange={(e) => handleKajianChange(0, 'pegawaiDihubungi', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs uppercase"
                                placeholder="Pegawai / Lokasi / Tel"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <select
                                value={k.kaedahKajian || 'SEBUTHARGA'}
                                onChange={(e) => handleKajianChange(0, 'kaedahKajian', e.target.value)}
                                className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs"
                              >
                                <option value="SEBUTHARGA">SEBUTHARGA</option>
                                <option value="Laman Web">Laman Web</option>
                                <option value="Katalog eP">Katalog eP</option>
                                <option value="Harga Belian Lampau">Harga Belian Lampau</option>
                              </select>
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                step="0.01"
                                value={k.hargaTawaran}
                                onChange={(e) => handleKajianChange(0, 'hargaTawaran', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-black/40 border border-emerald-500/40 rounded-lg text-emerald-400 font-bold text-xs text-right font-mono"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={k.catatan || 'Dipilih (Pemenang)'}
                                onChange={(e) => handleKajianChange(0, 'catatan', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs"
                                placeholder="Catatan"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 5. JUSTIFIKASI & 6. PEMBEKAL DIPILIH */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <label className="block text-[10px] font-black uppercase text-risda-gold">
                    5. Justifikasi Sekiranya Tidak Dapat Menyediakan 3 Perbandingan Harga
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-white">
                    <label className="flex items-center gap-2 bg-black/40 p-3 rounded-xl border border-white/10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.justifikasi?.tiadaPembekalLain || false}
                        onChange={(e) => setFormData({
                          ...formData,
                          justifikasi: { ...formData.justifikasi!, tiadaPembekalLain: e.target.checked }
                        })}
                        className="rounded border-white/20 text-risda-orange focus:ring-0"
                      />
                      <span>Tiada pembekal lain yang boleh memberi perkhidmatan tersebut</span>
                    </label>

                    <label className="flex items-center gap-2 bg-black/40 p-3 rounded-xl border border-white/10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.justifikasi?.kadarHargaAgensi || false}
                        onChange={(e) => setFormData({
                          ...formData,
                          justifikasi: { ...formData.justifikasi!, kadarHargaAgensi: e.target.checked }
                        })}
                        className="rounded border-white/20 text-risda-orange focus:ring-0"
                      />
                      <span>Kadar harga ditentukan oleh badan/organisasi/agensi yang diiktiraf</span>
                    </label>

                    <label className="flex items-center gap-2 bg-black/40 p-3 rounded-xl border border-white/10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.justifikasi?.perolehanKhas || false}
                        onChange={(e) => setFormData({
                          ...formData,
                          justifikasi: { ...formData.justifikasi!, perolehanKhas: e.target.checked }
                        })}
                        className="rounded border-white/20 text-risda-orange focus:ring-0"
                      />
                      <span>Perolehan disebabkan perjanjian atau kepakaran khas</span>
                    </label>

                    <div className="bg-black/40 p-3 rounded-xl border border-white/10 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.justifikasi?.lainLain || false}
                          onChange={(e) => setFormData({
                            ...formData,
                            justifikasi: { ...formData.justifikasi!, lainLain: e.target.checked }
                          })}
                          className="rounded border-white/20 text-risda-orange focus:ring-0"
                        />
                        <span>Lain-lain (nyatakan):</span>
                      </label>
                      {formData.justifikasi?.lainLain && (
                        <input
                          type="text"
                          value={formData.justifikasi?.lainLainNyatakan || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            justifikasi: { ...formData.justifikasi!, lainLainNyatakan: e.target.value }
                          })}
                          className="w-full px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-white text-xs"
                          placeholder="Nyatakan sebab..."
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                      6. Pembekal Yang Dipilih
                    </label>
                    <input
                      type="text"
                      value={formData.pembekalDipilih || formData.supplierName}
                      onChange={(e) => setFormData({ ...formData, pembekalDipilih: e.target.value, supplierName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-risda-orange uppercase"
                      placeholder="PUNCAK BAYU"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* SEKSI B: PENGESAHAN BAKI PERUNTUKAN OLEH UNIT KEWANGAN */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <Coins size={16} /> B. PENGESAHAN BAKI PERUNTUKAN OLEH UNIT KEWANGAN
                  </h3>
                  {(formData.kodAktivitiObjek || formData.allocationCode) && (
                    <button
                      type="button"
                      onClick={() => setShowAllocSelectionModal(true)}
                      className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw size={11} /> Tukar Kod Induk
                    </button>
                  )}
                </div>

                {/* Status Pengesahan Auto */}
                {(formData.kodAktivitiObjek || formData.allocationCode) && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold min-w-0">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase font-black text-emerald-400">
                          Kod Peruntukan Induk Auto-Dipilih:
                        </div>
                        <div className="text-white font-bold text-xs truncate">
                          {formData.kodAktivitiObjek || formData.allocationCode}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs shrink-0 border border-emerald-500/30">
                      Baki: RM {Number(formData.bakiPeruntukanRm || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                      Status Pengesahan Baki
                    </label>
                    <select
                      value={formData.pengesahanKewanganStatus}
                      onChange={(e) => setFormData({ ...formData, pengesahanKewanganStatus: e.target.value as any })}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-emerald-400"
                    >
                      <option value="MENCUKUPI">MENCUKUPI</option>
                      <option value="TIDAK MENCUKUPI">TIDAK MENCUKUPI</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                      Baki Peruntukan (RM)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.bakiPeruntukanRm}
                      onChange={(e) => setFormData({ ...formData, bakiPeruntukanRm: Number(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-risda-gold mb-1 flex items-center justify-between">
                    <span>Kod Aktiviti / Objek Induk (Seksi B)</span>
                    <span className="text-[9px] text-emerald-400 font-bold">Pilihan Kod Induk Sahaja</span>
                  </label>
                  {allocationCodes.length > 0 ? (
                    <select
                      value={formData.kodAktivitiObjek || formData.allocationCode}
                      onChange={(e) => handleSelectAllocationCode(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-bold focus:outline-none focus:border-emerald-400 cursor-pointer"
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
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-emerald-400 uppercase"
                      placeholder="031400 / R4400000 - PAP (KOD INDUK)"
                    />
                  )}
                  <span className="text-[9px] text-emerald-300 font-bold block mt-1">
                    * Pilihan di atas adalah Kod Induk sahaja. Bagi pecahan spesifik (seperti 031401, 031402, dll.), sila tetapkan pada setiap item di Jadual Item Detail bagi memudahkan Unit Kewangan mengesan kod tersebut.
                  </span>
                </div>
              </div>

              {/* SEKSI C: KELULUSAN KETUA PUSAT TANGGUNGJAWAB */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h3 className="text-sm font-black text-sky-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={16} /> C. KELULUSAN KETUA PUSAT TANGGUNGJAWAB
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                      Keputusan Kelulusan PTJ
                    </label>
                    <select
                      value={formData.kelulusanKetuaPtjStatus}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        kelulusanKetuaPtjStatus: e.target.value as any,
                        status: e.target.value === 'DILULUSKAN' ? 'LULUS' : 'DITOLAK'
                      })}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-sky-400"
                    >
                      <option value="DILULUSKAN">DILULUSKAN</option>
                      <option value="TIDAK DILULUSKAN">TIDAK DILULUSKAN</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                      Ketua Pusat Tanggungjawab
                    </label>
                    <input
                      type="text"
                      value={formData.ketuaPtjNama}
                      onChange={(e) => setFormData({ ...formData, ketuaPtjNama: e.target.value })}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-sky-400 uppercase"
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
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase text-white transition-all"
                >
                  BATAL
                </button>

                <button
                  type="submit"
                  className="px-8 py-3.5 bg-gradient-to-r from-risda-orange to-risda-gold text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg hover:scale-105 transition-all"
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
          <div className="bg-risda-card border border-white/10 rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <FileText className="text-risda-gold" size={20} /> DETAIL BORANG KAJIAN PASARAN
                </h2>
                <p className="text-xs text-risda-muted font-bold mt-0.5">
                  Pratonton rasmi Borang Kajian Pasaran & Maklumat Kewangan.
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 rounded-xl bg-white/5 text-risda-muted hover:text-white"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* PREVIEW CONTENT */}
            <div className="space-y-6 text-xs text-white/90 bg-black/40 p-6 rounded-2xl border border-white/10">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <img 
                    src="/intrologo_RISDA.png" 
                    alt="Logo RISDA" 
                    className="h-10 w-auto object-contain" 
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.includes('/PUBLIC/')) {
                        target.src = '/PUBLIC/intrologo_RISDA.png';
                      } else if (!target.src.includes('/api/logo')) {
                        target.src = '/api/logo';
                      }
                    }}
                  />
                  <div>
                    <span className="text-[10px] text-risda-muted font-black uppercase block">Pusat Tanggungjawab</span>
                    <span className="text-base font-black text-white">{selectedRequestForDetail.ptjName || 'PRD BEAUFORT'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-risda-muted font-black uppercase block">No. PO</span>
                  <span className="text-base font-black font-mono text-emerald-400">{selectedRequestForDetail.poNo || 'PO-2026-0089'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-risda-gold uppercase block font-bold">No. Pesanan:</span>
                  <span className="font-mono text-white font-bold">{selectedRequestForDetail.orderNo}</span>
                </div>
                <div>
                  <span className="text-[10px] text-risda-gold uppercase block font-bold">Jenis Perolehan:</span>
                  <span className="text-white font-bold">{selectedRequestForDetail.jenisPerolehanCategory || selectedRequestForDetail.category}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-risda-gold uppercase block font-bold">Perihal Perolehan:</span>
                <p className="text-white font-bold uppercase mt-1">{selectedRequestForDetail.perihalPerolehan || selectedRequestForDetail.title}</p>
              </div>

              <div>
                <span className="text-[10px] text-risda-gold uppercase block font-bold mb-2">Anggaran Harga Jabatan:</span>
                <div className="border border-white/10 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 text-[10px] text-risda-muted uppercase">
                      <tr>
                        <th className="p-2">Bil</th>
                        <th className="p-2">Item</th>
                        <th className="p-2 text-center">Kuantiti</th>
                        <th className="p-2 text-right">Harga Seunit (RM)</th>
                        <th className="p-2 text-right">Jumlah (RM)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(selectedRequestForDetail.items || []).map((it, idx) => (
                        <tr key={it.id}>
                          <td className="p-2 text-risda-muted">{idx + 1}</td>
                          <td className="p-2 font-bold uppercase">
                            <div>{it.description}</div>
                          </td>
                          <td className="p-2 text-center font-mono">{it.quantity}</td>
                          <td className="p-2 text-right font-mono">{Number(it.unitPrice).toFixed(2)}</td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-400">{Number(it.totalPrice).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-[10px] text-emerald-300 font-medium mt-2 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/30 flex items-center gap-2">
                  <span>ℹ️ <strong>Nota Vot / Kod Peruntukan:</strong> Kod Aktiviti (031401, 031402) dan Kod Objek (R4419900) adalah pecahan kecil di bawah Vot Induk <strong>031400 / R4400000</strong>. Semua item dikira dalam peruntukan yang sama.</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div>
                  <span className="text-[10px] text-risda-gold uppercase block font-bold">Pembekal Dipilih:</span>
                  <span className="text-emerald-300 font-bold uppercase text-sm block mt-1">
                    {selectedRequestForDetail.pembekalDipilih || selectedRequestForDetail.supplierName || 'PUNCAK BAYU'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-risda-gold uppercase block font-bold">Pengesahan Baki Vot:</span>
                  <span className="text-white font-bold block mt-1">
                    {selectedRequestForDetail.kodAktivitiObjek || selectedRequestForDetail.allocationCode}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase text-white"
              >
                TUTUP
              </button>

              <button
                onClick={() => {
                  setShowDetailModal(false);
                  handlePrintSlip(selectedRequestForDetail);
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                <Download size={15} /> MUAT TURUN / CETAK BORANG KAJIAN PASARAN (PDF)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: KEMASKINI / TAMBAH ITEM PESANAN KEWANGAN (e-Kewangan) */}
      {itemModalOpen && currentReqForItemModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-risda-card border border-emerald-500/30 rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Coins className="text-emerald-400" size={20} />
                  KEMASKINI ITEM PESANAN KEWANGAN
                </h2>
                <p className="text-xs text-risda-muted font-bold mt-0.5">
                  Lengkapkan butiran item, Kod Aktiviti & Kod Objek untuk e-Kewangan RISDA.
                </p>
              </div>
              <button
                onClick={() => setItemModalOpen(false)}
                className="p-2 rounded-xl bg-white/5 text-risda-muted hover:text-white"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveFinancialItem} className="space-y-4 text-xs text-white">
              <div>
                <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                  Perihal Item / Perkhidmatan / Kerja
                </label>
                <textarea
                  rows={2}
                  value={itemFormData.description}
                  onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs uppercase font-bold focus:outline-none focus:border-emerald-400"
                  placeholder="Contoh: INSURAN PERLINDUNGAN TANGGUNGAN AWAM"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                  Detail / Perincian Kerja Yang Perlu Dibuat (cth: INSURAN PAMPASAN PEKERJA)
                </label>
                <input
                  type="text"
                  value={itemFormData.detailKerja || ''}
                  onChange={(e) => setItemFormData({ ...itemFormData, detailKerja: e.target.value })}
                  className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs uppercase font-bold focus:outline-none focus:border-emerald-400"
                  placeholder="Contoh: INSURAN PAMPASAN PEKERJA / PEMBINAAN PARIT"
                />
              </div>

              {/* Dynamic Sub-Codes Selection Dropdowns */}
              {(() => {
                const { aktSubs, objSubs } = getAvailableSubCodesForForm(currentReqForItemModal?.kodAktivitiObjek || currentReqForItemModal?.allocationCode || '');
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                        Kod Aktiviti (Akt)
                      </label>
                      <select
                        value={itemFormData.kodAktiviti || ''}
                        onChange={(e) => setItemFormData({ ...itemFormData, kodAktiviti: e.target.value })}
                        className="w-full px-3 py-2 bg-black/80 border border-emerald-500/40 rounded-xl text-white font-mono text-xs uppercase focus:outline-none focus:border-emerald-400 cursor-pointer"
                      >
                        <option value="" className="bg-gray-900 text-gray-400">-- Pilih Sub-Kod Aktiviti --</option>
                        {aktSubs.map((sc) => (
                          <option key={sc.subCode} value={sc.subCode} className="bg-gray-900 text-white">
                            {sc.subCode} {sc.perihal ? `- ${sc.perihal}` : ''}
                          </option>
                        ))}
                        {itemFormData.kodAktiviti && !aktSubs.some(s => s.subCode === itemFormData.kodAktiviti) && (
                          <option value={itemFormData.kodAktiviti} className="bg-gray-900 text-white">
                            {itemFormData.kodAktiviti} (Tersuai)
                          </option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                        Kod Objek (Objek)
                      </label>
                      <select
                        value={itemFormData.kodObjek || ''}
                        onChange={(e) => setItemFormData({ ...itemFormData, kodObjek: e.target.value })}
                        className="w-full px-3 py-2 bg-black/80 border border-emerald-500/40 rounded-xl text-white font-mono text-xs uppercase focus:outline-none focus:border-emerald-400 cursor-pointer"
                      >
                        <option value="" className="bg-gray-900 text-gray-400">-- Pilih Sub-Kod Objek --</option>
                        {objSubs.map((sc) => (
                          <option key={sc.subCode} value={sc.subCode} className="bg-gray-900 text-white">
                            {sc.subCode} {sc.perihal ? `- ${sc.perihal}` : ''}
                          </option>
                        ))}
                        {itemFormData.kodObjek && !objSubs.some(s => s.subCode === itemFormData.kodObjek) && (
                          <option value={itemFormData.kodObjek} className="bg-gray-900 text-white">
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
                  <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                    No. Aset (Jika Ada)
                  </label>
                  <input
                    type="text"
                    value={itemFormData.noAset}
                    onChange={(e) => setItemFormData({ ...itemFormData, noAset: e.target.value })}
                    className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-xs uppercase focus:outline-none focus:border-emerald-400"
                    placeholder="No. Aset"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
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
                    className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-xs font-bold text-right focus:outline-none focus:border-emerald-400"
                    min={0}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
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
                    className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-xs font-bold text-right focus:outline-none focus:border-emerald-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
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
                    className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-xs text-right focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl flex items-center justify-between font-mono">
                <div>
                  <span className="text-[10px] text-risda-muted uppercase block font-bold">Jumlah (RM):</span>
                  <span className="text-sm font-black text-white">
                    {(Number(itemFormData.quantity) * Number(itemFormData.unitPrice)).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-400 uppercase block font-bold">Jumlah Harga + GST (RM):</span>
                  <span className="text-base font-black text-emerald-400">
                    {((Number(itemFormData.quantity) * Number(itemFormData.unitPrice)) + Number(itemFormData.nilaiGst || 0)).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg hover:scale-105 transition-all"
                >
                  Simpan Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
