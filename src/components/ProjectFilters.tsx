import { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import QRCode from 'qrcode';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { FileText, Download, UserCheck, X, Shield, Search, AlertCircle, FileSpreadsheet, FileArchive, File as FileIcon, Send, MessageCircle, Mail, RotateCcw, ChevronDown, ChevronUp, FolderOpen, Clock, CheckCircle2, QrCode, Camera } from 'lucide-react';
import AttendanceForm from './AttendanceForm';
import Pagination from './Pagination';
import { exportToPDF, exportToWord, exportResultToPDF, exportResultToWord, formatMofText, getLicenseNamesForTerms } from '../lib/exportUtils';
import { isWithinUserScope, calculateTempohSiapKerja, parseAnyDate } from '../lib/scopeUtils';

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr || dateStr === '-' || dateStr === 'TIADA') return dateStr || '-';
  
  try {
    const d = parseAnyDate(dateStr);
    if (!d || isNaN(d.getTime())) return dateStr;
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

export default function ProjectFilters({ 
  showRegistration = true, 
  initialStatus,
  sourceContext 
}: { 
  showRegistration?: boolean; 
  initialStatus?: string;
  sourceContext?: 'dashboard' | 'projek' | 'keputusan';
}) {
  const { role, office: userOffice, state: userState, district: userDistrict } = useAuth();
  const isStaff = role === 'penginput' || role === 'penyemak' || role === 'pelulus' || role === 'admin' || role === 'pentadbir';
  const isAdmin = role === 'admin' || role === 'pentadbir';

  const effectiveContext = sourceContext || (
    initialStatus === 'SELESAI (KEPUTUSAN)' 
      ? 'keputusan' 
      : showRegistration 
        ? 'dashboard' 
        : 'projek'
  );
  const isDecisionPortal = initialStatus === 'SELESAI (KEPUTUSAN)' || effectiveContext === 'keputusan';

  const [dashboardModalView, setDashboardModalView] = useState<'iklan' | 'keputusan'>('iklan');

  const [ads, setAds] = useState<any[]>([]);
  const [adViewFormat, setAdViewFormat] = useState<'preview' | 'data'>('preview');
  const [offices, setOffices] = useState<any[]>([]);
  const [allLocations, setAllLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear().toString();
  const [filters, setFilters] = useState({
    state: '',
    office: '',
    category: 'SEMUA',
    year: initialStatus === 'SELESAI (KEPUTUSAN)' ? 'ALL' : currentYear,
    status: initialStatus || (isStaff ? 'SEMUA' : 'AKTIF')
  });

  const [selectedAd, setSelectedAd] = useState<any>(null);

  useEffect(() => {
    if (selectedAd) {
      if (selectedAd.status === 'SELESAI (KEPUTUSAN)' && effectiveContext === 'dashboard') {
        setDashboardModalView('keputusan');
      } else {
        setDashboardModalView('iklan');
      }
    }
  }, [selectedAd, effectiveContext]);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isViewOnlyList, setIsViewOnlyList] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Kawalan paparan senarai iklan ("apabila tekan kotak tersebut baru la keluar senarai")
  const [isListOpen, setIsListOpen] = useState(
    sourceContext === 'projek' || sourceContext === 'keputusan'
  );

  const handleCategoryBoxClick = (statusKey: string) => {
    if (isListOpen && filters.status === statusKey) {
      setIsListOpen(false);
    } else {
      setFilters(prev => ({ ...prev, status: statusKey }));
      setIsListOpen(true);
      setTimeout(() => {
        tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  };

  const handleCategoryBoxDoubleClick = (statusKey: string) => {
    // Dwi-klik (double click) untuk menutup senarai
    if (isListOpen) {
      setIsListOpen(false);
    }
  };

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const tableTopRef = useRef<HTMLDivElement>(null);

  // Reset to page 1 whenever filters or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchQuery]);

  // Generate client-side base64 QR Code for selected advertisement
  useEffect(() => {
    if (selectedAd && selectedAd.id) {
      const url = `${window.location.origin}/?adId=${selectedAd.id}`;
      QRCode.toDataURL(url, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
      .then((dataUrl) => {
        setQrCodeUrl(dataUrl);
      })
      .catch((err) => {
        console.error('Client-side QR generation failed, falling back to server path...', err);
        setQrCodeUrl(`/api/qr-code.png?adId=${selectedAd.id}&origin=${encodeURIComponent(window.location.origin)}`);
      });
    } else {
      setQrCodeUrl('');
    }
  }, [selectedAd]);

  useEffect(() => {
    fetchAds();
  }, [filters, role, userOffice]);

  // Read adId search param to auto-select and open attendance form
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const adIdParam = params.get('adId');
    if (adIdParam && ads.length > 0) {
      const foundAd = ads.find(a => a.id === adIdParam);
      if (foundAd) {
        setSelectedAd(foundAd);
        setIsRegisterMode(true);
        setIsViewOnlyList(false);
      }
    }
  }, [ads]);

  // Quietly remove adId search param when modal is closed
  useEffect(() => {
    if (!selectedAd) {
      const url = new URL(window.location.href);
      if (url.searchParams.has('adId')) {
        url.searchParams.delete('adId');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    }
  }, [selectedAd]);

  useEffect(() => {
    // Listen for custom trigger from Hero
    const handleRegisterTrigger = () => {
      setIsRegisterMode(true);
      setIsViewOnlyList(false);
      setSelectedAd({}); // Open modal with empty selection
    };

    const handleViewActiveAdsTrigger = () => {
      setIsRegisterMode(false);
      setIsViewOnlyList(true);
      setSelectedAd({}); // Open modal to select active ad for viewing
      setIsListOpen(true);
    };

    window.addEventListener('triggerRegister', handleRegisterTrigger);
    window.addEventListener('triggerViewActiveAds', handleViewActiveAdsTrigger);
    return () => {
      window.removeEventListener('triggerRegister', handleRegisterTrigger);
      window.removeEventListener('triggerViewActiveAds', handleViewActiveAdsTrigger);
    };
  }, []);

  const fetchAds = async () => {
    setLoading(true);
    try {
      // Fetch locations for filter
      try {
        const locationsSnap = await getDocs(collection(db, 'locations'));
        const locationList = locationsSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().office,
          state: doc.data().state,
          status: doc.data().status || 'Aktif'
        }));
        setAllLocations(locationList);
        
        // Update filtered offices based on current state filter
        const filteredOffices = locationList
          .filter(loc => (!filters.state || loc.state === filters.state) && loc.status === 'Aktif')
          .map(loc => loc.name?.trim().toUpperCase())
          .filter(Boolean)
          .sort();
        setOffices(Array.from(new Set(filteredOffices)));
      } catch (offErr) {
        console.error("Error fetching locations:", offErr);
      }

      // Admin, Penginput, and Pelulus can see everything in the system
      let q = query(collection(db, 'ads'), orderBy('tenderNo', 'desc'));
      
      if (filters.state) {
        q = query(q, where('state', '==', filters.state));
      }

      if (filters.office) {
        q = query(q, where('office', '==', filters.office));
      }
      
      const querySnapshot = await getDocs(q);
      let adsData: any[] = [];
      querySnapshot.forEach((doc) => {
        adsData.push({ id: doc.id, ...doc.data() });
      });

      // Filter status in memory if staff or specific status selected
      // But we'll keep the raw adsData in state so the modal can access all active ads
      setAds(adsData);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'ads');
    } finally {
      setLoading(false);
    }
  };

  const handleNotify = (ad: any, type: 'whatsapp' | 'email') => {
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

  const isHomepageVisitor = !isStaff && showRegistration;

  // We'll calculate counts in memory for our status tabs!
  const activeCount = ads.filter(ad => {
    const itemDate = ad.visitDate || ad.closingDate || ad.createdAt;
    const itemYear = itemDate ? new Date(itemDate).getFullYear() : 0;
    const isOld = itemYear > 0 && itemYear < parseInt(currentYear);
    const displayStatus = isOld ? 'SELESAI (KEPUTUSAN)' : ad.status;
    return displayStatus === 'AKTIF';
  }).length;

  const resolvedCount = ads.filter(ad => {
    const itemDate = ad.visitDate || ad.closingDate || ad.createdAt;
    const itemYear = itemDate ? new Date(itemDate).getFullYear() : 0;
    const isOld = itemYear > 0 && itemYear < parseInt(currentYear);
    const displayStatus = isOld ? 'SELESAI (KEPUTUSAN)' : ad.status;
    return displayStatus === 'SELESAI (KEPUTUSAN)';
  }).length;

  const batalCount = ads.filter(ad => ad.status === 'BATAL').length;

  const totalCount = ads.length;

  const pendingDecisionCount = ads.filter(ad => {
    const itemDate = ad.visitDate || ad.closingDate || ad.createdAt;
    const itemYear = itemDate ? new Date(itemDate).getFullYear() : 0;
    const isOld = itemYear > 0 && itemYear < parseInt(currentYear);
    const displayStatus = isOld ? 'SELESAI (KEPUTUSAN)' : ad.status;
    return displayStatus !== 'SELESAI (KEPUTUSAN)' && ad.status !== 'BATAL';
  }).length;

  // Pre-calculate filtered ads to avoid logic branch mess in JSX
  const filteredAds = ads
    .map(ad => {
      const itemDate = ad.visitDate || ad.closingDate || ad.createdAt;
      const itemYear = itemDate ? new Date(itemDate).getFullYear() : 0;
      const isOldProject = itemYear > 0 && itemYear < parseInt(currentYear);
      const displayStatus = isOldProject ? 'SELESAI (KEPUTUSAN)' : ad.status;
      return { ...ad, displayStatus, isOldProject };
    })
    .filter(ad => {
      if (filters.status === 'SEMUA') return true;
      if (filters.status === 'BELUM_ADA_KEPUTUSAN') {
        return ad.displayStatus !== 'SELESAI (KEPUTUSAN)' && ad.status !== 'BATAL';
      }
      return ad.displayStatus === filters.status;
    })
    .filter(ad => {
      return filters.category === 'SEMUA' || (ad.category || 'KERJA') === filters.category;
    })
    .filter(ad => {
      if (filters.year === 'ALL') return true;
      const date = ad.visitDate || ad.closingDate || ad.createdAt;
      if (!date) return false;
      return new Date(date).getFullYear().toString() === filters.year;
    })
    .filter(ad => {
      if (!filters.state) return true;
      return ad.state === filters.state;
    })
    .filter(ad => {
      if (!filters.office) return true;
      return ad.office === filters.office;
    })
    .filter(ad => {
      return isWithinUserScope(ad, { role, state: userState, district: userDistrict, office: userOffice });
    })
    .filter(ad => {
      if (!searchQuery) return true;
      const queryStr = searchQuery.toLowerCase();
      return (
        (ad.title || '').toLowerCase().includes(queryStr) ||
        (ad.tenderNo || '').toLowerCase().includes(queryStr) ||
        (ad.office || '').toLowerCase().includes(queryStr) ||
        (ad.state || '').toLowerCase().includes(queryStr)
      );
    });

  // Calculate paginated ads
  const totalPages = Math.max(1, Math.ceil(filteredAds.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedAds = filteredAds.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  return (
    <section className="space-y-12 pb-24 text-left w-full relative">
      <div className="w-full">
        {/* Portal Header with Premium Glassmorphism Statistics Overview */}
        <div className="relative overflow-hidden bg-risda-card border border-risda-border rounded-[32px] sm:rounded-[36px] p-6 md:p-9 mb-8 shadow-sm">
          {/* Ambient light glow backdrop */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-gradient-to-r from-risda-orange/10 to-risda-gold/10 blur-[130px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col gap-6">
            <div className="space-y-3">
              <div className="badge-live-pill inline-flex items-center gap-2.5 px-4 py-1.5 bg-risda-orange/15 border border-risda-orange/20 rounded-full">
                <span className="w-1.5 h-1.5 bg-risda-orange rounded-full animate-pulse shadow-[0_0_8px_rgba(255,176,0,1)]" />
                <span className="text-[9px] font-black uppercase tracking-[3px] text-risda-orange">KEMAS KINI LANGSUNG (LIVE)</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-risda-text tracking-tight uppercase !leading-tight">
                {initialStatus === 'SELESAI (KEPUTUSAN)' ? 'Keputusan Rasmi Kontraktor' : initialStatus === 'AKTIF' ? 'Portal Iklan Sebut Harga' : 'Portal Perolehan & Keputusan'}
              </h2>
              <p className="text-xs sm:text-sm text-risda-text-secondary font-medium max-w-2xl leading-relaxed font-sans">
                {initialStatus === 'SELESAI (KEPUTUSAN)' 
                  ? 'Papar keputusan rasmi pemenang lantikan kontraktor RISDA secara bersepadu, telus dan mutakhir.'
                  : initialStatus === 'AKTIF'
                  ? 'Papar iklan sebut harga semasa, pendaftaran taklimat tapak, serta arkib status sebut harga secara bersepadu dan telus.'
                  : 'Papar iklan sebut harga aktif semasa, pendaftaran taklimat tapak, serta keputusan rasmi pemenang lantikan kontraktor RISDA secara bersepadu dan telus.'}
              </p>
            </div>

            {isDecisionPortal ? (
              /* Paparan 2 Kotak Khusus Keputusan Rasmi Kontraktor: Keputusan Selesai & Belum Ada Keputusan */
              <div className="pt-6 border-t border-risda-border/70 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                {/* 1. KEPUTUSAN SELESAI */}
                <button
                  type="button"
                  id="kotak-keputusan-selesai"
                  onClick={() => handleCategoryBoxClick('SELESAI (KEPUTUSAN)')}
                  onDoubleClick={() => handleCategoryBoxDoubleClick('SELESAI (KEPUTUSAN)')}
                  title={filters.status === 'SELESAI (KEPUTUSAN)' && isListOpen ? "Klik atau dwi-klik untuk tutup senarai" : "Klik untuk papar senarai Keputusan Selesai"}
                  className={`p-5 sm:p-6 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col justify-between gap-4 group cursor-pointer relative overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                    filters.status === 'SELESAI (KEPUTUSAN)' && isListOpen
                      ? 'bg-blue-500/10 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30 shadow-sm'
                      : 'bg-risda-card border-risda-border hover:border-blue-500/70 hover:bg-blue-500/5 dark:hover:bg-blue-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.9)] animate-pulse shrink-0" />
                      <div className="min-w-0">
                        <span className="category-box-title text-sm sm:text-base font-black uppercase tracking-wider text-risda-text block truncate">
                          KEPUTUSAN SELESAI
                        </span>
                        <span className="text-[11px] text-risda-muted font-medium hidden sm:inline-block truncate">
                          Perolehan yang telah dimuktamadkan pemenang lantikan
                        </span>
                      </div>
                    </div>
                    <span className={`min-w-[48px] h-[42px] px-3.5 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-black transition-all shrink-0 ${
                      filters.status === 'SELESAI (KEPUTUSAN)' && isListOpen
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30 group-hover:bg-blue-500/20'
                    }`}>
                      {resolvedCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-3 border-t border-risda-border/70">
                    <span className={`font-bold transition-colors ${
                      filters.status === 'SELESAI (KEPUTUSAN)' && isListOpen 
                        ? 'text-blue-600 dark:text-blue-400 font-extrabold' 
                        : 'text-risda-muted group-hover:text-risda-text'
                    }`}>
                      {filters.status === 'SELESAI (KEPUTUSAN)' && isListOpen ? '● Sedang Dipapar (Klik 2x Tutup)' : 'Tekan untuk lihat senarai selesai'}
                    </span>
                    {filters.status === 'SELESAI (KEPUTUSAN)' && isListOpen ? (
                      <ChevronUp size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-risda-muted group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-y-0.5 transition-all shrink-0" />
                    )}
                  </div>
                </button>

                {/* 2. BELUM ADA KEPUTUSAN */}
                <button
                  type="button"
                  id="kotak-belum-ada-keputusan"
                  onClick={() => handleCategoryBoxClick('BELUM_ADA_KEPUTUSAN')}
                  onDoubleClick={() => handleCategoryBoxDoubleClick('BELUM_ADA_KEPUTUSAN')}
                  title={filters.status === 'BELUM_ADA_KEPUTUSAN' && isListOpen ? "Klik atau dwi-klik untuk tutup senarai" : "Klik untuk papar senarai Belum Ada Keputusan"}
                  className={`p-5 sm:p-6 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col justify-between gap-4 group cursor-pointer relative overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                    filters.status === 'BELUM_ADA_KEPUTUSAN' && isListOpen
                      ? 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30 shadow-sm'
                      : 'bg-risda-card border-risda-border hover:border-amber-500/70 hover:bg-amber-500/5 dark:hover:bg-amber-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-pulse shrink-0" />
                      <div className="min-w-0">
                        <span className="category-box-title text-sm sm:text-base font-black uppercase tracking-wider text-risda-text block truncate">
                          BELUM ADA KEPUTUSAN
                        </span>
                        <span className="text-[11px] text-risda-muted font-medium hidden sm:inline-block truncate">
                          Perolehan dalam proses penilaian / belum dimuktamadkan
                        </span>
                      </div>
                    </div>
                    <span className={`min-w-[48px] h-[42px] px-3.5 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-black transition-all shrink-0 ${
                      filters.status === 'BELUM_ADA_KEPUTUSAN' && isListOpen
                        ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-500/30'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 group-hover:bg-amber-500/20'
                    }`}>
                      {pendingDecisionCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-3 border-t border-risda-border/70">
                    <span className={`font-bold transition-colors ${
                      filters.status === 'BELUM_ADA_KEPUTUSAN' && isListOpen 
                        ? 'text-amber-600 dark:text-amber-400 font-extrabold' 
                        : 'text-risda-muted group-hover:text-risda-text'
                    }`}>
                      {filters.status === 'BELUM_ADA_KEPUTUSAN' && isListOpen ? '● Sedang Dipapar (Klik 2x Tutup)' : 'Tekan untuk lihat senarai dalam proses'}
                    </span>
                    {filters.status === 'BELUM_ADA_KEPUTUSAN' && isListOpen ? (
                      <ChevronUp size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-risda-muted group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-y-0.5 transition-all shrink-0" />
                    )}
                  </div>
                </button>
              </div>
            ) : (
              /* Kotak Iklan 4 Kategori (Iklan Aktif, Iklan Selesai, Iklan Batal, Semua Iklan) Di Dalam Banner */
              <div className="pt-6 border-t border-risda-border/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4.5">
                {/* 1. IKLAN AKTIF */}
                <button
                  type="button"
                  id="kotak-iklan-aktif"
                  onClick={() => handleCategoryBoxClick('AKTIF')}
                  onDoubleClick={() => handleCategoryBoxDoubleClick('AKTIF')}
                  title={filters.status === 'AKTIF' && isListOpen ? "Klik atau dwi-klik untuk tutup senarai" : "Klik untuk papar senarai Iklan Aktif"}
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col justify-between gap-3.5 group cursor-pointer relative overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                    filters.status === 'AKTIF' && isListOpen
                      ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30 shadow-sm'
                      : 'bg-risda-card border-risda-border hover:border-emerald-500/70 hover:bg-emerald-500/5 dark:hover:bg-emerald-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse shrink-0" />
                      <span className="category-box-title text-xs sm:text-sm font-black uppercase tracking-wider text-risda-text truncate">
                        IKLAN AKTIF
                      </span>
                    </div>
                    <span className={`min-w-[44px] h-[40px] px-3.5 rounded-xl flex items-center justify-center text-lg sm:text-xl font-black transition-all shrink-0 ${
                      filters.status === 'AKTIF' && isListOpen
                        ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-500/20'
                    }`}>
                      {activeCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-risda-border/70">
                    <span className={`font-bold transition-colors ${
                      filters.status === 'AKTIF' && isListOpen 
                        ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' 
                        : 'text-risda-muted group-hover:text-risda-text'
                    }`}>
                      {filters.status === 'AKTIF' && isListOpen ? '● Sedang Dipapar (Klik 2x Tutup)' : 'Tekan untuk lihat senarai'}
                    </span>
                    {filters.status === 'AKTIF' && isListOpen ? (
                      <ChevronUp size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-risda-muted group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-y-0.5 transition-all shrink-0" />
                    )}
                  </div>
                </button>

                {/* 2. IKLAN SELESAI */}
                <button
                  type="button"
                  id="kotak-iklan-selesai"
                  onClick={() => handleCategoryBoxClick('SELESAI (KEPUTUSAN)')}
                  onDoubleClick={() => handleCategoryBoxDoubleClick('SELESAI (KEPUTUSAN)')}
                  title={filters.status === 'SELESAI (KEPUTUSAN)' && isListOpen ? "Klik atau dwi-klik untuk tutup senarai" : "Klik untuk papar senarai Iklan Selesai"}
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col justify-between gap-3.5 group cursor-pointer relative overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                    filters.status === 'SELESAI (KEPUTUSAN)' && isListOpen
                      ? 'bg-blue-500/10 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30 shadow-sm'
                      : 'bg-risda-card border-risda-border hover:border-blue-500/70 hover:bg-blue-500/5 dark:hover:bg-blue-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.9)] shrink-0" />
                      <span className="category-box-title text-xs sm:text-sm font-black uppercase tracking-wider text-risda-text truncate">
                        IKLAN SELESAI
                      </span>
                    </div>
                    <span className={`min-w-[44px] h-[40px] px-3.5 rounded-xl flex items-center justify-center text-lg sm:text-xl font-black transition-all shrink-0 ${
                      filters.status === 'SELESAI (KEPUTUSAN)' && isListOpen
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30 group-hover:bg-blue-500/20'
                    }`}>
                      {resolvedCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-risda-border/70">
                    <span className={`font-bold transition-colors ${
                      filters.status === 'SELESAI (KEPUTUSAN)' && isListOpen 
                        ? 'text-blue-600 dark:text-blue-400 font-extrabold' 
                        : 'text-risda-muted group-hover:text-risda-text'
                    }`}>
                      {filters.status === 'SELESAI (KEPUTUSAN)' && isListOpen ? '● Sedang Dipapar (Klik 2x Tutup)' : 'Tekan untuk lihat senarai'}
                    </span>
                    {filters.status === 'SELESAI (KEPUTUSAN)' && isListOpen ? (
                      <ChevronUp size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-risda-muted group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-y-0.5 transition-all shrink-0" />
                    )}
                  </div>
                </button>

                {/* 3. IKLAN BATAL */}
                <button
                  type="button"
                  id="kotak-iklan-batal"
                  onClick={() => handleCategoryBoxClick('BATAL')}
                  onDoubleClick={() => handleCategoryBoxDoubleClick('BATAL')}
                  title={filters.status === 'BATAL' && isListOpen ? "Klik atau dwi-klik untuk tutup senarai" : "Klik untuk papar senarai Iklan Batal"}
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col justify-between gap-3.5 group cursor-pointer relative overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                    filters.status === 'BATAL' && isListOpen
                      ? 'bg-rose-500/10 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/30 shadow-sm'
                      : 'bg-risda-card border-risda-border hover:border-rose-500/70 hover:bg-rose-500/5 dark:hover:bg-rose-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] shrink-0" />
                      <span className="category-box-title text-xs sm:text-sm font-black uppercase tracking-wider text-risda-text truncate">
                        IKLAN BATAL
                      </span>
                    </div>
                    <span className={`min-w-[44px] h-[40px] px-3.5 rounded-xl flex items-center justify-center text-lg sm:text-xl font-black transition-all shrink-0 ${
                      filters.status === 'BATAL' && isListOpen
                        ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-600/30'
                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 group-hover:bg-rose-500/20'
                    }`}>
                      {batalCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-risda-border/70">
                    <span className={`font-bold transition-colors ${
                      filters.status === 'BATAL' && isListOpen 
                        ? 'text-rose-600 dark:text-rose-400 font-extrabold' 
                        : 'text-risda-muted group-hover:text-risda-text'
                    }`}>
                      {filters.status === 'BATAL' && isListOpen ? '● Sedang Dipapar (Klik 2x Tutup)' : 'Tekan untuk lihat senarai'}
                    </span>
                    {filters.status === 'BATAL' && isListOpen ? (
                      <ChevronUp size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-risda-muted group-hover:text-rose-600 dark:group-hover:text-rose-400 group-hover:translate-y-0.5 transition-all shrink-0" />
                    )}
                  </div>
                </button>

                {/* 4. SEMUA IKLAN */}
                <button
                  type="button"
                  id="kotak-semua-iklan"
                  onClick={() => handleCategoryBoxClick('SEMUA')}
                  onDoubleClick={() => handleCategoryBoxDoubleClick('SEMUA')}
                  title={filters.status === 'SEMUA' && isListOpen ? "Klik atau dwi-klik untuk tutup senarai" : "Klik untuk papar Semua Iklan"}
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col justify-between gap-3.5 group cursor-pointer relative overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                    filters.status === 'SEMUA' && isListOpen
                      ? 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30 shadow-sm'
                      : 'bg-risda-card border-risda-border hover:border-amber-500/70 hover:bg-amber-500/5 dark:hover:bg-amber-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)] shrink-0" />
                      <span className="category-box-title text-xs sm:text-sm font-black uppercase tracking-wider text-risda-text truncate">
                        SEMUA IKLAN
                      </span>
                    </div>
                    <span className={`min-w-[44px] h-[40px] px-3.5 rounded-xl flex items-center justify-center text-lg sm:text-xl font-black transition-all shrink-0 ${
                      filters.status === 'SEMUA' && isListOpen
                        ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-500/30'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 group-hover:bg-amber-500/20'
                    }`}>
                      {totalCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-risda-border/70">
                    <span className={`font-bold transition-colors ${
                      filters.status === 'SEMUA' && isListOpen 
                        ? 'text-amber-500 dark:text-amber-400 font-extrabold' 
                        : 'text-risda-muted group-hover:text-risda-text'
                    }`}>
                      {filters.status === 'SEMUA' && isListOpen ? '● Sedang Dipapar (Klik 2x Tutup)' : 'Tekan untuk lihat senarai'}
                    </span>
                    {filters.status === 'SEMUA' && isListOpen ? (
                      <ChevronUp size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-risda-muted group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-y-0.5 transition-all shrink-0" />
                    )}
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Jika senarai belum ditekan, paparkan panduan mesra pengguna */}
        {!isListOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-risda-card border border-dashed border-risda-border rounded-[24px] sm:rounded-[32px] p-8 sm:p-12 text-center mb-8 shadow-xs"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-risda-orange/10 text-risda-orange mb-3.5">
              <FolderOpen size={24} />
            </div>
            <h3 className="text-sm sm:text-base font-black uppercase text-risda-text tracking-wider">
              {isDecisionPortal ? 'Pilih Kotak Keputusan Di Atas Untuk Memaparkan Senarai' : 'Pilih Kotak Iklan Di Atas Untuk Memaparkan Senarai'}
            </h3>
            <p className="text-xs sm:text-sm text-risda-text-secondary max-w-lg mx-auto mt-1.5 font-medium leading-relaxed">
              {isDecisionPortal
                ? 'Sila tekan mana-mana kotak status di atas (Keputusan Selesai atau Belum Ada Keputusan) untuk memuatkan senarai keputusan sebut harga.'
                : 'Sila tekan mana-mana kotak status di atas (Iklan Aktif, Iklan Selesai, Iklan Batal atau Semua Iklan) untuk memuatkan senarai sebut harga.'}
            </p>
          </motion.div>
        )}

        {/* Unified Master Container (1 Kotak Penuh: Iklan Aktif -> Sebut Harga / Projek) */}
        {isListOpen && (
        <motion.div 
          ref={tableTopRef} 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-risda-card border border-risda-border rounded-[24px] sm:rounded-[32px] shadow-sm mb-8 overflow-hidden"
        >
          {/* Section 2: Filters and Searching Deck */}
          <div className="p-5 sm:p-7 border-b border-risda-border">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end w-full">
              
              {/* Realtime Search Searchbar */}
              <div className={`flex flex-col gap-2 ${isDecisionPortal ? 'md:col-span-8' : 'md:col-span-4'}`}>
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-risda-orange animate-pulse" />
                  <label className="text-xs font-black text-risda-orange uppercase tracking-[2px]">
                    {isDecisionPortal ? 'CARI KEPUTUSAN / KONTRAKTOR / NO SEBUT HARGA' : 'CARI DOKUMEN / PROJEK'}
                  </label>
                </div>
                <div className="relative group flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-risda-muted group-focus-within:text-risda-orange transition-colors pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isDecisionPortal ? "Cari No Sebut Harga, Tajuk atau Nama Kontraktor..." : "Cari No Sebut Harga atau Tajuk..."}
                      className="w-full bg-risda-card-muted border border-risda-border rounded-xl py-3 pl-10 pr-9 text-xs sm:text-sm font-bold text-risda-text focus:border-risda-orange focus:bg-risda-card outline-none transition-all placeholder:text-risda-muted uppercase tracking-wide shadow-xs"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-risda-muted hover:text-risda-text transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  
                  {/* Scan QR Button directly on filter bar */}
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('triggerQRScanner'))}
                    className="p-3 bg-amber-500/15 border border-amber-500/40 hover:border-amber-500 hover:bg-amber-500/25 rounded-xl text-amber-500 transition-all flex items-center justify-center shrink-0 shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
                    title="Imbas Kod QR Iklan (Direct Scan QR)"
                  >
                    <QrCode size={18} />
                  </button>
                </div>
              </div>

              {!isDecisionPortal && (
                <>
                  {/* Negeri Filter */}
                  <div className="flex flex-col gap-2 md:col-span-3">
                    <div className="flex items-center gap-2 px-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-risda-orange" />
                      <label className="text-xs font-black text-risda-orange uppercase tracking-[2px]">Negeri</label>
                    </div>
                    <div className="relative group">
                      <select 
                        value={filters.state}
                        onChange={(e) => {
                          const newState = e.target.value;
                          setFilters({...filters, state: newState, office: ''});
                          const filtered = allLocations
                            .filter(loc => (!newState || loc.state === newState) && loc.status === 'Aktif')
                            .map(loc => loc.name?.trim().toUpperCase())
                            .filter(Boolean)
                            .sort();
                          setOffices(Array.from(new Set(filtered)));
                        }}
                        className="w-full bg-risda-card-muted border border-risda-border rounded-xl py-3 px-3.5 pr-8 text-xs sm:text-sm font-bold text-risda-text focus:border-risda-orange focus:bg-risda-card outline-none transition-all cursor-pointer appearance-none uppercase tracking-wide shadow-xs"
                      >
                        <option value="" className="bg-risda-card text-risda-text">SEMUA NEGERI (MALAYSIA)</option>
                        <option value="SABAH" className="bg-risda-card text-risda-text">SABAH</option>
                        <option value="SARAWAK" className="bg-risda-card text-risda-text">SARAWAK</option>
                        <option value="SELANGOR" className="bg-risda-card text-risda-text">SELANGOR</option>
                        <option value="KUALA LUMPUR" className="bg-risda-card text-risda-text">KUALA LUMPUR</option>
                        <option value="JOHOR" className="bg-risda-card text-risda-text">JOHOR</option>
                        <option value="KEDAH" className="bg-risda-card text-risda-text">KEDAH</option>
                        <option value="KELANTAN" className="bg-risda-card text-risda-text">KELANTAN</option>
                        <option value="MELAKA" className="bg-risda-card text-risda-text">MELAKA</option>
                        <option value="NEGERI SEMBILAN" className="bg-risda-card text-risda-text">NEGERI SEMBILAN</option>
                        <option value="PAHANG" className="bg-risda-card text-risda-text">PAHANG</option>
                        <option value="PERAK" className="bg-risda-card text-risda-text">PERAK</option>
                        <option value="PERLIS" className="bg-risda-card text-risda-text">PERLIS</option>
                        <option value="PULAU PINANG" className="bg-risda-card text-risda-text">PULAU PINANG</option>
                        <option value="TERENGGANU" className="bg-risda-card text-risda-text">TERENGGANU</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-60 group-focus-within:opacity-100 transition-opacity text-risda-muted">
                        <svg width="12" height="8" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </div>
                  </div>

                  {/* Pejabat Filter */}
                  <div className="flex flex-col gap-2 md:col-span-3">
                    <div className="flex items-center gap-2 px-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-risda-orange" />
                      <label className="text-xs font-black text-risda-orange uppercase tracking-[2px]">Pejabat RISDA</label>
                    </div>
                    <div className="relative group">
                      <select 
                        value={filters.office}
                        onChange={(e) => setFilters({...filters, office: e.target.value})}
                        className="w-full bg-risda-card-muted border border-risda-border rounded-xl py-3 px-3.5 pr-8 text-xs sm:text-sm font-bold text-risda-text focus:border-risda-orange focus:bg-risda-card outline-none transition-all cursor-pointer appearance-none uppercase tracking-wide shadow-xs"
                      >
                        <option value="" className="bg-risda-card text-risda-text">SEMUA PEJABAT CAWANGAN</option>
                        {offices.map((office) => (
                          <option key={office} value={office} className="bg-risda-card text-risda-text uppercase">{office}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-60 group-focus-within:opacity-100 transition-opacity text-risda-muted">
                        <svg width="12" height="8" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Year Filter */}
              <div className={`flex flex-col gap-2 ${isDecisionPortal ? 'md:col-span-4' : 'md:col-span-2'}`}>
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-risda-orange" />
                  <label className="text-xs font-black text-risda-orange uppercase tracking-[2px]">Pilih Tahun</label>
                </div>
                <div className="relative group">
                  <select 
                    value={filters.year}
                    onChange={(e) => setFilters({...filters, year: e.target.value})}
                    className="w-full bg-risda-card-muted border border-risda-border rounded-xl py-3 px-3.5 pr-8 text-xs sm:text-sm font-bold text-risda-text focus:border-risda-orange focus:bg-risda-card outline-none transition-all cursor-pointer appearance-none uppercase tracking-wide shadow-xs"
                  >
                    {['ALL', ...years].map(year => (
                      <option key={year} value={year} className="bg-risda-card text-risda-text">
                        {year === 'ALL' ? 'SEMUA TAHUN' : year}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-60 group-focus-within:opacity-100 transition-opacity text-risda-muted">
                    <svg width="12" height="8" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Section 3: Sebut Harga / Projek Content */}
          {/* Desktop View Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black text-risda-muted uppercase tracking-[3px] border-b border-risda-border bg-risda-card-muted/30">
                  <th className="px-6 py-5">Sebut Harga / Projek</th>
                  <th className="px-6 py-5">Negeri / Pejabat</th>
                  <th className="px-6 py-5 text-center whitespace-nowrap min-w-[140px]">Status</th>
                  {(filters.status === 'SELESAI (KEPUTUSAN)' || filters.status === 'SEMUA' || isDecisionPortal) && (
                    <th className="px-6 py-5 text-center">
                      {isDecisionPortal ? 'Keputusan / Pembekal Terpilih' : 'Pembekal Terpilih'}
                    </th>
                  )}
                  <th className="px-6 py-5 text-right">Tarikh Tutup</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-risda-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                     <div className="flex flex-col items-center gap-4">
                       <div className="w-10 h-10 border-t-2 border-risda-orange rounded-full animate-spin" />
                       <span className="text-risda-muted font-black uppercase tracking-[3px] text-[9px]">Menyelaras Data...</span>
                     </div>
                  </td>
                </tr>
              ) : filteredAds.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-risda-muted font-bold uppercase tracking-widest italic opacity-50">
                    Tiada rekod perolehan sepadan dijumpai.
                  </td>
                </tr>
              ) : (
                paginatedAds.map((item, idx) => (
                  <tr 
                    key={idx} 
                    className="group hover:bg-risda-card-muted/70 transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedAd({...item, status: item.displayStatus});
                      setIsRegisterMode(false);
                    }}
                  >
                    <td className="px-6 py-6 border-l-2 border-transparent hover:border-risda-orange transition-all">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-mono text-xs text-risda-orange font-bold tracking-wider">{item.tenderNo}</span>
                        {item.category && (
                          <span className="px-2.5 py-1 text-[11px] font-black text-white bg-risda-gold/90 rounded-md uppercase tracking-wider">
                            {item.category}
                          </span>
                        )}
                        {item.licenses?.cidbSpkk && (
                          <span className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#C26B4D] rounded-md uppercase tracking-wider shadow-sm">
                            CIDB SPKK
                          </span>
                        )}
                        {item.licenses?.cidbPkk && (
                          <span className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#6B7052] rounded-md uppercase tracking-wider shadow-sm">
                            CIDB PKK
                          </span>
                        )}
                        {item.licenses?.stb && (
                          <span className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#7C8262] rounded-md uppercase tracking-wider shadow-sm">
                            STB
                          </span>
                        )}
                        {item.licenses?.mof && (
                          <span className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#9E5D42] rounded-md uppercase tracking-wider shadow-sm">
                            MOF
                          </span>
                        )}
                      </div>
                      <div className="text-sm md:text-base font-bold text-risda-text group-hover:text-risda-orange transition-colors uppercase font-display mb-3 break-words whitespace-normal leading-relaxed">{item.title}</div>
                      {showRegistration && 
                        (item.displayStatus === 'AKTIF') && 
                        !(item.title?.toUpperCase().includes('PROJEK JALAN') && (role === 'pelawat' || !role)) && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = new URL(window.location.href);
                            url.searchParams.set('adId', item.id);
                            window.history.pushState({}, '', url.pathname + url.search);
                            window.dispatchEvent(new Event('popstate'));
                          }}
                          className="bg-risda-orange text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all shadow-sm"
                        >
                          Daftar Online
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-xs font-bold text-risda-text uppercase">{item.state}</div>
                      <div className="text-xs text-risda-muted font-bold uppercase mt-0.5">{item.office}</div>
                    </td>
                    <td className="px-6 py-6 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-xs whitespace-nowrap leading-none ${
                        item.displayStatus === 'SELESAI (KEPUTUSAN)'
                          ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30'
                          : isDecisionPortal
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                          : item.displayStatus === 'AKTIF' 
                          ? 'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30' 
                          : item.displayStatus === 'BATAL'
                          ? 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30'
                          : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30'
                      }`}>
                        {isDecisionPortal
                          ? (item.displayStatus === 'SELESAI (KEPUTUSAN)' ? 'KEPUTUSAN SELESAI' : 'BELUM ADA KEPUTUSAN')
                          : (item.displayStatus === 'SELESAI (KEPUTUSAN)' ? (item.isOldProject ? 'KEPUTUSAN RASMI (TAMAT)' : 'KEPUTUSAN RASMI') : item.displayStatus)}
                      </span>
                    </td>
                    {(filters.status === 'SELESAI (KEPUTUSAN)' || filters.status === 'SEMUA' || isDecisionPortal) && (
                      <td className="px-6 py-6 text-center">
                        {item.displayStatus === 'SELESAI (KEPUTUSAN)' ? (
                          item.winner ? (
                            item.winner.isReTender || item.winner.companyName === 'SEBUTHARGA SEMULA' ? (
                              <div className="flex flex-col items-center">
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-wider mb-1">
                                  <RotateCcw size={12} />
                                  SEBUTHARGA SEMULA
                                </span>
                                <div className="text-xs text-risda-muted font-bold uppercase tracking-wider">Keputusan Rasmi</div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span className="w-2 h-2 inline-block rounded-full bg-blue-500 animate-pulse mb-1" />
                                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase leading-tight">{item.winner.companyName}</div>
                                <div className="text-xs text-risda-muted font-bold uppercase tracking-wider mt-0.5">{item.winner.ownerName || item.winner.representativeName}</div>
                              </div>
                            )
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">Selesai (Keputusan Rasmi)</span>
                            </div>
                          )
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                              <Clock size={12} />
                              Dalam Proses Penilaian
                            </span>
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-6 text-right">
                      <div className="text-xs text-risda-text font-bold tracking-tight">{formatDate(item.closingDate)}</div>
                      <div className="text-xs text-risda-muted font-bold uppercase mt-0.5">{item.closingTime || '12:00 PM'}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Grid/Cards View */}
        <div className="md:hidden space-y-4">
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-t-2 border-risda-orange rounded-full animate-spin" />
              <span className="text-risda-muted font-black uppercase tracking-[3px] text-[9px]">Memuatkan Iklan...</span>
            </div>
          ) : filteredAds.length === 0 ? (
            <div className="py-20 text-center text-risda-muted font-bold uppercase tracking-widest italic opacity-50">
              Tiada rekod sepadan ditemui.
            </div>
          ) : (
            paginatedAds.map((item, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => {
                  setSelectedAd({...item, status: item.displayStatus});
                  setIsRegisterMode(false);
                }}
                className="h-full flex flex-col justify-between bg-risda-card border border-risda-border rounded-3xl p-6 space-y-4 shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:border-risda-orange/40"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-risda-orange font-bold tracking-widest">{item.tenderNo}</span>
                      {item.category && (
                        <span className="px-2 py-0.5 text-[8px] font-black text-white bg-risda-gold/80 rounded uppercase tracking-wider">
                          {item.category}
                        </span>
                      )}
                      {item.licenses?.cidbSpkk && (
                        <span className="px-2 py-0.5 text-[8px] font-bold text-white bg-[#C26B4D] rounded uppercase tracking-wider shadow-sm">
                          CIDB SPKK
                        </span>
                      )}
                      {item.licenses?.cidbPkk && (
                        <span className="px-2 py-0.5 text-[8px] font-bold text-white bg-[#6B7052] rounded uppercase tracking-wider shadow-sm">
                          CIDB PKK
                        </span>
                      )}
                      {item.licenses?.stb && (
                        <span className="px-2 py-0.5 text-[8px] font-bold text-white bg-[#7C8262] rounded uppercase tracking-wider shadow-sm">
                          STB
                        </span>
                      )}
                    </div>
                    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap leading-none shrink-0 ${
                      item.displayStatus === 'SELESAI (KEPUTUSAN)' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30' : 
                      isDecisionPortal ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30' :
                      item.displayStatus === 'AKTIF' ? 'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30' : 
                      'bg-risda-muted/15 text-risda-muted border border-risda-border'
                    }`}>
                      {isDecisionPortal
                        ? (item.displayStatus === 'SELESAI (KEPUTUSAN)' ? 'KEPUTUSAN SELESAI' : 'BELUM ADA KEPUTUSAN')
                        : (item.displayStatus === 'SELESAI (KEPUTUSAN)' ? (item.isOldProject ? 'KEPUTUSAN RASMI (TAMAT)' : 'KEPUTUSAN RASMI') : item.displayStatus)}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-risda-text leading-relaxed uppercase break-words whitespace-normal">{item.title}</h4>
                </div>
                {item.displayStatus === 'SELESAI (KEPUTUSAN)' && item.winner ? (
                  item.winner.isReTender || item.winner.companyName === 'SEBUTHARGA SEMULA' ? (
                    <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <RotateCcw size={16} />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Keputusan Rasmi:</p>
                        <p className="text-[10px] font-black text-amber-800 dark:text-amber-300 uppercase">SEBUTHARGA SEMULA</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                      <p className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Pembekal Terpilih:</p>
                      <p className="text-[10px] font-bold text-risda-text uppercase">{item.winner.companyName}</p>
                      <p className="text-[8px] text-risda-muted uppercase font-semibold">{item.winner.ownerName || item.winner.representativeName}</p>
                    </div>
                  )
                ) : isDecisionPortal && item.displayStatus !== 'SELESAI (KEPUTUSAN)' ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-2.5">
                    <Clock size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <p className="text-[8px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Status Keputusan:</p>
                      <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300">Belum Ada Keputusan (Dalam Penilaian)</p>
                    </div>
                  </div>
                ) : null}
                {showRegistration && 
                  (item.displayStatus === 'AKTIF') && 
                  !(item.title?.toUpperCase().includes('PROJEK JALAN') && (role === 'pelawat' || !role)) && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = new URL(window.location.href);
                      url.searchParams.set('adId', item.id);
                      window.history.pushState({}, '', url.pathname + url.search);
                      window.dispatchEvent(new Event('popstate'));
                    }}
                    className="bg-risda-orange text-white px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider w-full shadow-sm hover:brightness-110 transition-all text-center"
                  >
                    Daftar Online
                  </button>
                )}
                <div className="flex items-center justify-between pt-4 border-t border-risda-border">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-risda-muted font-bold uppercase tracking-[1px]">Cawangan</span>
                    <span className="text-[10px] font-bold text-risda-text uppercase">{item.office}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[8px] text-risda-muted font-bold uppercase tracking-[1px]">Tarikh Tutup</span>
                    <span className="text-xs font-bold text-risda-text">{formatDate(item.closingDate)}</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Pagination Controls */}
        {!loading && filteredAds.length > 0 && (
          <div className="p-4 sm:p-6 border-t border-risda-border bg-risda-card-muted/30">
            <Pagination
              currentPage={safeCurrentPage}
              totalItems={filteredAds.length}
              pageSize={pageSize}
              onPageChange={(page) => {
                setCurrentPage(page);
                tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              pageSizeOptions={[10, 20, 50]}
              itemName="iklan sebut harga"
            />
          </div>
        )}
        </motion.div>
        )}
      
        <div className="mt-8 p-6 bg-gradient-to-r from-risda-orange/5 to-transparent border-l-2 border-risda-orange rounded-r-xl">
           <p className="text-[11px] text-risda-text-secondary leading-relaxed italic uppercase tracking-wider">
             Sistem SMARTLOG PEROLEHAN memastikan ketelusan seratus peratus dalam setiap fasa perolehan. Sila pastikan anda mempunyai dokumen dan lesen sah pendaftaran sebelum menyertai sebut harga.
           </p>
        </div>
      </div>

      {/* Details / Attendance Modal */}
      <AnimatePresence>
        {selectedAd && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAd(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-risda-card border border-risda-border w-full h-full md:max-h-[90vh] md:max-w-5xl rounded-none md:rounded-[40px] overflow-hidden relative z-10 shadow-[0_50px_150px_rgba(0,0,0,1)] flex flex-col"
            >
              <button 
                onClick={() => setSelectedAd(null)}
                className="absolute right-4 top-4 md:right-8 md:top-8 p-3 bg-risda-card-muted hover:bg-risda-border rounded-2xl text-risda-text transition-all z-50 border border-risda-border"
              >
                <X size={20} />
              </button>

              <div className="flex-1 overflow-y-auto">
                {isRegisterMode || (isViewOnlyList && !selectedAd?.id) ? (
                  <div className="bg-risda-card-muted">
                    {!selectedAd.id ? (
                      <div className="p-8 md:p-14 space-y-10">
                        <div className="space-y-3 border-l-4 border-risda-orange pl-6">
                          <h3 className="text-2xl font-black text-risda-text tracking-tight uppercase leading-none">
                            {isRegisterMode ? 'Pilih Rujukan Projek' : 'Senarai Iklan Aktif'}
                          </h3>
                          <p className="text-[11px] text-risda-orange font-black uppercase tracking-[4px]">
                            {isRegisterMode 
                              ? 'Sila pilih projek untuk pendaftaran taklimat tapak' 
                              : (isStaff ? 'Sila pilih projek untuk melihat maklumat & muat turun dokumen sebut harga' : 'Sila pilih projek untuk melihat maklumat sebut harga')}
                          </p>
                        </div>

                        <div className="relative">
                          <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-risda-muted" />
                          <input 
                            type="text"
                            placeholder="Cari No Sebut Harga atau Nama Projek..."
                            className="w-full bg-risda-card border border-risda-border rounded-2xl py-4 pl-14 pr-6 text-sm text-risda-text placeholder:text-risda-muted focus:border-risda-orange outline-none transition-all"
                            onChange={(e) => {
                              const searchVal = e.target.value.toLowerCase();
                              // We use a local state for filtering in the modal
                              setModalSearch(searchVal);
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {ads
                            .filter(a => {
                              const itemDate = a.visitDate || a.closingDate || a.createdAt;
                              const itemYear = itemDate ? new Date(itemDate).getFullYear() : 0;
                              const currentYearInt = new Date().getFullYear();
                              const isOld = itemYear > 0 && itemYear < currentYearInt;
                              const status = isOld ? 'SELESAI (KEPUTUSAN)' : a.status;
                              const isReTender = a.winner?.isReTender || a.winner?.companyName === 'SEBUTHARGA SEMULA' || a.winnerName === 'SEBUTHARGA SEMULA' || a.statusPelaksanaan === 'SEBUTHARGA SEMULA';
                              return status === 'AKTIF' && !isReTender;
                            })
                            .filter(a => a.title.toLowerCase().includes(modalSearch.toLowerCase()) || a.tenderNo.toLowerCase().includes(modalSearch.toLowerCase()))
                            .map((ad) => (
                            <button
                              key={ad.id}
                              onClick={() => setSelectedAd(ad)}
                              className="h-full flex flex-col justify-between w-full text-left p-6 bg-risda-card border border-risda-border hover:border-risda-orange rounded-3xl transition-all group hover:bg-risda-card-muted relative overflow-hidden shadow-sm"
                            >
                              <div className="absolute top-0 right-0 w-32 h-32 bg-risda-orange/5 -mr-16 -mt-16 rounded-full blur-2xl group-hover:bg-risda-orange/10 transition-all" />
                              <div>
                                <div className="font-mono text-[10px] text-risda-orange mb-2 font-bold tracking-widest">{ad.tenderNo}</div>
                                <div className="text-[13px] font-bold text-risda-text uppercase group-hover:text-risda-orange transition-colors leading-relaxed break-words whitespace-normal">{ad.title}</div>
                              </div>
                              <div className="mt-4 flex items-center justify-between pt-3 border-t border-risda-border/60">
                                <span className="text-[9px] text-risda-muted font-bold uppercase tracking-widest">{ad.office}</span>
                                <span className="text-[9px] text-risda-gold font-bold uppercase tracking-widest">{formatDate(ad.closingDate)}</span>
                              </div>
                            </button>
                          ))}
                          {ads
                            .filter(a => {
                              const itemDate = a.visitDate || a.closingDate || a.createdAt;
                              const itemYear = itemDate ? new Date(itemDate).getFullYear() : 0;
                              const currentYearInt = new Date().getFullYear();
                              const isOld = itemYear > 0 && itemYear < currentYearInt;
                              const status = isOld ? 'SELESAI (KEPUTUSAN)' : a.status;
                              const isReTender = a.winner?.isReTender || a.winner?.companyName === 'SEBUTHARGA SEMULA' || a.winnerName === 'SEBUTHARGA SEMULA' || a.statusPelaksanaan === 'SEBUTHARGA SEMULA';
                              return status === 'AKTIF' && !isReTender;
                            })
                            .filter(a => a.title.toLowerCase().includes(modalSearch.toLowerCase()) || a.tenderNo.toLowerCase().includes(modalSearch.toLowerCase())).length === 0 && (
                            <div className="col-span-full text-center py-20 text-risda-muted font-bold uppercase tracking-widest bg-risda-card rounded-3xl border border-dashed border-risda-border">
                              <AlertCircle size={32} className="mx-auto mb-4 opacity-20" />
                              Tiada iklan yang sepadan dijumpai.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <AttendanceForm 
                        adId={selectedAd.id} 
                        adTitle={selectedAd.title} 
                        tenderNo={selectedAd.tenderNo}
                        office={selectedAd.office || ''}
                        licenseRequirements={selectedAd.licenseRequirements}
                        licenses={selectedAd.licenses}
                        onSuccess={() => setSelectedAd(null)} 
                      />
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 min-h-full divide-y lg:divide-y-0 lg:divide-x divide-risda-border">
                    {/* Information - Column 1 & 2 on Large Screens */}
                    <div className="p-8 md:p-14 space-y-10 lg:col-span-2">
                      
                      {/* High Fidelity Metadata Tracker line matching user's image exactly */}
                      <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-black tracking-[4px] text-risda-muted uppercase mb-1">
                        <span className="font-mono text-risda-orange font-black">{selectedAd.tenderNo}</span>
                        <span className="w-1.5 h-1.5 bg-risda-border rounded-full" />
                        <span>{selectedAd.category || 'KERJA'}</span>
                        <span className="w-1.5 h-1.5 bg-risda-border rounded-full" />
                        <span>{selectedAd.state || 'MALAYSIA'}</span>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                              (effectiveContext === 'keputusan' || (effectiveContext === 'dashboard' && dashboardModalView === 'keputusan')) ? 'bg-blue-600 text-white' : 'bg-risda-orange text-white'
                            }`}>
                              <FileText size={24} className="text-white" />
                            </div>
                            <div className="flex flex-col">
                              <div className={`text-xs font-black uppercase tracking-[2px] ${
                                (effectiveContext === 'keputusan' || (effectiveContext === 'dashboard' && dashboardModalView === 'keputusan')) ? 'text-blue-600 dark:text-blue-400' : 'text-risda-orange'
                              }`}>
                                {effectiveContext === 'keputusan'
                                  ? 'Keputusan Rasmi Perolehan'
                                  : effectiveContext === 'projek'
                                    ? 'Maklumat Iklan Sebut Harga'
                                    : dashboardModalView === 'keputusan'
                                      ? 'Keputusan Rasmi Perolehan (Pusat Dashboard)'
                                      : 'Maklumat Iklan Sebut Harga (Pusat Dashboard)'}
                              </div>
                            </div>
                          </div>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-risda-text leading-tight tracking-tight uppercase">{selectedAd.title}</h2>
                      </div>

                      {/* Beautiful Unified Download Bar with Contextual Buttons - KHAS UNTUK KAKITANGAN SAHAJA */}
                      {isStaff && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-risda-card-muted p-5 sm:p-6 rounded-3xl border border-risda-border shadow-sm text-left">
                          <div className="flex items-center gap-4 w-full sm:w-auto">
                            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-md shrink-0">
                              <Download size={20} className="stroke-[3]" />
                            </div>
                            <div className="text-left">
                              <p className="text-xs sm:text-sm font-black text-risda-text uppercase tracking-widest leading-none mb-1.5">
                                {effectiveContext === 'dashboard' 
                                  ? 'MUAT TURUN DOKUMEN (IKLAN & KEPUTUSAN)' 
                                  : effectiveContext === 'keputusan' 
                                    ? 'MUAT TURUN KEPUTUSAN RASMI' 
                                    : 'MUAT TURUN IKLAN SEBUT HARGA'}
                              </p>
                              <p className="text-[10px] text-risda-muted font-medium tracking-wide">
                                {effectiveContext === 'dashboard'
                                  ? 'Sila pilih PDF Iklan Sebut Harga atau PDF Keputusan Rasmi.'
                                  : 'Pilih format untuk simpanan rasmi atau perkongsian.'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2.5 w-full sm:w-auto self-stretch sm:self-auto justify-end">
                            {effectiveContext === 'dashboard' ? (
                              <>
                                {/* DUA PDF BUTTONS FOR PUSAT DASHBOARD */}
                                <button 
                                  onClick={async () => {
                                    const t = toast.loading('Menjana PDF Iklan...');
                                    try {
                                      await exportToPDF(selectedAd);
                                      toast.success('PDF Iklan berjaya dijana', { id: t });
                                    } catch (err) {
                                      toast.error('Gagal menjana PDF Iklan', { id: t });
                                    }
                                  }}
                                  className="flex-1 sm:flex-initial px-5 py-3.5 bg-risda-orange hover:brightness-110 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                  <Download size={14} className="stroke-[3]" /> PDF IKLAN
                                </button>
                                <button 
                                  onClick={async () => {
                                    const t = toast.loading('Menjana PDF Keputusan...');
                                    try {
                                      await exportResultToPDF({
                                        tenderNo: selectedAd.tenderNo,
                                        title: selectedAd.title,
                                        office: selectedAd.office || 'MALAYSIA',
                                        winnerName: selectedAd.winnerName || selectedAd.winner?.companyName || (selectedAd.status === 'SELESAI (KEPUTUSAN)' ? 'TIADA' : 'DALAM PROSES PENILAIAN'),
                                        startDate: selectedAd.winner?.contractStartDate || selectedAd.contractStartDate || '-',
                                        endDate: selectedAd.winner?.contractEndDate || selectedAd.contractEndDate || '-',
                                        location: selectedAd.winner?.location || selectedAd.location || selectedAd.visitVenue || selectedAd.docVenue || '-'
                                      });
                                      toast.success('PDF Keputusan berjaya dijana', { id: t });
                                    } catch (err) {
                                      toast.error('Gagal menjana PDF Keputusan', { id: t });
                                    }
                                  }}
                                  className="flex-1 sm:flex-initial px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                  <Download size={14} className="stroke-[3]" /> PDF KEPUTUSAN
                                </button>
                              </>
                            ) : effectiveContext === 'keputusan' ? (
                              <>
                                {/* KEPUTUSAN RASMI PORTAL: PDF KEPUTUSAN SAHAJA */}
                                <button 
                                  onClick={async () => {
                                    const t = toast.loading('Menjana PDF Keputusan...');
                                    try {
                                      await exportResultToPDF({
                                        tenderNo: selectedAd.tenderNo,
                                        title: selectedAd.title,
                                        office: selectedAd.office || 'MALAYSIA',
                                        winnerName: selectedAd.winnerName || selectedAd.winner?.companyName || (selectedAd.status === 'SELESAI (KEPUTUSAN)' ? 'TIADA' : 'DALAM PROSES PENILAIAN'),
                                        startDate: selectedAd.winner?.contractStartDate || selectedAd.contractStartDate || '-',
                                        endDate: selectedAd.winner?.contractEndDate || selectedAd.contractEndDate || '-',
                                        location: selectedAd.winner?.location || selectedAd.location || selectedAd.visitVenue || selectedAd.docVenue || '-'
                                      });
                                      toast.success('PDF Keputusan berjaya dijana', { id: t });
                                    } catch (err) {
                                      toast.error('Gagal menjana PDF Keputusan', { id: t });
                                    }
                                  }}
                                  className="flex-1 sm:flex-initial px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                  <Download size={14} className="stroke-[3]" /> PDF KEPUTUSAN
                                </button>
                                <button 
                                  onClick={async () => {
                                    try {
                                      await exportResultToWord({
                                        tenderNo: selectedAd.tenderNo,
                                        title: selectedAd.title,
                                        office: selectedAd.office || 'MALAYSIA',
                                        winnerName: selectedAd.winnerName || selectedAd.winner?.companyName || (selectedAd.status === 'SELESAI (KEPUTUSAN)' ? 'TIADA' : 'DALAM PROSES PENILAIAN'),
                                        startDate: selectedAd.winner?.contractStartDate || selectedAd.contractStartDate || '-',
                                        endDate: selectedAd.winner?.contractEndDate || selectedAd.contractEndDate || '-',
                                        location: selectedAd.winner?.location || selectedAd.location || selectedAd.visitVenue || selectedAd.docVenue || '-'
                                      });
                                    } catch (err) {
                                      console.error(err);
                                      toast.error('Gagal menjana Word file');
                                    }
                                  }}
                                  className="flex-1 sm:flex-initial px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                  <FileText size={14} className="stroke-[3]" /> WORD
                                </button>
                              </>
                            ) : (
                              <>
                                {/* IKLAN SEBUTHARGA PORTAL: PDF IKLAN SAHAJA */}
                                <button 
                                  onClick={async () => {
                                    const t = toast.loading('Menjana PDF Iklan...');
                                    try {
                                      await exportToPDF(selectedAd);
                                      toast.success('PDF Iklan berjaya dijana', { id: t });
                                    } catch (err) {
                                      toast.error('Gagal menjana PDF Iklan', { id: t });
                                    }
                                  }}
                                  className="flex-1 sm:flex-initial px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                  <Download size={14} className="stroke-[3]" /> PDF IKLAN
                                </button>
                                <button 
                                  onClick={async () => {
                                    try {
                                      await exportToWord(selectedAd);
                                    } catch (err) {
                                      console.error(err);
                                      toast.error('Gagal menjana Word file');
                                    }
                                  }}
                                  className="flex-1 sm:flex-initial px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                  <FileText size={14} className="stroke-[3]" /> WORD
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* View Selector for Dashboard or Active Ads */}
                      {effectiveContext === 'dashboard' ? (
                        <div className="flex justify-start border-b border-risda-border pb-2">
                          <div className="flex bg-risda-card-muted p-1 rounded-2xl border border-risda-border gap-1">
                            <button 
                              onClick={() => setDashboardModalView('iklan')} 
                              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                                dashboardModalView === 'iklan' ? 'bg-risda-orange text-white shadow-sm font-bold' : 'text-risda-muted hover:text-risda-text'
                              }`}
                            >
                              📄 Papar Iklan Sebut Harga
                            </button>
                            <button 
                              onClick={() => setDashboardModalView('keputusan')} 
                              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                                dashboardModalView === 'keputusan' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-risda-muted hover:text-risda-text'
                              }`}
                            >
                              🏆 Papar Keputusan Rasmi
                            </button>
                          </div>
                        </div>
                      ) : effectiveContext === 'projek' ? (
                        <div className="flex justify-start border-b border-risda-border pb-2">
                          <div className="flex bg-risda-card-muted p-1 rounded-2xl border border-risda-border gap-1">
                            <button 
                              onClick={() => setAdViewFormat('preview')} 
                              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                                adViewFormat === 'preview' ? 'bg-risda-orange text-white shadow-sm font-bold' : 'text-risda-muted hover:text-risda-text'
                              }`}
                            >
                              Papar Format PDF Iklan
                            </button>
                            <button 
                              onClick={() => setAdViewFormat('data')} 
                              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                                adViewFormat === 'data' ? 'bg-risda-orange text-white shadow-sm font-bold' : 'text-risda-muted hover:text-risda-text'
                              }`}
                            >
                              Papar Maklumat Terperinci
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {/* Display Contents depending on context & active view selection */}
                      {(effectiveContext === 'projek' || (effectiveContext === 'dashboard' && dashboardModalView === 'iklan')) ? (
                        /* Active Ad Display */
                        adViewFormat === 'preview' ? (
                          /* High Fidelity KENYATAAN SEBUT HARGA A4 PDF View */
                          <div className="relative mx-auto w-full max-w-2xl px-1 sm:px-0 bg-risda-card-muted rounded-2xl p-2 sm:p-4 border border-risda-border shadow-inner">
                            <div className="bg-white p-4 sm:p-8 md:p-12 border-[6px] border-double border-[#003399] tracking-tight relative text-black font-sans w-full max-w-full overflow-hidden shadow-xl rounded-sm">
                              {/* Watermark Logo */}
                              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                                <img src="/PUBLIC/intrologo_RISDA.png" alt="watermark" className="w-[85%] max-w-[360px] object-contain select-none" />
                              </div>

                              {/* Header Info */}
                              <div className="flex justify-between items-start mb-6 border-b-2 border-[#003399]/10 pb-4">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0">
                                  <img 
                                    src="/PUBLIC/intrologo_RISDA.png" 
                                    alt="RISDA" 
                                    className="h-full object-contain"
                                    onError={(e) => { 
                                      const img = e.currentTarget;
                                      if (!img.src.includes("/api/logo") && !img.src.endsWith("/api/logo")) {
                                        img.src = "/api/logo";
                                      } else if (!img.src.includes("Logo_RISDA.png") && !img.src.includes("logo_risda.png")) {
                                        img.src = "https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png";
                                      }
                                    }} 
                                  />
                                </div>
                                <div className="text-right">
                                  <div className="text-[9px] font-black uppercase text-slate-800 tracking-wider">URUSETIA PEROLEHAN PRD</div>
                                  <div className="text-[8px] font-black uppercase text-slate-500">{selectedAd.office || '-'}</div>
                                </div>
                              </div>

                              {/* Document Title */}
                              <div className="text-center space-y-2 mb-6 relative z-10">
                                <h2 className="text-base sm:text-xl font-black text-[#003060] tracking-tight">KENYATAAN SEBUT HARGA</h2>
                                <div className="text-lg sm:text-2xl font-black text-black tracking-tight">{selectedAd.tenderNo}</div>
                              </div>

                              {/* Project Title Yellow Box */}
                              <div className="bg-yellow-300 border-2 border-slate-950 p-4 text-center font-black uppercase text-[10px] sm:text-xs tracking-tight mb-5 leading-tight select-none shadow-sm text-black">
                                {selectedAd.title}
                              </div>

                              {/* Introduction */}
                              <div className="text-[9px] sm:text-[11px] text-slate-800 mb-5 font-semibold leading-relaxed text-left">
                                <p>1. Sebutharga adalah dipelawa daripada kontraktor tempatan bagi menawarkan kerja seperti tajuk di atas dan syarat-syarat berikut:</p>
                              </div>

                              {/* High Fidelity Table Grid to match PDF's autotable exactly */}
                              <div className="border border-slate-300 overflow-hidden rounded-md mb-5 text-[9px] sm:text-[10px] leading-snug text-left">
                                <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-100 font-bold border-b border-slate-300 text-center divide-y md:divide-y-0 md:divide-x divide-slate-300">
                                  <div className="p-2.5 text-slate-900 uppercase font-black text-[8px] sm:text-[9px] tracking-wider">Kelayakan Kompetensi Mandatori</div>
                                  <div className="p-2.5 text-slate-900 uppercase font-black text-[8px] sm:text-[9px] tracking-wider">Taklimat & Lawatan Tapak</div>
                                  <div className="p-2.5 text-slate-900 uppercase font-black text-[8px] sm:text-[9px] tracking-wider">Tempoh & Tempat Dokumen</div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-300 bg-white">
                                  {/* Licenses Col */}
                                  <div className="p-3.5 space-y-2 font-bold text-slate-800">
                                    <div className="text-[10px] text-risda-orange font-black">RISDA</div>
                                    {selectedAd.licenses?.cidbSpkk && <div className="text-[9px]">• {selectedAd.licenseDescriptions?.cidbSpkk || 'CIDB (SPKK) G1 CE01'}</div>}
                                    {selectedAd.licenses?.cidbPkk && <div className="text-[9px]">• {selectedAd.licenseDescriptions?.cidbPkk || 'CIDB (PKK) G1'}</div>}
                                    {selectedAd.licenses?.stb && <div className="text-[9px]">• {selectedAd.licenseDescriptions?.stb || 'Sijil Taraf Bumiputera'}</div>}
                                    {selectedAd.licenses?.mof && <div className="text-[9px]">• {formatMofText(selectedAd.licenseDescriptions?.mof)}</div>}
                                    {selectedAd.licenses?.pukonsa && <div className="text-[9px]">• {selectedAd.licenseDescriptions?.pukonsa || 'PUKONSA'}</div>}
                                    {selectedAd.licenses?.kuhean && <div className="text-[9px]">• {selectedAd.licenseDescriptions?.kuhean || 'KUHEAN'}</div>}
                                    {selectedAd.licenses?.others && <div className="text-[9px]">• {selectedAd.licenses.others}</div>}
                                    {selectedAd.licenses?.tcc && <div className="text-slate-800 font-black text-[8px] text-green-700 mt-1">• STATUS TCC: PATUH</div>}
                                  </div>
                                  {/* Briefing/Site Visit Col */}
                                  <div className="p-3.5 space-y-2 bg-slate-50/50">
                                    <div className="space-y-0.5">
                                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">WAKTU</span>
                                      <span className="text-slate-950 font-black text-[10px]">{selectedAd.briefingTime || '10.00 Pagi'}</span>
                                    </div>
                                    <div className="border-t border-slate-200/80 pt-1.5 space-y-0.5">
                                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">TARIKH</span>
                                      <span className="text-slate-950 font-black text-[10px]">{formatDate(selectedAd.briefingDate)}</span>
                                    </div>
                                    <div className="border-t border-slate-200/80 pt-1.5 space-y-0.5">
                                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">TEMPAT</span>
                                      <span className="text-slate-950 font-black text-[9px] leading-tight block uppercase">{selectedAd.briefingVenue || selectedAd.office}</span>
                                    </div>
                                  </div>
                                  {/* Procuring/Doc Selling Col */}
                                  <div className="p-3.5 space-y-2">
                                    <div className="space-y-0.5">
                                      <span className="text-[8px] text-slate-400 font-bold tracking-wider block">TEMPOH PEMBELIAN</span>
                                      <span className="text-slate-950 font-black text-[10px]">{formatDate(selectedAd.docStartDate)} SEHINGGA {formatDate(selectedAd.docEndDate)}</span>
                                    </div>
                                    <div className="border-t border-slate-200/80 pt-1.5 space-y-0.5">
                                      <span className="text-[8px] text-slate-400 font-bold tracking-wider block">KAUNTER / TEMPAT</span>
                                      <span className="text-slate-950 font-black text-[9px] leading-relaxed block uppercase">{selectedAd.docVenue || selectedAd.office}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Section 2 Terms */}
                              <div className="text-[8px] sm:text-[10px] space-y-2 text-slate-800 leading-normal relative z-10 font-bold text-left">
                                <p>2. Dokumen Sebut Harga hanya diberikan kepada kontraktor yang memenuhi syarat-syarat berikut:</p>
                                <div className="pl-3.5 space-y-1">
                                  <p className="flex gap-1.5">
                                    <span className="text-slate-950">a.</span> 
                                    <span>Hanya Penama di dalam Sijil Asal {getLicenseNamesForTerms(selectedAd)} yang masih SAH tempoh pendaftaran sahaja yang boleh hadir mendengar taklimat tapak dan tidak boleh mewakilkan pegawai selain penama;</span>
                                  </p>
                                  <p className="flex gap-1.5">
                                    <span className="text-slate-950">b.</span> 
                                    <span>Hadir taklimat tapak dan membawa SLIP KEHADIRAN ASAL taklimat tapak.</span>
                                  </p>
                                  <p className="flex gap-1.5">
                                    <span className="text-slate-950">c.</span> 
                                    <span>Membawa Sijil Asal {getLicenseNamesForTerms(selectedAd)} yang sah tempoh lakunya berserta SATU salinan fotostat.</span>
                                  </p>
                                  <p className="flex gap-1.5">
                                    <span className="text-slate-950">d.</span> 
                                    <span>Mengimbas QR Code untuk pengesahan pendaftaran kehadiran selewatnya satu hari sebelum taklimat tapak dijalankan.</span>
                                  </p>
                                  <p className="flex gap-1.5">
                                    <span className="text-slate-950">e.</span> 
                                    <span>Sijil Kelayakan Cukai (TCC) mestilah berstatus "PATUH" untuk urusan perolehan.</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Structured Data View (Classic Layout) */
                          <div className="space-y-8">
                            {selectedAd.licenseRequirements && (
                              <div className="bg-risda-orange/5 border border-risda-orange/20 p-6 rounded-3xl space-y-2 text-left">
                                 <h4 className="text-[10px] font-black text-risda-orange uppercase tracking-[4px]">Keperluan Lesen Pelantikan</h4>
                                 <p className="text-xs text-risda-text font-medium leading-relaxed uppercase">{selectedAd.licenseRequirements}</p>
                              </div>
                            )}

                            {selectedAd.licenses && (
                              <div className="space-y-4 text-left">
                                <h4 className="text-[10px] font-black text-risda-gold uppercase tracking-[4px]">Sijil & Lesen Berdaftar</h4>
                                <div className="flex flex-wrap gap-2">
                                  {selectedAd.licenses.cidbSpkk && <span className="px-3 py-1.5 bg-[#C26B4D] text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">CIDB (SPKK)</span>}
                                  {selectedAd.licenses.cidbPkk && <span className="px-3 py-1.5 bg-[#6B7052] text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">CIDB (PKK)</span>}
                                  {selectedAd.licenses.stb && <span className="px-3 py-1.5 bg-[#7C8262] text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">STB</span>}
                                  {selectedAd.licenses.mof && <span className="px-3 py-1.5 bg-[#9E5D42] text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">MOF</span>}
                                  {selectedAd.licenses.tcc && <span className="px-3 py-1.5 bg-[#556B2F] text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">TCC</span>}
                                  {selectedAd.licenses.pukonsa && <span className="px-3 py-1.5 bg-[#8C7B65] text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">PUKONSA</span>}
                                  {selectedAd.licenses.kuhean && <span className="px-3 py-1.5 bg-[#8C7B65] text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">KUHEAN</span>}
                                  {selectedAd.licenses.others && (
                                    <span className="px-3 py-1.5 bg-risda-card-muted border border-risda-border text-risda-text rounded-lg text-[9px] font-black uppercase tracking-widest">
                                      {selectedAd.licenses.others}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                              <div className="space-y-2 bg-risda-card-muted p-6 rounded-3xl border border-risda-border">
                                <p className="text-[9px] font-black text-risda-muted uppercase tracking-[3px]">Status Perolehan</p>
                                <span className={`px-3 py-1 rounded text-[10px] font-black uppercase ${
                                  selectedAd.status === 'AKTIF' ? 'text-green-600 dark:text-green-400' : 
                                  selectedAd.status === 'BATAL' ? 'text-red-600 dark:text-red-400' : 
                                  'text-blue-600 dark:text-blue-400'
                                }`}>
                                  {selectedAd.status}
                                </span>
                              </div>
                              <div className="space-y-2 bg-risda-card-muted p-6 rounded-3xl border border-risda-border">
                                <p className="text-[9px] font-black text-risda-muted uppercase tracking-[3px]">Tarikh Tutup Penyerahan</p>
                                <p className="text-lg font-black text-red-600 dark:text-red-400 tracking-tight">{formatDate(selectedAd.closingDate)}</p>
                                <p className="text-[10px] font-bold text-risda-muted uppercase tracking-widest">{selectedAd.closingTime || '12:00 PM'}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                              <div className="space-y-4 bg-risda-card-muted p-6 rounded-3xl border border-risda-border">
                                <h4 className="text-[10px] font-black text-risda-orange uppercase tracking-[4px]">Lawatan Tapak</h4>
                                <div className="space-y-1">
                                  <p className="text-risda-text font-bold text-sm">{formatDate(selectedAd.visitDate)}</p>
                                  <p className="text-risda-muted text-[10px] uppercase font-bold">{selectedAd.visitVenue || '-'}</p>
                                </div>
                              </div>
                              <div className="space-y-4 bg-risda-card-muted p-6 rounded-3xl border border-risda-border">
                                <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[4px]">Taklimat Tapak</h4>
                                <div className="space-y-1">
                                  <p className="text-risda-text font-bold text-sm">{formatDate(selectedAd.briefingDate)}</p>
                                  <p className="text-risda-muted text-[10px] uppercase font-bold">{selectedAd.briefingVenue || '-'}</p>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-6 text-left">
                              <h4 className="text-[10px] font-black text-risda-gold uppercase tracking-[4px]">Pemerolehan Dokumen</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-risda-card-muted p-8 rounded-3xl border border-risda-border">
                                <div>
                                  <p className="text-risda-muted text-[9px] uppercase font-bold mb-1">Tarikh Mula</p>
                                  <p className="text-risda-text font-bold text-base">{formatDate(selectedAd.docStartDate)}</p>
                                </div>
                                <div>
                                  <p className="text-risda-muted text-[9px] uppercase font-bold mb-1">Tarikh Akhir</p>
                                  <p className="text-risda-text font-bold text-base">{formatDate(selectedAd.docEndDate)}</p>
                                </div>
                                <div className="md:col-span-2 pt-4 border-t border-risda-border text-left">
                                  <p className="text-risda-muted text-[9px] uppercase font-bold mb-2">Tempat / Kaunter</p>
                                  <p className="text-risda-text font-black text-sm uppercase leading-relaxed">{selectedAd.docVenue || '-'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      ) : (
                        /* Completed Ad (Keputusan/Hebahan) Display - Always Portrait White Sheet style! */
                        <div className="space-y-8">
                          <div className="relative mx-auto w-full max-w-2xl px-1 sm:px-0 bg-risda-card-muted rounded-2xl p-2 sm:p-4 border border-risda-border shadow-inner">
                            <div className="bg-white p-4 sm:p-6 md:p-14 border-[6px] border-double border-slate-900 rounded-none shadow-xl text-black font-sans w-full overflow-hidden">
                                <div className="text-[7px] md:text-[10px] font-black text-right mb-4 md:mb-12 uppercase tracking-tighter opacity-80">URUSETIA PEROLEHAN PRD {selectedAd.office?.toUpperCase()}</div>
                                
                                <div className="flex flex-col items-center mb-6 md:mb-12">
                                  <div className="w-12 h-12 md:w-24 md:h-24 mb-4 md:mb-6 flex items-center justify-center">
                                    <img 
                                      src="/PUBLIC/intrologo_RISDA.png" 
                                      alt="RISDA" 
                                      className="h-full object-contain" 
                                      onError={(e) => { 
                                        const img = e.currentTarget;
                                        if (!img.src.includes("/api/logo") && !img.src.endsWith("/api/logo")) {
                                          img.src = "/api/logo";
                                        } else if (!img.src.includes("Logo_RISDA.png") && !img.src.includes("logo_risda.png")) {
                                          img.src = "https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png";
                                        }
                                      }} 
                                    />
                                  </div>
                                  <h1 className="text-xl sm:text-2xl md:text-5xl font-black border-b-4 border-black pb-1 mb-4 md:mb-8 tracking-tight text-center">HEBAHAN</h1>
                                  <div className="text-center font-black text-[10px] sm:text-sm md:text-lg tracking-tight mb-4 md:mb-8 px-2">
                                    <span className="border-b-[1px] md:border-b-2 border-black pb-0.5 inline-block uppercase font-black">
                                      {selectedAd.winner?.isReTender || selectedAd.winner?.companyName === 'SEBUTHARGA SEMULA' 
                                        ? 'KEPUTUSAN RASMI SEBUTHARGA SEMULA' 
                                        : 'PEMBIDA YANG BERJAYA BAGI SEBUTHARGA'}
                                    </span><br />
                                    <span className="border-b-[1px] md:border-b-2 border-black pb-0.5 inline-block uppercase font-black mt-1 text-center">PEJABAT RISDA DAERAH {selectedAd.office?.toUpperCase()}</span>
                                  </div>
                                </div>

                                <div className="border-[2px] md:border-[3px] border-black p-4 md:p-12 space-y-4 md:space-y-8 bg-white overflow-hidden text-left">
                                  <div className="grid grid-cols-[80px_10px_1fr] sm:grid-cols-[160px_20px_1fr] gap-y-3 md:gap-y-6 text-[9px] sm:text-base md:text-lg">
                                    <div className="font-black uppercase">NO SEBUTHARGA</div>
                                    <div className="font-black text-center">:</div>
                                    <div className="font-bold break-all text-blue-700">{selectedAd.tenderNo}</div>
                                    
                                    <div className="font-black uppercase">TAJUK SEBUTHARGA</div>
                                    <div className="font-black text-center">:</div>
                                    <div className="uppercase font-black leading-tight text-[10px] sm:text-base md:text-lg">{selectedAd.title}</div>

                                    <div className="font-black uppercase">KONTRAKTOR / KEPUTUSAN</div>
                                    <div className="font-black text-center">:</div>
                                    <div className={`uppercase font-black ${
                                      selectedAd.winner?.isReTender || selectedAd.winner?.companyName === 'SEBUTHARGA SEMULA' 
                                        ? 'text-amber-600 font-extrabold' 
                                        : 'text-green-700'
                                    }`}>
                                      {selectedAd.winner?.isReTender || selectedAd.winner?.companyName === 'SEBUTHARGA SEMULA' 
                                        ? 'SEBUTHARGA SEMULA (TIADA PEMBEKAL TERPILIH)' 
                                        : selectedAd.winner?.companyName || '-'}
                                    </div>

                                    <div className="font-black uppercase">TEMPOH KERJA</div>
                                    <div className="font-black text-center">:</div>
                                    <div className="uppercase font-black text-[8px] sm:text-base">
                                      {selectedAd.winner?.isReTender || selectedAd.winner?.companyName === 'SEBUTHARGA SEMULA' 
                                        ? 'SEBUTHARGA SEMULA' 
                                        : `${formatDate(selectedAd.winner?.contractStartDate || selectedAd.contractStartDate)} SEHINGGA ${formatDate(selectedAd.winner?.contractEndDate || selectedAd.contractEndDate)}${calculateTempohSiapKerja(selectedAd.winner?.contractStartDate || selectedAd.contractStartDate, selectedAd.winner?.contractEndDate || selectedAd.contractEndDate) ? ` (${calculateTempohSiapKerja(selectedAd.winner?.contractStartDate || selectedAd.contractStartDate, selectedAd.winner?.contractEndDate || selectedAd.contractEndDate)})` : ''}`}
                                    </div>

                                    <div className="font-black uppercase">TEMPAT</div>
                                    <div className="font-black text-center">:</div>
                                    <div className="uppercase font-black">{selectedAd.winner?.location || selectedAd.location || selectedAd.visitVenue || selectedAd.docVenue || '-'}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                        </div>
                      )}

                      {/* Decorum Logs system footer in active layout */}
                      {selectedAd.status !== 'SELESAI (KEPUTUSAN)' && (
                        <div className="pt-10 border-t border-risda-border flex flex-wrap gap-4 text-left">
                           <div className="bg-risda-card-muted px-6 py-4 rounded-xl border border-risda-border flex items-center gap-4 flex-1 min-w-[200px]">
                              <Shield size={20} className="text-risda-orange" />
                              <div>
                                 <p className="text-xs font-black text-risda-text uppercase tracking-widest font-poppins">SMART LOG PEROLEHAN</p>
                                 <p className="text-[10px] text-risda-muted leading-relaxed">Pendaftaran digital yang selamat, telus dan sah di bawah urusetia RISDA.</p>
                              </div>
                           </div>
                        </div>
                      )}
                    </div>

                    {/* Column 3 - QR Code & Dismissible Banner (Only for active or cancelled/briefing ads) */}
                    {(selectedAd.status !== 'SELESAI (KEPUTUSAN)' || (isStaff && !showRegistration && initialStatus !== 'SELESAI (KEPUTUSAN)')) ? (
                      <div className="p-8 md:p-14 bg-risda-card-muted/50 flex flex-col justify-between items-center text-center space-y-8 border-t lg:border-t-0 border-risda-border lg:col-span-1">
                        <div className="w-full space-y-6">
                          <div className="border-b border-risda-border pb-4 text-center">
                            <h4 className="text-sm font-bold text-risda-text uppercase tracking-widest leading-none">PENDAFTARAN SEGERA</h4>
                            <p className="text-[10px] text-risda-orange uppercase tracking-[3px] mt-1.5 font-bold">Imbas QR Kod</p>
                          </div>
                          
                          <div className="relative mx-auto max-w-[220px] aspect-square bg-white p-4 rounded-3xl border border-risda-border shadow-md group overflow-hidden flex items-center justify-center">
                            <div className="absolute inset-0 bg-gradient-to-t from-risda-orange/10 via-transparent to-transparent opacity-80 group-hover:scale-110 transition-transform duration-500" />
                            <img 
                              src={qrCodeUrl || `/api/qr-code.png?adId=${selectedAd.id}&origin=${encodeURIComponent(window.location.origin)}`} 
                              alt="Kod QR Pendaftaran" 
                              className="relative z-10 w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>

                          <div className="space-y-3 bg-risda-card-muted p-5 rounded-2xl border border-risda-border text-left">
                            <p className="text-[11px] text-risda-text font-bold leading-relaxed uppercase">
                              Kontraktor diminta untuk mengimbas QR Code ini untuk pendaftaran taklimat tapak digital secara terus menggunakan telefon pintar.
                            </p>
                            <div className="h-px bg-risda-border" />
                            <p className="text-[10px] text-risda-muted leading-relaxed uppercase">
                              Mohon untuk mengimbas kod QR yang ada pada iklan bagi tujuan pendaftaran secara digital dari iklan dikeluarkan atau sehari sebelum hari taklimat tapak.
                            </p>
                          </div>
                        </div>

                        <div className="w-full pt-6 border-t border-risda-border text-center">
                          <p className="text-[9px] text-risda-muted tracking-[2px] font-bold uppercase">SMART LOG SYSTEM</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 md:p-14 bg-risda-card-muted/50 flex flex-col justify-between items-center text-center space-y-8 border-t lg:border-t-0 border-risda-border lg:col-span-1">
                        <div className="w-full space-y-6">
                          <div className="border-b border-risda-border pb-4 text-center">
                            <h4 className="text-sm font-bold text-risda-text uppercase tracking-widest leading-none">MAKLUMAT KEPUTUSAN</h4>
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-[3px] mt-1.5 font-bold">RASMI PEROLEHAN</p>
                          </div>
                          
                          <div className="space-y-4 text-left">
                            <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-300 uppercase font-medium leading-relaxed">
                              Sebut harga ini telah selesai dinilai dan keputusan rasmi telah dikeluarkan oleh jawatankuasa perolehan RISDA.
                            </div>
                            <div className="bg-risda-card-muted p-4 rounded-2xl border border-risda-border text-[10px] text-risda-muted uppercase leading-relaxed">
                              Sila rujuk lampiran sijil tawaran atau hubungi Pejabat RISDA Negeri/Daerah yang berkaitan untuk maklumat lanjut.
                            </div>
                          </div>
                        </div>

                        <div className="w-full pt-6 border-t border-risda-border text-center">
                          <p className="text-[9px] text-risda-muted tracking-[2px] font-bold uppercase">SMART LOG SYSTEM</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
