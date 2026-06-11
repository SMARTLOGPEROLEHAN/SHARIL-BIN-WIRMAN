import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

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
import { 
  FileText, 
  Download, 
  Search, 
  Users, 
  ChevronRight,
  ArrowLeft,
  Calendar,
  MapPin,
  Eye,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { 
  exportAttendanceListToPDF, 
  exportSubmissionListToPDF, 
  exportIndividualSiteVisitForm
} from '../lib/exportUtils';

const RisdaLogoSVG = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block">
    <circle cx="50" cy="50" r="48" fill="#1b5e20" stroke="#f57f17" strokeWidth="2.5" />
    <circle cx="50" cy="50" r="43" fill="white" />
    <path d="M50 15 C30 15, 25 35, 25 50 C25 65, 30 85, 50 85 C70 85, 75 65, 75 50 C75 35, 70 15, 50 15 Z" fill="#1b5e20" opacity="0.08" />
    <path d="M35 55 C35 40, 50 30, 50 25 C50 30, 65 40, 65 55 C65 70, 50 78, 50 80 C50 78, 35 70, 35 55 Z" fill="#2e7d32" />
    <path d="M42 58 C42 45, 50 35, 50 30 C50 35, 58 45, 58 58 C58 70, 50 75, 50 76 C50 75, 42 70, 42 58 Z" fill="#ffb300" />
    <text x="50" y="88" fill="#1b5e20" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">RISDA</text>
  </svg>
);

