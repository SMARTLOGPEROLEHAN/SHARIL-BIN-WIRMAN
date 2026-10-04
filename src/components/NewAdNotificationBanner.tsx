import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Megaphone, Calendar, MapPin, ArrowRight, X, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export interface NewAdNotificationItem {
  id: string;
  adId: string;
  adTitle: string;
  tenderNo: string;
  category?: string;
  office?: string;
  closingDate?: string;
  closingTime?: string;
  briefingDate?: string;
  briefingVenue?: string;
  timestamp?: string;
  createdAt?: any;
}

// Pleasant chime for new ad announcement
function playNewAdChime() {
  try {
    const AudioCtx = window.document ? (window.AudioContext || (window as any).webkitAudioContext) : null;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    // Tones: C5 (523Hz), E5 (659Hz), G5 (784Hz) fanfare
    playTone(523.25, 0, 0.2);
    playTone(659.25, 0.15, 0.25);
    playTone(783.99, 0.32, 0.5);
  } catch {
    // Ignore audio policy errors
  }
}

// Web Notification API (Browser Push Notification)
function sendBrowserNotification(ad: NewAdNotificationItem) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    if (Notification.permission === 'granted') {
      new Notification(`IKLAN SEBUTHARGA BAHARU: ${ad.tenderNo}`, {
        body: `${ad.adTitle}\nPejabat: ${ad.office || 'RISDA'}\nTarikh Tutup: ${ad.closingDate || 'Sila semak'}`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: `new-ad-${ad.adId}`
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          new Notification(`IKLAN SEBUTHARGA BAHARU: ${ad.tenderNo}`, {
            body: `${ad.adTitle}\nPejabat: ${ad.office || 'RISDA'}`,
            icon: '/pwa-192x192.png'
          });
        }
      });
    }
  } catch (e) {
    console.warn('Browser notification error:', e);
  }
}

export default function NewAdNotificationBanner() {
  const [activeAd, setActiveAd] = useState<NewAdNotificationItem | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('risda_dismissed_ad_popups');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const isInitialLoad = useRef(true);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Ask for browser notification permission gently if supported
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        // We do not force it immediately, but on first user interaction or when banner shows
      }
    }

    const q = query(
      collection(db, 'notifications'),
      where('type', '==', 'NEW_AD_CREATED'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        isInitialLoad.current = false;
        return;
      }

      const docs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as NewAdNotificationItem[];

      if (isInitialLoad.current) {
        docs.forEach(d => seenIdsRef.current.add(d.id));
        isInitialLoad.current = false;
        return;
      }

      for (const item of docs) {
        if (!seenIdsRef.current.has(item.id) && !dismissedIds.has(item.id)) {
          seenIdsRef.current.add(item.id);
          setActiveAd(item);
          playNewAdChime();
          sendBrowserNotification(item);

          toast.custom((t) => (
            <div 
              onClick={() => handleViewAd(item)}
              className={`${t.visible ? 'animate-enter' : 'animate-leave'} cursor-pointer bg-gradient-to-r from-risda-orange to-amber-600 text-white font-black px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-yellow-400 text-xs uppercase tracking-wider`}
            >
              <Megaphone className="animate-bounce shrink-0 text-yellow-300" size={20} />
              <div>
                <p className="font-extrabold text-yellow-200">IKLAN SEBUTHARGA BAHARU DITERBITKAN!</p>
                <p className="text-[10px] opacity-90 truncate max-w-[280px]">{item.tenderNo} - {item.adTitle}</p>
              </div>
            </div>
          ), { duration: 6000 });

          break; // Show one at a time
        }
      }
    }, (error) => {
      console.warn('Error listening to new ad notifications:', error);
    });

    return () => unsubscribe();
  }, [dismissedIds]);

  const handleDismiss = (id: string) => {
    const next = new Set(dismissedIds);
    next.add(id);
    setDismissedIds(next);
    try {
      localStorage.setItem('risda_dismissed_ad_popups', JSON.stringify(Array.from(next)));
    } catch (e) {
      console.error(e);
    }
    setActiveAd(null);
  };

  const handleViewAd = (item: NewAdNotificationItem) => {
    handleDismiss(item.id);
    const url = new URL(window.location.href);
    url.searchParams.set('adId', item.adId);
    window.history.pushState({}, '', url.pathname + url.search);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  if (!activeAd) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-risda-card border-2 border-risda-orange rounded-3xl shadow-[0_20px_70px_rgba(244,180,26,0.35)] overflow-hidden"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-risda-orange via-amber-500 to-yellow-500 p-4 sm:p-5 text-slate-950 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-slate-950 text-amber-400 rounded-2xl flex items-center justify-center shadow-lg border border-amber-400/40">
                <Megaphone size={22} className="animate-bounce" />
              </div>
              <div>
                <span className="bg-slate-950/20 text-slate-950 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest block w-fit mb-0.5 border border-slate-950/30">
                  Notifikasi Iklan Baharu
                </span>
                <h3 className="text-sm sm:text-base font-black uppercase tracking-tight leading-tight text-slate-950">
                  IKLAN SEBUTHARGA TELAH DITERBITKAN
                </h3>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(activeAd.id)}
              className="p-2 rounded-xl bg-slate-950/15 hover:bg-slate-950/25 text-slate-950 transition-colors"
              title="Tutup pemberitahuan"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="bg-risda-card-muted/70 border border-risda-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-risda-border pb-2.5">
                <span className="px-2.5 py-1 bg-risda-orange/15 text-risda-orange border border-risda-orange/30 rounded-lg text-[10px] font-black uppercase tracking-wider">
                  {activeAd.category || 'KERJA'}
                </span>
                <span className="text-xs font-black text-risda-gold uppercase tracking-wider">
                  {activeAd.tenderNo}
                </span>
              </div>

              <div>
                <p className="text-[10px] text-risda-muted font-bold uppercase tracking-wider mb-1">Tajuk Projek / Sebut Harga</p>
                <p className="text-sm font-black text-risda-text uppercase leading-snug">
                  {activeAd.adTitle}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-risda-border text-xs">
                {activeAd.office && (
                  <div className="flex items-center gap-2 text-risda-muted">
                    <MapPin size={14} className="text-risda-orange shrink-0" />
                    <span className="font-bold text-[11px] truncate uppercase">{activeAd.office}</span>
                  </div>
                )}
                {activeAd.closingDate && (
                  <div className="flex items-center gap-2 text-risda-muted">
                    <Calendar size={14} className="text-rose-500 shrink-0" />
                    <span className="font-bold text-[11px]">Tutup: {activeAd.closingDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleViewAd(activeAd)}
                className="w-full bg-gradient-to-r from-risda-orange to-amber-600 hover:from-amber-500 hover:to-risda-orange text-white font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-risda-orange/20 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                <ExternalLink size={16} />
                <span>Lihat Iklan & Daftar</span>
              </button>

              <button
                type="button"
                onClick={() => handleDismiss(activeAd.id)}
                className="w-full bg-risda-card-muted hover:bg-risda-border text-risda-text font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider border border-risda-border transition-all cursor-pointer"
              >
                <span>Tutup Notifikasi</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
