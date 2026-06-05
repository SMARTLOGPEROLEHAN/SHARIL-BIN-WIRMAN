import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import QRCode from 'qrcode';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { FileText, Download, UserCheck, X, Shield, Search, AlertCircle, FileSpreadsheet, FileArchive, File as FileIcon, Send, MessageCircle, Mail } from 'lucide-react';
import AttendanceForm from './AttendanceForm';
import { exportToPDF, exportResultToPDF, exportResultToWord } from '../lib/exportUtils';

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

export default function ProjectFilters({ showRegistration = true, initialStatus }: { showRegistration?: boolean, initialStatus?: string }) {
  const { role, office: userOffice } = useAuth();
  const isStaff = role === 'penginput' || role === 'pelulus' || role === 'admin' || role === 'pentadbir';
  const isAdmin = role === 'admin';
  
  const [ads, setAds] = useState<any[]>([]);
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
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isViewOnlyList, setIsViewOnlyList] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

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

  return (
    <section className={isHomepageVisitor ? "" : "space-y-16 pb-20 text-left"}>
      {!isHomepageVisitor && (
        <div className="w-full">
        <div className="py-10 flex justify-between items-center border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-2.5 h-2.5 bg-risda-orange rounded-full shadow-[0_0_15px_rgba(255,176,0,0.6)]" />
            <h3 className="text-xl font-black uppercase tracking-[6px] text-white">
              {filters.status === 'SELESAI (KEPUTUSAN)' ? 'Keputusan Rasmi Perolehan' : `Senarai Iklan & Keputusan`}
            </h3>
          </div>
        </div>
        
        <div className="py-12">
          <div className="space-y-12 mb-20">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
              {/* Negeri Filter */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-risda-orange" />
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[4px] opacity-80">Negeri</label>
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
                    className="bg-transparent border-b-2 border-white/10 py-5 px-1 text-[13px] font-black text-white focus:outline-none focus:border-risda-orange transition-all w-full appearance-none cursor-pointer hover:bg-white/5 uppercase tracking-wider"
                  >
                    <option value="" className="bg-risda-dark">SEMUA NEGERI (MALAYSIA)</option>
                    <option value="SABAH" className="bg-risda-dark">SABAH</option>
                    <option value="SARAWAK" className="bg-risda-dark">SARAWAK</option>
                    <option value="SELANGOR" className="bg-risda-dark">SELANGOR</option>
                    <option value="KUALA LUMPUR" className="bg-risda-dark">KUALA LUMPUR</option>
                    <option value="JOHOR" className="bg-risda-dark">JOHOR</option>
                    <option value="KEDAH" className="bg-risda-dark">KEDAH</option>
                    <option value="KELANTAN" className="bg-risda-dark">KELANTAN</option>
                    <option value="MELAKA" className="bg-risda-dark">MELAKA</option>
                    <option value="NEGERI SEMBILAN" className="bg-risda-dark">NEGERI SEMBILAN</option>
                    <option value="PAHANG" className="bg-risda-dark">PAHANG</option>
                    <option value="PERAK" className="bg-risda-dark">PERAK</option>
                    <option value="PERLIS" className="bg-risda-dark">PERLIS</option>
                    <option value="PULAU PINANG" className="bg-risda-dark">PULAU PINANG</option>
                    <option value="TERENGGANU" className="bg-risda-dark">TERENGGANU</option>
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                    <svg width="12" height="8" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>

              {/* Pejabat Filter */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-risda-orange" />
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[4px] opacity-80">Pejabat RISDA</label>
                </div>
                <div className="relative group">
                  <select 
                    value={filters.office}
                    onChange={(e) => setFilters({...filters, office: e.target.value})}
                    className="bg-transparent border-b-2 border-white/10 py-5 px-1 text-[13px] font-black text-white focus:outline-none focus:border-risda-orange transition-all w-full appearance-none cursor-pointer hover:bg-white/5 uppercase tracking-wider"
                  >
                    <option value="" className="bg-risda-dark">SEMUA PEJABAT CAWANGAN</option>
                    {offices.map((office) => (
                      <option key={office} value={office} className="bg-risda-dark uppercase">{office}</option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                    <svg width="12" height="8" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-risda-orange" />
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[4px] opacity-80">Status Perolehan</label>
                </div>
                <div className="relative group">
                  <select 
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                    disabled={!showRegistration}
                    className={`bg-transparent border-b-2 border-white/10 py-5 px-1 text-[13px] font-black text-white focus:outline-none focus:border-risda-orange transition-all w-full appearance-none cursor-pointer hover:bg-white/5 uppercase tracking-wider ${!showRegistration ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {(isStaff 
                      ? ['SEMUA', 'AKTIF', 'BATAL', 'SELESAI (KEPUTUSAN)'] 
                      : ['AKTIF', 'SELESAI (KEPUTUSAN)']
                    ).map((status) => (
                      <option key={status} value={status} className="bg-risda-dark uppercase">
                        {status === 'SELESAI (KEPUTUSAN)' ? 'KEPUTUSAN RASMI' : status}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                    <svg width="12" height="8" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>

              {/* Year Filter */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-risda-orange" />
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[4px] opacity-80">Pilih Tahun</label>
                </div>
                <div className="relative group">
                  <select 
                    value={filters.year}
                    onChange={(e) => setFilters({...filters, year: e.target.value})}
                    className="bg-transparent border-b-2 border-white/10 py-5 px-1 text-[13px] font-black text-white focus:outline-none focus:border-risda-orange transition-all w-full appearance-none cursor-pointer hover:bg-white/5 uppercase tracking-wider"
                  >
                    {['ALL', ...years].map(year => (
                      <option key={year} value={year} className="bg-risda-dark">
                        {year === 'ALL' ? 'SEMUA TAHUN ARKIB' : year}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                    <svg width="12" height="8" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black text-risda-muted uppercase tracking-[3px] border-b border-white/10">
                  <th className="px-2 py-8">Sebut Harga / Projek</th>
                  <th className="px-6 py-8">Negeri / Pejabat</th>
                  <th className="px-6 py-8 text-center">Status</th>
                  {filters.status === 'SELESAI (KEPUTUSAN)' && <th className="px-6 py-8 text-center">Pembekal Terpilih</th>}
                  <th className="px-6 py-8 text-right">Tarikh Tutup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center">
                       <div className="flex flex-col items-center gap-4">
                         <div className="w-10 h-10 border-t-2 border-risda-orange rounded-full animate-spin" />
                         <span className="text-risda-muted font-black uppercase tracking-[3px] text-[9px]">Menyelaras Data...</span>
                       </div>
                    </td>
                  </tr>
                ) : ads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-risda-muted font-bold uppercase tracking-widest italic opacity-50">
                      Tiada rekod dijumpai.
                    </td>
                  </tr>
                ) : ads
                    .filter(ad => filters.status === 'SEMUA' || ad.status === filters.status)
                    .filter(ad => filters.category === 'SEMUA' || (ad.category || 'KERJA') === filters.category)
                    .filter(ad => {
                      if (filters.year === 'ALL') return true;
                      const date = ad.visitDate || ad.closingDate || ad.createdAt;
                      if (!date) return false;
                      return new Date(date).getFullYear().toString() === filters.year;
                    })
                    .map((item, idx) => {
                      // Logic: If the item is from a previous year, automatically treat it as SELESAI (KEPUTUSAN)
                      const itemDate = item.visitDate || item.closingDate || item.createdAt;
                      const itemYear = itemDate ? new Date(itemDate).getFullYear() : 0;
                      const isOldProject = itemYear > 0 && itemYear < parseInt(currentYear);
                      const displayStatus = isOldProject ? 'SELESAI (KEPUTUSAN)' : item.status;
                      
                      // Check if it matches status filter after override
                      if (filters.status !== 'SEMUA' && displayStatus !== filters.status) return null;

                      return (
                  <tr 
                    key={idx} 
                    className="group hover:bg-white/[0.02] transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedAd({...item, status: displayStatus});
                      setIsRegisterMode(false);
                    }}
                  >
                    <td className="px-6 py-6 border-l-2 border-transparent hover:border-risda-orange transition-all">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] text-risda-orange font-bold tracking-widest">{item.tenderNo}</span>
                        {item.category && (
                          <span className="px-2 py-0.5 text-[8px] font-black text-white bg-risda-gold/20 border border-risda-gold/30 rounded uppercase tracking-wider">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <div className="text-[14px] font-black text-white group-hover:text-risda-orange transition-colors uppercase truncate max-w-[300px] font-display mb-3">{item.title}</div>
                      {showRegistration && 
                        (displayStatus === 'AKTIF') && 
                        !(item.title?.toUpperCase().includes('PROJEK JALAN') && (role === 'pelawat' || !role)) && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = new URL(window.location.href);
                            url.searchParams.set('adId', item.id);
                            window.history.pushState({}, '', url.pathname + url.search);
                            window.dispatchEvent(new Event('popstate'));
                          }}
                          className="bg-risda-orange text-black px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
                        >
                          Daftar Online
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-[10px] font-bold text-white uppercase">{item.state}</div>
                      <div className="text-[8px] text-risda-muted font-bold uppercase">{item.office}</div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg ${
                        displayStatus === 'AKTIF' 
                          ? 'bg-green-500/10 text-green-400 border border-green-400/20' 
                          : displayStatus === 'BATAL'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-400/20'
                      }`}>
                        {displayStatus === 'SELESAI (KEPUTUSAN)' ? (isOldProject ? 'KEPUTUSAN RASMI (TAMAT)' : 'KEPUTUSAN RASMI') : displayStatus}
                      </span>
                    </td>
                    {filters.status === 'SELESAI (KEPUTUSAN)' && (
                      <td className="px-6 py-6 text-center">
                        {item.winner ? (
                          <div className="flex flex-col items-center">
                            <div className="text-[11px] font-black text-blue-400 uppercase leading-tight">{item.winner.companyName}</div>
                            <div className="text-[9px] text-risda-muted font-bold uppercase tracking-widest">{item.winner.ownerName || item.winner.representativeName}</div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-risda-muted font-black uppercase italic opacity-50">Menunggu Pelantikan</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-6 text-right">
                      <div className="text-[11px] text-white font-black tracking-tight">{formatDate(item.closingDate)}</div>
                      <div className="text-[8px] text-risda-muted font-black uppercase tracking-[1px]">{item.closingTime || '12:00 PM'}</div>
                    </td>
                  </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {loading ? (
              <div className="py-20 text-center flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-t-2 border-risda-orange rounded-full animate-spin" />
                <span className="text-risda-muted font-black uppercase tracking-[3px] text-[9px]">Memuatkan Iklan...</span>
              </div>
            ) : ads.length === 0 ? (
              <div className="py-20 text-center text-risda-muted font-bold uppercase tracking-widest italic opacity-50">
                Tiada rekod.
              </div>
            ) : ads
                .filter(ad => filters.status === 'SEMUA' || ad.status === filters.status)
                .filter(ad => filters.category === 'SEMUA' || (ad.category || 'KERJA') === filters.category)
                .filter(ad => {
                  if (filters.year === 'ALL') return true;
                  const date = ad.visitDate || ad.closingDate || ad.createdAt;
                  if (!date) return false;
                  return new Date(date).getFullYear().toString() === filters.year;
                })
                .map((item, idx) => {
                  const itemDate = item.visitDate || item.closingDate || item.createdAt;
                  const itemYear = itemDate ? new Date(itemDate).getFullYear() : 0;
                  const isOldProject = itemYear > 0 && itemYear < parseInt(currentYear);
                  const displayStatus = isOldProject ? 'SELESAI (KEPUTUSAN)' : item.status;
                  
                  if (filters.status !== 'SEMUA' && displayStatus !== filters.status) return null;

                  return (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => {
                  setSelectedAd({...item, status: displayStatus});
                  setIsRegisterMode(false);
                }}
                className="bg-transparent border border-white/5 rounded-3xl p-6 space-y-4 active:scale-[0.98] transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-risda-orange font-bold tracking-widest">{item.tenderNo}</span>
                    {item.category && (
                      <span className="px-2 py-0.5 text-[8px] font-black text-white bg-risda-gold/20 border border-risda-gold/30 rounded uppercase tracking-wider">
                        {item.category}
                      </span>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                    displayStatus === 'AKTIF' ? 'bg-green-500/10 text-green-400 border border-green-400/20' : 
                    displayStatus === 'SELESAI (KEPUTUSAN)' ? 'bg-blue-500/10 text-blue-400 border border-blue-400/20' :
                    'bg-risda-muted/10 text-risda-muted border border-risda-muted/20'
                  }`}>
                    {displayStatus === 'SELESAI (KEPUTUSAN)' ? (isOldProject ? 'KEPUTUSAN RASMI (TAMAT)' : 'KEPUTUSAN RASMI') : displayStatus}
                  </span>
                </div>
                <h4 className="text-sm font-black text-white leading-tight uppercase line-clamp-2">{item.title}</h4>
                {item.status === 'SELESAI (KEPUTUSAN)' && item.winner && (
                  <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Pembekal Terpilih:</p>
                    <p className="text-[10px] font-black text-white uppercase">{item.winner.companyName}</p>
                  </div>
                )}
                {showRegistration && 
                  (displayStatus === 'AKTIF') && 
                  !(item.title?.toUpperCase().includes('PROJEK JALAN') && (role === 'pelawat' || !role)) && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = new URL(window.location.href);
                      url.searchParams.set('adId', item.id);
                      window.history.pushState({}, '', url.pathname + url.search);
                      window.dispatchEvent(new Event('popstate'));
                    }}
                    className="bg-risda-orange text-black px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest w-full py-3"
                  >
                    Daftar Online
                  </button>
                )}
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-risda-muted font-bold uppercase tracking-[1px]">Tarikh Tutup</span>
                    <span className="text-xs font-black text-white">{formatDate(item.closingDate)}</span>
                  </div>
                </div>
              </motion.div>
                );
              })}
            </div>
          
          <div className="mt-10 p-6 bg-gradient-to-r from-risda-orange/5 to-transparent border-l-2 border-risda-orange rounded-r-xl">
             <p className="text-[11px] text-risda-text-secondary leading-relaxed italic">
               Sistem RISDA memastikan ketelusan seratus peratus dalam setiap fasa perolehan. Sila pastikan anda mempunyai dokumen yang sah sebelum menyertai sebut harga.
             </p>
          </div>
        </div>
      </div>
      )}

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
                className="absolute right-4 top-4 md:right-8 md:top-8 p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white transition-all z-50"
              >
                <X size={20} />
              </button>

              <div className="flex-1 overflow-y-auto">
                {isRegisterMode || (isViewOnlyList && !selectedAd?.id) ? (
                  <div className="bg-black/20">
                    {!selectedAd.id ? (
                      <div className="p-8 md:p-14 space-y-10">
                        <div className="space-y-3 border-l-4 border-risda-orange pl-6">
                          <h3 className="text-2xl font-black text-white uppercase tracking-tight leading-none">
                            {isRegisterMode ? 'Pilih Rujukan Projek' : 'Senarai Iklan Aktif'}
                          </h3>
                          <p className="text-[11px] text-risda-orange font-black uppercase tracking-[4px]">
                            {isRegisterMode 
                              ? 'Sila pilih projek untuk pendaftaran taklimat tapak' 
                              : 'Sila pilih projek untuk melihat maklumat & muat turun dokumen sebut harga'}
                          </p>
                        </div>

                        <div className="relative">
                          <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-risda-muted" />
                          <input 
                            type="text"
                            placeholder="Cari No Sebut Harga atau Nama Projek..."
                            className="w-full bg-black/40 border border-risda-border rounded-2xl py-4 pl-14 pr-6 text-sm text-white focus:border-risda-orange outline-none transition-all"
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
                              return status === 'AKTIF';
                            })
                            .filter(a => a.title.toLowerCase().includes(modalSearch.toLowerCase()) || a.tenderNo.toLowerCase().includes(modalSearch.toLowerCase()))
                            .map((ad) => (
                            <button
                              key={ad.id}
                              onClick={() => setSelectedAd(ad)}
                              className="w-full text-left p-6 bg-white/5 border border-white/5 hover:border-risda-orange/50 rounded-3xl transition-all group hover:bg-risda-orange/5 relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 w-32 h-32 bg-risda-orange/5 -mr-16 -mt-16 rounded-full blur-2xl group-hover:bg-risda-orange/10 transition-all" />
                              <div className="font-mono text-[10px] text-risda-orange mb-2 font-bold tracking-widest">{ad.tenderNo}</div>
                              <div className="text-[13px] font-black text-white uppercase group-hover:text-risda-orange transition-colors leading-relaxed line-clamp-2">{ad.title}</div>
                              <div className="mt-4 flex items-center justify-between">
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
                              return status === 'AKTIF';
                            })
                            .filter(a => a.title.toLowerCase().includes(modalSearch.toLowerCase()) || a.tenderNo.toLowerCase().includes(modalSearch.toLowerCase())).length === 0 && (
                            <div className="col-span-full text-center py-20 text-risda-muted font-bold uppercase tracking-widest bg-white/5 rounded-3xl border border-dashed border-white/10">
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
                  <div className="grid grid-cols-1 lg:grid-cols-3 min-h-full divide-y lg:divide-y-0 lg:divide-x divide-white/10">
                    {/* Information - Column 1 & 2 on Large Screens */}
                    <div className="p-8 md:p-14 space-y-10 lg:col-span-2">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-black shadow-lg ${
                            (selectedAd.status === 'SELESAI (KEPUTUSAN)' && (!isStaff || showRegistration || initialStatus === 'SELESAI (KEPUTUSAN)')) ? 'bg-blue-500 shadow-blue-500/20' : 'bg-risda-orange shadow-risda-orange/20'
                          }`}>
                            <FileText size={24} className={(selectedAd.status === 'SELESAI (KEPUTUSAN)' && (!isStaff || showRegistration || initialStatus === 'SELESAI (KEPUTUSAN)')) ? 'text-white' : 'text-black'} />
                          </div>
                          <div className="flex flex-col">
                            <div className={`text-[10px] font-black uppercase tracking-[4px] ${
                              (selectedAd.status === 'SELESAI (KEPUTUSAN)' && (!isStaff || showRegistration || initialStatus === 'SELESAI (KEPUTUSAN)')) ? 'text-blue-400' : 'text-risda-orange'
                            }`}>
                              {(selectedAd.status === 'SELESAI (KEPUTUSAN)' && (!isStaff || showRegistration || initialStatus === 'SELESAI (KEPUTUSAN)')) ? 'Keputusan Rasmi Perolehan' : 'Maklumat Iklan'}
                            </div>
                            {(selectedAd.status !== 'SELESAI (KEPUTUSAN)' || (isStaff && !showRegistration && initialStatus !== 'SELESAI (KEPUTUSAN)')) && (
                              <div className="flex gap-2 mt-4 sm:mt-0">
                                <button 
                                  onClick={async () => {
                                    const t = toast.loading('Menjana PDF...');
                                    try {
                                      await exportToPDF(selectedAd);
                                      toast.success('PDF berjaya dijana', { id: t });
                                    } catch (err) {
                                      toast.error('Gagal menjana PDF', { id: t });
                                    }
                                  }}
                                  className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                                  title="Muat Turun PDF Iklan"
                                 >
                                  <Download size={14} /> MUAT TURUN PDF IKLAN
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-white leading-tight uppercase tracking-tight">{selectedAd.title}</h2>
                        <div className="flex flex-wrap items-center gap-4">
                          <span className="font-mono text-sm text-risda-muted">{selectedAd.tenderNo}</span>
                          {selectedAd.category && (
                            <>
                              <span className="w-1.5 h-1.5 bg-risda-muted rounded-full" />
                              <span className="px-2.5 py-0.5 text-[9px] font-black text-white bg-risda-orange/20 border border-risda-orange/30 rounded uppercase tracking-wider">{selectedAd.category}</span>
                            </>
                          )}
                          <span className="w-1.5 h-1.5 bg-risda-muted rounded-full" />
                          <span className={`text-[10px] font-black uppercase tracking-[2px] ${
                            (selectedAd.status === 'SELESAI (KEPUTUSAN)' && (!isStaff || showRegistration || initialStatus === 'SELESAI (KEPUTUSAN)')) ? 'text-blue-400' : 'text-risda-orange'
                          }`}>{selectedAd.state || 'Seluruh Malaysia'}</span>
                        </div>
                      </div>

                      {/* Case 1: Active or Cancelled Ad - Show Full Info */}
                      {(selectedAd.status !== 'SELESAI (KEPUTUSAN)' || (isStaff && !showRegistration && initialStatus !== 'SELESAI (KEPUTUSAN)')) && (
                        <>
                          {selectedAd.licenseRequirements && (
                            <div className="bg-risda-orange/5 border border-risda-orange/20 p-6 rounded-3xl space-y-2">
                               <h4 className="text-[10px] font-black text-risda-orange uppercase tracking-[4px]">Keperluan Lesen Pelantikan</h4>
                               <p className="text-xs text-white leading-relaxed uppercase">{selectedAd.licenseRequirements}</p>
                            </div>
                          )}

                          {selectedAd.licenses && (
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-black text-risda-gold uppercase tracking-[4px]">Sijil & Lesen Berdaftar</h4>
                              <div className="flex flex-wrap gap-2">
                                {selectedAd.licenses.cidbSpkk && <span className="px-3 py-1.5 bg-risda-orange text-black rounded-lg text-[9px] font-black uppercase tracking-widest">CIDB (SPKK)</span>}
                                {selectedAd.licenses.cidbPkk && <span className="px-3 py-1.5 bg-risda-orange text-black rounded-lg text-[9px] font-black uppercase tracking-widest">CIDB (PKK)</span>}
                                {selectedAd.licenses.stb && <span className="px-3 py-1.5 bg-risda-orange text-black rounded-lg text-[9px] font-black uppercase tracking-widest">STB</span>}
                                {selectedAd.licenses.mof && <span className="px-3 py-1.5 bg-risda-orange text-black rounded-lg text-[9px] font-black uppercase tracking-widest">MOF</span>}
                                {selectedAd.licenses.tcc && <span className="px-3 py-1.5 bg-risda-orange text-black rounded-lg text-[9px] font-black uppercase tracking-widest">TCC</span>}
                                {selectedAd.licenses.pukonsa && <span className="px-3 py-1.5 bg-risda-orange text-black rounded-lg text-[9px] font-black uppercase tracking-widest">PUKONSA</span>}
                                {selectedAd.licenses.kuhean && <span className="px-3 py-1.5 bg-risda-orange text-black rounded-lg text-[9px] font-black uppercase tracking-widest">KUHEAN</span>}
                                {selectedAd.licenses.others && (
                                  <span className="px-3 py-1.5 bg-white/10 border border-white/10 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">
                                    {selectedAd.licenses.others}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2 bg-white/5 p-6 rounded-3xl border border-white/5">
                              <p className="text-[9px] font-black text-risda-muted uppercase tracking-[3px]">Status Perolehan</p>
                              <span className={`px-3 py-1 rounded text-[10px] font-black uppercase ${
                                selectedAd.status === 'AKTIF' ? 'text-green-400' : 
                                selectedAd.status === 'BATAL' ? 'text-red-400' : 
                                'text-blue-400'
                              }`}>
                                {selectedAd.status}
                              </span>
                            </div>
                            <div className="space-y-2 bg-white/5 p-6 rounded-3xl border border-white/5">
                              <p className="text-[9px] font-black text-risda-muted uppercase tracking-[3px]">Tarikh Tutup Penyerahan</p>
                              <p className="text-lg font-black text-red-500 tracking-tight">{formatDate(selectedAd.closingDate)}</p>
                              <p className="text-[10px] font-bold text-risda-muted uppercase tracking-widest">{selectedAd.closingTime || '12:00 PM'}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/5">
                              <h4 className="text-[10px] font-black text-risda-orange uppercase tracking-[4px]">Lawatan Tapak</h4>
                              <div className="space-y-1">
                                <p className="text-white font-bold text-sm">{formatDate(selectedAd.visitDate)}</p>
                                <p className="text-risda-muted text-[10px] uppercase font-bold">{selectedAd.visitVenue || '-'}</p>
                              </div>
                            </div>
                            <div className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/5">
                              <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[4px]">Taklimat Tapak</h4>
                              <div className="space-y-1">
                                <p className="text-white font-bold text-sm">{formatDate(selectedAd.briefingDate)}</p>
                                <p className="text-risda-muted text-[10px] uppercase font-bold">{selectedAd.briefingVenue || '-'}</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-6">
                            <h4 className="text-[10px] font-black text-risda-gold uppercase tracking-[4px]">Pemerolehan Dokumen</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/5 p-8 rounded-3xl border border-white/5">
                              <div>
                                <p className="text-risda-muted text-[9px] uppercase font-bold mb-1">Tarikh Mula</p>
                                <p className="text-white font-bold text-base">{formatDate(selectedAd.docStartDate)}</p>
                              </div>
                              <div>
                                <p className="text-risda-muted text-[9px] uppercase font-bold mb-1">Tarikh Akhir</p>
                                <p className="text-white font-bold text-base">{formatDate(selectedAd.docEndDate)}</p>
                              </div>
                              <div className="md:col-span-2 pt-4 border-t border-white/5 text-left">
                                <p className="text-risda-muted text-[9px] uppercase font-bold mb-2">Tempat / Kaunter</p>
                                <p className="text-white font-black text-sm uppercase leading-relaxed">{selectedAd.docVenue || '-'}</p>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Case 2: Decision Available - Show Official Result (Hebahan) Only */}
                      {selectedAd.status === 'SELESAI (KEPUTUSAN)' && (!isStaff || showRegistration || initialStatus === 'SELESAI (KEPUTUSAN)') && (
                        <div className="space-y-8">
                          {/* Export Options for Decision */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-blue-500/5 p-5 md:p-6 rounded-3xl border border-blue-500/10">
                            <div className="flex items-center gap-4 w-full">
                              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
                                <Download size={22} />
                              </div>
                              <div className="flex-1">
                                <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Muat Turun Keputusan</p>
                                <p className="text-[9px] text-risda-muted font-medium">Pilih format untuk simpanan rasmi atau perkongsian.</p>
                              </div>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                              <button 
                                onClick={async () => {
                                  const t = toast.loading('Menjana PDF...');
                                  try {
                                    await exportResultToPDF({
                                      tenderNo: selectedAd.tenderNo,
                                      title: selectedAd.title,
                                      office: selectedAd.office,
                                      winnerName: selectedAd.winner?.companyName || '-',
                                      startDate: selectedAd.winner?.contractStartDate || selectedAd.contractStartDate || '-',
                                      endDate: selectedAd.winner?.contractEndDate || selectedAd.contractEndDate || '-',
                                      location: selectedAd.winner?.location || selectedAd.location || selectedAd.visitVenue || selectedAd.docVenue || '-'
                                    });
                                    toast.success('PDF berjaya dijana', { id: t });
                                  } catch (err) {
                                    toast.error('Gagal menjana PDF', { id: t });
                                  }
                                }}
                                className="flex-1 sm:flex-none px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                               >
                                <Download size={14} /> PDF
                              </button>
                              <button 
                                onClick={() => exportResultToWord({
                                  tenderNo: selectedAd.tenderNo,
                                  title: selectedAd.title,
                                  office: selectedAd.office,
                                  winnerName: selectedAd.winner?.companyName || '-',
                                  startDate: selectedAd.winner?.contractStartDate || selectedAd.contractStartDate || '-',
                                  endDate: selectedAd.winner?.contractEndDate || selectedAd.contractEndDate || '-',
                                  location: selectedAd.winner?.location || selectedAd.location || selectedAd.visitVenue || selectedAd.docVenue || '-'
                                })}
                                className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                              >
                                <FileText size={14} /> WORD
                              </button>
                            </div>

                          </div>

                          {/* Visual Representation of Hebahan */}
                          <div className="relative mx-auto w-full max-w-2xl px-4 sm:px-0">
                            <div className="bg-white p-4 sm:p-6 md:p-14 border-[3px] border-slate-900 rounded-none shadow-2xl text-black font-sans w-full overflow-hidden">
                                <div className="text-[7px] md:text-[10px] font-black text-right mb-4 md:mb-12 uppercase tracking-tighter opacity-80">URUSETIA PEROLEHAN PRD {selectedAd.office?.toUpperCase()}</div>
                                
                                <div className="flex flex-col items-center mb-6 md:mb-12">
                                  <div className="w-12 h-12 md:w-24 md:h-24 mb-4 md:mb-6 flex items-center justify-center">
                                    <img 
                                      src="/PUBLIC/intrologo_RISDA.png" 
                                      alt="RISDA" 
                                      className="h-full object-contain" 
                                      onError={(e) => { 
                                        const img = e.currentTarget;
                                        if (img.src !== "/api/logo") {
                                          img.src = "/api/logo";
                                        }
                                      }} 
                                    />
                                  </div>
                                  <h1 className="text-xl sm:text-2xl md:text-5xl font-black border-b-4 border-black pb-1 mb-4 md:mb-8 tracking-tight text-center">HEBAHAN</h1>
                                  <div className="text-center font-black text-[10px] sm:text-sm md:text-lg tracking-tight mb-4 md:mb-8 px-2">
                                    <span className="border-b-[1px] md:border-b-2 border-black pb-0.5 inline-block uppercase">PEMBIDA YANG BERJAYA BAGI SEBUTHARGA</span><br />
                                    <span className="border-b-[1px] md:border-b-2 border-black pb-0.5 inline-block uppercase mt-1 text-center">PEJABAT RISDA DAERAH {selectedAd.office?.toUpperCase()}</span>
                                  </div>
                                </div>

                                <div className="border-[2px] md:border-[3px] border-black p-4 md:p-12 space-y-4 md:space-y-8 bg-white overflow-hidden">
                                  <div className="grid grid-cols-[80px_10px_1fr] sm:grid-cols-[160px_20px_1fr] gap-y-3 md:gap-y-6 text-[9px] sm:text-base md:text-lg">
                                    <div className="font-black uppercase">NO SEBUTHARGA</div>
                                    <div className="font-black text-center">:</div>
                                    <div className="font-bold break-all text-blue-700">{selectedAd.tenderNo}</div>
                                    
                                    <div className="font-black uppercase">TAJUK SEBUTHARGA</div>
                                    <div className="font-black text-center">:</div>
                                    <div className="uppercase font-black leading-tight text-[10px] sm:text-base md:text-lg">{selectedAd.title}</div>

                                    <div className="font-black uppercase">KONTRAKTOR</div>
                                    <div className="font-black text-center">:</div>
                                    <div className="uppercase font-black text-green-700">{selectedAd.winner?.companyName || '-'}</div>

                                    <div className="font-black uppercase">TEMPOH KERJA</div>
                                    <div className="font-black text-center">:</div>
                                    <div className="uppercase font-black text-[8px] sm:text-base">{formatDate(selectedAd.winner?.contractStartDate || selectedAd.contractStartDate)} SEHINGGA {formatDate(selectedAd.winner?.contractEndDate || selectedAd.contractEndDate)}</div>

                                    <div className="font-black uppercase">TEMPAT</div>
                                    <div className="font-black text-center">:</div>
                                    <div className="uppercase font-black">{selectedAd.winner?.location || selectedAd.location || selectedAd.visitVenue || selectedAd.docVenue || '-'}</div>
                                  </div>
                                </div>
                              </div>
                          </div>
                        </div>
                      )}


                      {(selectedAd.status !== 'SELESAI (KEPUTUSAN)' || (isStaff && !showRegistration && initialStatus !== 'SELESAI (KEPUTUSAN)')) && (
                        <div className="pt-10 border-t border-risda-border flex flex-wrap gap-4">
                           <div className="bg-white/5 px-6 py-4 rounded-xl border border-white/5 flex items-center gap-4 flex-1 min-w-[200px]">
                              <Shield size={20} className="text-risda-orange" />
                              <div>
                               <p className="text-[10px] font-black text-white uppercase tracking-widest font-poppins">SMART LOG PEROLEHAN</p>
                                 <p className="text-[9px] text-risda-muted leading-relaxed">Pendaftaran digital yang selamat dan telus.</p>
                              </div>
                           </div>
                        </div>
                      )}
                    </div>

                    {/* Column 3 - QR Code (Only for active or cancelled/briefing ads) */}
                    {(selectedAd.status !== 'SELESAI (KEPUTUSAN)' || (isStaff && !showRegistration && initialStatus !== 'SELESAI (KEPUTUSAN)')) ? (
                      <div className="p-8 md:p-14 bg-black/15 flex flex-col justify-between items-center text-center space-y-8 border-t lg:border-t-0 border-white/10 lg:col-span-1">
                        <div className="w-full space-y-6">
                          <div className="border-b border-white/5 pb-4 text-center">
                            <h4 className="text-sm font-black text-white uppercase tracking-widest leading-none">PENDAFTARAN SEGERA</h4>
                            <p className="text-[10px] text-risda-orange uppercase tracking-[3px] mt-1.5 font-bold">Imbas QR Kod</p>
                          </div>
                          
                          <div className="relative mx-auto max-w-[220px] aspect-square bg-[#0d121c] p-4 rounded-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] group overflow-hidden flex items-center justify-center">
                            <div className="absolute inset-0 bg-gradient-to-t from-risda-orange/10 via-transparent to-transparent opacity-80 group-hover:scale-110 transition-transform duration-500" />
                            <img 
                              src={qrCodeUrl || `/api/qr-code.png?adId=${selectedAd.id}&origin=${encodeURIComponent(window.location.origin)}`} 
                              alt="Kod QR Pendaftaran" 
                              className="relative z-10 w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>

                          <div className="space-y-3 bg-white/5 p-5 rounded-2xl border border-white/5 text-left">
                            <p className="text-[11px] text-white/95 font-bold leading-relaxed uppercase">
                              Kontraktor diminta untuk mengimbas QR Code ini untuk pendaftaran taklimat tapak digital secara terus menggunakan telefon pintar.
                            </p>
                            <div className="h-px bg-white/5" />
                            <p className="text-[10px] text-risda-muted leading-relaxed uppercase">
                              Pastikan anda berada di lokasi taklimat pada tarikh dan masa yang ditetapkan untuk mengimbas.
                            </p>
                          </div>
                        </div>

                        <div className="w-full pt-6 border-t border-white/5 text-center">
                          <p className="text-[9px] text-white/40 tracking-[2px] font-black uppercase">SMART LOG SYSTEM</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 md:p-14 bg-black/15 flex flex-col justify-between items-center text-center space-y-8 border-t lg:border-t-0 border-white/10 lg:col-span-1">
                        <div className="w-full space-y-6">
                          <div className="border-b border-white/5 pb-4 text-center">
                            <h4 className="text-sm font-black text-white uppercase tracking-widest leading-none">MAKLUMAT KEPUTUSAN</h4>
                            <p className="text-[10px] text-blue-400 uppercase tracking-[3px] mt-1.5 font-bold">RASMI PEROLEHAN</p>
                          </div>
                          
                          <div className="space-y-4 text-left">
                            <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10 text-[11px] text-white/80 uppercase font-medium leading-relaxed">
                              Sebut harga ini telah selesai dinilai dan keputusan rasmi telah dikeluarkan oleh jawatankuasa perolehan RISDA.
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-[10px] text-risda-muted uppercase leading-relaxed">
                              Sila rujuk lampiran sijil tawaran atau hubungi Pejabat RISDA Negeri/Daerah yang berkaitan untuk maklumat lanjut.
                            </div>
                          </div>
                        </div>

                        <div className="w-full pt-6 border-t border-white/5 text-center">
                          <p className="text-[9px] text-white/40 tracking-[2px] font-black uppercase">SMART LOG SYSTEM</p>
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
