import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileBarChart, 
  Download, 
  FileText, 
  TrendingUp, 
  Users, 
  CheckCircle, 
  Calendar, 
  Plus, 
  Trash2, 
  RefreshCw, 
  FileSpreadsheet, 
  FileCheck,
  ArrowLeft,
  ArrowRight,
  Edit2,
  Save,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { isWithinUserScope, calculateTempohSiapKerja, formatDateToDDMMYYYY } from '../lib/scopeUtils';

const getNormalizedDecisionDate = (ad: any): string => {
  if (!ad) return '';
  const dDate = ad.winner?.decisionDate || ad.decisionDate;
  
  let targetYear = '';
  if (ad.winner?.contractStartDate && ad.winner.contractStartDate.length >= 4 && ad.winner.contractStartDate !== '-') {
    targetYear = ad.winner.contractStartDate.substring(0, 4);
  } else if (ad.contractStartDate && ad.contractStartDate.length >= 4 && ad.contractStartDate !== '-') {
    targetYear = ad.contractStartDate.substring(0, 4);
  } else if (ad.closingDate && ad.closingDate.length >= 4) {
    targetYear = ad.closingDate.substring(0, 4);
  } else if (ad.tenderNo) {
    const match = ad.tenderNo.match(/20\d\d/);
    if (match) targetYear = match[0];
  }

  if (dDate) {
    if (targetYear && targetYear.length === 4 && dDate.startsWith('2026') && targetYear !== '2026') {
      return dDate.replace(/^2026/, targetYear);
    }
    return dDate;
  }

  if (ad.closingDate && targetYear) {
    if (ad.closingDate.includes('-')) {
      const parts = ad.closingDate.split('-');
      if (parts.length === 3) {
        return `${targetYear}-${parts[1]}-25`;
      }
    }
  }
  return `${targetYear || '2025'}-02-25`;
};
import { 
  exportA1ToPDF, 
  exportA2ToPDF, 
  exportA1ToExcel, 
  exportA2ToExcel, 
  exportA1ToWord, 
  exportA2ToWord,
  exportAnnualToPDF,
  exportAnnualToExcel,
  exportAnnualToWord,
  RowA1,
  RowA2,
  RowAnnual
} from '../lib/reportExportUtils';
import { exportToPDF, exportResultToPDF } from '../lib/exportUtils';

