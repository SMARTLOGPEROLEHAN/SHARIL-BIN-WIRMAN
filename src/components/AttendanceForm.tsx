import React, { useState } from 'react';
import { addDoc, collection, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion } from 'motion/react';
import { UserCheck, CheckCircle, Shield, X, Upload, FileText as FileIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AttendanceFormProps {
  adId: string;
  adTitle: string;
  tenderNo?: string;
  office: string;
  licenseRequirements?: string;
  licenses?: {
    cidbSpkk: boolean;
    cidbPkk: boolean;
    stb: boolean;
    mof: boolean;
    tcc: boolean;
    pukonsa: boolean;
    kuhean: boolean;
    others?: string;
  };
  onSuccess: () => void;
  editingRecord?: {
    id: string;
    companyName: string;
    ownerName: string;
    companyAddress?: string;
    icNumber: string;
    phoneNumber: string;
    email?: string;
    certificateUrl?: string;
  }
}

export default function AttendanceForm({ adId, adTitle, tenderNo, office, licenseRequirements, licenses, onSuccess, editingRecord }: AttendanceFormProps) {
  const [formData, setFormData] = useState({
    companyName: editingRecord?.companyName || '',
    ownerName: editingRecord?.ownerName || '',
    companyAddress: editingRecord?.companyAddress || '',
    icNumber: editingRecord?.icNumber || '',
    phoneNumber: editingRecord?.phoneNumber || '',
    email: editingRecord?.email || '',
  });
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Saiz fail melebihi 5MB');
        return;
      }
      setCertificateFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const path = `attendance`;
    try {
      if (!editingRecord) {
        // Check for existing registration with same company name and project title
        const q = query(
          collection(db, path), 
          where('companyName', '==', formData.companyName.toUpperCase().trim()),
          where('adTitle', '==', adTitle)
        );
        const existingSnap = await getDocs(q);
        
        if (!existingSnap.empty) {
          setError('Syarikat anda telah pun berdaftar untuk sebut harga ini. Pendaftaran berganda tidak dibenarkan.');
          setLoading(false);
          return;
        }
      }

      // Note: In a production environment with Firebase Storage, 
      // we would upload 'certificateFile' here and get a URL.
      // For this implementation, we record the intent and file metadata.
      
      const submissionData: any = {
        ...formData,
        companyName: formData.companyName.toUpperCase().trim(),
        adId,
        adTitle,
        office,
        hasCertificate: !!certificateFile || !!editingRecord?.certificateUrl,
        certificateName: certificateFile?.name || null,
      };

      if (editingRecord) {
        await updateDoc(doc(db, 'attendance', editingRecord.id), {
          ...submissionData,
          updatedAt: new Date().toISOString(),
        });
      } else {
        submissionData.timestamp = new Date().toISOString();
        // Auto-generate docSeriesNo for this specific project title
        const q = query(collection(db, path), where('adTitle', '==', adTitle));
        const snap = await getDocs(q);
        const nextNo = (snap.size + 1).toString().padStart(3, '0');
        submissionData.docSeriesNo = nextNo;
        
        await addDoc(collection(db, path), submissionData);
      }
      setSubmitted(true);
      toast.success(editingRecord ? 'Kehadiran dikemaskini!' : 'Kehadiran didaftarkan!');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-10 flex flex-col items-center text-center space-y-6">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-black shadow-lg shadow-green-500/20"
        >
          <CheckCircle size={40} />
        </motion.div>
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">
            {editingRecord ? 'Kemaskini Berjaya!' : 'Pendaftaran Berjaya!'}
          </h3>
          <p className="text-sm text-risda-muted mt-2">
            {editingRecord ? 'Maklumat kehadiran telah dikemaskini.' : 'Terima kasih. Nama anda telah direkodkan dalam senarai kehadiran taklimat tapak.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 lg:p-12 space-y-6 md:space-y-8 relative">
      <div className="space-y-3 border-l-4 border-risda-orange pl-4 sm:pl-6">
        <h3 className="text-lg md:text-2xl font-black text-white uppercase tracking-tight leading-none">
          {editingRecord ? 'Kemaskini Kehadiran' : 'Kehadiran Taklimat'}
        </h3>
        <p className="text-[9px] md:text-[11px] text-risda-orange font-black uppercase tracking-[3px] md:tracking-[4px]">
          {editingRecord ? 'Maklumat Pendaftaran Tapak' : 'Borang Pendaftaran Tapak Sebut Harga'}
        </p>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500"
        >
          <Shield size={18} className="shrink-0" />
          <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
            {error}
          </p>
          <button onClick={() => setError(null)} className="ml-auto text-red-500/50 hover:text-red-500">
            <X size={16} />
          </button>
        </motion.div>
      )}

      <div className="bg-black/20 border border-risda-border p-4 md:p-5 rounded-2xl md:hidden">
        <p className="text-[8px] text-risda-orange font-bold uppercase tracking-[2px] mb-1">DATA PROJEK</p>
        <p className="text-[9px] text-risda-muted font-mono mb-1">{tenderNo}</p>
        <p className="text-xs text-white font-black uppercase leading-snug">{adTitle}</p>
      </div>

      <div className="hidden md:block bg-black/20 border border-risda-border p-4 rounded-xl">
        <p className="text-[9px] text-risda-orange font-bold uppercase tracking-[2px] mb-1">RUJUKAN PROJEK</p>
        <p className="text-sm text-white font-medium">{adTitle}</p>
        {(licenseRequirements || licenses) && (
          <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
            {licenseRequirements && (
              <div>
                <p className="text-[8px] text-risda-gold font-bold uppercase tracking-[2px] mb-1">Keperluan Khas</p>
                <p className="text-[10px] text-white/70 uppercase leading-relaxed">{licenseRequirements}</p>
              </div>
            )}
            {licenses && (
              <div>
                <p className="text-[8px] text-risda-gold font-bold uppercase tracking-[2px] mb-1">Sijil Wajib</p>
                <div className="flex flex-wrap gap-1.5">
                  {(licenses.cidbSpkk || licenses.cidbPkk) && <span className="px-2 py-1 bg-risda-orange/20 text-risda-orange rounded text-[8px] font-black uppercase tracking-widest border border-risda-orange/20">CIDB</span>}
                  {licenses.stb && <span className="px-2 py-1 bg-risda-orange/20 text-risda-orange rounded text-[8px] font-black uppercase tracking-widest border border-risda-orange/20">STB</span>}
                  {licenses.mof && <span className="px-2 py-1 bg-risda-orange/20 text-risda-orange rounded text-[8px] font-black uppercase tracking-widest border border-risda-orange/20">MOF</span>}
                  {licenses.tcc && <span className="px-2 py-1 bg-risda-orange/20 text-risda-orange rounded text-[8px] font-black uppercase tracking-widest border border-risda-orange/20">TCC</span>}
                  {licenses.pukonsa && <span className="px-2 py-1 bg-risda-orange/20 text-risda-orange rounded text-[8px] font-black uppercase tracking-widest border border-risda-orange/20">PUKONSA</span>}
                  {licenses.kuhean && <span className="px-2 py-1 bg-risda-orange/20 text-risda-orange rounded text-[8px] font-black uppercase tracking-widest border border-risda-orange/20">KUHEAN</span>}
                  {licenses.others && <span className="px-2 py-1 bg-white/10 text-white/50 rounded text-[8px] font-black uppercase tracking-widest border border-white/10">{licenses.others}</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 pb-32 md:pb-0">
        <div className="space-y-6 md:space-y-8">
          <div className="space-y-3">
            <label className="text-[9px] md:text-[10px] font-black text-risda-orange uppercase tracking-[3px] md:tracking-[4px] px-1">Maklumat Syarikat</label>
            <div className="space-y-3 md:space-y-4">
              <div className="space-y-1.5">
                <label className="text-[8px] md:text-[9px] font-bold text-risda-muted uppercase tracking-[2px] px-1">Nama Syarikat</label>
                <input 
                  value={formData.companyName || ''}
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  placeholder="cth: Bina Jaya Sdn Bhd"
                  className="w-full bg-black/40 border border-risda-border rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-xs md:text-sm text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] md:text-[9px] font-bold text-risda-muted uppercase tracking-[2px] px-1">Nama Pemilik</label>
                <input 
                  value={formData.ownerName || ''}
                  onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
                  placeholder="cth: Ahmad Bin Ismail"
                  className="w-full bg-black/40 border border-risda-border rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-xs md:text-sm text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] md:text-[9px] font-bold text-risda-muted uppercase tracking-[2px] px-1">Alamat Syarikat</label>
                <textarea 
                  value={formData.companyAddress || ''}
                  onChange={(e) => setFormData({...formData, companyAddress: e.target.value})}
                  placeholder="Masukkan alamat penuh syarikat..."
                  rows={3}
                  className="w-full bg-black/40 border border-risda-border rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-xs md:text-sm text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/10 resize-none"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[9px] md:text-[10px] font-black text-risda-orange uppercase tracking-[3px] md:tracking-[4px] px-1">Butiran Peribadi</label>
            <div className="grid grid-cols-1 gap-3 md:gap-4">
              <div className="space-y-1.5">
                <label className="text-[8px] md:text-[9px] font-bold text-risda-muted uppercase tracking-[2px] px-1">No. Kad Pengenalan</label>
                <input 
                  value={formData.icNumber || ''}
                  onChange={(e) => setFormData({...formData, icNumber: e.target.value})}
                  placeholder="cth: 880101015555"
                  className="w-full bg-black/40 border border-risda-border rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-xs md:text-sm text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/10"
                  required
                  maxLength={12}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] md:text-[9px] font-bold text-risda-muted uppercase tracking-[2px] px-1">No. Telefon Bimbit</label>
                <input 
                  value={formData.phoneNumber || ''}
                  onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                  placeholder="cth: 0123456789"
                  className="w-full bg-black/40 border border-risda-border rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-xs md:text-sm text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] md:text-[9px] font-bold text-risda-muted uppercase tracking-[2px] px-1">E-mel Rasmi</label>
                <input 
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="cth: syarikat@gmail.com"
                  className="w-full bg-black/40 border border-risda-border rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-xs md:text-sm text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/10"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 flex flex-col">
          <div className="space-y-2 flex-1">
            <label className="text-[9px] md:text-[10px] font-black text-risda-muted uppercase tracking-[3px] px-1">Sijil Kelayakan (PDF/Imej)</label>
            <div className={`relative h-full min-h-[140px] md:min-h-[160px] border-2 border-dashed rounded-xl md:rounded-2xl flex flex-col items-center justify-center p-4 md:p-6 transition-all cursor-pointer overflow-hidden ${
              certificateFile ? 'border-risda-orange bg-risda-orange/5' : 'border-white/10 hover:border-risda-orange/30 bg-black/40'
            }`}>
              <input 
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              {certificateFile ? (
                <div className="flex flex-col items-center text-center gap-2 md:gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-risda-orange text-black rounded-full flex items-center justify-center">
                    <FileIcon size={20} md:size={24} />
                  </div>
                  <div className="space-y-0.5 md:space-y-1">
                    <p className="text-white text-[10px] md:text-xs font-bold truncate max-w-[150px] md:max-w-[200px]">{certificateFile.name}</p>
                    <p className="text-[8px] md:text-[10px] text-risda-muted uppercase tracking-widest">{(certificateFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCertificateFile(null);
                    }}
                    className="text-[9px] md:text-[10px] font-black text-risda-orange uppercase tracking-[2px] mt-1 relative z-20"
                  >
                    Tukar Fail
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-white/5 rounded-full flex items-center justify-center text-risda-muted transition-transform group-hover:scale-110">
                    <Upload size={20} md:size={24} />
                  </div>
                  <div className="space-y-0.5 md:space-y-1">
                    <p className="text-white text-[10px] md:text-xs font-black uppercase tracking-[2px]">Klik atau Tarik Fail</p>
                    <p className="text-[8px] md:text-[10px] text-risda-muted font-medium">Sijil CIDB (Maks 5MB)</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 md:pt-6">
            <div className="flex items-start gap-2 md:gap-3 text-risda-muted mb-4 md:mb-6 bg-white/5 p-3 md:p-4 rounded-xl border border-white/5">
              <Shield size={16} md:size={18} className="text-risda-orange shrink-0 mt-0.5" />
              <p className="text-[8px] md:text-[9px] font-medium leading-relaxed italic">
                Dengan menekan butang daftar, anda mengesahkan maklumat di atas adalah benar bagi tujuan pendaftaran taklimat tapak.
              </p>
            </div>
            
            <button 
              type="submit"
              disabled={loading}
              className="btn-gold w-full py-4 md:py-5 text-xs md:text-sm flex items-center justify-center gap-2 md:gap-3 shadow-[0_20px_50px_rgba(245,158,11,0.2)]"
            >
              <UserCheck size={18} md:size={20} />
              {loading ? 'Sedang Memproses...' : editingRecord ? 'Simpan Kemaskini' : 'Daftar Kehadiran'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
