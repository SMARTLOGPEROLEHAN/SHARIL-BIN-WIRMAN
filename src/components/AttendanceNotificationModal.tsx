import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { BellRing, CheckCircle, ExternalLink, X, Building2, User, FileText, Hash, Calendar, ShieldCheck, MapPin, Phone } from 'lucide-react';
import toast from 'react-hot-toast';

export interface AttendanceNotificationItem {
  id: string;
  companyName: string;
  ownerName: string;
  icNumber?: string;
  phoneNumber?: string;
  email?: string;
  adTitle: string;
  tenderNo?: string;
  docSeriesNo?: string;
  office?: string;
  timestamp?: string;
  createdAt?: any;
}

// Helper to normalize office string for matching
export function normalizeOffice(offStr?: string | null): string {
  if (!offStr) return '';
  return offStr
    .toUpperCase()
    .trim()
    .replace(/^PEJABAT\s+RISDA\s+DAERAH\s+/i, '')
    .replace(/^PEJABAT\s+RISDA\s+/i, '')
    .replace(/^PRD\s+/i, '')
    .replace(/^DAERAH\s+/i, '')
    .trim();
}

export function isOfficeMatch(staffOffice?: string | null, adOffice?: string | null): boolean {
  if (!staffOffice || staffOffice.trim() === '' || staffOffice.toUpperCase() === 'ALL' || staffOffice.toUpperCase() === 'SEMUA') {
    return true;
  }
  if (!adOffice || adOffice.trim() === '') {
    return false;
  }
  
  const normStaff = normalizeOffice(staffOffice);
  const normAd = normalizeOffice(adOffice);
  
  if (!normStaff) return true;
  if (!normAd) return false;
  
  return (
    normStaff === normAd ||
    normStaff.includes(normAd) ||
    normAd.includes(normStaff) ||
    staffOffice.toUpperCase().trim() === adOffice.toUpperCase().trim()
  );
}

// Web Audio API synthesizer for pleasant dual-tone notification chime
function playNotificationChime() {
  try {
    const AudioCtx = window.document ? (window.AudioContext || (window as any).webkitAudioContext) : null;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    // Chime: E5 (659Hz) then A5 (880Hz)
    playTone(659.25, 0, 0.25);
    playTone(880.00, 0.18, 0.45);
  } catch (e) {
    // Ignore audio autoplay policies if user hasn't interacted
  }
}