export default function AttendanceAndSubmission() {
  const { role, office: userOffice } = useAuth();
  const isAdmin = role === 'admin' || role === 'pentadbir';
  const isStaff = role === 'penginput' || role === 'pelulus' || isAdmin;
  const currentYearStr = new Date().getFullYear().toString();
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAd, setSelectedAd] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'attendance' | 'submission'>('attendance');
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [fetchingAttendance, setFetchingAttendance] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(currentYearStr);
  const [offices, setOffices] = useState<string[]>([]);
  
  // Custom document previews
  const [previewType, setPreviewType] = useState<'attendance' | 'submission' | 'individual' | null>(null);
  const [previewRecord, setPreviewRecord] = useState<any | null>(null);
  const [previewSerialNo, setPreviewSerialNo] = useState<string>('');
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  useEffect(() => {
    fetchAds();
  }, [role, userOffice]);

  useEffect(() => {
    if (selectedAd?.title) {
      fetchAttendance(selectedAd.title);
    }
  }, [selectedAd]);

  const fetchAds = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'ads'), orderBy('tenderNo', 'desc'));
      const snap = await getDocs(q);
      const adsData = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setAds(adsData);
      
      const uniqueOffices = Array.from(new Set(adsData.map((ad: any) => ad.office?.trim().toUpperCase()).filter(Boolean))) as string[];
      setOffices(uniqueOffices.sort());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'ads');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async (adTitle: string) => {
    setFetchingAttendance(true);
    try {
      const q = query(
        collection(db, 'attendance'), 
        where('adTitle', '==', adTitle),
        orderBy('timestamp', 'asc')
      );
      const snap = await getDocs(q);
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort client-side to handle docSeriesNo as primary sort key
      const sortedRecords = records.sort((a: any, b: any) => {
        const aNo = parseInt(a.docSeriesNo || '0');
        const bNo = parseInt(b.docSeriesNo || '0');
        if (aNo !== bNo && aNo !== 0 && bNo !== 0) return aNo - bNo;
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return aTime - bTime;
      });

      setAttendanceRecords(sortedRecords);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setFetchingAttendance(false);
    }
  };

  const filteredAds = ads.filter(ad => {
    const matchesSearch = ad.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          ad.tenderNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOffice = !officeFilter || ad.office === officeFilter;
    const adDate = ad.visitDate || ad.closingDate || ad.createdAt;
    const matchesYear = yearFilter === 'ALL' || (adDate ? new Date(adDate).getFullYear().toString() : '') === yearFilter;
    return matchesSearch && matchesOffice && matchesYear;
  });

  const years = Array.from(new Set([
    new Date().getFullYear().toString(),
    ...ads.map(ad => {
      const date = ad.visitDate || ad.closingDate || ad.createdAt;
      return date ? new Date(date).getFullYear().toString() : null;
    }).filter(Boolean)
  ])).sort((a, b) => b.localeCompare(a));

  if (selectedAd) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <button 
          onClick={() => setSelectedAd(null)}
          className="flex items-center gap-2 text-risda-muted hover:text-white transition-colors font-black uppercase tracking-[3px] text-[10px] mb-4"
        >
          <ArrowLeft size={16} /> Kembali ke Senarai
        </button>

        <div className="space-y-10">
          <div className="py-10 border-b border-white/10 space-y-10">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-2.5 h-10 bg-risda-orange rounded-full shadow-[0_0_15px_rgba(255,176,0,0.4)] mt-1" />
                <h2 className="text-3xl md:text-4xl font-black text-white leading-tight uppercase tracking-tight max-w-4xl">{selectedAd.title}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-8 pl-6">
                <div className="flex items-center gap-3 text-risda-orange font-mono text-sm font-bold">
                   <div className="w-8 h-8 bg-risda-orange/10 rounded-lg flex items-center justify-center">
                     <FileText size={16} />
                   </div>
                   {selectedAd.tenderNo}
                </div>
                <div className="flex items-center gap-3 text-risda-muted text-[10px] uppercase font-black tracking-widest">
                   <MapPin size={14} className="text-risda-gold" />
                   {selectedAd.office} ({selectedAd.state})
                </div>
                <div className="flex items-center gap-3 text-risda-muted text-[10px] uppercase font-black tracking-widest">
                   <Calendar size={14} className="text-risda-gold" />
                   Tutup: {selectedAd.closingDate}
                </div>
              </div>
            </div>

            {fetchingAttendance ? (
              <div className="py-24 flex flex-col items-center gap-4 text-risda-muted">
                <div className="w-12 h-12 border-2 border-risda-orange border-t-transparent rounded-full animate-spin" />
                <span className="font-black uppercase tracking-[5px] text-[10px] animate-pulse">Menyelaras Rekod...</span>
              </div>
            ) : attendanceRecords.length === 0 ? (
              <div className="py-24 text-center space-y-6 bg-white/5 rounded-[40px] border border-dashed border-white/10">
                <Users size={56} className="mx-auto text-risda-muted opacity-10" />
                <p className="text-risda-muted font-black uppercase tracking-[4px] text-[10px] italic">Tiada rekod kehadiran dijumpai</p>
              </div>
            ) : (
              <div className="space-y-12">
                {/* Tab Switcher */}
                <div className="flex p-1 bg-white/5 rounded-2xl w-fit">
                  <button 
                    onClick={() => setActiveTab('attendance')}
                    className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                      activeTab === 'attendance' 
                        ? 'bg-risda-orange text-black shadow-xl shadow-risda-orange/20' 
                        : 'text-risda-muted hover:text-white'
                    }`}
                  >
                    <Users size={14} /> Kehadiran Taklimat
                  </button>
                  <button 
                    onClick={() => setActiveTab('submission')}
                    className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                      activeTab === 'submission' 
                        ? 'bg-blue-500 text-white shadow-xl shadow-blue-500/20' 
                        : 'text-risda-muted hover:text-white'
                    }`}
                  >
                    <FileText size={14} /> Borang Serahan
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {activeTab === 'attendance' ? (
                    <motion.div 
                      key="attendance"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Users size={18} className="text-risda-gold" />
                            <h4 className="text-[11px] font-black text-risda-gold uppercase tracking-[4px]">Senarai Kehadiran Taklimat</h4>
                          </div>
                          <p className="text-[10px] text-risda-muted uppercase font-bold tracking-widest">Syarikat yang telah mendaftar secara digital untuk taklimat tapak</p>
                        </div>
                           {isStaff && (
                             <div className="w-full sm:w-auto flex flex-wrap gap-3">
                               <button 
                                 onClick={() => {
                                   setPreviewType('attendance');
                                   setPreviewRecord(null);
                                 }}
                                 className="w-full sm:w-auto px-5 py-3 border border-white/10 hover:border-risda-orange/50 hover:bg-white/5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                               >
                                 <Eye size={14} className="text-risda-orange" /> PAPAR PREVIEW
                               </button>
                               <button 
                                 onClick={async () => {
                                   const t = toast.loading('Menjana PDF...');
                                   try {
                                     await exportAttendanceListToPDF(selectedAd, attendanceRecords);
                                     toast.success('PDF berjaya dijana', { id: t });
                                   } catch (err) {
                                     toast.error('Gagal menjana PDF', { id: t });
                                   }
                                 }}
                                 className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                               >
                                 <Download size={14} /> PDF SENARAI KEHADIRAN
                               </button>
                             </div>
                           )}
                      </div>

                      <div className="bg-black/40 border border-white/5 rounded-3xl overflow-hidden shadow-xl">
                        <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-20 bg-black/80 backdrop-blur-md">
                              <tr className="text-[9px] font-black text-risda-muted uppercase tracking-[3px] border-b border-white/5">
                                <th className="px-8 py-5">No Siri</th>
                                <th className="px-8 py-5">Nama Syarikat / Alamat</th>
                                <th className="px-8 py-5">Nama Pemilik / No. Tel</th>
                                <th className="px-8 py-5">Email</th>
                                <th className="px-8 py-5">Masa Daftar</th>
                                <th className="px-8 py-5 text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {attendanceRecords.map((rec, idx) => (
                                <tr key={idx} className="text-[11px] text-white/80 hover:bg-white/[0.02] transition-colors">
                                  <td className="px-8 py-5 font-mono text-risda-orange font-bold">{(idx + 1).toString().padStart(3, '0')}</td>
                                  <td className="px-8 py-5 font-black uppercase text-white tracking-wide">
                                    {rec.companyName}
                                    {rec.companyAddress && <div className="text-[9px] text-risda-muted lowercase font-normal mt-0.5 max-w-xs truncate">{rec.companyAddress}</div>}
                                  </td>
                                  <td className="px-8 py-5">
                                    <div className="font-bold text-white uppercase">{rec.ownerName}</div>
                                    <div className="text-[9px] text-risda-muted mt-0.5">{rec.phoneNumber}</div>
                                  </td>
                                  <td className="px-8 py-5">
                                    <div className="text-white font-medium">{rec.email || '-'}</div>
                                  </td>
                                  <td className="px-8 py-5 font-mono text-risda-muted">
                                    {rec.timestamp ? formatDate(rec.timestamp) : '-'}
                                  </td>
                                   <td className="px-8 py-5 text-right">
                                    <div className="flex justify-end gap-2">
                                      <button 
                                        onClick={() => {
                                          const serialNo = (idx + 1).toString().padStart(3, '0');
                                          setPreviewType('individual');
                                          setPreviewRecord(rec);
                                          setPreviewSerialNo(serialNo);
                                        }}
                                        className="inline-flex items-center gap-2 px-3 py-2 border border-white/10 hover:border-risda-orange/50 hover:bg-white/5 text-white rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-90 transition-all whitespace-nowrap animate-in fade-in duration-300"
                                        title="Papar Preview Borang"
                                      >
                                        <Eye size={12} className="text-risda-orange" /> PAPAR
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          const t = toast.loading('Menjana PDF...');
                                          const serialNo = (idx + 1).toString().padStart(3, '0');
                                          try {
                                            await exportIndividualSiteVisitForm(selectedAd, rec, serialNo);
                                            toast.success('PDF berjaya dijana', { id: t });
                                          } catch (err) {
                                            toast.error('Gagal menjana PDF', { id: t });
                                          }
                                        }}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md active:scale-90 transition-all whitespace-nowrap"
                                        title="Muat Turun PDF"
                                      >
                                        <Download size={12} /> BORANG (PDF)
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="submission"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <FileText size={18} className="text-blue-400" />
                            <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-[4px]">Borang Serahan Dokumen Sebut Harga</h4>
                          </div>
                          <p className="text-[10px] text-risda-muted uppercase font-bold tracking-widest">Rekod penyerahan fizikal dokumen sebut harga</p>
                        </div>
                           {isStaff && (
                             <div className="w-full sm:w-auto flex flex-wrap gap-3">
                               <button 
                                 onClick={() => {
                                   setPreviewType('submission');
                                   setPreviewRecord(null);
                                 }}
                                 className="w-full sm:w-auto px-5 py-3 border border-white/10 hover:border-risda-orange/50 hover:bg-white/5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                               >
                                 <Eye size={14} className="text-risda-orange" /> PAPAR PREVIEW
                               </button>
                               <button 
                                 onClick={async () => {
                                   const t = toast.loading('Menjana PDF...');
                                   try {
                                     await exportSubmissionListToPDF(selectedAd, attendanceRecords);
                                     toast.success('PDF berjaya dijana', { id: t });
                                   } catch (err) {
                                     toast.error('Gagal menjana PDF', { id: t });
                                   }
                                 }}
                                 className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                               >
                                 <Download size={14} /> PDF BORANG SERAHAN
                               </button>
                             </div>
                           )}
                      </div>

                      <div className="bg-black/40 border border-white/5 rounded-3xl overflow-hidden shadow-xl">
                        <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-20 bg-black/80 backdrop-blur-md">
                              <tr className="text-[9px] font-black text-risda-muted uppercase tracking-[3px] border-b border-white/5">
                                <th className="px-8 py-5">No Siri</th>
                                <th className="px-8 py-5">Nama Syarikat</th>
                                <th className="px-8 py-5">No. Siri Sebut Harga</th>
                                <th className="px-8 py-5 text-center">Tanda Tangan & Cop</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {attendanceRecords.map((rec, idx) => (
                                <tr key={idx} className="text-[11px] text-white/80 hover:bg-white/[0.02] transition-colors">
                                  <td className="px-8 py-5 font-mono text-risda-orange font-bold">{(idx + 1).toString().padStart(3, '0')}</td>
                                  <td className="px-8 py-5 font-black uppercase text-white tracking-wide">{rec.companyName}</td>
                                  <td className="px-8 py-5 font-mono text-risda-gold font-bold">{rec.docSeriesNo || '-'}</td>
                                  <td className="px-8 py-5 text-center">
                                    <span className="text-[9px] font-black text-risda-muted uppercase tracking-widest opacity-30 italic">Ruang Fizikal</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-16 pt-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 border-b border-white/10 pb-12">
        <div className="space-y-6">
          <div className="flex items-center gap-5">
             <div className="w-16 h-16 bg-gradient-to-br from-risda-orange to-risda-gold rounded-3xl flex items-center justify-center text-black shadow-2xl shadow-risda-orange/20">
               <Users size={32} />
             </div>
             <div>
               <p className="text-[10px] text-risda-orange font-black uppercase tracking-[6px] mb-1">Pengurusan Data</p>
               <h2 className="text-3xl font-black text-white uppercase tracking-tight leading-none">Kehadiran & Serahan</h2>
             </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-8 items-end flex-1 max-w-4xl">
          <div className="flex flex-col gap-3 min-w-[280px] flex-1">
            <label className="text-[10px] font-black text-risda-orange uppercase tracking-[4px] px-1 opacity-80">Carian</label>
            <div className="relative group">
              <Search className="absolute left-1 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-risda-orange transition-colors" size={14} />
              <input 
                type="text"
                placeholder="TAJUK ATAU NO SEBUT HARGA..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-b-2 border-white/10 py-4 pl-10 pr-4 text-xs font-black text-white uppercase focus:outline-none focus:border-risda-orange transition-all w-full tracking-wider"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 w-48">
            <label className="text-[10px] font-black text-risda-orange uppercase tracking-[4px] px-1 opacity-80">Pejabat</label>
            <div className="relative">
              <select 
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value)}
                className="bg-transparent border-b-2 border-white/10 py-5 px-1 text-xs font-black text-white focus:outline-none focus:border-risda-orange transition-all w-full appearance-none cursor-pointer uppercase tracking-wider"
              >
                <option value="" className="bg-risda-dark">SEMUA PEJABAT</option>
                {offices.map(off => <option key={off} value={off} className="bg-risda-dark uppercase">{off}</option>)}
              </select>
              <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-40">
            <label className="text-[10px] font-black text-risda-orange uppercase tracking-[4px] px-1 opacity-80">Tahun</label>
            <div className="relative">
              <select 
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="bg-transparent border-b-2 border-white/10 py-5 px-1 text-xs font-black text-white focus:outline-none focus:border-risda-orange transition-all w-full appearance-none cursor-pointer uppercase tracking-wider"
              >
                <option value="ALL" className="bg-risda-dark">SEMUA TAHUN</option>
                {years.map(year => <option key={year} value={year} className="bg-risda-dark">{year}</option>)}
              </select>
              <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-40 flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-t-2 border-risda-orange rounded-full animate-spin" />
          <span className="font-black uppercase tracking-[8px] text-[10px] text-risda-muted animate-pulse">Menghubungkan Database...</span>
        </div>
      ) : filteredAds.length === 0 ? (
        <div className="py-40 text-center space-y-8 bg-white/5 rounded-[50px] border border-white/10 border-dashed">
          <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto ring-1 ring-white/10">
            <Search size={40} className="text-risda-muted opacity-20" />
          </div>
          <div className="space-y-3">
            <h3 className="text-xl font-black text-white/50 uppercase tracking-widest">Tiada Rekod Dijumpai</h3>
            <p className="text-[10px] text-risda-muted uppercase font-black tracking-[4px] max-w-sm mx-auto leading-relaxed">Sila tukar kriteria carian atau gunakan filter di atas untuk melihat data lain.</p>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-8 px-2">
             <h4 className="text-[11px] font-black text-risda-orange uppercase tracking-[4px]">Diarkibkan ({filteredAds.length})</h4>
             <p className="text-[9px] text-risda-muted font-bold uppercase tracking-[2px]">Klik Rekod untuk melihat Detail</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {filteredAds.map((ad, idx) => (
              <motion.div
                key={ad.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => setSelectedAd(ad)}
                className="group p-6 md:p-8 rounded-[32px] border border-white/5 hover:border-risda-orange/40 hover:bg-white/5 transition-all duration-500 flex flex-col md:flex-row md:items-center gap-8 relative overflow-hidden cursor-pointer"
              >
              <div className="absolute top-0 right-0 w-32 h-32 bg-risda-orange/5 -mr-16 -mt-16 rounded-full blur-3xl group-hover:bg-risda-orange/10 transition-all duration-700 pointer-events-none" />
              
              <div 
                className="flex-1 min-w-0 cursor-pointer group/title"
                onClick={() => { setSelectedAd(ad); setActiveTab('attendance'); }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-[9px] text-risda-orange font-bold tracking-widest bg-risda-orange/10 px-2 py-0.5 rounded">
                    {ad.tenderNo}
                  </span>
                  <span className="text-[10px] text-risda-muted uppercase font-black tracking-widest flex items-center gap-1.5">
                    <MapPin size={10} className="text-risda-gold" /> {ad.office}
                  </span>
                </div>
                <h3 className="text-sm md:text-base font-black text-white uppercase group-hover:text-risda-gold transition-colors duration-300 leading-tight line-clamp-1 mb-1">
                  {ad.title}
                </h3>
                <p className="text-[8px] text-risda-muted font-bold uppercase tracking-[2px] opacity-0 group-hover/title:opacity-100 transition-all transform translate-y-1 group-hover/title:translate-y-0">
                  Klik untuk lihat rekod kehadiran & serahan
                </p>
              </div>

              <div className="shrink-0 relative z-10">
                <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-risda-muted group-hover:bg-risda-orange group-hover:text-black transition-all duration-500">
                  <ChevronRight size={18} />
                </div>
              </div>
            </motion.div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