export default function ReportPanel() {
  const { role, office: userOffice, state: userState, district: userDistrict } = useAuth();
  const [view, setView] = useState<'summary' | 'sukuan' | 'tahunan'>('summary');
  const [loading, setLoading] = useState<boolean>(false);

  // Scroll ref for the annual report table scrollbar container
  const tableRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (tableRef.current) {
      const scrollAmount = 450;
      tableRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // States for Quarterly/Monthly Report (Format Lampiran A1 & A2)
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedQuarter, setSelectedQuarter] = useState<string>('Q1'); // Q1, Q2, Q3, Q4
  const [office, setOffice] = useState<string>('PEJABAT RISDA DAERAH BEAUFORT');
  const [asOfDate, setAsOfDate] = useState<string>(`31 Mac ${new Date().getFullYear()}`);
  const [activeTab, setActiveTab] = useState<'a1' | 'a2'>('a1');

  // Rows state for A1
  const [rowsA1, setRowsA1] = useState<RowA1[]>([
    { category: 'BEKALAN', perancanganBil: 0, perancanganNilai: 0, belumPelawaBil: 0, prosesIklanBil: 0, prosesPenilaianBil: 0, prosesJkBil: 0, belumSstBil: 0, sstBumiBil: 0, sstBumiNilai: 0, sstNonBumiBil: 0, sstNonBumiNilai: 0, syorJangkaan: '' },
    { category: 'PERKHIDMATAN', perancanganBil: 0, perancanganNilai: 0, belumPelawaBil: 0, prosesIklanBil: 0, prosesPenilaianBil: 0, prosesJkBil: 0, belumSstBil: 0, sstBumiBil: 0, sstBumiNilai: 0, sstNonBumiBil: 0, sstNonBumiNilai: 0, syorJangkaan: '' },
    { category: 'KERJA', perancanganBil: 0, perancanganNilai: 0, belumPelawaBil: 0, prosesIklanBil: 0, prosesPenilaianBil: 0, prosesJkBil: 0, belumSstBil: 0, sstBumiBil: 0, sstBumiNilai: 0, sstNonBumiBil: 0, sstNonBumiNilai: 0, syorJangkaan: '' }
  ]);

  // Rows state for A2 (Initialized completely empty because they do not have data filled yet)
  const [rowsA2, setRowsA2] = useState<RowA2[]>([]);

  // Tracks which Lampiran A2 rows are in edit/input mode
  const [activeA2Edits, setActiveA2Edits] = useState<Record<string, boolean>>({});

  // States for Annual Report
  const [selectedAnnualYear, setSelectedAnnualYear] = useState<string | null>(null);
  const [rowsAnnual, setRowsAnnual] = useState<RowAnnual[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [customAnnualRows, setCustomAnnualRows] = useState<RowAnnual[]>([]);

  const getInitialMockAnnual = (yearStr: string): RowAnnual[] => {
    return [];
  };

  const formatDate = (d: any): string => {
    if (!d) return '';
    return formatDateToDDMMYYYY(String(d));
  };

  const formatPONo = (rawPo?: string): string => {
    if (!rawPo) return '';
    const trimmed = rawPo.trim();
    if (!trimmed || trimmed === '-') return '';
    // Clean prefixes like "PO:", "PO :", "PO ", "LO:", "LO ", etc.
    const cleaned = trimmed.replace(/^(PO|LO)\s*[:\-]?\s*/i, '').trim();
    if (cleaned) {
      return `PO${cleaned}`;
    }
    return trimmed;
  };

  const getDBAnnualRowsForYear = (yearStr: string): RowAnnual[] => {
    // Track matched order IDs so we never create duplicate rows for projects that already exist as Sebutharga
    const matchedOrderIds = new Set<string>();

    // 1. Process ads (Sebutharga)
    const filtered = allAds.filter(ad => {
      if (selectedOffice && selectedOffice !== 'SEMUA') {
        const adOffice = ad.office || '';
        if (adOffice.trim().toLowerCase() !== selectedOffice.trim().toLowerCase()) return false;
      }

      const isWinnerDecided = ad.status === 'SELESAI (KEPUTUSAN)' || (ad.winner && ad.winner.companyName && ad.winner.companyName !== 'TIADA') || ad.winnerName;
      if (!isWinnerDecided) return false;

      const dateStr = getNormalizedDecisionDate(ad) || ad.winner?.timestamp || ad.winner?.contractStartDate || ad.updatedAt || ad.closingDate || ad.createdAt;
      if (!dateStr) return false;

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return false;

      return date.getFullYear().toString() === yearStr;
    });

    const adRows: RowAnnual[] = filtered.map((ad, idx) => {
      const isReTender = Boolean(
        ad.winner?.isReTender || 
        ad.winner?.companyName === 'SEBUTHARGA SEMULA' || 
        ad.winnerName === 'SEBUTHARGA SEMULA' || 
        ad.winner?.companyName?.toUpperCase() === 'SEBUTHARGA SEMULA' ||
        ad.winnerName?.toUpperCase() === 'SEBUTHARGA SEMULA' ||
        ad.statusPelaksanaan === 'SEBUTHARGA SEMULA'
      );

      let winningPrice = 0;
      if (isReTender) {
        winningPrice = 0;
      } else if (ad.winningPrice !== undefined && ad.winningPrice !== null) {
        winningPrice = Number(ad.winningPrice) || 0;
      } else if (ad.winner?.winningPrice) {
        winningPrice = Number(ad.winner.winningPrice) || 0;
      } else if (ad.winner) {
        winningPrice = 50000;
      }

      // Check if there is a matching Order Request created for this Sebutharga
      const cleanAdTitle = (ad.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const tenderNoClean = (ad.tenderNo || '').toUpperCase().trim();
      const adWinnerName = (ad.winnerName || ad.winner?.companyName || '').toUpperCase().trim();

      const matchedOrder = allOrderRequests.find(ord => {
        if (!ord) return false;
        // 1. Direct tender reference match
        const rujukan = (ord.rujukanDokumen || '').toUpperCase().trim();
        if (rujukan && tenderNoClean && (rujukan === tenderNoClean || rujukan.includes(tenderNoClean) || tenderNoClean.includes(rujukan))) {
          return true;
        }
        // 2. Title similarity match
        const cleanOrdTitle = (ord.title || ord.perihalPerolehan || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanAdTitle && cleanOrdTitle) {
          if (cleanAdTitle === cleanOrdTitle || cleanAdTitle.includes(cleanOrdTitle) || cleanOrdTitle.includes(cleanAdTitle)) {
            return true;
          }
        }
        // 3. Match by winner name and amount
        const ordSupplier = (ord.pembekalDipilih || ord.supplierName || '').toUpperCase().trim();
        const ordAmt = Number(ord.estimatedAmount) || 0;
        if (adWinnerName && ordSupplier && adWinnerName === ordSupplier && winningPrice > 0 && Math.abs(ordAmt - winningPrice) < 10) {
          return true;
        }
        return false;
      });

      if (matchedOrder && matchedOrder.id) {
        matchedOrderIds.add(matchedOrder.id);
      }

      const rawStart = isReTender ? '' : (ad.tarikhSetujuTerima || ad.winner?.contractStartDate || ad.contractStartDate || (matchedOrder ? (matchedOrder.requestDate || matchedOrder.disediakanOlehTarikh) : ''));
      const rawEnd = isReTender ? '' : (ad.tarikhSiapKerja || ad.winner?.contractEndDate || ad.contractEndDate || (matchedOrder ? (matchedOrder.disahkanOlehTarikh || matchedOrder.ketuaPtjTarikh) : ''));
      const tStart = isReTender ? '' : formatDateToDDMMYYYY(rawStart);
      const tEnd = isReTender ? '' : formatDateToDDMMYYYY(rawEnd);
      const autoTempoh = isReTender ? '' : calculateTempohSiapKerja(tStart, tEnd);

      // Extract and format PO number, Voucher number and Paid Date from matched Order
      const resolvedPo = formatPONo(matchedOrder?.poNo || ad.noPesananTempatan || ad.winner?.noPesananTempatan || '');
      const resolvedVoucher = (matchedOrder?.noBaucar || (matchedOrder as any)?.voucherNo || ad.noBaucar || '').toUpperCase();
      const resolvedPaidDate = formatDateToDDMMYYYY(matchedOrder?.tarikhDibayar || (matchedOrder as any)?.paidDate || ad.tarikhDibayar || '');

      return {
        id: ad.id,
        title: (ad.title || '').toUpperCase(),
        category: (ad.category || 'KERJA').toUpperCase() as any,
        tenderNo: (ad.tenderNo || `SH/S.6-${String(idx + 1).padStart(2, '0')}/${yearStr}`).toUpperCase(),
        tarikhSetujuTerima: tStart,
        tarikhSiapKerja: tEnd,
        tempohSiapKerja: isReTender ? '' : (autoTempoh || ad.tempohSiapKerja || ''),
        winnerName: isReTender ? 'SEBUTHARGA SEMULA' : (ad.winnerName || ad.winner?.companyName || 'TIADA').toUpperCase(),
        winningPrice,
        noPesananTempatan: isReTender ? '' : resolvedPo,
        noBaucar: isReTender ? '' : resolvedVoucher,
        tarikhDibayar: isReTender ? '' : resolvedPaidDate,
        tarikhSiapBaru: isReTender ? '' : (ad.tarikhSiapBaru || ''),
        statusPelaksanaan: isReTender ? 'TAMAT' : (ad.statusPelaksanaan || ad.winner?.status || 'ON TIME').toUpperCase()
      };
    });

    // 2. Process standalone orderRequests (Only direct purchases that do NOT belong to any Sebutharga)
    const filteredOrders = allOrderRequests.filter(ord => {
      if (!ord || (ord.id && matchedOrderIds.has(ord.id))) return false;

      if (selectedOffice && selectedOffice !== 'SEMUA') {
        const ordOffice = ord.unitOffice || ord.ptjName || '';
        const selLower = selectedOffice.trim().toLowerCase();
        const distName = selLower.replace('pejabat risda daerah', '').trim();
        if (ordOffice && !ordOffice.toLowerCase().includes(selLower) && distName && !ordOffice.toLowerCase().includes(distName)) {
          return false;
        }
      }

      // Check if this order title already matches any ad row to prevent duplicate reporting
      const cleanOrdTitle = (ord.title || ord.perihalPerolehan || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const alreadyInAd = adRows.some(a => {
        const cleanAdTitle = (a.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanAdTitle && cleanOrdTitle && (cleanAdTitle.includes(cleanOrdTitle) || cleanOrdTitle.includes(cleanAdTitle));
      });
      if (alreadyInAd) return false;

      // Must be sent to finance, approved, or paid
      const isSentOrPaid = ord.status === 'DIHANTAR KE KEWANGAN' || 
                            ord.status === 'DIBAYAR' || 
                            ord.status === 'LULUS' || 
                            ord.financeStatus === 'DIHANTAR' || 
                            ord.financeStatus === 'DISAHKAN KEWANGAN' || 
                            ord.financeStatus === 'DIBAYAR';
      if (!isSentOrPaid) return false;

      let ordYear = yearStr;
      const reqDate = ord.requestDate || ord.disediakanOlehTarikh || ord.createdAt || '';
      if (reqDate && reqDate.length >= 4) {
        const match = reqDate.match(/20\d\d/);
        if (match) ordYear = match[0];
      } else if (ord.orderNo) {
        const match = ord.orderNo.match(/20\d\d/);
        if (match) ordYear = match[0];
      }

      return ordYear === yearStr;
    });

    const orderRows: RowAnnual[] = filteredOrders.map((ord, idx) => {
      const isPaid = ord.financeStatus === 'DIBAYAR' || ord.status === 'DIBAYAR';
      const supplierName = (
        ord.pembekalDipilih || 
        ord.supplierName || 
        (ord.kajianPasaran && ord.kajianPasaran.find((k: any) => k.namaSyarikat && k.namaSyarikat.trim() !== '')?.namaSyarikat) || 
        'PEMBEKAL DILANTIK'
      ).toUpperCase();

      const amt = Number(ord.estimatedAmount) || (ord.items ? ord.items.reduce((s: number, i: any) => s + (Number(i.jumlahHarga || i.totalPrice) || 0), 0) : 0);

      const reqDate = formatDateToDDMMYYYY(ord.requestDate || ord.disediakanOlehTarikh || '');
      const appDate = formatDateToDDMMYYYY(ord.disahkanOlehTarikh || ord.ketuaPtjTarikh || reqDate);

      // Clean PO Number
      const loNo = formatPONo(ord.poNo || ord.financeReferenceNo || '');

      // Baucer Bayaran & Tarikh Dibayar from Finance System
      const voucherNo = (ord.noBaucar || (ord as any).voucherNo || '').toUpperCase();
      const paidDate = formatDateToDDMMYYYY(ord.tarikhDibayar || (ord as any).paidDate || '');

      return {
        id: ord.id || `order-${idx}`,
        title: (ord.title || ord.perihalPerolehan || 'PESANAN PEMBELIAN').toUpperCase(),
        category: (ord.category || 'BEKALAN').toUpperCase() as any,
        tenderNo: (ord.orderNo || `PP/RISDA/${yearStr}/${idx + 1}`).toUpperCase(),
        tarikhSetujuTerima: reqDate,
        tarikhSiapKerja: appDate,
        tempohSiapKerja: '14 HARI',
        winnerName: supplierName,
        winningPrice: amt,
        noPesananTempatan: loNo,
        noBaucar: voucherNo,
        tarikhDibayar: paidDate,
        tarikhSiapBaru: '',
        statusPelaksanaan: isPaid ? 'SELESAI (DIBAYAR)' : 'PROSES KEWANGAN'
      };
    });

    return [...adRows, ...orderRows];
  };

  const loadAnnualRowsForYear = (yearStr: string, customList?: RowAnnual[]): RowAnnual[] => {
    const dbRows = getDBAnnualRowsForYear(yearStr);
    const rowsToUse = customList !== undefined ? customList : customAnnualRows;
    const savedAnnualForYear = rowsToUse.filter((cr: any) => cr.year === yearStr || (!cr.year && cr.id.startsWith('custom-')));

    if (savedAnnualForYear.length === 0) {
      return dbRows;
    }

    // Merge by unique key (tenderNo or normalized title) to eliminate duplicate rows
    const mergedMap = new Map<string, RowAnnual>();

    dbRows.forEach(row => {
      const normTitle = (row.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const key = row.tenderNo && row.tenderNo.trim() !== '' ? row.tenderNo.trim().toUpperCase() : (normTitle || row.id);
      mergedMap.set(key, row);
    });

    savedAnnualForYear.forEach((savedRow: any) => {
      const normTitle = (savedRow.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const key = savedRow.tenderNo && savedRow.tenderNo.trim() !== '' ? savedRow.tenderNo.trim().toUpperCase() : (normTitle || savedRow.id);

      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!;
        mergedMap.set(key, {
          ...existing,
          ...savedRow,
          noPesananTempatan: formatPONo(savedRow.noPesananTempatan || existing.noPesananTempatan),
          noBaucar: (savedRow.noBaucar || existing.noBaucar || '').toUpperCase(),
          tarikhDibayar: savedRow.tarikhDibayar || existing.tarikhDibayar || ''
        });
      } else {
        // Only keep if it doesn't match an existing row
        const alreadyMatched = Array.from(mergedMap.values()).some(r => {
          const rTitle = (r.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return normTitle && rTitle && (normTitle === rTitle || normTitle.includes(rTitle) || rTitle.includes(normTitle));
        });

        if (!alreadyMatched) {
          mergedMap.set(key, {
            ...(savedRow as RowAnnual),
            noPesananTempatan: formatPONo(savedRow.noPesananTempatan)
          });
        }
      }
    });

    const result = Array.from(mergedMap.values()).map(row => {
      const isReTender = Boolean(
        row.winnerName && row.winnerName.toUpperCase().includes('SEBUTHARGA SEMULA')
      );
      if (isReTender) {
        return {
          ...row,
          tempohSiapKerja: '',
          winningPrice: 0,
          statusPelaksanaan: 'TAMAT',
          tarikhSetujuTerima: '',
          tarikhSiapKerja: '',
          noPesananTempatan: '',
          noBaucar: '',
          tarikhDibayar: '',
          tarikhSiapBaru: ''
        };
      }
      return row;
    });

    return result;
  };

  const handleSyncAnnualFromDB = () => {
    if (!selectedAnnualYear) return;
    const mapped = loadAnnualRowsForYear(selectedAnnualYear);

    if (mapped.length === 0) {
      toast.error(`Tiada data sebut harga rasmi ditemui di DB bagi tahun ${selectedAnnualYear}. Dibuka sebagai draf ditaip.`);
      return;
    }

    setRowsAnnual(mapped);
    toast.success(`Berjaya memadankan ${mapped.length} data perolehan baharu dari Pangkalan Data!`);
  };

  const handleAddAnnualRow = () => {
    const nextNum = rowsAnnual.length + 1;
    const newRow: RowAnnual = {
      id: `custom-ann-${Math.random().toString(36).substring(2, 9)}`,
      title: 'CADANGAN PROJEK PEROLEHAN BARU...',
      category: 'KERJA',
      tenderNo: `SH/S.6-${String(nextNum).padStart(2, '0')}/${selectedAnnualYear}`,
      tarikhSetujuTerima: '',
      tarikhSiapKerja: '',
      tempohSiapKerja: '',
      winnerName: 'TIADA',
      winningPrice: 0,
      noPesananTempatan: '',
      noBaucar: '',
      tarikhDibayar: '',
      tarikhSiapBaru: '',
      statusPelaksanaan: 'ON TIME',
      isCustom: true
    };
    setRowsAnnual([...rowsAnnual, newRow]);
    toast.success('Baris perolehan tahunan baru ditambah! Tekan "Simpan" untuk menyimpan secara kekal.');
  };

  const handleSaveAnnualRow = async (r: RowAnnual) => {
    if (!selectedAnnualYear) return;
    setLoading(true);
    try {
      const annualRowData = {
        ...r,
        year: selectedAnnualYear,
        office: selectedOffice || office || '',
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'annual_rows', r.id), annualRowData, { merge: true });

      const isExistingAd = allAds.some(ad => ad.id === r.id);
      if (isExistingAd) {
        const updatePayload: any = {
          title: r.title,
          category: r.category,
          tenderNo: r.tenderNo,
          tarikhSetujuTerima: r.tarikhSetujuTerima,
          tarikhSiapKerja: r.tarikhSiapKerja,
          tempohSiapKerja: r.tempohSiapKerja,
          winnerName: r.winnerName,
          winningPrice: Number(r.winningPrice) || 0,
          noPesananTempatan: r.noPesananTempatan || '',
          noBaucar: r.noBaucar || '',
          tarikhDibayar: r.tarikhDibayar || '',
          tarikhSiapBaru: r.tarikhSiapBaru || '',
          statusPelaksanaan: r.statusPelaksanaan || 'ON TIME',
          updatedAt: new Date().toISOString()
        };

        if (r.winnerName) {
          updatePayload['winner.companyName'] = r.winnerName;
        }
        if (r.winningPrice !== undefined) {
          updatePayload['winner.winningPrice'] = Number(r.winningPrice) || 0;
        }

        await updateDoc(doc(db, 'ads', r.id), updatePayload);
      }

      setEditingRowId(null);
      await fetchDatabaseData(true);
      toast.success('Rekod perolehan berjaya disimpan ke Pangkalan Data!');
    } catch (err: any) {
      console.error('Error saving annual row:', err);
      toast.error('Gagal menyimpan rekod: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAllAnnualRows = async () => {
    if (!selectedAnnualYear || rowsAnnual.length === 0) return;
    setLoading(true);
    try {
      for (const r of rowsAnnual) {
        const annualRowData = {
          ...r,
          year: selectedAnnualYear,
          office: selectedOffice || office || '',
          updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'annual_rows', r.id), annualRowData, { merge: true });

        const isExistingAd = allAds.some(ad => ad.id === r.id);
        if (isExistingAd) {
          const updatePayload: any = {
            title: r.title,
            category: r.category,
            tenderNo: r.tenderNo,
            tarikhSetujuTerima: r.tarikhSetujuTerima,
            tarikhSiapKerja: r.tarikhSiapKerja,
            tempohSiapKerja: r.tempohSiapKerja,
            winnerName: r.winnerName,
            winningPrice: Number(r.winningPrice) || 0,
            noPesananTempatan: r.noPesananTempatan || '',
            noBaucar: r.noBaucar || '',
            tarikhDibayar: r.tarikhDibayar || '',
            tarikhSiapBaru: r.tarikhSiapBaru || '',
            statusPelaksanaan: r.statusPelaksanaan || 'ON TIME',
            updatedAt: new Date().toISOString()
          };

          if (r.winnerName) {
            updatePayload['winner.companyName'] = r.winnerName;
          }
          if (r.winningPrice !== undefined) {
            updatePayload['winner.winningPrice'] = Number(r.winningPrice) || 0;
          }

          await updateDoc(doc(db, 'ads', r.id), updatePayload);
        }
      }

      setEditingRowId(null);
      await fetchDatabaseData(true);
      toast.success(`Semua ${rowsAnnual.length} rekod Laporan Tahunan ${selectedAnnualYear} berjaya disimpan secara kekal!`);
    } catch (err: any) {
      console.error('Error saving all annual rows:', err);
      toast.error('Gagal menyimpan laporan tahunan: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnnualRow = async (id: string) => {
    setRowsAnnual(prev => prev.filter(r => r.id !== id));
    try {
      await deleteDoc(doc(db, 'annual_rows', id));
    } catch (err) {
      console.error('Error deleting annual row from DB:', err);
    }
    toast.success('Rekod sebut harga berjaya dipadam dari laporan tahunan.');
  };

  const handleAnnualCellChange = (index: number, field: keyof RowAnnual, val: any) => {
    const updated = [...rowsAnnual];
    const finalVal = typeof val === 'string' ? val.toUpperCase() : val;
    const updatedRow = { ...updated[index], [field]: finalVal };

    const isReTender = Boolean(
      updatedRow.winnerName && updatedRow.winnerName.toUpperCase().includes('SEBUTHARGA SEMULA')
    );

    if (isReTender) {
      updatedRow.tempohSiapKerja = '';
      updatedRow.winningPrice = 0;
      updatedRow.statusPelaksanaan = 'TAMAT';
      updatedRow.tarikhSetujuTerima = '';
      updatedRow.tarikhSiapKerja = '';
    } else if (field === 'tarikhSetujuTerima' || field === 'tarikhSiapKerja') {
      const computed = calculateTempohSiapKerja(updatedRow.tarikhSetujuTerima, updatedRow.tarikhSiapKerja);
      if (computed) {
        updatedRow.tempohSiapKerja = computed;
      }
    }

    updated[index] = updatedRow;
    setRowsAnnual(updated);
  };

  const handleResetAnnualMockup = () => {
    if (selectedAnnualYear) {
      setRowsAnnual(getInitialMockAnnual(selectedAnnualYear));
      toast.success(`Laporan tahun ${selectedAnnualYear} diset semula ke bentuk Draf Asal`);
    }
  };

  const handleExportAnnual = (format: 'pdf' | 'excel' | 'word') => {
    if (!selectedAnnualYear) return;
    const exportParams = {
      year: selectedAnnualYear,
      office,
      rows: rowsAnnual
    };

    if (format === 'pdf') {
      exportAnnualToPDF(exportParams);
    } else if (format === 'excel') {
      exportAnnualToExcel(exportParams);
    } else if (format === 'word') {
      exportAnnualToWord(exportParams);
    }
    toast.success(`Jana Fail Laporan Tahunan ${selectedAnnualYear} (${format.toUpperCase()}) berjaya!`);
  };

  // Dynamic system-wide data states
  const [locations, setLocations] = useState<any[]>([]);
  const [allAds, setAllAds] = useState<any[]>([]);
  const [allOrderRequests, setAllOrderRequests] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string>('SEMUA');
  const [summaryStats, setSummaryStats] = useState({
    totalAds: 0,
    totalStaff: 0,
    successfulSuppliers: 0,
    officialDecisions: 0
  });
  const [officeCounts, setOfficeCounts] = useState<any[]>([]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#sukuan') setView('sukuan');
      else if (hash === '#tahunan') setView('tahunan');
      else setView('summary');
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Update default Office & lock selection based on user context
  useEffect(() => {
    if (userOffice) {
      setSelectedOffice(userOffice);
    } else {
      setSelectedOffice('SEMUA');
    }
  }, [userOffice]);

  useEffect(() => {
    if (selectedOffice && selectedOffice !== 'SEMUA') {
      setOffice(`PEJABAT RISDA DAERAH ${selectedOffice.toUpperCase()}`);
    } else {
      setOffice('PEJABAT RISDA DAERAH BEAUFORT');
    }
  }, [selectedOffice]);

  // Set default setakat date when quarter selection changes
  useEffect(() => {
    if (selectedQuarter === 'Q1') setAsOfDate(`31 Mac ${selectedYear}`);
    else if (selectedQuarter === 'Q2') setAsOfDate(`30 Jun ${selectedYear}`);
    else if (selectedQuarter === 'Q3') setAsOfDate(`30 September ${selectedYear}`);
    else if (selectedQuarter === 'Q4') setAsOfDate(`31 Disember ${selectedYear}`);
  }, [selectedQuarter, selectedYear]);

  const isStaff = role === 'admin' || role === 'penginput' || role === 'pelulus' || role === 'pentadbir';

  const getPintasanAds = () => {
    let targetOffice = '';
    if (selectedOffice && selectedOffice !== 'SEMUA') {
      targetOffice = selectedOffice;
    } else if (userOffice && userOffice !== 'SEMUA') {
      targetOffice = userOffice;
    }

    return allAds.filter(ad => {
      // Exclude DRAF
      if (ad.status === 'DRAF') return false;

      if (targetOffice) {
        const adOffice = ad.office || '';
        return adOffice.trim().toLowerCase() === targetOffice.trim().toLowerCase();
      }
      return true;
    });
  };

  const getAdCountForYear = (yr: number) => {
    return allAds.filter(ad => {
      if (selectedOffice && selectedOffice !== 'SEMUA') {
        const adOffice = ad.office || '';
        if (adOffice.trim().toLowerCase() !== selectedOffice.trim().toLowerCase()) return false;
      }
      const dateStr = getNormalizedDecisionDate(ad) || ad.winner?.timestamp || ad.visitDate || ad.closingDate || ad.createdAt || ad.publishedDate;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return !isNaN(date.getTime()) && date.getFullYear() === yr;
    }).length;
  };

  const currentYear = new Date().getFullYear();
  const yearlyReports = [
    { year: currentYear.toString(), status: 'Draf Semasa' },
    { year: (currentYear - 1).toString(), status: 'Arkib Selesai' },
    { year: (currentYear - 2).toString(), status: 'Arkib Selesai' },
    { year: (currentYear - 3).toString(), status: 'Arkib Selesai' },
  ];

  // Core background data fetching from Firestore
  const fetchDatabaseData = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const locSnap = await getDocs(collection(db, 'locations'));
      const locList = locSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLocations(locList);

      const adsSnap = await getDocs(collection(db, 'ads'));
      const adsList = adsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
      setAllAds(adsList);

      const ordersSnap = await getDocs(collection(db, 'orderRequests'));
      const ordersList = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
      setAllOrderRequests(ordersList);

      const usersSnap = await getDocs(collection(db, 'users'));
      const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
      setAllUsers(usersList);

      const annualSnap = await getDocs(collection(db, 'annual_rows'));
      const annualList = annualSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as RowAnnual);
      setCustomAnnualRows(annualList);
    } catch (err) {
      console.error('Error fetching dashboard statistics data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabaseData(true);
  }, []);

  // Compute dynamic stats dashboard metrics on data changes
  useEffect(() => {
    const userScope = { role, state: userState, district: userDistrict, office: userOffice };
    const filteredAds = allAds.filter(ad => {
      if (!isWithinUserScope(ad, userScope)) return false;
      if (selectedOffice && selectedOffice !== 'SEMUA') {
        const adOffice = ad.office || '';
        return adOffice.trim().toLowerCase() === selectedOffice.trim().toLowerCase();
      }
      return true;
    });

    const filteredUsers = allUsers.filter(u => {
      if (!isWithinUserScope(u, userScope)) return false;
      if (selectedOffice && selectedOffice !== 'SEMUA') {
        const uOffice = u.office || '';
        return uOffice.trim().toLowerCase() === selectedOffice.trim().toLowerCase();
      }
      return true;
    });

    const suppliers = filteredAds.filter(ad => {
      return ad.winner && ad.winner.companyName && ad.winner.companyName !== 'TIADA';
    });

    const decisions = filteredAds.filter(ad => ad.status === 'SELESAI (KEPUTUSAN)');

    setSummaryStats({
      totalAds: filteredAds.length,
      totalStaff: filteredUsers.length,
      successfulSuppliers: suppliers.length,
      officialDecisions: decisions.length
    });
  }, [allAds, allUsers, selectedOffice]);

  // Compute Sabah layout district metrics
  useEffect(() => {
    const counts: { [key: string]: number } = {};
    allAds.forEach(ad => {
      const off = (ad.office || 'TIDAK DITETAPKAN').toUpperCase();
      counts[off] = (counts[off] || 0) + 1;
    });

    const list = Object.entries(counts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    const maxCount = list.length > 0 ? list[0].count : 1;
    const finalCounts = list.map(item => ({
      ...item,
      percentage: Math.min(100, Math.max(10, Math.round((item.count / maxCount) * 100)))
    }));

    setOfficeCounts(finalCounts);
  }, [allAds]);

  // Map to A1 & A2 rows dynamically matching database registries
  const syncQuarterlyReportRows = () => {
    const filtered = allAds.filter(ad => {
      if (selectedOffice && selectedOffice !== 'SEMUA') {
        const adOffice = ad.office || '';
        if (adOffice.trim().toLowerCase() !== selectedOffice.trim().toLowerCase()) return false;
      }

      // Check if official decision has been launched and winner is finalized
      const isWinnerDecided = ad.status === 'SELESAI (KEPUTUSAN)' || (ad.winner && ad.winner.companyName && ad.winner.companyName !== 'TIADA');
      if (!isWinnerDecided) return false;

      // Classify the quarter based strictly on the winner decision date
      const dateStr = getNormalizedDecisionDate(ad) || ad.winner?.timestamp || ad.updatedAt || ad.closingDate || ad.createdAt;
      if (!dateStr) return false;

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return false;

      if (date.getFullYear().toString() !== selectedYear) return false;

      const m = date.getMonth();
      if (selectedQuarter === 'Q1') return m >= 0 && m <= 2;
      if (selectedQuarter === 'Q2') return m >= 3 && m <= 5;
      if (selectedQuarter === 'Q3') return m >= 6 && m <= 8;
      if (selectedQuarter === 'Q4') return m >= 9 && m <= 11;
      return false;
    });

    if (filtered.length === 0) {
      setRowsA2([]);
      setActiveA2Edits({});
      setRowsA1([
        { category: 'BEKALAN', perancanganBil: 0, perancanganNilai: 0, belumPelawaBil: 0, prosesIklanBil: 0, prosesPenilaianBil: 0, prosesJkBil: 0, belumSstBil: 0, sstBumiBil: 0, sstBumiNilai: 0, sstNonBumiBil: 0, sstNonBumiNilai: 0, syorJangkaan: '' },
        { category: 'PERKHIDMATAN', perancanganBil: 0, perancanganNilai: 0, belumPelawaBil: 0, prosesIklanBil: 0, prosesPenilaianBil: 0, prosesJkBil: 0, belumSstBil: 0, sstBumiBil: 0, sstBumiNilai: 0, sstNonBumiBil: 0, sstNonBumiNilai: 0, syorJangkaan: '' },
        { category: 'KERJA', perancanganBil: 0, perancanganNilai: 0, belumPelawaBil: 0, prosesIklanBil: 0, prosesPenilaianBil: 0, prosesJkBil: 0, belumSstBil: 0, sstBumiBil: 0, sstBumiNilai: 0, sstNonBumiBil: 0, sstNonBumiNilai: 0, syorJangkaan: '' }
      ]);
      return;
    }

    const mappedA2: RowA2[] = filtered.map(ad => {
      const isReTender = Boolean(
        ad.winner?.isReTender || 
        ad.winner?.companyName === 'SEBUTHARGA SEMULA' || 
        ad.winnerName === 'SEBUTHARGA SEMULA' || 
        ad.winner?.companyName?.toUpperCase() === 'SEBUTHARGA SEMULA' ||
        ad.winnerName?.toUpperCase() === 'SEBUTHARGA SEMULA' ||
        ad.statusPelaksanaan === 'SEBUTHARGA SEMULA'
      );

      let winningPrice = 0;
      if (isReTender) {
        winningPrice = 0;
      } else if (ad.winner?.winningPrice) {
        winningPrice = Number(ad.winner.winningPrice) || 0;
      } else if (ad.tenderNo === 'S.H/S.6-04/2025') {
        winningPrice = 127000;
      } else if (ad.tenderNo === 'S.H/S.6-05/2025') {
        winningPrice = 70000;
      } else if (ad.winner) {
        winningPrice = 50000;
      }

      let jenisPeruntukan = (ad as any).jenisPeruntukan || 'BLK';
      if (!(ad as any).jenisPeruntukan) {
        if (ad.title?.toLowerCase().includes('kwr')) {
          jenisPeruntukan = 'KWR';
        } else {
          jenisPeruntukan = 'BLK';
        }
      }

      const tenderNorm = (ad.tenderNo || '').toUpperCase().replace(/\s+/g, '');
      if (
        tenderNorm.includes('06/2024') ||
        tenderNorm.includes('07/2024') ||
        tenderNorm.includes('S.6-06/2024') ||
        tenderNorm.includes('S.6-07/2024') ||
        tenderNorm.includes('SH/S.6-06/2024') ||
        tenderNorm.includes('SH/S.6-07/2024')
      ) {
        jenisPeruntukan = 'BLK';
      }

      return {
        id: ad.id,
        tenderNo: (ad.tenderNo || 'S.H/S.6-0X/2025').toUpperCase(),
        category: (ad.category || 'KERJA').toUpperCase() as any,
        jenisPeruntukan: jenisPeruntukan.toUpperCase(),
        title: (ad.title || '').toUpperCase(),
        winnerName: isReTender ? 'SEBUTHARGA SEMULA' : (ad.winner?.companyName || ad.winnerName || 'TIADA').toUpperCase(),
        winningPrice
      };
    });
    setRowsA2(mappedA2);
    setActiveA2Edits({});

    const computedA1 = (['BEKALAN', 'PERKHIDMATAN', 'KERJA'] as const).map(cat => {
      const catAds = filtered.filter(a => (a.category || 'KERJA') === cat);
      const catA2 = mappedA2.filter(a => a.category === cat);

      const perancanganBil = catAds.length;
      const perancanganNilai = catA2.reduce((sum, a) => sum + a.winningPrice, 0);

      const belumPelawaBil = catAds.filter(a => a.status === 'DRAF').length;
      const prosesIklanBil = catAds.filter(a => a.status === 'AKTIF').length;
      const prosesPenilaianBil = catAds.filter(a => {
        if (a.status === 'SELESAI (KEPUTUSAN)') return false;
        if (a.closingDate) return new Date(a.closingDate) < new Date();
        return false;
      }).length;

      const winningBumi = catA2.filter(a => a.winnerName !== 'TIADA');
      const sstBumiBil = winningBumi.length;
      const sstBumiNilai = winningBumi.reduce((sum, a) => sum + a.winningPrice, 0);

      const hasDecision = catAds.some(ad => {
        const isReTender = ad.winner?.companyName === 'SEBUTHARGA SEMULA' || ad.winnerName === 'SEBUTHARGA SEMULA' || ad.statusPelaksanaan === 'SEBUTHARGA SEMULA';
        return !isReTender && (ad.status === 'SELESAI (KEPUTUSAN)' || (ad.winner && ad.winner.companyName && ad.winner.companyName !== 'TIADA'));
      });

      // Calculate the highest duration in weeks for projects in this category based on winner selection dates / duration
      let maxWeeks = 0;
      catAds.forEach(ad => {
        const isReTender = Boolean(
          ad.winner?.isReTender ||
          ad.winner?.companyName === 'SEBUTHARGA SEMULA' ||
          ad.winnerName === 'SEBUTHARGA SEMULA' ||
          ad.winner?.companyName?.toUpperCase() === 'SEBUTHARGA SEMULA' ||
          ad.winnerName?.toUpperCase() === 'SEBUTHARGA SEMULA' ||
          ad.statusPelaksanaan === 'SEBUTHARGA SEMULA'
        );
        if (isReTender) return;

        // Try start & end dates from winner or ad level
        const startDateStr = ad.winner?.contractStartDate || ad.contractStartDate || ad.winner?.tarikhSetujuTerima || ad.tarikhSetujuTerima;
        const endDateStr = ad.winner?.contractEndDate || ad.contractEndDate || ad.winner?.tarikhSiapKerja || ad.tarikhSiapKerja;

        let weeks = 0;
        if (startDateStr && endDateStr) {
          const tempohStr = calculateTempohSiapKerja(startDateStr, endDateStr);
          const match = tempohStr.match(/(\d+)\s*MINGGU/i) || tempohStr.match(/(\d+)/);
          if (match) {
            weeks = parseInt(match[1], 10) || 0;
          }
        }

        if (weeks <= 0) {
          const directTempoh = ad.winner?.tempohSiapKerja || ad.tempohSiapKerja || ad.tempoh || '';
          const match = directTempoh.match(/(\d+)\s*MINGGU/i) || directTempoh.match(/(\d+)/);
          if (match) {
            weeks = parseInt(match[1], 10) || 0;
          }
        }

        if (weeks > maxWeeks) {
          maxWeeks = weeks;
        }
      });

      let syorJangkaanText = '';
      if (maxWeeks > 0) {
        syorJangkaanText = `${maxWeeks} MINGGU`;
      } else if (hasDecision) {
        syorJangkaanText = cat === 'BEKALAN' ? '12 MINGGU' : cat === 'KERJA' ? '11 MINGGU' : '';
      }

      return {
        category: cat,
        perancanganBil,
        perancanganNilai,
        belumPelawaBil,
        prosesIklanBil,
        prosesPenilaianBil,
        prosesJkBil: 0,
        belumSstBil: 0,
        sstBumiBil,
        sstBumiNilai,
        sstNonBumiBil: 0,
        sstNonBumiNilai: 0,
        syorJangkaan: syorJangkaanText
      };
    });
    setRowsA1(computedA1);
  };

  useEffect(() => {
    if (allAds.length > 0) {
      syncQuarterlyReportRows();
    }
  }, [allAds, selectedQuarter, selectedYear, selectedOffice]);

  if (!isStaff) {
    return (
      <div className="p-20 text-center">
        <div className="w-20 h-20 bg-risda-orange/10 rounded-full flex items-center justify-center mx-auto mb-6 text-risda-orange">
          <FileBarChart size={40} />
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Akses Terhad</h2>
        <p className="text-sm text-risda-muted mt-2 uppercase tracking-[2px]">Ciri ini hanya boleh diakses oleh Kakitangan Sahaja.</p>
      </div>
    );
  }

  const handleLoadFromDatabase = async () => {
    setLoading(true);
    const loadingToast = toast.loading('Mengambil iklan segar dari pangkalan data...');
    try {
      await fetchDatabaseData(true);
      syncQuarterlyReportRows();
      toast.success('Berjaya memadankan data daripada pangkalan data!', { id: loadingToast });
    } catch (e) {
      console.error(e);
      toast.error('Gagal membina rumusan sepadan.', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };


  // Reset reporting tables back to standard mockup data patterns matching the pdf images
  const handleResetMockup = () => {
    setRowsA1([
      { category: 'BEKALAN', perancanganBil: 0, perancanganNilai: 0, belumPelawaBil: 0, prosesIklanBil: 0, prosesPenilaianBil: 0, prosesJkBil: 0, belumSstBil: 0, sstBumiBil: 0, sstBumiNilai: 0, sstNonBumiBil: 0, sstNonBumiNilai: 0, syorJangkaan: '' },
      { category: 'PERKHIDMATAN', perancanganBil: 0, perancanganNilai: 0, belumPelawaBil: 0, prosesIklanBil: 0, prosesPenilaianBil: 0, prosesJkBil: 0, belumSstBil: 0, sstBumiBil: 0, sstBumiNilai: 0, sstNonBumiBil: 0, sstNonBumiNilai: 0, syorJangkaan: '' },
      { category: 'KERJA', perancanganBil: 0, perancanganNilai: 0, belumPelawaBil: 0, prosesIklanBil: 0, prosesPenilaianBil: 0, prosesJkBil: 0, belumSstBil: 0, sstBumiBil: 0, sstBumiNilai: 0, sstNonBumiBil: 0, sstNonBumiNilai: 0, syorJangkaan: '' }
    ]);
    setRowsA2([]);
    // Reset active edits to empty
    setActiveA2Edits({});

    setSelectedYear(new Date().getFullYear().toString());
    setSelectedQuarter('Q1');
    setOffice('PEJABAT RISDA DAERAH BEAUFORT');
    setAsOfDate(`31 Mac ${new Date().getFullYear()}`);
    toast.success('Laporan diset semula dengan rekod kosong');
  };

  // Inline Handlers for A1 Edit Cells
  const handleA1CellChange = (index: number, field: keyof RowA1, val: any) => {
    const updated = [...rowsA1];
    updated[index] = { ...updated[index], [field]: val };
    setRowsA1(updated);
  };

  // Inline Handlers for A2 Edit Cells
  const handleA2CellChange = (index: number, field: keyof RowA2, val: any) => {
    const updated = [...rowsA2];
    const finalVal = typeof val === 'string' ? val.toUpperCase() : val;
    const updatedRow = { ...updated[index], [field]: finalVal };

    const isReTender = Boolean(
      updatedRow.winnerName && updatedRow.winnerName.toUpperCase().includes('SEBUTHARGA SEMULA')
    );

    if (isReTender) {
      updatedRow.winningPrice = 0;
      updatedRow.winnerName = 'SEBUTHARGA SEMULA';
    }

    updated[index] = updatedRow;
    setRowsA2(updated);

    // Recompute Jadual 1 totals if winningPrice or winnerName or category changes
    if (field === 'winningPrice' || field === 'winnerName' || field === 'category') {
      setRowsA1(prevA1 => {
        return prevA1.map(r1 => {
          const catA2 = updated.filter(a => a.category === r1.category);
          if (catA2.length === 0) return r1;

          const perancanganNilai = catA2.reduce((sum, a) => sum + (Number(a.winningPrice) || 0), 0);
          const winningBumi = catA2.filter(a => a.winnerName && a.winnerName !== 'TIADA');
          const sstBumiNilai = winningBumi.reduce((sum, a) => sum + (Number(a.winningPrice) || 0), 0);

          return {
            ...r1,
            perancanganNilai,
            sstBumiNilai
          };
        });
      });
    }
  };

  // Add custom manual record to Lampiran A2 table (Starts completely empty)
  const handleAddA2Row = () => {
    const nextNum = rowsA2.length + 1;
    const newId = `custom-${Math.random()}`;
    const newRow: RowA2 = {
      id: newId,
      tenderNo: '',
      category: '',
      jenisPeruntukan: '',
      title: '',
      winnerName: '',
      winningPrice: 0,
      isCustom: true
    };
    setRowsA2([...rowsA2, newRow]);
    setActiveA2Edits(prev => ({ ...prev, [newId]: true }));
    toast.success('Baris projek kosong baru ditambah!');
  };

  const handleDeleteA2Row = (id: string) => {
    setRowsA2(rowsA2.filter(r => r.id !== id));
    toast.success('Baris perincian perolehan berjaya dipadam.');
  };

  // Get Quarter Name mapping
  const getQuarterLabel = (q: string) => {
    if (q === 'Q1') return 'PERTAMA';
    if (q === 'Q2') return 'KEDUA';
    if (q === 'Q3') return 'KETIGA';
    return 'KEEMPAT';
  };

  // Compute Totals dynamically
  const totalsA1 = {
    perancanganBil: rowsA1.reduce((sum, r) => sum + r.perancanganBil, 0),
    perancanganNilai: rowsA1.reduce((sum, r) => sum + r.perancanganNilai, 0),
    belumPelawaBil: rowsA1.reduce((sum, r) => sum + r.belumPelawaBil, 0),
    prosesIklanBil: rowsA1.reduce((sum, r) => sum + r.prosesIklanBil, 0),
    prosesPenilaianBil: rowsA1.reduce((sum, r) => sum + r.prosesPenilaianBil, 0),
    prosesJkBil: rowsA1.reduce((sum, r) => sum + r.prosesJkBil, 0),
    belumSstBil: rowsA1.reduce((sum, r) => sum + r.belumSstBil, 0),
    sstBumiBil: rowsA1.reduce((sum, r) => sum + r.sstBumiBil, 0),
    sstBumiNilai: rowsA1.reduce((sum, r) => sum + r.sstBumiNilai, 0),
    sstNonBumiBil: rowsA1.reduce((sum, r) => sum + r.sstNonBumiBil, 0),
    sstNonBumiNilai: rowsA1.reduce((sum, r) => sum + r.sstNonBumiNilai, 0),
  };

  // Trigger export downloads
  const handleExport = (format: 'pdf' | 'excel' | 'word') => {
    const qLabel = getQuarterLabel(selectedQuarter);
    const exportParams = {
      year: selectedYear,
      quarterName: qLabel,
      office,
      asOfDate,
    };

    if (activeTab === 'a1') {
      if (format === 'pdf') exportA1ToPDF({ ...exportParams, rows: rowsA1 });
      else if (format === 'excel') exportA1ToExcel({ ...exportParams, rows: rowsA1 });
      else if (format === 'word') exportA1ToWord({ ...exportParams, rows: rowsA1 });
      toast.success(`Jana Fail Lampiran A1 (${format.toUpperCase()}) berjaya!`);
    } else {
      if (format === 'pdf') exportA2ToPDF({ ...exportParams, rows: rowsA2 });
      else if (format === 'excel') exportA2ToExcel({ ...exportParams, rows: rowsA2 });
      else if (format === 'word') exportA2ToWord({ ...exportParams, rows: rowsA2 });
      toast.success(`Jana Fail Lampiran A2 (${format.toUpperCase()}) berjaya!`);
    }
  };

  return (
    <div className="space-y-8 p-8 w-full min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-risda-orange mb-2">
            <FileBarChart size={32} />
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-[4px] text-white">
              {view === 'summary' && 'Ringkasan Statistik Sebutharga'}
              {view === 'sukuan' && 'Laporan Pengurusan Perolehan Sukuan'}
              {view === 'tahunan' && 'Laporan Tahunan Perolehan'}
            </h1>
          </div>
          <p className="text-[10px] md:text-xs text-risda-muted font-bold uppercase tracking-[4px]">
            {view === 'summary' && 'Paparan Keseluruhan Prestasi Perolehan RISDA Sabah'}
            {view === 'sukuan' && 'Penjana & Editor Laporan Format Lampiran A1 & A2 (Boleh Diedit)'}
            {view === 'tahunan' && 'Rekod Arkib Analisis Komprehensif Perolehan Berjalan'}
          </p>
        </div>

        {/* Action controls for quarterly page */}
        {view === 'sukuan' && (
          <div className="flex items-center flex-wrap gap-2">
            <button 
              onClick={handleLoadFromDatabase}
              disabled={loading}
              className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:border-risda-orange/50 transition-all text-xs font-black uppercase tracking-wider flex items-center gap-2"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Padan Data DB
            </button>
            <button 
              onClick={handleResetMockup}
              className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all text-xs font-black uppercase tracking-wider"
            >
              Set Semula
            </button>
          </div>
        )}
      </header>

      {/* Main Tabs Selection */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-2xl w-fit">
        <button 
          onClick={() => { setView('summary'); window.location.hash = ''; }}
          className={`px-5 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all ${view === 'summary' ? 'bg-risda-orange text-black' : 'text-white hover:bg-white/5'}`}
        >
          RINGKASAN DASHBOARD
        </button>
        <button 
          onClick={() => { setView('sukuan'); window.location.hash = '#sukuan'; }}
          className={`px-5 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all ${view === 'sukuan' ? 'bg-risda-orange text-black' : 'text-white hover:bg-white/5'}`}
        >
          LAPORAN SUKUAN (A1 & A2)
        </button>
        <button 
          onClick={() => { setView('tahunan'); window.location.hash = '#tahunan'; }}
          className={`px-5 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all ${view === 'tahunan' ? 'bg-risda-orange text-black' : 'text-white hover:bg-white/5'}`}
        >
          LAPORAN TAHUNAN
        </button>
      </div>

      {/* Unified Office / PTJ Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-risda-orange/15 text-risda-orange flex items-center justify-center font-bold">
            PTJ
          </div>
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider">Pejabat RISDA Negeri Sabah</h4>
            <p className="text-[10px] text-risda-muted uppercase font-bold tracking-widest">
              {selectedOffice === 'SEMUA' ? 'Semua Pejabat & Daerah Berdaftar' : `Pusat Tanggungjawab: Daerah ${selectedOffice.toUpperCase()}`}
            </p>
          </div>
        </div>

        <div>
          {role === 'admin' || role === 'pentadbir' ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-risda-muted uppercase tracking-wider">Tapis PTJ (Kuasa Pentadbir):</span>
              <select
                value={selectedOffice}
                onChange={(e) => setSelectedOffice(e.target.value)}
                className="bg-[#121212] border border-white/15 text-white text-xs rounded-xl py-2 px-4 outline-none font-bold select-none h-11 uppercase"
              >
                <option value="SEMUA">SEMUA PEJABAT / DAERAH</option>
                {locations.filter(loc => loc.office).map((loc: any) => (
                  <option key={loc.id} value={loc.office}>
                    {String(loc.office).toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl">
              <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">● DIKUNCI KEPADA</span>
              <span className="text-white text-xs font-black uppercase tracking-tight">{selectedOffice.toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* SUMMARY DASHBOARD VIEW */}
        {view === 'summary' && (
          <motion.div 
            key="summary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ReportStat cardTitle="Iklan Berdaftar" value={summaryStats.totalAds.toString()} trend="Sistem" icon={FileText} />
              <ReportStat cardTitle="Pembekal Berjaya" value={summaryStats.successfulSuppliers.toString()} trend="SST" icon={FileCheck} />
              <ReportStat cardTitle="Keputusan Rasmi" value={summaryStats.officialDecisions.toString()} trend="Urus setia" icon={CheckCircle} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6">
              <div className="glass-card p-8 rounded-3xl space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h3 className="text-sm font-black uppercase tracking-[2px] text-risda-orange">Kemasukan Iklan Mengikut Pejabat / Daerah</h3>
                </div>
                <div className="space-y-5 max-h-[300px] overflow-y-auto pr-2">
                  {officeCounts.length > 0 ? (
                    officeCounts.map((item) => (
                      <StateBar key={item.name} name={item.name} percentage={item.percentage} count={item.count} />
                    ))
                  ) : (
                    <p className="text-xs text-risda-muted font-bold tracking-wider text-center py-6 uppercase">Tiada rekod data dijumpai</p>
                  )}
                </div>
              </div>

              <div className="glass-card p-8 rounded-3xl space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h3 className="text-sm font-black uppercase tracking-[2px] text-risda-orange">Pintasan Dokumen Perolehan</h3>
                </div>
                <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                  {getPintasanAds().length > 0 ? (
                    getPintasanAds().flatMap((ad) => {
                      const items = [];
                      
                      // 1. Iklan PDF (Tender Spek/Notis)
                      items.push(
                        <DownloadItem
                          key={`iklan-${ad.id}`}
                          title={`DOKUMEN IKLAN: ${ad.tenderNo}`}
                          subtitle={ad.title}
                          date={`TUTUP: ${formatDate(ad.closingDate)}`}
                          size="2.4 MB"
                          onClick={async () => {
                            const t = toast.loading('Menjana PDF Iklan...');
                            try {
                              await exportToPDF(ad);
                              toast.success('PDF Iklan berjaya dijana!', { id: t });
                            } catch (err) {
                              console.error(err);
                              toast.error('Gagal menjana PDF Iklan', { id: t });
                            }
                          }}
                        />
                      );

                      // 2. Keputusan PDF (if finalized/has winner)
                      if (ad.status === 'SELESAI (KEPUTUSAN)' || (ad.winner && ad.winner.companyName)) {
                        const resultParams = {
                          tenderNo: ad.tenderNo || '',
                          title: ad.title || '',
                          office: ad.office || '',
                          winnerName: ad.winner?.companyName || 'TIADA',
                          startDate: ad.winner?.contractStartDate || ad.contractStartDate || '-',
                          endDate: ad.winner?.contractEndDate || ad.contractEndDate || '-',
                          location: ad.winner?.location || ad.location || ad.visitVenue || '-'
                        };
                        
                        items.push(
                          <DownloadItem
                            key={`keputusan-${ad.id}`}
                            title={`KEPUTUSAN RASMI: ${ad.tenderNo}`}
                            subtitle={`Pembekal: ${ad.winner?.companyName || 'TIADA'}`}
                            date={`KONTRAK: ${formatDate(ad.winner?.contractStartDate)} - ${formatDate(ad.winner?.contractEndDate)}`}
                            size="1.1 MB"
                            onClick={async () => {
                              const t = toast.loading('Menjana PDF Keputusan...');
                              try {
                                await exportResultToPDF(resultParams);
                                toast.success('PDF Keputusan berjaya dijana!', { id: t });
                              } catch (err) {
                                console.error(err);
                                toast.error('Gagal menjana PDF Keputusan', { id: t });
                              }
                            }}
                          />
                        );
                      }
                      
                      return items;
                    })
                  ) : (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
                      <p className="text-xs text-risda-muted font-bold tracking-wider uppercase">Tiada dokumen perolehan ditemui untuk pejabat terpilih</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* SUKUAN REPORT VIEW (LAMPIRAN A1 & A2) */}
        {view === 'sukuan' && (
          <motion.div 
            key="sukuan"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Custom Report Modifiers Toolbar */}
            <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/[0.02] space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-risda-orange flex items-center gap-2">
                <Calendar size={14} />
                Parameter Penjanaan Laporan Seketika (Boleh Diedit)
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/50 uppercase tracking-wider">Tahun Laporan</label>
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full bg-white/5 rounded-xl border border-white/10 p-3 text-white text-xs font-bold uppercase"
                  >
                    {[
                      new Date().getFullYear() - 2,
                      new Date().getFullYear() - 1,
                      new Date().getFullYear(),
                      new Date().getFullYear() + 1
                    ].map(yr => (
                      <option key={yr} value={String(yr)} className="bg-[#121212]">{yr}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/50 uppercase tracking-wider">Suku Tahun</label>
                  <select 
                    value={selectedQuarter} 
                    onChange={(e) => setSelectedQuarter(e.target.value)}
                    className="w-full bg-white/5 rounded-xl border border-white/10 p-3 text-white text-xs font-bold uppercase"
                  >
                    <option value="Q1" className="bg-[#121212]">Suku Pertama (Jan-Mac)</option>
                    <option value="Q2" className="bg-[#121212]">Suku Kedua (Apr-Jun)</option>
                    <option value="Q3" className="bg-[#121212]">Suku Ketiga (Jul-Sep)</option>
                    <option value="Q4" className="bg-[#121212]">Suku Keempat (Okt-Dis)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/50 uppercase tracking-wider">Pusat Tanggungjawab (PTJ)</label>
                  <input 
                    type="text"
                    value={office}
                    onChange={(e) => setOffice(e.target.value)}
                    placeholder="Sila nyatakan PTJ..."
                    className="w-full bg-white/5 rounded-xl border border-white/10 p-3 text-white text-xs font-bold uppercase tracking-tight"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/50 uppercase tracking-wider">Tarikh Lapur Setakat</label>
                  <input 
                    type="text"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                    placeholder="E.g., 30 September 2025"
                    className="w-full bg-white/5 rounded-xl border border-white/10 p-3 text-white text-xs font-bold uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Sub-tabs & Exporters Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex p-1 bg-white/5 rounded-2xl w-fit">
                <button 
                  onClick={() => setActiveTab('a1')}
                  className={`px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all ${activeTab === 'a1' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
                >
                  JADUAL 1: STATUS PERANCANGAN (LAMPIRAN A1)
                </button>
                <button 
                  onClick={() => setActiveTab('a2')}
                  className={`px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all ${activeTab === 'a2' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
                >
                  JADUAL 2: SENARAI PROJEK (LAMPIRAN A2)
                </button>
              </div>

              {/* Exporters Bar */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleExport('pdf')}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Download size={13} />
                  PDF
                </button>
                <button 
                  onClick={() => handleExport('excel')}
                  className="px-4 py-2.5 bg-[#1F7246] hover:bg-[#165031] text-white rounded-xl transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                >
                  <FileSpreadsheet size={13} />
                  Excel
                </button>
                <button 
                  onClick={() => handleExport('word')}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                >
                  <FileText size={13} />
                  Word
                </button>
              </div>
            </div>

            {/* TAB CONTENT: LAMPIRAN A1 */}
            {activeTab === 'a1' && (
              <div className="space-y-4">
                <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl text-[10px] text-white/50 uppercase tracking-widest leading-relaxed">
                  Tip: Anda boleh menukar nombor-nombor di bawah dengan **mengklik dan menaip** terus ke dalam kotak sel. Data rumusan Jumlah di bahagian bawah akan munasabah secara automatik!
                </div>
                
                <div className="overflow-x-auto w-full border border-white/10 rounded-2xl">
                  <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
                    <thead>
                      <tr className="bg-white/10 text-white/80 font-black uppercase text-center border-b border-white/10">
                        <th rowSpan={3} className="p-3 border-r border-white/10">Kategori Perolehan</th>
                        <th colSpan={2} className="p-3 border-r border-white/10">Perancangan Tahunan Keseluruhan</th>
                        <th rowSpan={3} className="p-3 border-r border-white/10">Belum Pelawa</th>
                        <th colSpan={10} className="p-3 border-r border-white/10">Telah Dipelawa</th>
                        <th rowSpan={3} className="p-3">Syor dan jangkaan selesai</th>
                      </tr>
                      <tr className="bg-white/5 text-white/70 font-bold uppercase text-center border-b border-white/10">
                        <td rowSpan={2} className="p-2 border-r border-white/10">Bil</td>
                        <td rowSpan={2} className="p-2 border-r border-white/10">RM</td>
                        <td rowSpan={2} className="p-2 border-r border-white/10">Dalam proses iklan</td>
                        <td rowSpan={2} className="p-2 border-r border-white/10">Dalam proses penilaian</td>
                        <td rowSpan={2} className="p-2 border-r border-white/10">Dalam proses ke JK Sebut Harga</td>
                        <td rowSpan={2} className="p-2 border-r border-white/10">Belum Dikeluarkan SST</td>
                        <td colSpan={6} className="p-2">Telah Dikeluarkan Surat Setuju Terima / Pesanan Tempatan</td>
                      </tr>
                      <tr className="bg-white/[0.02] text-white/60 text-[10px] font-bold uppercase text-center border-b border-white/10">
                        <td colSpan={2} className="p-2 border-r border-white/10">Bumiputera</td>
                        <td colSpan={2} className="p-2 border-r border-white/10">Non-Bumiputera</td>
                        <td colSpan={2} className="p-2">Jumlah Besar</td>
                      </tr>
                      <tr className="bg-white/[0.05] text-risda-orange text-[9px] font-black text-center uppercase border-b border-white/15">
                        <td className="p-1 border-r border-white/10">Kategori</td>
                        <td className="p-1 border-r border-white/10">Bil</td>
                        <td className="p-1 border-r border-white/10">RM</td>
                        <td className="p-1 border-r border-white/10">Bil</td>
                        <td className="p-1 border-r border-white/10">Bil</td>
                        <td className="p-1 border-r border-white/10">Bil</td>
                        <td className="p-1 border-r border-white/10">Bil</td>
                        <td className="p-1 border-r border-white/10">Bil</td>
                        <td className="p-1 border-r border-white/10">Bil</td>
                        <td className="p-1 border-r border-white/10">RM</td>
                        <td className="p-1 border-r border-white/10">Bil</td>
                        <td className="p-1 border-r border-white/10">RM</td>
                        <td className="p-1 border-r border-white/10">Bil</td>
                        <td className="p-1 border-r border-white/10">RM</td>
                        <td className="p-1 font-mono">Status Tempoh</td>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-medium">
                      {rowsA1.map((r, index) => {
                        const totalBil = r.sstBumiBil + r.sstNonBumiBil;
                        const totalNilai = r.sstBumiNilai + r.sstNonBumiNilai;
                        return (
                          <tr key={r.category} className="hover:bg-white/5 transition-all text-center">
                            <td className="p-3 border-r border-white/10 text-left font-bold text-white uppercase">{r.category === 'BEKALAN' ? 'Bekalan' : r.category === 'PERKHIDMATAN' ? 'Perkhidmatan' : 'Kerja'}</td>
                            
                            {/* Perancangan */}
                            <td className="p-2 border-r border-white/10">
                              <input 
                                type="number" 
                                value={r.perancanganBil} 
                                onChange={(e) => handleA1CellChange(index, 'perancanganBil', Number(e.target.value) || 0)}
                                className="w-12 bg-white/5 rounded p-1 text-center text-white"
                              />
                            </td>
                            <td className="p-2 border-r border-white/10">
                              <input 
                                type="number" 
                                value={r.perancanganNilai} 
                                onChange={(e) => handleA1CellChange(index, 'perancanganNilai', Number(e.target.value) || 0)}
                                className="w-24 bg-white/5 rounded p-1 text-right text-white"
                              />
                            </td>

                            {/* Belum Pelawa */}
                            <td className="p-2 border-r border-white/10">
                              <input 
                                type="number" 
                                value={r.belumPelawaBil} 
                                onChange={(e) => handleA1CellChange(index, 'belumPelawaBil', Number(e.target.value) || 0)}
                                className="w-12 bg-white/5 rounded p-1 text-center text-white"
                              />
                            </td>

                            {/* Telah Dipelawa */}
                            <td className="p-2 border-r border-white/10">
                              <input 
                                type="number" 
                                value={r.prosesIklanBil} 
                                onChange={(e) => handleA1CellChange(index, 'prosesIklanBil', Number(e.target.value) || 0)}
                                className="w-12 bg-white/5 rounded p-1 text-center text-white"
                              />
                            </td>
                            <td className="p-2 border-r border-white/10">
                              <input 
                                type="number" 
                                value={r.prosesPenilaianBil} 
                                onChange={(e) => handleA1CellChange(index, 'prosesPenilaianBil', Number(e.target.value) || 0)}
                                className="w-12 bg-white/5 rounded p-1 text-center text-white"
                              />
                            </td>
                            <td className="p-2 border-r border-white/10">
                              <input 
                                type="number" 
                                value={r.prosesJkBil} 
                                onChange={(e) => handleA1CellChange(index, 'prosesJkBil', Number(e.target.value) || 0)}
                                className="w-12 bg-white/5 rounded p-1 text-center text-white"
                              />
                            </td>
                            <td className="p-2 border-r border-white/10">
                              <input 
                                type="number" 
                                value={r.belumSstBil} 
                                onChange={(e) => handleA1CellChange(index, 'belumSstBil', Number(e.target.value) || 0)}
                                className="w-12 bg-white/5 rounded p-1 text-center text-white"
                              />
                            </td>

                            {/* Bumiputera */}
                            <td className="p-2 border-r border-white/10">
                              <input 
                                type="number" 
                                value={r.sstBumiBil} 
                                onChange={(e) => handleA1CellChange(index, 'sstBumiBil', Number(e.target.value) || 0)}
                                className="w-12 bg-white/5 rounded p-1 text-center text-white"
                              />
                            </td>
                            <td className="p-2 border-r border-white/10">
                              <input 
                                type="number" 
                                value={r.sstBumiNilai} 
                                onChange={(e) => handleA1CellChange(index, 'sstBumiNilai', Number(e.target.value) || 0)}
                                className="w-24 bg-white/5 rounded p-1 text-right text-white"
                              />
                            </td>

                            {/* Non-Bumiputera */}
                            <td className="p-2 border-r border-white/10">
                              <input 
                                type="number" 
                                value={r.sstNonBumiBil} 
                                onChange={(e) => handleA1CellChange(index, 'sstNonBumiBil', Number(e.target.value) || 0)}
                                className="w-12 bg-white/5 rounded p-1 text-center text-white"
                              />
                            </td>
                            <td className="p-2 border-r border-white/10">
                              <input 
                                type="number" 
                                value={r.sstNonBumiNilai} 
                                onChange={(e) => handleA1CellChange(index, 'sstNonBumiNilai', Number(e.target.value) || 0)}
                                className="w-24 bg-white/5 rounded p-1 text-right text-white"
                              />
                            </td>

                            {/* Jumlah Besar */}
                            <td className="p-2 border-r border-white/10 font-bold text-white bg-white/[0.02]">
                              {totalBil}
                            </td>
                            <td className="p-2 border-r border-white/10 font-bold text-white bg-white/[0.02] text-right">
                              {totalNilai.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Syor */}
                            <td className="p-2">
                              <input 
                                type="text" 
                                value={r.syorJangkaan} 
                                onChange={(e) => handleA1CellChange(index, 'syorJangkaan', e.target.value)}
                                className="w-28 bg-white/5 rounded p-1 text-center text-white font-black"
                                placeholder="E.g., 12 MINGGU"
                              />
                            </td>
                          </tr>
                        );
                      })}

                      {/* Dynamic Calculated TOTALS Row (JUMLAH / Yellow Highlights) */}
                      <tr className="bg-yellow-400 font-bold text-black text-center text-xs">
                        <td className="p-3 text-left font-black tracking-wider border-r border-black/15">JUMLAH</td>
                        <td className="p-2 border-r border-black/15">{totalsA1.perancanganBil}</td>
                        <td className="p-2 border-r border-black/15 text-right">{totalsA1.perancanganNilai.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-2 border-r border-black/15">{totalsA1.belumPelawaBil}</td>
                        <td className="p-2 border-r border-black/15">{totalsA1.prosesIklanBil}</td>
                        <td className="p-2 border-r border-black/15">{totalsA1.prosesPenilaianBil}</td>
                        <td className="p-2 border-r border-black/15">{totalsA1.prosesJkBil}</td>
                        <td className="p-2 border-r border-black/15">{totalsA1.belumSstBil}</td>
                        <td className="p-2 border-r border-black/15">{totalsA1.sstBumiBil}</td>
                        <td className="p-2 border-r border-black/15 text-right">{totalsA1.sstBumiNilai.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-2 border-r border-black/15">{totalsA1.sstNonBumiBil}</td>
                        <td className="p-2 border-r border-black/15 text-right">{totalsA1.sstNonBumiNilai.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-2 border-r border-black/15">{totalsA1.sstBumiBil + totalsA1.sstNonBumiBil}</td>
                        <td className="p-2 border-r border-black/15 text-right">{(totalsA1.sstBumiNilai + totalsA1.sstNonBumiNilai).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-2 bg-yellow-400"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: LAMPIRAN A2 */}
            {activeTab === 'a2' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="p-2.5 bg-white/[0.01] border border-white/5 rounded-xl text-[10px] text-white/50 uppercase tracking-widest">
                      Senarai Perincian Laporan Suku Tahun (Format Lampiran A2) • {rowsA2.length} Rekod Paparan
                    </div>
                  </div>
                  <button 
                    onClick={handleAddA2Row}
                    className="px-4 py-2 bg-risda-orange text-black rounded-xl hover:bg-risda-gold transition-all text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-risda-orange/15"
                    title="Tambah Baris Projek Baru"
                  >
                    <Plus size={14} />
                    Tambah Baris Projek
                  </button>
                </div>

                <div className="overflow-x-auto w-full border border-white/10 rounded-2xl">
                  <table className="w-full text-xs text-left border-collapse min-w-[1100px]">
                    <thead>
                      <tr className="bg-white/10 text-white/85 font-black uppercase border-b border-white/10">
                        <th className="p-4 w-12 text-center border-r border-white/10">BIL.</th>
                        <th className="p-4 w-36 border-r border-white/10">NO. SEBUTHARGA</th>
                        <th className="p-4 w-32 border-r border-white/10">KATEGORI</th>
                        <th className="p-4 w-36 border-r border-white/10">PERUNTUKAN (BLK/KWR)</th>
                        <th className="p-4 w-96 border-r border-white/10">NAMA PROJEK</th>
                        <th className="p-4 w-48 border-r border-white/10">SYARIKAT BERJAYA</th>
                        <th className="p-4 w-36 border-r border-white/10 text-right">HARGA TAWARAN (RM)</th>
                        <th className="p-4 w-16 text-center">TINDAKAN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-medium">
                      {rowsA2.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-10 text-center text-risda-muted uppercase font-black tracking-widest">
                            Tiada rekod sebut harga sedia ada. Sila klik "Tambah Baris Projek" untuk membina data manual.
                          </td>
                        </tr>
                      ) : rowsA2.map((r, idx) => {
                        const isEditing = activeA2Edits[r.id] !== false; // Defaults to true if new/undefined
                        return (
                          <tr key={r.id} className="hover:bg-white/5 transition-all text-xs border-b border-white/5">
                            {/* BIL */}
                            <td className="p-3 text-center border-r border-white/5 text-white/50">{idx + 1}</td>
                            
                            {/* NO. SEBUTHARGA */}
                            <td className="p-3 border-r border-white/5">
                              {isEditing ? (
                                <input 
                                  type="text"
                                  value={r.tenderNo}
                                  onChange={(e) => handleA2CellChange(idx, 'tenderNo', e.target.value)}
                                  className="w-full bg-[#111622] border border-white/10 rounded-lg p-2 text-white font-bold uppercase focus:border-risda-orange outline-none text-[11px] placeholder:text-white/20"
                                  placeholder="No. Sebutharga"
                                />
                              ) : (
                                <div className="p-2 font-bold uppercase text-white tracking-wide min-h-[34px] flex items-center">
                                  {r.tenderNo || <span className="text-white/10 italic text-[10px]">Tiada</span>}
                                </div>
                              )}
                            </td>

                            {/* KATEGORI */}
                            <td className="p-3 border-r border-white/5">
                              {isEditing ? (
                                <select
                                  value={r.category}
                                  onChange={(e) => handleA2CellChange(idx, 'category', e.target.value)}
                                  className="w-full bg-[#111622] border border-white/10 rounded-lg p-2 text-white font-bold uppercase focus:border-risda-orange outline-none text-[11px] cursor-pointer"
                                >
                                  <option value="" className="bg-[#121212]">- PILEH KATEGORI -</option>
                                  <option value="KERJA" className="bg-[#121212]">Kerja</option>
                                  <option value="BEKALAN" className="bg-[#121212]">Bekalan</option>
                                  <option value="PERKHIDMATAN" className="bg-[#121212]">Perkhidmatan</option>
                                </select>
                              ) : (
                                <div className="p-2 font-bold uppercase text-white/90 min-h-[34px] flex items-center">
                                  {r.category || <span className="text-white/20 italic">-</span>}
                                </div>
                              )}
                            </td>

                            {/* PERUNTUKAN */}
                            <td className="p-3 border-r border-white/5">
                              {isEditing ? (
                                <input 
                                  type="text"
                                  value={r.jenisPeruntukan}
                                  onChange={(e) => handleA2CellChange(idx, 'jenisPeruntukan', e.target.value)}
                                  placeholder="E.G., BLK ATAU KWR"
                                  className="w-full bg-[#111622] border border-white/10 rounded-lg p-2 text-center text-white placeholder:text-white/20 uppercase font-bold focus:border-risda-orange outline-none text-[11px]"
                                />
                              ) : (
                                <div className="p-2 text-center font-bold uppercase text-risda-gold min-h-[34px] flex items-center justify-center">
                                  {r.jenisPeruntukan ? r.jenisPeruntukan.toUpperCase() : <span className="text-white/10 italic text-[10px]">-</span>}
                                </div>
                              )}
                            </td>

                            {/* NAMA PROJEK */}
                            <td className="p-3 border-r border-white/5">
                              {isEditing ? (
                                <textarea 
                                  value={r.title}
                                  onChange={(e) => handleA2CellChange(idx, 'title', e.target.value)}
                                  rows={2}
                                  className="w-full bg-[#111622] border border-white/10 rounded-lg p-2 text-white uppercase text-[11px] leading-tight resize-y focus:border-risda-orange outline-none"
                                  placeholder="Masukkan Nama Projek..."
                                />
                              ) : (
                                <div className="p-2 text-white/90 uppercase font-bold text-[11.5px] leading-relaxed break-words max-w-[400px] min-h-[34px] flex items-center">
                                  {r.title ? r.title.toUpperCase() : <span className="text-white/10 italic text-[10px]">Tiada Nama Projek</span>}
                                </div>
                              )}
                            </td>

                            {/* SYARIKAT BERJAYA */}
                            <td className="p-3 border-r border-white/5">
                              {isEditing ? (
                                <input 
                                  type="text"
                                  value={r.winnerName}
                                  onChange={(e) => handleA2CellChange(idx, 'winnerName', e.target.value)}
                                  className="w-full bg-[#111622] border border-white/10 rounded-lg p-2 text-white uppercase font-bold focus:border-risda-orange outline-none text-[11px]"
                                  placeholder="Nama Syarikat..."
                                />
                              ) : (
                                <div className="p-2 font-black uppercase text-white/90 min-h-[34px] flex items-center">
                                  {r.winnerName ? r.winnerName.toUpperCase() : <span className="text-white/10 italic text-[10px]">Tiada</span>}
                                </div>
                              )}
                            </td>

                            {/* HARGA TAWARAN */}
                            <td className="p-3 border-r border-white/5">
                              {isEditing ? (
                                <input 
                                  type="number"
                                  value={r.winningPrice || ''}
                                  onChange={(e) => handleA2CellChange(idx, 'winningPrice', Number(e.target.value) || 0)}
                                  className="w-full bg-[#111622] border border-white/10 rounded-lg p-2 text-right text-white font-mono font-bold focus:border-risda-orange outline-none text-[11px]"
                                  placeholder="0"
                                />
                              ) : (
                                <div className="p-2 text-right font-mono font-black text-emerald-400 min-h-[34px] flex items-center justify-end">
                                  {r.winningPrice > 0 ? (
                                    `RM ${r.winningPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  ) : (
                                    <span className="text-white/30">0.00</span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* TINDAKAN */}
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap md:flex-nowrap">
                                {isEditing ? (
                                  <button 
                                    onClick={() => {
                                      setActiveA2Edits(prev => ({ ...prev, [r.id]: false }));
                                      toast.success('Harga / Maklumat projek berjaya disimpan!');
                                    }}
                                    className="px-2.5 py-1.5 bg-green-500 hover:bg-green-600 border border-green-600 text-black text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 shadow-md shadow-green-500/10"
                                    title="Simpan Perubahan"
                                  >
                                    <Save size={11} strokeWidth={2.5} />
                                    Simpan
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => {
                                      setActiveA2Edits(prev => ({ ...prev, [r.id]: true }));
                                    }}
                                    className="px-2.5 py-1.5 bg-risda-orange hover:bg-risda-gold text-black text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 shadow-md shadow-risda-orange/10"
                                    title="Kemaskini Rekod"
                                  >
                                    <Edit2 size={11} strokeWidth={2.5} />
                                    Kemaskini
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleDeleteA2Row(r.id)}
                                  className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                  title="Padam rekod"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* YEARLY REPORT ARCHIVE VIEW */}
        {view === 'tahunan' && (
          <motion.div 
            key="tahunan"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {selectedAnnualYear ? (
              // 13-COLUMN LIVE SHEET EDITOR FOR THE CHOSEN YEAR
              <div className="space-y-6">
                {/* Header Back & Action Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <div className="space-y-2">
                    <button 
                      onClick={() => setSelectedAnnualYear(null)}
                      className="px-4 py-2 bg-gradient-to-r from-risda-orange to-risda-gold text-black hover:from-white hover:to-white hover:text-black rounded-xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-2 mb-2 shadow-[0_4px_12px_rgba(250,178,30,0.15)] active:scale-95"
                    >
                      <ArrowLeft size={16} strokeWidth={3} />
                      KEMBALI KE LAPORAN TAHUNAN (PILIH TAHUN LAIN)
                    </button>
                    <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <span className="text-risda-orange">LAPORAN TAHUNAN PEROLEHAN TAHUN:</span> {selectedAnnualYear}
                    </h2>
                    <p className="text-[10px] text-risda-muted uppercase font-bold tracking-widest">
                      Pusat Tanggungjawab: {office}
                    </p>
                  </div>

                  <div className="flex items-center flex-wrap gap-2">
                    <button 
                      onClick={handleSaveAllAnnualRows}
                      disabled={loading || rowsAnnual.length === 0}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-green-600/20 active:scale-95 disabled:opacity-50"
                      title="Simpan semua rekod laporan tahunan ke Pangkalan Data"
                    >
                      <Save size={14} />
                      Simpan Laporan Tahunan
                    </button>
                    <button 
                      onClick={handleSyncAnnualFromDB}
                      disabled={loading}
                      className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:border-risda-orange/50 transition-all text-xs font-black uppercase tracking-wider flex items-center gap-2"
                    >
                      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                      Padan Data DB
                    </button>
                  </div>
                </div>

                {/* Exporters & Row controller */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-risda-muted font-bold uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                      Jumlah Rekod: {rowsAnnual.length}
                    </span>
                    <button 
                      onClick={handleAddAnnualRow}
                      className="px-4 py-2 bg-risda-orange text-black rounded-xl hover:bg-risda-gold transition-all text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-risda-orange/15"
                    >
                      <Plus size={14} />
                      Tambah Baris Projek
                    </button>
                  </div>

                  {/* Exporters Bar */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setSelectedAnnualYear(null)}
                      className="px-4 py-2.5 bg-white/5 border border-white/10 text-risda-muted hover:text-white rounded-xl transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                      title="Kembali ke Senarai Tahun"
                    >
                      <ArrowLeft size={13} />
                      Kembali
                    </button>
                    <button 
                      onClick={() => handleExportAnnual('pdf')}
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <Download size={13} />
                      Jana PDF
                    </button>
                    <button 
                      onClick={() => handleExportAnnual('excel')}
                      className="px-4 py-2.5 bg-[#1F7246] hover:bg-[#165031] text-white rounded-xl transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <FileSpreadsheet size={13} />
                      Excel
                    </button>
                    <button 
                      onClick={() => handleExportAnnual('word')}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <FileText size={13} />
                      Word
                    </button>
                  </div>
                </div>

                {/* Spreadsheet style table with 13 columns with custom-scrollbar */}
                <div 
                  ref={tableRef}
                  className="overflow-x-auto w-full border border-white/10 rounded-2xl custom-scrollbar"
                >
                  <table className="w-full text-xs text-left border-collapse min-w-[2000px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#FAB21E] to-[#F5A623] text-black font-black uppercase border-b border-white/10 text-center">
                        <th className="sticky left-0 bg-[#FAB21E] z-20 p-3 min-w-[3rem] w-12 border-r border-[#D49010] text-center shadow-md">BIL</th>
                        <th className="sticky left-12 bg-[#F5A11F] z-20 p-3 min-w-[24rem] w-96 border-r border-[#D49010] text-left shadow-[5px_0_10px_-3px_rgba(0,0,0,0.3)]">TAJUK SEBUTHARGA</th>
                        <th className="p-3 w-40 border-r border-[#D49010]">KERJA / PERKHIDMATAN / BEKALAN</th>
                        <th className="p-3 w-48 border-r border-[#D49010]">NO SEBUTHARGA</th>
                        <th className="p-3 w-36 border-r border-[#D49010]">TARIKH SETUJU TERIMA</th>
                        <th className="p-3 w-36 border-r border-[#D49010]">TARIKH SIAP KERJA</th>
                        <th className="p-3 w-36 border-r border-[#D49010]">TEMPOH SIAP KERJA</th>
                        <th className="p-3 w-52 border-r border-[#D49010]">NAMA SYARIKAT BERJAYA</th>
                        <th className="p-3 w-36 border-r border-[#D49010] text-right">NILAI TAWARAN (RM)</th>
                        <th className="p-3 w-40 border-r border-[#D49010]">NO PESANAN TEMPATAN</th>
                        <th className="p-3 w-36 border-r border-[#D49010]">NO BAUCAR BAYARAN</th>
                        <th className="p-3 w-36 border-r border-[#D49010]">TARIKH DIBAYAR</th>
                        <th className="p-3 h-auto w-48 border-r border-[#D49010]">TARIKH SIAP KERJA BARU (EOT)</th>
                        <th className="p-3 w-36 border-r border-[#D49010]">STATUS</th>
                        <th className="p-3 w-64 text-center">TINDAKAN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-medium bg-[#0b0e14]">
                      {rowsAnnual.length === 0 ? (
                        <tr>
                          <td colSpan={15} className="p-12 text-center text-risda-muted text-sm uppercase font-black tracking-widest">
                            Tiada rekod sebut harga tahunan sedia ada. Sila klik "Padan Data DB" untuk menjana baris perolehan.
                          </td>
                        </tr>
                      ) : (
                        rowsAnnual.map((r, idx) => {
                          const isEditing = editingRowId === r.id;
                          return (
                            <tr key={r.id} className="group hover:bg-white/5 transition-all text-center">
                              {/* BIL */}
                              <td className="sticky left-0 bg-[#0e121a] group-hover:bg-[#151b27] z-10 p-2 border-r border-white/10 text-white/50 text-center min-w-[3rem] w-12 border-b border-white/5 transition-colors">{idx + 1}</td>
                              
                              {/* TAJUK SEBUTHARGA */}
                              <td className="sticky left-12 bg-[#0e121a] group-hover:bg-[#151b27] z-10 p-2 border-r border-white/10 text-left min-w-[24rem] w-96 border-b border-white/5 transition-colors shadow-[5px_0_10px_-3px_rgba(0,0,0,0.3)]">
                                {isEditing ? (
                                  <textarea
                                    value={r.title}
                                    onChange={(e) => handleAnnualCellChange(idx, 'title', e.target.value)}
                                    rows={4}
                                    className="w-full bg-[#161616] rounded-lg p-2 text-white uppercase text-xs leading-relaxed resize-y min-h-[110px] outline-none border border-white/20 focus:border-risda-orange focus:bg-black/40 font-semibold overflow-y-auto"
                                  />
                                ) : (
                                  <div className="text-white font-semibold uppercase text-xs px-2 whitespace-normal leading-relaxed break-words max-w-[380px]">
                                    {r.title || <span className="text-white/30 italic">TIADA TAJUK</span>}
                                  </div>
                                )}
                              </td>

                              {/* KERJA / PERKHIDMATAN / BEKALAN */}
                              <td className="p-2 border-r border-white/5">
                                {isEditing ? (
                                  <select
                                    value={r.category}
                                    onChange={(e) => handleAnnualCellChange(idx, 'category', e.target.value)}
                                    className="bg-[#121212] leading-tight font-black text-xs text-white border border-white/20 rounded-lg p-2 uppercase outline-none focus:border-risda-orange w-full"
                                  >
                                    <option value="KERJA">KERJA</option>
                                    <option value="BEKALAN">BEKALAN</option>
                                    <option value="PERKHIDMATAN">PERKHIDMATAN</option>
                                  </select>
                                ) : (
                                  <div className="flex justify-center">
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                                      r.category === 'KERJA' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                      r.category === 'BEKALAN' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    }`}>
                                      {r.category}
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* NO SEBUTHARGA */}
                              <td className="p-2 border-r border-white/5">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={r.tenderNo}
                                    onChange={(e) => handleAnnualCellChange(idx, 'tenderNo', e.target.value)}
                                    className="w-full bg-[#161616] rounded-lg p-2 text-white font-bold uppercase text-xs text-center outline-none border border-white/20 focus:border-risda-orange focus:bg-black/40"
                                  />
                                ) : (
                                  <span className="font-mono font-bold text-white uppercase text-xs">
                                    {r.tenderNo || '-'}
                                  </span>
                                )}
                              </td>

                              {/* TARIKH SETUJU TERIMA */}
                              <td className="p-2 border-r border-white/5">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={r.tarikhSetujuTerima}
                                    onChange={(e) => handleAnnualCellChange(idx, 'tarikhSetujuTerima', e.target.value)}
                                    placeholder="E.g., 06/03/2025"
                                    className="w-full bg-[#161616] rounded-lg p-2 text-white text-center text-xs uppercase font-bold outline-none border border-white/20 focus:border-risda-orange focus:bg-black/40"
                                  />
                                ) : (
                                  <span className="text-white text-xs font-semibold">{formatDateToDDMMYYYY(r.tarikhSetujuTerima) || '-'}</span>
                                )}
                              </td>

                              {/* TARIKH SIAP KERJA */}
                              <td className="p-2 border-r border-white/5">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={r.tarikhSiapKerja}
                                    onChange={(e) => handleAnnualCellChange(idx, 'tarikhSiapKerja', e.target.value)}
                                    placeholder="E.g., 29/05/2025"
                                    className="w-full bg-[#161616] rounded-lg p-2 text-white text-center text-xs uppercase font-bold outline-none border border-white/20 focus:border-risda-orange focus:bg-black/40"
                                  />
                                ) : (
                                  <span className="text-white text-xs font-semibold">{formatDateToDDMMYYYY(r.tarikhSiapKerja) || '-'}</span>
                                )}
                              </td>

                              {/* TEMPOH SIAP KERJA */}
                              <td className="p-2 border-r border-white/5">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={r.tempohSiapKerja}
                                    onChange={(e) => handleAnnualCellChange(idx, 'tempohSiapKerja', e.target.value)}
                                    placeholder="E.g., 12 MINGGU"
                                    className="w-full bg-[#161616] rounded-lg p-2 text-center text-xs text-white uppercase font-black outline-none border border-white/20 focus:border-risda-orange focus:bg-black/40"
                                  />
                                ) : (
                                  <span className="text-white text-xs font-black uppercase text-center">
                                    {r.winnerName?.toUpperCase().includes('SEBUTHARGA SEMULA') ? '-' : (r.tempohSiapKerja || '-')}
                                  </span>
                                )}
                              </td>

                              {/* NAMA SYARIKAT BERJAYA */}
                              <td className="p-2 border-r border-white/5">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={r.winnerName}
                                    onChange={(e) => handleAnnualCellChange(idx, 'winnerName', e.target.value)}
                                    className="w-full bg-[#161616] rounded-lg p-2 text-white font-black uppercase text-xs outline-none border border-white/20 focus:border-risda-orange focus:bg-black/40"
                                  />
                                ) : (
                                  <span className="text-white font-black uppercase text-xs leading-relaxed max-w-[200px] inline-block truncate" title={r.winnerName}>
                                    {r.winnerName || 'TIADA'}
                                  </span>
                                )}
                              </td>

                              {/* NILAI TAWARAN (RM) */}
                              <td className="p-2 border-r border-white/5 text-right font-mono font-bold text-white text-xs">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={r.winningPrice}
                                    onChange={(e) => handleAnnualCellChange(idx, 'winningPrice', Number(e.target.value) || 0)}
                                    className="w-full bg-[#161616] rounded-lg p-2 text-right font-mono font-bold text-white text-xs outline-none border border-white/20 focus:border-risda-orange focus:bg-black/40"
                                  />
                                ) : (
                                  (r.winnerName?.toUpperCase().includes('SEBUTHARGA SEMULA') || !r.winningPrice) ? '-' : `RM ${Number(r.winningPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                )}
                              </td>

                              {/* NO PESANAN TEMPATAN */}
                              <td className="p-2 border-r border-white/5">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={r.noPesananTempatan || ''}
                                    onChange={(e) => handleAnnualCellChange(idx, 'noPesananTempatan', e.target.value)}
                                    placeholder="No. Pesanan Tempatan"
                                    className="w-full bg-[#161616] rounded-lg p-2 text-white text-center text-xs uppercase font-bold outline-none border border-white/20 focus:border-risda-orange focus:bg-black/40"
                                  />
                                ) : (
                                  <span className="text-white text-xs font-bold font-mono">
                                    {r.noPesananTempatan || <span className="text-white/30 italic">TIADA LO</span>}
                                  </span>
                                )}
                              </td>

                              {/* NO BAUCAR BAYARAN */}
                              <td className="p-2 border-r border-white/5">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={r.noBaucar}
                                    onChange={(e) => handleAnnualCellChange(idx, 'noBaucar', e.target.value)}
                                    placeholder="12545070447"
                                    className="w-full bg-[#161616] rounded-lg p-2 text-white text-center text-xs uppercase font-bold outline-none border border-white/20 focus:border-risda-orange focus:bg-black/40"
                                  />
                                ) : (
                                  <span className="text-white text-xs font-bold font-mono">{r.noBaucar || <span className="text-white/30 italic">BELUM SELESAI</span>}</span>
                                )}
                              </td>

                              {/* TARIKH DIBAYAR */}
                              <td className="p-2 border-r border-white/5">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={r.tarikhDibayar}
                                    onChange={(e) => handleAnnualCellChange(idx, 'tarikhDibayar', e.target.value)}
                                    placeholder="DD/MM/YYYY"
                                    className="w-full bg-[#161616] rounded-lg p-2 text-white text-center text-xs uppercase font-bold outline-none border border-white/20 focus:border-risda-orange focus:bg-black/40"
                                  />
                                ) : (
                                  <span className="text-white text-xs font-semibold">{r.tarikhDibayar || <span className="text-white/30 italic">BELUM SELESAI</span>}</span>
                                )}
                              </td>

                              {/* TARIKH SIAP KERJA BARU (EOT) */}
                              <td className="p-2 border-r border-white/5">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={r.tarikhSiapBaru}
                                    onChange={(e) => handleAnnualCellChange(idx, 'tarikhSiapBaru', e.target.value)}
                                    placeholder="Jika tiada, kosongkan"
                                    className="w-full bg-[#161616] rounded-lg p-2 text-white text-center text-xs uppercase font-bold outline-none border border-white/20 focus:border-risda-orange focus:bg-black/40"
                                  />
                                ) : (
                                  <span className="text-white text-xs font-semibold">{r.tarikhSiapBaru || <span className="text-white/30 italic">TIADA EOT</span>}</span>
                                )}
                              </td>

                              {/* STATUS */}
                              <td className="p-2 border-r border-white/5">
                                {isEditing ? (
                                  <select
                                    value={r.statusPelaksanaan}
                                    onChange={(e) => handleAnnualCellChange(idx, 'statusPelaksanaan', e.target.value)}
                                    className="bg-[#121212] text-white border border-white/20 rounded-lg p-2 text-xs font-black uppercase outline-none focus:border-risda-orange w-full"
                                  >
                                    <option value="ON TIME">ON TIME</option>
                                    <option value="LEWAT BERSYARAT">LEWAT BERSYARAT</option>
                                    <option value="DALAM PROSES">DALAM PROSES</option>
                                    <option value="LEWAT">LEWAT</option>
                                    <option value="TAMAT">TAMAT</option>
                                  </select>
                                ) : (
                                  <div className="flex justify-center">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                      (r.statusPelaksanaan === 'TAMAT' || r.winnerName?.toUpperCase().includes('SEBUTHARGA SEMULA')) ? 'bg-white/5 text-white/50 border-white/10' :
                                      r.statusPelaksanaan === 'ON TIME' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                      r.statusPelaksanaan === 'LEWAT BERSYARAT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                      r.statusPelaksanaan === 'DALAM PROSES' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                      r.statusPelaksanaan === 'LEWAT' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                      'bg-white/5 text-white/50 border-white/10'
                                    }`}>
                                      {r.winnerName?.toUpperCase().includes('SEBUTHARGA SEMULA') ? 'TAMAT' : r.statusPelaksanaan}
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* TINDAKAN */}
                              <td className="p-2 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                                    <button
                                      onClick={() => handleSaveAnnualRow(r)}
                                      className="px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-black rounded-lg transition-all text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md shadow-green-500/20 active:scale-95"
                                      title="Simpan perubahan rekod ke Pangkalan Data"
                                    >
                                      <Save size={12} strokeWidth={2.5} />
                                      Simpan
                                    </button>
                                    <button
                                      onClick={() => setEditingRowId(null)}
                                      className="p-1 px-2 border border-white/10 hover:bg-white/5 text-xs text-risda-muted hover:text-white rounded-lg transition-all"
                                      title="Batal"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                                    <button
                                      onClick={() => {
                                        setEditingRowId(r.id);
                                        toast.success('Mod Edit Aktif - Sila buat kemaskini dan tekan Simpan');
                                      }}
                                      className="px-2.5 py-1.5 bg-gradient-to-r from-risda-orange to-risda-gold text-black hover:from-white hover:to-white hover:text-black rounded-xl transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm active:scale-95"
                                      title="Edit & Kemaskini Rekod"
                                    >
                                      <Edit2 size={11} strokeWidth={2.5} />
                                      Edit / Kemaskini
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAnnualRow(r.id)}
                                      className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                      title="Padam baris"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              // ORIGINAL ANNUAL REPORT ARCHIVE LISTING STAYS PRECISELY AS IT WAS
              <div className="glass-card p-8 rounded-3xl space-y-8 bg-gradient-to-br from-risda-gold/5 to-transparent border-risda-gold/10">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase tracking-[2px] text-white">Laporan Tahunan Perolehan</h3>
                    <p className="text-[9px] text-risda-muted font-bold uppercase tracking-widest">Analisis Komprehensif Tahunan Perolehan RISDA Sabah</p>
                  </div>
                  <div className="p-2.5 bg-risda-gold/10 rounded-xl text-risda-gold">
                    <FileText size={20} />
                  </div>
                </div>

                <div className="space-y-4">
                  {yearlyReports.map((item, index) => {
                    const yrNum = Number(item.year);
                    let countVal = getAdCountForYear(yrNum);
                    
                    return (
                      <AnnualReportItem 
                        key={item.year}
                        year={item.year} 
                        totalAds={countVal.toString()} 
                        status={item.status} 
                        onClick={() => {
                          setSelectedAnnualYear(item.year);
                          const rows = loadAnnualRowsForYear(item.year);
                          setRowsAnnual(rows);
                          if (rows.length > 0) {
                            toast.success(`Berjaya memuatkan ${rows.length} rekod laporan bagi tahun ${item.year}`);
                          } else {
                            setRowsAnnual([]);
                            toast(`Tiada data database bagi tahun ${item.year}. Laporan tahunan bermula kosong.`);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuarterItem({ title, period, status }: any) {
  const isAvailable = status === 'Tersedia';
  return (
    <div className={`p-4 rounded-2xl border transition-all ${isAvailable ? 'bg-white/5 border-white/10 hover:border-blue-500/50 cursor-pointer' : 'bg-black/20 border-white/5 opacity-50 cursor-not-allowed'}`}>
      <h4 className="text-[10px] font-black text-white uppercase tracking-tight mb-1">{title}</h4>
      <p className="text-[9px] text-risda-muted uppercase font-bold tracking-widest mb-3">{period}</p>
      <div className="flex items-center justify-between">
        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${isAvailable ? 'bg-green-500/10 text-green-500' : 'bg-risda-muted/10 text-risda-muted'}`}>
          {status}
        </span>
        {isAvailable && <Download size={12} className="text-risda-muted" />}
      </div>
    </div>
  );
}

function AnnualReportItem({ year, totalAds, status, onClick }: any) {
  const isComplete = status === 'Arkib Selesai';
  return (
    <div 
      onClick={onClick}
      className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black ${isComplete ? 'bg-risda-gold/10 text-risda-gold' : 'bg-blue-500/10 text-blue-400'}`}>
          <span className="text-[8px] uppercase tracking-tighter opacity-50">Tahun</span>
          <span className="text-xs">{year}</span>
        </div>
        <div className="flex flex-col">
          <h4 className="text-xs font-bold text-white uppercase tracking-tight">LAPORAN TAHUNAN PEROLEHAN {year}</h4>
          <p className="text-[9px] text-risda-muted font-bold uppercase tracking-widest">{totalAds} Iklan • {status}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-risda-muted hover:text-white" title="Muat turun Laporan">
          <Download size={14} />
        </button>
      </div>
    </div>
  );
}

function ReportStat({ cardTitle, value, trend, icon: Icon }: any) {
  return (
    <div className="p-6 border border-white/5 rounded-3xl bg-white/5 transition-all group cursor-default">
      <div className="flex justify-between items-start mb-6">
        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-risda-orange group-hover:bg-risda-orange group-hover:text-black transition-all duration-500 shadow-inner">
          <Icon size={22} />
        </div>
        <span className="text-[10px] font-black text-green-500 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 uppercase tracking-wider">{trend}</span>
      </div>
      <p className="text-[10px] font-black text-risda-muted uppercase tracking-[3px] mb-2 opacity-60">{cardTitle}</p>
      <p className="text-3xl font-black text-white tracking-tighter group-hover:text-risda-orange transition-colors">{value}</p>
    </div>
  );
}

function StateBar({ name, percentage, count }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-[1px]">
        <span className="text-white">{name}</span>
        <span className="text-risda-orange">{count} Iklan</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full bg-risda-orange shadow-[0_0_10px_rgba(0,176,255,0.3)]"
        />
      </div>
    </div>
  );
}

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr || dateStr === '-' || dateStr === 'TIADA') return dateStr || '-';
  return formatDateToDDMMYYYY(dateStr);
};

function DownloadItem({ title, subtitle, size, date, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group"
    >
      <div className="flex flex-col gap-1 flex-1 min-w-0 pr-4">
        <h4 className="text-xs font-bold text-white group-hover:text-risda-orange transition-colors truncate">{title}</h4>
        {subtitle && <p className="text-[10px] text-risda-muted font-semibold truncate uppercase">{subtitle}</p>}
        <p className="text-[9px] text-risda-orange font-black uppercase tracking-[1px] mt-0.5">{date} • {size}</p>
      </div>
      <Download size={16} className="text-risda-muted group-hover:text-white transition-colors shrink-0" />
    </div>
  );
}
