import React, { useState } from 'react';
import { addDoc, collection, doc, updateDoc, getDocs, query, where, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion } from 'motion/react';
import { UserCheck, CheckCircle, Shield, X, Upload, FileText as FileIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { optimizeImage } from '../lib/imageOptimizer';

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
  const [certificateFiles, setCertificateFiles] = useState<Record<string, File>>({});
  const [dragActiveStates, setDragActiveStates] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [registeredSeriesNo, setRegisteredSeriesNo] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Sijil Kelayakan Wajib list computed based on ad configuration
  const requiredLicenses = [];
  if (licenses?.cidbSpkk || licenses?.cidbPkk) {
    requiredLicenses.push({ key: 'cidb', label: 'Sijil CIDB' });
  }
  if (licenses?.stb) requiredLicenses.push({ key: 'stb', label: 'Sijil Taraf Bumiputera (STB)' });
  if (licenses?.mof) requiredLicenses.push({ key: 'mof', label: 'Kementerian Kewangan (MOF)' });
  if (licenses?.tcc) requiredLicenses.push({ key: 'tcc', label: 'Sijil Pelepasan Cukai (TCC)' });
  if (licenses?.pukonsa) requiredLicenses.push({ key: 'pukonsa', label: 'PUKONSA' });
  if (licenses?.kuhean) requiredLicenses.push({ key: 'kuhean', label: 'KUHEAN' });

  const hasSpecificLicenses = requiredLicenses.length > 0;
  const effectiveLicenses = hasSpecificLicenses 
    ? requiredLicenses 
    : [{ key: 'umum', label: 'Sijil Pendaftaran Syarikat / CIDB / Lain-Lain Sijil Kelayakan' }];

  const processAndSetFile = async (key: string, file: File) => {
    if (file.type.startsWith('image/')) {
      const compressToastId = toast.loading('Mengoptimumkan saiz imej...');
      try {
        const optimized = await optimizeImage(file, 1000, 1000, 0.55);
        toast.dismiss(compressToastId);
        
        if (optimized.size > 600 * 1024) {
          toast.error('Gagal mengoptimumkan: Imej melebihi had saiz 600KB.');
          return;
        }
        
        setCertificateFiles(prev => ({ ...prev, [key]: optimized }));
        toast.success(`Imej berjaya dioptimumkan! Saiz sekarang: ${(optimized.size / 1024).toFixed(1)} KB`);
      } catch (optimizeErr) {
        toast.dismiss(compressToastId);
        console.error('Resize error:', optimizeErr);
        if (file.size > 600 * 1024) {
          toast.error('Gagal: Fail imej melebihi had saiz 600KB.');
          return;
        }
        setCertificateFiles(prev => ({ ...prev, [key]: file }));
      }
    } else {
      // PDF or other format
      if (file.size > 600 * 1024) {
        toast.error('Gagal: Fail melebihi had saiz 600KB.');
        return;
      }
      setCertificateFiles(prev => ({ ...prev, [key]: file }));
    }
  };

  const fileToBase64 = (fileObj: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(fileObj);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleDrag = (key: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveStates(prev => ({ ...prev, [key]: true }));
    } else if (e.type === "dragleave") {
      setDragActiveStates(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleDrop = async (key: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveStates(prev => ({ ...prev, [key]: false }));
    if (e.dataTransfer.files?.[0]) {
      await processAndSetFile(key, e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      await processAndSetFile(key, e.target.files[0]);
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

      // Note: We record the intent and files metadata.
      const uploadedCertificateMap = effectiveLicenses.reduce((acc, lic) => {
        acc[lic.key] = certificateFiles[lic.key]?.name || '';
        return acc;
      }, {} as Record<string, string>);

      const hasUploadedAny = Object.keys(certificateFiles).length > 0;
      const certificateNamesList = effectiveLicenses
        .filter(lic => !!certificateFiles[lic.key])
        .map(lic => `${lic.label}: ${certificateFiles[lic.key].name}`)
        .join(', ');

      const certificatesBase64: Record<string, string> = {};
      for (const key of Object.keys(certificateFiles)) {
        const fileObj = certificateFiles[key];
        if (fileObj) {
          try {
            const b64 = await fileToBase64(fileObj);
            certificatesBase64[key] = b64;
          } catch (e) {
            console.error('Error converting file to base64:', e);
          }
        }
      }
      
      const submissionData: any = {
        ...formData,
        companyName: formData.companyName.toUpperCase().trim(),
        adId,
        adTitle,
        office,
        hasCertificate: editingRecord ? (!!editingRecord.certificateUrl || hasUploadedAny) : hasUploadedAny,
        certificateName: editingRecord 
          ? (editingRecord.certificateUrl ? 'Sijil sedia ada' : (hasUploadedAny ? certificateNamesList : 'Tiada Sijil Dikepilkan (Mendaftar Tanpa Sijil)'))
          : (hasUploadedAny ? certificateNamesList : 'Tiada Sijil Dikepilkan (Mendaftar Tanpa Sijil)'),
        certificates: uploadedCertificateMap,
        certificatesBase64,
      };

      if (editingRecord && !hasUploadedAny) {
        try {
          const existingDoc = await getDoc(doc(db, 'attendance', editingRecord.id));
          if (existingDoc.exists() && existingDoc.data().certificatesBase64) {
            submissionData.certificatesBase64 = existingDoc.data().certificatesBase64;
          }
        } catch (errPreserve) {
          console.error("Preserving certificatesBase64 error:", errPreserve);
        }
      }

      if (editingRecord) {
        await updateDoc(doc(db, 'attendance', editingRecord.id), {
          ...submissionData,
          updatedAt: new Date().toISOString(),
        });

        // Save/Merge to 'suppliers' collection so they are updated/saved for bidding invitation purposes
        const normalizedCompanyName = formData.companyName.toUpperCase().trim();
        const supplierDocId = `supplier_${normalizedCompanyName.replace(/[^A-Z0-9]/g, '_')}`;
        
        let finalCidb = '';
        try {
          const sSnap = await getDoc(doc(db, 'suppliers', supplierDocId));
          if (sSnap.exists()) {
            finalCidb = sSnap.data().cidbSpkk || '';
          }
        } catch (e) {
          console.error('Error fetching existing supplier:', e);
        }
        if (hasUploadedAny) {
          finalCidb = certificateNamesList;
        }

        await setDoc(doc(db, 'suppliers', supplierDocId), {
          companyName: normalizedCompanyName,
          phoneNumber: formData.phoneNumber.trim(),
          email: (formData.email || '').trim(),
          address: (formData.companyAddress || '').trim(),
          cidbSpkk: finalCidb,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else {
        submissionData.timestamp = new Date().toISOString();
        // Auto-generate docSeriesNo for this specific project title
        const q = query(collection(db, path), where('adTitle', '==', adTitle));
        const snap = await getDocs(q);
        const nextNo = (snap.size + 1).toString().padStart(3, '0');
        submissionData.docSeriesNo = nextNo;
        setRegisteredSeriesNo(nextNo);
        
        await addDoc(collection(db, path), submissionData);

        // Save/Merge to 'suppliers' collection so they can receive future invitations directly
        const normalizedCompanyName = formData.companyName.toUpperCase().trim();
        const supplierDocId = `supplier_${normalizedCompanyName.replace(/[^A-Z0-9]/g, '_')}`;
        
        let finalCidb = '';
        try {
          const sSnap = await getDoc(doc(db, 'suppliers', supplierDocId));
          if (sSnap.exists()) {
            finalCidb = sSnap.data().cidbSpkk || '';
          }
        } catch (e) {
          console.error('Error fetching existing supplier:', e);
        }
        if (hasUploadedAny) {
          finalCidb = certificateNamesList;
        }

        await setDoc(doc(db, 'suppliers', supplierDocId), {
          companyName: normalizedCompanyName,
          phoneNumber: formData.phoneNumber.trim(),
          email: (formData.email || '').trim(),
          address: (formData.companyAddress || '').trim(),
          cidbSpkk: finalCidb,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // Queue Registration Confirmation Email in 'sent_emails' (Ensuring distinct physical email for duplicate name/license on different sebuthargas)
        if (formData.email && formData.email.trim() && formData.email !== '-') {
          // Fetch full ad details from firebase
          let visitVenue = 'Pejabat RISDA Beaufort';
          let briefingDate = '';
          let briefingTime = 'Seperti diiklankan';
          let briefingVenue = 'Pejabat RISDA Beaufort';

          try {
            const adDocRef = doc(db, 'ads', adId);
            const adDocSnap = await getDoc(adDocRef);
            if (adDocSnap.exists()) {
              const adData = adDocSnap.data();
              visitVenue = adData.visitVenue || adData.briefingVenue || visitVenue;
              briefingDate = adData.briefingDate || '';
              briefingTime = adData.briefingTime || briefingTime;
              briefingVenue = adData.briefingVenue || briefingVenue;
            }
          } catch (adErr) {
            console.error('Error fetching ad detail for email:', adErr);
          }

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

          const formattedBriefingDate = briefingDate ? `${formatBeautifulDate(briefingDate)} (${indonesianDayName(briefingDate)})` : '—';

          const emailSubject = `PENDAFTARAN TAKLIMAT TAPAK BAGI SEBUTHARGA ${adTitle.toUpperCase()} TELAH BERJAYA - No. Siri: ${nextNo}`;
          const emailBody = `Assalamualaikum dan Salam Sejahtera,

Tuan/Puan,

PENGESAHAN PENDAFTARAN KEHADIRAN TAKLIMAT / LAWATAN TAPAK SECARA ONLINE

Syarikat: ${normalizedCompanyName}
Pemilik/Penama: ${formData.ownerName.trim()}
Emel: ${formData.email.trim()}
Telefon: ${formData.phoneNumber.trim()}

Dengan hormatnya dimaklumkan bahawa pendaftaran taklimat tapak bagi sebutharga berikut TELAH BERJAYA:

Tajuk Sebut Harga: ${adTitle.toUpperCase()}
No. Sebut Harga: ${(tenderNo || '').toUpperCase()}

Sila ambil maklum maklumat penting bagi lawatan tapak yang bakal dijalankan seperti berikut:

1. NO. SIRI PENDAFTARAN  : ${nextNo}
2. TEMPAT LAWATAN TAPAK : ${visitVenue}
3. HARI & TARIKH LAWATAN: ${formattedBriefingDate}
4. MASA LAWATAN TAPAK   : ${briefingTime}

Sila bawa bersama dokumen lesen syarikat asal (CIDB, SPKK, PUKONSA atau MOF yang berkaitan) beserta satu salinan dan dokumen-dokumen yang diperlukan semasa mengemukakan tawaran.

Sekian, terima kasih.

"MALAYSIA MADANI"
"BERKHIDMAT UNTUK NEGARA"

Pejabat RISDA Daerah Beaufort, Sabah.`;

          const emailHtml = `
<div style="font-family: 'Times New Roman', Times, serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #cbd5e1; color: #0b1329; background-color: #ffffff; border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
  <!-- Letterhead -->
  <table style="width: 100%; border-collapse: collapse; border-bottom: 3px double #000000; padding-bottom: 12px; margin-bottom: 20px;">
    <tr>
      <td style="width: 80px; vertical-align: middle;">
        <img src="https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png" alt="RISDA Logo" style="width: 70px; height: auto;" />
      </td>
      <td style="padding-left: 15px; text-align: left; vertical-align: middle;">
        <strong style="font-size: 13px; display: block; text-transform: uppercase; color: #1e3a1e;">PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH (RISDA)</strong>
        <strong style="font-size: 12px; display: block; text-transform: uppercase; margin-top: 2px; color: #000000;">PEJABAT RISDA DAERAH BEAUFORT, STATE SABAH</strong>
        <span style="font-size: 9px; display: block; color: #475569; margin-top: 4px; line-height: 1.3;">
          K77 & K78, Block K, Beaufort Square Avenue 1, Jalan Binunuk, 89800 Beaufort, Sabah<br/>
          Tel: 087-224335/336 | E-Mel: prdbeaufort@risda.gov.my
        </span>
      </td>
    </tr>
  </table>

  <!-- Meta Info -->
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px;">
    <tr>
      <td style="width: 50%; font-weight: bold;">NO. SIRI RUJUKAN: <span style="font-family: monospace; font-size: 13px; color: #b45309;">${nextNo}</span></td>
      <td style="width: 50%; text-align: right; font-weight: bold;">TARIKH: ${new Date().toLocaleDateString('ms-MY')}</td>
    </tr>
  </table>

  <!-- Main Body Content -->
  <div style="font-size: 12.5px; line-height: 1.6; text-align: justify; margin-bottom: 25px;">
    <p>Tuan / Puan,</p>
    
    <p style="font-weight: bold; font-size: 13.5px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 15px; color: #0f172a;">
      PENGESAHAN PENDAFTARAN ATAS TALIAN KEHADIRAN TAKLIMAT & LAWATAN TAPAK WAJIB
    </p>

    <p>Sukacita perkara di atas serta proses pengesahan pendaftaran kehadiran digital bagi syarikat tuan/puan dirujuk dengan hormatnya.</p>
    
    <p>2. Adalah disah dan dimaklumkan bahawa pendaftaran kehadiran bagi sebut harga di bawah telah <strong>BERJAYA DIDOKUMENKAN</strong> ke dalam sistem pangkalan perolehan RISDA:</p>

    <!-- Tender Details Callout Card -->
    <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; border-radius: 4px; margin: 15px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
        <tr>
          <td style="width: 30%; font-weight: bold; padding: 3px 0; color: #475569;">NO. SEBUT HARGA</td>
          <td style="width: 3%; font-weight: bold; padding: 3px 0; color: #475569;">:</td>
          <td style="font-weight: bold; color: #1d4ed8; padding: 3px 0; text-transform: uppercase; font-family: monospace;">${(tenderNo || '').toUpperCase()}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; padding: 3px 0; color: #475569; vertical-align: top;">TAJUK PROJEK</td>
          <td style="font-weight: bold; padding: 3px 0; color: #475569; vertical-align: top;">:</td>
          <td style="font-weight: bold; padding: 3px 0; text-transform: uppercase; line-height: 1.4; color: #0f172a;">${adTitle.toUpperCase()}</td>
        </tr>
      </table>
    </div>

    <p>3. Berikut adalah butiran penuh rekod perolehan dan jadual taklimat lawatan tapak fizikal yang wajib dihadiri oleh syarikat:</p>

    <!-- Contractor Details Table -->
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 15px 0; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
          <th colspan="2" style="padding: 8px; text-align: left; text-transform: uppercase; color: #0284c7; font-weight: bold;">A) RINGKASAN PENDAFTARAN KONTRAKTOR</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="width: 35%; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #475569;">NAMA SYARIKAT</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; text-transform: uppercase; color: #0f172a;">${normalizedCompanyName}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #475569;">WAKIL / PENAMA SIJIL</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-transform: uppercase;">${formData.ownerName.trim()}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #475569;">NO. KAD PENGENALAN</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${formData.icNumber.trim()}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #475569;">NO. TELEFON BERHUBUNG</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${formData.phoneNumber.trim()}</td>
        </tr>
      </tbody>
    </table>

    <!-- Site Visit Details Table -->
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 15px 0; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background-color: #fdf2f8; border-bottom: 1px solid #cbd5e1;">
          <th colspan="2" style="padding: 8px; text-align: left; text-transform: uppercase; color: #db2777; font-weight: bold;">B) JADUAL & LOKASI LAWATAN TAPAK FIZIKAL</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="width: 35%; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #475569;">HARI & TARIKH LAWATAN</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #db2777;">${formattedBriefingDate}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #475569;">MASA TAKLIMAT</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${briefingTime}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #475569;">TEMPAT BERKUMPUL</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-transform: uppercase; line-height: 1.4;">${visitVenue}</td>
        </tr>
      </tbody>
    </table>

    <div style="font-weight: bold; background-color: #fffbeb; border: 1px solid #fef3c7; padding: 12px; border-radius: 6px; font-size: 11px; margin-top: 15px; color: #92400e; line-height: 1.4;">
      PERINGATAN MANDATORI: Sila bawa bersama dokumen lesen syarikat asal (CIDB, SPKK, PUKONSA atau MOF yang berkaitan) beserta satu salinan semasa taklimat dijalankan untuk ditentusahkan secara fizikal oleh Pegawai Pengendali RISDA.
    </div>
  </div>

  <!-- Signoff block -->
  <div style="font-size: 12px; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 25px;">
    <strong>"MALAYSIA MADANI"</strong><br/>
    <strong>"BERKHIDMAT UNTUK NEGARA"</strong>
    <p style="margin-top: 20px; font-weight: bold;">Saya yang menjalankan amanah,</p>
    <div style="height: 35px;"></div>
    <strong>JABATAN PEROLEHAN DAERAH BEAUFORT</strong><br/>
    <span style="color: #475569;">b.p. Pegawai RISDA Daerah Beaufort</span><br/>
    <span style="color: #64748b; font-size: 10px;">Kementerian Kemajuan Desa dan Wilayah, Sabah</span>
  </div>
</div>
`;

           // Send email directly through secure backend proxy (uses SMTP settings from Secrets)
          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: formData.email.trim(),
              subject: emailSubject,
              text: emailBody,
              html: emailHtml
            })
          }).then(res => {
            if (res.ok) {
              console.log('Direct SMTP email triggered successfully for contractor briefing attendance.');
            } else {
              console.warn('Direct SMTP is not active or not configured, falling back to Firestore triggers.');
            }
          }).catch(err => {
            console.error('SMTP route fetch failed, fallback is selected:', err);
          });

          await addDoc(collection(db, 'sent_emails'), {
            to: formData.email.trim(),
            toName: formData.ownerName.trim(),
            subject: emailSubject,
            body: emailBody,
            html: emailHtml,
            sentAt: new Date().toISOString()
          });
        }
      }
      setSubmitted(true);
      toast.success(editingRecord ? 'Kehadiran dikemaskini!' : 'Kehadiran didaftarkan!');
      if (editingRecord) {
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-6 md:p-12 flex flex-col items-center justify-center text-center space-y-8 max-w-xl mx-auto">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-black shadow-lg shadow-emerald-500/20"
        >
          <CheckCircle size={32} />
        </motion.div>

        <div className="space-y-2">
          <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
            {editingRecord ? 'Kemaskini Berjaya!' : 'Pendaftaran Berjaya!'}
          </h3>
          <p className="text-xs md:text-sm text-risda-muted uppercase tracking-wider">
            {editingRecord ? 'Maklumat kehadiran telah dikemaskini.' : 'Rekod pendaftaran taklimat tapak anda telah selamat disimpan.'}
          </p>
        </div>

        {/* Status Receipt Card */}
        <div className="w-full bg-risda-card border border-risda-border rounded-2xl p-6 text-left space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <span className="text-[10px] md:text-xs text-risda-muted font-bold uppercase tracking-widest">Status Pendaftaran:</span>
            <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1.5">
              <CheckCircle size={12} /> BERJAYA (AKTIF)
            </span>
          </div>

          {!editingRecord && registeredSeriesNo && (
            <div className="flex flex-col items-center justify-center py-4 bg-white/5 rounded-xl border border-white/5 text-center">
              <span className="text-[10px] md:text-xs text-risda-orange font-black uppercase tracking-[3px] mb-1">No. Siri Kehadiran Anda</span>
              <span className="text-4xl md:text-5xl font-mono font-black text-white tracking-widest">{registeredSeriesNo}</span>
              <span className="text-[9px] text-risda-muted mt-2 uppercase tracking-wider">Sila simpan no. siri ini untuk rujukan</span>
            </div>
          )}

          <div className="text-xs md:text-sm space-y-2.5 text-slate-300 font-medium">
            <div>
              <span className="text-risda-muted block text-[9px] uppercase tracking-wider">Syarikat Berdaftar:</span>
              <span className="text-white font-bold uppercase block">{formData.companyName.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-risda-muted block text-[9px] uppercase tracking-wider">Nama Wakil / Penama:</span>
              <span className="text-white font-bold uppercase block">{formData.ownerName.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-risda-muted block text-[9px] uppercase tracking-wider">Sebut Harga / Tender:</span>
              <span className="text-white font-semibold uppercase block leading-snug">{adTitle.toUpperCase()}</span>
              {tenderNo && <span className="text-risda-orange font-bold text-[10px]">{tenderNo.toUpperCase()}</span>}
            </div>
          </div>
        </div>

        {/* Email or SMS Feedback */}
        {formData.email && formData.email.trim() && formData.email !== '-' && (
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 text-xs text-left text-emerald-300 tracking-wide">
            <p className="font-semibold text-center uppercase tracking-wider mb-1">E-Mel Maklum Balas Dihantar</p>
            <p className="text-center">Satu notifikasi e-mel automatik yang menyatakan pendaftaran taklimat tapak telah berjaya telah terus dihantar ke peti masuk e-mel anda: <strong className="text-white">{formData.email}</strong></p>
          </div>
        )}

        <div className="pt-2 w-full">
          <button
            onClick={() => onSuccess()}
            className="w-full bg-risda-orange text-black hover:bg-risda-orange-hover font-black text-xs md:text-sm py-4.5 px-6 rounded-xl uppercase tracking-[3px] transition-all hover:scale-[1.02] cursor-pointer shadow-lg shadow-risda-orange/10"
          >
            Selesai & Tutup Borang
          </button>
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
                <label className="text-[8px] md:text-[9px] font-bold text-risda-muted uppercase tracking-[2px] px-1">E-mel Rasmi (Masukkan '-' jika tiada)</label>
                <input 
                  type="text"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="cth: syarikat@gmail.com (atau '-' jika tiada)"
                  className="w-full bg-black/40 border border-risda-border rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-xs md:text-sm text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/10"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 flex flex-col">
          <div className="space-y-4 flex-1">
            <label className="text-[9px] md:text-[11px] font-black text-risda-orange uppercase tracking-[3px] px-1 block">
              SENARAI MUAT NAIK SIJIL KELAYAKAN
            </label>
            
            <div className="space-y-4">
              {effectiveLicenses.map((lic) => {
                const file = certificateFiles[lic.key];
                const isDragLocal = !!dragActiveStates[lic.key];
                return (
                  <div key={lic.key} className="space-y-1.5 p-3.5 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[9px] font-black text-white uppercase tracking-wider">
                        {lic.label} <span className="text-white/40 italic font-normal text-[8px] uppercase tracking-normal"> (Jika Ada)</span>
                      </span>
                      {file && (
                        <span className="text-[8px] text-green-400 font-black uppercase tracking-widest flex items-center gap-1">
                          <CheckCircle size={10} /> BERJAYA DIKEPILKAN
                        </span>
                      )}
                    </div>

                    <div 
                      onDragEnter={(e) => handleDrag(lic.key, e)}
                      onDragOver={(e) => handleDrag(lic.key, e)}
                      onDragLeave={(e) => handleDrag(lic.key, e)}
                      onDrop={(e) => handleDrop(lic.key, e)}
                      className={`relative w-full border border-dashed rounded-xl p-4 min-h-[100px] flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden ${
                        isDragLocal ? 'border-risda-orange bg-risda-orange/5' :
                        file ? 'border-green-500/30 bg-green-500/5' : 'border-white/10 hover:border-risda-orange/30 bg-black/30'
                      }`}
                    >
                      <input 
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileChange(lic.key, e)}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      {file ? (
                        <div className="flex flex-col items-center text-center gap-1.5 relative z-20">
                          <div className="w-8 h-8 bg-green-500 text-black rounded-full flex items-center justify-center">
                            <FileIcon size={14} />
                          </div>
                          <div>
                            <p className="text-white text-[10px] font-bold truncate max-w-[200px]">{file.name}</p>
                            <p className="text-[8px] text-risda-muted font-mono uppercase">
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
                            className="text-[9px] font-black text-risda-orange uppercase tracking-wider"
                          >
                            Tukar Fail
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center gap-2">
                          <Upload size={16} className="text-risda-muted animate-pulse" />
                          <div className="space-y-0.5">
                            <p className="text-white text-[9px] font-black uppercase tracking-wider">Klik / Tarik Sijil </p>
                            <p className="text-[8px] text-risda-muted">Format Gambar/PDF (Maks 5MB)</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
