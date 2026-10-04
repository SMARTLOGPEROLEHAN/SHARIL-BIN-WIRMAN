import { ArrowRight, FileText, Megaphone, Users, Coins, Eye, Activity, ChevronRight, TrendingUp, CheckCircle2, QrCode } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { recordAndSubscribeVisitorCount } from '../lib/visitorTracking';

function formatRinggitCompact(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'RM 0.00';
  if (num >= 1_000_000) {
    const val = (num / 1_000_000).toFixed(2).replace(/\.00$/, '');
    return `RM ${val}J`;
  }
  if (num >= 1_000) {
    const val = (num / 1_000).toFixed(1).replace(/\.0$/, '');
    return `RM ${val}K`;
  }
  return `RM ${num.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function Hero() {
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'pentadbir';
  const isStaff = role === 'penginput' || role === 'penyemak' || role === 'pelulus' || isAdmin;
  
  const [adCount, setAdCount] = useState(0);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [allocationTotal, setAllocationTotal] = useState(0);
  const [allocationBaki, setAllocationBaki] = useState(0);
  const [allocationCount, setAllocationCount] = useState(0);
  const [visitorCount, setVisitorCount] = useState(1420);
  const [isTitleActive, setIsTitleActive] = useState(false);
  const currentYear = new Date().getFullYear().toString();

  // Track and subscribe to real-time visitor count
  useEffect(() => {
    const unsubscribe = recordAndSubscribeVisitorCount((count) => {
      setVisitorCount(count);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Fetch counts for ads, attendance, and allocation codes
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // 1. Fetch active ads for current year
        const adsColl = collection(db, 'ads');
        const adsQuery = query(adsColl, where('status', '==', 'AKTIF'));
        const adsSnapshot = await getDocs(adsQuery);
        
        const activeAds = adsSnapshot.docs.filter(docSnap => {
          const data = docSnap.data();
          const adDate = data.visitDate || data.closingDate || data.createdAt;
          if (!adDate) return false;
          return new Date(adDate).getFullYear().toString() === currentYear;
        });

        setAdCount(activeAds.length);

        // 2. Fetch attendance for current year active ads
        const attendanceColl = collection(db, 'attendance');
        const attSnapshot = await getDocs(attendanceColl);
        const attendanceData = attSnapshot.docs.map(docSnap => docSnap.data());

        const activeAdIds = new Set(activeAds.map(ad => ad.id));
        const filteredAttendance = attendanceData.filter(record => 
          activeAdIds.has(record.adId)
        );

        setAttendanceCount(filteredAttendance.length);

        // 3. Fetch allocation codes for peruntukan summary
        if (isStaff) {
          try {
            const allocColl = collection(db, 'allocationCodes');
            const allocSnapshot = await getDocs(allocColl);
            let totalDiterima = 0;
            let totalBaki = 0;
            let count = allocSnapshot.docs.length;

            allocSnapshot.docs.forEach(docSnap => {
              const d = docSnap.data();
              const nkea = Number(d.nkeaKwr) || 0;
              const blk = Number(d.peruntukanBlk ?? d.approvedAmount) || 0;
              const diterima = Number(d.jumlahDiterima) || (nkea + blk);
              const pertanggungan = Number(d.pertanggunganBelumDijelaskan) || 0;
              const belanja = Number(d.jumlahPerbelanjaan) || 0;
              const baki = Number(d.bakiPeruntukan) ?? (diterima - pertanggungan - belanja);

              totalDiterima += diterima;
              totalBaki += baki;
            });

            setAllocationTotal(totalDiterima);
            setAllocationBaki(totalBaki);
            setAllocationCount(count);
          } catch (allocErr) {
            console.warn('Could not fetch allocation codes for hero stats:', allocErr);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'ads/attendance_counts');
      }
    };

    fetchCounts();
  }, [currentYear, isStaff]);

  const scrollToContent = () => {
    const element = document.getElementById('main-content');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navigateToAttendance = () => {
    window.history.pushState({}, '', '/rekod-kehadiran');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const navigateToAllocation = () => {
    window.history.pushState({}, '', '/kod-peruntukan');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const triggerRegistration = () => {
    window.dispatchEvent(new CustomEvent('triggerRegister'));
  };

  return (
    <section className="relative overflow-hidden group space-y-6">
      {/* Staff & Admin Compact Metric Boxes */}
      {isStaff && (
        <div className="pt-2 pb-4">
          {/* 4 Compact Stat Metric Boxes (Kemas, Padat & Seimbang) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {/* Box 1: Iklan Aktif Diterbitkan */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={scrollToContent}
              className="bg-risda-card border border-risda-border hover:border-risda-orange/60 rounded-2xl p-4 sm:p-4.5 shadow-xs hover:shadow-md transition-all duration-300 flex items-center justify-between group cursor-pointer"
              title="Klik untuk lihat senarai iklan aktif"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 bg-risda-orange/10 rounded-xl flex items-center justify-center border border-risda-orange/25 text-risda-orange shrink-0 group-hover:bg-risda-orange group-hover:text-white transition-all duration-300 shadow-2xs">
                  <Megaphone size={20} className="transition-transform group-hover:scale-110" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl sm:text-3xl font-black text-risda-text tabular-nums tracking-tight leading-none group-hover:text-risda-orange transition-colors">
                    {adCount}
                  </div>
                  <div className="text-[11px] font-black text-risda-muted uppercase tracking-wider mt-1 truncate">
                    Iklan Aktif Terbit
                  </div>
                  <div className="text-[10px] text-risda-muted/80 font-medium flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span>Tahun {currentYear} Dipantau</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={16} className="text-risda-muted/40 group-hover:text-risda-orange group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
            </motion.div>

            {/* Box 2: Hadir Lawat Tapak */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              onClick={navigateToAttendance}
              className="bg-risda-card border border-risda-border hover:border-blue-500/60 rounded-2xl p-4 sm:p-4.5 shadow-xs hover:shadow-md transition-all duration-300 flex items-center justify-between group cursor-pointer"
              title="Klik untuk buka rekod kehadiran lawat tapak"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/25 text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-2xs">
                  <Users size={20} className="transition-transform group-hover:scale-110" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl sm:text-3xl font-black text-risda-text tabular-nums tracking-tight leading-none group-hover:text-blue-600 transition-colors">
                    {attendanceCount}
                  </div>
                  <div className="text-[11px] font-black text-risda-muted uppercase tracking-wider mt-1 truncate">
                    Hadir Lawat Tapak
                  </div>
                  <div className="text-[10px] text-risda-muted/80 font-medium flex items-center gap-1 mt-0.5">
                    <CheckCircle2 size={11} className="text-blue-500" />
                    <span>Kontraktor Berdaftar</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={16} className="text-risda-muted/40 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
            </motion.div>

            {/* Box 3: Status Peruntukan */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={navigateToAllocation}
              className="bg-risda-card border border-risda-border hover:border-emerald-500/60 rounded-2xl p-4 sm:p-4.5 shadow-xs hover:shadow-md transition-all duration-300 flex items-center justify-between group cursor-pointer"
              title="Klik untuk urus dan semak buku kod peruntukan"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/25 text-emerald-600 shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-2xs">
                  <Coins size={20} className="transition-transform group-hover:scale-110" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl sm:text-3xl font-black text-risda-text tabular-nums tracking-tight leading-none group-hover:text-emerald-600 transition-colors truncate">
                    {formatRinggitCompact(allocationTotal)}
                  </div>
                  <div className="text-[11px] font-black text-risda-muted uppercase tracking-wider mt-1 truncate">
                    Peruntukan Dipantau
                  </div>
                  <div className="text-[10px] text-risda-muted/80 font-medium flex items-center gap-1 mt-0.5 truncate">
                    <TrendingUp size={11} className="text-emerald-500" />
                    <span>{allocationCount} Kod • Baki {formatRinggitCompact(allocationBaki)}</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={16} className="text-risda-muted/40 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
            </motion.div>

            {/* Box 4: Jumlah Pelawat Sistem */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-risda-card border border-risda-border hover:border-purple-500/60 rounded-2xl p-4 sm:p-4.5 shadow-xs hover:shadow-md transition-all duration-300 flex items-center justify-between group cursor-default"
              title="Jumlah pelawat portal yang direkodkan secara langsung"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/25 text-purple-600 shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300 shadow-2xs">
                  <Eye size={20} className="transition-transform group-hover:scale-110" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl sm:text-3xl font-black text-risda-text tabular-nums tracking-tight leading-none group-hover:text-purple-600 transition-colors">
                    {visitorCount.toLocaleString('en-MY')}
                  </div>
                  <div className="text-[11px] font-black text-risda-muted uppercase tracking-wider mt-1 truncate">
                    Jumlah Pelawat
                  </div>
                  <div className="text-[10px] text-risda-muted/80 font-medium flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                    <span>Trafik Pengunjung Langsung</span>
                  </div>
                </div>
              </div>
              <Activity size={16} className="text-purple-500/40 shrink-0 ml-1" />
            </motion.div>
          </div>
        </div>
      )}

      {/* Hero Content Section - ONLY Render if NOT staff */}
      {!isStaff && (
        <div className="relative py-12 lg:py-20 flex flex-col items-center text-center gap-10 lg:gap-14">
          {/* Dynamic Background Accents */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-risda-orange/10 blur-[150px] pointer-events-none group-hover:bg-risda-orange/15 transition-all duration-1000" />
          
          <div className="relative z-10 space-y-8 flex-1 flex flex-col items-center">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-3 px-6 py-2.5 bg-gradient-to-r from-risda-orange/20 via-risda-orange/10 to-transparent border border-risda-orange/20 rounded-full shadow-sm"
            >
              <div className="w-2 h-2 bg-risda-orange rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-risda-orange uppercase tracking-[4px]">
                Infrastruktur Digital RISDA
              </span>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-6 max-w-full w-full"
            >
              <div 
                onClick={() => setIsTitleActive(!isTitleActive)}
                className={`relative p-8 sm:p-12 md:p-20 overflow-hidden group/title max-w-full rounded-[48px] transition-all duration-700 cursor-pointer ${
                  isTitleActive 
                    ? 'bg-risda-card/40 border border-risda-border backdrop-blur-sm shadow-xl' 
                    : 'bg-transparent border border-transparent backdrop-blur-none shadow-none'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br from-risda-orange/10 to-transparent transition-opacity duration-700 ${isTitleActive ? 'opacity-100' : 'opacity-0'}`} />
                <h2 
                  className="text-4xl xs:text-6xl sm:text-7xl lg:text-[110px] font-bold text-risda-text tracking-tight relative z-10 break-words lg:!leading-[110px]"
                >
                  <span className="font-editorial-heading block text-4xl xs:text-5xl sm:text-6xl lg:text-8xl text-risda-orange">
                    Sistem Perolehan Digital
                  </span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-risda-orange via-risda-gold to-risda-accent bg-[length:200%_auto] animate-shimmer font-editorial-heading font-black text-3xl xs:text-4xl sm:text-6xl lg:text-7xl xl:text-8xl block mt-2 sm:mt-4">
                    SMART LOG PEROLEHAN
                  </span>
                </h2>
              </div>
              <p className="text-sm sm:text-base lg:text-lg text-risda-text-secondary font-medium max-w-2xl mx-auto leading-relaxed mt-4">
                Satu portal bersepadu untuk ketelusan, integriti, dan kecekapan pengurusan perolehan RISDA.
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-6 pt-6 w-full"
            >
              <button 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('triggerViewActiveAds'));
                }}
                className="group relative overflow-hidden px-8 py-5 rounded-2xl transition-all active:scale-95 text-risda-text border border-risda-border bg-risda-card hover:bg-risda-card-muted shadow-sm flex items-center justify-center gap-3 w-64 max-w-full text-center cursor-pointer font-bold uppercase tracking-[2px] text-xs"
              >
                <span className="relative z-10 flex items-center justify-center gap-2 font-black uppercase tracking-[2px] text-[10px] sm:text-xs">
                  LIHAT IKLAN AKTIF
                </span>
              </button>

              <button 
                onClick={() => {
                  triggerRegistration();
                }}
                className="group relative overflow-hidden px-8 py-5 rounded-2xl transition-all hover:scale-[1.02] active:scale-95 btn-gold shadow-md flex items-center justify-center gap-3 w-64 max-w-full text-center cursor-pointer"
              >
                <span className="relative z-10 flex items-center justify-center gap-2 font-black uppercase tracking-[2px] text-[10px] sm:text-xs text-white">
                  DAFTAR ONLINE
                  <ArrowRight size={16} className="group-hover:translate-x-1.5 transition-transform" />
                </span>
              </button>

              {/* Direct Scan QR Code Button on Hero */}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('triggerQRScanner'))}
                className="group relative overflow-hidden px-6 py-5 rounded-2xl transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-r from-amber-500 via-risda-orange to-yellow-500 hover:from-amber-600 hover:to-risda-orange text-slate-950 font-black shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2.5 w-64 max-w-full text-center cursor-pointer uppercase tracking-[2px] text-[10px] sm:text-xs border border-yellow-300"
              >
                <QrCode size={18} className="text-slate-950 stroke-[2.5] animate-pulse" />
                <span>SCAN QR IKLAN</span>
              </button>
            </motion.div>

            {/* Visitor counter indicator for public visitors as well */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-risda-card/60 backdrop-blur-xs border border-risda-border rounded-full text-xs text-risda-muted font-bold"
            >
              <Eye size={14} className="text-risda-orange" />
              <span>{visitorCount.toLocaleString('en-MY')} Pelawat Portal Telah Direkodkan</span>
            </motion.div>
          </div>
        </div>
      )}
    </section>
  );
}

