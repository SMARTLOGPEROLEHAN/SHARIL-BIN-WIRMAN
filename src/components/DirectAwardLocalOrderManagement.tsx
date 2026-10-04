import React, { useState, useMemo } from 'react';
import { 
  FileCheck, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  Printer, 
  Send, 
  DollarSign, 
  Building2, 
  Coins, 
  Sparkles, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  X, 
  FileText, 
  Check, 
  Package, 
  Briefcase, 
  Hammer, 
  ShieldCheck, 
  Calendar, 
  UserCheck, 
  Layers, 
  ExternalLink,
  Trash2,
  Edit2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_DIRECT_AWARD_VOT_CODES } from './DirectAwardBudgetBook';

export interface LocalOrderItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface DirectAwardLOData {
  id: string;
  orderNo: string; // No Permohonan Rujukan (e.g. TP-2026-00125)
  poNo: string; // No PO 10 Digit (e.g. 2645070125)
  title: string;
  category: 'BEKALAN' | 'PERKHIDMATAN' | 'KERJA';
  supplierName: string;
  supplierCode: string;
  supplierAddress?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  allocationCode: string;
  amount: number;
  requestDate: string;
  approvedDate?: string;
  loGeneratedDate: string;
  unitOffice: string;
  status: 'LULUS' | 'MENUNGGU KELULUSAN' | 'DIBAYAR' | 'BATAL';
  financeStatus: 'BELUM DIHANTAR' | 'DIHANTAR' | 'DIBAYAR';
  financeReferenceNo?: string;
  noBaucar?: string;
  tarikhDibayar?: string;
  items: LocalOrderItem[];
  perihalPerolehan?: string;
  justification?: string;
  disediakanOleh: {
    nama: string;
    jawatan: string;
    tarikh: string;
  };
  disemakOleh: {
    nama: string;
    jawatan: string;
    tarikh: string;
  };
  diluluskanOleh: {
    nama: string;
    jawatan: string;
    tarikh: string;
  };
}

