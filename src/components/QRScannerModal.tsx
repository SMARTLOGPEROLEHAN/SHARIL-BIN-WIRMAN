import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, RefreshCw, AlertCircle, CheckCircle, Flashlight, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess?: (detectedUrlOrAdId: string) => void;
}

export default function QRScannerModal({ isOpen, onClose, onScanSuccess }: QRScannerModalProps) {
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [torchOn, setTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scannedResult, setScannedResult] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const qrReaderId = 'html5-qr-code-scanner-element';

  // Play audio beep when QR is detected
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.document ? (window.AudioContext || (window as any).webkitAudioContext) : null;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6 tone
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio autoplay policy
    }
  };

  // Helper to extract adId from URL or raw text
  const parseAdId = (rawText: string): { adId: string | null; isExternalUrl: boolean } => {
    try {
      const trimmed = rawText.trim();
      // Check if URL
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const parsed = new URL(trimmed);
        const adId = parsed.searchParams.get('adId');
        if (adId) {
          return { adId, isExternalUrl: false };
        }
        return { adId: null, isExternalUrl: true };
      }
      // Or check if direct ID e.g. AD-12345 or starts with AD-
      if (trimmed.startsWith('AD-') || trimmed.startsWith('ad-')) {
        return { adId: trimmed, isExternalUrl: false };
      }
      return { adId: null, isExternalUrl: false };
    } catch {
      return { adId: null, isExternalUrl: false };
    }
  };

  // Start Scanner
  const startScanner = async (cameraId?: string) => {
    setCameraError(null);
    setScannedResult(null);

    try {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          await html5QrCodeRef.current.clear();
        } catch {
          // ignore
        }
        html5QrCodeRef.current = null;
      }

      // Check available cameras
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setCameraError('Tiada kamera dikesan pada peranti ini. Sila benarkan akses kamera dalam pelayar.');
        return;
      }

      setCameras(devices);
      // Prefer back camera if available, else first device
      const chosenCam = cameraId || devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment') || d.label.toLowerCase().includes('belakang'))?.id || devices[0].id;
      setSelectedCameraId(chosenCam);

      const html5QrCode = new Html5Qrcode(qrReaderId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        chosenCam,
        config,
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {
          // Frame scan error (no QR code in frame), suppress logging
        }
      );

      setScannerActive(true);
    } catch (err: any) {
      console.error('Kamera gagal dimulakan:', err);
      let errMsg = 'Gagal mengakses kamera.';
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission')) {
        errMsg = 'Akses kamera ditolak. Sila benarkan kebenaran kamera (Camera Permission) di pelayar anda.';
      } else if (err?.name === 'NotFoundError') {
        errMsg = 'Kamera tidak dijumpai pada peranti anda.';
      } else if (err?.message) {
        errMsg = `Ralat: ${err.message}`;
      }
      setCameraError(errMsg);
      setScannerActive(false);
    }
  };

  // Stop Scanner
  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Ralat henti kamera:', e);
      }
      html5QrCodeRef.current = null;
    }
    setScannerActive(false);
    setTorchOn(false);
  };

  // Toggle Torch/Flashlight if supported
  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !html5QrCodeRef.current.isScanning) return;
    try {
      // Html5Qrcode supports applyVideoConstraints
      const newTorch = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: newTorch } as any]
      });
      setTorchOn(newTorch);
    } catch (e) {
      toast.error('Lampu denyar (Flashlight) tidak disokong pada peranti ini.');
    }
  };

  // Handle Scan Hit
  const handleSuccessfulScan = async (text: string) => {
    playBeep();
    setScannedResult(text);

    // Stop scanning once detected
    await stopScanner();

    const { adId, isExternalUrl } = parseAdId(text);

    if (adId) {
      toast.success('Kod QR Iklan Berjaya Dikesan!');
      if (onScanSuccess) {
        onScanSuccess(adId);
      }
      // Navigate to adId directly
      const url = new URL(window.location.href);
      url.searchParams.set('adId', adId);
      window.history.pushState({}, '', url.pathname + url.search);
      window.dispatchEvent(new PopStateEvent('popstate'));
      onClose();
    } else if (isExternalUrl) {
      toast.success('Pautan Luar Dikesan');
      if (window.confirm(`Kod QR mengandungi pautan web: \n${text}\n\nBuka pautan ini sekarang?`)) {
        window.open(text, '_blank');
      }
      onClose();
    } else {
      toast(`Kod QR: ${text}`, { icon: 'ℹ️' });
      if (onScanSuccess) {
        onScanSuccess(text);
      }
      onClose();
    }
  };

  // Switch Camera
  const handleCameraChange = async (newCamId: string) => {
    setSelectedCameraId(newCamId);
    await stopScanner();
    setTimeout(() => {
      startScanner(newCamId);
    }, 200);
  };

  useEffect(() => {
    if (isOpen) {
      // Small timeout to allow DOM container to render
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md bg-risda-card border-2 border-risda-orange/60 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-risda-orange via-amber-600 to-yellow-600 p-4 sm:p-5 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                <Camera size={20} className="text-white" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-yellow-200 block">
                  PENGIMBAS PANTAS
                </span>
                <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-white leading-tight">
                  SCAN KOD QR IKLAN
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Tutup Pengimbas"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scanner Viewport Container */}
          <div className="p-4 sm:p-6 flex flex-col items-center justify-center space-y-4">
            <div className="relative w-full aspect-square max-w-[320px] bg-black rounded-2xl overflow-hidden border-2 border-dashed border-risda-orange/60 flex items-center justify-center shadow-inner">
              <div id={qrReaderId} className="w-full h-full object-cover" />

              {/* Scanning visual overlay & crosshairs */}
              {scannerActive && !cameraError && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  {/* Glowing Laser Scan Bar */}
                  <div className="w-4/5 h-0.5 bg-red-500 shadow-[0_0_15px_#ef4444] animate-pulse relative">
                    <div className="absolute inset-0 bg-yellow-400 opacity-75 blur-xs" />
                  </div>

                  {/* Corner Targets */}
                  <div className="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-risda-orange rounded-tl" />
                  <div className="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-risda-orange rounded-tr" />
                  <div className="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-risda-orange rounded-bl" />
                  <div className="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-risda-orange rounded-br" />
                </div>
              )}

              {/* Error Placeholder */}
              {cameraError && (
                <div className="absolute inset-0 p-6 bg-slate-900/95 flex flex-col items-center justify-center text-center space-y-3 z-10">
                  <AlertCircle size={36} className="text-red-400 animate-bounce" />
                  <p className="text-xs text-red-200 font-bold leading-relaxed">{cameraError}</p>
                  <button
                    onClick={() => startScanner(selectedCameraId)}
                    className="px-4 py-2 bg-risda-orange text-white text-xs font-black uppercase rounded-xl hover:bg-amber-600 transition-all flex items-center gap-2"
                  >
                    <RefreshCw size={14} /> Cuba Lagi
                  </button>
                </div>
              )}
            </div>

            {/* Instruction Text */}
            <p className="text-[11px] text-risda-muted font-bold text-center tracking-wide uppercase max-w-xs">
              Halakan kamera ke arah Kod QR Iklan Sebut Harga RISDA untuk terus membuka maklumat & borang pendaftaran tapak secara langsung.
            </p>

            {/* Controls Bar: Switch Camera, Torch, Sound */}
            <div className="w-full flex items-center justify-between gap-2 pt-2 border-t border-risda-border">
              {/* Camera Selector */}
              {cameras.length > 1 ? (
                <select
                  value={selectedCameraId}
                  onChange={(e) => handleCameraChange(e.target.value)}
                  className="text-[11px] font-bold bg-risda-card-muted border border-risda-border text-risda-text rounded-xl px-2.5 py-2 outline-none max-w-[150px] truncate"
                >
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `Kamera ${c.id.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[10px] text-risda-muted font-bold uppercase">
                  {scannerActive ? '● Kamera Aktif' : 'Memuatkan Kamera...'}
                </span>
              )}

              <div className="flex items-center gap-2">
                {/* Torch Toggle */}
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                    torchOn
                      ? 'bg-yellow-500 text-slate-950 border-yellow-400 shadow-md'
                      : 'bg-risda-card-muted text-risda-muted border-risda-border hover:text-risda-text'
                  }`}
                  title="Buka / Tutup Flash"
                >
                  <Flashlight size={16} />
                </button>

                {/* Sound Toggle */}
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                    soundEnabled
                      ? 'bg-risda-card-muted text-risda-orange border-risda-border'
                      : 'bg-risda-card-muted text-risda-muted border-risda-border'
                  }`}
                  title="Bunyi Bip Imbasan"
                >
                  {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>

                {/* Refresh/Restart */}
                <button
                  type="button"
                  onClick={() => startScanner(selectedCameraId)}
                  className="p-2 rounded-xl bg-risda-card-muted text-risda-muted hover:text-risda-text border border-risda-border transition-all"
                  title="Muat Semula Kamera"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