export default function AttendanceNotificationModal() {
  const { user, role, office: userOffice } = useAuth();
  const isAdmin = role === 'admin' || role === 'pentadbir';
  const isStaff = Boolean(user && (isAdmin || role === 'penginput' || role === 'pelulus' || role !== 'pelawat'));

  const [activePopup, setActivePopup] = useState<AttendanceNotificationItem | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('risda_dismissed_attendance_popups');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const isInitialLoad = useRef(true);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isStaff) return;

    // Listen to latest attendance submission notifications added to Firestore
    const q = query(
      collection(db, 'notifications'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        isInitialLoad.current = false;
        return;
      }

      const docs = snapshot.docs
        .map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }))
        .filter((d: any) => d.type === 'ATTENDANCE_SUBMITTED') as AttendanceNotificationItem[];

      if (isInitialLoad.current) {
        // Mark all existing doc IDs as seen on initial component mount
        docs.forEach(d => seenIdsRef.current.add(d.id));
        isInitialLoad.current = false;
        return;
      }

      // Check if there are newly added attendance notifications that haven't been dismissed or seen
      for (const item of docs) {
        if (!seenIdsRef.current.has(item.id) && !dismissedIds.has(item.id)) {
          seenIdsRef.current.add(item.id);
          
          // STRICT OFFICE FILTER: Trigger pop-up if admin or contractor registered for an ad in staff's office
          if (isAdmin || isOfficeMatch(userOffice, item.office)) {
            setActivePopup(item);
            playNotificationChime();
            toast.custom((t) => (
              <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-amber-500 text-slate-950 font-black px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-amber-400 text-xs uppercase tracking-wider`}>
                <BellRing className="animate-bounce shrink-0" size={18} />
                <div>
                  <p className="font-extrabold">{item.companyName}</p>
                  <p className="text-[10px] opacity-80 font-medium">Selesai mengisi kehadiran lawatan tapak ({item.office || 'PEJABAT DAERAH'})</p>
                </div>
              </div>
            ), { duration: 5000 });
            break; // Show one popup at a time
          }
        }
      }
    }, (error) => {
      console.warn("Error listening to attendance notifications:", error);
    });

    return () => unsubscribe();
  }, [isStaff, isAdmin, userOffice, dismissedIds]);

  const handleDismiss = (id: string) => {
    const next = new Set(dismissedIds);
    next.add(id);
    setDismissedIds(next);
    try {
      localStorage.setItem('risda_dismissed_attendance_popups', JSON.stringify(Array.from(next)));
    } catch (e) {
      console.error(e);
    }
    setActivePopup(null);
  };

  const handleNavigateToRecords = (id: string) => {
    handleDismiss(id);
    window.history.pushState({}, '', '/rekod-kehadiran');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  if (!isStaff || !activePopup) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
          className="relative w-full max-w-lg bg-risda-card border-2 border-amber-500/50 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.25)] overflow-hidden"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 p-5 text-slate-950 relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-950 text-amber-400 rounded-2xl flex items-center justify-center shadow-lg border border-amber-400/30">
                <BellRing size={24} className="animate-bounce" />
              </div>
              <div>
                <span className="bg-slate-950/20 text-slate-950 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest block w-fit mb-0.5 border border-slate-950/30">
                  Notifikasi Sistem Terkini
                </span>
                <h3 className="text-base font-black uppercase tracking-tight leading-tight">
                  PEMBERITAHUAN KEHADIRAN LAWATAN TAPAK
                </h3>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(activePopup.id)}
              className="p-2 rounded-xl bg-slate-950/10 hover:bg-slate-950/20 text-slate-950 transition-colors"
              title="Tutup pemberitahuan"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5">
            {/* Status Alert Badge */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center gap-3 text-emerald-400">
              <CheckCircle size={22} className="shrink-0 animate-pulse" />
              <div className="text-xs">
                <span className="font-black uppercase tracking-wider block">Kontraktor telah selesai mengisi borang pendaftaran</span>
                <span className="text-[10px] opacity-80 font-medium">Rekod kehadiran baharu telah direkodkan dalam pangkalan data RISDA.</span>
              </div>
            </div>

            {/* Contractor Details Box */}
            <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-start gap-3 border-b border-white/10 pb-3">
                <Building2 size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-risda-muted font-bold uppercase tracking-widest">Nama Syarikat / Kontraktor</p>
                  <p className="text-sm font-black text-white uppercase tracking-wide leading-snug">
                    {activePopup.companyName}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="flex items-center gap-2.5">
                  <User size={16} className="text-blue-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-risda-muted font-bold uppercase tracking-wider">Penama / Pemilik</p>
                    <p className="text-xs font-extrabold text-slate-100 uppercase">{activePopup.ownerName}</p>
                  </div>
                </div>

                {activePopup.phoneNumber && (
                  <div className="flex items-center gap-2.5">
                    <Phone size={16} className="text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-[9px] text-risda-muted font-bold uppercase tracking-wider">No. Telefon</p>
                      <p className="text-xs font-extrabold text-slate-100">{activePopup.phoneNumber}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tender Title */}
              <div className="flex items-start gap-3 pt-2 border-t border-white/5">
                <FileText size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[9px] text-risda-muted font-bold uppercase tracking-widest">Tajuk Sebutharga / Projek</p>
                  <p className="text-xs font-black text-slate-200 uppercase line-clamp-2 leading-relaxed">
                    {activePopup.adTitle}
                  </p>
                </div>
              </div>

              {/* Extra Metadata */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px]">
                {activePopup.docSeriesNo && (
                  <div className="flex items-center gap-1.5 text-amber-400 font-black">
                    <Hash size={13} />
                    <span>No. Siri: #{activePopup.docSeriesNo}</span>
                  </div>
                )}

                {activePopup.office && (
                  <div className="flex items-center gap-1 text-risda-muted font-bold uppercase">
                    <MapPin size={13} />
                    <span>{activePopup.office}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleNavigateToRecords(activePopup.id)}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all transform hover:-translate-y-0.5"
              >
                <ExternalLink size={16} />
                <span>Lihat Rekod Kehadiran</span>
              </button>

              <button
                onClick={() => handleDismiss(activePopup.id)}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider border border-white/10 transition-all"
              >
                <ShieldCheck size={16} />
                <span>Tutup & Maklumkan</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