interface DirectAwardLocalOrderManagementProps {
  records: any[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onUpdateRecord?: (recordId: string, updates: any) => void;
  onCreateRecord?: (newRec: any) => void;
  isOpenGenerateModal?: boolean;
  onCloseGenerateModal?: () => void;
  onNavigateToLaporan?: () => void;
}

export default function DirectAwardLocalOrderManagement({
  records = [],
  activeTab = 'jana',
  onTabChange,
  onUpdateRecord,
  onCreateRecord,
  isOpenGenerateModal,
  onCloseGenerateModal,
  onNavigateToLaporan
}: DirectAwardLocalOrderManagementProps) {
  const { user, district, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'pentadbir';

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'SEMUA' | 'BEKALAN' | 'PERKHIDMATAN' | 'KERJA'>('SEMUA');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('SEMUA');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Modals
  const [localShowGenerateModal, setLocalShowGenerateModal] = useState(false);
  const showGenerateModal = isOpenGenerateModal !== undefined ? isOpenGenerateModal : localShowGenerateModal;
  const setShowGenerateModal = (val: boolean) => {
    setLocalShowGenerateModal(val);
    if (!val && onCloseGenerateModal) onCloseGenerateModal();
  };
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DirectAwardLOData | null>(null);

  // Quick Selection state for Modal
  const [selectedPermohonanId, setSelectedPermohonanId] = useState<string>('');

  // Payment Confirmation Form
  const [voucherNo, setVoucherNo] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Form state for generating LO
  const [formData, setFormData] = useState<{
    referenceOrderNo: string;
    poNo: string;
    title: string;
    category: 'BEKALAN' | 'PERKHIDMATAN' | 'KERJA';
    supplierName: string;
    supplierCode: string;
    supplierAddress: string;
    supplierPhone: string;
    supplierEmail: string;
    allocationCode: string;
    amount: number;
    requestDate: string;
    unitOffice: string;
    perihalPerolehan: string;
    items: LocalOrderItem[];
    disediakanNama: string;
    disediakanJawatan: string;
    disediakanTarikh: string;
    disemakNama: string;
    disemakJawatan: string;
    disemakTarikh: string;
    diluluskanNama: string;
    diluluskanJawatan: string;
    diluluskanTarikh: string;
  }>({
    referenceOrderNo: '',
    poNo: '',
    title: '',
    category: 'BEKALAN',
    supplierName: '',
    supplierCode: '',
    supplierAddress: '',
    supplierPhone: '',
    supplierEmail: '',
    allocationCode: 'B62-020101-1002',
    amount: 0,
    requestDate: new Date().toISOString().split('T')[0],
    unitOffice: district ? `Pejabat RISDA Daerah ${district}` : 'Pejabat RISDA Daerah Beaufort',
    perihalPerolehan: '',
    items: [
      { id: 'item-1', description: '', quantity: 1, unit: 'Unit', unitPrice: 0, totalPrice: 0 }
    ],
    disediakanNama: user?.name || 'Ahmad Faizal bin Sulaiman',
    disediakanJawatan: 'Penolong Pegawai Ehwal Ekonomi',
    disediakanTarikh: new Date().toISOString().split('T')[0],
    disemakNama: 'Siti Rohani binti Mat Said',
    disemakJawatan: 'Pegawai Penyemak Perolehan',
    disemakTarikh: new Date().toISOString().split('T')[0],
    diluluskanNama: 'Hj. Ismail bin Baharom',
    diluluskanJawatan: 'Pegawai Daerah RISDA (Ketua PTJ)',
    diluluskanTarikh: new Date().toISOString().split('T')[0]
  });

  // Transform records into LO items for display
  const localOrders: DirectAwardLOData[] = useMemo(() => {
    return records.map((r, index) => {
      const isApprovedOrDone = r.status === 'SELESAI' || r.status === 'LULUS' || r.status === 'DIBAYAR' || !!r.poNo;
      const poNum = r.poNo || (isApprovedOrDone ? `264507${String(1000 + index * 37).padStart(4, '0')}` : '');
      
      const defaultItems: LocalOrderItem[] = (r.items && r.items.length > 0) 
        ? r.items.map((it: any, idx: number) => ({
            id: `item-${idx}`,
            description: it.name || it.description || r.title,
            quantity: it.qty || it.quantity || 1,
            unit: it.unit || 'Unit / Lot',
            unitPrice: it.unitPrice || (r.estimatedAmount / (it.qty || 1)),
            totalPrice: it.total || it.totalPrice || r.estimatedAmount
          }))
        : [
            {
              id: 'item-0',
              description: r.title,
              quantity: 1,
              unit: 'Pakej / Lot',
              unitPrice: Number(r.estimatedAmount) || 0,
              totalPrice: Number(r.estimatedAmount) || 0
            }
          ];

      return {
        id: r.id,
        orderNo: r.orderNo,
        poNo: poNum,
        title: r.title,
        category: r.category || 'BEKALAN',
        supplierName: r.supplierName || 'ABC ENTERPRISE',
        supplierCode: r.supplierCode || (r.category === 'KERJA' ? 'CIDB G1' : 'MOF 010101'),
        supplierAddress: r.supplierAddress || 'Kawasan Perindustrian Beaufort, 89808 Beaufort, Sabah',
        supplierPhone: r.supplierPhone || '087-211456 / 019-8233441',
        supplierEmail: r.supplierEmail || 'pembekal.berdaftar@gmail.com',
        allocationCode: r.allocationCode || 'B62-020101-1002',
        amount: Number(r.estimatedAmount) || 0,
        requestDate: r.requestDate || '2026-10-02',
        approvedDate: r.approvedDate || r.requestDate || '2026-10-02',
        loGeneratedDate: r.loGeneratedDate || r.requestDate || '2026-10-02',
        unitOffice: r.unitOffice || `Pejabat RISDA Daerah ${district || 'Beaufort'}`,
        status: (r.status === 'DIBAYAR' ? 'DIBAYAR' : (isApprovedOrDone ? 'LULUS' : 'MENUNGGU KELULUSAN')) as any,
        financeStatus: r.financeStatus || (r.status === 'DIBAYAR' ? 'DIBAYAR' : 'BELUM DIHANTAR'),
        financeReferenceNo: r.financeReferenceNo || `FIN-RISDA-${r.orderNo}`,
        noBaucar: r.noBaucar,
        tarikhDibayar: r.tarikhDibayar,
        items: defaultItems,
        perihalPerolehan: r.perihalPerolehan || 'Perolehan tawaran terus jabatan mengikut tatacara 1PP PK 2.',
        justification: r.justification || 'Telah dinilai berasaskan kajian pasaran 3 pembekal mematuhi spesifikasi dan harga terendah.',
        disediakanOleh: {
          nama: r.disediakanNama || 'Ahmad Faizal bin Sulaiman',
          jawatan: 'Penolong Pegawai Ehwal Ekonomi',
          tarikh: r.requestDate || '2026-10-02'
        },
        disemakOleh: {
          nama: r.disemakNama || 'Siti Rohani binti Mat Said',
          jawatan: 'Pegawai Penyemak Perolehan',
          tarikh: r.requestDate || '2026-10-02'
        },
        diluluskanOleh: {
          nama: r.approvedBy || 'Hj. Ismail bin Baharom',
          jawatan: 'Pegawai Daerah RISDA (Ketua PTJ)',
          tarikh: r.approvedDate || r.requestDate || '2026-10-02'
        }
      };
    });
  }, [records, district]);

  // Permohonan list available for quick selection (all applications made)
  const availablePermohonan = useMemo(() => {
    return records.map(r => ({
      id: r.id,
      orderNo: r.orderNo,
      title: r.title,
      category: r.category,
      supplierName: r.supplierName,
      supplierCode: r.supplierCode,
      estimatedAmount: r.estimatedAmount,
      allocationCode: r.allocationCode,
      status: r.status,
      items: r.items,
      perihalPerolehan: r.perihalPerolehan
    }));
  }, [records]);

  // Filter local orders based on tab, category, search, status
  const filteredOrders = useMemo(() => {
    return localOrders.filter(order => {
      // Sub-tab filter
      if (activeTab === 'dikeluarkan') {
        if (!order.poNo || order.status !== 'LULUS') return false;
      } else if (activeTab === 'kewangan') {
        if (order.financeStatus !== 'DIHANTAR' && order.financeStatus !== 'DIBAYAR') return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchNo = order.orderNo.toLowerCase().includes(query);
        const matchPo = order.poNo.toLowerCase().includes(query);
        const matchTitle = order.title.toLowerCase().includes(query);
        const matchSupplier = order.supplierName.toLowerCase().includes(query);
        if (!matchNo && !matchPo && !matchTitle && !matchSupplier) return false;
      }

      // Category filter
      if (selectedCategory !== 'SEMUA' && order.category !== selectedCategory) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'SEMUA') {
        if (selectedStatusFilter === 'LULUS' && order.status !== 'LULUS') return false;
        if (selectedStatusFilter === 'MENUNGGU KELULUSAN' && order.status !== 'MENUNGGU KELULUSAN') return false;
        if (selectedStatusFilter === 'DIHANTAR' && order.financeStatus !== 'DIHANTAR') return false;
        if (selectedStatusFilter === 'DIBAYAR' && order.financeStatus !== 'DIBAYAR') return false;
      }

      return true;
    });
  }, [localOrders, activeTab, searchTerm, selectedCategory, selectedStatusFilter]);

  // Toggle item breakdown table for a card
  const toggleItemExpansion = (orderId: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Quick Selection Handler: load from Permohonan
  const handleSelectPermohonan = (permId: string) => {
    setSelectedPermohonanId(permId);
    if (!permId) return;

    const perm = records.find(r => r.id === permId || r.orderNo === permId);
    if (!perm) return;

    // Generate random 10-digit PO if none exists
    const generatedPo = perm.poNo || `264507${Math.floor(1000 + Math.random() * 9000)}`;

    const permItems: LocalOrderItem[] = (perm.items && perm.items.length > 0)
      ? perm.items.map((it: any, idx: number) => ({
          id: `item-${idx + 1}`,
          description: it.name || it.description || perm.title,
          quantity: it.qty || it.quantity || 1,
          unit: it.unit || 'Unit',
          unitPrice: Number(it.unitPrice) || (Number(perm.estimatedAmount) / (it.qty || 1)),
          totalPrice: Number(it.total) || (Number(perm.estimatedAmount))
        }))
      : [
          {
            id: 'item-1',
            description: perm.title,
            quantity: 1,
            unit: 'Pakej / Lot',
            unitPrice: Number(perm.estimatedAmount) || 0,
            totalPrice: Number(perm.estimatedAmount) || 0
          }
        ];

    setFormData({
      referenceOrderNo: perm.orderNo,
      poNo: generatedPo,
      title: perm.title,
      category: perm.category || 'BEKALAN',
      supplierName: perm.supplierName || 'ABC ENTERPRISE',
      supplierCode: perm.supplierCode || (perm.category === 'KERJA' ? 'CIDB G1' : 'MOF 010101'),
      supplierAddress: perm.supplierAddress || 'No. 28, Kawasan Perindustrian Beaufort, 89808 Beaufort, Sabah',
      supplierPhone: perm.supplierPhone || '087-211456 / 019-8233441',
      supplierEmail: perm.supplierEmail || 'abcenterprise@gmail.com',
      allocationCode: perm.allocationCode || 'B62-020101-1002',
      amount: Number(perm.estimatedAmount) || 0,
      requestDate: perm.requestDate || new Date().toISOString().split('T')[0],
      unitOffice: perm.unitOffice || `Pejabat RISDA Daerah ${district || 'Beaufort'}`,
      perihalPerolehan: perm.perihalPerolehan || perm.title,
      items: permItems,
      disediakanNama: user?.name || 'Ahmad Faizal bin Sulaiman',
      disediakanJawatan: 'Penolong Pegawai Ehwal Ekonomi',
      disediakanTarikh: new Date().toISOString().split('T')[0],
      disemakNama: 'Siti Rohani binti Mat Said',
      disemakJawatan: 'Pegawai Penyemak Perolehan',
      disemakTarikh: new Date().toISOString().split('T')[0],
      diluluskanNama: 'Hj. Ismail bin Baharom',
      diluluskanJawatan: 'Pegawai Daerah RISDA (Ketua PTJ)',
      diluluskanTarikh: new Date().toISOString().split('T')[0]
    });

    toast.success(`Data permohonan ${perm.orderNo} berjaya dimuatkan ke dalam Pesanan Tempatan!`, {
      icon: '🎯'
    });
  };

  // Add Item to Form
  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `item-${Date.now()}`,
          description: '',
          quantity: 1,
          unit: 'Unit',
          unitPrice: 0,
          totalPrice: 0
        }
      ]
    }));
  };

  // Remove Item from Form
  const handleRemoveItem = (id: string) => {
    if (formData.items.length <= 1) {
      toast.error('Pesanan Tempatan perlu mempunyai sekurang-kurangnya satu item!');
      return;
    }
    const updated = formData.items.filter(it => it.id !== id);
    const newTotal = updated.reduce((sum, it) => sum + it.totalPrice, 0);
    setFormData(prev => ({
      ...prev,
      items: updated,
      amount: newTotal
    }));
  };

  // Change Item in Form
  const handleItemChange = (id: string, field: keyof LocalOrderItem, value: any) => {
    setFormData(prev => {
      const updatedItems = prev.items.map(it => {
        if (it.id === id) {
          const itCopy = { ...it, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            const q = field === 'quantity' ? Number(value) || 0 : it.quantity;
            const p = field === 'unitPrice' ? Number(value) || 0 : it.unitPrice;
            itCopy.totalPrice = q * p;
          }
          return itCopy;
        }
        return it;
      });
      const newTotal = updatedItems.reduce((sum, it) => sum + it.totalPrice, 0);
      return {
        ...prev,
        items: updatedItems,
        amount: newTotal
      };
    });
  };

  // Save / Generate LO
  const handleSaveLO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.supplierName || formData.amount <= 0) {
      toast.error('Sila lengkapkan maklumat perolehan, pembekal dan senarai item!');
      return;
    }

    const orderRef = formData.referenceOrderNo || `TT-2026-${String(Math.floor(100 + Math.random() * 900))}`;
    const cleanPo = formData.poNo || `264507${Math.floor(1000 + Math.random() * 9000)}`;

    const newLO: DirectAwardLOData = {
      id: `lo-${Date.now()}`,
      orderNo: orderRef,
      poNo: cleanPo,
      title: formData.title.toUpperCase(),
      category: formData.category,
      supplierName: formData.supplierName.toUpperCase(),
      supplierCode: formData.supplierCode || 'MOF 010101',
      supplierAddress: formData.supplierAddress,
      supplierPhone: formData.supplierPhone,
      supplierEmail: formData.supplierEmail,
      allocationCode: formData.allocationCode,
      amount: formData.amount,
      requestDate: formData.requestDate,
      approvedDate: formData.diluluskanTarikh,
      loGeneratedDate: new Date().toISOString().split('T')[0],
      unitOffice: formData.unitOffice,
      status: 'LULUS',
      financeStatus: 'BELUM DIHANTAR',
      items: formData.items,
      perihalPerolehan: formData.perihalPerolehan,
      disediakanOleh: {
        nama: formData.disediakanNama,
        jawatan: formData.disediakanJawatan,
        tarikh: formData.disediakanTarikh
      },
      disemakOleh: {
        nama: formData.disemakNama,
        jawatan: formData.disemakJawatan,
        tarikh: formData.disemakTarikh
      },
      diluluskanOleh: {
        nama: formData.diluluskanNama,
        jawatan: formData.diluluskanJawatan,
        tarikh: formData.diluluskanTarikh
      }
    };

    if (onCreateRecord) {
      onCreateRecord({
        ...newLO,
        estimatedAmount: newLO.amount
      });
    }

    toast.success(`Pesanan Tempatan (LO) ${cleanPo} bagi permohonan ${orderRef} berjaya dijana dan diluluskan!`, {
      icon: '🎉',
      duration: 5000
    });

    setShowGenerateModal(false);
    if (onTabChange) onTabChange('dikeluarkan');
  };

  // Action: Send to Finance
  const handleSendToFinance = (order: DirectAwardLOData) => {
    if (onUpdateRecord) {
      onUpdateRecord(order.id, {
        financeStatus: 'DIHANTAR',
        financeSentAt: new Date().toISOString().split('T')[0]
      });
    }
    toast.success(`Pesanan Tempatan (LO: ${order.poNo}) telah dihantar ke Unit Kewangan!`);
  };

  // Action: Open Payment Modal
  const handleOpenPaymentModal = (order: DirectAwardLOData) => {
    setSelectedOrder(order);
    setVoucherNo(`BV/RISDA/2026/${Math.floor(100 + Math.random() * 900)}`);
    setShowPaymentModal(true);
  };

  // Action: Confirm Payment
  const handleConfirmPayment = () => {
    if (!selectedOrder) return;
    if (!voucherNo.trim()) {
      toast.error('Sila masukkan No. Baucar Bayaran!');
      return;
    }

    if (onUpdateRecord) {
      onUpdateRecord(selectedOrder.id, {
        status: 'DIBAYAR',
        financeStatus: 'DIBAYAR',
        noBaucar: voucherNo,
        tarikhDibayar: paymentDate
      });
    }

    toast.success(`Bayaran LO ${selectedOrder.poNo} disahkan! No Baucar: ${voucherNo}`);
    setShowPaymentModal(false);
  };

  // Official Print Function for LO (Pesanan Tempatan Kerajaan)
  const handlePrintLO = (order: DirectAwardLOData) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // PO boxes (10 cells)
    const poStr = (order.poNo || '2645070098').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    const poBoxesHtml = Array.from({ length: 10 }, (_, i) => {
      const char = poStr[i] || '&nbsp;';
      return `<span style="display:inline-block; width:16px; height:18px; border:1px solid #000; text-align:center; line-height:18px; font-family:monospace; font-size:11px; font-weight:bold; margin-left:1px; vertical-align:middle;">${char}</span>`;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>PESANAN KERAJAAN (LOCAL ORDER) - ${order.poNo || order.orderNo}</title>
        <style>
          @media print {
            @page { size: A4 portrait; margin: 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 20px; color: #000; font-size: 11px; line-height: 1.3; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
          .inst-name { font-size: 13px; font-weight: bold; text-transform: uppercase; margin: 0; }
          .title { font-size: 15px; font-weight: bold; text-transform: uppercase; margin: 4px 0; }
          .subtitle { font-size: 10px; font-weight: bold; color: #222; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          .meta-table td { padding: 4px 6px; font-size: 10.5px; vertical-align: top; }
          .item-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10.5px; }
          .item-table th, .item-table td { border: 1px solid #000; padding: 5px 8px; text-align: left; }
          .item-table th { background: #f2f2f2; text-transform: uppercase; text-align: center; font-size: 10px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .sig-box { display: flex; justify-content: space-between; margin-top: 30px; }
          .sig-col { width: 31%; border-top: 1px dashed #000; padding-top: 5px; font-size: 10px; }
          .po-banner { border: 1px solid #000; padding: 6px 10px; margin-bottom: 10px; background: #fafafa; display: flex; justify-content: space-between; align-items: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="inst-name">PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH (RISDA)</div>
          <div class="title">PESANAN TEMPATAN KERAJAAN (LOCAL ORDER)</div>
          <div class="subtitle">TATACARA PENGURUSAN PEROLEHAN TAWARAN TERUS (1PP PK 2 / AP 173 / AP 176)</div>
        </div>

        <div class="po-banner">
          <div>
            <strong>PUSAT TANGGUNGJAWAB (PTJ):</strong> ${order.unitOffice.toUpperCase()}
          </div>
          <div>
            <strong style="margin-right: 5px;">NO. PESANAN (PO):</strong> ${poBoxesHtml}
          </div>
        </div>

        <table class="meta-table">
          <tr>
            <td style="width: 22%;"><strong>NO. PERMOHONAN:</strong></td>
            <td style="width: 28%; font-family: monospace; font-weight: bold;">${order.orderNo}</td>
            <td style="width: 20%;"><strong>TARIKH PESANAN:</strong></td>
            <td style="width: 30%; font-weight: bold;">${order.loGeneratedDate || order.requestDate}</td>
          </tr>
          <tr>
            <td><strong>KEPADA (PEMBEKAL):</strong></td>
            <td><strong>${order.supplierName}</strong><br><small>${order.supplierAddress || '-'}</small></td>
            <td><strong>KOD BIDANG / DAFTAR:</strong></td>
            <td>${order.supplierCode}</td>
          </tr>
          <tr>
            <td><strong>NO. TELEFON / EMEL:</strong></td>
            <td>${order.supplierPhone || '-'} / ${order.supplierEmail || '-'}</td>
            <td><strong>KAEDAH PEROLEHAN:</strong></td>
            <td>TAWARAN TERUS (${order.category})</td>
          </tr>
          <tr>
            <td><strong>KOD VOT / PERUNTUKAN:</strong></td>
            <td colspan="3" style="font-family: monospace; font-weight: bold; color: #1e3a8a;">
              ${order.allocationCode}
            </td>
          </tr>
        </table>

        <div style="font-weight: bold; margin-top: 8px; margin-bottom: 4px; text-transform: uppercase;">
          PERIHAL / SKOP PEROLEHAN:
        </div>
        <div style="border: 1px solid #000; padding: 6px 10px; background: #fff; margin-bottom: 10px;">
          <strong>${order.title}</strong><br/>
          <span style="font-size: 10px; color: #333;">${order.perihalPerolehan}</span>
        </div>

        <table class="item-table">
          <thead>
            <tr>
              <th style="width: 35px;">BIL</th>
              <th>KETERANGAN BEKALAN / PERKHIDMATAN / KERJA</th>
              <th style="width: 60px;">KUANTITI</th>
              <th style="width: 60px;">UNIT</th>
              <th style="width: 110px;" class="text-right">HARGA SEUNIT (RM)</th>
              <th style="width: 120px;" class="text-right">JUMLAH (RM)</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map((it, idx) => `
              <tr>
                <td class="text-center font-mono">${idx + 1}</td>
                <td>${it.description}</td>
                <td class="text-center">${it.quantity}</td>
                <td class="text-center">${it.unit}</td>
                <td class="text-right font-mono">${Number(it.unitPrice).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</td>
                <td class="text-right font-mono font-bold">${Number(it.totalPrice).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="5" class="text-right">JUMLAH KESELURUHAN (RM):</th>
              <th class="text-right font-mono" style="font-size: 11px;">RM ${Number(order.amount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</th>
            </tr>
          </tfoot>
        </table>

        <div style="border: 1px solid #444; padding: 6px 8px; font-size: 9.5px; background: #fbfbfb; margin-top: 10px;">
          <strong>PENGESAHAN BAKI PERUNTUKAN (KEWANGAN):</strong><br/>
          Disahkan bahawa peruntukan adalah <u>MENCUKUPI</u> dan tanggungan perbelanjaan sebanyak 
          <strong>RM ${Number(order.amount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</strong> 
          telah dicatatkan di bawah Kod Vot <strong>${order.allocationCode}</strong> mengikut Arahan Perbendaharaan AP 176.
        </div>

        <div class="sig-box">
          <div class="sig-col">
            <strong>Disediakan Oleh (Urus Setia):</strong><br><br><br>
            Tandatangan: ............................................<br>
            Nama: <strong>${order.disediakanOleh.nama}</strong><br>
            Jawatan: ${order.disediakanOleh.jawatan}<br>
            Tarikh: ${order.disediakanOleh.tarikh}
          </div>

          <div class="sig-col">
            <strong>Disemak Oleh (Pegawai Penyemak):</strong><br><br><br>
            Tandatangan: ............................................<br>
            Nama: <strong>${order.disemakOleh.nama}</strong><br>
            Jawatan: ${order.disemakOleh.jawatan}<br>
            Tarikh: ${order.disemakOleh.tarikh}
          </div>

          <div class="sig-col">
            <strong>Diluluskan Oleh (Ketua PTJ):</strong><br><br><br>
            Tandatangan: ............................................<br>
            Nama: <strong>${order.diluluskanOleh.nama}</strong><br>
            Jawatan: ${order.diluluskanOleh.jawatan}<br>
            Tarikh: ${order.diluluskanOleh.tarikh}
          </div>
        </div>

        <div style="margin-top: 25px; text-align: center; font-size: 9px; color: #444; border-top: 1px solid #ccc; padding-top: 5px;">
          Cetakan Komputer Rasmi Sistem eTapak RISDA • Sah Tanpa Pindaan Tulisan Tangan
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

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* SEARCH & FILTER BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-96">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari no. permohonan, no. PO, tajuk, pembekal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-black/5 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-500 transition-all placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {['SEMUA', 'BEKALAN', 'PERKHIDMATAN', 'KERJA'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                    : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Status Dropdown */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="bg-black/5 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="SEMUA" className="bg-white dark:bg-slate-900 text-black dark:text-white">Status: Semua</option>
            <option value="LULUS" className="bg-white dark:bg-slate-900 text-black dark:text-white">LO Dijana / Lulus</option>
            <option value="MENUNGGU KELULUSAN" className="bg-white dark:bg-slate-900 text-black dark:text-white">Menunggu Kelulusan</option>
            <option value="DIHANTAR" className="bg-white dark:bg-slate-900 text-black dark:text-white">Dihantar Ke Kewangan</option>
            <option value="DIBAYAR" className="bg-white dark:bg-slate-900 text-black dark:text-white">Selesai Dibayar</option>
          </select>
        </div>
      </div>

      {/* 4. EXPANSIVE CARDS LIST (SEPERTI PESANAN TEMPATAN SEBUTHARGA) */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-12 text-center space-y-4">
            <FileText size={48} className="mx-auto text-slate-400 opacity-50" />
            <h3 className="text-base font-black text-slate-800 dark:text-slate-200 uppercase">
              Tiada Rekod Pesanan Tempatan Ditemui
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
              Sila klik butang di bawah untuk menjana Pesanan Tempatan baharu berpandukan senarai permohonan Tawaran Terus yang telah dibuat.
            </p>
            <button
              type="button"
              onClick={() => {
                if (records.length > 0) handleSelectPermohonan(records[0].id);
                setShowGenerateModal(true);
              }}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer inline-flex items-center gap-2"
            >
              <Plus size={15} /> + JANA PESANAN TEMPATAN (LO)
            </button>
          </div>
        ) : (
          filteredOrders.map(order => {
            const isExpanded = !!expandedItems[order.id];
            const isPaid = order.financeStatus === 'DIBAYAR' || order.status === 'DIBAYAR';
            const isSent = order.financeStatus === 'DIHANTAR';
            const isApproved = order.status === 'LULUS';

            return (
              <div
                key={order.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 transition-all duration-200 shadow-sm hover:shadow-md relative space-y-4 text-slate-800 dark:text-slate-100"
              >
                {/* ROW 1: STATUS PILLS & AMOUNT (SEPERTI SEBUTHARGA) */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Pill 1: No. Permohonan Tawaran Terus */}
                    <span className="px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wider border border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      Ruj: {order.orderNo}
                    </span>

                    {/* Pill 2: No. PO 10 Digit */}
                    <span className="px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wider border border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      PO: {order.poNo || 'BELUM DIJANA'}
                    </span>

                    {/* Pill 3: Kategori Perolehan */}
                    <span className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      order.category === 'BEKALAN' ? 'bg-blue-600 text-white' :
                      order.category === 'PERKHIDMATAN' ? 'bg-emerald-600 text-white' :
                      'bg-amber-500 text-slate-950 font-black'
                    }`}>
                      {order.category}
                    </span>

                    {/* Pill 4: Status Pesanan */}
                    <span className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                      isPaid || isApproved
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                        : 'border-orange-500/40 bg-orange-500/15 text-orange-600 dark:text-orange-300'
                    }`}>
                      STATUS: {isPaid ? 'SELESAI DIBAYAR' : (isApproved ? 'LO DIJANA (LULUS)' : order.status)}
                    </span>

                    {/* Pill 5: Integrasi Kewangan */}
                    <span className={`px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
                      isPaid
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : isSent
                        ? 'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}>
                      <Clock size={12} />
                      INTEGRASI KEWANGAN: {order.financeStatus}
                    </span>
                  </div>

                  {/* AMAUN PESANAN */}
                  <div className="text-left sm:text-right shrink-0">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      AMAUN PESANAN (RM)
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-amber-500 dark:text-amber-400">
                      RM {order.amount.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* ROW 2: TAJUK PEROLEHAN */}
                <div>
                  <h3 className="text-base sm:text-lg font-black leading-snug tracking-tight uppercase text-slate-900 dark:text-white">
                    {order.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    {order.perihalPerolehan}
                  </p>
                </div>

                {/* ROW 3: 4 METADATA COLUMNS & ACTIONS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Tarikh Permohonan / LO</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {order.loGeneratedDate || order.requestDate}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Pembekal Terpilih</span>
                    <span className="font-black text-slate-900 dark:text-white uppercase truncate block" title={order.supplierName}>
                      {order.supplierName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {order.supplierCode}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Kod Vot / Peruntukan</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 truncate block" title={order.allocationCode}>
                      {order.allocationCode}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Pusat Tanggungjawab (PTJ)</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase truncate block">
                      {order.unitOffice}
                    </span>
                  </div>
                </div>

                {/* ROW 4: ITEM EXPANSION VIEW IF OPEN */}
                {isExpanded && (
                  <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden animate-fadeIn">
                    <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-2.5 text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Pecahan Item BQ Pesanan Tempatan</span>
                      <span className="font-mono text-amber-500 font-bold">{order.items.length} Item</span>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/5 dark:bg-white/5 text-[10px] font-black uppercase text-slate-500">
                        <tr>
                          <th className="py-2 px-3 w-10 text-center">Bil</th>
                          <th className="py-2 px-3">Keterangan Item</th>
                          <th className="py-2 px-3 text-center w-24">Kuantiti</th>
                          <th className="py-2 px-3 text-center w-20">Unit</th>
                          <th className="py-2 px-3 text-right w-28">Harga Seunit (RM)</th>
                          <th className="py-2 px-3 text-right w-28">Jumlah (RM)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {order.items.map((it, idx) => (
                          <tr key={it.id || idx}>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{it.description}</td>
                            <td className="py-2.5 px-3 text-center font-mono">{it.quantity}</td>
                            <td className="py-2.5 px-3 text-center text-slate-500">{it.unit}</td>
                            <td className="py-2.5 px-3 text-right font-mono">{it.unitPrice.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-500">{it.totalPrice.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ROW 5: ACTION BUTTONS */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => toggleItemExpansion(order.id)}
                    className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-amber-500 flex items-center gap-1 cursor-pointer"
                  >
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    <span>{isExpanded ? 'Tutup Pecahan Item BQ' : `Pecahan Item BQ (${order.items.length})`}</span>
                  </button>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 1. Lihat Butiran */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowDetailModal(true);
                      }}
                      className="px-3.5 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Eye size={14} /> Lihat Butiran
                    </button>

                    {/* 2. Cetak LO Rasmi */}
                    <button
                      type="button"
                      onClick={() => handlePrintLO(order)}
                      className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Printer size={14} /> Cetak LO Rasmi
                    </button>

                    {/* 3. Hantar ke Unit Kewangan */}
                    {order.financeStatus === 'BELUM DIHANTAR' && (
                      <button
                        type="button"
                        onClick={() => handleSendToFinance(order)}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        <Send size={13} /> Hantar Kewangan
                      </button>
                    )}

                    {/* 4. Sahkan Bayaran Baucar */}
                    {order.financeStatus === 'DIHANTAR' && (
                      <button
                        type="button"
                        onClick={() => handleOpenPaymentModal(order)}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        <DollarSign size={14} /> Sahkan Bayaran
                      </button>
                    )}

                    {/* Badge Selesai Dibayar */}
                    {isPaid && (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase flex items-center gap-1">
                        <CheckCircle2 size={14} /> {order.noBaucar ? `Baucar: ${order.noBaucar}` : 'Dibayar'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: JANA PESANAN TEMPATAN (LO) TAWARAN TERUS */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 text-slate-800 dark:text-slate-100">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <span className="text-[11px] font-black uppercase text-amber-500 tracking-wider flex items-center gap-1.5">
                  <FileCheck size={15} /> 1PP PK 2 • PESANAN KERAJAAN
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Borang Jana Pesanan Tempatan (LO)
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Pilih rujukan permohonan Tawaran Terus yang telah dibuat untuk menjana Pesanan Tempatan secara pantas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* QUICK SELECTION: RUJUK MELALUI PERMOHONAN YANG DIBUAT (KEY USER REQUIREMENT) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-500/40 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  <Sparkles size={16} className="text-amber-500 animate-pulse" />
                  <span>Pilihan Pantas: Muat Data Daripada Permohonan Tawaran Terus Yang Dibuat</span>
                </div>
                <span className="text-[11px] text-slate-500 font-semibold">
                  *Pilih permohonan untuk mengisi tajuk, pembekal &amp; nilai secara automatik
                </span>
              </div>

              <select
                value={selectedPermohonanId}
                onChange={(e) => handleSelectPermohonan(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-amber-500/60 rounded-xl text-slate-900 dark:text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-amber-500 cursor-pointer shadow-sm"
              >
                <option value="">-- Sila Pilih Permohonan Tawaran Terus Yang Telah Dibuat --</option>
                {availablePermohonan.map(perm => (
                  <option key={perm.id} value={perm.id}>
                    {perm.orderNo} • {perm.title} [Pembekal: {perm.supplierName || 'Belum Dipilih'}] [RM {Number(perm.estimatedAmount).toLocaleString('ms-MY')}]
                  </option>
                ))}
              </select>
            </div>

            {/* FORM */}
            <form onSubmit={handleSaveLO} className="space-y-6">
              {/* SECTION 1: HEADER & PO INFO */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    No. Permohonan Rujukan
                  </label>
                  <input
                    type="text"
                    value={formData.referenceOrderNo}
                    onChange={(e) => setFormData({ ...formData, referenceOrderNo: e.target.value })}
                    placeholder="TP-2026-00125"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    No. PO (10 Digit)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={formData.poNo}
                    onChange={(e) => setFormData({ ...formData, poNo: e.target.value })}
                    placeholder="2645070125"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-mono font-black tracking-widest text-emerald-600 dark:text-emerald-400 focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Tarikh Pesanan
                  </label>
                  <input
                    type="date"
                    value={formData.requestDate}
                    onChange={(e) => setFormData({ ...formData, requestDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              {/* SECTION 2: BUTIRAN PEROLEHAN & PEMBEKAL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tajuk Perolehan */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Tajuk Perolehan
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Contoh: PEMBEKALAN KOMPUTER DESKTOP PEJABAT"
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase focus:border-amber-500"
                    required
                  />
                </div>

                {/* Kategori */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Kategori Perolehan
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-amber-500 cursor-pointer"
                  >
                    <option value="BEKALAN">BEKALAN (≤RM50,000)</option>
                    <option value="PERKHIDMATAN">PERKHIDMATAN (≤RM50,000)</option>
                    <option value="KERJA">KERJA (≤RM100,000)</option>
                  </select>
                </div>

                {/* Kod Vot / Peruntukan */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Kod Vot / Peruntukan
                  </label>
                  <input
                    type="text"
                    value={formData.allocationCode}
                    onChange={(e) => setFormData({ ...formData, allocationCode: e.target.value })}
                    placeholder="B62-020101-1002"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:border-amber-500"
                    required
                  />
                </div>

                {/* Nama Pembekal */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Nama Pembekal Terpilih
                  </label>
                  <input
                    type="text"
                    value={formData.supplierName}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    placeholder="Contoh: SABAH MAJU SDN BHD"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white uppercase focus:border-amber-500"
                    required
                  />
                </div>

                {/* Kod Pendaftaran / Lesen */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    No. Pendaftaran MOF / CIDB / SSM
                  </label>
                  <input
                    type="text"
                    value={formData.supplierCode}
                    onChange={(e) => setFormData({ ...formData, supplierCode: e.target.value })}
                    placeholder="MOF 357-02033456"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-amber-500"
                  />
                </div>
              </div>

              {/* SECTION 3: PECAHAN ITEM BQ */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Package size={14} className="text-amber-500" />
                    <span>Pecahan Item / Keterangan Bekalan</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={13} /> + Tambah Item
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3">Keterangan Item</th>
                        <th className="py-2.5 px-3 w-20 text-center">Kuantiti</th>
                        <th className="py-2.5 px-3 w-24 text-center">Unit</th>
                        <th className="py-2.5 px-3 w-32 text-right">Harga Seunit (RM)</th>
                        <th className="py-2.5 px-3 w-32 text-right">Jumlah (RM)</th>
                        <th className="py-2.5 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-slate-900">
                      {formData.items.map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td className="p-2">
                            <input
                              type="text"
                              value={it.description}
                              onChange={(e) => handleItemChange(it.id, 'description', e.target.value)}
                              placeholder="Keterangan bekalan / perkhidmatan"
                              className="w-full px-2 py-1 bg-transparent border border-slate-200 dark:border-white/10 rounded-lg text-xs"
                              required
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => handleItemChange(it.id, 'quantity', e.target.value)}
                              className="w-full px-2 py-1 bg-transparent border border-slate-200 dark:border-white/10 rounded-lg text-xs font-mono text-center"
                              required
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={it.unit}
                              onChange={(e) => handleItemChange(it.id, 'unit', e.target.value)}
                              className="w-full px-2 py-1 bg-transparent border border-slate-200 dark:border-white/10 rounded-lg text-xs text-center"
                              required
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              value={it.unitPrice}
                              onChange={(e) => handleItemChange(it.id, 'unitPrice', e.target.value)}
                              className="w-full px-2 py-1 bg-transparent border border-slate-200 dark:border-white/10 rounded-lg text-xs font-mono text-right"
                              required
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-amber-500">
                            RM {it.totalPrice.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(it.id)}
                              className="p-1 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-black">
                      <tr>
                        <td colSpan={4} className="py-2.5 px-3 text-right uppercase">
                          Jumlah Keseluruhan Pesanan:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-500 text-sm">
                          RM {formData.amount.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* SECTION 4: TANDATANGAN & PENGESAHAN PEGAWAI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 text-xs">
                <div className="space-y-1">
                  <span className="font-black uppercase text-slate-700 dark:text-slate-300 block">Disediakan Oleh</span>
                  <input
                    type="text"
                    value={formData.disediakanNama}
                    onChange={(e) => setFormData({ ...formData, disediakanNama: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-lg text-xs font-bold"
                  />
                  <span className="text-[10px] text-slate-400 block">{formData.disediakanJawatan}</span>
                </div>

                <div className="space-y-1">
                  <span className="font-black uppercase text-slate-700 dark:text-slate-300 block">Disemak Oleh</span>
                  <input
                    type="text"
                    value={formData.disemakNama}
                    onChange={(e) => setFormData({ ...formData, disemakNama: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-lg text-xs font-bold"
                  />
                  <span className="text-[10px] text-slate-400 block">{formData.disemakJawatan}</span>
                </div>

                <div className="space-y-1">
                  <span className="font-black uppercase text-slate-700 dark:text-slate-300 block">Diluluskan Oleh (Ketua PTJ)</span>
                  <input
                    type="text"
                    value={formData.diluluskanNama}
                    onChange={(e) => setFormData({ ...formData, diluluskanNama: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-lg text-xs font-bold"
                  />
                  <span className="text-[10px] text-slate-400 block">{formData.diluluskanJawatan}</span>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/25 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  <span>Jana &amp; Luluskan Pesanan Tempatan (LO)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LIHAT BUTIRAN PESANAN TEMPATAN (LO) */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 text-slate-800 dark:text-slate-100">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <span className="text-[11px] font-mono font-bold text-emerald-500">
                  PO: {selectedOrder.poNo} • Ruj: {selectedOrder.orderNo}
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase mt-1">
                  Butiran Pesanan Tempatan Kerajaan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="p-2 rounded-xl bg-black/5 dark:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            {/* PO 10 Digit Boxes Display */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">No. Pesanan Tempatan (10-Digit PO)</span>
                <span className="text-base font-black font-mono tracking-widest text-emerald-600 dark:text-emerald-400">
                  {selectedOrder.poNo}
                </span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-500/20 text-emerald-500">
                {selectedOrder.status}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 font-bold uppercase block">Tajuk Perolehan:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedOrder.title}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">Pembekal Terpilih:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedOrder.supplierName} ({selectedOrder.supplierCode})</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">Kod Vot:</span>
                  <span className="font-mono font-bold text-amber-500">{selectedOrder.allocationCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">Jumlah Pesanan:</span>
                  <span className="font-mono font-bold text-emerald-500 text-sm">RM {selectedOrder.amount.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border rounded-xl overflow-hidden mt-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold">
                    <tr>
                      <th className="p-2.5">Item</th>
                      <th className="p-2.5 text-center">Kuantiti</th>
                      <th className="p-2.5 text-right">Harga (RM)</th>
                      <th className="p-2.5 text-right">Jumlah (RM)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {selectedOrder.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5">{it.description}</td>
                        <td className="p-2.5 text-center">{it.quantity} {it.unit}</td>
                        <td className="p-2.5 text-right font-mono">{it.unitPrice.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</td>
                        <td className="p-2.5 text-right font-mono font-bold">{it.totalPrice.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => handlePrintLO(selectedOrder)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={15} /> Cetak LO Rasmi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SAHKAN BAYARAN BAUCAR */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl max-w-md w-full p-6 space-y-5 text-slate-800 dark:text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign size={18} className="text-amber-500" />
                Pengesahan Bayaran Baucar
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase block">Pesanan Tempatan:</span>
                <span className="font-mono font-bold text-sm text-emerald-500">{selectedOrder.poNo}</span> ({selectedOrder.orderNo})
              </div>

              <div>
                <span className="text-slate-400 font-bold uppercase block">Pembekal:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedOrder.supplierName}</span>
              </div>

              <div>
                <span className="text-slate-400 font-bold uppercase block">Jumlah Bayaran (RM):</span>
                <span className="font-mono font-bold text-amber-500 text-base">
                  RM {selectedOrder.amount.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase mb-1">
                  No. Baucar Bayaran
                </label>
                <input
                  type="text"
                  value={voucherNo}
                  onChange={(e) => setVoucherNo(e.target.value)}
                  placeholder="BV/RISDA/2026/044"
                  className="w-full px-3 py-2 bg-black/5 dark:bg-black/40 border rounded-xl font-mono font-bold text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase mb-1">
                  Tarikh Bayaran
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-black/5 dark:bg-black/40 border rounded-xl text-xs"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase"
              >
                Sahkan Bayaran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
