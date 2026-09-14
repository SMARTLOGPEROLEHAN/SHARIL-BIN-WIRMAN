import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Camera, FlipHorizontal, Flashlight, Image as ImageIcon, 
  CheckCircle2, AlertCircle, ArrowRight, ExternalLink, RefreshCw, 
  FileText, Building2, Calendar, MapPin, Sparkles, Smartphone 
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import toast from 'react-hot-toast';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdFound?: (ad: any) => void;
}

export default function QRScannerModal({ isOpen, onClose, onAdFound }: QRScannerModalProps) {
  const [scannerState, setScannerState] = useState<'idle' | 'starting' | 'scanning' | 'found' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scannedRawText, setScannedRawText] = useState<string | null>(null);
  const [matchedAd, setMatchedAd] = useState<any | null>(null);
  const [searchingAd, setSearchingAd] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerId = 'risda-qr-reader-container';

  // Sound and haptic feedback on successful scan
  const triggerScanFeedback = () => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([40, 50, 40]);
      }
    } catch {
      // Ignore vibration error
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.13);
      }
    } catch {
      // Ignore audio error
    }
  };

  // Process scanned QR text to locate the advertisement in Firestore
  const processScannedResult = async (decodedText: string) => {
    triggerScanFeedback();
    setScannedRawText(decodedText);
    setScannerState('found');
    setSearchingAd(true);
    setErrorMessage(null);

    // Stop active camera feed
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.warn('Error stopping scanner camera:', e);
      }
    }

    try {
      let targetAdId: string | null = null;
      let targetQuotationNo: string | null = null;

      // Case A: URL with adId query parameter (e.g. https://...?adId=xyz)
      if (decodedText.includes('adId=')) {
        try {
          const url = new URL(decodedText.startsWith('http') ? decodedText : `https://example.com/${decodedText}`);
          targetAdId = url.searchParams.get('adId');
        } catch {
          const match = decodedText.match(/[?&]adId=([a-zA-Z0-9_-]+)/);
          if (match && match[1]) targetAdId = match[1];
        }
      }

      // Case B: Quotation number format (e.g. SH/...)
      if (!targetAdId && (decodedText.toUpperCase().startsWith('SH/') || decodedText.toUpperCase().includes('/202') || decodedText.toUpperCase().includes('BFT/'))) {
        targetQuotationNo = decodedText.trim();
      }

      // Case C: Raw Firestore Document ID (alphanumeric 15-30 chars)
      if (!targetAdId && !targetQuotationNo && /^[a-zA-Z0-9_-]{15,35}$/.test(decodedText.trim())) {
        targetAdId = decodedText.trim();
      }

      let adFound: any = null;

      // 1. Try finding by ID
      if (targetAdId) {
        try {
          const docSnap = await getDoc(doc(db, 'ads', targetAdId));
          if (docSnap.exists()) {
            adFound = { id: docSnap.id, ...docSnap.data() };
          }
        } catch (e) {
          console.warn('Error fetching ad by ID:', e);
        }
      }

      // 2. Try finding by quotationNo
      if (!adFound && (targetQuotationNo || decodedText)) {
        try {
          const term = (targetQuotationNo || decodedText).trim();
          const q = query(collection(db, 'ads'), where('quotationNo', '==', term));
          const snap = await getDocs(q);
          if (!snap.empty) {
            adFound = { id: snap.docs[0].id, ...snap.docs[0].data() };
          }
        } catch (e) {
          console.warn('Error fetching ad by quotationNo:', e);
        }
      }

      // 3. Fallback: Search all ads for substring match
      if (!adFound) {
        try {
          const snap = await getDocs(collection(db, 'ads'));
          const cleanText = decodedText.toLowerCase().trim();
          const match = snap.docs.find(d => {
            const data = d.data();
            const qNo = (data.quotationNo || '').toLowerCase();
            const title = (data.title || '').toLowerCase();
            return cleanText.includes(d.id.toLowerCase()) || 
                   (qNo && cleanText.includes(qNo)) || 
                   (qNo && qNo.includes(cleanText));
          });
          if (match) {
            adFound = { id: match.id, ...match.data() };
          }
        } catch (e) {
          console.warn('Error in fallback search:', e);
        }
      }

      if (adFound) {
        setMatchedAd(adFound);
        toast.success(`Iklan Sebut Harga Ditemui: ${adFound.quotationNo || adFound.title}`);
        if (onAdFound) {
          onAdFound(adFound);
        }
      } else {
        setMatchedAd(null);
      }
    } catch (err: any) {
      console.error('Failed to parse scan result:', err);
      setErrorMessage('Ralat memproses data QR: ' + (err.message || 'Sila cuba lagi'));
    } finally {
      setSearchingAd(false);
    }
  };

  // Start the scanner camera
  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setScannerState('starting');
    setErrorMessage(null);

    // Give DOM a tick to ensure reader container is rendered
    await new Promise(r => setTimeout(r, 100));

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      }

      // Ensure clean previous instance
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      await scannerRef.current.start(
        { facingMode: mode },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edgeSize = Math.floor(minEdge * 0.72);
            return { width: edgeSize, height: edgeSize };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          processScannedResult(decodedText);
        },
        () => {
          // ignore transient scan frame misses
        }
      );

      setScannerState('scanning');

      // Check if torch/flashlight is supported
      try {
        const capabilities = (scannerRef.current as any).getRunningTrackCapabilities?.();
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error('Camera startup error:', err);
      setScannerState('error');
      
      const errStr = String(err).toLowerCase();
      if (errStr.includes('permission') || errStr.includes('notallowed') || errStr.includes('denied')) {
        setErrorMessage('Kebenaran akses kamera ditolak. Sila benarkan akses kamera dalam tetapan pelayar anda (Safari / Chrome), atau gunakan pilihan "Muat Naik Gambar QR dari Galeri".');
      } else if (errStr.includes('notfound') || errStr.includes('device')) {
        setErrorMessage('Tiada peranti kamera dikesan pada telefon anda.');
      } else {
        setErrorMessage('Gagal membuka kamera: ' + (err.message || 'Sila semak kebenaran kamera atau muat naik foto QR.'));
      }
    }
  };

  // Stop camera helper
  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        console.warn('Error closing scanner:', e);
      }
      scannerRef.current = null;
    }
  };

  // Toggle Front / Back camera
  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    await stopCamera();
    startCamera(nextMode);
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await (scannerRef.current as any).applyVideoConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  // Scan from photo file
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScannerState('starting');
    setErrorMessage(null);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      }

      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      const decodedText = await scannerRef.current.scanFile(file, true);
      processScannedResult(decodedText);
    } catch (err: any) {
      console.error('File scan error:', err);
      setScannerState('error');
      setErrorMessage('Tiada Kod QR sah dikesan dalam gambar yang dimuat naik. Sila pastikan gambar QR jelas dan tidak kabur.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Reset and scan again
  const handleScanAgain = () => {
    setMatchedAd(null);
    setScannedRawText(null);
    setErrorMessage(null);
    startCamera();
  };

  // Action: Open the matched advertisement attendance form
  const handleOpenAttendance = () => {
    if (!matchedAd) return;
    onClose();
    // Update URL and notify listeners
    const url = new URL(window.location.href);
    url.searchParams.set('adId', matchedAd.id);
    window.history.pushState({}, '', url.pathname + url.search);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Handle open external link if scanned text is URL
  const handleOpenExternalUrl = () => {
    if (scannedRawText && scannedRawText.startsWith('http')) {
      window.open(scannedRawText, '_blank', 'noopener,noreferrer');
    }
  };

  // Trigger camera when modal opens
  useEffect(() => {
    if (isOpen) {
      setMatchedAd(null);
      setScannedRawText(null);
      setErrorMessage(null);
      startCamera('environment');
    } else {
      stopCamera();
      setScannerState('idle');
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className="relative w-full max-w-md bg-[#070d1e] border border-risda-border/80 rounded-[32px] shadow-2xl overflow-hidden text-risda-text flex flex-col my-auto"
          style={{ maxHeight: '92vh' }}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-risda-border flex items-center justify-between bg-gradient-to-r from-risda-orange/15 via-transparent to-transparent shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-risda-orange/20 border border-risda-orange/40 flex items-center justify-center text-risda-orange">
                <Camera size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-risda-text">
                  Pengimbas QR Iklan
                </h3>
                <p className="text-[10px] text-risda-muted font-bold uppercase tracking-wider">
                  Android & iOS • Sebut Harga RISDA
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-risda-muted hover:text-white flex items-center justify-center transition-colors border border-white/10"
              title="Tutup Pengimbas"
            >
              <X size={18} />
            </button>
          </div>

          {/* Main Content Body */}
          <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
            {/* Viewfinder Frame / Result Card */}
            {scannerState !== 'found' ? (
              <div className="space-y-4">
                {/* Camera Viewfinder Box */}
                <div className="relative w-full aspect-square bg-black/80 rounded-3xl overflow-hidden border-2 border-dashed border-risda-orange/40 flex items-center justify-center shadow-inner">
                  {/* html5-qrcode DOM Target */}
                  <div id={containerId} className="w-full h-full object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />

                  {/* Targeting Reticle Overlay (Animated Laser Frame) */}
                  {scannerState === 'scanning' && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      {/* Reticle corners */}
                      <div className="relative w-3/4 h-3/4 max-w-[260px] max-h-[260px]">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-risda-orange rounded-tl-xl shadow-lg" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-risda-orange rounded-tr-xl shadow-lg" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-risda-orange rounded-bl-xl shadow-lg" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-risda-orange rounded-br-xl shadow-lg" />
                        
                        {/* Scanning Laser Line */}
                        <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-risda-orange to-transparent animate-scan shadow-[0_0_12px_#ff9900]" />
                      </div>
                    </div>
                  )}

                  {/* Loading / Starting indicator */}
                  {scannerState === 'starting' && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center p-4 text-center space-y-3 z-10">
                      <RefreshCw size={36} className="text-risda-orange animate-spin" />
                      <p className="text-xs font-black uppercase tracking-wider text-risda-text">
                        Mengaktifkan Kamera Telefon...
                      </p>
                      <p className="text-[10px] text-risda-muted max-w-[240px]">
                        Sila benarkan akses kamera apabila diminta oleh telefon anda.
                      </p>
                    </div>
                  )}

                  {/* Error banner inside viewfinder */}
                  {scannerState === 'error' && (
                    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
                      <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
                        <AlertCircle size={24} />
                      </div>
                      <p className="text-xs font-black text-red-400 uppercase tracking-wider">
                        Kamera Tidak Dapat Dibuka
                      </p>
                      <p className="text-[11px] text-risda-muted leading-relaxed max-w-[280px]">
                        {errorMessage || 'Sila pastikan kebenaran kamera dibenarkan, atau imbas gambar kod QR dari galeri telefon.'}
                      </p>
                      <button
                        onClick={() => startCamera()}
                        className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-bold text-white uppercase tracking-wider border border-white/20 transition-all flex items-center gap-2 mt-2"
                      >
                        <RefreshCw size={14} />
                        Cuba Semula
                      </button>
                    </div>
                  )}
                </div>

                {/* Quick Camera Controls */}
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    onClick={toggleFacingMode}
                    className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-bold text-risda-text flex items-center gap-2 transition-all"
                    title="Tukar Kamera Depan / Belakang"
                  >
                    <FlipHorizontal size={16} className="text-risda-orange" />
                    <span>Tukar Kamera</span>
                  </button>

                  {hasTorch && (
                    <button
                      onClick={toggleTorch}
                      className={`p-3 border rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
                        torchOn 
                          ? 'bg-risda-orange text-white border-risda-orange' 
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-risda-text'
                      }`}
                      title="Lampu Kilat / Torch"
                    >
                      <Flashlight size={16} />
                      <span>Lampu {torchOn ? 'ON' : 'OFF'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-bold text-risda-text flex items-center gap-2 transition-all"
                    title="Imbas daripada fail imej"
                  >
                    <ImageIcon size={16} className="text-blue-400" />
                    <span>Pilih Gambar</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileScan}
                    className="hidden"
                  />
                </div>

                {/* Instructional Text */}
                <div className="p-3.5 bg-white/[0.03] border border-risda-border rounded-2xl text-center space-y-1.5">
                  <div className="flex items-center justify-center gap-1.5 text-risda-orange text-xs font-black uppercase tracking-wider">
                    <Sparkles size={14} />
                    <span>Cara Penggunaan</span>
                  </div>
                  <p className="text-[11px] text-risda-muted leading-relaxed">
                    Halakan lensa kamera telefon anda tepat ke kod QR pada iklan sebut harga atau dokumen sebut harga RISDA. Sistem akan mengesan dan membuka borang kehadiran secara automatik.
                  </p>
                </div>
              </div>
            ) : (
              /* RESULT VIEW: ADVERTISEMENT FOUND OR SCANNED CODE */
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {searchingAd ? (
                  <div className="p-8 text-center space-y-3 bg-white/[0.03] rounded-3xl border border-risda-border">
                    <RefreshCw size={32} className="text-risda-orange animate-spin mx-auto" />
                    <p className="text-xs font-black uppercase tracking-widest text-risda-text">
                      Mencari Iklan Sebut Harga...
                    </p>
                    <p className="text-[10px] text-risda-muted font-bold truncate">
                      {scannedRawText}
                    </p>
                  </div>
                ) : matchedAd ? (
                  <div className="bg-gradient-to-br from-risda-orange/15 via-white/[0.03] to-transparent border border-risda-orange/40 rounded-3xl p-5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/20 border border-green-500/40 rounded-full text-green-400 text-[10px] font-black uppercase tracking-wider">
                        <CheckCircle2 size={12} />
                        <span>Iklan Dikesan & Sepadan</span>
                      </div>
                      <span className="text-[10px] font-bold text-risda-muted uppercase">
                        {matchedAd.status || 'AKTIF'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono font-bold text-risda-orange tracking-wider block mb-1">
                        {matchedAd.quotationNo || 'SEBUT HARGA RISDA'}
                      </span>
                      <h4 className="text-sm font-black text-white leading-snug uppercase line-clamp-3">
                        {matchedAd.title}
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-white/10">
                      <div className="flex items-center gap-1.5 text-risda-muted">
                        <Building2 size={13} className="text-risda-orange shrink-0" />
                        <span className="truncate">{matchedAd.office || matchedAd.district || 'RISDA'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-risda-muted">
                        <Calendar size={13} className="text-blue-400 shrink-0" />
                        <span className="truncate">Tutup: {matchedAd.closingDate || '-'}</span>
                      </div>
                      {matchedAd.location && (
                        <div className="col-span-2 flex items-center gap-1.5 text-risda-muted">
                          <MapPin size={13} className="text-amber-400 shrink-0" />
                          <span className="truncate">{matchedAd.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Main CTA */}
                    <div className="space-y-2 pt-2">
                      <button
                        onClick={handleOpenAttendance}
                        className="w-full py-3.5 px-4 bg-gradient-to-r from-risda-orange to-risda-gold hover:opacity-95 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        <span>Buka Borang & Hadir Lawat Tapak</span>
                        <ArrowRight size={16} />
                      </button>

                      <button
                        onClick={handleScanAgain}
                        className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-risda-muted hover:text-white font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all border border-white/10 flex items-center justify-center gap-2"
                      >
                        <RefreshCw size={13} />
                        <span>Imbas Iklan Lain</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Ad not directly found in DB */
                  <div className="bg-white/[0.03] border border-risda-border rounded-3xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertCircle size={18} />
                      <h4 className="text-xs font-black uppercase tracking-wider">
                        Kod QR Dikesan (Tiada Rekod Langsung)
                      </h4>
                    </div>

                    <div className="p-3 bg-black/40 rounded-2xl border border-white/5 break-all text-[11px] font-mono text-risda-muted max-h-28 overflow-y-auto">
                      {scannedRawText}
                    </div>

                    <p className="text-[11px] text-risda-muted leading-relaxed">
                      Kod QR berjaya diimbas tetapi tidak sepadan dengan mana-mana ID iklan sebut harga semasa dalam sistem.
                    </p>

                    {scannedRawText && scannedRawText.startsWith('http') && (
                      <button
                        onClick={handleOpenExternalUrl}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow flex items-center justify-center gap-2"
                      >
                        <span>Buka Pautan Luar</span>
                        <ExternalLink size={14} />
                      </button>
                    )}

                    <button
                      onClick={handleScanAgain}
                      className="w-full py-3 px-4 bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={14} />
                      <span>Imbas Semula</span>
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Mobile PWA Tips */}
            <div className="pt-2 text-[10px] text-risda-muted/70 text-center flex items-center justify-center gap-1.5">
              <Smartphone size={12} />
              <span>Sesuai digunakan pada telefon Android (Chrome) & Apple iPhone (Safari)</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
