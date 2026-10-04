import React, { useState } from 'react';
import { Download, Smartphone, Monitor, Apple, CheckCircle, X, Sparkles, Share, PlusSquare, ArrowRight } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { motion, AnimatePresence } from 'motion/react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'hero' | 'floating' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  className = '', 
  variant = 'header' 
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isDesktop, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'pc' | 'android' | 'ios'>(
    isIOS ? 'ios' : isAndroid ? 'android' : 'pc'
  );

  // If already running as an installed standalone app, hide the button completely
  if (isInstalled) {
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  // Render based on variant
  return (
    <>
      {variant === 'header' && (
        <button
          onClick={handleAction}
          className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 bg-gradient-to-r from-risda-orange to-amber-500 hover:from-risda-orange/90 hover:to-amber-500/90 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 border border-amber-300/30 shrink-0 ${className}`}
          title="Pasang / Muat Turun Aplikasi di PC, Android, atau iPhone"
        >
          <Download size={15} className="stroke-[2.5] animate-bounce" />
          <span className="hidden sm:inline">PASANG APPS</span>
          <span className="sm:hidden">APPS</span>
        </button>
      )}

      {variant === 'hero' && (
        <button
          onClick={handleAction}
          className={`group relative overflow-hidden px-8 py-5 rounded-2xl transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-r from-risda-orange via-amber-500 to-risda-orange bg-[length:200%_auto] hover:bg-right shadow-lg hover:shadow-amber-500/25 flex items-center justify-center gap-3 w-64 max-w-full text-center cursor-pointer border border-amber-300/40 ${className}`}
        >
          <div className="flex items-center justify-center gap-2.5 font-black uppercase tracking-[2px] text-[11px] sm:text-xs text-white">
            <Download size={18} className="stroke-[2.5]" />
            <span>MUAT TURUN APPS</span>
            <Sparkles size={14} className="text-amber-200 animate-pulse" />
          </div>
        </button>
      )}

      {variant === 'banner' && (
        <div className={`pwa-install-banner w-full rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl border ${className}`}>
          <div className="flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 shadow-inner">
              <img src="/logo-etapak.png" alt="Smart Log" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="pwa-banner-title text-sm sm:text-base font-black text-white uppercase tracking-wider">
                  Aplikasi Rasmi SMART LOG
                </span>
                <span className="pwa-banner-badge px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                  Direct PWA
                </span>
              </div>
              <p className="pwa-banner-desc text-xs sm:text-sm font-medium mt-1 leading-relaxed">
                Pasang terus di PC Windows/Mac, Telefon Android atau iOS (iPhone/iPad) tanpa muat turun fail berat.
              </p>
            </div>
          </div>
          <button
            onClick={handleAction}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-risda-orange to-amber-500 hover:brightness-110 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 border border-amber-300/40 cursor-pointer"
          >
            <Download size={16} className="stroke-[2.5]" />
            <span>Pasang Sekarang</span>
          </button>
        </div>
      )}

      {/* Interactive Guide & Download Modal */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowGuideModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              className="pwa-guide-modal relative w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl z-10 overflow-hidden border"
            >
              {/* Top ambient glow */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-risda-orange/20 rounded-full blur-3xl pointer-events-none" />

              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-risda-orange to-amber-400 p-0.5 flex items-center justify-center shrink-0 shadow-lg">
                    <img src="/logo-etapak.png" alt="Smart Log" className="w-10 h-10 object-contain" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black tracking-tight uppercase text-white">
                      Pasang Aplikasi SMART LOG
                    </h3>
                    <p className="pwa-modal-subtitle text-xs font-semibold mt-0.5">
                      Akses pantas dan direct tanpa buka pelayar setiap kali
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGuideModal(false)}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/20 cursor-pointer"
                  title="Tutup"
                >
                  <X size={18} className="stroke-[2.5]" />
                </button>
              </div>

              {/* Direct Install CTA Button if Chromium Prompt is Ready */}
              {isInstallable && (
                <div className="pwa-cta-box my-5 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-md">
                  <div>
                    <div className="pwa-cta-title text-xs sm:text-sm font-black uppercase tracking-wide">
                      Peranti Anda Disokong Secara Direct!
                    </div>
                    <div className="pwa-cta-desc text-xs font-medium mt-0.5">
                      Klik butang untuk mula pemasangan segera ke peranti anda.
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await install();
                      setShowGuideModal(false);
                    }}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider shadow-md active:scale-95 transition-all shrink-0 cursor-pointer border border-amber-200"
                  >
                    Pasang Direct
                  </button>
                </div>
              )}

              {/* Platform Selector Tabs */}
              <div className="mt-5 grid grid-cols-3 gap-2 p-1.5 bg-black/40 border border-white/15 rounded-2xl">
                <button
                  onClick={() => setActiveTab('pc')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'pc'
                      ? 'bg-risda-orange text-white shadow-lg border border-amber-300/40'
                      : 'pwa-tab-inactive hover:bg-white/15 hover:text-white'
                  }`}
                >
                  <Monitor size={14} className="stroke-[2.5]" />
                  <span>PC / Laptop</span>
                </button>
                <button
                  onClick={() => setActiveTab('android')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'android'
                      ? 'bg-emerald-600 text-white shadow-lg border border-emerald-300/40'
                      : 'pwa-tab-inactive hover:bg-white/15 hover:text-white'
                  }`}
                >
                  <Smartphone size={14} className="stroke-[2.5]" />
                  <span>Android</span>
                </button>
                <button
                  onClick={() => setActiveTab('ios')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'ios'
                      ? 'bg-blue-600 text-white shadow-lg border border-blue-300/40'
                      : 'pwa-tab-inactive hover:bg-white/15 hover:text-white'
                  }`}
                >
                  <Apple size={14} className="stroke-[2.5]" />
                  <span>iPhone/iPad</span>
                </button>
              </div>

              {/* Instructions Content */}
              <div className="pwa-instructions-card mt-5 space-y-3.5 rounded-2xl p-4 sm:p-5">
                {activeTab === 'pc' && (
                  <div className="space-y-3.5 text-xs sm:text-[13px]">
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-xl bg-risda-orange border border-amber-300/40 flex items-center justify-center text-xs font-black text-white shrink-0 shadow-md">1</span>
                      <p className="pwa-instruction-step leading-relaxed pt-0.5">
                        Buka pautan sistem ini menggunakan <strong className="text-amber-300 font-bold">Google Chrome</strong>, <strong className="text-amber-300 font-bold">Microsoft Edge</strong>, atau pelayar moden di komputer anda.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-xl bg-risda-orange border border-amber-300/40 flex items-center justify-center text-xs font-black text-white shrink-0 shadow-md">2</span>
                      <p className="pwa-instruction-step leading-relaxed pt-0.5">
                        Klik ikon <strong className="text-amber-300 font-bold">Pasang (Install App)</strong> di sebelah kanan bar alamat URL atas (Address Bar) atau tekan butang <strong className="text-amber-300 font-bold">"PASANG APPS"</strong> di atas.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-xl bg-risda-orange border border-amber-300/40 flex items-center justify-center text-xs font-black text-white shrink-0 shadow-md">3</span>
                      <p className="pwa-instruction-step leading-relaxed pt-0.5">
                        Pilih <strong className="text-amber-300 font-bold">"Install / Pasang"</strong>. Aplikasi akan terus muncul di Desktop dan Taskbar PC anda seperti aplikasi perisian biasa!
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'android' && (
                  <div className="space-y-3.5 text-xs sm:text-[13px]">
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-xl bg-emerald-600 border border-emerald-300/40 flex items-center justify-center text-xs font-black text-white shrink-0 shadow-md">1</span>
                      <p className="pwa-instruction-step leading-relaxed pt-0.5">
                        Buka pautan sistem ini dalam <strong className="text-emerald-300 font-bold">Google Chrome</strong> di telefon Android anda.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-xl bg-emerald-600 border border-emerald-300/40 flex items-center justify-center text-xs font-black text-white shrink-0 shadow-md">2</span>
                      <p className="pwa-instruction-step leading-relaxed pt-0.5">
                        Tekan butang menu <strong className="text-emerald-300 font-bold">tiga titik (⋮)</strong> di sudut atas kanan pelayar Chrome.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-xl bg-emerald-600 border border-emerald-300/40 flex items-center justify-center text-xs font-black text-white shrink-0 shadow-md">3</span>
                      <p className="pwa-instruction-step leading-relaxed pt-0.5">
                        Pilih <strong className="text-emerald-300 font-bold">"Pasang aplikasi"</strong> atau <strong className="text-emerald-300 font-bold">"Add to Home Screen" (Tambah ke Skrin Utama)</strong>. Ikon rasmi SMART LOG akan dipasang terus di telefon anda.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'ios' && (
                  <div className="space-y-3.5 text-xs sm:text-[13px]">
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-xl bg-blue-600 border border-blue-300/40 flex items-center justify-center text-xs font-black text-white shrink-0 shadow-md">1</span>
                      <p className="pwa-instruction-step leading-relaxed pt-0.5">
                        Buka pautan sistem ini menggunakan pelayar <strong className="text-blue-300 font-bold">Safari</strong> di iPhone atau iPad anda.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-xl bg-blue-600 border border-blue-300/40 flex items-center justify-center text-xs font-black text-white shrink-0 shadow-md">2</span>
                      <div className="pwa-instruction-step leading-relaxed pt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>Tekan butang <strong className="text-blue-300 font-bold">Kongsi (Share)</strong></span>
                        <span className="inline-flex items-center justify-center p-1 rounded-md bg-blue-500/30 text-blue-300 border border-blue-400/40">
                          <Share size={14} className="stroke-[2.5]" />
                        </span>
                        <span>di bar navigasi Safari bawah.</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-xl bg-blue-600 border border-blue-300/40 flex items-center justify-center text-xs font-black text-white shrink-0 shadow-md">3</span>
                      <div className="pwa-instruction-step leading-relaxed pt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>Skrol ke bawah dan pilih <strong className="text-blue-300 font-bold">"Add to Home Screen" (Tambah ke Skrin Utama)</strong></span>
                        <span className="inline-flex items-center justify-center p-1 rounded-md bg-blue-500/30 text-blue-300 border border-blue-400/40">
                          <PlusSquare size={14} className="stroke-[2.5]" />
                        </span>
                        <span>kemudian tekan <strong className="text-blue-300 font-bold">Add</strong>.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Benefits list */}
              <div className="mt-5 grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-xs">
                <div className="pwa-benefit-item flex items-center gap-2 font-medium">
                  <CheckCircle size={15} className="text-emerald-400 shrink-0 stroke-[2.5]" />
                  <span>Akses 1-Klik Direct</span>
                </div>
                <div className="pwa-benefit-item flex items-center gap-2 font-medium">
                  <CheckCircle size={15} className="text-emerald-400 shrink-0 stroke-[2.5]" />
                  <span>Skrin Penuh (Tiada URL bar)</span>
                </div>
                <div className="pwa-benefit-item flex items-center gap-2 font-medium">
                  <CheckCircle size={15} className="text-emerald-400 shrink-0 stroke-[2.5]" />
                  <span>Sangat Ringan & Pantas</span>
                </div>
                <div className="pwa-benefit-item flex items-center gap-2 font-medium">
                  <CheckCircle size={15} className="text-emerald-400 shrink-0 stroke-[2.5]" />
                  <span>Kemas Kini Automatik</span>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={() => setShowGuideModal(false)}
                className="mt-6 w-full py-3.5 bg-white/15 hover:bg-white/25 active:scale-[0.99] text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all border border-white/25 cursor-pointer shadow-md"
              >
                Faham & Tutup
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
