import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, deleteDoc, updateDoc, orderBy, where, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  Search,
  MoreVertical,
  Briefcase,
  Users,
  MessageCircle,
  Mail,
  Send,
  Download,
  CheckCircle,
  X,
  AlertCircle,
  Calendar,
  MapPin,
  Map,
  FileText,
  FileDown,
  FileUp,
  Copy
} from 'lucide-react';
import { exportResultToPDF } from '../lib/exportUtils';
import { motion, AnimatePresence } from 'motion/react';

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr || dateStr === '-' || dateStr === 'TIADA') return dateStr || '-';
  
  try {
    const standardized = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
    const d = new Date(standardized);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const days = ['AHAD', 'ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT', 'SABTU'];
    const dayName = days[d.getDay()];
    return `${day}/${month}/${year} (${dayName})`;
  } catch (e) {
    return dateStr;
  }
};

interface Advertisement {
  id: string;
  tenderNo: string;
  title: string;
  category?: 'KERJA' | 'BEKALAN' | 'PERKHIDMATAN';
  state: string;
  office: string;
  status: 'AKTIF' | 'BATAL' | 'SELESAI (KEPUTUSAN)';
  closingDate: string;
  closingTime: string;
  closingVenue: string;
  briefingDate?: string;
  briefingTime?: string;
  briefingVenue?: string;
  visitDate?: string;
  visitVenue?: string;
  docStartDate?: string;
  docEndDate?: string;
  docVenue?: string;
  publishedDate?: string;
  licenseRequirements?: string;
  winner?: {
    companyName: string;
    ownerName: string;
    companyAddress?: string;
    phoneNumber: string;
    email?: string;
    timestamp: string;
    contractStartDate?: string;
    contractEndDate?: string;
    location?: string;
    winningPrice?: number;
    decisionDate?: string;
  };
  licenses: {
    cidbSpkk: boolean;
    cidbPkk: boolean;
    stb: boolean;
    mof: boolean;
    tcc: boolean;
    pukonsa: boolean;
    kuhean: boolean;
    others?: string;
  };
  licenseDescriptions?: {
    cidbSpkk: string;
    cidbPkk: string;
    stb: string;
    mof: string;
    tcc: string;
    pukonsa: string;
    kuhean: string;
    others: string;
  };
}

interface LocationItem {
  id: string;
  office: string;
  state: string;
  status: string;
}

