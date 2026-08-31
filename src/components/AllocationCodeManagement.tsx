import React, { useState, useEffect } from 'react';
import { Coins, Plus, Search, Edit2, Trash2, XCircle, CheckCircle2, DollarSign, PieChart, Layers, Tag, ShieldCheck, RefreshCw, FileText, ChevronDown, ChevronRight, ListFilter, Download, Loader2 } from 'lucide-react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { exportDetailedAllocationReportToPDF, DetailedReportCodeData } from '../lib/reportExportUtils';
import toast from 'react-hot-toast';

export interface SubAllocationCode {
  id?: string;
  subCode: string; // e.g. '031401' or 'R4400001'
  suffix: string; // e.g. '01'
  perihal: string; // e.g. 'Bekalan Baja & Biji Benih'
  allocatedAmount: number;
  pertanggungan?: number;
  perbelanjaan?: number;
  baki?: number;
}

export interface AllocationCode {
  id?: string;
  akt: string; // Kod Aktiviti e.g. 031400
  obj: string; // Kod Objek e.g. R4400000
  perihal: string; // Perihal / Deskripsi peruntukan
  nkeaKwr: number; // NKEA / PEND. KWR (RM)
  peruntukanBlk: number; // PERUNTUKAN BLK (RM)
  jumlahDiterima: number; // JUMLAH PERUNTUKAN DITERIMA (RM)
  pertanggunganBelumDijelaskan: number; // PERTANGGUNGAN BELUM DIJELASKAN (RM)
  jumlahPerbelanjaan: number; // JUMLAH PERBELANJAAN DILAKUKAN (RM)
  bakiPeruntukan: number; // BAKI PERUNTUKAN (RM)
  year?: string;
  tarikhDiterima?: string; // e.g. '2026-02-01'
  status?: 'AKTIF' | 'TIDAK AKTIF';
  description?: string;
  pendingOrdersCount?: number;
  paidOrdersCount?: number;
  updatedAt?: string;
  subCodes?: SubAllocationCode[];
  aktSubCodes?: SubAllocationCode[];
  objSubCodes?: SubAllocationCode[];
  objPerihal?: string;
  code?: string;
}

// Helper to determine whether a subcode is for Kod Objek vs Kod Aktiviti
const isObjSubCode = (sc: SubAllocationCode | { subCode: string }, itemAkt?: string, itemObj?: string): boolean => {
  const code = (sc.subCode || '').toUpperCase().trim();
  if (code.startsWith('R')) return true;
  if (itemObj) {
    const objClean = itemObj.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const objPrefix = objClean.substring(0, 3);
    if (objPrefix && code.startsWith(objPrefix)) return true;
  }
  if (itemAkt) {
    const aktClean = itemAkt.toUpperCase().replace(/[^0-9]/g, '');
    const aktPrefix = aktClean.substring(0, 4);
    if (aktPrefix && code.startsWith(aktPrefix)) return false;
  }
  if (/^[A-Z]/.test(code)) return true;
  return false;
};

