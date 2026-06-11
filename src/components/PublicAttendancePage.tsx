import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, addDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Upload, UserCheck, CheckCircle, AlertCircle, ArrowLeft, FileText, Landmark } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { optimizeImage } from '../lib/imageOptimizer';

interface PublicAttendancePageProps {
  adId: string;
  onBackToPortal?: () => void;
}

export default function PublicAttendancePage({ adId, onBackToPortal }: PublicAttendancePageProps) {
  const [ad, setAd] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form states matching the exact fields in the screenshot
  const [formData, setFormData] = useState({
    companyName: '',
    ownerName: '',
    companyAddress: '',
    icNumber: '',
    phoneNumber: '',
    email: '',
  });
  const [certificateFiles, setCertificateFiles] = useState<Record<string, File>>({});
  const [dragActiveStates, setDragActiveStates] = useState<Record<string, boolean>>({});
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittingSucceeded, setSubmittingSucceeded] = useState(false);
  const [registeredSeriesNo, setRegisteredSeriesNo] = useState<string>('');

  // Sijil Kelayakan Wajib list computed based on ad configuration
  const requiredLicenses = [];
  if (ad?.licenses?.cidbSpkk || ad?.licenses?.cidbPkk) {
    requiredLicenses.push({ key: 'cidb', label: 'Sijil CIDB' });
  }
  if (ad?.licenses?.stb) requiredLicenses.push({ key: 'stb', label: 'Sijil Taraf Bumiputera (STB)' });
  if (ad?.licenses?.mof) requiredLicenses.push({ key: 'mof', label: 'Kementerian Kewangan (MOF)' });
  if (ad?.licenses?.tcc) requiredLicenses.push({ key: 'tcc', label: 'Sijil Pelepasan Cukai (TCC)' });
  if (ad?.licenses?.pukonsa) requiredLicenses.push({ key: 'pukonsa', label: 'PUKONSA' });
  if (ad?.licenses?.kuhean) requiredLicenses.push({ key: 'kuhean', label: 'KUHEAN' });

  const hasSpecificLicenses = requiredLicenses.length > 0;
  const effectiveLicenses = hasSpecificLicenses 
    ? requiredLicenses 
    : [{ key: 'umum', label: 'Sijil Pendaftaran Syarikat / CIDB / Lain-Lain Sijil Kelayakan' }];

  useEffect(() => {
    const fetchAdDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const adDocRef = doc(db, 'ads', adId);
        const adDocSnap = await getDoc(adDocRef);
        
        if (adDocSnap.exists()) {
          setAd({ id: adDocSnap.id, ...adDocSnap.data() });
        } else {
          setError('Maklumat sebut harga tidak dijumpai di dalam sistem kami.');
        }
      } catch (err: any) {
        console.error('Error fetching public ad details:', err);
        setError('Gagal memuat turun butiran sebut harga. Sila cuba lagi.');
      } finally {
        setLoading(false);
      }
    };

    if (adId) {
      fetchAdDetails();
    }
  }, [adId]);

  // Form drag and drop handlers per key
  const handleDrag = (key: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveStates(prev => ({ ...prev, [key]: true }));
    } else if (e.type === "dragleave") {
      setDragActiveStates(prev => ({ ...prev, [key]: false }));
    }
  };

  const processAndSetFile = async (key: string, file: File) => {
    if (file.type.startsWith('image/')) {
      const compressToastId = toast.loading('Mengoptimumkan saiz imej...');
      try {
        const optimized = await optimizeImage(file);
        toast.dismiss(compressToastId);
        
        if (optimized.size > 5 * 1024 * 1024) {
          toast.error('Gagal mengoptimumkan: Imej melebihi had saiz 5MB.');
          return;
        }
        
        setCertificateFiles(prev => ({ ...prev, [key]: optimized }));
        toast.success(`Imej berjaya dioptimumkan! Saiz sekarang: ${(optimized.size / 1024 / 1024).toFixed(2)} MB`);
      } catch (optimizeErr) {
        toast.dismiss(compressToastId);
        console.error('Resize error:', optimizeErr);
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Gagal: Fail imej melebihi had saiz 5MB.');
          return;
        }
        setCertificateFiles(prev => ({ ...prev, [key]: file }));
      }
    } else {
      // PDF or other non-image format
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Gagal: Fail melebihi had saiz 5MB.');
        return;
      }
      setCertificateFiles(prev => ({ ...prev, [key]: file }));
    }
  };

  const handleDrop = async (key: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveStates(prev => ({ ...prev, [key]: false }));

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processAndSetFile(key, e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processAndSetFile(key, e.target.files[0]);
    }
  };

  const formatBeautifulDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = [
        'JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN',
        'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'
      ];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) {
      return dateStr;
    }
  };

  const indonesianDayName = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const days = ['AHAD', 'ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT', 'SABTU'];
      return days[d.getDay()];
    } catch (e) {
      return '';
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    const path = `attendance`;

    try {
      const normalizedCompanyName = formData.companyName.toUpperCase().trim();
      const adTitle = ad?.title || '';

      // Check for existing registration with same company name and project title
      const q = query(
        collection(db, path), 
        where('companyName', '==', normalizedCompanyName),
        where('adTitle', '==', adTitle)
      );
      const existingSnap = await getDocs(q);
      
      if (!existingSnap.empty) {
        setFormError('Syarikat anda telah pun berdaftar untuk sebut harga ini. Pendaftaran berganda tidak dibenarkan.');
        setFormLoading(false);
        return;
      }

      // Generate docSeriesNo for this specific project title sequentially
      const countQuery = query(collection(db, path), where('adTitle', '==', adTitle));
      const snap = await getDocs(countQuery);
      const nextNo = (snap.size + 1).toString().padStart(3, '0');

      // Format nama fail untuk disimpan
      const uploadedCertificateMap = effectiveLicenses.reduce((acc, lic) => {
        acc[lic.key] = certificateFiles[lic.key]?.name || '';
        return acc;
      }, {} as Record<string, string>);

      const hasUploadedAny = Object.keys(certificateFiles).length > 0;
      const certificateNamesList = effectiveLicenses
        .filter(lic => !!certificateFiles[lic.key])
        .map(lic => `${lic.label}: ${certificateFiles[lic.key].name}`)
        .join(', ');

      const submissionData = {
        companyName: normalizedCompanyName,
        ownerName: formData.ownerName.trim(),
        companyAddress: formData.companyAddress.trim(),
        icNumber: formData.icNumber.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        email: formData.email.trim(),
        adId: ad.id,
        adTitle: ad.title,
        office: ad.office || '',
        hasCertificate: hasUploadedAny,
        certificateName: hasUploadedAny ? certificateNamesList : 'Tiada Sijil Dikepilkan (Mendaftar Tanpa Sijil)',
        certificates: uploadedCertificateMap,
        timestamp: new Date().toISOString(),
        docSeriesNo: nextNo,
      };

      await addDoc(collection(db, path), submissionData);

      // Save/Merge to 'suppliers' collection so they can receive future invitations directly
      const supplierDocId = `supplier_${normalizedCompanyName.replace(/[^A-Z0-9]/g, '_')}`;
      await setDoc(doc(db, 'suppliers', supplierDocId), {
        companyName: normalizedCompanyName,
        phoneNumber: formData.phoneNumber.trim(),
        email: formData.email.trim(),
        address: formData.companyAddress.trim(),
        cidbSpkk: '',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Queue Registration Confirmation Email in 'sent_emails'
      if (formData.email.trim()) {
        const emailSubject = `Pengesahan Pendaftaran Sebut Harga Berjaya - No. Siri: ${nextNo}`;
        const emailBody = `Assalamualaikum dan Salam Sejahtera,

Tuan/Puan,

PENGESAHAN PENDAFTARAN KEHADIRAN TAKLIMAT / LAWATAN TAPAK SECARA ONLINE

Syarikat: ${normalizedCompanyName}
Pemilik/Penama: ${formData.ownerName.trim()}
Emel: ${formData.email.trim()}
Telefon: ${formData.phoneNumber.trim()}

Dengan hormatnya dimaklumkan bahawa syarikat pihak tuan/puan telah BERJAYA mendaftar kehadiran secara online bagi sebut harga berikut:

Tajuk Sebut Harga: ${ad.title.toUpperCase()}
No. Sebut Harga: ${ad.tenderNo.toUpperCase()}

Sila ambil maklum maklumat penting bagi lawatan tapak yang bakal dijalankan seperti berikut:

1. NO. SIRI PENDAFTARAN  : ${nextNo}
2. TEMPAT LAWATAN TAPAK : ${ad.visitVenue || ad.briefingVenue || 'Pejabat RISDA Beaufort'}
3. HARI & TARIKH LAWATAN: ${indonesianDayName(ad.briefingDate || '')} / ${formatBeautifulDate(ad.briefingDate || '')}
4. MASA LAWATAN TAPAK   : ${ad.briefingTime || 'Seperti diiklankan'}

Sila bawa bersama dokumen lesen syarikat asal (CIDB, SPKK, PUKONSA atau MOF yang berkaitan) beserta satu salinan dan dokumen-dokumen yang diperlukan semasa mengemukakan tawaran.

Sekian, terima kasih.

"MALAYSIA MADANI"
"BERKHIDMAT UNTUK NEGARA"

Pejabat RISDA Daerah Beaufort, Sabah.`;

        await addDoc(collection(db, 'sent_emails'), {
          to: formData.email.trim(),
          toName: formData.ownerName.trim(),
          subject: emailSubject,
          body: emailBody,
          sentAt: new Date().toISOString()
        });
      }
      
      setRegisteredSeriesNo(nextNo);
      setSubmittingSucceeded(true);
      toast.success('Kehadiran taklimat berjaya didaftarkan!');
    } catch (err: any) {
      console.error('Error submitting public attendance:', err);
      handleFirestoreError(err, OperationType.WRITE, path);
      setFormError('Sistem mengalami kesulitan teknikal semasa memproses pendaftaran. Sila cuba lagi.');
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#040814] text-slate-300 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Glow visual atmosphere */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-sky-500/5 blur-[140px] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center space-y-6">
          <div className="w-14 h-14 border-t-2 border-r-2 border-[#0984e3] rounded-full animate-spin flex items-center justify-center">
            <div className="w-10 h-10 border-b-2 border-l-2 border-[#38bdf8] rounded-full animate-spin" />
          </div>
          <p className="text-[10px] text-white opacity-80 font-black uppercase tracking-[5px] animate-pulse">Memuat Turun Portal...</p>
        </div>
      </div>
    );
  }

  if (error || !ad) {
    return (
      <div className="min-h-screen bg-[#040814] text-slate-300 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/5 blur-[120px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md bg-[#0a0f1d] border border-slate-800 rounded-3xl p-8 md:p-10 text-center space-y-6 shadow-2xl"
        >
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle size={28} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-white uppercase tracking-tight font-sans">Ralat Pendaftaran</h3>
            <p className="text-xs text-slate-400 leading-relaxed uppercase">{error || 'Maklumat sebut harga tidak sah.'}</p>
          </div>
          <div className="pt-4">
            <button 
              onClick={onBackToPortal || (() => window.location.href = '/')}
              className="w-full py-4 bg-[#131b2c] hover:bg-[#1c273e] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-800"
            >
              <ArrowLeft size={14} /> PORTAL UTAMA SEBUTHARGA
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const isClosed = ad.status !== 'AKTIF';

  return (
    <div className="min-h-screen bg-[#040814] text-slate-300 relative py-12 px-4 md:px-8 overflow-x-hidden flex flex-col items-center justify-start">
      {/* Background radial atmosphere */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#0284c7]/5 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 translate-x-1/2 translate-y-1/2 w-[600px] h-[600px] bg-sky-500/3 blur-[140px] pointer-events-none" />

      <div className="w-full max-w-6xl relative z-10 space-y-8">
        
        {/* Modal Structure Title Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {/* Elegant Tall Vertical Accented Line */}
            <div className="w-[6px] h-12 bg-[#0ea5e9] rounded-full mr-4" />
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-wider uppercase font-sans leading-none">
                KEHADIRAN TAKLIMAT
              </h1>
              <p className="text-[10px] md:text-xs font-black text-sky-400 tracking-[3px] uppercase mt-1.5 font-sans">
                BORANG PENDAFTARAN TAPAK SEBUT HARGA
              </p>
            </div>
          </div>
          
          <button 
            onClick={onBackToPortal || (() => window.location.href = '/')}
            className="w-10 h-10 rounded-full bg-[#131924] border border-slate-800/80 flex items-center justify-center text-white/70 hover:text-white hover:bg-[#1a2333] transition-all cursor-pointer"
            title="Kembali ke Portal"
          >
            <X size={18} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {submittingSucceeded ? (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="bg-[#0a0f1d] border border-slate-800/80 rounded-[28px] p-8 md:p-16 text-center space-y-8 shadow-[0_30px_100px_rgba(0,0,0,0.8)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-sky-500 to-blue-500" />
              
              <div className="w-24 h-24 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-sky-500/10">
                <CheckCircle size={48} className="animate-pulse" />
              </div>

              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Pendaftaran Selesai!</h2>
                <div className="max-w-md mx-auto text-xs md:text-sm text-slate-400 leading-relaxed uppercase space-y-1.5">
                  <p>Rekod kehadiran taklimat tapak anda telah selamat dsimpan.</p>
                  <p className="text-sky-400 font-extrabold">No. Siri Pendaftaran Kehadiran Anda:</p>
                  <p className="text-3xl font-mono font-black text-white bg-[#060b13] border border-slate-800 px-6 py-2.5 rounded-2xl w-max mx-auto tracking-widest mt-2">{registeredSeriesNo}</p>
                </div>
              </div>

              <div className="max-w-xl mx-auto bg-[#060b13] border border-slate-800/60 rounded-2xl p-6 text-left space-y-4">
                <div>
                  <p className="text-[10px] text-sky-400 font-bold uppercase tracking-wider mb-1">Rujukan Projek Berdaftar:</p>
                  <p className="font-mono text-[11px] text-slate-400">{ad.tenderNo}</p>
                </div>
                <h4 className="text-xs md:text-sm font-extrabold text-white uppercase leading-relaxed">{ad.title}</h4>
              </div>

              <div className="pt-4">
                <button 
                  onClick={onBackToPortal || (() => window.location.href = '/')}
                  className="px-8 py-4 bg-[#131924] hover:bg-[#1a2333] text-white border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all uppercase"
                >
                  KEMBALI KE PORTAL UTAMA
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="space-y-8"
            >
              {/* Project & License box */}
              <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-[18px] p-6 lg:p-8 space-y-5">
                <div>
                  <p className="text-[10px] md:text-xs font-black text-sky-400 tracking-[2px] uppercase">RUJUKAN PROJEK</p>
                  <h2 className="text-sm md:text-lg font-extrabold text-white leading-relaxed mt-2 uppercase">
                    {ad.title}
                  </h2>
                </div>
                
                <div className="border-t border-slate-800/60" />

                <div>
                  <p className="text-[10px] md:text-xs font-black text-sky-400 tracking-[2px] uppercase mb-3">SIJIL WAJIB</p>
                  <div className="flex flex-wrap gap-2">
                    {ad.licenses?.cidbSpkk && (
                      <span className="bg-[#0284c7]/5 border border-[#38bdf8]/30 text-[#38bdf8] px-3.5 py-1.5 rounded-md text-[9px] font-black tracking-wider uppercase font-mono">
                        CIDB SPKK
                      </span>
                    )}
                    {ad.licenses?.cidbPkk && (
                      <span className="bg-[#0284c7]/5 border border-[#38bdf8]/30 text-[#38bdf8] px-3.5 py-1.5 rounded-md text-[9px] font-black tracking-wider uppercase font-mono">
                        CIDB PKK
                      </span>
                    )}
                    {ad.licenses?.stb && (
                      <span className="bg-[#0284c7]/5 border border-[#38bdf8]/30 text-[#38bdf8] px-3.5 py-1.5 rounded-md text-[9px] font-black tracking-wider uppercase font-mono">
                        STB
                      </span>
                    )}
                    {ad.licenses?.mof && (
                      <span className="bg-[#0284c7]/5 border border-[#38bdf8]/30 text-[#38bdf8] px-3.5 py-1.5 rounded-md text-[9px] font-black tracking-wider uppercase font-mono">
                        MOF
                      </span>
                    )}
                    {ad.licenses?.tcc && (
                      <span className="bg-[#0284c7]/5 border border-[#38bdf8]/30 text-[#38bdf8] px-3.5 py-1.5 rounded-md text-[9px] font-black tracking-wider uppercase font-mono">
                        TCC
                      </span>
                    )}
                    {ad.licenses?.pukonsa && (
                      <span className="bg-[#0284c7]/5 border border-[#38bdf8]/30 text-[#38bdf8] px-3.5 py-1.5 rounded-md text-[9px] font-black tracking-wider uppercase font-mono">
                        PUKONSA
                      </span>
                    )}
                    {ad.licenses?.kuhean && (
                      <span className="bg-[#0284c7]/5 border border-[#38bdf8]/30 text-[#38bdf8] px-3.5 py-1.5 rounded-md text-[9px] font-black tracking-wider uppercase font-mono">
                        KUHEAN
                      </span>
                    )}
                    {(!ad.licenses?.cidbSpkk && !ad.licenses?.cidbPkk && !ad.licenses?.stb && !ad.licenses?.mof && !ad.licenses?.tcc && !ad.licenses?.pukonsa && !ad.licenses?.kuhean) && (
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">
                        TIADA SIJIL SPESIFIK DIWAJIBKAN
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {isClosed ? (
                <div className="p-12 bg-red-500/5 border border-red-500/20 rounded-2xl text-center space-y-4">
                  <AlertCircle size={40} className="text-red-400 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-base font-black text-white uppercase tracking-tight">Pendaftaran Ditutup</h4>
                    <p className="text-xs text-slate-400 leading-relaxed uppercase">Sebut harga ini sudah tidak aktif, ditarik balik atau telah melebihi tarikh pendaftaran briefing.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-20">
                  
                  {/* Left Column - Form Fields */}
                  <div className="space-y-8">
                    
                    {/* Error Box if any */}
                    {formError && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-xs uppercase"
                      >
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <p className="font-extrabold tracking-wider mb-0.5">Ralat Pengisian</p>
                          <p className="text-[11px] leading-relaxed text-red-500/90">{formError}</p>
                        </div>
                      </motion.div>
                    )}

                    {/* MAKLUMAT SYARIKAT */}
                    <div className="space-y-5">
                      <h3 className="text-xs md:text-sm font-extrabold text-sky-400 tracking-[3px] uppercase border-b border-sky-500/20 pb-2 mb-4">
                        MAKLUMAT SYARIKAT
                      </h3>
                      
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block px-1">
                          Nama Syarikat
                        </label>
                        <input 
                          type="text"
                          required
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          placeholder="cth: Bina Jaya Sdn Bhd"
                          className="w-full bg-[#060b13] border border-slate-800/80 rounded-xl py-4 px-5 text-xs md:text-sm text-white focus:border-sky-500 outline-none transition-all placeholder:text-white/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block px-1">
                          Nama Pemilik
                        </label>
                        <input 
                          type="text"
                          required
                          value={formData.ownerName}
                          onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                          placeholder="cth: Ahmad Bin Ismail"
                          className="w-full bg-[#060b13] border border-slate-800/80 rounded-xl py-4 px-5 text-xs md:text-sm text-white focus:border-sky-500 outline-none transition-all placeholder:text-white/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block px-1">
                          Alamat Syarikat
                        </label>
                        <textarea 
                          required
                          rows={4}
                          value={formData.companyAddress}
                          onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                          placeholder="Masukkan alamat penuh syarikat..."
                          className="w-full bg-[#060b13] border border-slate-800/80 rounded-xl py-4 px-5 text-xs md:text-sm text-white focus:border-sky-500 outline-none transition-all placeholder:text-white/10 resize-none"
                        />
                      </div>
                    </div>

                    {/* BUTIRAN PERIBADI */}
                    <div className="space-y-5">
                      <h3 className="text-xs md:text-sm font-extrabold text-sky-400 tracking-[3px] uppercase border-b border-sky-500/20 pb-2 mb-4">
                        BUTIRAN PERIBADI
                      </h3>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block px-1">
                          No. Kad Pengenalan
                        </label>
                        <input 
                          type="text"
                          required
                          maxLength={12}
                          value={formData.icNumber}
                          onChange={(e) => setFormData({ ...formData, icNumber: e.target.value.replace(/\D/g, '') })}
                          placeholder="cth: 880101015555"
                          className="w-full bg-[#060b13] border border-slate-800/80 rounded-xl py-4 px-5 text-xs md:text-sm text-white focus:border-sky-500 outline-none transition-all placeholder:text-white/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block px-1">
                          No. Telefon Bimbit
                        </label>
                        <input 
                          type="text"
                          required
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                          placeholder="cth: 0123456789"
                          className="w-full bg-[#060b13] border border-slate-800/80 rounded-xl py-4 px-5 text-xs md:text-sm text-white focus:border-sky-500 outline-none transition-all placeholder:text-white/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block px-1">
                          E-mel Rasmi (Masukkan '-' jika tiada)
                        </label>
                        <input 
                          type="text"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="cth: syarikat@gmail.com (atau '-' jika tiada)"
                          className="w-full bg-[#060b13] border border-slate-800/80 rounded-xl py-4 px-5 text-xs md:text-sm text-white focus:border-sky-500 outline-none transition-all placeholder:text-white/10"
                        />
                      </div>
                    </div>

                  </div>

                  {/* Right Column - Upload & Safety Warnings */}
                  <div className="flex flex-col h-full justify-between space-y-6">
                    <div className="flex-1 space-y-6">
                      <div>
                        <h3 className="text-xs md:text-sm font-extrabold text-sky-400 tracking-[3px] uppercase border-b border-sky-500/20 pb-2 mb-2">
                          SENARAI MUAT NAIK SIJIL KELAYAKAN
                        </h3>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                          Sila muat naik sijil kelayakan yang berkenaan dengan syarikat anda (Format Gambar/PDF). Sijil yang tiada boleh dilepaskan (tidak wajib sekiranya anda tidak memilikinya).
                        </p>
                      </div>

                      <div className="space-y-6">
                        {effectiveLicenses.map((lic) => {
                          const file = certificateFiles[lic.key];
                          const isDragLocal = !!dragActiveStates[lic.key];
                          return (
                            <div key={lic.key} className="space-y-2">
                              <div className="flex items-center justify-between px-1">
                                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                                  {lic.label} <span className="text-sky-400 font-bold uppercase tracking-wider">(Jika Ada)</span>
                                </label>
                                {file && (
                                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <CheckCircle size={12} /> BERJAYA DIKEPILKAN
                                  </span>
                                )}
                              </div>

                              {/* Premium Drag and Drop Upload Area for this specific certificate */}
                              <div 
                                onDragEnter={(e) => handleDrag(lic.key, e)}
                                onDragOver={(e) => handleDrag(lic.key, e)}
                                onDragLeave={(e) => handleDrag(lic.key, e)}
                                onDrop={(e) => handleDrop(lic.key, e)}
                                className={`relative w-full border-2 border-dashed rounded-xl p-6 min-h-[140px] flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                                  isDragLocal ? 'border-sky-500 bg-sky-500/5 scale-[0.99]' : 
                                  file ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-800 bg-[#060b13] hover:border-slate-700'
                                }`}
                              >
                                <input 
                                  type="file"
                                  accept="image/*,application/pdf"
                                  onChange={(e) => handleFileChange(lic.key, e)}
                                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                />

                                {file ? (
                                  <div className="flex flex-col items-center text-center gap-3 relative z-20">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                      <FileText size={18} />
                                    </div>
                                    <div className="space-y-0.5">
                                      <p className="text-white text-[11px] font-bold font-mono max-w-[280px] truncate">
                                        {file.name}
                                      </p>
                                      <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                      </p>
                                    </div>
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCertificateFiles(prev => {
                                          const next = { ...prev };
                                          delete next[lic.key];
                                          return next;
                                        });
                                      }}
                                      className="text-[9px] font-black text-sky-400 hover:text-sky-300 uppercase tracking-wider relative z-20"
                                    >
                                      TUKAR FAIL
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center text-center gap-2.5">
                                    <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800/80 flex items-center justify-center text-sky-400 transition-transform group-hover:scale-105">
                                      <Upload size={16} />
                                    </div>
                                    <div className="space-y-0.5">
                                      <p className="text-white text-[10px] font-black uppercase tracking-wider font-sans">KLIK ATAU TARIK SIJIL</p>
                                      <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Format JPG/PNG/PDF (Maks 5MB)</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Small informative block with Shield icon */}
                      <div className="flex items-start gap-4 p-5 bg-[#0a1220]/60 border border-slate-800/40 rounded-xl">
                        <Shield size={20} className="text-sky-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                          Dengan menekan butang daftar, anda mengesahkan maklumat di atas adalah benar bagi tujuan pendaftaran taklimat tapak.
                        </p>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button 
                        type="submit"
                        disabled={formLoading}
                        className="w-full py-5 bg-[#0091ff] hover:bg-[#0081eb] text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-[0_15px_30px_rgba(0,145,255,0.15)] disabled:opacity-50 select-none cursor-pointer"
                      >
                        <UserCheck size={18} />
                        {formLoading ? "SEDANG MEMPROSES..." : "DAFTAR KEHADIRAN"}
                      </button>
                    </div>

                  </div>

                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-slate-900">
          <div className="flex items-center justify-center gap-2 text-[9px] text-slate-600 font-bold tracking-[3px] uppercase">
            <Shield size={11} />
            <span>HAK CIPTA TERPELIHARA RISDA BEAUFORT &copy; 2026</span>
          </div>
        </div>

      </div>
    </div>
  );
}