export default function TenderManagement() {
  const { role, office: userOffice, state: userState } = useAuth();
  const isStaff = role === 'penginput' || role === 'pelulus' || role === 'admin' || role === 'pentadbir';
  const isAdmin = role === 'admin';

  const [ads, setAds] = useState<Advertisement[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [search, setSearch] = useState('');
  
  const currentYear = new Date().getFullYear().toString();
  const [filters, setFilters] = useState({
    state: userState || '',
    office: userOffice || '',
    year: currentYear,
    status: 'SEMUA'
  });
  
  // Winner Management
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [selectedAdForWinner, setSelectedAdForWinner] = useState<Advertisement | null>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [showWinnerConfirm, setShowWinnerConfirm] = useState(false);
  const [pendingWinner, setPendingWinner] = useState<any>(null);
  const [winnerDates, setWinnerDates] = useState({
    startDate: '',
    endDate: '',
    winningPrice: '',
    location: '',
    decisionDate: ''
  });
  const [notifyPrefs, setNotifyPrefs] = useState({
    whatsapp: true,
    email: true
  });

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [formData, setFormData] = useState({
    tenderNo: '',
    title: '',
    category: 'KERJA' as 'KERJA' | 'BEKALAN' | 'PERKHIDMATAN',
    state: userState || '',
    office: userOffice || '',
    status: 'AKTIF' as const,
    closingDate: '',
    closingTime: '12:00 PM',
    closingVenue: '',
    briefingDate: '',
    briefingTime: '',
    briefingVenue: '',
    visitDate: '',
    visitVenue: '',
    docStartDate: '',
    docEndDate: '',
    docVenue: '',
    publishedDate: '',
    licenseRequirements: '',
    licenses: {
      cidbSpkk: false,
      cidbPkk: false,
      stb: false,
      mof: false,
      tcc: false,
      pukonsa: false,
      kuhean: false,
      others: ''
    },
    licenseDescriptions: {
      cidbSpkk: 'CIDB (SPKK) GRED G1 PENGKHUSUSAN CE01',
      cidbPkk: 'CIDB (PKK) GRED G1',
      stb: 'SIJIL TARAF BUMIPUTERA (STB)',
      mof: 'SIJIL AKUAN PENDAFTARAN SYARIKAT (MOF)',
      tcc: 'SIJIL PEMATUHAN CUKAI (TAX COMPLIANCE CERTIFICATE- TCC)',
      pukonsa: 'PUKONSA KELAS F TAJUK 1, TAJUK KECIL 1',
      kuhean: 'SIJIL PENGIKTIRAFAN STATUS PERNIAGAAN ANAK NEGERI SABAH (KUHEAN)',
      others: ''
    }
  });

  const resetForm = () => {
    setFormData({
      tenderNo: '',
      title: '',
      category: 'KERJA',
      state: userState || '',
      office: userOffice || '',
      status: 'AKTIF',
      closingDate: '',
      closingTime: '12:00 PM',
      closingVenue: '',
      briefingDate: '',
      briefingTime: '',
      briefingVenue: '',
      visitDate: '',
      visitVenue: '',
      docStartDate: '',
      docEndDate: '',
      docVenue: '',
      publishedDate: '',
      licenseRequirements: '',
      licenses: {
        cidbSpkk: false,
        cidbPkk: false,
        stb: false,
        mof: false,
        tcc: false,
        pukonsa: false,
        kuhean: false,
        others: ''
      },
      licenseDescriptions: {
        cidbSpkk: 'CIDB (SPKK) GRED G1 PENGKHUSUSAN CE01',
        cidbPkk: 'CIDB (PKK) GRED G1',
        stb: 'SIJIL TARAF BUMIPUTERA (STB)',
        mof: 'SIJIL AKUAN PENDAFTARAN SYARIKAT (MOF)',
        tcc: 'SIJIL PEMATUHAN CUKAI (TAX COMPLIANCE CERTIFICATE- TCC)',
        pukonsa: 'PUKONSA KELAS F TAJUK 1, TAJUK KECIL 1',
        kuhean: 'SIJIL PENGIKTIRAFAN STATUS PERNIAGAAN ANAK NEGERI SABAH (KUHEAN)',
        others: ''
      }
    });
    setEditingAd(null);
  };

  const handleAIAnalysis = async (file: File) => {
    setAnalyzing(true);
    const loadingToast = toast.loading('Sedang menganalisis dokumen...');
    
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      
      const base64Data = await base64Promise;
      
      const response = await fetch('/api/analyze-tender', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64Data,
          mimeType: file.type
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const extractedData = await response.json();
      
      setFormData(prev => ({
        ...prev,
        ...extractedData,
        licenses: {
          ...prev.licenses,
          ...extractedData.licenses
        }
      }));
      
      toast.success('Analisis selesai! Sila semak data yang diisi.', { id: loadingToast });
    } catch (error) {
      console.error('AI Analysis Error:', error);
      toast.error('Gagal menganalisis dokumen. Sila isi secara manual.', { id: loadingToast });
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchAds();
    if (isAdmin) fetchLocations();
  }, [role, userOffice]);

  const fetchLocations = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'locations'));
      const list = snapshot.docs.map(d => ({ 
        id: d.id, 
        office: d.data().office,
        state: d.data().state,
        status: d.data().status || 'Aktif'
      } as LocationItem));
      setLocations(list);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchAds = async () => {
    try {
      let q;
      if (isAdmin || role === 'pentadbir') {
        q = query(collection(db, 'ads'), orderBy('tenderNo', 'desc'));
      } else if (role === 'penginput' || role === 'pelulus') {
        q = query(collection(db, 'ads'), where('office', '==', userOffice || ''), orderBy('tenderNo', 'desc'));
      } else {
        q = query(collection(db, 'ads'), orderBy('tenderNo', 'desc'));
      }
      
      const querySnapshot = await getDocs(q);
      const adsData: Advertisement[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        adsData.push({ id: doc.id, ...(data as any) } as Advertisement);
      });
      setAds(adsData);
    } catch (error) {
      console.error('Error fetching ads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const adId = editingAd ? editingAd.id : `AD-${Date.now()}`;
    try {
      const finalOffice = isAdmin ? formData.office : (userOffice || '');
      const finalState = isAdmin ? formData.state : (userState || '');
      
      const payload: any = {
        ...formData,
        office: finalOffice,
        state: finalState,
        updatedAt: new Date().toISOString(),
        ...(editingAd ? {} : { createdAt: new Date().toISOString() })
      };

      // Preserve winner if editing
      if (editingAd && editingAd.winner) {
        payload.winner = editingAd.winner;
      }

      await setDoc(doc(db, 'ads', adId), payload);
      setShowModal(false);
      resetForm();
      fetchAds();
      toast.success(editingAd ? 'Iklan telah dikemaskini!' : 'Iklan baru telah berjaya dipaparkan!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `ads/${adId}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isStaff) return;
    if (!window.confirm('Adakah anda pasti untuk padam iklan ini? SEMUA DATA berkaitan (termasuk rekod kehadiran & serahan) akan dipadam secara kekal dari database.')) return;
    
    const loadingToast = toast.loading('Memadam data...');
    try {
      // 1. Delete all related attendance/submission records
      const attQuery = query(collection(db, 'attendance'), where('adId', '==', id));
      const attSnap = await getDocs(attQuery);
      
      if (!attSnap.empty) {
        const batch = writeBatch(db);
        attSnap.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      // 2. Delete the ad doc
      await deleteDoc(doc(db, 'ads', id));
      
      setAds(prev => prev.filter(ad => ad.id !== id));
      toast.success('Iklan dan semua rekod berkaitan telah dipadam.', { id: loadingToast });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `ads/${id}`);
      toast.dismiss(loadingToast);
    }
  };

  const openEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setFormData({
      tenderNo: ad.tenderNo,
      title: ad.title,
      category: ad.category || 'KERJA',
      state: ad.state,
      office: ad.office || '',
      status: ad.status,
      closingDate: ad.closingDate,
      closingTime: ad.closingTime || '12:00 PM',
      closingVenue: ad.closingVenue || '',
      briefingDate: ad.briefingDate || '',
      briefingTime: ad.briefingTime || '',
      briefingVenue: ad.briefingVenue || '',
      visitDate: ad.visitDate || '',
      visitVenue: ad.visitVenue || '',
      docStartDate: ad.docStartDate || '',
      docEndDate: ad.docEndDate || '',
      docVenue: ad.docVenue || '',
      publishedDate: ad.publishedDate || '',
      licenseRequirements: ad.licenseRequirements || '',
      licenses: ad.licenses || {
        cidbSpkk: false,
        cidbPkk: false,
        stb: false,
        mof: false,
        tcc: false,
        pukonsa: false,
        kuhean: false,
        others: ''
      },
      licenseDescriptions: ad.licenseDescriptions || {
        cidbSpkk: 'CIDB (SPKK) GRED G1 PENGKHUSUSAN CE01',
        cidbPkk: 'CIDB (PKK) GRED G1',
        stb: 'SIJIL TARAF BUMIPUTERA (STB)',
        mof: 'SIJIL AKUAN PENDAFTARAN SYARIKAT (MOF)',
        tcc: 'SIJIL PEMATUHAN CUKAI (TAX COMPLIANCE CERTIFICATE- TCC)',
        pukonsa: 'PUKONSA KELAS F TAJUK 1, TAJUK KECIL 1',
        kuhean: 'SIJIL PENGIKTIRAFAN STATUS PERNIAGAAN ANAK NEGERI SABAH (KUHEAN)',
        others: ''
      }
    });
    setShowModal(true);
  };

  const handleCopy = (ad: Advertisement) => {
    setEditingAd(null);
    setFormData({
      tenderNo: `${ad.tenderNo}-SALIN`,
      title: `${ad.title} (SALINAN)`,
      state: ad.state,
      office: ad.office || '',
      status: 'AKTIF',
      closingDate: ad.closingDate || '',
      closingTime: ad.closingTime || '12:00 PM',
      closingVenue: ad.closingVenue || '',
      briefingDate: ad.briefingDate || '',
      briefingTime: ad.briefingTime || '',
      briefingVenue: ad.briefingVenue || '',
      visitDate: ad.visitDate || '',
      visitVenue: ad.visitVenue || '',
      docStartDate: ad.docStartDate || '',
      docEndDate: ad.docEndDate || '',
      docVenue: ad.docVenue || '',
      publishedDate: ad.publishedDate || '',
      licenseRequirements: ad.licenseRequirements || '',
      licenses: ad.licenses ? { ...ad.licenses } : {
        cidbSpkk: false,
        cidbPkk: false,
        stb: false,
        mof: false,
        tcc: false,
        pukonsa: false,
        kuhean: false,
        others: ''
      },
      licenseDescriptions: ad.licenseDescriptions ? { ...ad.licenseDescriptions } : {
        cidbSpkk: 'CIDB (SPKK) GRED G1 PENGKHUSUSAN CE01',
        cidbPkk: 'CIDB (PKK) GRED G1',
        stb: 'SIJIL TARAF BUMIPUTERA (STB)',
        mof: 'SIJIL AKUAN PENDAFTARAN SYARIKAT (MOF)',
        tcc: 'SIJIL PEMATUHAN CUKAI (TAX COMPLIANCE CERTIFICATE- TCC)',
        pukonsa: 'PUKONSA KELAS F TAJUK 1, TAJUK KECIL 1',
        kuhean: 'SIJIL PENGIKTIRAFAN STATUS PERNIAGAAN ANAK NEGERI SABAH (KUHEAN)',
        others: ''
      }
    });
    setShowModal(true);
    toast.success('Iklan disalin! Sila kemaskini maklumat sebelum menyimpan.');
  };

  const handleSelectWinnerPreview = (attendee: any) => {
    setPendingWinner(attendee);
    setShowWinnerConfirm(true);
    setWinnerDates({
      startDate: '',
      endDate: '',
      winningPrice: '',
      location: selectedAdForWinner?.visitVenue || selectedAdForWinner?.docVenue || '-',
      decisionDate: new Date().toISOString().split('T')[0]
    });
    setNotifyPrefs({
      whatsapp: true,
      email: true
    });
  };

  const handleConfirmWinner = async () => {
    if (!selectedAdForWinner || !pendingWinner) return;
    
    if (!winnerDates.startDate || !winnerDates.endDate || !winnerDates.decisionDate) {
      toast.error('Sila masukkan tarikh mula, tarikh akhir kerja, dan tarikh pemenang dipilih.');
      return;
    }

    const adId = selectedAdForWinner.id;
    const loadingToast = toast.loading('Menetapkan pembekal terpilih...');

    try {
      const winnerData = {
        companyName: pendingWinner.companyName,
        ownerName: pendingWinner.ownerName || pendingWinner.representativeName || '',
        phoneNumber: pendingWinner.phoneNumber,
        email: pendingWinner.email || '',
        timestamp: new Date().toISOString(),
        decisionDate: winnerDates.decisionDate,
        contractStartDate: winnerDates.startDate,
        contractEndDate: winnerDates.endDate,
        winningPrice: Number(winnerDates.winningPrice) || 0,
        location: winnerDates.location || selectedAdForWinner.visitVenue || selectedAdForWinner.docVenue || '-'
      };

      await updateDoc(doc(db, 'ads', adId), {
        winner: winnerData,
        status: 'SELESAI (KEPUTUSAN)',
        updatedAt: new Date().toISOString()
      });

      toast.success(`Keputusan rasmi telah dikemaskini. ${pendingWinner.companyName} terpilih!`, { id: loadingToast });
      
      // Auto-trigger notifications based on preferences
      const fullAdData = {...selectedAdForWinner, winner: winnerData} as Advertisement;
      
      if (notifyPrefs.whatsapp) {
        handleNotify(fullAdData, 'whatsapp');
      }
      
      if (notifyPrefs.email) {
        // Adding a slight delay if both are selected might help with browser popup blocks,
        // although email is often a location.href change
        setTimeout(() => {
          handleNotify(fullAdData, 'email');
        }, 300);
      }
      
      setShowWinnerConfirm(false);
      setShowWinnerModal(false);
      setPendingWinner(null);
      fetchAds();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `ads/${adId}`);
      toast.error('Gagal menetapkan pemenang.', { id: loadingToast });
    }
  };

  const fetchAttendees = async (ad: Advertisement) => {
    setLoadingAttendees(true);
    try {
      const q = query(
        collection(db, 'attendance'), 
        where('adTitle', '==', ad.title),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAttendees(list);
    } catch (error) {
      toast.error('Gagal memuatkan senarai kehadiran.');
    } finally {
      setLoadingAttendees(false);
    }
  };

  const openWinnerModal = (ad: Advertisement) => {
    setSelectedAdForWinner(ad);
    setWinnerDates({
      startDate: ad.winner?.contractStartDate || '',
      endDate: ad.winner?.contractEndDate || '',
      winningPrice: ad.winner?.winningPrice ? String(ad.winner.winningPrice) : '',
      location: ad.winner?.location || ad.visitVenue || ad.docVenue || '',
      decisionDate: ad.winner?.decisionDate || (ad.winner?.timestamp ? ad.winner.timestamp.split('T')[0] : new Date().toISOString().split('T')[0])
    });
    fetchAttendees(ad);
    setShowWinnerModal(true);
  };

  const handleNotify = (ad: Advertisement, type: 'whatsapp' | 'email') => {
    const winner = ad.winner;
    if (!winner) {
      toast.error('Maklumat pemenang tidak dijumpai.');
      return;
    }

    const subject = `MAKLUMAN KEPUTUSAN RASMI SEBUT HARGA: ${ad.tenderNo}`;
    const message = `Salam Sejahtera,\n\nTahniah! Syarikat anda (${winner.companyName}) telah terpilih bagi sebutan harga berikut:\n\nNo. Sebut Harga: ${ad.tenderNo}\nTajuk: ${ad.title}\nTempoh: ${formatDate(winner.contractStartDate)} - ${formatDate(winner.contractEndDate)}\n\nSila layari portal perolehan untuk maklumat lanjut.\n\nSekian, Terima Kasih.`;

    if (type === 'whatsapp') {
      if (!winner.phoneNumber) {
        toast.error('No. Telefon tidak dijumpai.');
        return;
      }
      const phone = winner.phoneNumber.replace(/[^0-9]/g, '');
      const waLink = `https://wa.me/${phone.startsWith('6') ? phone : '6' + phone}?text=${encodeURIComponent(message)}`;
      window.open(waLink, '_blank');
    } else {
      if (!winner.email) {
        toast.error('Email tidak dijumpai.');
        return;
      }
      const mailto = `mailto:${winner.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      window.location.href = mailto;
    }
  };

  const years = Array.from(new Set([
    currentYear,
    ...ads.map(ad => {
      const date = ad.visitDate || ad.closingDate || ad.createdAt;
      if (!date) return null;
      return new Date(date).getFullYear().toString();
    }).filter(Boolean)
  ])).sort((a, b) => b.localeCompare(a));

  const filteredAds = ads
    .filter(ad => {
      const matchesSearch = ad.title.toLowerCase().includes(search.toLowerCase()) || 
                           ad.tenderNo.toLowerCase().includes(search.toLowerCase());
      const matchesState = !filters.state || ad.state === filters.state;
      const matchesOffice = !filters.office || ad.office === filters.office;
      const matchesStatus = filters.status === 'SEMUA' || ad.status === filters.status;
      
      let matchesYear = true;
      if (filters.year !== 'ALL') {
        const date = ad.visitDate || ad.closingDate || ad.createdAt;
        matchesYear = date ? new Date(date).getFullYear().toString() === filters.year : false;
      }
      
      return matchesSearch && matchesState && matchesOffice && matchesStatus && matchesYear;
    });

  if (!isStaff) return <div className="p-20 text-center">Tiada Kebenaran.</div>;

  return (
    <div className="space-y-6 md:space-y-8 p-4 md:p-8 w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div className="space-y-1 md:space-y-2">
          <h1 className="text-xl md:text-3xl font-black text-white uppercase tracking-tight">Katalog Sebut Harga</h1>
          <p className="text-[8px] md:text-[10px] text-risda-muted font-black uppercase tracking-[3px] md:tracking-[4px]">
            {isAdmin ? 'SEMUA PEJABAT' : `PEJABAT: ${userOffice || 'TIDAK DITETAPKAN'}`}
          </p>
        </div>
        {isStaff && (
          <button 
            onClick={() => { resetForm(); setShowModal(true); }}
            className="btn-gold flex items-center justify-center gap-2 py-3 px-4 md:py-4 md:px-6 w-full sm:w-auto"
          >
            <Plus size={18} />
            <span className="text-[11px] md:text-sm">Tambah Iklan</span>
          </button>
        )}
      </div>

      <div className="space-y-12">
        {/* Search Bar */}
        <div className="flex flex-col md:flex-row gap-8 items-end">
          <div className="flex-1 relative">
            <Search size={22} className="absolute left-0 top-1/2 -translate-y-1/2 text-risda-muted" />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari No Sebut Harga atau Nama Projek..."
              className="w-full bg-transparent border-b-2 border-white/10 rounded-none py-6 pl-10 pr-6 text-sm md:text-base text-white focus:border-risda-orange outline-none transition-all placeholder:text-risda-muted/50 font-black uppercase tracking-widest"
            />
          </div>
          <button className="px-8 py-5 bg-white/5 border border-white/10 rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-[3px] text-white flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95 group">
            <FileDown size={20} className="text-risda-orange group-hover:scale-110 transition-transform" />
            Export Data
          </button>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Status Filter */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black text-risda-orange uppercase tracking-[4px] px-1 opacity-80">Status</label>
            <div className="relative">
              <select 
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="bg-transparent border-b-2 border-white/10 rounded-none py-5 px-1 text-[13px] font-black text-white focus:outline-none focus:border-risda-orange transition-all w-full appearance-none cursor-pointer hover:bg-white/5"
              >
                <option value="SEMUA">SEMUA STATUS</option>
                <option value="AKTIF">AKTIF</option>
                <option value="BATAL">BATAL</option>
                <option value="SELESAI (KEPUTUSAN)">KEPUTUSAN RASMI</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </div>

          {/* Year Filter */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black text-risda-orange uppercase tracking-[4px] px-1 opacity-80">Tahun</label>
            <div className="relative">
              <select 
                value={filters.year}
                onChange={(e) => setFilters({...filters, year: e.target.value})}
                className="bg-transparent border-b-2 border-white/10 rounded-none py-5 px-1 text-[13px] font-black text-white focus:outline-none focus:border-risda-orange transition-all w-full appearance-none cursor-pointer hover:bg-white/5"
              >
                <option value="ALL">SEMUA TAHUN</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </div>

          {/* District/Office Filter - Visible for Admin */}
          {isAdmin && (
            <>
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black text-risda-orange uppercase tracking-[4px] px-1 opacity-80">Negeri</label>
                <div className="relative">
                  <select 
                    value={filters.state}
                    onChange={(e) => setFilters({...filters, state: e.target.value, office: ''})}
                    className="bg-transparent border-b-2 border-white/10 rounded-none py-5 px-1 text-[13px] font-black text-white focus:outline-none focus:border-risda-orange transition-all w-full appearance-none cursor-pointer hover:bg-white/5"
                  >
                    <option value="">SEMUA NEGERI</option>
                    {Array.from(new Set(locations.map(l => l.state))).sort().map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black text-risda-orange uppercase tracking-[4px] px-1 opacity-80">Pejabat</label>
                <div className="relative">
                  <select 
                    value={filters.office}
                    onChange={(e) => setFilters({...filters, office: e.target.value})}
                    className="bg-transparent border-b-2 border-white/10 rounded-none py-5 px-1 text-[13px] font-black text-white focus:outline-none focus:border-risda-orange transition-all w-full appearance-none cursor-pointer hover:bg-white/5"
                  >
                    <option value="">SEMUA PEJABAT</option>
                    {Array.from(new Set(locations
                      .filter(l => !filters.state || l.state === filters.state)
                      .map(l => l.office?.trim().toUpperCase())
                      .filter(Boolean)
                    )).sort().map(office => (
                      <option key={office} value={office}>{office}</option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Card View (hidden on large screens) */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="py-20 text-center text-risda-muted animate-pulse font-black uppercase tracking-[4px]">Memuatkan Senarai...</div>
        ) : filteredAds.length === 0 ? (
          <div className="py-20 text-center text-risda-muted font-black uppercase tracking-[4px]">Tiada Iklan Ditemui</div>
        ) : filteredAds.map((ad) => {
          const itemDate = ad.visitDate || ad.closingDate || ad.createdAt;
          const itemYear = itemDate ? new Date(itemDate).getFullYear() : 0;
          const currentYear = new Date().getFullYear();
          const displayStatus = (itemYear > 0 && itemYear < currentYear) ? 'SELESAI (KEPUTUSAN)' : ad.status;
          
          return (
          <div key={ad.id} className="glass-card p-5 rounded-2xl space-y-4 border border-white/5">
            <div className="flex justify-between items-start gap-2">
              <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest leading-none shrink-0 ${
                displayStatus === 'AKTIF' ? 'bg-green-500/20 text-green-400 border border-green-400/30' : 
                displayStatus === 'BATAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                'bg-blue-500/20 text-blue-400 border border-blue-400/30'
              }`}>
                {displayStatus === 'SELESAI (KEPUTUSAN)' ? (itemYear < currentYear ? 'KEPUTUSAN RASMI (TAMAT)' : 'KEPUTUSAN RASMI') : displayStatus}
              </span>
              <div className="flex gap-2">
                {ad.status !== 'BATAL' && (
                  <button 
                    onClick={() => openWinnerModal(ad)}
                    className="p-2 text-white/40 hover:text-green-500"
                    title="Pilih Pemenang"
                  >
                    <Users size={16} />
                  </button>
                )}
                {isStaff && (
                  <button 
                    onClick={() => handleCopy(ad)} 
                    className="p-2 text-white/40 hover:text-green-400" 
                    title="Salin Iklan"
                  >
                    <Copy size={16} />
                  </button>
                )}
                <button onClick={() => openEdit(ad)} className="p-2 text-white/40 hover:text-risda-orange" title="Kemaskini"><Edit3 size={16} /></button>
                <button onClick={() => handleDelete(ad.id)} className="p-2 text-white/40 hover:text-red-500" title="Padam"><Trash2 size={16} /></button>
              </div>
            </div>
            
            <div>
              {ad.category && (
                <span className="inline-block px-2.5 py-0.5 text-[8px] font-black text-white bg-risda-orange/20 border border-risda-orange/30 rounded-md uppercase tracking-wider mb-2 mr-2">
                  {ad.category}
                </span>
              )}
              <h4 className="text-sm font-black text-white uppercase leading-tight mb-2">{ad.title}</h4>
              <p className="text-[10px] font-mono text-risda-gold/80 font-black uppercase tracking-[1px]">{ad.tenderNo}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div>
                <p className="text-[8px] font-black text-risda-muted uppercase tracking-[1px] mb-1">Pejabat</p>
                <p className="text-[10px] font-black text-white uppercase">{ad.office || 'SELURUH RISDA'}</p>
              </div>
              <div>
                <p className="text-[8px] font-black text-risda-muted uppercase tracking-[1px] mb-1">Tarikh Tutup</p>
                <p className="text-[10px] font-black text-white uppercase">{formatDate(ad.closingDate)} <span className="text-risda-gold italic">(12PM)</span></p>
              </div>
            </div>
          </div>
            );
          })}
      </div>

      {/* Desktop Table View (hidden on small screens) */}
      <div className="hidden md:block w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-risda-muted uppercase tracking-[4px] border-b border-white/10">
                <th className="px-4 py-8">Status</th>
                <th className="px-8 py-8">Kandungan / No. Rujukan</th>
                <th className="px-8 py-8">Pejabat / Negeri</th>
                <th className="px-8 py-8">Tarikh Tutup</th>
                <th className="px-8 py-8 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-risda-muted animate-pulse font-black uppercase tracking-[4px]">Memuatkan Senarai...</td>
                </tr>
              ) : filteredAds.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-risda-muted font-black uppercase tracking-[4px]">Tiada Iklan Ditemui</td>
                </tr>
              ) : filteredAds.map((ad) => {
                const itemDate = ad.visitDate || ad.closingDate || ad.createdAt;
                const itemYear = itemDate ? new Date(itemDate).getFullYear() : 0;
                const currentYear = new Date().getFullYear();
                const displayStatus = (itemYear > 0 && itemYear < currentYear) ? 'SELESAI (KEPUTUSAN)' : ad.status;

                return (
                <tr key={ad.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="px-8 py-8">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest leading-none ${
                      displayStatus === 'AKTIF' ? 'bg-green-500/20 text-green-400 border border-green-400/30' : 
                      displayStatus === 'BATAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      'bg-blue-500/20 text-blue-400 border border-blue-400/30'
                    }`}>
                      {displayStatus === 'SELESAI (KEPUTUSAN)' ? (itemYear < currentYear ? 'KEPUTUSAN RASMI (TAMAT)' : 'KEPUTUSAN RASMI') : displayStatus}
                    </span>
                  </td>
                  <td className="px-8 py-8">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {ad.category && (
                        <span className="inline-block px-2 py-0.5 text-[8px] font-black text-white bg-risda-orange/25 border border-risda-orange/40 rounded uppercase tracking-wider">
                          {ad.category}
                        </span>
                      )}
                      <div className="text-base font-black text-white group-hover:text-risda-gold transition-colors leading-tight uppercase max-w-xl">{ad.title}</div>
                    </div>
                    <div className="text-xs font-mono text-risda-gold/60 font-black uppercase tracking-[2px]">{ad.tenderNo}</div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="text-xs font-black text-white uppercase tracking-[2px] mb-1">{ad.office || 'SELURUH RISDA'}</div>
                    <div className="text-[10px] text-white/50 font-black tracking-[2px] uppercase">{ad.state || 'MALAYSIA'}</div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="text-sm font-black text-white mb-1 uppercase tracking-tight">{formatDate(ad.closingDate)}</div>
                    <div className="text-[10px] text-risda-gold font-black uppercase tracking-[2px]">12:00 PM</div>
                  </td>
                  <td className="px-8 py-8 text-right">
                    {isStaff && (
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        {ad.status !== 'BATAL' && (
                          <button 
                            onClick={() => openWinnerModal(ad)}
                            className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white hover:border-green-500/50 hover:text-green-500 transition-all"
                            title="Pilih Pemenang"
                          >
                            <Users size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleCopy(ad)}
                          className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white hover:border-green-500/50 hover:text-green-400 transition-all"
                          title="Salin Iklan Sebut Harga"
                        >
                          <Copy size={16} />
                        </button>
                        <button 
                          onClick={() => openEdit(ad)}
                          className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white hover:border-risda-orange/50 transition-all"
                          title="Kemaskini"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(ad.id)}
                          className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white hover:border-red-500/50 hover:text-red-500 transition-all"
                          title="Padam"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Add/Edit */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 pb-20">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-risda-card border border-risda-border w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[32px] overflow-hidden relative z-10 shadow-[0_30px_100px_rgba(0,0,0,0.8)]"
            >
              <div className="sticky top-0 z-20 p-8 border-b border-risda-border bg-risda-card/90 backdrop-blur-md flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-risda-orange rounded-2xl flex items-center justify-center text-black shadow-lg shadow-risda-orange/20">
                    <Briefcase size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">
                      {editingAd ? 'Kemaskini Iklan' : 'Daftar Iklan Baru'}
                    </h3>
                    <p className="text-[10px] text-risda-muted font-bold uppercase tracking-[2px]">Lengkapkan Maklumat Sebut Harga</p>
                  </div>
                </div>
                
                {!editingAd && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                      <FileUp size={16} className="text-risda-orange" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Auto-Jana PDF</span>
                      <input 
                        type="file" 
                        accept="application/pdf,image/*" 
                        className="hidden" 
                        onChange={(e) => e.target.files?.[0] && handleAIAnalysis(e.target.files[0])}
                      />
                    </label>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-10">
                {/* Basic Info */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-risda-muted uppercase tracking-[3px]">Tajuk Projek / Perolehan</label>
                    <textarea 
                      value={formData.title || ''}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      placeholder="cth: CADANGAN PROJEK JALAN BAGI PROGRAM PRASARANA ASAS PERTANIAN..."
                      className="w-full bg-black/40 border border-risda-border rounded-xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none min-h-[100px] resize-none"
                      required
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-risda-muted uppercase tracking-[3px]">Keperluan Lesen Pelantikan</label>
                    <textarea 
                      value={formData.licenseRequirements || ''}
                      onChange={(e) => setFormData({...formData, licenseRequirements: e.target.value})}
                      placeholder="Sila nyatakan keperluan lesen khusus untuk pelantikan pembekal ini jika ada..."
                      className="w-full bg-black/40 border border-risda-border rounded-xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none min-h-[80px] resize-none"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-risda-muted uppercase tracking-[3px]">Kategori Perolehan</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['KERJA', 'BEKALAN', 'PERKHIDMATAN'] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormData({ ...formData, category: cat })}
                          className={`py-3.5 px-4 rounded-xl text-xs font-black tracking-wider uppercase transition-all duration-200 border flex items-center justify-center gap-2 ${
                            formData.category === cat
                              ? 'bg-risda-orange text-white border-risda-orange shadow-lg shadow-risda-orange/30 scale-[1.01]'
                              : 'bg-black/40 text-risda-muted border-risda-border hover:bg-black/60 hover:text-white'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${
                            formData.category === cat ? 'bg-white' : 'bg-risda-muted'
                          }`} />
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-muted uppercase tracking-[3px]">Sebut Harga No.</label>
                    <input 
                      value={formData.tenderNo || ''}
                      onChange={(e) => setFormData({...formData, tenderNo: e.target.value})}
                      placeholder="cth: SH/S.6 –01/2026"
                      className="w-full bg-black/40 border border-risda-border rounded-xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-muted uppercase tracking-[3px]">Negeri</label>
                    {isAdmin || role === 'pentadbir' ? (
                      <select 
                        value={formData.state || ''}
                        onChange={(e) => setFormData({...formData, state: e.target.value, office: ''})}
                        className="w-full bg-black/40 border border-risda-border rounded-xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none"
                      >
                        <option value="">Pilih Negeri</option>
                        <option value="SABAH">SABAH</option>
                        <option value="SARAWAK">SARAWAK</option>
                        <option value="KUALA LUMPUR">KUALA LUMPUR</option>
                        <option value="SELANGOR">SELANGOR</option>
                        <option value="JOHOR">JOHOR</option>
                        <option value="KEDAH">KEDAH</option>
                        <option value="KELANTAN">KELANTAN</option>
                        <option value="MELAKA">MELAKA</option>
                        <option value="NEGERI SEMBILAN">NEGERI SEMBILAN</option>
                        <option value="PAHANG">PAHANG</option>
                        <option value="PULAU PINANG">PULAU PINANG</option>
                        <option value="PERAK">PERAK</option>
                        <option value="PERLIS">PERLIS</option>
                        <option value="TERENGGANU">TERENGGANU</option>
                      </select>
                    ) : (
                      <input 
                        value={userState || 'TIDAK DITETAPKAN'}
                        disabled
                        className="w-full bg-black/20 border border-risda-border rounded-xl py-4 px-6 text-xs text-risda-muted outline-none"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-muted uppercase tracking-[3px]">Pejabat RISDA Yang Mengeluarkan</label>
                    {isAdmin || role === 'pentadbir' ? (
                      <select 
                        value={formData.office || ''}
                        onChange={(e) => setFormData({...formData, office: e.target.value})}
                        className="w-full bg-black/40 border border-risda-border rounded-xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none"
                        required
                      >
                        <option value="">Pilih Pejabat</option>
                        {locations
                          .filter(loc => (!formData.state || loc.state === formData.state) && loc.status === 'Aktif')
                          .map(loc => (
                            <option key={loc.id} value={loc.office}>{loc.office}</option>
                          ))
                        }
                      </select>
                    ) : (
                      <input 
                        value={userOffice || 'Tidak Ditetapkan'}
                        disabled
                        className="w-full bg-black/20 border border-risda-border rounded-xl py-4 px-6 text-xs text-risda-muted outline-none"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-muted uppercase tracking-[3px]">Tarikh Iklan Dikeluarkan</label>
                    <input 
                      type="date"
                      value={formData.publishedDate || ''}
                      onChange={(e) => setFormData({...formData, publishedDate: e.target.value})}
                      className="w-full bg-black/40 border border-risda-border rounded-xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none"
                    />
                  </div>
                </section>

                <div className="h-px bg-risda-border opacity-30" />

                {/* Requirements */}
                <section className="space-y-4">
                  <label className="text-[10px] font-black text-risda-muted uppercase tracking-[4px]">Keperluan Lesen & Sijil</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { id: 'cidbSpkk', label: 'CIDB (SPKK)' },
                      { id: 'cidbPkk', label: 'CIDB (PKK)' },
                      { id: 'stb', label: 'STB' },
                      { id: 'mof', label: 'MOF' },
                      { id: 'tcc', label: 'TCC' },
                      { id: 'pukonsa', label: 'PUKONSA' },
                      { id: 'kuhean', label: 'KUHEAN' },
                    ].map(license => (
                      <div key={license.id} className="space-y-2">
                        <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl cursor-pointer hover:border-risda-orange/30 transition-all">
                          <input 
                            type="checkbox"
                            checked={!!(formData.licenses as any)[license.id]}
                            onChange={(e) => setFormData({
                              ...formData, 
                              licenses: { ...formData.licenses, [license.id]: e.target.checked }
                            })}
                            className="w-5 h-5 rounded-lg border-2 border-white/20 bg-transparent checked:bg-risda-orange appearance-none relative checked:after:content-['✓'] after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-xs after:text-black after:font-black"
                          />
                          <span className="text-[11px] font-black text-white uppercase tracking-widest">{license.label}</span>
                        </label>
                        
                        <AnimatePresence>
                          {(formData.licenses as any)[license.id] && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <input 
                                value={(formData.licenseDescriptions as any)[license.id] || ''}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  licenseDescriptions: {
                                    ...formData.licenseDescriptions,
                                    [license.id]: e.target.value
                                  }
                                })}
                                placeholder="Keterangan Penuh Lesen..."
                                className="w-full bg-black/60 border border-risda-border/30 rounded-xl py-2 px-3 text-[10px] text-risda-gold italic outline-none focus:border-risda-orange/30"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                  <input 
                    placeholder="Lain-lain keperluan (cth: Gred G1, Kelas F...)"
                    value={formData.licenses.others || ''}
                    onChange={(e) => setFormData({ ...formData, licenses: { ...formData.licenses, others: e.target.value }})}
                    className="w-full bg-black/40 border border-risda-border rounded-xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none mt-2"
                  />
                </section>

                <div className="h-px bg-risda-border opacity-30" />

                {/* Briefing & Visit */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-risda-orange uppercase tracking-[4px]">Taklimat Tapak</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-risda-muted uppercase">Tarikh</label>
                        <input type="date" value={formData.briefingDate || ''} onChange={(e) => setFormData({...formData, briefingDate: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-risda-muted uppercase">Waktu</label>
                        <input placeholder="10:00 Pagi" value={formData.briefingTime || ''} onChange={(e) => setFormData({...formData, briefingTime: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-risda-muted uppercase">Tempat Pendaftaran</label>
                      <input placeholder="Pejabat RISDA Stesen Sipitang" value={formData.briefingVenue || ''} onChange={(e) => setFormData({...formData, briefingVenue: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white" />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[4px]">Lawatan Tapak</h4>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-risda-muted uppercase">Tarikh Lawatan</label>
                      <input type="date" value={formData.visitDate || ''} onChange={(e) => setFormData({...formData, visitDate: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-risda-muted uppercase">Tempat Lawatan</label>
                      <input placeholder="Kampung Kabiah Kuala Muaya" value={formData.visitVenue || ''} onChange={(e) => setFormData({...formData, visitVenue: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white" />
                    </div>
                  </div>
                </section>

                <div className="h-px bg-risda-border opacity-30" />

                {/* Documents & Closing */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-risda-gold uppercase tracking-[4px]">Dokumen Sebut Harga</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-risda-muted uppercase">Tarikh Mula</label>
                        <input type="date" value={formData.docStartDate || ''} onChange={(e) => setFormData({...formData, docStartDate: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-risda-muted uppercase">Tarikh Akhir</label>
                        <input type="date" value={formData.docEndDate || ''} onChange={(e) => setFormData({...formData, docEndDate: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-risda-muted uppercase">Tempat Ambil Dokumen</label>
                      <input placeholder="Unit Kewangan Pejabat RISDA Beaufort" value={formData.docVenue || ''} onChange={(e) => setFormData({...formData, docVenue: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white" />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[4px]">Tarikh Tutup & Serahan</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-risda-muted uppercase">Tarikh Tutup</label>
                        <input type="date" value={formData.closingDate || ''} onChange={(e) => setFormData({...formData, closingDate: e.target.value})} className="w-full bg-black/20 border border-red-500/20 rounded-xl py-3 px-4 text-xs text-white" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-risda-muted uppercase">Waktu Tutup</label>
                        <input value={formData.closingTime || ''} onChange={(e) => setFormData({...formData, closingTime: e.target.value})} className="w-full bg-black/20 border border-red-500/20 rounded-xl py-3 px-4 text-xs text-white" />
                      </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-bold text-risda-muted uppercase">Tempat Serahan (Peti Sebut Harga)</label>
                        <input placeholder="Pejabat RISDA Beaufort" value={formData.closingVenue || ''} onChange={(e) => setFormData({...formData, closingVenue: e.target.value})} className="w-full bg-black/20 border border-red-500/20 rounded-xl py-3 px-4 text-xs text-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-risda-muted uppercase">Status</label>
                      <select 
                        value={formData.status || 'AKTIF'}
                        onChange={(e: any) => setFormData({...formData, status: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:border-risda-orange/50 outline-none"
                      >
                        <option value="AKTIF">AKTIF</option>
                        <option value="BATAL">BATAL</option>
                        <option value="SELESAI (KEPUTUSAN)">KEPUTUSAN RASMI</option>
                      </select>
                    </div>
                  </div>
                </section>

                <div className="sticky bottom-0 bg-risda-card/90 backdrop-blur-md pt-8 flex gap-4">
                  <button type="submit" className="btn-gold flex-1 py-5 text-sm">
                    {editingAd ? 'Simpan Kemaskini' : 'Paparkan Iklan'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-10 py-5 bg-white/5 border border-white/10 rounded-xl text-[11px] font-black uppercase tracking-[2px] text-white hover:bg-white/10 transition-all"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Winner Selection Modal */}
      <AnimatePresence>
        {showWinnerModal && selectedAdForWinner && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/90 backdrop-blur-xl"
               onClick={() => {
                 if (!pendingWinner) setShowWinnerModal(false);
               }}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-risda-card border border-white/5 w-full max-w-6xl rounded-[40px] overflow-hidden relative z-10 shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
            >
              {/* Left Side: Participant List */}
              <div className={`flex flex-col border-r border-white/5 transition-all duration-500 ${pendingWinner ? 'w-full md:w-[60%]' : 'w-full'}`}>
                <div className="p-8 border-b border-white/5 bg-black/20">
                  <div className="flex items-center justify-between gap-6 mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-black">
                        <Users size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight leading-none mb-1">Pilih Pemenang</h3>
                        <p className="text-[9px] text-risda-muted font-bold uppercase tracking-[3px]">Resolusi Akhir Sebut Harga</p>
                      </div>
                    </div>
                    {!pendingWinner && (
                      <button 
                        onClick={() => setShowWinnerModal(false)}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                     <div className="flex-1">
                       <p className="text-[9px] font-mono text-risda-gold font-bold uppercase tracking-widest mb-1 opacity-50">{selectedAdForWinner.tenderNo}</p>
                       <h4 className="text-xs font-black text-white uppercase leading-tight">{selectedAdForWinner.title}</h4>
                     </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-[10px] font-black text-risda-orange uppercase tracking-[3px]">Senarai Peserta Selesai Taklimat</h5>
                    <span className="text-[9px] text-risda-muted font-bold uppercase tracking-widest">{attendees.length} SYARIKAT</span>
                  </div>
                  {loadingAttendees ? (
                    <div className="py-20 text-center">
                      <div className="w-10 h-10 border-2 border-risda-orange/10 border-t-risda-orange rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-risda-muted font-black uppercase tracking-[4px] text-[9px] animate-pulse">Menyelaras Senarai...</p>
                    </div>
                  ) : attendees.length === 0 ? (
                    <div className="py-20 text-center border border-dashed border-white/5 rounded-3xl flex flex-col items-center gap-4">
                      <AlertCircle size={32} className="text-white/10" />
                      <p className="text-risda-muted font-black uppercase tracking-[4px] text-[9px]">Tiada rekod kehadiran dijumpai</p>
                    </div>
                  ) : (
                    attendees.map((attendee: any) => (
                      <div 
                        key={attendee.id} 
                        className={`p-6 border transition-all relative overflow-hidden flex items-center justify-between group rounded-2xl ${
                          pendingWinner?.id === attendee.id 
                            ? 'bg-risda-orange/20 border-risda-orange border-2' 
                            : 'bg-white/5 border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="relative z-10 flex-1 min-w-0">
                          <h5 className="text-sm font-black text-white uppercase mb-1 truncate">{attendee.companyName}</h5>
                          <div className="flex items-center gap-4 text-[9px] text-risda-muted font-bold uppercase tracking-widest">
                             <span className="text-white/40 italic">{attendee.ownerName || attendee.representativeName}</span>
                             <span className="opacity-20">•</span>
                             <span className="text-risda-gold">{attendee.phoneNumber}</span>
                          </div>
                        </div>
                        {!pendingWinner && (
                          <button 
                            onClick={() => handleSelectWinnerPreview(attendee)}
                            className="shrink-0 px-6 py-3 bg-risda-orange text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ml-4"
                          >
                            Pilih
                          </button>
                        )}
                        {pendingWinner?.id === attendee.id && (
                          <div className="w-8 h-8 bg-risda-orange rounded-full flex items-center justify-center text-black">
                            <CheckCircle size={18} />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Side: Winner Confirmation Form */}
              <AnimatePresence>
                {pendingWinner && (
                  <motion.div 
                    initial={{ x: 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 300, opacity: 0 }}
                    className="w-full md:w-[40%] bg-black/40 p-8 flex flex-col h-full border-l border-white/5"
                  >
                    <div className="flex-1 overflow-y-auto space-y-8 pr-2">
                       <div className="text-center space-y-2">
                        <div className="inline-flex px-3 py-1 bg-risda-orange/10 border border-risda-orange/20 rounded-full text-[9px] font-black text-risda-orange uppercase tracking-widest">Langkah Pengesahan</div>
                        <h3 className="text-xl font-black text-white uppercase">Maklumat Kontrak</h3>
                        <p className="text-[10px] text-risda-muted font-bold uppercase tracking-widest italic">{pendingWinner.companyName}</p>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-risda-orange uppercase tracking-[3px] px-1">Tarikh Pemenang Dipilih / Keputusan</label>
                          <input 
                            type="date"
                            value={winnerDates.decisionDate}
                            onChange={(e) => setWinnerDates({...winnerDates, decisionDate: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 text-sm text-white outline-none focus:border-risda-orange/50 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-risda-orange uppercase tracking-[3px] px-1">Tarikh Mula Kerja</label>
                          <input 
                            type="date"
                            value={winnerDates.startDate}
                            onChange={(e) => setWinnerDates({...winnerDates, startDate: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 text-sm text-white outline-none focus:border-risda-orange/50 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-risda-orange uppercase tracking-[3px] px-1">Tarikh Akhir Kerja</label>
                          <input 
                            type="date"
                            value={winnerDates.endDate}
                            onChange={(e) => setWinnerDates({...winnerDates, endDate: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 text-sm text-white outline-none focus:border-risda-orange/50 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-risda-orange uppercase tracking-[3px] px-1">Harga Perolehan Terpilih / Nilai Keputusan (RM)</label>
                          <input 
                            type="number"
                            placeholder="Contoh: 125000"
                            value={winnerDates.winningPrice}
                            onChange={(e) => setWinnerDates({...winnerDates, winningPrice: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 text-sm text-white outline-none focus:border-risda-orange/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                        <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[9px] text-risda-muted font-bold uppercase tracking-[2px] mb-1">Tempat Kerja (Auto)</p>
                          <p className="text-[11px] text-white font-black uppercase italic leading-tight">{selectedAdForWinner?.visitVenue || selectedAdForWinner?.docVenue || '-'}</p>
                        </div>

                        <div className="pt-2 space-y-4">
                          <label className="text-[9px] font-black text-risda-orange uppercase tracking-[3px] px-1">Pilihan Hebahan Autonotifikasi</label>
                          <div className="flex flex-col gap-3">
                            <button
                              onClick={() => setNotifyPrefs(prev => ({ ...prev, whatsapp: !prev.whatsapp }))}
                              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                                notifyPrefs.whatsapp 
                                  ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                                  : 'bg-white/5 border-white/10 text-white/30'
                              }`}
                            >
                              <div className={`p-2 rounded-lg ${notifyPrefs.whatsapp ? 'bg-green-500 text-black' : 'bg-white/10 text-white/30'}`}>
                                <MessageCircle size={16} />
                              </div>
                              <span className="text-[11px] font-black uppercase tracking-[2px]">Hebahan WhatsApp</span>
                            </button>
                            <button
                              onClick={() => setNotifyPrefs(prev => ({ ...prev, email: !prev.email }))}
                              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                                notifyPrefs.email 
                                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                                  : 'bg-white/5 border-white/10 text-white/30'
                              }`}
                            >
                              <div className={`p-2 rounded-lg ${notifyPrefs.email ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/30'}`}>
                                <Mail size={16} />
                              </div>
                              <span className="text-[11px] font-black uppercase tracking-[2px]">Hebahan Emel</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 flex flex-col gap-3">
                      <button 
                        onClick={handleConfirmWinner}
                        className="w-full py-5 bg-risda-orange text-black rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-xl shadow-risda-orange/10 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <Send size={18} />
                        Simpan & Hebah Keputusan
                      </button>
                      <button 
                        onClick={() => {
                          setPendingWinner(null);
                          setWinnerDates({ startDate: '', endDate: '', winningPrice: '', location: '', decisionDate: '' });
                        }}
                        className="w-full py-4 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-risda-muted hover:text-white rounded-2xl transition-all"
                      >
                        Kembali ke Senarai
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