export default function AllocationCodeManagement() {
  const { role, office, district } = useAuth();
  const isAdmin = role === 'admin' || role === 'pentadbir';

  const [activeTab, setActiveTab] = useState<'PENGELASAN' | 'LAPORAN_TERPERINCI'>('PENGELASAN');
  const [codes, setCodes] = useState<AllocationCode[]>([]);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('2026');
  const [selectedKodPaFilter, setSelectedKodPaFilter] = useState<string>('SEMUA');
  const [selectedKodObjekFilter, setSelectedKodObjekFilter] = useState<string>('SEMUA');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // States for Sub-Kod Kecil Popup Modal
  const [showSubCodeModal, setShowSubCodeModal] = useState(false);
  const [selectedSubCodeItem, setSelectedSubCodeItem] = useState<AllocationCode | null>(null);
  const [subCodeModalType, setSubCodeModalType] = useState<'AKT' | 'OBJ'>('AKT');
  const [activeSubCodes, setActiveSubCodes] = useState<SubAllocationCode[]>([]);
  const [newSubCodeForm, setNewSubCodeForm] = useState({
    subCode: '',
    perihal: '',
    allocatedAmount: 0
  });

  // States for Laporan Peruntukan Terperinci generation modal & active criteria
  const [isReportGenerated, setIsReportGenerated] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [reportGenParams, setReportGenParams] = useState({
    codeId: 'SEMUA',
    startDate: '',
    endDate: ''
  });
  const [activeReportCriteria, setActiveReportCriteria] = useState<{
    codeId: string;
    startDate: string;
    endDate: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    akt: '',
    obj: '',
    perihal: '',
    nkeaKwr: 0,
    peruntukanBlk: 0,
    pertanggunganBelumDijelaskan: 0,
    jumlahPerbelanjaan: 0,
    year: '2026',
    tarikhDiterima: new Date().toISOString().split('T')[0],
    status: 'AKTIF' as 'AKTIF' | 'TIDAK AKTIF',
    description: ''
  });

  useEffect(() => {
    fetchAllocationCodes();

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#terperinci' || hash === '#laporan') {
        setActiveTab('LAPORAN_TERPERINCI');
      } else if (hash === '#pengelasan' || hash === '') {
        setActiveTab('PENGELASAN');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const fetchAllocationCodes = async () => {
    setLoading(true);
    try {
      // 1. Fetch Allocation Codes
      const qCodes = query(collection(db, 'allocationCodes'));
      const snapshotCodes = await getDocs(qCodes);
      const tempCodes: AllocationCode[] = [];

      snapshotCodes.forEach((docSnap) => {
        const d = docSnap.data();
        const nkea = Number(d.nkeaKwr) || 0;
        const blk = Number(d.peruntukanBlk ?? d.approvedAmount) || 0;
        const diterima = Number(d.jumlahDiterima) || (nkea + blk);
        const pertanggungan = Number(d.pertanggunganBelumDijelaskan) || 0;
        const belanja = Number(d.jumlahPerbelanjaan) || 0;
        const baki = Number(d.bakiPeruntukan) ?? (diterima - pertanggungan - belanja);

        tempCodes.push({
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

      // 2. Fetch Order Requests to automatically detect orders linked to allocation codes
      let ordersList: any[] = [];
      try {
        const qOrders = query(collection(db, 'orderRequests'));
        const snapshotOrders = await getDocs(qOrders);
        snapshotOrders.forEach((docSnap) => {
          ordersList.push({ id: docSnap.id, ...docSnap.data() });
        });
      } catch (e) {
        console.warn('Could not fetch orderRequests for allocation codes calculation:', e);
      }
      setRawOrders(ordersList);

      // 3. For each allocation code, calculate pertanggungan (pending/committed orders) & perbelanjaan (paid orders)
      const list = tempCodes.map((c) => {
        const matchingOrders = ordersList.filter((ord) => {
          const ordCodeStr = `${ord.allocationCode || ''} ${ord.kodAktivitiObjek || ''}`.toUpperCase();
          const matchesAkt = c.akt && ordCodeStr.includes(c.akt.toUpperCase());
          const matchesItems = ord.items && Array.isArray(ord.items) && ord.items.some((i: any) => i.kodAktiviti === c.akt);
          return matchesAkt || matchesItems;
        });

        let orderPertanggungan = 0;
        let orderBelanja = 0;
        let pendingOrdersCount = 0;
        let paidOrdersCount = 0;

        matchingOrders.forEach((ord) => {
          const amt = Number(ord.estimatedAmount) || (ord.items ? ord.items.reduce((s: number, i: any) => s + (Number(i.jumlahHarga || i.totalPrice) || 0), 0) : 0);
          const isPaid = ord.financeStatus === 'DIBAYAR' || ord.status === 'DIBAYAR';

          if (isPaid) {
            orderBelanja += amt;
            paidOrdersCount++;
          } else {
            // Active order created / sent to finance
            orderPertanggungan += amt;
            pendingOrdersCount++;
          }
        });

        const finalPertanggungan = matchingOrders.length > 0 ? orderPertanggungan : c.pertanggunganBelumDijelaskan;
        const finalBelanja = matchingOrders.length > 0 ? orderBelanja : c.jumlahPerbelanjaan;
        const finalBaki = c.jumlahDiterima - finalPertanggungan - finalBelanja;

        return {
          ...c,
          pertanggunganBelumDijelaskan: finalPertanggungan,
          jumlahPerbelanjaan: finalBelanja,
          bakiPeruntukan: finalBaki,
          pendingOrdersCount,
          paidOrdersCount
        };
      });

      setCodes(list);
    } catch (err) {
      console.error('Error fetching allocation codes:', err);
      setCodes([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper generator for default sub-codes when none explicitly stored
  const generateDefaultSubCodes = (akt: string, obj: string, perihal: string, totalDiterima: number, type: 'AKT' | 'OBJ'): SubAllocationCode[] => {
    return [];
  };

  // Open Sub-Kod Kecil popup modal
  const handleOpenSubCodeModal = (item: AllocationCode, type: 'AKT' | 'OBJ') => {
    setSelectedSubCodeItem(item);
    setSubCodeModalType(type);

    let existingSubCodes: SubAllocationCode[] = [];

    if (type === 'AKT') {
      if (item.aktSubCodes && Array.isArray(item.aktSubCodes) && item.aktSubCodes.length > 0) {
        existingSubCodes = item.aktSubCodes;
      } else if (item.subCodes && Array.isArray(item.subCodes) && item.subCodes.length > 0) {
        existingSubCodes = item.subCodes.filter(sc => !isObjSubCode(sc, item.akt, item.obj));
      } else {
        // Look for matching aktSubCodes from other records with same akt
        const matchingRecord = codes.find(c => 
          c.akt && item.akt && c.akt === item.akt &&
          ((c.aktSubCodes && c.aktSubCodes.length > 0) || (c.subCodes && c.subCodes.some(sc => !isObjSubCode(sc, c.akt, c.obj))))
        );
        if (matchingRecord) {
          existingSubCodes = matchingRecord.aktSubCodes && matchingRecord.aktSubCodes.length > 0
            ? matchingRecord.aktSubCodes
            : (matchingRecord.subCodes || []).filter(sc => !isObjSubCode(sc, item.akt, item.obj));
        }
      }
    } else {
      if (item.objSubCodes && Array.isArray(item.objSubCodes) && item.objSubCodes.length > 0) {
        existingSubCodes = item.objSubCodes;
      } else if (item.subCodes && Array.isArray(item.subCodes) && item.subCodes.length > 0) {
        existingSubCodes = item.subCodes.filter(sc => isObjSubCode(sc, item.akt, item.obj));
      } else {
        // Look for matching objSubCodes from other records with same obj
        const matchingRecord = codes.find(c => 
          c.obj && item.obj && c.obj === item.obj &&
          ((c.objSubCodes && c.objSubCodes.length > 0) || (c.subCodes && c.subCodes.some(sc => isObjSubCode(sc, c.akt, c.obj))))
        );
        if (matchingRecord) {
          existingSubCodes = matchingRecord.objSubCodes && matchingRecord.objSubCodes.length > 0
            ? matchingRecord.objSubCodes
            : (matchingRecord.subCodes || []).filter(sc => isObjSubCode(sc, item.akt, item.obj));
        }
      }
    }

    // Calculate real pertanggungan & perbelanjaan for each subcode from rawOrders
    const enrichedSubCodes = existingSubCodes.map(sc => {
      let subPertanggungan = 0;
      let subBelanja = 0;

      rawOrders.forEach(ord => {
        const isPaid = ord.financeStatus === 'DIBAYAR' || ord.status === 'DIBAYAR';
        const ordCodeStr = `${ord.allocationCode || ''} ${ord.kodAktivitiObjek || ''}`.toUpperCase();

        let matchesOrder = false;
        if (ord.items && Array.isArray(ord.items)) {
          ord.items.forEach((i: any) => {
            const itemAkt = (i.kodAktiviti || '').toUpperCase();
            const itemObj = (i.kodObjek || '').toUpperCase();
            if (itemAkt === sc.subCode.toUpperCase() || itemObj === sc.subCode.toUpperCase()) {
              matchesOrder = true;
              const amt = Number(i.jumlahHarga || i.totalPrice) || (Number(i.quantity) * Number(i.unitPrice)) || 0;
              if (isPaid) {
                subBelanja += amt;
              } else {
                subPertanggungan += amt;
              }
            }
          });
        }

        if (!matchesOrder && ordCodeStr.includes(sc.subCode.toUpperCase())) {
          const amt = Number(ord.estimatedAmount) || 0;
          if (isPaid) {
            subBelanja += amt;
          } else {
            subPertanggungan += amt;
          }
        }
      });

      const baki = sc.allocatedAmount - subPertanggungan - subBelanja;
      return {
        ...sc,
        pertanggungan: subPertanggungan,
        perbelanjaan: subBelanja,
        baki: baki
      };
    });

    setActiveSubCodes(enrichedSubCodes);
    setNewSubCodeForm({ subCode: '', perihal: '', allocatedAmount: 0 });
    setShowSubCodeModal(true);
  };

  // Update existing subcode in table directly
  const handleUpdateSubCodeInTable = (index: number, field: 'subCode' | 'perihal', val: string) => {
    setActiveSubCodes(prev => prev.map((sc, idx) => {
      if (idx !== index) return sc;
      const updated = { ...sc, [field]: val };
      if (field === 'subCode') {
        updated.suffix = val.slice(-2);
      }
      return updated;
    }));
  };

  // Add new subcode to list
  const handleAddSubCode = () => {
    if (!selectedSubCodeItem) return;

    const subCodeVal = newSubCodeForm.subCode.trim().toUpperCase();

    if (!subCodeVal) {
      toast.error('Sila masukkan Kod Sub Kecil (cth: R4419900 atau 031401)');
      return;
    }

    if (subCodeModalType === 'AKT' && isObjSubCode({ subCode: subCodeVal }, selectedSubCodeItem.akt, selectedSubCodeItem.obj)) {
      toast.error('Sila masukkan Kod Aktiviti (cth: 031401). Bagi Kod Objek (cth: R4419900), sila tambah di bahagian Kod Objek.');
      return;
    }

    if (subCodeModalType === 'OBJ' && !isObjSubCode({ subCode: subCodeVal }, selectedSubCodeItem.akt, selectedSubCodeItem.obj)) {
      toast.error('Sila masukkan Kod Objek (cth: R4419900 atau R4421000). Bagi Kod Aktiviti, sila tambah di bahagian Kod Aktiviti.');
      return;
    }

    if (!newSubCodeForm.perihal.trim()) {
      toast.error('Sila masukkan Perihal Sub-Kod Kecil');
      return;
    }

    const newSc: SubAllocationCode = {
      id: `sc-custom-${Date.now()}`,
      subCode: subCodeVal,
      suffix: subCodeVal.slice(-2),
      perihal: newSubCodeForm.perihal.trim().toUpperCase(),
      allocatedAmount: Number(newSubCodeForm.allocatedAmount) || 0,
      pertanggungan: 0,
      perbelanjaan: 0,
      baki: Number(newSubCodeForm.allocatedAmount) || 0
    };

    setActiveSubCodes(prev => [...prev, newSc]);
    setNewSubCodeForm({ subCode: '', perihal: '', allocatedAmount: 0 });
    toast.success(`Sub-Kod ${subCodeVal} berjaya ditambah ke senarai!`);
  };

  // Delete subcode
  const handleDeleteSubCode = (index: number) => {
    setActiveSubCodes(prev => prev.filter((_, idx) => idx !== index));
    toast.success('Sub-kod dikeluarkan daripada senarai');
  };

  // Clear all subcodes
  const handleClearAllSubCodes = () => {
    setActiveSubCodes([]);
    toast.success('Semua pecahan sub-kod kecil telah dikosongkan.');
  };

  // Auto fill from previous year template or matching codes
  const handleAutoFillPreviousYearSubCodes = () => {
    if (!selectedSubCodeItem) return;
    if (subCodeModalType === 'AKT') {
      const matchingRecord = codes.find(c => 
        c.akt && selectedSubCodeItem.akt && c.akt === selectedSubCodeItem.akt &&
        ((c.aktSubCodes && c.aktSubCodes.length > 0) || (c.subCodes && c.subCodes.some(sc => !isObjSubCode(sc, c.akt, c.obj))))
      );
      if (matchingRecord) {
        const found = matchingRecord.aktSubCodes && matchingRecord.aktSubCodes.length > 0
          ? matchingRecord.aktSubCodes
          : (matchingRecord.subCodes || []).filter(sc => !isObjSubCode(sc, selectedSubCodeItem.akt, selectedSubCodeItem.obj));
        setActiveSubCodes(found);
        toast.success('Sub-kod Aktiviti berjaya diisi berdasarkan rekod sedia ada!');
      } else {
        toast.error('Tiada rekod sub-kod Aktiviti sedia ada untuk Kod Aktiviti ini.');
      }
    } else {
      const matchingRecord = codes.find(c => 
        c.obj && selectedSubCodeItem.obj && c.obj === selectedSubCodeItem.obj &&
        ((c.objSubCodes && c.objSubCodes.length > 0) || (c.subCodes && c.subCodes.some(sc => isObjSubCode(sc, c.akt, c.obj))))
      );
      if (matchingRecord) {
        const found = matchingRecord.objSubCodes && matchingRecord.objSubCodes.length > 0
          ? matchingRecord.objSubCodes
          : (matchingRecord.subCodes || []).filter(sc => isObjSubCode(sc, selectedSubCodeItem.akt, selectedSubCodeItem.obj));
        setActiveSubCodes(found);
        toast.success('Sub-kod Objek berjaya diisi berdasarkan rekod sedia ada!');
      } else {
        toast.error('Tiada rekod sub-kod Objek sedia ada untuk Kod Objek ini.');
      }
    }
  };

  // Save subcodes array into Firestore and propagate to matching codes across all years
  const handleSaveSubCodes = async () => {
    if (!selectedSubCodeItem || !selectedSubCodeItem.id) {
      toast.error('Tiada rekod Kod Peruntukan dipilih');
      return;
    }

    const toastId = toast.loading('Menyimpan perubahan sub-kod...');
    try {
      const isAkt = subCodeModalType === 'AKT';
      const matchingCodes = codes.filter(c => 
        c.id === selectedSubCodeItem.id ||
        (isAkt && c.akt && selectedSubCodeItem.akt && c.akt === selectedSubCodeItem.akt) ||
        (!isAkt && c.obj && selectedSubCodeItem.obj && c.obj === selectedSubCodeItem.obj)
      );

      const updatePromises = matchingCodes
        .filter(c => c.id && !c.id.startsWith('alloc-'))
        .map(c => {
          const currentAkt = isAkt ? activeSubCodes : (c.aktSubCodes && c.aktSubCodes.length > 0 ? c.aktSubCodes : (c.subCodes || []).filter(sc => !isObjSubCode(sc, c.akt, c.obj)));
          const currentObj = !isAkt ? activeSubCodes : (c.objSubCodes && c.objSubCodes.length > 0 ? c.objSubCodes : (c.subCodes || []).filter(sc => isObjSubCode(sc, c.akt, c.obj)));
          const mergedSubCodes = [...currentAkt, ...currentObj];

          return updateDoc(doc(db, 'allocationCodes', c.id), {
            aktSubCodes: currentAkt,
            objSubCodes: currentObj,
            subCodes: mergedSubCodes,
            updatedAt: new Date().toISOString()
          });
        });

      await Promise.all(updatePromises);

      const matchingIds = new Set(matchingCodes.map(c => c.id));
      setCodes(prev => prev.map(c => {
        if (matchingIds.has(c.id)) {
          const currentAkt = isAkt ? activeSubCodes : (c.aktSubCodes && c.aktSubCodes.length > 0 ? c.aktSubCodes : (c.subCodes || []).filter(sc => !isObjSubCode(sc, c.akt, c.obj)));
          const currentObj = !isAkt ? activeSubCodes : (c.objSubCodes && c.objSubCodes.length > 0 ? c.objSubCodes : (c.subCodes || []).filter(sc => isObjSubCode(sc, c.akt, c.obj)));
          return {
            ...c,
            aktSubCodes: currentAkt,
            objSubCodes: currentObj,
            subCodes: [...currentAkt, ...currentObj]
          };
        }
        return c;
      }));

      toast.success(
        isAkt
          ? 'Pecahan Sub-Kod Aktiviti berjaya disimpan!'
          : 'Pecahan Sub-Kod Objek berjaya disimpan!',
        { id: toastId }
      );
      setShowSubCodeModal(false);
    } catch (err) {
      console.error('Error saving subcodes:', err);
      toast.error('Gagal menyimpan sub-kod.', { id: toastId });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.akt || !formData.obj || !formData.perihal) {
      toast.error('Sila lengkapkan AKT, OBJ dan Perihal Peruntukan');
      return;
    }

    const nkea = Number(formData.nkeaKwr) || 0;
    const blk = Number(formData.peruntukanBlk) || 0;
    const diterima = nkea + blk;
    const pertanggungan = Number(formData.pertanggunganBelumDijelaskan) || 0;
    const belanja = Number(formData.jumlahPerbelanjaan) || 0;
    const baki = diterima - pertanggungan - belanja;

    // Inherit subCodes if available for matching AKT or OBJ across years
    const existingRecordWithSubCodes = codes.find(c => 
      c.subCodes && Array.isArray(c.subCodes) && c.subCodes.length > 0 &&
      ((c.akt && formData.akt && c.akt === formData.akt) || (c.obj && formData.obj && c.obj === formData.obj))
    );
    const existingItem = codes.find(c => c.id === editingId);
    const inheritedSubCodes = existingItem?.subCodes || existingRecordWithSubCodes?.subCodes || [];

    const recordData = {
      akt: formData.akt,
      obj: formData.obj,
      perihal: formData.perihal,
      subCodes: inheritedSubCodes,
      nkeaKwr: nkea,
      peruntukanBlk: blk,
      jumlahDiterima: diterima,
      pertanggunganBelumDijelaskan: pertanggungan,
      jumlahPerbelanjaan: belanja,
      bakiPeruntukan: baki,
      year: formData.year,
      tarikhDiterima: formData.tarikhDiterima || new Date().toISOString().split('T')[0],
      status: formData.status,
      description: formData.description,
      // Backwards compatibility fields
      code: `${formData.akt}-${formData.obj}`,
      name: formData.perihal,
      approvedAmount: diterima,
      balanceAmount: baki,
      updatedAt: new Date().toISOString()
    };

    const toastId = toast.loading('Menyimpan Peruntukan...');
    try {
      if (editingId && !editingId.startsWith('alloc-')) {
        await updateDoc(doc(db, 'allocationCodes', editingId), recordData);
      } else if (editingId && editingId.startsWith('alloc-')) {
        setCodes(prev => prev.map(c => c.id === editingId ? { ...recordData, id: editingId } : c));
      } else {
        const res = await addDoc(collection(db, 'allocationCodes'), recordData);
        setCodes(prev => [{ id: res.id, ...recordData }, ...prev]);
      }
      toast.success('Peruntukan berjaya disimpan', { id: toastId });
      setShowModal(false);
      resetForm();
      fetchAllocationCodes();
    } catch (err) {
      console.error('Save allocation error:', err);
      toast.error('Gagal menyimpan peruntukan', { id: toastId });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Adakah anda pasti untuk memadam Kod Peruntukan ini?')) return;
    const toastId = toast.loading('Memadam peruntukan...');
    try {
      if (!id.startsWith('alloc-')) {
        await deleteDoc(doc(db, 'allocationCodes', id));
      }
      setCodes(prev => prev.filter(c => c.id !== id));
      toast.success('Kod Peruntukan dipadam', { id: toastId });
    } catch (err) {
      toast.error('Gagal memadam kod', { id: toastId });
    }
  };

  const handleEdit = (c: AllocationCode) => {
    setEditingId(c.id || null);
    setFormData({
      akt: c.akt,
      obj: c.obj,
      perihal: c.perihal,
      nkeaKwr: c.nkeaKwr,
      peruntukanBlk: c.peruntukanBlk,
      pertanggunganBelumDijelaskan: c.pertanggunganBelumDijelaskan,
      jumlahPerbelanjaan: c.jumlahPerbelanjaan,
      year: c.year || '2026',
      tarikhDiterima: c.tarikhDiterima || new Date().toISOString().split('T')[0],
      status: c.status || 'AKTIF',
      description: c.description || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      akt: '',
      obj: '',
      perihal: '',
      nkeaKwr: 0,
      peruntukanBlk: 0,
      pertanggunganBelumDijelaskan: 0,
      jumlahPerbelanjaan: 0,
      year: selectedYearFilter || '2026',
      tarikhDiterima: new Date().toISOString().split('T')[0],
      status: 'AKTIF',
      description: ''
    });
  };

  const uniqueKodPaList = Array.from(new Set(codes.filter(c => (c.year || '2026') === selectedYearFilter).map(c => c.akt))).filter(Boolean);
  const uniqueKodObjekList = Array.from(new Set(codes.filter(c => (c.year || '2026') === selectedYearFilter).map(c => c.obj))).filter(Boolean);

  const filteredCodes = codes.filter(c => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q || (c.akt && c.akt.toLowerCase().includes(q)) ||
                          (c.obj && c.obj.toLowerCase().includes(q)) ||
                          (c.perihal && c.perihal.toLowerCase().includes(q));
    const matchesYear = (c.year || '2026') === selectedYearFilter;
    const matchesKodPa = selectedKodPaFilter === 'SEMUA' || c.akt === selectedKodPaFilter;
    const matchesKodObjek = selectedKodObjekFilter === 'SEMUA' || c.obj === selectedKodObjekFilter;
    return matchesSearch && matchesYear && matchesKodPa && matchesKodObjek;
  });

  const totalDiterima = filteredCodes.reduce((sum, c) => sum + (c.jumlahDiterima || 0), 0);
  const totalBelanja = filteredCodes.reduce((sum, c) => sum + (c.jumlahPerbelanjaan || 0), 0);
  const totalBaki = filteredCodes.reduce((sum, c) => sum + (c.bakiPeruntukan || 0), 0);

  const formatRM = (val: number) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDateDMY = (dateStr?: string) => {
    if (!dateStr) return '01/02/2026';
    try {
      const clean = dateStr.split('T')[0];
      const parts = clean.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      if (dateStr.includes('/')) return dateStr;
    } catch (e) {}
    return dateStr;
  };

  // Helper function to build detailed accounting rows matching exact format in reference image
  const buildDetailedRowsForCode = (mainCode: AllocationCode, startDate?: string, endDate?: string) => {
    const rows: {
      tarikh: string;
      kodPa: string;
      kodObjek: string;
      perihal: string;
      pertanggunganNilai: number;
      pertanggunganBaki: number;
      perbelanjaanNilai: number;
      perbelanjaanTerkumpul: number;
      peruntukanNilai: number;
      peruntukanBaki: number;
    }[] = [];

    let runningPertanggungan = 0;
    let runningPerbelanjaan = 0;
    let runningPeruntukan = mainCode.jumlahDiterima;

    // 1. Initial Allocation Entry Row (e.g. 031400 R4400000 200,000.00)
    rows.push({
      tarikh: formatDateDMY(mainCode.tarikhDiterima || '2026-02-01'),
      kodPa: mainCode.akt,
      kodObjek: mainCode.obj,
      perihal: `PERUNTUKAN ASAL DITERIMA (${mainCode.perihal})`,
      pertanggunganNilai: 0,
      pertanggunganBaki: 0,
      perbelanjaanNilai: 0,
      perbelanjaanTerkumpul: 0,
      peruntukanNilai: mainCode.jumlahDiterima,
      peruntukanBaki: runningPeruntukan
    });

    const mainPrefix = mainCode.akt.substring(0, 4);

    // 2. Gather detailed items from order requests (e.g. 031401 R4419900 INSURAN PAMPASAN PEKERJA)
    rawOrders.forEach((ord) => {
      const isRelevant = ord.status === 'DIHANTAR KE KEWANGAN' || 
                         ord.status === 'DIBAYAR' || 
                         ord.status === 'LULUS' || 
                         ord.financeStatus === 'DIHANTAR' || 
                         ord.financeStatus === 'DISAHKAN KEWANGAN' || 
                         ord.financeStatus === 'DIBAYAR';
      if (!isRelevant) return;

      // Extract explicit order / request date (Tarikh Pesanan / Permohonan) with highest priority
      let ordDateStr = '';
      if (ord.requestDate) {
        ordDateStr = String(ord.requestDate).split('T')[0];
      } else if (ord.tarikhPesanan) {
        ordDateStr = String(ord.tarikhPesanan).split('T')[0];
      } else if (ord.tarikhPermohonan) {
        ordDateStr = String(ord.tarikhPermohonan).split('T')[0];
      } else if (ord.tarikh) {
        ordDateStr = String(ord.tarikh).split('T')[0];
      } else if (ord.disediakanOlehTarikh) {
        ordDateStr = String(ord.disediakanOlehTarikh).split('T')[0];
      } else if (ord.disahkanOlehTarikh) {
        ordDateStr = String(ord.disahkanOlehTarikh).split('T')[0];
      } else if (ord.date) {
        ordDateStr = String(ord.date).split('T')[0];
      } else if (ord.createdAt && typeof ord.createdAt === 'object' && ord.createdAt.toDate) {
        ordDateStr = ord.createdAt.toDate().toISOString().split('T')[0];
      } else if (typeof ord.createdAt === 'string') {
        ordDateStr = ord.createdAt.split('T')[0];
      }

      if (startDate && ordDateStr && ordDateStr < startDate) return;
      if (endDate && ordDateStr && ordDateStr > endDate) return;

      const isPaid = ord.financeStatus === 'DIBAYAR' || ord.status === 'DIBAYAR';
      const supplier = ord.pembekalDipilih || ord.supplierName || 'PEMBEKAL DILANTIK';

      let itemList: any[] = [];
      if (ord.items && Array.isArray(ord.items) && ord.items.length > 0) {
        itemList = ord.items;
      } else {
        itemList = [{
          kodAktiviti: ord.allocationCode || mainCode.akt,
          kodObjek: mainCode.obj,
          description: ord.title || ord.perihalPerolehan || 'PESANAN PEMBELIAN',
          jumlahHarga: Number(ord.estimatedAmount) || 0
        }];
      }

      itemList.forEach((it) => {
        const subAkt = (it.kodAktiviti || mainCode.akt).toString().trim();
        const subObj = (it.kodObjek || mainCode.obj).toString().trim();
        const amt = Number(it.jumlahHarga || it.totalPrice) || (Number(it.unitPrice || 0) * Number(it.quantity || 1)) || 0;

        if (amt === 0) return;

        const matches = subAkt.startsWith(mainPrefix) || mainCode.akt.startsWith(subAkt.substring(0, 4)) || subAkt === mainCode.akt;
        if (!matches) return;

        // Individual item date if specified, otherwise strictly follow the Order Request Date (Tarikh Pesanan)
        const rawItemDate = it.tarikh || it.date || it.requestDate || ordDateStr || ord.requestDate || ord.tarikhPesanan || ord.disediakanOlehTarikh;
        const itemDateFormatted = formatDateDMY(rawItemDate || mainCode.tarikhDiterima || '2026-02-01');

        // Find subcode perihal if available in mainCode.subCodes
        const matchingSubCode = (mainCode.subCodes || []).find(
          sc => sc.subCode === subAkt || sc.subCode === subObj || sc.suffix === subAkt.slice(-2)
        );
        const subCodeText = matchingSubCode?.perihal ? ` [Sub-Kod: ${matchingSubCode.perihal}]` : '';

        const desc = `${it.description || 'ITEM PESANAN'}${subCodeText} (${supplier})`;

        if (!isPaid) {
          // Unpaid Order Commitment Row: Pertanggungan (+)
          runningPertanggungan += amt;
          const currentBaki = mainCode.jumlahDiterima - runningPertanggungan - runningPerbelanjaan;

          rows.push({
            tarikh: itemDateFormatted,
            kodPa: subAkt,
            kodObjek: subObj,
            perihal: desc,
            pertanggunganNilai: amt,
            pertanggunganBaki: runningPertanggungan,
            perbelanjaanNilai: 0,
            perbelanjaanTerkumpul: runningPerbelanjaan,
            peruntukanNilai: 0,
            peruntukanBaki: currentBaki
          });
        } else {
          // Paid Order: Data berpindah terus ke Perbelanjaan (+) sebagai 1 baris kemas tanpa duplicate rows
          runningPerbelanjaan += amt;
          const currentBaki = mainCode.jumlahDiterima - runningPertanggungan - runningPerbelanjaan;

          rows.push({
            tarikh: itemDateFormatted,
            kodPa: subAkt,
            kodObjek: subObj,
            perihal: desc,
            pertanggunganNilai: 0,
            pertanggunganBaki: runningPertanggungan,
            perbelanjaanNilai: amt,
            perbelanjaanTerkumpul: runningPerbelanjaan,
            peruntukanNilai: 0,
            peruntukanBaki: currentBaki
          });
        }
      });
    });

    return rows;
  };

  // Helper function to export detailed allocation report to a styled PDF
  const handleDownloadPDF = async (singleCode?: AllocationCode) => {
    try {
      setIsDownloadingPdf(true);
      toast.loading('Menjana fail PDF Laporan Terperinci...', { id: 'pdf-export' });

      // Determine codes to export
      let targetCodes: AllocationCode[] = [];
      if (singleCode) {
        targetCodes = [singleCode];
      } else {
        targetCodes = codes.filter(c => {
          const matchesYear = (c.year || '2026') === selectedYearFilter;
          const matchesCode = !activeReportCriteria || activeReportCriteria.codeId === 'SEMUA' || c.id === activeReportCriteria.codeId || c.akt === activeReportCriteria.codeId;
          const q = searchTerm.toLowerCase();
          const matchesSearch = !q || (c.akt && c.akt.toLowerCase().includes(q)) ||
                                (c.obj && c.obj.toLowerCase().includes(q)) ||
                                (c.perihal && c.perihal.toLowerCase().includes(q));
          return matchesYear && matchesCode && matchesSearch;
        });
      }

      if (targetCodes.length === 0) {
        toast.error('Tiada rekod Kod Peruntukan untuk dimuat turun.', { id: 'pdf-export' });
        setIsDownloadingPdf(false);
        return;
      }

      const reportCodeData: DetailedReportCodeData[] = targetCodes.map(c => {
        const rows = buildDetailedRowsForCode(c, activeReportCriteria?.startDate, activeReportCriteria?.endDate);
        return {
          akt: c.akt,
          obj: c.obj,
          perihal: c.perihal,
          objPerihal: c.objPerihal,
          jumlahDiterima: c.jumlahDiterima,
          peruntukanBlk: c.peruntukanBlk,
          nkeaKwr: c.nkeaKwr,
          pertanggunganBelumDijelaskan: c.pertanggunganBelumDijelaskan,
          jumlahPerbelanjaan: c.jumlahPerbelanjaan,
          bakiPeruntukan: c.bakiPeruntukan,
          year: c.year || selectedYearFilter,
          rows: rows
        };
      });

      const criteriaText = singleCode
        ? `${singleCode.akt}_${singleCode.obj}`
        : (activeReportCriteria?.codeId === 'SEMUA' ? 'SEMUA_KOD' : (activeReportCriteria?.codeId || 'LAPORAN'));

      await exportDetailedAllocationReportToPDF({
        year: selectedYearFilter,
        office: office || district || 'PEJABAT RISDA DAERAH BEAUFORT',
        criteriaCodeText: criteriaText,
        startDate: activeReportCriteria?.startDate,
        endDate: activeReportCriteria?.endDate,
        codes: reportCodeData
      });

      toast.success('Laporan PDF berjaya dimuat turun!', { id: 'pdf-export' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Gagal memuat turun PDF. Sila cuba lagi.', { id: 'pdf-export' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-risda-card via-black to-risda-card border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-risda-gold/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-risda-gold/10 border border-risda-gold/30 text-risda-gold text-[10px] font-black uppercase tracking-widest mb-3">
              <Coins size={12} /> Kawalan Bajet & Peruntukan RISDA
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
              Kod Peruntukan (Bentuk Kod Akaun)
            </h1>
            <p className="text-xs text-risda-muted font-bold mt-1 max-w-2xl">
              Penyata kawalan peruntukan mengikut AKT, OBJ, NKEA/KWR, BLK, Pertanggungan, Perbelanjaan dan Baki Peruntukan.
            </p>
          </div>

          {activeTab === 'PENGELASAN' && (
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-risda-orange to-risda-gold text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-[0_10px_25px_rgba(0,176,255,0.3)] hover:scale-105 active:scale-95 transition-all self-start md:self-auto"
            >
              <Plus size={16} className="stroke-[3]" /> TAMBAH / KEMASKINI PERUNTUKAN
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs Section Navigation */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-4">
        <button
          type="button"
          onClick={() => {
            setActiveTab('PENGELASAN');
            window.location.hash = 'pengelasan';
          }}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'PENGELASAN'
              ? 'bg-gradient-to-r from-risda-orange to-risda-gold text-white shadow-[0_0_25px_rgba(0,176,255,0.4)] border border-white/30 scale-[1.02]'
              : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10'
          }`}
        >
          <Layers size={16} /> 1. Pengelasan Kod Peruntukan
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('LAPORAN_TERPERINCI');
            window.location.hash = 'terperinci';
          }}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'LAPORAN_TERPERINCI'
              ? 'bg-gradient-to-r from-risda-orange to-risda-gold text-white shadow-[0_0_25px_rgba(0,176,255,0.4)] border border-white/30 scale-[1.02]'
              : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10'
          }`}
        >
          <FileText size={16} /> 2. Laporan Peruntukan Terperinci
        </button>
      </div>

      {/* VIEW 1: PENGELASAN KOD PERUNTUKAN */}
      {activeTab === 'PENGELASAN' && (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-risda-card/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
              <div className="flex items-center justify-between text-xs text-risda-muted font-black uppercase">
                <span>Jumlah Peruntukan Diterima</span>
                <DollarSign size={18} className="text-risda-gold" />
              </div>
              <div className="text-2xl font-black text-risda-gold mt-2">
                RM {formatRM(totalDiterima)}
              </div>
            </div>

            <div className="bg-risda-card/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
              <div className="flex items-center justify-between text-xs text-risda-muted font-black uppercase">
                <span>Jumlah Perbelanjaan Dilakukan</span>
                <PieChart size={18} className="text-sky-400" />
              </div>
              <div className="text-2xl font-black text-sky-400 mt-2">
                RM {formatRM(totalBelanja)}
              </div>
            </div>

            <div className="bg-risda-card/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
              <div className="flex items-center justify-between text-xs text-risda-muted font-black uppercase">
                <span>Baki Peruntukan Boleh Guna</span>
                <ShieldCheck size={18} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400 mt-2">
                RM {formatRM(totalBaki)}
              </div>
            </div>
          </div>

          {/* Search & Year Filter Bar */}
          <div className="bg-risda-card/60 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Year Filter Dropdown Selection */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-risda-gold font-black uppercase tracking-wider shrink-0">
                Tahun Peruntukan:
              </span>
              <select
                value={selectedYearFilter}
                onChange={(e) => setSelectedYearFilter(e.target.value)}
                className="px-4 py-2 bg-black/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-bold focus:outline-none focus:border-risda-orange cursor-pointer"
              >
                <option value="2025">Tahun 2025</option>
                <option value="2026">Tahun 2026</option>
                <option value="2027">Tahun 2027</option>
                <option value="2028">Tahun 2028</option>
              </select>
            </div>

            {/* Perihal / Kod Search Input */}
            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-80">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-risda-muted" />
                <input
                  type="text"
                  placeholder="Cari Perihal, AKT atau OBJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-risda-orange transition-all placeholder:text-white/30"
                />
              </div>
              <button
                onClick={fetchAllocationCodes}
                className="flex items-center gap-2 px-3.5 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-white transition-all shrink-0"
                title="Muat Semula Data"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Main Table: Matches User Uploaded Image Layout Exactly */}
          <div className="bg-risda-card/80 border border-white/10 rounded-3xl p-6 backdrop-blur-md shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-white/20 text-white font-black text-[11px] uppercase tracking-wider bg-black/50">
                    <th colSpan={3} className="py-3 px-4 text-center border-r border-white/10 bg-white/5">
                      BENTUK KOD AKAUN
                    </th>
                    <th rowSpan={2} className="py-3 px-3 text-right border-r border-white/10 align-middle">
                      NKEA /<br />PEND. KWR (RM)
                    </th>
                    <th rowSpan={2} className="py-3 px-3 text-right border-r border-white/10 align-middle">
                      PERUNTUKAN<br />BLK (RM)
                    </th>
                    <th rowSpan={2} className="py-3 px-3 text-right border-r border-white/10 align-middle text-risda-gold bg-risda-gold/5">
                      JUMLAH<br />PERUNTUKAN DITERIMA (RM)
                    </th>
                    <th rowSpan={2} className="py-3 px-3 text-right border-r border-white/10 align-middle text-amber-300">
                      PERTANGGUNGAN<br />BELUM DIJELASKAN (RM)
                    </th>
                    <th rowSpan={2} className="py-3 px-3 text-right border-r border-white/10 align-middle text-sky-300">
                      JUMLAH<br />PERBELANJAAN DILAKUKAN (RM)
                    </th>
                    <th rowSpan={2} className="py-3 px-3 text-right border-r border-white/10 align-middle text-emerald-400 bg-emerald-500/5">
                      BAKI<br />PERUNTUKAN (RM)
                    </th>
                    <th rowSpan={2} className="py-3 px-3 text-center align-middle">
                      TINDAKAN
                    </th>
                  </tr>
                  <tr className="border-b border-white/20 text-white/80 font-black text-[10px] uppercase tracking-wider bg-black/40">
                    <th className="py-2.5 px-3 border-r border-white/10 w-24">AKT</th>
                    <th className="py-2.5 px-3 border-r border-white/10 w-28">OBJ</th>
                    <th className="py-2.5 px-3 border-r border-white/10">PERIHAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-xs font-semibold text-white/90">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-risda-muted font-bold animate-pulse">
                        MEMUATKAN SENARAI PERUNTUKAN...
                      </td>
                    </tr>
                  ) : filteredCodes.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-risda-muted font-bold">
                        Tiada rekod Kod Peruntukan ditemui.
                      </td>
                    </tr>
                  ) : (
                    filteredCodes.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                        <td className="py-3.5 px-3 border-r border-white/10 font-mono font-bold">
                          <button
                            type="button"
                            onClick={() => handleOpenSubCodeModal(item, 'AKT')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-risda-orange/15 hover:bg-risda-orange/35 border border-risda-orange/50 text-risda-orange rounded-xl font-mono text-xs font-black transition-all hover:scale-105 active:scale-95 group/btn shadow-md"
                            title={`Klik untuk lihat terperinci sub-kod kecil bagi AKT ${item.akt}`}
                          >
                            <span>{item.akt}</span>
                            <ListFilter size={11} className="text-risda-orange/80 group-hover/btn:text-white transition-colors" />
                          </button>
                        </td>
                        <td className="py-3.5 px-3 border-r border-white/10 font-mono font-bold">
                          <button
                            type="button"
                            onClick={() => handleOpenSubCodeModal(item, 'OBJ')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-risda-gold/15 hover:bg-risda-gold/35 border border-risda-gold/50 text-risda-gold rounded-xl font-mono text-xs font-black transition-all hover:scale-105 active:scale-95 group/btn shadow-md"
                            title={`Klik untuk lihat terperinci sub-kod kecil bagi OBJ ${item.obj}`}
                          >
                            <span>{item.obj}</span>
                            <ListFilter size={11} className="text-risda-gold/80 group-hover/btn:text-white transition-colors" />
                          </button>
                        </td>
                        <td className="py-3.5 px-3 border-r border-white/10 font-bold uppercase tracking-tight">
                          <div>{item.perihal}</div>
                          {item.tarikhDiterima && (
                            <div className="text-[10px] text-emerald-400 font-mono font-semibold mt-0.5 lowercase tracking-normal">
                              Tarikh Terima: <span className="uppercase font-bold">{formatDateDMY(item.tarikhDiterima)}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 border-r border-white/10 text-right font-mono">
                          {formatRM(item.nkeaKwr)}
                        </td>
                        <td className="py-3.5 px-3 border-r border-white/10 text-right font-mono">
                          {formatRM(item.peruntukanBlk)}
                        </td>
                        <td className="py-3.5 px-3 border-r border-white/10 text-right font-mono font-bold text-risda-gold bg-risda-gold/5">
                          {formatRM(item.jumlahDiterima)}
                        </td>
                        <td className="py-3.5 px-3 border-r border-white/10 text-right font-mono text-amber-300">
                          <div>{formatRM(item.pertanggunganBelumDijelaskan)}</div>
                          {item.pendingOrdersCount && item.pendingOrdersCount > 0 ? (
                            <span className="text-[9px] text-amber-300/80 font-bold block mt-0.5">
                              ({item.pendingOrdersCount} Pesanan Aktif)
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3.5 px-3 border-r border-white/10 text-right font-mono text-sky-300">
                          <div>{formatRM(item.jumlahPerbelanjaan)}</div>
                          {item.paidOrdersCount && item.paidOrdersCount > 0 ? (
                            <span className="text-[9px] text-sky-300/80 font-bold block mt-0.5">
                              ({item.paidOrdersCount} Pesanan Dibayar)
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3.5 px-3 border-r border-white/10 text-right font-mono font-black text-emerald-400 bg-emerald-500/5">
                          {formatRM(item.bakiPeruntukan)}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              title="Kemaskini"
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-risda-orange/20 text-risda-muted hover:text-white transition-all"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id!)}
                              title="Padam"
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-risda-muted hover:text-red-400 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-white/30 bg-black/70 text-white font-black text-xs uppercase">
                    <td colSpan={3} className="py-4 px-4 text-right border-r border-white/10">
                      JUMLAH KESELURAHAN (RM):
                    </td>
                    <td className="py-4 px-3 text-right border-r border-white/10 font-mono">
                      {formatRM(filteredCodes.reduce((sum, c) => sum + c.nkeaKwr, 0))}
                    </td>
                    <td className="py-4 px-3 text-right border-r border-white/10 font-mono">
                      {formatRM(filteredCodes.reduce((sum, c) => sum + c.peruntukanBlk, 0))}
                    </td>
                    <td className="py-4 px-3 text-right border-r border-white/10 font-mono text-risda-gold">
                      {formatRM(totalDiterima)}
                    </td>
                    <td className="py-4 px-3 text-right border-r border-white/10 font-mono text-amber-300">
                      {formatRM(filteredCodes.reduce((sum, c) => sum + c.pertanggunganBelumDijelaskan, 0))}
                    </td>
                    <td className="py-4 px-3 text-right border-r border-white/10 font-mono text-sky-300">
                      {formatRM(totalBelanja)}
                    </td>
                    <td className="py-4 px-3 text-right border-r border-white/10 font-mono text-emerald-400">
                      {formatRM(totalBaki)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* VIEW 2: LAPORAN PERUNTUKAN TERPERINCI */}
      {activeTab === 'LAPORAN_TERPERINCI' && (
        <div className="space-y-6">
          {/* Controls & Header */}
          <div className="bg-risda-card/80 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] text-risda-gold font-black uppercase tracking-wider">
                Tahun Peruntukan:
              </span>
              <select
                value={selectedYearFilter}
                onChange={(e) => {
                  setSelectedYearFilter(e.target.value);
                  setIsReportGenerated(false);
                }}
                className="px-3 py-2 bg-black/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-bold focus:outline-none focus:border-risda-orange cursor-pointer"
              >
                <option value="2025">Tahun 2025</option>
                <option value="2026">Tahun 2026</option>
                <option value="2027">Tahun 2027</option>
                <option value="2028">Tahun 2028</option>
              </select>

              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-risda-muted" />
                <input
                  type="text"
                  placeholder="Cari Kod Utama / Perihal..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-risda-orange transition-all placeholder:text-white/30"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-risda-orange to-risda-gold hover:from-risda-orange/90 hover:to-risda-gold/90 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all print:hidden"
              >
                <FileText size={15} /> JANA LAPORAN TERPERINCI
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPDF()}
                disabled={!isReportGenerated || isDownloadingPdf}
                className={`flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-500 hover:from-amber-500 hover:to-yellow-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all print:hidden ${!isReportGenerated || isDownloadingPdf ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                title="Muat Turun PDF Berformat Rasmi RISDA"
              >
                {isDownloadingPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                DOWNLOAD PDF
              </button>
            </div>
          </div>

          {/* Body Content */}
          {loading ? (
            <div className="bg-risda-card/80 border border-white/10 rounded-3xl p-12 text-center text-risda-muted font-bold animate-pulse">
              MEMUATKAN LAPORAN PERUNTUKAN TERPERINCI...
            </div>
          ) : !isReportGenerated ? (
            /* EMPTY INITIAL STATE UNTIL GENERATED */
            <div className="bg-risda-card/80 border border-white/10 rounded-3xl p-12 text-center space-y-5 print:hidden shadow-xl">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-risda-orange/20 to-risda-gold/20 border border-risda-orange/40 flex items-center justify-center mx-auto text-risda-gold shadow-xl">
                <FileText size={32} />
              </div>
              <div className="space-y-2 max-w-lg mx-auto">
                <h3 className="text-lg font-black text-white uppercase tracking-wide">
                  LAPORAN PERUNTUKAN TERPERINCI BELUM DIJANA
                </h3>
                <p className="text-xs text-risda-muted leading-relaxed">
                  Sila tekan butang <span className="text-risda-orange font-black font-mono">"JANA LAPORAN TERPERINCI"</span> di atas untuk memilih Kod Peruntukan dan Julat Tarikh (Tarikh Awal ke Tarikh Akhir) laporan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateModal(true)}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-risda-orange to-risda-gold text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-[0_10px_25px_rgba(0,176,255,0.3)] hover:scale-105 active:scale-95 transition-all"
              >
                <FileText size={16} /> JANA LAPORAN TERPERINCI
              </button>
            </div>
          ) : (() => {
            const generatedCodes = codes.filter(c => {
              const matchesYear = (c.year || '2026') === selectedYearFilter;
              const matchesCode = !activeReportCriteria || activeReportCriteria.codeId === 'SEMUA' || c.id === activeReportCriteria.codeId || c.akt === activeReportCriteria.codeId;
              const q = searchTerm.toLowerCase();
              const matchesSearch = !q || (c.akt && c.akt.toLowerCase().includes(q)) ||
                                    (c.obj && c.obj.toLowerCase().includes(q)) ||
                                    (c.perihal && c.perihal.toLowerCase().includes(q));
              return matchesYear && matchesCode && matchesSearch;
            });

            if (generatedCodes.length === 0) {
              return (
                <div className="bg-risda-card/80 border border-white/10 rounded-3xl p-12 text-center text-risda-muted font-bold space-y-4">
                  <p>Tiada rekod Kod Peruntukan dipadankan dengan carian/pilihan bagi tahun {selectedYearFilter}.</p>
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(true)}
                    className="px-5 py-2.5 bg-risda-orange/20 text-risda-orange border border-risda-orange/40 rounded-xl text-xs font-bold uppercase hover:bg-risda-orange/30 transition-all inline-flex items-center gap-2"
                  >
                    <RefreshCw size={14} /> Tukar Pilihan Laporan
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {/* Active Criteria Summary Banner */}
                <div className="bg-risda-card/90 border border-risda-orange/30 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-white shadow-xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-risda-muted font-bold uppercase">PILIHAN KOD:</span>
                    <span className="px-3 py-1 bg-risda-orange/20 text-risda-orange border border-risda-orange/40 rounded-xl font-black uppercase">
                      {activeReportCriteria?.codeId === 'SEMUA' 
                        ? 'SEMUA KOD PERUNTUKAN' 
                        : (codes.find(c => c.id === activeReportCriteria?.codeId || c.akt === activeReportCriteria?.codeId)?.akt 
                           ? `${codes.find(c => c.id === activeReportCriteria?.codeId || c.akt === activeReportCriteria?.codeId)?.akt} - ${codes.find(c => c.id === activeReportCriteria?.codeId || c.akt === activeReportCriteria?.codeId)?.perihal}`
                           : activeReportCriteria?.codeId)}
                    </span>

                    <span className="text-risda-muted font-bold uppercase ml-2">JULAT TARIKH:</span>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl font-black">
                      {activeReportCriteria?.startDate ? formatDateDMY(activeReportCriteria.startDate) : 'TARIKH AWAL'} ➔ {activeReportCriteria?.endDate ? formatDateDMY(activeReportCriteria.endDate) : 'TARIKH AKHIR'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 print:hidden">
                    <button
                      type="button"
                      onClick={() => handleDownloadPDF()}
                      disabled={isDownloadingPdf}
                      className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-[11px] font-black uppercase flex items-center gap-1.5 transition-all hover:scale-105 shadow-sm"
                    >
                      {isDownloadingPdf ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      MUAT TURUN PDF (SEMUA)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGenerateModal(true)}
                      className="text-[11px] text-risda-gold hover:text-white underline font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw size={13} /> TUKAR PILIHAN / JANA SEMULA
                    </button>
                  </div>
                </div>

                {/* Report Cards */}
                {generatedCodes.map((item, idx) => {
                  const detailedRows = buildDetailedRowsForCode(item, activeReportCriteria?.startDate, activeReportCriteria?.endDate);

                  return (
                    <div
                      key={item.id || idx}
                      className="bg-risda-card/90 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 overflow-hidden relative print:bg-white print:text-black print:border-black print:shadow-none"
                    >
                      <div className="absolute top-0 right-0 w-64 h-64 bg-risda-orange/5 rounded-full blur-3xl pointer-events-none print:hidden" />

                      {/* Header Info Block */}
                      <div className="border-b border-white/10 pb-4 space-y-2 font-mono text-xs text-white print:text-black print:border-gray-300">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="text-risda-muted font-bold uppercase min-w-[90px] print:text-gray-600">KOD PA:</span>
                              <button
                                type="button"
                                onClick={() => handleOpenSubCodeModal(item, 'AKT')}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-risda-orange/20 hover:bg-risda-orange/40 border border-risda-orange/50 text-risda-orange rounded-xl font-black text-xs transition-all hover:scale-105 print:hidden shadow-md"
                                title="Lihat Terperinci Sub-Kod Kecil"
                              >
                                <span>{item.akt}</span>
                                <ListFilter size={12} />
                              </button>
                              <span className="text-risda-orange font-black text-sm hidden print:inline">{item.akt}</span>
                              <span className="text-white font-bold uppercase print:text-black">{item.perihal}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="text-risda-muted font-bold uppercase min-w-[90px] print:text-gray-600">KOD OBJEK :</span>
                              <button
                                type="button"
                                onClick={() => handleOpenSubCodeModal(item, 'OBJ')}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-risda-gold/20 hover:bg-risda-gold/40 border border-risda-gold/50 text-risda-gold rounded-xl font-black text-xs transition-all hover:scale-105 print:hidden shadow-md"
                                title="Lihat Terperinci Sub-Kod Kecil"
                              >
                                <span>{item.obj}</span>
                                <ListFilter size={12} />
                              </button>
                              <span className="text-risda-gold font-black text-sm hidden print:inline">{item.obj}</span>
                              <span className="text-white/80 font-bold uppercase print:text-black">{item.objPerihal || 'SUBSIDI KEPADA PEKEBUN KECIL'}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-black/50 p-3 rounded-2xl border border-white/10 text-right print:bg-gray-100 print:border-gray-300">
                            <div>
                              <div className="text-[9px] text-risda-muted font-black uppercase print:text-gray-600">NILAI PERUNTUKAN DITERIMA</div>
                              <div className="text-sm font-black text-risda-gold font-mono print:text-black">RM {formatRM(item.jumlahDiterima)}</div>
                            </div>
                            <div>
                              <div className="text-[9px] text-risda-muted font-black uppercase print:text-gray-600">BLK</div>
                              <div className="text-sm font-black text-white font-mono print:text-black">RM {formatRM(item.peruntukanBlk)}</div>
                            </div>
                            <div>
                              <div className="text-[9px] text-risda-muted font-black uppercase print:text-gray-600">NKEA/PEND KWR</div>
                              <div className="text-sm font-black text-white font-mono print:text-black">RM {formatRM(item.nkeaKwr)}</div>
                            </div>
                            <div className="pl-2 border-l border-white/10 print:hidden">
                              <button
                                type="button"
                                onClick={() => handleDownloadPDF(item)}
                                disabled={isDownloadingPdf}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/40 text-amber-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all hover:scale-105 shadow-sm"
                                title={`Muat Turun PDF Kod ${item.akt}`}
                              >
                                <Download size={11} /> PDF KOD INI
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Info Badge */}
                      <div className="text-[10px] text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl flex items-center justify-between gap-2 print:hidden">
                        <span>ℹ️ <strong>Rujukan Kakitangan:</strong> Laporan Terperinci memaparkan pecahan Sub-Kod Kecil (Kod PA/Objek) berserta Perihal Item Detail secara langsung dari Pesanan Tempatan.</span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200 text-[9px] uppercase font-mono font-black">Pesanan Tempatan & e-Kewangan</span>
                      </div>

                      {/* Detailed Accounting Table */}
                      <div className="overflow-x-auto bg-black/40 rounded-2xl border border-white/10 print:bg-white print:border-black">
                        <table className="w-full text-left text-xs border-collapse min-w-[950px] print:text-black">
                          <thead>
                            {/* Header Row 1 */}
                            <tr className="border-b border-white/20 text-white font-black text-[10px] uppercase bg-black/70 print:bg-gray-200 print:text-black print:border-gray-400">
                              <th rowSpan={2} className="py-3 px-3 border-r border-white/10 align-middle w-24 text-center print:border-gray-300">TARIKH</th>
                              <th rowSpan={2} className="py-3 px-3 border-r border-white/10 align-middle w-20 text-center print:border-gray-300">KOD PA</th>
                              <th rowSpan={2} className="py-3 px-3 border-r border-white/10 align-middle w-24 text-center print:border-gray-300">KOD OBJEK</th>
                              <th rowSpan={2} className="py-3 px-3 border-r border-white/10 align-middle print:border-gray-300">PERIHAL ITEM / PESANAN</th>
                              <th colSpan={2} className="py-2 px-3 text-center border-r border-white/10 bg-amber-500/10 text-amber-300 print:bg-gray-100 print:text-black print:border-gray-300">MAKLUMAT PERTANGGUNGAN</th>
                              <th colSpan={2} className="py-2 px-3 text-center border-r border-white/10 bg-sky-500/10 text-sky-300 print:bg-gray-100 print:text-black print:border-gray-300">MAKLUMAT PERBELANJAAN</th>
                              <th colSpan={2} className="py-2 px-3 text-center bg-emerald-500/10 text-emerald-300 print:bg-gray-100 print:text-black">MAKLUMAT PERUNTUKAN</th>
                            </tr>
                            {/* Header Row 2 */}
                            <tr className="border-b border-white/20 text-white/80 font-black text-[9px] uppercase bg-black/50 print:bg-gray-50 print:text-black print:border-gray-400">
                              <th className="py-2 px-3 text-right border-r border-white/10 w-28 print:border-gray-300">NILAI</th>
                              <th className="py-2 px-3 text-right border-r border-white/10 w-28 print:border-gray-300">BAKI</th>
                              <th className="py-2 px-3 text-right border-r border-white/10 w-28 print:border-gray-300">NILAI</th>
                              <th className="py-2 px-3 text-right border-r border-white/10 w-28 print:border-gray-300">TERKUMPUL</th>
                              <th className="py-2 px-3 text-right border-r border-white/10 w-28 print:border-gray-300">NILAI</th>
                              <th className="py-2 px-3 text-right w-28">BAKI</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10 font-mono text-xs text-white/90 print:text-black print:divide-gray-300">
                            {detailedRows.map((r, rIdx) => (
                              <tr key={rIdx} className="hover:bg-white/5 transition-colors print:hover:bg-transparent">
                                <td className="py-2.5 px-3 border-r border-white/10 font-bold text-center font-mono text-emerald-300 text-[11px] print:text-black print:border-gray-300">{r.tarikh}</td>
                                <td className="py-2.5 px-3 border-r border-white/10 font-bold text-center text-risda-orange print:text-black print:border-gray-300">{r.kodPa}</td>
                                <td className="py-2.5 px-3 border-r border-white/10 font-bold text-center text-risda-gold print:text-black print:border-gray-300">{r.kodObjek}</td>
                                <td className="py-2.5 px-3 border-r border-white/10 font-sans font-semibold text-white/90 text-[11px] uppercase print:text-black print:border-gray-300">{r.perihal}</td>
                                <td className={`py-2.5 px-3 border-r border-white/10 text-right print:border-gray-300 ${r.pertanggunganNilai < 0 ? 'text-rose-400 font-bold' : r.pertanggunganNilai > 0 ? 'text-amber-300 font-bold' : 'text-white/40'}`}>
                                  {r.pertanggunganNilai !== 0 ? formatRM(r.pertanggunganNilai) : '0.00'}
                                </td>
                                <td className="py-2.5 px-3 border-r border-white/10 text-right text-amber-200 print:text-black print:border-gray-300">{formatRM(r.pertanggunganBaki)}</td>
                                <td className={`py-2.5 px-3 border-r border-white/10 text-right print:border-gray-300 ${r.perbelanjaanNilai > 0 ? 'text-sky-300 font-bold' : 'text-white/40'}`}>
                                  {r.perbelanjaanNilai !== 0 ? formatRM(r.perbelanjaanNilai) : '0.00'}
                                </td>
                                <td className="py-2.5 px-3 border-r border-white/10 text-right text-sky-200 print:text-black print:border-gray-300">{formatRM(r.perbelanjaanTerkumpul)}</td>
                                <td className={`py-2.5 px-3 border-r border-white/10 text-right print:border-gray-300 ${r.peruntukanNilai !== 0 ? 'text-risda-gold font-bold' : 'text-white/40'}`}>
                                  {r.peruntukanNilai !== 0 ? formatRM(r.peruntukanNilai) : '0.00'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-black text-emerald-400 print:text-black">{formatRM(r.peruntukanBaki)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal: TAMBAH / KEMASKINI PERUNTUKAN */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-risda-card border border-white/10 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <h2 className="text-xl font-black text-white uppercase tracking-tight">
                {editingId ? 'Kemaskini Peruntukan' : 'Tambah / Kemaskini Peruntukan'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl bg-white/5 text-risda-muted hover:text-white"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl mb-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <p className="text-[10px] text-risda-gold font-black uppercase tracking-wider">
                    Bentuk Kod Akaun
                  </p>
                  <span className="text-[9px] text-emerald-400 font-bold">
                    Pilihan Pantas Kod Standard
                  </span>
                </div>

                {/* Preset Dropdown to Auto-populate Kod Aktiviti & Objek */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-emerald-300 mb-1">
                    Pilih Kod Sedia Ada / Template RISDA:
                  </label>
                  <select
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      const [a, o, ...p] = val.split('|');
                      setFormData({
                        ...formData,
                        akt: a || '',
                        obj: o || '',
                        perihal: p.join('|') || ''
                      });
                    }}
                    className="w-full px-4 py-2.5 bg-black/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-bold focus:outline-none focus:border-risda-orange cursor-pointer"
                    defaultValue=""
                  >
                    <option value="">-- PILIH KOD TEMPLATE SEDIA ADA (AUTOMATIK) --</option>
                    <option value="031400|R4400000|PRASARANA ASAS PERTANIAN (PAP)">
                      031400 / R4400000 - PRASARANA ASAS PERTANIAN (PAP)
                    </option>
                    <option value="021100|R2110000|PEMBELIAN PERALATAN & KELENGKAPAN PEJABAT">
                      021100 / R2110000 - PEMBELIAN PERALATAN & KELENGKAPAN PEJABAT
                    </option>
                    <option value="010200|R1120000|PENYELENGGARAAN BANGUNAN & KENDERAAN">
                      010200 / R1120000 - PENYELENGGARAAN BANGUNAN & KENDERAAN
                    </option>
                    <option value="021100|B2100000|PENYELENGGARAAN PRASARANA JALAN LADANG">
                      021100 / B2100000 - PENYELENGGARAAN PRASARANA JALAN LADANG
                    </option>
                    <option value="011200|K1100000|BANTUAN BAJA DAN BENIH TANAM SEMULA">
                      011200 / K1100000 - BANTUAN BAJA DAN BENIH TANAM SEMULA
                    </option>
                  </select>
                  <span className="text-[9px] text-risda-muted block mt-1">
                    * Memilih daripada senarai di atas akan mengisi automatik Kod Aktiviti, Kod Objek, dan Perihal.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-risda-muted mb-1">
                      AKT (Kod Aktiviti)
                    </label>
                    <input
                      type="text"
                      value={formData.akt}
                      onChange={(e) => setFormData({ ...formData, akt: e.target.value })}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-risda-orange uppercase"
                      placeholder="031400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-risda-muted mb-1">
                      OBJ (Kod Objek)
                    </label>
                    <input
                      type="text"
                      value={formData.obj}
                      onChange={(e) => setFormData({ ...formData, obj: e.target.value })}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-risda-orange uppercase"
                      placeholder="R4400000"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-risda-muted mb-1">
                    PERIHAL (Nama Peruntukan / Program)
                  </label>
                  <input
                    type="text"
                    value={formData.perihal}
                    onChange={(e) => setFormData({ ...formData, perihal: e.target.value })}
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-risda-orange uppercase"
                    placeholder="PRASARANA ASAS PERTANIAN (PAP)"
                    required
                  />
                </div>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                <p className="text-[10px] text-emerald-400 font-black uppercase tracking-wider">
                  Agihan & Perbelanjaan Bajet (RM)
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-risda-muted mb-1">
                      NKEA / PEND. KWR (RM)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.nkeaKwr}
                      onChange={(e) => setFormData({ ...formData, nkeaKwr: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-risda-orange"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-risda-muted mb-1">
                      PERUNTUKAN BLK (RM)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.peruntukanBlk}
                      onChange={(e) => setFormData({ ...formData, peruntukanBlk: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-risda-orange"
                    />
                  </div>
                </div>

                <div className="p-3 bg-risda-gold/10 border border-risda-gold/30 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-bold text-risda-gold uppercase">JUMLAH PERUNTUKAN DITERIMA:</span>
                  <span className="font-mono font-black text-white">
                    RM {formatRM((Number(formData.nkeaKwr) || 0) + (Number(formData.peruntukanBlk) || 0))}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-amber-300 mb-1">
                      PERTANGGUNGAN BELUM DIJELASKAN (RM)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.pertanggunganBelumDijelaskan}
                      onChange={(e) => setFormData({ ...formData, pertanggunganBelumDijelaskan: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-risda-orange"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-sky-300 mb-1">
                      JUMLAH PERBELANJAAN DILAKUKAN (RM)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.jumlahPerbelanjaan}
                      onChange={(e) => setFormData({ ...formData, jumlahPerbelanjaan: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-risda-orange"
                    />
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-400 uppercase">BAKI PERUNTUKAN BERSIH:</span>
                  <span className="font-mono font-black text-emerald-300">
                    RM {formatRM(((Number(formData.nkeaKwr) || 0) + (Number(formData.peruntukanBlk) || 0)) - (Number(formData.pertanggunganBelumDijelaskan) || 0) - (Number(formData.jumlahPerbelanjaan) || 0))}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                    Tarikh Peruntukan Diterima
                  </label>
                  <input
                    type="date"
                    value={formData.tarikhDiterima || ''}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      const extractedYear = newDate ? newDate.split('-')[0] : formData.year;
                      setFormData({
                        ...formData,
                        tarikhDiterima: newDate,
                        year: extractedYear || formData.year
                      });
                    }}
                    className="w-full px-4 py-2.5 bg-black/80 border border-emerald-500/50 rounded-xl text-emerald-300 font-mono font-bold text-xs focus:outline-none focus:border-risda-orange cursor-pointer"
                  />
                  <span className="text-[9px] text-risda-muted block mt-1">
                    * Boleh diubah mengikut bila peruntukan diterima
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                    Tahun Kewangan
                  </label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-4 py-2.5 bg-black/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-bold focus:outline-none focus:border-risda-orange cursor-pointer"
                  >
                    <option value="2025">Tahun 2025</option>
                    <option value="2026">Tahun 2026</option>
                    <option value="2027">Tahun 2027</option>
                    <option value="2028">Tahun 2028</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-risda-gold mb-1">
                    Status Vot
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-risda-orange"
                  >
                    <option value="AKTIF">AKTIF</option>
                    <option value="TIDAK AKTIF">TIDAK AKTIF</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-white/5 text-white font-bold text-xs uppercase rounded-xl hover:bg-white/10"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-risda-orange to-risda-gold text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg hover:scale-105 active:scale-95"
                >
                  Simpan Peruntukan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: JANA LAPORAN PERUNTUKAN TERPERINCI */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-risda-card border border-white/10 rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl relative space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-risda-orange/20 border border-risda-orange/40 rounded-2xl text-risda-orange">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-tight">
                    Jana Laporan Peruntukan Terperinci
                  </h2>
                  <p className="text-[11px] text-risda-muted">
                    Pilih Kod Peruntukan dan Tempoh Tarikh untuk Menjana Laporan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="p-2 rounded-xl bg-white/5 text-risda-muted hover:text-white transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans">
              {/* Dropdown Kod Peruntukan */}
              <div>
                <label className="block text-[10px] font-black uppercase text-risda-gold tracking-wider mb-1.5">
                  PILIH KOD PERUNTUKAN
                </label>
                <select
                  value={reportGenParams.codeId}
                  onChange={(e) => setReportGenParams({ ...reportGenParams, codeId: e.target.value })}
                  className="w-full px-4 py-3 bg-black/80 border border-white/20 rounded-xl text-white font-bold focus:outline-none focus:border-risda-orange cursor-pointer"
                >
                  <option value="SEMUA">-- SEMUA KOD PERUNTUKAN ({selectedYearFilter}) --</option>
                  {codes
                    .filter(c => (c.year || '2026') === selectedYearFilter)
                    .map((c) => (
                      <option key={c.id || c.akt} value={c.id || c.akt}>
                        KOD PA: {c.akt} | OBJEK: {c.obj} - {c.perihal}
                      </option>
                    ))}
                </select>
              </div>

              {/* Date inputs: Tarikh Awal ke Tarikh Akhir */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-emerald-300 tracking-wider mb-1.5">
                    TARIKH AWAL (MULA)
                  </label>
                  <input
                    type="date"
                    value={reportGenParams.startDate}
                    onChange={(e) => setReportGenParams({ ...reportGenParams, startDate: e.target.value })}
                    className="w-full px-4 py-3 bg-black/80 border border-white/20 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-risda-orange"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-sky-300 tracking-wider mb-1.5">
                    TARIKH AKHIR
                  </label>
                  <input
                    type="date"
                    value={reportGenParams.endDate}
                    onChange={(e) => setReportGenParams({ ...reportGenParams, endDate: e.target.value })}
                    className="w-full px-4 py-3 bg-black/80 border border-white/20 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-risda-orange"
                  />
                </div>
              </div>

              <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-[11px] text-risda-muted leading-relaxed">
                <span className="text-risda-gold font-bold">Nota:</span> Jika tarikh dibiarkan kosong, laporan akan menjana semua rekod bagi tahun kewangan <span className="text-white font-bold">{selectedYearFilter}</span>.
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2.5 bg-white/5 text-white font-bold text-xs uppercase rounded-xl hover:bg-white/10 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveReportCriteria({
                    codeId: reportGenParams.codeId,
                    startDate: reportGenParams.startDate,
                    endDate: reportGenParams.endDate
                  });
                  setIsReportGenerated(true);
                  setShowGenerateModal(false);
                  toast.success('Laporan Peruntukan Terperinci berjaya dijana!');
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-risda-orange to-risda-gold text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <FileText size={15} /> Jana Paparan Laporan
              </button>
              <button
                type="button"
                onClick={async () => {
                  const criteria = {
                    codeId: reportGenParams.codeId,
                    startDate: reportGenParams.startDate,
                    endDate: reportGenParams.endDate
                  };
                  setActiveReportCriteria(criteria);
                  setIsReportGenerated(true);
                  setShowGenerateModal(false);
                  
                  // Trigger PDF download immediately
                  setTimeout(() => {
                    handleDownloadPDF();
                  }, 100);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <Download size={15} /> Jana & Muat Turun PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup: MAKLUMAT TERPERINCI KOD & SUB-KOD KECIL */}
      {showSubCodeModal && selectedSubCodeItem && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-risda-card border border-white/20 rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-[0_0_50px_rgba(0,0,0,0.8)] relative max-h-[92vh] overflow-y-auto space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl border ${subCodeModalType === 'AKT' ? 'bg-risda-orange/20 border-risda-orange/40 text-risda-orange' : 'bg-risda-gold/20 border-risda-gold/40 text-risda-gold'}`}>
                  <ListFilter size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-white/10 text-risda-gold">
                      {subCodeModalType === 'AKT' ? 'MAKLUMAT KOD AKTIVITI' : 'MAKLUMAT KOD OBJEK'}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      TAHUN {selectedSubCodeItem.year || selectedYearFilter}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight mt-1 flex items-center gap-2">
                    <span>Terperinci Sub-Kod Kecil:</span>
                    <span className={subCodeModalType === 'AKT' ? 'text-risda-orange font-mono font-black' : 'text-risda-gold font-mono font-black'}>
                      {subCodeModalType === 'AKT' ? selectedSubCodeItem.akt : selectedSubCodeItem.obj}
                    </span>
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSubCodeModal(false)}
                className="p-2.5 rounded-xl bg-white/5 text-risda-muted hover:text-white hover:bg-white/10 transition-colors"
              >
                <XCircle size={22} />
              </button>
            </div>

            {/* Parent Code Overview Card */}
            <div className="bg-black/60 border border-white/10 rounded-2xl p-4 space-y-3 font-mono text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-white/10 pb-3">
                <div>
                  <span className="text-[9px] text-risda-muted font-bold block uppercase">KOD AKTIVITI (AKT):</span>
                  <span className="text-sm font-black text-risda-orange">{selectedSubCodeItem.akt}</span>
                </div>
                <div>
                  <span className="text-[9px] text-risda-muted font-bold block uppercase">KOD OBJEK (OBJ):</span>
                  <span className="text-sm font-black text-risda-gold">{selectedSubCodeItem.obj}</span>
                </div>
                <div>
                  <span className="text-[9px] text-risda-muted font-bold block uppercase">PERIHAL KOD UTAMA:</span>
                  <span className="text-xs font-bold text-white uppercase">{selectedSubCodeItem.perihal}</span>
                </div>
              </div>

              {/* Financial Ringkasan */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-right">
                <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[9px] text-risda-muted block font-black uppercase">PERUNTUKAN DITERIMA</span>
                  <span className="text-sm font-black text-risda-gold">RM {formatRM(selectedSubCodeItem.jumlahDiterima)}</span>
                </div>
                <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                  <span className="text-[9px] text-amber-300 block font-black uppercase">PERTANGGUNGAN</span>
                  <span className="text-sm font-black text-amber-300">RM {formatRM(selectedSubCodeItem.pertanggunganBelumDijelaskan)}</span>
                </div>
                <div className="bg-sky-500/10 p-2.5 rounded-xl border border-sky-500/20">
                  <span className="text-[9px] text-sky-300 block font-black uppercase">PERBELANJAAN</span>
                  <span className="text-sm font-black text-sky-300">RM {formatRM(selectedSubCodeItem.jumlahPerbelanjaan)}</span>
                </div>
                <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                  <span className="text-[9px] text-emerald-300 block font-black uppercase">BAKI PERUNTUKAN</span>
                  <span className="text-sm font-black text-emerald-400">RM {formatRM(selectedSubCodeItem.bakiPeruntukan)}</span>
                </div>
              </div>
            </div>

            {/* Sub-Codes Table Section */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Tag size={16} className="text-risda-gold" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Senarai Pecahan Sub-Kod Kecil ({activeSubCodes.length} Rekod)
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {activeSubCodes.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllSubCodes}
                      className="px-3.5 py-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold hover:bg-rose-500/30 transition-all flex items-center gap-1.5"
                    >
                      <Trash2 size={13} /> Kosongkan Semua Sub-Kod
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAutoFillPreviousYearSubCodes}
                    className="px-3.5 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold hover:bg-emerald-500/30 transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw size={13} /> Auto-Isi Rekod Tahun Sebelum Ini
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto bg-black/50 border border-white/10 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-white/20 text-white font-black text-[10px] uppercase bg-black/70">
                      <th className="py-3 px-3 border-r border-white/10 text-center w-48">KOD SUB KECIL</th>
                      <th className="py-3 px-3 border-r border-white/10">PERIHAL SUB-KOD KECIL</th>
                      <th className="py-3 px-3 text-center w-16">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 font-mono text-xs">
                    {activeSubCodes.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-risda-muted font-bold font-sans">
                          Tiada pecahan sub-kod kecil ditemui. Sila tambah sub-kod baru di bawah.
                        </td>
                      </tr>
                    ) : (
                      activeSubCodes.map((sc, idx) => (
                        <tr key={sc.id || idx} className="hover:bg-white/5 transition-colors">
                          <td className="py-2 px-3 border-r border-white/10 text-center">
                            <input
                              type="text"
                              value={sc.subCode}
                              onChange={(e) => handleUpdateSubCodeInTable(idx, 'subCode', e.target.value)}
                              placeholder="cth: R4419900"
                              className="w-full bg-black/80 border border-white/20 rounded-lg px-2.5 py-1.5 text-risda-orange font-mono font-bold text-xs uppercase text-center focus:outline-none focus:border-risda-gold"
                            />
                          </td>
                          <td className="py-2 px-3 border-r border-white/10">
                            <input
                              type="text"
                              value={sc.perihal}
                              onChange={(e) => handleUpdateSubCodeInTable(idx, 'perihal', e.target.value)}
                              placeholder="Perihal Sub-Kod"
                              className="w-full bg-black/80 border border-white/20 rounded-lg px-2.5 py-1.5 text-white font-sans font-semibold text-xs uppercase focus:outline-none focus:border-risda-gold"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteSubCode(idx)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-risda-muted hover:text-rose-400 transition-colors"
                              title="Padam sub-kod"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inline Form to Add New Sub-Code */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                <Plus size={16} className="text-risda-orange" />
                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                  Tambah Sub-Kod Kecil Baru
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-sans">
                <div>
                  <label className="block text-[9px] font-black uppercase text-risda-muted mb-1">
                    KOD SUB KECIL (KOD PENUH)
                  </label>
                  <input
                    type="text"
                    value={newSubCodeForm.subCode}
                    onChange={(e) => setNewSubCodeForm({ ...newSubCodeForm, subCode: e.target.value })}
                    placeholder={subCodeModalType === 'AKT' ? 'cth: 031401, 031402' : 'cth: R4419900, R4421000'}
                    className="w-full px-3 py-2 bg-black/80 border border-white/20 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-risda-orange uppercase"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-black uppercase text-risda-muted mb-1">
                    PERIHAL SUB-KOD KECIL
                  </label>
                  <input
                    type="text"
                    value={newSubCodeForm.perihal}
                    onChange={(e) => setNewSubCodeForm({ ...newSubCodeForm, perihal: e.target.value })}
                    placeholder="cth: BEKALAN MATERIAL UTAMA / SALIRAN / JENTERA"
                    className="w-full px-3 py-2 bg-black/80 border border-white/20 rounded-xl text-white font-bold focus:outline-none focus:border-risda-orange uppercase"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleAddSubCode}
                  className="px-5 py-2 bg-gradient-to-r from-risda-orange to-risda-gold text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Plus size={14} /> Tambah Sub-Kod Kecil
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowSubCodeModal(false)}
                className="px-5 py-2.5 bg-white/5 text-white font-bold text-xs uppercase rounded-xl hover:bg-white/10 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveSubCodes}
                className="px-7 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <CheckCircle2 size={16} /> Simpan Perubahan Sub-Kod
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
