import { ArrowRight, FileText, Megaphone, Users } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function Hero() {
  const { role } = useAuth();
  const isStaff = role === 'penginput' || role === 'pelulus' || role === 'admin' || role === 'pentadbir';
  const [adCount, setAdCount] = useState(0);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [isTitleActive, setIsTitleActive] = useState(false);
  const [isLihatActive, setIsLihatActive] = useState(false);
  const [isDaftarActive, setIsDaftarActive] = useState(false);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const currentYear = new Date().getFullYear().toString();
        
        // Fetch active ads for current year
        const adsColl = collection(db, 'ads');
        const adsQuery = query(adsColl, where('status', '==', 'AKTIF'));
        const adsSnapshot = await getDocs(adsQuery);
        
        const activeAds = adsSnapshot.docs.filter(doc => {
          const data = doc.data();
          const adDate = data.visitDate || data.closingDate || data.createdAt;
          if (!adDate) return false;
          return new Date(adDate).getFullYear().toString() === currentYear;
        });

        setAdCount(activeAds.length);

        // Fetch attendance for current year
        const attendanceColl = collection(db, 'attendance');
        const attSnapshot = await getDocs(attendanceColl);
        const attendanceData = attSnapshot.docs.map(doc => doc.data());

        // Count attendance belonging ONLY to active ads of current year
        const activeAdIds = new Set(activeAds.map(ad => ad.id));
        const filteredAttendance = attendanceData.filter(record => 
          activeAdIds.has(record.adId)
        );

        setAttendanceCount(filteredAttendance.length);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'ads/attendance_counts');
      }
    };
    fetchCounts();
  }, []);

  const scrollToContent = () => {
    const element = document.getElementById('main-content');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const triggerRegistration = () => {
    window.dispatchEvent(new CustomEvent('triggerRegister'));
  };

  return (
    <section className="relative overflow-hidden group space-y-12">
      {/* Dynamic Floating Stats - NOW OUTSIDE */}
      {isStaff && (
        <div className="flex flex-wrap items-center justify-center gap-12 px-2 py-8 border-b border-white/10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-6 group cursor-default"
          >
            <div className="w-16 h-16 bg-risda-orange/10 rounded-2xl flex items-center justify-center border border-risda-orange/20 shadow-[0_0_15px_rgba(255,176,0,0.1)] group-hover:bg-risda-orange group-hover:text-black transition-all duration-500">
              <Megaphone size={24} className="group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-left">
              <div className="text-4xl font-black text-white tabular-nums tracking-tighter leading-none group-hover:text-risda-orange transition-colors">{adCount}</div>
              <div className="text-[10px] font-black text-risda-muted uppercase tracking-[3px] mt-1.5 opacity-60">Iklan Aktif Terbit</div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-6 group cursor-default"
          >
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)] group-hover:bg-blue-500 group-hover:text-white transition-all duration-500">
              <Users size={24} className="group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-left">
              <div className="text-4xl font-black text-white tabular-nums tracking-tighter leading-none group-hover:text-blue-400 transition-colors">{attendanceCount}</div>
              <div className="text-[10px] font-black text-risda-muted uppercase tracking-[3px] mt-1.5 opacity-60">Hadir Lawat Tapak</div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="relative py-12 lg:py-20 flex flex-col items-center text-center gap-10 lg:gap-14">
        {/* Dynamic Background Accents */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-risda-orange/10 blur-[150px] pointer-events-none group-hover:bg-risda-orange/15 transition-all duration-1000" />
        
        <div className="relative z-10 space-y-8 flex-1 flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-3 px-6 py-2.5 bg-gradient-to-r from-risda-orange/20 via-risda-orange/10 to-transparent border border-risda-orange/20 rounded-full shadow-lg"
          >
            <div className="w-2 h-2 bg-risda-orange rounded-full animate-pulse shadow-[0_0_12px_rgba(0,229,255,1)]" />
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
                  ? 'bg-white/[0.04] border border-white/10 backdrop-blur-sm shadow-2xl' 
                  : 'bg-transparent border border-transparent backdrop-blur-none shadow-none'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br from-risda-orange/10 to-transparent transition-opacity duration-700 ${isTitleActive ? 'opacity-100' : 'opacity-0'}`} />
              <h2 
                className="text-4xl xs:text-6xl sm:text-7xl lg:text-[140px] font-black text-white tracking-tighter uppercase italic drop-shadow-2xl relative z-10 break-words lg:!leading-[120px]"
              >
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-risda-orange via-risda-gold to-risda-orange bg-[length:200%_auto] animate-shimmer italic text-xl xs:text-3xl sm:text-5xl lg:text-7xl xl:text-8xl block mt-2 sm:mt-6">
                  <span 
                    className="whitespace-normal lg:!leading-[1.1] font-poppins"
                  >
                    SMART LOG<br/>PEROLEHAN
                  </span>
                </span>
              </h2>
            </div>
            <p className="text-sm sm:text-base lg:text-xl text-white/50 font-bold uppercase tracking-[4px] mt-8 leading-relaxed">
              Satu portal bersepadu untuk ketelusan dan kecekapan pendaftaran tapak sebut harga RISDA.
            </p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-6 pt-6"
          >
            <button 
              onClick={() => {
                setIsLihatActive(true);
                setTimeout(() => setIsLihatActive(false), 2000);
                scrollToContent();
              }}
              className={`group relative overflow-hidden px-12 py-6 rounded-2xl transition-all active:scale-95 text-white border ${
                isLihatActive 
                  ? 'bg-white/10 border-white/20 shadow-xl' 
                  : 'bg-transparent border-transparent shadow-none'
              }`}
            >
              <span className="relative z-10 flex items-center gap-4 font-black uppercase tracking-[4px] text-xs">
                LIHAT IKLAN AKTIF
              </span>
            </button>

            <button 
              onClick={() => {
                setIsDaftarActive(true);
                setTimeout(() => setIsDaftarActive(false), 2000);
                triggerRegistration();
              }}
              className={`group relative overflow-hidden px-14 py-6 rounded-2xl transition-all active:scale-95 ${
                isDaftarActive 
                  ? 'btn-gold shadow-[0_30px_60px_rgba(0,176,255,0.4)]' 
                  : 'bg-transparent border border-transparent text-white'
              }`}
            >
              <div className={`absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ${isDaftarActive ? 'translate-y-0' : ''}`} />
              <span className="relative z-10 flex items-center gap-4 font-black uppercase tracking-[4px] text-xs">
                DAFTAR ONLINE
                <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
              </span>
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
