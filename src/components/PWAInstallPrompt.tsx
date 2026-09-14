import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, Download, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function PWAInstallPrompt() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleOpen = () => setShowIOSModal(true);
    window.addEventListener('openPWAPrompt', handleOpen);
    return () => window.removeEventListener('openPWAPrompt', handleOpen);
  }, []);

  // Listen to Escape key to close modal
  useEffect(() => {
    if (!showIOSModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowIOSModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showIOSModal]);

  // If already running as an installed standalone PWA, do not show button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowIOSModal(true);
    }
  };

  const modalContent = (
    <AnimatePresence>
      {showIOSModal && (
        <div 
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
          style={{ zIndex: 999999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowIOSModal(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 26, stiffness: 350 }}
            className="relative w-full max-w-md my-auto bg-[#071326] border-2 border-risda-orange/60 rounded-3xl p-5 sm:p-6 text-white flex flex-col max-h-[88vh] overflow-hidden shadow-2xl"
            style={{
              boxShadow: '0 25px 70px -10px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(244, 180, 26, 0.4)'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-risda-orange/30 to-amber-500/20 border border-risda-orange/50 flex items-center justify-center text-risda-orange shadow-inner shrink-0">
                  <Smartphone size={22} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                    Pasang Pada Telefon
                  </h3>
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                    Android & Apple iOS (iPhone / iPad)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                title="Tutup"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Body Content */}
            <div className="overflow-y-auto py-3 space-y-3.5 pr-1 text-slate-200 custom-scrollbar flex-1">
              {isIOS ? (
                /* iOS Safari Instructions */
                <div className="space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Ikuti 3 langkah mudah ini dalam pelayar <strong className="text-white">Safari</strong> pada iPhone / iPad anda:
                  </p>

                  <div className="space-y-2.5">
                    <div className="p-3 bg-white/[0.04] border border-white/10 rounded-2xl flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-sm">
                        1
                      </div>
                      <div className="text-xs leading-snug">
                        <span className="font-bold text-white block text-[13px]">Tekan butang Kongsi (Share)</span>
                        <p className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          Ikon petak berpanah atas (<Share size={13} className="inline text-blue-400" />) di bahagian bar bawah pelayar Safari.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-white/[0.04] border border-white/10 rounded-2xl flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-risda-orange/20 border border-risda-orange/40 text-risda-orange flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-sm">
                        2
                      </div>
                      <div className="text-xs leading-snug">
                        <span className="font-bold text-white block text-[13px]">Pilih "Add to Home Screen"</span>
                        <p className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          Skrol ke bawah menu dan tekan (<PlusSquare size={13} className="inline text-risda-orange" /> <em className="text-white not-italic font-semibold">Tambah ke Skrin Utama</em>).
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-white/[0.04] border border-white/10 rounded-2xl flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-sm">
                        3
                      </div>
                      <div className="text-xs leading-snug">
                        <span className="font-bold text-white block text-[13px]">Tekan "Tambah" (Add)</span>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Ikon <strong className="text-white">SmartLog RISDA</strong> akan dipasang pada skrin utama telefon anda untuk capaian pantas.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Android / General Instructions */
                <div className="space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Langkah memasang aplikasi pada telefon Android:
                  </p>

                  <div className="space-y-2.5">
                    <div className="p-3 bg-white/[0.04] border border-white/10 rounded-2xl flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-risda-orange/20 border border-risda-orange/40 text-risda-orange flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-sm">
                        1
                      </div>
                      <div className="text-xs leading-snug">
                        <span className="font-bold text-white block text-[13px]">Buka di Pelayar Google Chrome</span>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Pastikan laman web dibuka menggunakan pelayar Chrome pada telefon Android anda.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-white/[0.04] border border-white/10 rounded-2xl flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-sm">
                        2
                      </div>
                      <div className="text-xs leading-snug">
                        <span className="font-bold text-white block text-[13px]">Pilih "Pasang Aplikasi"</span>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Tekan menu 3 titik di atas kanan Chrome, kemudian tekan <strong className="text-amber-400">"Pasang aplikasi" (Install app)</strong> atau <strong className="text-amber-400">"Add to Home screen"</strong>.
                        </p>
                      </div>
                    </div>
                  </div>

                  {isInstallable && (
                    <button
                      onClick={async () => {
                        await install();
                        setShowIOSModal(false);
                      }}
                      className="w-full py-3 bg-gradient-to-r from-risda-orange to-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center justify-center gap-2 mt-2 active:scale-95 transition-transform cursor-pointer"
                    >
                      <Download size={16} />
                      <span>Pasang Sekarang Melalui Chrome</span>
                    </button>
                  )}
                </div>
              )}

              {/* Benefits Badge */}
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center gap-2.5 text-emerald-300 text-xs">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                <span className="leading-snug">Boleh terus imbas kod QR iklan sebut harga secara terus dari kamera telefon anda!</span>
              </div>
            </div>

            {/* Modal Footer / Close Button */}
            <div className="pt-2 border-t border-white/10 shrink-0">
              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md border border-white/10 active:scale-95 cursor-pointer"
              >
                Faham & Tutup
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* Header Button for Quick Mobile Installation */}
      <button
        onClick={handleInstallClick}
        className="relative group px-3 py-2 bg-gradient-to-r from-risda-orange/15 to-risda-gold/15 hover:from-risda-orange/25 hover:to-risda-gold/25 border border-risda-orange/40 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider text-risda-text transition-all shadow-sm active:scale-95 cursor-pointer"
        title="Pasang Aplikasi Telefon (Android & iOS)"
      >
        <Smartphone size={16} className="text-risda-orange animate-pulse" />
        <span className="hidden sm:inline">Pasang Apps</span>
        <span className="text-[9px] bg-risda-orange text-white px-1.5 py-0.5 rounded font-black tracking-tight">
          PWA
        </span>
      </button>

      {/* Portal modal directly into document.body to ensure it is centered on the entire window */}
      {mounted && typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null}
    </>
  );
}
