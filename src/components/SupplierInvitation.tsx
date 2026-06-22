import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, deleteDoc, orderBy, where, Timestamp, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  Plus, 
  Trash2, 
  Search, 
  Calendar, 
  FileText, 
  Send, 
  Printer, 
  Mail, 
  Building, 
  Phone, 
  FileCheck, 
  Users, 
  ChevronRight, 
  ArrowLeft,
  Briefcase,
  Layers,
  MapPin,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { exportToPDF, exportOfficialLetterToPDF, exportInvitationLetterToPDF } from '../lib/exportUtils';

interface Supplier {
  id?: string;
  companyName: string;
  phoneNumber: string;
  email: string;
  address?: string;
  cidbSpkk?: string;
  source?: 'attendance' | 'manual';
}

interface Invitation {
  id: string;
  adId: string;
  adTitle: string;
  tenderNo: string;
  referenceNo: string;
  invitationDate: string;
  hijriDate?: string;
  closingDate: string;
  closingTime?: string;
  briefingDate?: string;
  briefingTime?: string;
  briefingVenue?: string;
  submissionVenue?: string;
  officerName: string;
  suppliers: Supplier[];
  createdAt: any;
  createdBy: string;
  state?: string;
  office?: string;
}

interface LocationItem {
  id?: string;
  state: string;
  district: string;
  office: string;
  status?: string;
}

const getLicensesText = (adObj: any) => {
  if (!adObj) return "sijil pendaftaran yang berkaitan";
  const parts: string[] = [];
  if (adObj.licenses?.cidbSpkk) parts.push(adObj.licenseDescriptions?.cidbSpkk || 'CIDB (SPKK) G1 CE01');
  if (adObj.licenses?.cidbPkk) parts.push(adObj.licenseDescriptions?.cidbPkk || 'CIDB (PKK) G1');
  if (adObj.licenses?.stb) parts.push('SIJIL TARAF BUMIPUTERA (STB)');
  if (adObj.licenses?.mof) parts.push(adObj.licenseDescriptions?.mof || 'KEMENTERIAN KEWANGAN MALAYSIA (MOF)');
  if (adObj.licenses?.pukonsa) parts.push(adObj.licenseDescriptions?.pukonsa || 'PUKONSA');
  if (adObj.licenses?.kuhean) parts.push('KUHEAN');
  if (adObj.licenses?.tcc) parts.push('SIJIL KASTAM / TCC');
  
  if (parts.length === 0) return 'CIDB G1 CE01(SPKK) & STB(PKK) atau Pukonsa Sabah Kelas F, KUHEAN & CIDB G1 (PKK)';
  
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} & ${parts[1]}`;
  return parts.slice(0, -1).join(', ') + ' & ' + parts[parts.length - 1];
};

export default function SupplierInvitation() {
  const { user, role, office: userOffice, district: userDistrict, state: userState } = useAuth();
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'directory'>('list');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [listFilters, setListFilters] = useState({
    year: 'ALL',
    state: 'ALL',
    office: 'ALL'
  });
  const [locations, setLocations] = useState<LocationItem[]>([]);

  // Get active staff layout info based on logged in record
  const getStaffDefaultOfficeAndAddress = () => {
    if (userOffice || userDistrict) {
      const queryOffice = (userOffice || '').toUpperCase().trim();
      const queryDistrict = (userDistrict || '').toUpperCase().trim();

      const matching = locations.find(loc => 
        (queryOffice && loc.office?.toUpperCase().includes(queryOffice)) ||
        (queryDistrict && loc.district?.toUpperCase() === queryDistrict)
      );

      if (matching) {
        const officeName = matching.office || `PEJABAT RISDA DAERAH ${matching.district}`;
        const addressText = matching.address || '';
        const pcode = matching.postcode || '';
        const dist = matching.district || '';
        const st = matching.state || '';

        let fullAddress = addressText;
        if (pcode && !fullAddress.includes(pcode)) {
          fullAddress += `, ${pcode}`;
        }
        if (dist && !fullAddress.toUpperCase().includes(dist.toUpperCase())) {
          fullAddress += ` ${dist}`;
        }
        if (st && !fullAddress.toUpperCase().includes(st.toUpperCase())) {
          fullAddress += `, ${st}`;
        }

        return {
          office: officeName.toUpperCase(),
          address: addressText.toUpperCase(),
          fullAddress: `${officeName}, ${fullAddress}`.toUpperCase(),
          district: dist.toUpperCase(),
          state: st.toUpperCase()
        };
      }

      if (userOffice) {
        return {
          office: userOffice.toUpperCase(),
          address: `PEJABAT RISDA DAERAH ${userDistrict || 'BEAUFORT'}, NEGERI ${userState || 'SABAH'}`,
          fullAddress: `${userOffice.toUpperCase()}, PEJABAT RISDA DAERAH ${userDistrict || 'BEAUFORT'}, NEGERI ${userState || 'SABAH'}`.toUpperCase(),
          district: (userDistrict || 'BEAUFORT').toUpperCase(),
          state: (userState || 'SABAH').toUpperCase()
        };
      }
    }

    return {
      office: 'PEJABAT RISDA DAERAH BEAUFORT',
      address: 'K77 & K78, BLOCK K, BEAUFORT SQUARE AVENUE, JALAN BINUNUK, 89800 BEAUFORT, SABAH',
      fullAddress: 'PEJABAT RISDA DAERAH BEAUFORT, K77 & K78, BLOCK K, BEAUFORT SQUARE AVENUE, JALAN BINUNUK, 89800 BEAUFORT, SABAH',
      district: 'BEAUFORT',
      state: 'SABAH'
    };
  };

  const getReferenceNoShortCode = () => {
    const def = getStaffDefaultOfficeAndAddress();
    const dist3 = def.district.substring(0, 3).toUpperCase();
    return `RISDA.${dist3}`;
  };

  const getDistrictFromSubmissionVenue = (venue: string) => {
    if (venue) {
      const parts = venue.split(',');
      if (parts.length > 0) {
        const officeStr = parts[0].toUpperCase();
        if (officeStr.includes('DAERAH')) {
          return officeStr.split('DAERAH')[1].trim();
        }
      }
    }
    return getStaffDefaultOfficeAndAddress().district;
  };

  const getStateFromSubmissionVenue = (venue: string) => {
    if (venue) {
      const venueUpper = venue.toUpperCase();
      if (venueUpper.includes('SABAH')) return 'Sabah';
      if (venueUpper.includes('SARAWAK')) return 'Sarawak';
      if (venueUpper.includes('SEMELAN') || venueUpper.includes('SEMBILAN')) return 'Negeri Sembilan';
      if (venueUpper.includes('SELANGOR')) return 'Selangor';
      if (venueUpper.includes('PERAK')) return 'Perak';
      if (venueUpper.includes('JOHOR')) return 'Johor';
      if (venueUpper.includes('KEDAH')) return 'Kedah';
      if (venueUpper.includes('KELANTAN')) return 'Kelantan';
      if (venueUpper.includes('MELAKA')) return 'Melaka';
      if (venueUpper.includes('PAHANG')) return 'Pahang';
      if (venueUpper.includes('PENANG') || venueUpper.includes('PINANG')) return 'Pulau Pinang';
      if (venueUpper.includes('PERLIS')) return 'Perlis';
      if (venueUpper.includes('TERENGGANU')) return 'Terengganu';
    }
    return getStaffDefaultOfficeAndAddress().state;
  };
  
  // Data lists
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [directorySuppliers, setDirectorySuppliers] = useState<Supplier[]>([]);
  
  // Form state
  const [selectedAdId, setSelectedAdId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [invitationDate, setInvitationDate] = useState(new Date().toISOString().split('T')[0]);
  const [hijriDate, setHijriDate] = useState('');
  const [officerName, setOfficerName] = useState(user?.displayName || '');
  const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([]);
  
  // New invitation custom details (allows overrides)
  const [closingDate, setClosingDate] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [briefingDate, setBriefingDate] = useState('');
  const [briefingTime, setBriefingTime] = useState('');
  const [briefingVenue, setBriefingVenue] = useState('');

  // Supplier directory form
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supForm, setSupForm] = useState<Supplier>({ companyName: '', phoneNumber: '', email: '', address: '', cidbSpkk: '' });

  // Detail Modal
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  const [previewFormat, setPreviewFormat] = useState<'rasmi' | 'tawaran'>('rasmi');
  const [previewPage, setPreviewPage] = useState<1 | 2 | 3>(1);

  const [submissionVenue, setSubmissionVenue] = useState(() => getStaffDefaultOfficeAndAddress().fullAddress);
  const [selectedPrintSupplierId, setSelectedPrintSupplierId] = useState<string>('ALL');
  const [isEditingInvFields, setIsEditingInvFields] = useState(false);
  const [sendingEmailStates, setSendingEmailStates] = useState<Record<string, boolean>>({});
  const [bulkSending, setBulkSending] = useState(false);

  const handleSendSmtpEmail = async (supplier: Supplier, inv: Invitation | any) => {
    const key = supplier.companyName;
    setSendingEmailStates(prev => ({ ...prev, [key]: true }));
    const toastId = toast.loading(`Sedang menghantar e-mel pelawaan & dokumen digital rasmi ke ${supplier.companyName}...`);

    try {
      const subject = `Pelawaan Sebut Harga Rasmi: No. ${inv.tenderNo} - ${inv.adTitle}`;
      
      const matchingAd = ads.find(a => a.id === inv.adId);
      
      // Compile required licenses if ad is found
      let licenseReqStr = 'Rujuk dokumen sebut harga';
      let docInfoStr = '';
      if (matchingAd) {
        const reqs: string[] = [];
        if (matchingAd.licenses?.cidbSpkk) reqs.push(`CIDB & SPKK (Sijil Perolehan Kerja Kerajaan): ${matchingAd.licenseDescriptions?.cidbSpkk || 'Gred berkaitan'}`);
        if (matchingAd.licenses?.cidbPkk) reqs.push(`CIDB & PKK (Sijil Kontraktor Kerja): ${matchingAd.licenseDescriptions?.cidbPkk || 'Gred berkaitan'}`);
        if (matchingAd.licenses?.stb) reqs.push(`Sijil Taraf Bumiputera (STB)`);
        if (matchingAd.licenses?.mof) reqs.push(`Kementerian Kewangan Malaysia (MOF): ${matchingAd.licenseDescriptions?.mof || 'Kod bidang berkaitan'}`);
        if (matchingAd.licenses?.tcc) reqs.push(`Sijil Kastam / TCC`);
        if (matchingAd.licenses?.pukonsa) reqs.push(`PUKONSA: ${matchingAd.licenseDescriptions?.pukonsa || 'Kelas berkaitan'}`);
        if (matchingAd.licenses?.kuhean) reqs.push(`KUHEAN`);
        if (matchingAd.licenses?.others) reqs.push(`Syarat Lain: ${matchingAd.licenses.others}`);
        
        if (reqs.length > 0) {
          licenseReqStr = reqs.map(r => `• ${r}`).join('\n');
        }

        if (matchingAd.docStartDate || matchingAd.docEndDate) {
          docInfoStr = `
--------------------------------------------------
C) BUTIRAN PEMBELIAN / PENGAMBILAN DOKUMEN:
--------------------------------------------------
Tarikh Edaran Dokumen : ${formatBeautifulDate(matchingAd.docStartDate || '')} hingga ${formatBeautifulDate(matchingAd.docEndDate || '')}
Tempat Pengambilan    : ${matchingAd.docVenue || 'Pejabat RISDA Daerah Beaufort'}`;
        }
      }

    // 2. Sukacita dimaklumkan bahawa Pejabat RISDA Daerah Beaufort menjemput syarikat pihak tuan/puan untuk menghadiri taklimat tapak dan mengemukakan tawaran bagi perolehan sebut harga di atas.
    // 3. Surat Pelawaan Rasmi ini dikeluarkan khusus untuk syarikat tuan/puan menyertai proses perolehan ini bersandarkan kriteria pendaftaran yang sah... Let's construct bodyText:

      const bodyText = `UNIT PEROLEHAN & KEWANGAN
PEJABAT RISDA DAERAH BEAUFORT
K77 & K78, BLOCK K, BEAUFORT SQUARE AVENUE,
JALAN BINUNUK, 89800 BEAUFORT, SABAH
NO. TEL: 087-224 335
--------------------------------------------------

Rujukan Kami : ${inv.referenceNo}
Tarikh       : ${formatBeautifulDate(inv.invitationDate)}

Kepada:
${supplier.companyName}
${supplier.address || 'Alamat Terdaftar'}
No. Tel: ${supplier.phoneNumber}
E-mel  : ${supplier.email}

Tuan / Puan,

PELAWAAN MENYERTAI SEBUT HARGA BAGI:
"${inv.adTitle.toUpperCase()}"
NO. SEBUT HARGA: ${inv.tenderNo}

Dengan hormatnya perkara di atas adalah dirujuk.

2.  Sukacita dimaklumkan bahawa Pejabat RISDA Daerah Beaufort menjemput syarikat pihak tuan/puan untuk menghadiri taklimat tapak dan mengemukakan tawaran bagi perolehan sebut harga di atas.

3.  Surat Pelawaan Rasmi ini dikeluarkan khusus untuk syarikat tuan/puan menyertai proses perolehan ini bersandarkan kriteria pendaftaran yang sah. Sila Download PDF yang telah disertakan untuk semakan sama ada anda berminat untuk mengikut lawatan tapak bagi Sebutharga ini. Berikut adalah:

==================================================
LAMPIRAN IKLAN SEBUT HARGA RASMI
==================================================

1. TAJUK PROJEK  : ${inv.adTitle.toUpperCase()}
2. NO. SEBUT HARGA : ${inv.tenderNo}
3. KATEGORI        : ${matchingAd?.category || 'KERJA'}

A) TAKLIMAT DAN LAWATAN TAPAK (WAJIB):
Tarikh / Hari     : ${formatBeautifulDate(inv.briefingDate || '')} (${indonesianDayName(inv.briefingDate || '')})
Masa              : ${inv.briefingTime || '-'}
Tempat Taklimat   : ${inv.briefingVenue || '-'}
Lawatan Tapak     : KAMPUNG MARABA, BEAUFORT

*Nota: Hanya penama di dalam lesen syarikat sahaja yang dibenarkan menghadiri taklimat dan lawatan tapak wajib. Sila bawa sijil asal dan salinan fotostat.*

==================================================

Sekian untuk maklum balas dan tindakan pihak tuan/puan selanjutnya.

"MALAYSIA MADANI"
"Berkhidmat Untuk Negara"

b.p : Pegawai RISDA Daerah Beaufort, Sabah.`;

      // Generate the 3 PDFs in memory as base64 string attachments!
      const attachments: any[] = [];
      try {
        const suratRasmiB64 = await exportOfficialLetterToPDF(inv, supplier, true);
        if (suratRasmiB64) {
          attachments.push({
            filename: `Surat_Rasmi_Pelawaan_${supplier.companyName.replace(/\s+/g, '_')}.pdf`,
            content: suratRasmiB64,
            contentType: 'application/pdf'
          });
        }
      } catch (pdfErr) {
        console.error('Failed to generate Surat Rasmi PDF:', pdfErr);
      }

      try {
        const suratTawaranB64 = await exportInvitationLetterToPDF(inv, supplier, true);
        if (suratTawaranB64) {
          attachments.push({
            filename: `Surat_Tawaran_Pelawaan_${supplier.companyName.replace(/\s+/g, '_')}.pdf`,
            content: suratTawaranB64,
            contentType: 'application/pdf'
          });
        }
      } catch (pdfErr) {
        console.error('Failed to generate Surat Tawaran PDF:', pdfErr);
      }

      if (matchingAd) {
        try {
          const iklanB64 = await exportToPDF(matchingAd, true);
          if (iklanB64) {
            attachments.push({
              filename: `Kenyataan_Iklan_Sebut_Harga_${matchingAd.tenderNo.replace(/\//g, '_')}.pdf`,
              content: iklanB64,
              contentType: 'application/pdf'
            });
          }
        } catch (pdfErr) {
          console.error('Failed to generate Iklan PDF:', pdfErr);
        }
      }

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: supplier.email.trim(),
          subject,
          text: bodyText,
          attachments
        })
      });

      const responseData = await response.json();

      if (response.ok) {
        toast.success(`E-mel pelawaan berjaya dihantar ke ${supplier.companyName}!`, { id: toastId });
        
        // Log into sent_emails collection in Firestore for auditing
        await addDoc(collection(db, 'sent_emails'), {
          to: supplier.email.trim(),
          toName: supplier.companyName,
          subject,
          body: bodyText,
          sentAt: new Date().toISOString(),
          invitationId: inv.id,
          tenderNo: inv.tenderNo
        });
      } else {
        throw new Error(responseData.error || 'Pelayan SMTP gagal menghantar.');
      }

    } catch (err: any) {
      console.error('SMTP sending error:', err);
      toast.error(`Gagal menghantar e-mel: ${err.message || 'Sila semak tetapan SMTP di Secrets.'}`, { id: toastId });
    } finally {
      setSendingEmailStates(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleBulkSendSmtpEmail = async (inv: Invitation | any) => {
    if (!inv.suppliers || inv.suppliers.length === 0) {
      toast.error('Tiada pembekal berdaftar untuk sebut harga ini.');
      return;
    }

    const confirmSend = window.confirm(`Adakah anda pasti mahu menghantar e-mel pelawaan & dokumen digital secara pukal ke semua ${inv.suppliers.length} kontraktor yang tersenarai menggunakan pelayan SMTP?`);
    if (!confirmSend) return;

    setBulkSending(true);
    const mainToastId = toast.loading(`Memulakan penghantaran pukal ke ${inv.suppliers.length} kontraktor...`);
    
    let successCount = 0;
    let failCount = 0;

    for (let s of inv.suppliers) {
      if (!s.email || !s.email.trim() || !s.email.includes('@')) {
        failCount++;
        continue;
      }
      try {
        const subject = `Pelawaan Sebut Harga Rasmi: No. ${inv.tenderNo} - ${inv.adTitle}`;
        const matchingAd = ads.find(a => a.id === inv.adId);
        
        // Compile required licenses if ad is found
        let licenseReqStr = 'Rujuk dokumen sebut harga';
        let docInfoStr = '';
        if (matchingAd) {
          const reqs: string[] = [];
          if (matchingAd.licenses?.cidbSpkk) reqs.push(`CIDB & SPKK (Sijil Perolehan Kerja Kerajaan): ${matchingAd.licenseDescriptions?.cidbSpkk || 'Gred berkaitan'}`);
          if (matchingAd.licenses?.cidbPkk) reqs.push(`CIDB & PKK (Sijil Kontraktor Kerja): ${matchingAd.licenseDescriptions?.cidbPkk || 'Gred berkaitan'}`);
          if (matchingAd.licenses?.stb) reqs.push(`Sijil Taraf Bumiputera (STB)`);
          if (matchingAd.licenses?.mof) reqs.push(`Kementerian Kewangan Malaysia (MOF): ${matchingAd.licenseDescriptions?.mof || 'Kod bidang berkaitan'}`);
          if (matchingAd.licenses?.tcc) reqs.push(`Sijil Kastam / TCC`);
          if (matchingAd.licenses?.pukonsa) reqs.push(`PUKONSA: ${matchingAd.licenseDescriptions?.pukonsa || 'Kelas berkaitan'}`);
          if (matchingAd.licenses?.kuhean) reqs.push(`KUHEAN`);
          if (matchingAd.licenses?.others) reqs.push(`Syarat Lain: ${matchingAd.licenses.others}`);
          
          if (reqs.length > 0) {
            licenseReqStr = reqs.map(r => `• ${r}`).join('\n');
          }

          if (matchingAd.docStartDate || matchingAd.docEndDate) {
            docInfoStr = `
--------------------------------------------------
C) BUTIRAN PEMBELIAN / PENGAMBILAN DOKUMEN:
--------------------------------------------------
Tarikh Edaran Dokumen : ${formatBeautifulDate(matchingAd.docStartDate || '')} hingga ${formatBeautifulDate(matchingAd.docEndDate || '')}
Tempat Pengambilan    : ${matchingAd.docVenue || 'Pejabat RISDA Daerah Beaufort'}`;
          }
        }

        const bodyText = `UNIT PEROLEHAN & KEWANGAN
PEJABAT RISDA DAERAH BEAUFORT
K77 & K78, BLOCK K, BEAUFORT SQUARE AVENUE,
JALAN BINUNUK, 89800 BEAUFORT, SABAH
NO. TEL: 087-224 335
--------------------------------------------------

Rujukan Kami : ${inv.referenceNo}
Tarikh       : ${formatBeautifulDate(inv.invitationDate)}

Kepada:
${s.companyName}
${s.address || 'Alamat Terdaftar'}
No. Tel: ${s.phoneNumber}
E-mel  : ${s.email}

Tuan / Puan,

PELAWAAN MENYERTAI SEBUT HARGA BAGI:
"${inv.adTitle.toUpperCase()}"
NO. SEBUT HARGA: ${inv.tenderNo}

Dengan hormatnya perkara di atas adalah dirujuk.

2.  Sukacita dimaklumkan bahawa Pejabat RISDA Daerah Beaufort menjemput syarikat pihak tuan/puan untuk menghadiri taklimat tapak dan mengemukakan tawaran bagi perolehan sebut harga di atas.

3.  Surat Pelawaan Rasmi ini dikeluarkan khusus untuk syarikat tuan/puan menyertai proses perolehan ini bersandarkan kriteria pendaftaran yang sah. Sila Download PDF yang telah disertakan untuk semakan sama ada anda berminat untuk mengikut lawatan tapak bagi Sebutharga ini. Berikut adalah:

==================================================
LAMPIRAN IKLAN SEBUT HARGA RASMI
==================================================

1. TAJUK PROJEK  : ${inv.adTitle.toUpperCase()}
2. NO. SEBUT HARGA : ${inv.tenderNo}
3. KATEGORI        : ${matchingAd?.category || 'KERJA'}

A) TAKLIMAT DAN LAWATAN TAPAK (WAJIB):
Tarikh / Hari     : ${formatBeautifulDate(inv.briefingDate || '')} (${indonesianDayName(inv.briefingDate || '')})
Masa              : ${inv.briefingTime || '-'}
Tempat Taklimat   : ${inv.briefingVenue || '-'}
Lawatan Tapak     : KAMPUNG MARABA, BEAUFORT

*Nota: Hanya penama di dalam lesen syarikat sahaja yang dibenarkan menghadiri taklimat dan lawatan tapak wajib. Sila bawa sijil asal dan salinan fotostat.*

==================================================

Sekian untuk maklum balas dan tindakan pihak tuan/puan selanjutnya.

"MALAYSIA MADANI"
"Berkhidmat Untuk Negara"

b.p : Pegawai RISDA Daerah Beaufort, Sabah.`;

        // Generate the 3 PDFs in memory as base64 string attachments!
        const attachments: any[] = [];
        try {
          const suratRasmiB64 = await exportOfficialLetterToPDF(inv, s, true);
          if (suratRasmiB64) {
            attachments.push({
              filename: `Surat_Rasmi_Pelawaan_${s.companyName.replace(/\s+/g, '_')}.pdf`,
              content: suratRasmiB64,
              contentType: 'application/pdf'
            });
          }
        } catch (pdfErr) {
          console.error('Failed to generate Surat Rasmi PDF:', pdfErr);
        }

        try {
          const suratTawaranB64 = await exportInvitationLetterToPDF(inv, s, true);
          if (suratTawaranB64) {
            attachments.push({
              filename: `Surat_Tawaran_Pelawaan_${s.companyName.replace(/\s+/g, '_')}.pdf`,
              content: suratTawaranB64,
              contentType: 'application/pdf'
            });
          }
        } catch (pdfErr) {
          console.error('Failed to generate Surat Tawaran PDF:', pdfErr);
        }

        if (matchingAd) {
          try {
            const iklanB64 = await exportToPDF(matchingAd, true);
            if (iklanB64) {
              attachments.push({
                filename: `Kenyataan_Iklan_Sebut_Harga_${matchingAd.tenderNo.replace(/\//g, '_')}.pdf`,
                content: iklanB64,
                contentType: 'application/pdf'
              });
            }
          } catch (pdfErr) {
            console.error('Failed to generate Iklan PDF:', pdfErr);
          }
        }

        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: s.email.trim(),
            subject,
            text: bodyText,
            attachments
          })
        });

        if (response.ok) {
          successCount++;
          await addDoc(collection(db, 'sent_emails'), {
            to: s.email.trim(),
            toName: s.companyName,
            subject,
            body: bodyText,
            sentAt: new Date().toISOString(),
            invitationId: inv.id,
            tenderNo: inv.tenderNo
          });
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('SMTP bulk send error for ', s.companyName, err);
        failCount++;
      }
    }

    toast.dismiss(mainToastId);
    if (successCount > 0) {
      toast.success(`Hebahan e-mel secara pukal selesai! Berjaya: ${successCount} syarikat. Gagal: ${failCount} syarikat.`);
    } else {
      toast.error(`Kumpulan hebahan e-mel gagal. Sila semak konfigurasi SMTP di bahagian Secrets AI Studio.`);
    }
    setBulkSending(false);
  };
  const [editSubmissionVenue, setEditSubmissionVenue] = useState('');
  const [editClosingDate, setEditClosingDate] = useState('');
  const [editClosingTime, setEditClosingTime] = useState('');
  const [editBriefingDate, setEditBriefingDate] = useState('');
  const [editBriefingTime, setEditBriefingTime] = useState('');
  const [editBriefingVenue, setEditBriefingVenue] = useState('');
  const [editInvitationDate, setEditInvitationDate] = useState('');
  const [editHijriDate, setEditHijriDate] = useState('');

  useEffect(() => {
    if (selectedInvitation) {
      const def = getStaffDefaultOfficeAndAddress();
      setEditSubmissionVenue(selectedInvitation.submissionVenue || def.fullAddress);
      setEditClosingDate(selectedInvitation.closingDate || '');
      setEditClosingTime(selectedInvitation.closingTime || '');
      setEditBriefingDate(selectedInvitation.briefingDate || '');
      setEditBriefingTime(selectedInvitation.briefingTime || '');
      setEditBriefingVenue(selectedInvitation.briefingVenue || def.office);
      setEditInvitationDate(selectedInvitation.invitationDate || '');
      setEditHijriDate(selectedInvitation.hijriDate || (selectedInvitation.invitationDate ? getHijriDate(selectedInvitation.invitationDate) : ''));
      setSelectedPrintSupplierId('ALL');
      setIsEditingInvFields(false);
    }
  }, [selectedInvitation, locations]);

  useEffect(() => {
    fetchInvitations();
    fetchAds();
    fetchSuppliers();
    fetchLocations();
  }, []);

  useEffect(() => {
    if (invitationDate) {
      setHijriDate(getHijriDate(invitationDate));
    }
  }, [invitationDate]);

  useEffect(() => {
    if (editInvitationDate) {
      setEditHijriDate(getHijriDate(editInvitationDate));
    }
  }, [editInvitationDate]);

  useEffect(() => {
    if (locations.length > 0) {
      const def = getStaffDefaultOfficeAndAddress();
      setSubmissionVenue(def.fullAddress);
      setBriefingVenue(def.office);
    }
  }, [locations, userOffice, userDistrict]);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'supplier_invitations'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Invitation[];
      setInvitations(list);
    } catch (err) {
      console.error('Error fetching invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAds = async () => {
    try {
      const q = query(collection(db, 'ads'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAds(list);
    } catch (err) {
      console.error('Error fetching advertisements:', err);
    }
  };

  const fetchLocations = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'locations'));
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as LocationItem[];
      setLocations(list);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      // 1. Fetch manual suppliers (registered contractors)
      const supQ = query(collection(db, 'suppliers'));
      const supSnap = await getDocs(supQ);
      const manualSuppliers = supSnap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        source: 'manual' as const
      })) as Supplier[];
      
      // 2. Fetch suppliers from attendance records
      const attQ = query(collection(db, 'attendance'));
      const attSnap = await getDocs(attQ);
      const attendanceSuppliers: Supplier[] = [];
      
      attSnap.docs.forEach(d => {
        const data = d.data();
        if (data.companyName && data.companyName.trim()) {
          attendanceSuppliers.push({
            id: `attendance_${d.id}`,
            companyName: data.companyName.toUpperCase().trim(),
            phoneNumber: data.phoneNumber || '',
            email: data.email || '',
            address: data.companyAddress || data.address || '',
            cidbSpkk: data.certificateName || data.cidbSpkk || '',
            source: 'attendance' as const
          });
        }
      });
      
      // 3. Merge & Deduplicate based on company name and attached certificate to avoid double entries
      const mergedMap = new Map<string, Supplier>();
      
      // Seed with attendance records first
      attendanceSuppliers.forEach(s => {
        const compName = s.companyName.toUpperCase().trim();
        const licenseKey = s.cidbSpkk ? s.cidbSpkk.toUpperCase().trim() : 'NO_LICENSE';
        const key = `${compName}||${licenseKey}`;
        
        const existing = mergedMap.get(key);
        // Keep the one with phone or address if existing has empty values
        if (!existing || (s.phoneNumber && !existing.phoneNumber)) {
          mergedMap.set(key, s);
        }
      });
      
      // Overwrite or enrich with manual registrations
      manualSuppliers.forEach(s => {
        const compName = s.companyName.toUpperCase().trim();
        const licenseKey = s.cidbSpkk ? s.cidbSpkk.toUpperCase().trim() : 'NO_LICENSE';
        const key = `${compName}||${licenseKey}`;
        
        let matched = false;
        for (const [mKey, mVal] of mergedMap.entries()) {
          const mCompName = mVal.companyName.toUpperCase().trim();
          if (mCompName === compName) {
            const mLicenseKey = mVal.cidbSpkk ? mVal.cidbSpkk.toUpperCase().trim() : 'NO_LICENSE';
            // If the license matches OR either is NO_LICENSE, we merge/replace under the manual detail
            if (mLicenseKey === licenseKey || mLicenseKey === 'NO_LICENSE' || licenseKey === 'NO_LICENSE') {
              mergedMap.delete(mKey);
              mergedMap.set(key, {
                ...mVal,
                ...s,
                id: s.id,
                source: 'manual' as const
              });
              matched = true;
              break;
            }
          }
        }
        
        if (!matched) {
          mergedMap.set(key, s);
        }
      });
      
      const finalSuppliers = Array.from(mergedMap.values()).sort((a, b) => 
        a.companyName.localeCompare(b.companyName)
      );
      
      setDirectorySuppliers(finalSuppliers);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  // Sync details when Ad is selected
  const handleAdSelectionChange = (adId: string) => {
    setSelectedAdId(adId);
    const selectedAd = ads.find(a => a.id === adId);
    const def = getStaffDefaultOfficeAndAddress();
    if (selectedAd) {
      setClosingDate(selectedAd.closingDate || '');
      setClosingTime(selectedAd.closingTime || '');
      setBriefingDate(selectedAd.briefingDate || selectedAd.visitDate || '');
      setBriefingTime(selectedAd.briefingTime || '');
      setBriefingVenue(selectedAd.briefingVenue || selectedAd.visitVenue || def.office);
      setSubmissionVenue(selectedAd.docVenue || def.fullAddress);
      
      // Auto generate reference mock number if empty
      if (!referenceNo) {
        const year = new Date().getFullYear();
        const rand = Math.floor(100 + Math.random() * 900);
        const code = getReferenceNoShortCode();
        setReferenceNo(`${code}.100-3/4/(${rand}) Jld.${year % 100}`);
      }
    } else {
      setClosingDate('');
      setClosingTime('');
      setBriefingDate('');
      setBriefingTime('');
      setBriefingVenue('');
      setSubmissionVenue(def.fullAddress);
    }
  };

  // Save regular supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supForm.companyName.trim()) {
      toast.error('Sila isi nama syarikat');
      return;
    }
    const toastId = toast.loading('Menyimpan maklumat pembekal...');
    try {
      const normalizedName = supForm.companyName.toUpperCase().trim();
      const targetId = `supplier_${normalizedName.replace(/[^A-Z0-9]/g, '_')}`;
      
      let oldId = editingSupplier?.id;
      if (oldId && oldId !== targetId && !oldId.startsWith('attendance_')) {
        try {
          await deleteDoc(doc(db, 'suppliers', oldId));
        } catch (e) {
          console.error('Error deleting old supplier document:', e);
        }
      }

      await setDoc(doc(db, 'suppliers', targetId), {
        companyName: supForm.companyName.trim(),
        phoneNumber: supForm.phoneNumber.trim(),
        email: supForm.email.trim(),
        address: supForm.address?.trim() || '',
        cidbSpkk: supForm.cidbSpkk?.trim() || '',
        updatedAt: Timestamp.now()
      });
      toast.success(editingSupplier ? 'Maklumat pembekal dikemaskini!' : 'Pembekal didaftarkan!', { id: toastId });
      setShowSupplierModal(false);
      setEditingSupplier(null);
      setSupForm({ companyName: '', phoneNumber: '', email: '', address: '', cidbSpkk: '' });
      fetchSuppliers();
    } catch (err) {
      console.error('Error saving supplier:', err);
      toast.error('Gagal menyimpan pembekal.', { id: toastId });
    }
  };

  // Delete regular supplier
  const handleDeleteSupplier = async (id: string) => {
    if (id.startsWith('attendance_')) {
      toast.error('Pembekal daripada data kehadiran hanya boleh diuruskan melalui rekod kehadiran asal.');
      return;
    }
    if (!window.confirm('Adakah anda pasti untuk memadam pembekal ini dari pangkalan data?')) return;
    try {
      await deleteDoc(doc(db, 'suppliers', id));
      toast.success('Pembekal berjaya dipadam.');
      fetchSuppliers();
    } catch (err) {
      toast.error('Gagal memadam pembekal.');
    }
  };

  // Toggle supplier invitation list selection
  const toggleSelectSupplier = (supplier: Supplier) => {
    const exists = selectedSuppliers.some(s => s.companyName === supplier.companyName);
    if (exists) {
      setSelectedSuppliers(selectedSuppliers.filter(s => s.companyName !== supplier.companyName));
    } else {
      setSelectedSuppliers([...selectedSuppliers, supplier]);
    }
  };

  // Save new invitation letter run
  const handleSaveInvitation = async () => {
    if (!selectedAdId) {
      toast.error('Sila pilih Sebut Harga / Projek terlebih dahulu.');
      return;
    }
    if (!referenceNo.trim()) {
      toast.error('Sila isi No. Rujukan Fail.');
      return;
    }
    if (selectedSuppliers.length === 0) {
      toast.error('Sila pilih sekurang-kurangnya satu pembekal untuk dipelawa.');
      return;
    }

    const selectedAd = ads.find(a => a.id === selectedAdId);
    if (!selectedAd) return;

    const toastId = toast.loading('Menyimpan senarai pelawaan sebutharga...');
    try {
      const invitationId = `invitation_${Date.now()}`;
      const payload: Invitation = {
        id: invitationId,
        adId: selectedAdId,
        adTitle: selectedAd.title,
        tenderNo: selectedAd.tenderNo,
        referenceNo: referenceNo.trim(),
        invitationDate: invitationDate,
        hijriDate: hijriDate || getHijriDate(invitationDate),
        closingDate: closingDate,
        closingTime: closingTime,
        briefingDate: briefingDate,
        briefingTime: briefingTime,
        briefingVenue: briefingVenue,
        officerName: officerName,
        suppliers: selectedSuppliers,
        createdAt: Timestamp.now(),
        createdBy: user?.email || 'System',
        state: selectedAd.state || '',
        office: selectedAd.office || '',
        submissionVenue: submissionVenue
      };

      await setDoc(doc(db, 'supplier_invitations', invitationId), payload);

      const def = getStaffDefaultOfficeAndAddress();

      // Send direct notification email via sent_emails to each selected supplier
      if (payload.suppliers && payload.suppliers.length > 0) {
        for (const s of payload.suppliers) {
          if (s.email && s.email.trim()) {
            const emailSubject = `Pelawaan Menyertai Sebut Harga RISDA ${def.district} - No. Sebut Harga: ${payload.tenderNo}`;
            const emailBody = `Assalamualaikum dan Salam Sejahtera,

Kepada:
${s.companyName.toUpperCase()}
${s.address ? s.address.toUpperCase().replace(/\n/g, ', ') : 'TIADA REKOD ALAMAT'}

Tuan/Puan,

PELAWAAN MENYERTAI SEBUT HARGA BAGI:
"${payload.adTitle.toUpperCase()}"
NO. SEBUT HARGA: ${payload.tenderNo}

Dengan hormatnya perkara di atas adalah dirujuk.

2.    Sukacita dimaklumkan bahawa ${def.office} mempelawa syarikat pihak tuan/puan untuk mengemukakan tawaran bagi perolehan sebut harga tersebut di atas.

3.    Ketetapan bagi taklimat, lawatan tapak dan serahan sebut harga adalah seperti berikut:

TAKLIMAT / LAWATAN TAPAK (WAJIB):
- Tarikh / Hari : ${formatBeautifulDate(payload.briefingDate || '')} (${indonesianDayName(payload.briefingDate || '')})
- Masa         : ${payload.briefingTime || '-'}
- Tempat       : ${payload.briefingVenue || '-'}

TARIKH TUTUP & SERAHAN:
- Tarikh Tutup : Sebelum jam ${payload.closingTime || '-'} pada ${formatBeautifulDate(payload.closingDate || '')} (${indonesianDayName(payload.closingDate || '')})
- Tempat Serah : ${payload.submissionVenue || def.fullAddress}

No. Rujukan Fail Surat: ${payload.referenceNo}

4.    Sila bawa bersama dokumen lesen syarikat asal (CIDB, SPKK, PUKONSA atau MOF yang berkaitan) beserta satu salinan semasa taklimat dijalankan. Hanya penama di dalam lesen sahaja dibenarkan mendaftar kehadiran taklimat tapak.

Sekian, terima kasih.

"MALAYSIA MADANI"
"BERKHIDMAT UNTUK NEGARA"

Saya yang menjalankan amanah,
(${payload.officerName ? payload.officerName.toUpperCase() : def.office})
b.p. Pegawai RISDA Daerah ${def.district} / Pengarah RISDA Negeri ${def.state}`;

            try {
              await addDoc(collection(db, 'sent_emails'), {
                to: s.email.trim(),
                toName: s.companyName,
                subject: emailSubject,
                body: emailBody,
                sentAt: Timestamp.now()
              });
            } catch (emailErr) {
              console.error(`Error queuing email for supplier ${s.companyName}:`, emailErr);
            }
          }
        }
      }

      toast.success('Rekod pelawaan berjaya disimpan dan dimuktamadkan!', { id: toastId });
      
      // Clear form and switch tab
      setSelectedAdId('');
      setReferenceNo('');
      setSelectedSuppliers([]);
      setSubmissionVenue(def.fullAddress);
      fetchInvitations();
      setActiveTab('list');
    } catch (err) {
      console.error('Error saving invitation:', err);
      toast.error('Gagal menyimpan rekod pelawaan.', { id: toastId });
    }
  };

  const handleDeleteInvitation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Adakah anda pasti untuk memadam rekod pelawaan sebutharga ini?')) return;
    try {
      await deleteDoc(doc(db, 'supplier_invitations', id));
      toast.success('Rekod pelawaan dipadam.');
      fetchInvitations();
      if (selectedInvitation?.id === id) {
        setSelectedInvitation(null);
      }
    } catch (err) {
      toast.error('Gagal memadam rekod.');
    }
  };

  // Helper formats
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

  const formatBeautifulDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN', 'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
    } catch (e) {
      return dateStr;
    }
  };

  const getHijriDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      
      const formatter = new Intl.DateTimeFormat('ms-MY-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      let result = formatter.format(d)
        .replace(/Zul-Kada/g, 'Zulkaedah')
        .replace(/Zul-Hijja/g, 'Zulhijjah')
        .replace(/Rabi’ al-awwal/g, 'Rabiulawal')
        .replace(/Rabi’ al-thani/g, 'Rabiulakhir')
        .replace(/Jumada al-awwal/g, 'Jamadilawal')
        .replace(/Jumada al-thani/g, 'Jamadilakhir')
        .replace(/Sha’ban/g, 'Syaaban')
        .replace(/Ramadan/g, 'Ramadan')
        .replace(/Shawwal/g, 'Syawal')
        .replace(/Dhu al-Qi'dah/g, 'Zulkaedah')
        .replace(/Dhu al-Hijjah/g, 'Zulhijjah')
        .replace(/Dhu'l-Qi'dah/g, 'Zulkaedah')
        .replace(/Dhu'l-Hijjah/g, 'Zulhijjah');
      
      const monthsEn = ['Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", "Jumada al-Awwal", "Jumada al-Thani", 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qi'dah", "Dhu al-Hijjah"];
      const monthsMs = ['Muharram', 'Safar', 'Rabiulawal', 'Rabiulakhir', 'Jamadilawal', 'Jamadilakhir', 'Rejab', 'Syaaban', 'Ramadan', 'Syawal', 'Zulkaedah', 'Zulhijjah'];
      
      monthsEn.forEach((m, idx) => {
        const regex = new RegExp(m, 'gi');
        result = result.replace(regex, monthsMs[idx]);
      });

      if (result && !result.endsWith('H') && !result.endsWith('AH')) {
        return `${result}H`;
      }
      return result;
    } catch (e) {
      return '';
    }
  };

  // Notification content generator
  const getWhatsAppURL = (supplier: Supplier, inv: Invitation | any) => {
    const textMsg = `*PELAWAAN MENYERTAI SEBUT HARGA - RISDA DAERAH BEAUFORT*

Salam Sejahtera,
Kepada: *${supplier.companyName}*

Tuan/Puan dijemput menyertai sebut harga rasmi berikut:
📌 *Tender No:* ${inv.tenderNo}
📋 *Sebut Harga:* ${inv.adTitle}

*BUTIR TAKLIMAT/LAWATAN TAPAK (WAJIB):*
📅 *Tarikh/Hari:* ${formatBeautifulDate(inv.briefingDate || '')} (${indonesianDayName(inv.briefingDate || '')})
⏰ *Masa:* ${inv.briefingTime || '-'}
📍 *Tempat:* ${inv.briefingVenue || '-'}

*BUTIR SERAHAN SEBUT HARGA:*
📅 *Tarikh Tutup:* ${formatBeautifulDate(inv.closingDate || '')} (${indonesianDayName(inv.closingDate || '')})
⏰ *Masa Cetusan:* ${inv.closingTime || '-'}

Sila layari pautan rasmi di bawah untuk pendaftaran kehadiran taklimat tapak dan maklumat lanjut:
🌐 ${window.location.protocol}//${window.location.host}/?adId=${inv.adId}

No Rujukan Fail: *${inv.referenceNo}*
Pejabat Penerbit: *RISDA Daerah Beaufort, Sabah*

Sekian, Terima Kasih.`;

    const cleanPhone = supplier.phoneNumber.replace(/[^0-9+]/g, '');
    const finalPhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : (cleanPhone.startsWith('60') ? cleanPhone : `60${cleanPhone}`);
    return `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(textMsg)}`;
  };

  const getEmailMailto = (supplier: Supplier, inv: Invitation | any) => {
    const matchingAd = ads.find(a => a.id === inv.adId);
    
    // Compile required licenses if ad is found
    let licenseReqStr = 'Rujuk dokumen sebut harga';
    let docInfoStr = '';
    if (matchingAd) {
      const reqs: string[] = [];
      if (matchingAd.licenses?.cidbSpkk) reqs.push(`CIDB & SPKK (Sijil Perolehan Kerja Kerajaan): ${matchingAd.licenseDescriptions?.cidbSpkk || 'Gred berkaitan'}`);
      if (matchingAd.licenses?.cidbPkk) reqs.push(`CIDB & PKK (Sijil Kontraktor Kerja): ${matchingAd.licenseDescriptions?.cidbPkk || 'Gred berkaitan'}`);
      if (matchingAd.licenses?.stb) reqs.push(`Sijil Taraf Bumiputera (STB)`);
      if (matchingAd.licenses?.mof) reqs.push(`Kementerian Kewangan Malaysia (MOF): ${matchingAd.licenseDescriptions?.mof || 'Kod bidang berkaitan'}`);
      if (matchingAd.licenses?.tcc) reqs.push(`Sijil Kastam / TCC`);
      if (matchingAd.licenses?.pukonsa) reqs.push(`PUKONSA: ${matchingAd.licenseDescriptions?.pukonsa || 'Kelas berkaitan'}`);
      if (matchingAd.licenses?.kuhean) reqs.push(`KUHEAN`);
      if (matchingAd.licenses?.others) reqs.push(`Syarat Lain: ${matchingAd.licenses.others}`);
      
      if (reqs.length > 0) {
        licenseReqStr = reqs.map(r => `• ${r}`).join('\n');
      }

      if (matchingAd.docStartDate || matchingAd.docEndDate) {
        docInfoStr = `
--------------------------------------------------
C) BUTIRAN PEMBELIAN / PENGAMBILAN DOKUMEN:
--------------------------------------------------
Tarikh Edaran Dokumen : ${formatBeautifulDate(matchingAd.docStartDate || '')} hingga ${formatBeautifulDate(matchingAd.docEndDate || '')}
Tempat Pengambilan    : ${matchingAd.docVenue || 'Pejabat RISDA Daerah Beaufort'}`;
      }
    }

    const subject = `Pelawaan Sebut Harga: ${inv.tenderNo} - ${inv.adTitle}`;
    
    const body = `UNIT PEROLEHAN & KEWANGAN
PEJABAT RISDA DAERAH BEAUFORT
K77 & K78, BLOCK K, BEAUFORT SQUARE AVENUE,
JALAN BINUNUK, 89800 BEAUFORT, SABAH
NO. TEL: 087-224 335
--------------------------------------------------

Rujukan Kami : ${inv.referenceNo}
Tarikh       : ${formatBeautifulDate(inv.invitationDate)}

Kepada:
${supplier.companyName}
${supplier.address || 'Alamat Terdaftar'}
No. Tel: ${supplier.phoneNumber}
E-mel  : ${supplier.email}

Tuan / Puan,

PELAWAAN MENYERTAI SEBUT HARGA BAGI:
"${inv.adTitle.toUpperCase()}"
NO. SEBUT HARGA: ${inv.tenderNo}

Dengan hormatnya perkara di atas adalah dirujuk.

2.  Sukacita dimaklumkan bahawa Pejabat RISDA Daerah Beaufort menjemput syarikat pihak tuan/puan untuk menghadiri taklimat tapak dan mengemukakan tawaran bagi perolehan sebut harga di atas.

3.  Surat Pelawaan Rasmi ini dikeluarkan khusus untuk syarikat tuan/puan menyertai proses perolehan ini bersandarkan kriteria pendaftaran yang sah. 

Sila teliti lampiran butiran iklan sebut harga di bawah untuk maklumat lengkap syarat penyertaan dan keperluan dokumen.


==================================================
LAMPIRAN IKLAN SEBUT HARGA RASMI
==================================================

1. TAJUK PROJEK  : ${inv.adTitle.toUpperCase()}
2. NO. SEBUT HARGA : ${inv.tenderNo}
3. KATEGORI        : ${matchingAd?.category || 'KERJA'}

A) TAKLIMAT DAN LAWATAN TAPAK (WAJIB):
Tarikh / Hari     : ${formatBeautifulDate(inv.briefingDate || '')} (${indonesianDayName(inv.briefingDate || '')})
Masa              : ${inv.briefingTime || '-'}
Tempat Taklimat   : ${inv.briefingVenue || '-'}
Lawatan Tapak     : KAMPUNG MARABA, BEAUFORT

*Nota: Hanya penama di dalam lesen syarikat sahaja yang dibenarkan menghadiri taklimat dan lawatan tapak wajib. Sila bawa sijil asal dan salinan fotostat.*

--------------------------------------------------
E) PAUTAN RASMI DOKUMEN DIGITAL (CETAK & SIMPAN PDF):
--------------------------------------------------
Sila muat turun, bincang, atau cetak dokumen rasmi di pautan di bawah untuk tujuan simpanan fizikal syarikat tuan/puan:

📄 1. SURAT PELAWAAN RASMI DIGITAL (PDF):
👉 ${window.location.protocol}//${window.location.host}/?viewLetter=${inv.id}&company=${encodeURIComponent(supplier.companyName)}

📢 2. BUTIRAN IKLAN SEBUT HARGA & DAFTAR LOG KEHADIRAN:
👉 ${window.location.protocol}//${window.location.host}/?adId=${inv.adId}

==================================================

Sekian untuk maklum balas dan tindakan pihak tuan/puan selanjutnya.

"MALAYSIA MADANI"
"Berkhidmat Untuk Negara"

Saya yang menjalankan amanah,

Pejabat RISDA Daerah Beaufort, Sabah.
(Penjanaan Pelawaan Digital b.p. Pegawai RISDA Daerah Beaufort)`;

    return `mailto:${supplier.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handlePrintDraft = async (inv: Invitation | any, formatType: 'rasmi' | 'tawaran' = 'rasmi') => {
    if (formatType === 'rasmi') {
      try {
        // If printing specified supplier or all
        const suppliersToPrint = selectedPrintSupplierId === 'ALL'
          ? inv.suppliers
          : inv.suppliers.filter((s: Supplier) => s.id === selectedPrintSupplierId || s.companyName === selectedPrintSupplierId);

        if (!suppliersToPrint || suppliersToPrint.length === 0) {
          toast.error('Tiada kontraktor terpilih untuk dimuat turun PDF.');
          return;
        }

        const tId = toast.loading('Menjana dan memuat turun PDF Surat Rasmi...');

        // Loop and download each PDF directly using exportOfficialLetterToPDF
        for (const s of suppliersToPrint) {
          await exportOfficialLetterToPDF(inv, s, false);
        }

        toast.success('Muat turun PDF Surat Rasmi Berjaya!', { id: tId });
      } catch (err: any) {
        console.error('Gagal menjana PDF Surat Rasmi:', err);
        toast.error('Gagal menjana PDF Surat Rasmi. Sila cuba lagi.');
      }
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Sila benarkan pop-up browser untuk mencetakan surat.');
      return;
    }

    const indonesianDayName = (dateStr: string) => {
      if (!dateStr) return '';
      const days = ['AHAD', 'ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT', 'SABTU'];
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? '' : days[d.getDay()];
    };

    const isTawaran = formatType === 'tawaran';
    const documentTitle = isTawaran 
      ? `Surat Tawaran Sebutharga - ${inv.tenderNo}` 
      : `Surat Pelawaan Sebutharga - ${inv.tenderNo}`;

    const matchingAd = ads.find(a => a.id === inv.adId);
    
    const licensesText = getLicensesText(matchingAd);

    // If printing specified supplier or all
    const suppliersToPrint = selectedPrintSupplierId === 'ALL'
      ? inv.suppliers
      : inv.suppliers.filter((s: Supplier) => s.id === selectedPrintSupplierId || s.companyName === selectedPrintSupplierId);

    // Compute dynamic office header info
    let officeVal = 'PEJABAT RISDA DAERAH BEAUFORT';
    let addressVal = 'K77 & K78, Block K, Beaufort Square Avenue 1,<br/>Jalan Binunuk,<br/>89800 Beaufort, Sabah';
    let emailVal = 'prdbeaufort@risda.gov.my';
    let telVal = '087-224335/336';
    
    const def = getStaffDefaultOfficeAndAddress();

    if (inv?.submissionVenue) {
      const parts = inv.submissionVenue.split(',');
      if (parts.length > 0) {
        officeVal = parts[0].trim().toUpperCase();
      }
      if (parts.length > 1) {
        addressVal = parts.slice(1).map((p: string) => p.trim()).join(',<br/>').toUpperCase();
      }
      const rawOffice = parts[0] || '';
      const cleanedOfficeName = rawOffice.replace('PEJABAT RISDA DAERAH', '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanedOfficeName) {
        emailVal = `prd${cleanedOfficeName}@risda.gov.my`;
      }
    } else {
      officeVal = def.office;
      addressVal = def.address.replace(/,\s*/g, ',<br/>');
      const cleanedOfficeName = def.office.replace('PEJABAT RISDA DAERAH', '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanedOfficeName) {
        emailVal = `prd${cleanedOfficeName}@risda.gov.my`;
      }
    }

    let documentContentHtml = '';
    if (isTawaran) {
      documentContentHtml = suppliersToPrint.map((s: Supplier) => `
        <div class="letter-page" style="page-break-after: always; position: relative;">
          <!-- RISDA Image Logo with dynamic fallbacks -->
          <div style="text-align: center; margin-bottom: 25px; line-height: 1.2;">
            <img 
              src="${window.location.origin}/PUBLIC/intrologo_RISDA.png" 
              onerror="this.onerror=null; this.src='${window.location.origin}/api/logo'; this.onerror=function(){this.src='https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png'}"
              style="height: 65px; width: auto; margin: 0 auto 12px auto; display: block;" 
              referrerpolicy="no-referrer"
              alt="RISDA Logo"
            />
            <div style="border-bottom: 2px solid #000; margin-top: 15px; margin-bottom: 25px;"></div>
            <div style="font-size: 13.5pt; font-weight: bold; text-decoration: underline; letter-spacing: 1px; color: #000; text-transform: uppercase;">SURAT TAWARAN PELAWAAN SEBUTHARGA</div>
          </div>

          <!-- Metadata info table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11pt; color: #000; line-height: 1.5;">
            <tbody>
              <tr>
                <td style="width: 25%; font-weight: bold; padding: 4px 0; vertical-align: top;">No.Sebutharga</td>
                <td style="width: 3%; padding: 4px 0; text-align: center; vertical-align: top;">:</td>
                <td style="width: 72%; font-weight: bold; padding: 4px 0; vertical-align: top; font-family: monospace;">${inv.tenderNo}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 4px 0; vertical-align: top;">Sebutharga</td>
                <td style="padding: 4px 0; text-align: center; vertical-align: top;">:</td>
                <td style="font-weight: bold; padding: 4px 0; vertical-align: top; text-transform: uppercase;">${inv.adTitle}</td>
              </tr>
              <tr style="height: 15px;"><td colspan="3"></td></tr>
              <tr>
                <td style="font-weight: bold; padding: 4px 0; vertical-align: top;">Pembekal/Kontraktor</td>
                <td style="padding: 4px 0; text-align: center; vertical-align: top;">:</td>
                <td style="font-weight: bold; padding: 4px 0; vertical-align: top; text-transform: uppercase;">${s.companyName}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 4px 0; vertical-align: top;">Alamat</td>
                <td style="padding: 4px 0; text-align: center; vertical-align: top;">:</td>
                <td style="padding: 4px 0; vertical-align: top; text-transform: uppercase; line-height: 1.4;">${s.address ? s.address.toUpperCase().replace(/\n/g, '<br/>') : 'TIADA ALAMAT BERDAFTAR'}</td>
              </tr>
            </tbody>
          </table>

          <!-- 5 Items -->
          <div style="font-size: 11pt; color: #000; text-align: justify; line-height: 1.6; margin-top: 15px; font-family: 'Times New Roman', Times, serif;">
            <div style="display: flex; margin-bottom: 15px; align-items: start;">
              <span style="width: 25px; font-weight: bold; flex-shrink: 0;">1.</span>
              <div>
                Sebut harga adalah dipelawa daripada Kontraktor-Kontraktor yang berdaftar dengan 
                <strong style="text-decoration: underline;">${licensesText.toUpperCase()}</strong> dan masih sah laku pendaftaran untuk dibenarkan menyertai sebutharga ini.
              </div>
            </div>

            <div style="display: flex; margin-bottom: 15px; align-items: start;">
              <span style="width: 25px; font-weight: bold; flex-shrink: 0;">2.</span>
              <div>
                Dokumen SebutHarga yang telah dilengkapi hendaklah dimasukkan ke dalam satu sampul surat bermetri dan bertulis nombor tawaran disebelah kiri atasnya dan dimasuk ke dalam Peti Tawaran yang terletak di 
                <strong style="text-decoration: underline;">${(inv.submissionVenue || def.fullAddress).toUpperCase()}</strong> sebelum atau pada 
                <strong style="text-decoration: underline;">${formatBeautifulDate(inv.closingDate)}</strong> Jam/Masa 
                <strong style="text-decoration: underline;">${inv.closingTime || '12.00 TENGAHARI'}</strong>.
              </div>
            </div>

            <div style="display: flex; margin-bottom: 15px; align-items: start;">
              <span style="width: 25px; font-weight: bold; flex-shrink: 0;">3.</span>
              <div>
                Syarat-syarat Sebut Harga, Pelan Lukisan serta Ringkasan Sebut Harga dikembarkan bersama-sama ini.
              </div>
            </div>

            <div style="display: flex; margin-bottom: 15px; align-items: start;">
              <span style="width: 25px; font-weight: bold; flex-shrink: 0;">4.</span>
              <div>
                Kontraktor adalah diwajibkan menghadiri taklimat dan lawatan tapak pada 
                <strong style="text-decoration: underline;">${inv.briefingDate ? `${formatBeautifulDate(inv.briefingDate)} (${indonesianDayName(inv.briefingDate).toUpperCase()})` : '-'}</strong> ${inv.briefingTime ? `Jam <strong style="text-decoration: underline;">${inv.briefingTime}</strong>` : ''}. Taklimat akan di sampaikan hanya sekali sahaja dan pihak kontraktor dikehendaki berkumpul di 
                <strong style="text-decoration: underline;">${(inv.briefingVenue || def.office).toUpperCase()}</strong> pada tarikh dan masa yang telah ditetapkan diatas.
              </div>
            </div>

            <div style="display: flex; margin-bottom: 15px; align-items: start;">
              <span style="width: 25px; font-weight: bold; flex-shrink: 0;">5.</span>
              <div>
                Pihak RISDA tidak terikat untuk menerima sebut harga yang terendah sekali atau mana-mana sebutharga lain.
              </div>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      const sharedHeaderHtml = `
            <!-- RISDA HEADER KEPALA SURAT -->
            <div style="display: flex; align-items: start; justify-content: space-between; margin-bottom: 5px;">
              <div style="flex: 0 0 85px; text-align: left; margin-right: 15px;">
                <img 
                  src="${window.location.origin}/PUBLIC/intrologo_RISDA.png" 
                  onerror="this.onerror=null; this.src='${window.location.origin}/api/logo'; this.onerror=function(){this.src='https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png'}"
                  style="height: 75px; width: auto; display: block;" 
                  referrerpolicy="no-referrer"
                  alt="RISDA Logo"
                />
              </div>
              <div style="flex: 1; text-align: left; font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.15; font-size: 10pt;">
                <strong style="font-size: 11pt; display: block; margin-bottom: 2px; text-transform: uppercase;">PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH<br/>(RISDA)</strong>
                <strong style="font-size: 11pt; display: block; margin-bottom: 2px; text-transform: uppercase;">${officeVal}</strong>
                <div style="font-size: 8.5pt; display: flex; justify-content: space-between; align-items: flex-end; color: #000; line-height: 1.35; margin-top: 4px; width: 100%;">
                  <div style="text-align: left;">
                    ${addressVal}
                  </div>
                  <div style="text-align: right;">
                    <table style="border-collapse: collapse; font-size: 8.5pt; color: #000; font-family: 'Times New Roman', Times, serif; line-height: 1.3; margin-left: auto;">
                      <tr>
                        <td style="padding: 0; text-align: left; font-weight: bold; width: 85px;">TEL</td>
                        <td style="padding: 0 4px; text-align: left;">:</td>
                        <td style="padding: 0; text-align: left; white-space: nowrap;">${telVal}</td>
                      </tr>
                      <tr>
                        <td style="padding: 0; text-align: left; font-weight: bold; width: 85px;">EMAIL</td>
                        <td style="padding: 0 4px; text-align: left;">:</td>
                        <td style="padding: 0; text-align: left; white-space: nowrap;">${emailVal}</td>
                      </tr>
                      <tr>
                        <td style="padding: 0; text-align: left; font-weight: bold; width: 85px;">LAMAN WEB</td>
                        <td style="padding: 0 4px; text-align: left;">:</td>
                        <td style="padding: 0; text-align: left; white-space: nowrap;">http://www.risda.gov.my</td>
                      </tr>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div style="border-bottom: 2px solid #000; margin-top: 10px; margin-bottom: 15px;"></div>
      `;

      documentContentHtml = suppliersToPrint.map((s: Supplier) => {
        const docDate = inv.invitationDate || inv.createdAt || '';
        let rawDate = '';
        if (typeof docDate === 'string') {
          rawDate = docDate;
        } else if (docDate && typeof docDate.toDate === 'function') {
          try {
            rawDate = docDate.toDate().toISOString().split('T')[0];
          } catch (e) {}
        } else if (docDate && docDate.seconds) {
          try {
            rawDate = new Date(docDate.seconds * 1000).toISOString().split('T')[0];
          } catch (e) {}
        }
        const letterDateStr = rawDate ? formatBeautifulDate(rawDate) : '10 Februari 2025';

        return `
          <!-- PAGE 1: SURAT UTAMA -->
          <div class="letter-page" style="page-break-after: always; position: relative; min-height: 10.2in; box-sizing: border-box; padding-bottom: 1.25in;">
            ${sharedHeaderHtml}

            <!-- RUJUKAN & TARIKH BOX -->
            <table style="margin-left: auto; margin-right: 0; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; line-height: 1.3; margin-bottom: 20px;">
              <tbody>
                <tr>
                  <td style="padding: 2px 0; font-weight: normal; text-align: left; padding-right: 8px;">Ruj. Kami</td>
                  <td style="padding: 2px 0; text-align: center; padding-right: 8px;">:</td>
                  <td style="padding: 2px 0; text-align: left; font-family: 'Times New Roman', Times, serif; font-weight: normal;">${inv.referenceNo || 'RISDAS.B(S)400-10/2/6 (   )'}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 0; font-weight: bold; text-align: left; padding-right: 8px;">Tarikh</td>
                  <td style="padding: 2px 0; text-align: center; padding-right: 8px;">:</td>
                  <td style="padding: 2px 0; text-align: left;">${letterDateStr}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 0;"></td>
                  <td style="padding: 2px 0;"></td>
                  <td style="padding: 2px 0; text-align: left;">11 Syaaban 1446H</td>
                </tr>
              </tbody>
            </table>

            <!-- RECIPIENT -->
            <div style="text-align: left; font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; line-height: 1.4; margin-bottom: 20px; text-transform: uppercase;">
              <strong>${s.companyName.toUpperCase()}</strong><br/>
              ${s.address ? s.address.toUpperCase().replace(/\n/g, '<br/>') : 'TIADA ALAMAT BERDAFTAR'}<br/>
              NO. TEL: ${s.phoneNumber}
            </div>

            <!-- SALUTATION & TITLE -->
            <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; margin-bottom: 12px;">Tuan/Puan,</div>

            <div class="letter-content" style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; line-height: 1.5; text-align: justify;">
              <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 15px; text-decoration: underline; line-height: 1.4;">
                PELAWAAN SEBUT HARGA RISDA : ${inv.tenderNo}<br/>
                ${inv.adTitle}
              </div>

              <p style="margin-bottom: 12px; text-indent: 0;">Perkara di atas adalah dirujuk.</p>

              <p style="margin-bottom: 12px; text-indent: 0;">
                2. &nbsp; &nbsp; Dimaklumkan tuan/puan dijemput hadir untuk menyertai sebut harga di atas mengikut ketetapan berikut :
              </p>

              <!-- Briefing details table -->
              <table style="width: 85%; margin-left: auto; margin-right: auto; margin-bottom: 15px; border-collapse: collapse; font-size: 11pt; color: #000; line-height: 1.5;">
                <tbody>
                  <tr>
                    <td style="width: 25%; padding: 4px 0;">Tarikh</td>
                    <td style="width: 3%; padding: 4px 0; text-align: center;">:</td>
                    <td style="width: 72%; padding: 4px 0; font-weight: bold;">
                      ${inv.briefingDate ? `${formatBeautifulDate(inv.briefingDate)} (${indonesianDayName(inv.briefingDate)})` : '-'}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;">Masa</td>
                    <td style="padding: 4px 0; text-align: center;">:</td>
                    <td style="padding: 4px 0; font-weight: bold;">
                      ${inv.briefingTime || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;">Pendaftaran</td>
                    <td style="padding: 4px 0; text-align: center;">:</td>
                    <td style="padding: 4px 0;">
                      ${inv.briefingVenue || def.office}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;">Lawatan</td>
                    <td style="padding: 4px 0; text-align: center;">:</td>
                    <td style="padding: 4px 0; font-style: italic;">
                      ${matchingAd?.visitVenue || matchingAd?.briefingVenue || inv.briefingVenue || 'Lokaliti seperti iklan'}
                    </td>
                  </tr>
                </tbody>
              </table>

              <p style="margin-bottom: 12px;">
                3. &nbsp; &nbsp; Sehubungan itu, tuan/puan diminta membawa <strong>Sijil Asal ${licensesText.toUpperCase()}</strong> berserta 1 salinan semasa mengambil dokumen.
              </p>

              <p style="margin-bottom: 15px;">
                4. &nbsp; &nbsp; Bersama ini disertakan salinan iklan sebut harga untuk rujukan tuan/puan.
              </p>
            </div>

            <!-- Page 1 Footer -->
            <div class="page-footer" style="position: absolute; bottom: 2cm; left: 0.8in; right: 0.8in; font-family: 'Times New Roman', Times, serif; color: #000; text-align: center;">
              <div style="border-top: 1px solid #000; padding-top: 6px; font-size: 8pt; line-height: 1.35; margin-bottom: 2px;">
                MEMACU MASYARAKAT PEKEBUN KECIL MAKMUR DARIPADA SUMBER KOMODITI DAN HASIL<br/>
                BAHARU BERLANDASKAN REVOLUSI PERINDUSTRIAN DIGITAL SERTA TEKNOLOGI HIJAU
              </div>
              <div style="font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 10pt; line-height: 1;">1/3</div>
            </div>
          </div>

          <!-- PAGE 2: SIGN-OFF -->
          <div class="letter-page" style="page-break-after: always; position: relative; min-height: 10.2in; box-sizing: border-box; padding-bottom: 1.25in; padding-top: 0.5in;">

            <!-- Reference repeating like standard multiple-page letters with centered page number -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; line-height: 1.3; margin-bottom: 30px; position: relative; width: 100%;">
              <div style="text-align: left;">
                Ruj. Kami &nbsp;: &nbsp;${inv.referenceNo || 'RISDAS.B(S)400-10/2/6 (   )'}
              </div>
              <div style="width: 50px;"></div>
            </div>

            <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; line-height: 1.5; text-align: justify; margin-top: 40px;">
              <p style="margin-bottom: 25px;">Sekian, terima kasih.</p>

              <div style="font-weight: bold; margin-bottom: 8px;">"MALAYSIA MADANI"</div>
              <div style="font-weight: bold; margin-bottom: 20px;">"BERKHIDMAT UNTUK NEGARA"</div>

              <p style="margin-bottom: 0;">Saya yang menjalankan amanah,</p>
              <br/><br/><br/>
              <div style="font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 11pt;">
                (${inv.officerName ? inv.officerName.toUpperCase() : 'MUHD ZUKRI BIN ISMAIL'})
              </div>
              <div style="text-transform: capitalize;">Pegawai RISDA Daerah</div>
              <div style="text-transform: capitalize;">${getDistrictFromSubmissionVenue(inv.submissionVenue).toLowerCase()}</div>
              <div style="margin-bottom: 10px;">b.p : Pengarah RISDA Negeri ${getStateFromSubmissionVenue(inv.submissionVenue)}</div>

              <div style="font-size: 9.5pt; font-family: monospace; color: #333; margin-top: 50px; font-style: italic;">
                sebutharga${(() => {
                  const d = inv.invitationDate ? new Date(inv.invitationDate) : new Date();
                  return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
                })()}/desktop
              </div>
            </div>

            <!-- Page 2 Footer -->
            <div class="page-footer" style="position: absolute; bottom: 2cm; left: 0.8in; right: 0.8in; font-family: 'Times New Roman', Times, serif; color: #000; text-align: center;">
              <div style="border-top: 1px solid #000; padding-top: 6px; font-size: 8pt; line-height: 1.35; margin-bottom: 2px;">
                MEMACU MASYARAKAT PEKEBUN KECIL MAKMUR DARIPADA SUMBER KOMODITI DAN HASIL<br/>
                BAHARU BERLANDASKAN REVOLUSI PERINDUSTRIAN DIGITAL SERTA TEKNOLOGI HIJAU
              </div>
              <div style="font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 10pt; line-height: 1;">2/3</div>
            </div>
          </div>

          <!-- PAGE 3: EDARAN LIST (LAMPIRAN) -->
          <div class="letter-page" style="page-break-after: avoid; position: relative; min-height: 10.2in; box-sizing: border-box; padding-bottom: 1.25in; padding-top: 0.5in;">

            <!-- Reference repeating like standard multiple-page letters with centered page number -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; line-height: 1.3; margin-bottom: 35px; position: relative; width: 100%;">
              <div style="text-align: left;">
                Ruj. Kami &nbsp;: &nbsp;${inv.referenceNo || 'RISDAS.B(S)400-10/2/6 (   )'}
              </div>
              <div style="width: 50px;"></div>
            </div>

            <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; line-height: 1.6; margin-top: 30px;">
              <div style="font-weight: bold; text-decoration: underline; margin-bottom: 15px; text-transform: uppercase;">EDARAN DALAMAN</div>
              <div style="display: flex; margin-bottom: 25px; align-items: start;">
                <span style="width: 25px; font-weight: bold;">1.</span>
                <div>
                  <strong>Unit Tanam Semula</strong><br/>
                  ${officeVal}
                </div>
              </div>

              <div style="font-weight: bold; text-decoration: underline; margin-bottom: 15px; text-transform: uppercase;">EDARAN LUARAN</div>
              <div style="display: flex; margin-bottom: 10px; align-items: start;">
                <span style="width: 25px; font-weight: bold;">1.</span>
                <div>
                  <strong>${s.companyName.toUpperCase()}</strong><br/>
                  ${s.address ? s.address.toUpperCase().replace(/\n/g, '<br/>') : 'TIADA ALAMAT BERDAFTAR'}<br/>
                  SABAH.
                </div>
              </div>
            </div>

            <!-- Page 3 Footer -->
            <div class="page-footer" style="position: absolute; bottom: 2cm; left: 0.8in; right: 0.8in; font-family: 'Times New Roman', Times, serif; color: #000; text-align: center;">
              <div style="border-top: 1px solid #000; padding-top: 6px; font-size: 8pt; line-height: 1.35; margin-bottom: 2px;">
                MEMACU MASYARAKAT PEKEBUN KECIL MAKMUR DARIPADA SUMBER KOMODITI DAN HASIL<br/>
                BAHARU BERLANDASKAN REVOLUSI PERINDUSTRIAN DIGITAL SERTA TEKNOLOGI HIJAU
              </div>
              <div style="font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 10pt; line-height: 1;">3/3</div>
            </div>
          </div>
        `;
      }).join('');
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${documentTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #000;
              margin: 0.8in;
              font-size: 11pt;
              line-height: 1.4;
            }
            .letter-page {
              box-sizing: border-box;
              min-height: 10.2in;
              position: relative;
              background: #fff;
              padding: 1.15in 0px 1.4in 0px; /* Shifted down by ~3 lines (1.15in) for elegant preview */
            }
            .header-info {
              border-bottom: 2px solid #000;
              padding-bottom: 15px;
              margin-bottom: 30px;
              text-align: center;
              position: relative;
            }
            .title-risda {
              font-size: 16pt;
              font-weight: bold;
              letter-spacing: 1px;
            }
            .meta-table {
              width: 100%;
              margin-bottom: 30px;
              border-collapse: collapse;
            }
            .meta-table td {
              padding: 3px 0;
              vertical-align: top;
            }
            .meta-right {
              text-align: right;
            }
            .content-title {
              font-weight: bold;
              font-size: 12pt;
              margin: 25px 0 15px 0;
              text-transform: uppercase;
              text-decoration: underline;
            }
            .details-box {
              margin: 15px 0;
              padding-left: 20px;
            }
            .footer-section {
              margin-top: 50px;
              page-break-inside: avoid;
            }
            .no-print-bar {
              background: #fff3cd;
              padding: 12px 16px;
              text-align: center;
              border: 1px solid #ffeeba;
              margin-bottom: 25px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              font-size: 11px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-radius: 8px;
              color: #856404;
            }
            @page {
              size: auto;
              margin: 0; /* Disables default browser print header (date, title) and footer (URL, page numbers) */
            }
            @media print {
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #fff;
              }
              .no-print, .no-print-bar { 
                display: none !important; 
              }
              .letter-page { 
                page-break-after: always; 
                page-break-inside: avoid;
                margin: 0 !important;
                padding: 0.75in 0.8in 1.25in 0.8in !important; /* Safe printable padding with 0.75in top & 1.25in bottom to protect the 0.75in footer */
                box-sizing: border-box;
                min-height: 10.2in !important;
                position: relative !important;
                background: #fff !important;
              }
              .letter-page:last-child { 
                page-break-after: avoid; 
              }
              .page-footer {
                position: absolute !important;
                bottom: 0.75in !important;
                left: 0.8in !important;
                right: 0.8in !important;
              }
            }
          </style>
          <style media="print">
            .no-print, .no-print-bar, [class*="no-print"] {
              display: none !important;
              height: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              opacity: 0 !important;
              visibility: hidden !important;
            }
          </style>
        </head>
        <body>
          <div class="no-print no-print-bar">
            <div>
              <strong>CETAKAN FORMAT: <span style="color: #c92a2a; text-transform: uppercase;">${formatType}</span></strong>
              | Mencetak sebanyak <strong>${suppliersToPrint.length} surat</strong> untuk kontraktor terpilih.
            </div>
            <button onclick="window.print()" style="padding: 8px 18px; background: #000; border: 0; color: #fff; font-weight: bold; cursor: pointer; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">CETAK SURAT</button>
          </div>

          ${documentContentHtml}


        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const invitationYears = Array.from(new Set([
    new Date().getFullYear().toString(),
    ...invitations.map(inv => {
      const date = inv.invitationDate || inv.createdAt;
      if (!date) return null;
      let dStr = '';
      if (typeof date === 'string') {
        dStr = date;
      } else if (date && typeof date.toDate === 'function') {
        try {
          dStr = date.toDate().toISOString();
        } catch (e) {}
      } else if (date && date.seconds) {
        try {
          dStr = new Date(date.seconds * 1000).toISOString();
        } catch (e) {}
      }
      if (!dStr) return null;
      return dStr.substring(0, 4);
    }).filter(Boolean)
  ])).sort((a, b) => b.localeCompare(a));

  const filteredInvitations = invitations.filter(inv => {
    // 1. Search Query Match
    const matchesSearch = !searchQuery.trim() || 
      inv.adTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.tenderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.referenceNo.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Year Match
    let matchesYear = true;
    if (listFilters.year !== 'ALL') {
      const date = inv.invitationDate || inv.createdAt;
      let dStr = '';
      if (typeof date === 'string') {
        dStr = date;
      } else if (date && typeof date.toDate === 'function') {
        try {
          dStr = date.toDate().toISOString();
        } catch (e) {}
      } else if (date && date.seconds) {
        try {
          dStr = new Date(date.seconds * 1000).toISOString();
        } catch (e) {}
      }
      const year = dStr ? dStr.substring(0, 4) : '';
      matchesYear = year === listFilters.year;
    }

    // Resolve State and Office for the invitation
    const matchingAd = ads.find(a => a.id === inv.adId);
    const invState = (inv.state || matchingAd?.state || '').trim().toUpperCase();
    const invOffice = (inv.office || matchingAd?.office || '').trim().toUpperCase();

    // 3. State Match
    let matchesState = true;
    if (listFilters.state !== 'ALL') {
      matchesState = invState === listFilters.state.toUpperCase();
    }

    // 4. Office Match
    let matchesOffice = true;
    if (listFilters.office !== 'ALL') {
      matchesOffice = invOffice === listFilters.office.toUpperCase();
    }

    return matchesSearch && matchesYear && matchesState && matchesOffice;
  });

  // Dynamic header calculations for live preview
  let previewOffice = 'PEJABAT RISDA DAERAH BEAUFORT';
  let previewAddress = 'K77 & K78, Block K, Beaufort Square Avenue 1,<br/>Jalan Binunuk,<br/>89800 Beaufort, Sabah';
  let previewEmail = 'prdbeaufort@risda.gov.my';
  let previewTel = '087-224335/336';
  
  const defOfficeAddress = getStaffDefaultOfficeAndAddress();
  const currentVenue = submissionVenue || defOfficeAddress.fullAddress;
  if (currentVenue) {
    const parts = currentVenue.split(',');
    if (parts.length > 0) {
      previewOffice = parts[0].trim().toUpperCase();
    }
    if (parts.length > 1) {
      previewAddress = parts.slice(1).map(p => p.trim()).join(',<br/>').toUpperCase();
    }
    const rawOffice = parts[0] || '';
    const cleanedOfficeName = rawOffice.replace('PEJABAT RISDA DAERAH', '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanedOfficeName) {
      previewEmail = `prd${cleanedOfficeName}@risda.gov.my`;
    }
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-risda-card p-6 md:p-8 rounded-[30px] border border-white/5 relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-risda-orange/5 to-transparent pointer-events-none" />
        <div className="space-y-1 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-risda-orange/10 border border-risda-orange/20 rounded-full text-[9px] font-black text-risda-orange tracking-widest uppercase">
            <Layers size={11} /> Kawalan Operasi
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
            PELAWAAN SEBUTHARGA KEPADA PEMBEKAL
          </h1>
          <p className="text-xs text-risda-muted font-bold uppercase tracking-widest">
            Urus, Sedia Surat Rasmi, dan Hebahkan Jemputan Sebut Harga Rasmi Beaufort
          </p>
        </div>

        {/* Action Buttons to Switch Tabs */}
        <div className="flex items-center gap-2 shrink-0 z-10 bg-black/40 border border-white/10 p-1.5 rounded-2xl">
          <button 
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'list' ? 'bg-risda-orange text-black' : 'text-risda-muted hover:text-white'}`}
          >
            Senarai Pelawaan
          </button>
          <button 
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'create' ? 'bg-risda-orange text-black' : 'text-risda-muted hover:text-white'}`}
          >
            Sedia Pelawaan Baru
          </button>
          <button 
            onClick={() => setActiveTab('directory')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'directory' ? 'bg-risda-orange text-black' : 'text-risda-muted hover:text-white'}`}
          >
            Data Pembekal
          </button>
        </div>
      </div>

      {/* VIEW 1: ARCHIVE LIST */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="bg-risda-card p-4 rounded-3xl border border-white/5 flex flex-col md:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-risda-muted" size={16} />
              <input 
                type="text"
                placeholder="Cari Rujukan, No. Tender, atau Tajuk Projek..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-xs md:text-sm text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/20"
              />
            </div>
            <button 
              onClick={() => setActiveTab('create')}
              className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-risda-orange to-risda-gold text-black rounded-2xl text-[12px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Plus size={16} /> Sedia Pelawaan
            </button>
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Year Filter */}
            <div className="bg-risda-card p-4 rounded-3xl border border-white/5 flex flex-col gap-2">
              <label className="text-[10px] font-black text-risda-orange uppercase tracking-[2px] px-1 opacity-80">Tapis Tahun</label>
              <div className="relative">
                <select 
                  value={listFilters.year}
                  onChange={(e) => setListFilters({...listFilters, year: e.target.value})}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 px-4 text-xs text-white focus:outline-none focus:border-risda-orange/50 appearance-none cursor-pointer uppercase font-bold"
                >
                  <option value="ALL">SEMUA TAHUN</option>
                  {invitationYears.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            </div>

            {/* State Filter */}
            <div className="bg-risda-card p-4 rounded-3xl border border-white/5 flex flex-col gap-2">
              <label className="text-[10px] font-black text-risda-orange uppercase tracking-[2px] px-1 opacity-80">Tapis Negeri</label>
              <div className="relative">
                <select 
                  value={listFilters.state}
                  onChange={(e) => setListFilters({...listFilters, state: e.target.value, office: 'ALL'})}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 px-4 text-xs text-white focus:outline-none focus:border-risda-orange/50 appearance-none cursor-pointer uppercase font-bold"
                >
                  <option value="ALL">SEMUA NEGERI</option>
                  {Array.from(new Set(locations.map(l => l.state).filter(Boolean))).sort().map((st: string) => (
                    <option key={st} value={st}>{st.toUpperCase()}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            </div>

            {/* Office Filter */}
            <div className="bg-risda-card p-4 rounded-3xl border border-white/5 flex flex-col gap-2">
              <label className="text-[10px] font-black text-risda-orange uppercase tracking-[2px] px-1 opacity-80">Tapis Pejabat</label>
              <div className="relative">
                <select 
                  value={listFilters.office}
                  onChange={(e) => setListFilters({...listFilters, office: e.target.value})}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 px-4 text-xs text-white focus:outline-none focus:border-risda-orange/50 appearance-none cursor-pointer uppercase font-bold"
                >
                  <option value="ALL">SEMUA PEJABAT</option>
                  {Array.from(new Set(
                    locations
                      .filter(l => listFilters.state === 'ALL' || l.state === listFilters.state)
                      .map(l => l.office)
                      .filter(Boolean)
                  )).sort().map((off: string) => (
                    <option key={off} value={off}>{off.toUpperCase()}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-20 text-center text-risda-muted font-black animate-pulse uppercase tracking-widest text-xs">
              MEMUATKAN REKOD PELAWAAN...
            </div>
          ) : filteredInvitations.length === 0 ? (
            <div className="bg-risda-card p-16 text-center border border-white/5 rounded-[40px] space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-risda-muted">
                <FileText size={28} />
              </div>
              <div className="space-y-1">
                <p className="text-white text-sm font-black uppercase tracking-wider">Tiada Rekod Pelawaan Diambil</p>
                <p className="text-xs text-risda-muted max-w-md mx-auto">Sediakan surat pelawaan sebut harga secara digital bagi memulakan tracking jemputan kepada pembekal terpilih anda.</p>
              </div>
              <button 
                onClick={() => setActiveTab('create')}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Sediakan Pertama Sekarang
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredInvitations.map((inv) => (
                <div 
                  key={inv.id}
                  onClick={() => setSelectedInvitation(inv)}
                  className="bg-risda-card border border-white/5 hover:border-risda-orange/20 rounded-[30px] p-6 transition-all duration-300 hover:shadow-2xl hover:translate-y-[-2px] cursor-pointer relative group flex flex-col justify-between overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-risda-orange/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="space-y-4">
                    {/* File Ref & Status */}
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 bg-white/5 border border-white/15 rounded-lg text-[9px] font-mono font-bold text-white max-w-[170px] truncate">
                        {inv.referenceNo}
                      </span>
                      <span className="px-2.5 py-0.5 bg-risda-orange/10 border border-risda-orange/20 rounded text-[9px] font-bold text-risda-orange uppercase tracking-wider">
                        {inv.suppliers.length} Pembekal
                      </span>
                    </div>

                    {/* Project details */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-risda-gold font-bold uppercase tracking-wider">{inv.tenderNo}</p>
                      <h3 className="text-sm font-black text-white uppercase tracking-tight line-clamp-2 leading-snug">
                        {inv.adTitle}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5 text-[10px] text-risda-muted font-bold uppercase">
                      <div>
                        <span className="block text-[8px] text-white/30">Tarikh Pelawaan</span>
                        <span className="text-white font-mono">{inv.invitationDate}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] text-white/30">Tarikh Tutup</span>
                        <span className="text-white font-mono">{inv.closingDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions summary */}
                  <div className="flex items-center justify-between pt-5 mt-4 border-t border-white/5">
                    <span className="text-[9px] text-white/30 font-bold uppercase">
                      Pegawai: {inv.officerName}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handlePrintDraft(inv); }}
                        className="p-2 bg-white/5 hover:bg-risda-orange hover:text-black rounded-lg transition-all text-white/70"
                        title="Muat Turun PDF Surat Rasmi"
                      >
                        <FileText size={13} />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteInvitation(inv.id, e)}
                        className="p-2 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all text-white/50"
                        title="Padam Rekod"
                      >
                        <Trash2 size={13} />
                      </button>
                      <span className="text-risda-orange group-hover:translate-x-1 transition-transform pl-1">
                        <ChevronRight size={16} />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: NEW INVITATION FORM + LIVE PREVIEW */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* Form left side (7 cols) */}
          <div className="xl:col-span-7 space-y-6">
            <div className="bg-risda-card rounded-[35px] border border-white/5 p-6 md:p-8 space-y-6 shadow-2xl">
              <h2 className="text-lg font-black text-white uppercase tracking-wider border-b border-white/5 pb-4">
                Butiran Penyediaan Pelawaan
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* select Ad */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[9px] font-black text-risda-orange uppercase tracking-[2px] px-1 block">PILIH SEBUT HARGA (AKTIF)</label>
                  <select 
                    value={selectedAdId}
                    onChange={(e) => handleAdSelectionChange(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:border-risda-orange/50 outline-none"
                  >
                    <option value="">-- PILIH PROJEK AKTIF --</option>
                    {ads.filter(ad => ad.status === 'AKTIF' || ad.status === 'Dibuka').map(ad => (
                      <option key={ad.id} value={ad.id}>
                        [{ad.tenderNo}] {ad.title.substring(0, 70)}...
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pilih Format Cetakan Utama */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[9px] font-black text-risda-orange uppercase tracking-[2px] px-1 block">PILIH FORMAT CETAKAN UTAMA</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPreviewFormat('rasmi')}
                      className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all ${
                        previewFormat === 'rasmi'
                          ? 'bg-risda-orange/10 border-risda-orange text-white shadow-[0_0_15px_rgba(243,156,18,0.15)] font-black'
                          : 'bg-black/30 border-white/10 text-risda-muted hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <span className="text-[9px] uppercase tracking-wider block">Format 1</span>
                      <strong className="text-[10px] uppercase tracking-widest mt-1">SURAT RASMI</strong>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFormat('tawaran')}
                      className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all ${
                        previewFormat === 'tawaran'
                          ? 'bg-risda-orange/10 border-risda-orange text-white shadow-[0_0_15px_rgba(243,156,18,0.15)] font-black'
                          : 'bg-black/30 border-white/10 text-risda-muted hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <span className="text-[9px] uppercase tracking-wider block">Format 2</span>
                      <strong className="text-[10px] uppercase tracking-widest mt-1">SURAT TAWARAN</strong>
                    </button>
                  </div>
                </div>

                {/* Reference fail */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-risda-orange uppercase tracking-[2px] px-1 block">NO. RUJUKAN FAIL</label>
                  <input 
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="cth: RISDA/BFT/...Jld.2"
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:border-risda-orange/50 outline-none"
                  />
                </div>

                {/* Tarikh surat */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-risda-orange uppercase tracking-[2px] px-1 block">TARIKH SURAT DI JANA</label>
                  <input 
                    type="date"
                    value={invitationDate}
                    onChange={(e) => setInvitationDate(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:border-risda-orange/50 outline-none"
                  />
                </div>

                {/* Tarikh Hijri */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-risda-orange uppercase tracking-[2px] px-1 block">TARIKH HIJRI (BOLEH DIEDIT)</label>
                  <input 
                    type="text"
                    value={hijriDate}
                    onChange={(e) => setHijriDate(e.target.value)}
                    placeholder="cth: 7 Muharam 1448 H"
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:border-risda-orange/50 outline-none"
                  />
                </div>

                {/* Pegawai pentadbir */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-risda-orange uppercase tracking-[2px] px-1 block">NAMA PEGAWAI PENTADBIR</label>
                  <input 
                    type="text"
                    value={officerName}
                    onChange={(e) => setOfficerName(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:border-risda-orange/50 outline-none"
                  />
                </div>

                {/* Overrides block */}
                {selectedAdId && (
                  <div className="md:col-span-2 p-4 bg-black/30 border border-white/5 rounded-2xl space-y-4">
                    <div className="text-[10px] text-risda-gold font-bold uppercase tracking-widest border-b border-white/5 pb-2">Informasi Projek (Boleh Disunting)</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] text-risda-muted font-bold">Tarikh Briefing</label>
                        <input type="date" value={briefingDate} onChange={e => setBriefingDate(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-lg p-2 text-xs text-white" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-risda-muted font-bold">Masa Briefing</label>
                        <input type="text" value={briefingTime} onChange={e => setBriefingTime(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-lg p-2 text-xs text-white" />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[8px] text-risda-muted font-bold">Tempat Briefing</label>
                        <input type="text" value={briefingVenue} onChange={e => setBriefingVenue(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-lg p-2 text-xs text-white" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-risda-muted font-bold">Tarikh Tutup Sebutharga</label>
                        <input type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-lg p-2 text-xs text-white" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-risda-muted font-bold">Masa Tutup Sebutharga</label>
                        <input type="text" value={closingTime} onChange={e => setClosingTime(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-lg p-2 text-xs text-white" />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[8px] text-risda-muted font-bold block">Tempat Serahan Dokumen / Peti Sebutharga (Pejabat RISDA)</label>
                        <textarea 
                          rows={2}
                          value={submissionVenue}
                          onChange={e => setSubmissionVenue(e.target.value)}
                          className="w-full bg-black/30 border border-white/5 rounded-lg p-2 text-xs text-white outline-none focus:border-risda-orange/30 transition-all font-sans"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SUPPLIER CHOOOSER BLOCK */}
            <div className="bg-risda-card rounded-[35px] border border-white/5 p-6 md:p-8 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Pilih Pembekal Yang Dipelawa ({selectedSuppliers.length})
                </h3>
                <button 
                  onClick={() => setActiveTab('directory')}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase text-risda-gold border border-risda-gold/30 rounded-lg flex items-center gap-1"
                >
                  Daftar Pembekal Baru
                </button>
              </div>

              {/* Search Filter input for suppliers */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                <input 
                  type="text"
                  placeholder="Cari nama syarikat atau telefon pembekal..."
                  value={supplierSearchQuery}
                  onChange={(e) => setSupplierSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 pl-10 pr-10 text-xs text-white focus:border-risda-orange/50 outline-none placeholder:text-white/20"
                />
                {supplierSearchQuery && (
                  <button 
                    onClick={() => setSupplierSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-[10px] uppercase font-black tracking-wider"
                  >
                    Batal
                  </button>
                )}
              </div>

              {directorySuppliers.length === 0 ? (
                <div className="p-8 text-center text-risda-muted text-xs uppercase font-bold">
                  Sila daftarkan pembekal di tab "Data Pembekal" terlebih dahulu, atau tunggu kehadiran kontraktor berdaftar masuk secara automatik.
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                  {directorySuppliers
                    .filter(sup => {
                      const q = supplierSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        sup.companyName.toLowerCase().includes(q) ||
                        sup.phoneNumber.toLowerCase().includes(q) ||
                        (sup.email && sup.email.toLowerCase().includes(q)) ||
                        (sup.cidbSpkk && sup.cidbSpkk.toLowerCase().includes(q))
                      );
                    })
                    .map((sup) => {
                      const isSelected = selectedSuppliers.some(s => s.companyName === sup.companyName);
                      return (
                        <div 
                          key={sup.id}
                          onClick={() => toggleSelectSupplier(sup)}
                          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'bg-risda-orange/10 border-risda-orange text-white' : 'bg-black/30 border-white/5 hover:border-white/15 text-white/70'}`}
                        >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${isSelected ? 'bg-risda-orange border-risda-orange text-black' : 'border-white/20'}`}>
                            {isSelected && <span className="text-[10px] font-black">✓</span>}
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase">{sup.companyName}</p>
                            <span className="text-[9px] opacity-60 font-medium">No. Tel: {sup.phoneNumber} | CIDB: {sup.cidbSpkk || '-'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SAVE BUTTON */}
            <div className="flex gap-4">
              <button 
                onClick={handleSaveInvitation}
                className="flex-1 py-4.5 bg-gradient-to-r from-risda-orange to-risda-gold text-black rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <FileCheck size={18} /> Simpan & Muktamadkan Pelawaan
              </button>
              <button 
                onClick={() => { setSelectedAdId(''); setSelectedSuppliers([]); }}
                className="px-6 py-4.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all"
              >
                Reset Form
              </button>
            </div>
          </div>

          {/* RIGHT SIDE: LIVE PRATINJAU LETTER (5 COLS) */}
          <div className="xl:col-span-5 space-y-4">
            
            {/* Pratinjau Header */}
            <div className="flex flex-col sm:flex-row bg-black/40 border border-white/10 p-3 rounded-2xl relative shadow-inner sm:items-center justify-between gap-3">
              <span className="text-[10px] font-black text-white/95 uppercase tracking-widest flex items-center gap-2 px-1">
                📄 PRATINJAU DRAFT SURAT
              </span>
              <div className="flex bg-black/50 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setPreviewFormat('rasmi')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    previewFormat === 'rasmi'
                      ? 'bg-risda-orange text-black'
                      : 'text-risda-muted hover:text-white'
                  }`}
                >
                  FORMAT 1: RASMI
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFormat('tawaran')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    previewFormat === 'tawaran'
                      ? 'bg-risda-orange text-black'
                      : 'text-risda-muted hover:text-white'
                  }`}
                >
                  FORMAT 2: TAWARAN
                </button>
              </div>
            </div>

            {previewFormat === 'rasmi' ? (
              <div className="max-h-[85vh] overflow-y-auto space-y-6 pr-1">
                {/* PAGE 1 */}
                <div className="bg-white text-black rounded-[40px] shadow-2xl min-h-[680px] border border-gray-200 relative overflow-hidden flex flex-col font-serif" style={{ fontFamily: "'Times New Roman', Times, serif", paddingTop: '0.75in', paddingBottom: '1.25in', paddingLeft: '0.8in', paddingRight: '0.8in' }}>
                  {/* Subtle Elegant Watermark */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.032] pointer-events-none select-none z-0">
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png"
                      className="w-80 h-auto grayscale" 
                      alt=""
                    />
                  </div>
                  
                  {/* Draft marker */}
                  <div className="absolute top-2 right-2 bg-red-600 text-white text-[8px] font-mono px-3 py-1 rounded font-black tracking-widest transform rotate-4 shadow-md uppercase z-20">
                    PRATINJAU DRAFT (MUKA 1/3)
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between text-black text-[10.5px] leading-relaxed relative z-10">
                    <div className="animate-[fadeIn_0.3s_ease-out]">
                      {/* Shared Official Header - Identical on Pages 1, 2, and 3 */}
                      <div className="border-b-2 border-solid border-black pb-3 mb-4 text-center flex items-center justify-between">
                        <div className="w-[70px] text-left shrink-0">
                          <img 
                            src="/PUBLIC/intrologo_RISDA.png" 
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.src = "https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png";
                            }}
                            className="h-[60px] w-auto block"
                            alt="RISDA Logo"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 text-left pl-3 font-serif text-black leading-tight">
                          <strong className="text-[10pt] block mb-0.5 uppercase tracking-wide font-extrabold">
                            PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH<br/>(RISDA)
                          </strong>
                          <strong className="text-[9.5pt] block mb-0.5 uppercase tracking-wide font-bold font-serif text-black">
                            {previewOffice}
                          </strong>
                          <div className="text-[6.5pt] leading-tight text-slate-800 mt-2.5 flex justify-between items-end bg-transparent font-sans">
                            <div className="text-left font-sans text-slate-600 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: previewAddress }} />
                            <div className="text-right font-sans whitespace-nowrap pl-2 space-y-0.5 text-slate-600">
                              <div><strong className="text-black font-semibold">TEL:</strong> {previewTel}</div>
                              <div><strong className="text-black font-semibold">MEL:</strong> {previewEmail}</div>
                              <div><strong className="text-black font-semibold">WEB:</strong> www.risda.gov.my</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Reference box right */}
                      <div className="flex justify-end text-[14px] mb-6">
                        <div className="flex flex-col text-left font-serif text-black leading-tight">
                          <div className="flex items-start">
                            <span className="w-20 font-bold">Ruj. Kami</span>
                            <span className="mx-2">:</span>
                            <span className="font-semibold uppercase">{referenceNo || "RISDA.BFT.100-3/4/(376) Jld.26"}</span>
                          </div>
                          <div className="flex items-start mt-1">
                            <span className="w-20 font-bold">Tarikh</span>
                            <span className="mx-2">:</span>
                            <div className="flex flex-col">
                              <span className="font-bold">{invitationDate ? formatBeautifulDate(invitationDate) : "15 JUN 2026"}</span>
                              <span className="font-bold text-slate-800">{hijriDate || (invitationDate ? getHijriDate(invitationDate) : "11 Syaaban 1446H")}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Recipient info on left - plain bold Times text */}
                      <div className="text-[14px] text-left uppercase mb-6 leading-relaxed font-serif text-black font-bold">
                        {selectedSuppliers.length > 0 ? (
                          <div className="space-y-0.5">
                            <div className="font-bold">{selectedSuppliers[0].companyName.toUpperCase()}</div>
                            <div className="font-normal whitespace-pre-wrap leading-tight">{selectedSuppliers[0].address ? selectedSuppliers[0].address.toUpperCase() : "ALAMAT KONTRAKTOR TIADA"}</div>
                            {selectedSuppliers[0].phoneNumber && <div className="font-normal">NO. TEL: {selectedSuppliers[0].phoneNumber}</div>}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div>RIDUK ENTERPRISE</div>
                            <div className="font-normal">BATU LIMA TAMAN WAWASAN BEAUFORT</div>
                            <div className="font-normal">NO. TEL: 0198304207</div>
                          </div>
                        )}
                      </div>

                      <div className="text-[14px] mb-6 font-serif text-left text-black">
                        Tuan/Puan,
                      </div>

                      {/* Letter title and body */}
                      <div className="text-[14px] text-justify space-y-5 leading-normal font-serif text-black">
                        <div className="font-bold text-[14px] mb-6 uppercase tracking-normal leading-normal text-black font-serif space-y-1">
                          <div className="underline uppercase">
                            PELAWAAN SEBUT HARGA RISDA : {selectedAdId ? ads.find(a => a.id === selectedAdId)?.tenderNo : "SH/S.6-02/2026"}
                          </div>
                          <div className="underline uppercase leading-snug">
                            {selectedAdId ? ads.find(a => a.id === selectedAdId)?.title : "CADANGAN PROJEK JALAN BAGI PROGRAM PRASARANA ASAS PERTANIAN (PAP) 2026 KAMPUNG MARABA, BEAUFORT"}
                          </div>
                        </div>

                        <p className="text-black">Perkara di atas adalah dirujuk.</p>
                        
                        <p className="text-black">
                          2. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Dimaklumkan tuan/puan dijemput hadir untuk menyertai sebut harga di atas mengikut ketetapan berikut  :
                        </p>

                        {/* Indented borderless details list exactly mimicking photo */}
                        <div className="pl-14 my-4 font-serif text-[14px]">
                          <table className="border-none text-black w-full max-w-lg leading-relaxed">
                            <tbody>
                              <tr className="border-none">
                                <td className="py-1 w-32 font-normal text-black">Tarikh</td>
                                <td className="py-1 w-6 text-black">:</td>
                               <td className="py-1 font-bold text-black uppercase">
                                  {briefingDate ? `${formatBeautifulDate(briefingDate)} (${indonesianDayName(briefingDate)})` : "23 JUN 2026 (SELASA)"}
                                </td>
                              </tr>
                              <tr className="border-none">
                                <td className="py-1 w-32 font-normal text-black">Masa</td>
                                <td className="py-1 w-6 text-black">:</td>
                                <td className="py-1 font-bold text-black uppercase">
                                  {briefingTime || "10.00 Pagi"}
                                </td>
                              </tr>
                              <tr className="border-none">
                                <td className="py-1 w-32 font-normal text-black">Pendaftaran</td>
                                <td className="py-1 w-6 text-black">:</td>
                                <td className="py-1 text-black font-semibold uppercase">
                                  {briefingVenue || "PEJABAT RISDA DAERAH BEAUFORT"}
                                </td>
                              </tr>
                              <tr className="border-none">
                                <td className="py-1 w-32 font-normal text-black">Lawatan</td>
                                <td className="py-1 w-6 text-black">:</td>
                                <td className="py-1 italic text-black font-semibold uppercase">
                                  {briefingVenue || "PEJABAT RISDA DAERAH BEAUFORT"}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <p className="text-black">
                          3. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Sehubungan itu, tuan/puan diminta membawa <strong className="font-bold">Sijil Asal SIJIL PENDAFTARAN YANG BERKAITAN</strong> berserta 1 salinan semasa mengambil dokumen.
                        </p>
                        <p className="text-black">
                          4. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Bersama ini disertakan salinan iklan sebut harga untuk rujukan tuan/puan.
                        </p>
                      </div>
                    </div>

                    {/* Real page footer representation */}
                    <div className="absolute left-[0.8in] right-[0.8in] border-t border-black text-[10px] sm:text-[11px] font-sans tracking-tight leading-snug text-black select-none uppercase text-center pt-2" style={{ fontFamily: "'Times New Roman', Times, serif", bottom: '2cm' }}>
                      MEMACU MASYARAKAT PEKEBUN KECIL MAKMUR DARIPADA SUMBER KOMODITI DAN HASIL<br />
                      BAHARU BERLANDASKAN REVOLUSI PERINDUSTRIAN DIGITAL SERTA TEKNOLOGI HIJAU
                      <div className="text-center font-bold text-black text-[11px] mt-1 font-serif">
                        1/3
                      </div>
                    </div>
                  </div>
                </div>

                {/* PAGE 2 */}
                <div className="bg-white text-black rounded-[40px] shadow-2xl min-h-[680px] border border-gray-200 relative overflow-hidden flex flex-col font-serif" style={{ fontFamily: "'Times New Roman', Times, serif", paddingTop: '0.75in', paddingBottom: '1.25in', paddingLeft: '0.8in', paddingRight: '0.8in' }}>
                  {/* Subtle Elegant Watermark */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.032] pointer-events-none select-none z-0">
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png"
                      className="w-80 h-auto grayscale" 
                      alt=""
                    />
                  </div>
                  
                  {/* Draft marker */}
                  <div className="absolute top-2 right-2 bg-red-600 text-white text-[8px] font-mono px-3 py-1 rounded font-black tracking-widest transform rotate-4 shadow-md uppercase z-20">
                    PRATINJAU DRAFT (MUKA 2/3)
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between text-black text-[14px] leading-relaxed relative z-10">
                    <div className="animate-[fadeIn_0.3s_ease-out] flex-1">
                      {/* Rujukan header exactly matching Image 2 */}
                      <div className="text-[14px] text-left font-serif text-black leading-tight mb-8">
                        <span className="font-bold">Ruj. Kami</span>
                        <span className="mx-2">:</span>
                        <span className="font-semibold uppercase">{referenceNo || "RISDA.BFT.100-3/4/(376) Jld.26"}</span>
                      </div>

                      <div className="space-y-4 text-[14px] text-justify leading-relaxed mt-4 font-serif text-black relative">
                        <p className="text-black">Sekian, terima kasih.</p>
                        
                        <div className="font-bold uppercase text-black leading-loose py-2">
                          "MALAYSIA MADANI"<br />
                          "BERKHIDMAT UNTUK NEGARA"
                        </div>

                        <p className="pt-2 mb-0 text-black">Saya yang menjalankan amanah,</p>
                        
                        {/* Empty signature gap matching the layout */}
                        <div className="h-20" />
                        
                        <div className="relative z-20">
                          <strong className="text-[14px] block uppercase text-black font-bold">({officerName ? officerName.toUpperCase() : "INNOGRANITE"})</strong>
                          <span className="block font-medium text-black">Pegawai RISDA Daerah</span>
                          <span className="block text-black">Beaufort</span>
                          <span className="block text-black">b.p : Pengarah RISDA Negeri Sabah</span>
                        </div>

                        <div className="text-[12px] font-mono text-slate-500 pt-8 italic select-none">
                          sebutharga{(() => {
                            const d = invitationDate ? new Date(invitationDate) : new Date();
                            return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
                          })()}/desktop
                        </div>
                      </div>
                    </div>

                    {/* Real page footer representation */}
                    <div className="absolute left-[0.8in] right-[0.8in] border-t border-black text-[10px] sm:text-[11px] font-sans tracking-tight leading-snug text-black select-none uppercase text-center pt-2" style={{ fontFamily: "'Times New Roman', Times, serif", bottom: '2cm' }}>
                      MEMACU MASYARAKAT PEKEBUN KECIL MAKMUR DARIPADA SUMBER KOMODITI DAN HASIL<br />
                      BAHARU BERLANDASKAN REVOLUSI PERINDUSTRIAN DIGITAL SERTA TEKNOLOGI HIJAU
                      <div className="text-center font-bold text-black text-[11px] mt-1 font-serif">
                        2/3
                      </div>
                    </div>
                  </div>
                </div>

                {/* PAGE 3 */}
                <div className="bg-white text-black rounded-[40px] shadow-2xl min-h-[680px] border border-gray-200 relative overflow-hidden flex flex-col font-serif" style={{ fontFamily: "'Times New Roman', Times, serif", paddingTop: '0.75in', paddingBottom: '1.25in', paddingLeft: '0.8in', paddingRight: '0.8in' }}>
                  {/* Subtle Elegant Watermark */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.032] pointer-events-none select-none z-0">
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png"
                      className="w-80 h-auto grayscale" 
                      alt=""
                    />
                  </div>
                  
                  {/* Draft marker */}
                  <div className="absolute top-2 right-2 bg-red-600 text-white text-[8px] font-mono px-3 py-1 rounded font-black tracking-widest transform rotate-4 shadow-md uppercase z-20">
                    PRATINJAU DRAFT (MUKA 3/3)
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between text-black text-[10.5px] leading-relaxed relative z-10">
                    <div className="animate-[fadeIn_0.3s_ease-out] flex-1">
                      {/* Rujukan header exactly matching Image 3 */}
                      <div className="text-[14px] text-left font-serif text-black leading-tight mb-8">
                        <span className="font-bold">Ruj. Kami</span>
                        <span className="mx-2">:</span>
                        <span className="font-semibold uppercase">{referenceNo || "RISDA.BFT.100-3/4/(376) Jld.26"}</span>
                      </div>

                      <div className="space-y-8 text-left text-[14px] leading-relaxed font-serif text-black">
                        <div>
                          <strong className="underline text-black block mb-3 uppercase tracking-wide font-bold">EDARAN DALAMAN</strong>
                          <div className="flex gap-4 items-start pl-4">
                            <span className="font-bold">1.</span>
                            <div>
                              <strong className="text-black font-bold">Unit Tanam Semula</strong><br/>
                              <span className="text-black">Pejabat RISDA Daerah Beaufort</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <strong className="underline text-black block mb-3 uppercase tracking-wide font-bold">EDARAN LUARAN</strong>
                          <div className="space-y-4 pl-4">
                            {selectedSuppliers.length === 0 ? (
                              <div className="flex gap-4 items-start">
                                <strong className="font-bold">1.</strong>
                                <div>
                                  <strong className="text-black block font-bold text-[14px]">RIDUK ENTERPRISE</strong>
                                  <span className="text-black block leading-snug">BATU LIMA TAMAN WAWASAN BEAUFORT</span>
                                  <span className="text-black block">SABAH.</span>
                                </div>
                              </div>
                            ) : (
                              selectedSuppliers.map((s, idx) => {
                                const uppercaseAddr = s.address ? s.address.toUpperCase() : "TIADA REKOD ALAMAT";
                                return (
                                  <div key={idx} className="flex gap-4 items-start">
                                    <strong className="font-bold">{idx + 1}.</strong>
                                    <div>
                                      <strong className="text-black block font-bold text-[14px]">{s.companyName.toUpperCase()}</strong>
                                      <span className="text-black block leading-snug whitespace-pre-wrap">{uppercaseAddr}</span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Real page footer representation */}
                    <div className="absolute left-[0.8in] right-[0.8in] border-t border-black text-[10px] sm:text-[11px] font-sans tracking-tight leading-snug text-black select-none uppercase text-center pt-2" style={{ fontFamily: "'Times New Roman', Times, serif", bottom: '2cm' }}>
                      MEMACU MASYARAKAT PEKEBUN KECIL MAKMUR DARIPADA SUMBER KOMODITI DAN HASIL<br />
                      BAHARU BERLANDASKAN REVOLUSI PERINDUSTRIAN DIGITAL SERTA TEKNOLOGI HIJAU
                      <div className="text-center font-bold text-black text-[11px] mt-1 font-serif">
                        3/3
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white text-black rounded-[40px] shadow-2xl min-h-[680px] border border-gray-200 relative overflow-hidden flex flex-col font-serif" style={{ fontFamily: "'Times New Roman', Times, serif", paddingTop: '0.75in', paddingBottom: '1.25in', paddingLeft: '0.8in', paddingRight: '0.8in' }}>
                {/* Subtle Elegant Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.032] pointer-events-none select-none z-0">
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png"
                    className="w-80 h-auto grayscale" 
                    alt=""
                  />
                </div>
                
                {/* Draft marker */}
                <div className="absolute top-2 right-2 bg-red-600 text-white text-[8px] font-mono px-3 py-1 rounded font-black tracking-widest transform rotate-4 shadow-md uppercase z-20">
                  PRATINJAU DRAFT
                </div>
                
                <div className="w-full font-serif text-black overflow-y-auto max-h-[80vh] p-1 leading-relaxed relative z-10" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                  {/* Header with Logo */}
                  <div className="text-center mb-6 flex flex-col items-center">
                    <img 
                      src="/PUBLIC/intrologo_RISDA.png" 
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (!img.src.includes("/api/logo") && !img.src.endsWith("/api/logo")) {
                          img.src = "/api/logo";
                        } else if (!img.src.includes("Logo_RISDA.png") && !img.src.includes("logo_risda.png")) {
                          img.src = "https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png";
                        }
                      }}
                      className="h-[65px] w-auto mb-3 mx-auto block"
                      referrerPolicy="no-referrer"
                      alt="RISDA Logo"
                    />
                    <div className="w-full border-b-2 border-solid border-black mt-3.5 mb-5"></div>
                    
                    <h1 className="font-bold text-[13pt] text-black tracking-wider mt-1 underline uppercase text-center leading-normal font-extrabold">
                      SURAT TAWARAN PELAWAAN SEBUTHARGA
                    </h1>
                  </div>

                  {/* Metadata table styled as premium administrative list box */}
                  <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm bg-slate-50/55 p-3 mb-5">
                    <table className="w-full text-[10.5pt] leading-relaxed text-black border-collapse">
                      <tbody>
                        <tr>
                          <td className="w-[28%] font-bold py-1.5 align-top text-black uppercase text-[9.5px]">No. Sebutharga</td>
                          <td className="w-[3%] py-1.5 text-center align-top text-zinc-400">:</td>
                          <td className="w-[69%] font-bold py-1.5 align-top font-mono tracking-wide text-red-800 text-[11px] bg-red-50/50 px-2 rounded border border-red-100">
                            {selectedAdId ? ads.find(a => a.id === selectedAdId)?.tenderNo : "[PILIH PROJEK UNTUK NO. SEBUT HARGA]"}
                          </td>
                        </tr>
                        <tr>
                          <td className="font-bold py-1.5 align-top text-black uppercase text-[9.5px]">Projek Sebutharga</td>
                          <td className="py-1.5 text-center align-top text-zinc-400">:</td>
                          <td className="font-extrabold py-1.5 align-top text-neutral-900 uppercase leading-relaxed text-left">
                            {selectedAdId ? ads.find(a => a.id === selectedAdId)?.title : "[TAJUK SEBUT HARGA AKAN TERHASIL SECARA AUTOMATIK]"}
                          </td>
                        </tr>
                        <tr className="h-[4px]"><td colSpan={3}></td></tr>
                        <tr>
                          <td className="font-bold py-1.5 align-top text-black uppercase text-[9.5px]">Pembekal Dipelawa</td>
                          <td className="py-1.5 text-center align-top text-zinc-400">:</td>
                          <td className="font-extrabold py-1.5 align-top text-indigo-950 uppercase tracking-wide">
                            {selectedSuppliers.length > 0 ? (
                              <span className="bg-amber-100/80 border border-amber-300 px-2 py-0.5 rounded shadow-xs inline-block text-[11px]">{selectedSuppliers[0].companyName}</span>
                            ) : (
                              <span className="text-red-500 italic font-normal text-[9.5pt]">[Sila pilih pembekal di bawah untuk auto-masuk di sini]</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="font-bold py-1.5 align-top text-black uppercase text-[9.5px]">Alamat Berdaftar</td>
                          <td className="py-1.5 text-center align-top text-zinc-400">:</td>
                          <td className="py-1.5 align-top text-slate-800 uppercase leading-relaxed text-left whitespace-pre-wrap text-[10px] font-medium">
                            {selectedSuppliers.length > 0 ? (
                              selectedSuppliers[0].address || "ALAMAT TIADA REKOD"
                            ) : (
                              <span className="text-red-300 italic font-normal text-[9.5pt]">[Format Auto-alamat]</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Standard 5 Items - beautifully spaced on watermarked sheet */}
                  <div className="text-[11pt] leading-relaxed text-black text-justify space-y-4">
                    <div className="flex items-start">
                      <span className="w-6 font-bold text-indigo-900 shrink-0">1.</span>
                      <div>
                        Sebut harga adalah dipelawa daripada Kontraktor-Kontraktor yang berdaftar dengan{" "}
                        <strong className="underline text-black uppercase font-extrabold bg-blue-50/50 px-1 border border-blue-100 rounded">
                          {selectedAdId ? getLicensesText(ads.find(a => a.id === selectedAdId)) : "sijil pendaftaran yang berkaitan"}
                        </strong>{" "}
                        dan masih sah laku pendaftaran untuk dibenarkan menyertai sebutharga ini.
                      </div>
                    </div>

                    <div className="flex items-start">
                      <span className="w-6 font-bold text-indigo-900 shrink-0">2.</span>
                      <div>
                        Dokumen SebutHarga yang telah dilengkapi hendaklah dimasukkan ke dalam satu sampul surat bermetri dan bertulis nombor tawaran disebelah kiri atasnya dan dimasuk ke dalam Peti Tawaran yang terletak di{" "}
                        <strong className="underline text-black uppercase font-bold text-slate-900">
                          {submissionVenue || "[ALAMAT PETI SERAHAN PEJABAT RISDA]"}
                        </strong>{" "}
                        sebelum atau pada{" "}
                        <strong className="underline text-red-700 uppercase font-extrabold bg-red-50 px-1 border border-red-100 rounded">
                          {closingDate ? formatBeautifulDate(closingDate) : "[TARIKH TUTUP]"}
                        </strong>{" "}
                        Jam/Masa{" "}
                        <strong className="underline text-red-600 uppercase font-extrabold bg-red-50 px-1 border border-red-100 rounded">
                          {closingTime || "12.00 TENGAHARI"}
                        </strong>
                        .
                      </div>
                    </div>

                    <div className="flex items-start">
                      <span className="w-6 font-bold text-indigo-900 shrink-0">3.</span>
                      <div>
                        Syarat-syarat Sebut Harga, Pelan Lukisan serta Ringkasan Sebut Harga dikembarkan bersama-sama ini.
                      </div>
                    </div>

                    <div className="flex items-start">
                      <span className="w-6 font-bold text-indigo-900 shrink-0">4.</span>
                      <div>
                        Kontraktor adalah diwajibkan menghadiri taklimat dan lawatan tapak pada{" "}
                        <strong className="underline text-[11.5px] text-indigo-950 uppercase font-extrabold bg-amber-50 px-1 border border-amber-200 rounded">
                          {briefingDate ? `${formatBeautifulDate(briefingDate)} (${indonesianDayName(briefingDate)})` : "[TARIKH TAKLIMAT]"}
                        </strong>{" "}
                        Jam{" "}
                        <strong className="underline text-indigo-950 uppercase font-extrabold bg-amber-50 px-1 border border-amber-200 rounded">
                          {briefingTime || "[WAKTU TAKLIMAT]"}
                        </strong>
                        . Taklimat akan di sampaikan hanya sekali sahaja dan pihak kontraktor dikehendaki berkumpul di{" "}
                        <strong className="underline text-slate-900 uppercase font-bold">
                          {briefingVenue || "[LOKASI HIMPUNAN TAKLIMAT]"}
                        </strong>{" "}
                        pada tarikh dan masa yang telah ditetapkan diatas.
                      </div>
                    </div>

                    <div className="flex items-start">
                      <span className="w-6 font-bold text-indigo-900 shrink-0">5.</span>
                      <div>
                        Pihak RISDA tidak terikat untuk menerima sebut harga yang terendah sekali atau mana-mana sebutharga lain.
                      </div>
                    </div>
                  </div>


                </div>

                {/* Footer style for tawaran */}
                <div className="pt-2 border-t border-gray-200 mt-6 flex justify-between items-center text-[9px] shrink-0 relative z-20">
                  <span className="text-gray-400 tracking-wide font-sans font-semibold">E-SebutHarga RISDA Beaufort</span>
                  <span className="text-[8px] bg-gradient-to-r from-risda-orange to-risda-gold text-black px-2.5 py-0.5 rounded font-sans font-black uppercase tracking-wider shadow-sm">
                    Pratinjau Format 2
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: SUPPLIER DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <div className="bg-risda-card p-6 rounded-[35px] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-black text-white uppercase tracking-wider">
                DATA PEMBEKAL
              </h2>
              <p className="text-xs text-risda-muted font-bold">
                Gabungan pangkalan data automatik hasil pendaftaran kehadiran taklimat lawatan tapak digital dan daftar manual Beaufort.
              </p>
            </div>
            <button 
              onClick={() => { setEditingSupplier(null); setSupForm({ companyName: '', phoneNumber: '', email: '', address: '', cidbSpkk: '' }); setShowSupplierModal(true); }}
              className="px-6 py-3 bg-gradient-to-r from-risda-orange to-risda-gold text-black rounded-2xl text-[12px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Plus size={16} /> Daftar Pembekal Baru
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {directorySuppliers.map((sup) => (
              <div 
                key={sup.id}
                className="bg-risda-card border border-white/5 hover:border-white/10 rounded-3xl p-5 flex flex-col justify-between space-y-4 shadow-lg relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="p-3 bg-white/5 rounded-2xl text-risda-gold border border-white/5">
                      <Building size={20} />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {sup.cidbSpkk && (
                        <span className="px-2.5 py-0.5 bg-sky-500/10 border border-sky-500/20 text-[9px] font-bold text-sky-400 rounded-md uppercase font-mono">
                          CIDB: {sup.cidbSpkk}
                        </span>
                      )}
                      {sup.source === 'attendance' ? (
                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black text-emerald-400 rounded-md uppercase tracking-wider">
                          DARI KEHADIRAN
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-[8px] font-black text-amber-400 rounded-md uppercase tracking-wider">
                          DAFTAR MANUAL
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight leading-snug line-clamp-1">{sup.companyName}</h3>
                    <p className="text-[10px] text-white/50 font-bold uppercase flex items-center gap-1.5">
                      <Phone size={10} className="text-risda-orange" /> {sup.phoneNumber}
                    </p>
                    <p className="text-[10px] text-white/50 font-bold uppercase flex items-center gap-1.5 truncate">
                      <Mail size={10} className="text-risda-orange" /> {sup.email}
                    </p>
                  </div>

                  {sup.address && (
                    <p className="text-[10px] text-risda-muted italic leading-relaxed line-clamp-2 pt-1 border-t border-white/5">
                      {sup.address}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
                  <button 
                    onClick={() => { setEditingSupplier(sup); setSupForm(sup); setShowSupplierModal(true); }}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase rounded-lg transition-all"
                  >
                    Sunting
                  </button>
                  <button 
                    onClick={() => handleDeleteSupplier(sup.id!)}
                    className="p-2 bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-white/60 rounded-lg transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: PREVIEW & INTERACTION HUB FOR MULTI-CHANNEL SHARE */}
      <AnimatePresence>
        {selectedInvitation && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-risda-card border border-white/10 w-full max-w-5xl rounded-[45px] overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh] relative"
            >
              {/* Back button */}
              <button 
                onClick={() => setSelectedInvitation(null)}
                className="absolute top-6 right-6 w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center border border-white/10 z-50 transition-all active:scale-95"
              >
                ✕
              </button>

              {/* Left Side: Invitation Details list & quick actions */}
              <div className="w-full md:w-[50%] p-6 md:p-10 flex flex-col justify-between border-r border-white/10 overflow-y-auto max-h-[90vh] md:max-h-none">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="px-3 py-1 bg-risda-orange/10 border border-risda-orange/20 rounded-full text-[9px] font-black text-risda-orange uppercase tracking-widest">
                      Hab Hebahan & Tracking
                    </span>
                    <h3 className="text-xl font-black text-white uppercase leading-tight">
                      Sebut Harga No: {selectedInvitation.tenderNo}
                    </h3>
                    <p className="text-xs text-risda-muted italic font-bold">
                      {selectedInvitation.adTitle}
                    </p>
                  </div>

                        {isEditingInvFields ? (
                    <div className="space-y-3 p-4 bg-black/40 border border-white/10 rounded-2xl">
                      <div className="text-[10px] text-risda-gold font-bold uppercase tracking-widest font-black">SUNTING MAKLUMAT PETI / TAKLIMAT & TEMPOH SUTAT</div>
                      <div className="space-y-2 text-[10px]">
                        <div>
                          <label className="text-risda-muted font-black block uppercase mb-1">Peti Serahan Sebutharga (Pejabat RISDA)</label>
                          <textarea 
                            rows={2}
                            value={editSubmissionVenue}
                            onChange={e => setEditSubmissionVenue(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white text-xs outline-none focus:border-risda-orange/30 font-sans"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-risda-muted font-black block uppercase mb-1">Tarikh Tutup Sebut Harga</label>
                            <input 
                              type="date"
                              value={editClosingDate}
                              onChange={e => setEditClosingDate(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white text-xs outline-none font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-risda-muted font-black block uppercase mb-1">Jam/Masa Tutup</label>
                            <input 
                              type="text"
                              value={editClosingTime}
                              onChange={e => setEditClosingTime(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white text-xs outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                          <div>
                            <label className="text-risda-muted font-black block uppercase mb-1">Tarikh Surat Di Jana</label>
                            <input 
                              type="date"
                              value={editInvitationDate}
                              onChange={e => setEditInvitationDate(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white text-xs outline-none font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-risda-muted font-black block uppercase mb-1">Tarikh Hijri (Surat)</label>
                            <input 
                              type="text"
                              value={editHijriDate}
                              onChange={e => setEditHijriDate(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white text-xs outline-none"
                            />
                          </div>
                        </div>

                        {/* Briefing settings */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                          <div>
                            <label className="text-risda-muted font-black block uppercase mb-1">Tarikh Taklimat (Briefing)</label>
                            <input 
                              type="date"
                              value={editBriefingDate}
                              onChange={e => setEditBriefingDate(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white text-xs outline-none font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-risda-muted font-black block uppercase mb-1">Masa Taklimat (Briefing)</label>
                            <input 
                              type="text"
                              value={editBriefingTime}
                              onChange={e => setEditBriefingTime(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white text-xs outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-risda-muted font-black block uppercase mb-1">Tempat Taklimat (Briefing)</label>
                          <input 
                            type="text"
                            value={editBriefingVenue}
                            onChange={e => setEditBriefingVenue(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white text-xs outline-none"
                          />
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button 
                            type="button"
                            onClick={async () => {
                              const toastId = toast.loading('Mengemaskini maklumat...');
                              try {
                                await setDoc(doc(db, 'supplier_invitations', selectedInvitation.id), {
                                  submissionVenue: editSubmissionVenue,
                                  closingDate: editClosingDate,
                                  closingTime: editClosingTime,
                                  briefingDate: editBriefingDate,
                                  briefingTime: editBriefingTime,
                                  briefingVenue: editBriefingVenue,
                                  invitationDate: editInvitationDate,
                                  hijriDate: editHijriDate
                                }, { merge: true });
                                if (selectedInvitation) {
                                  setSelectedInvitation({
                                    ...selectedInvitation,
                                    submissionVenue: editSubmissionVenue,
                                    closingDate: editClosingDate,
                                    closingTime: editClosingTime,
                                    briefingDate: editBriefingDate,
                                    briefingTime: editBriefingTime,
                                    briefingVenue: editBriefingVenue,
                                    invitationDate: editInvitationDate,
                                    hijriDate: editHijriDate
                                  });
                                }
                                fetchInvitations();
                                setIsEditingInvFields(false);
                                toast.success('Maklumat dikemaskini!', { id: toastId });
                              } catch (e) {
                                toast.error('Gagal kemaskini.', { id: toastId });
                              }
                            }}
                            className="flex-1 py-2 bg-gradient-to-r from-risda-orange to-risda-gold text-black rounded-lg font-black uppercase text-[10px]"
                          >
                            Simpan
                          </button>
                          <button 
                            type="button"
                            onClick={() => setIsEditingInvFields(false)}
                            className="px-3 py-2 bg-white/5 rounded-lg text-white"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-4 p-4 bg-black/40 border border-white/5 rounded-2xl text-[10px] text-risda-muted font-bold uppercase">
                        <div>
                          <span className="text-white/30 text-[8px] block uppercase">No Rujukan Fail</span>
                          <span className="text-white font-mono break-all">{selectedInvitation.referenceNo}</span>
                        </div>
                        <div>
                          <span className="text-white/30 text-[8px] block uppercase">Pegawai Pengendali</span>
                          <span className="text-white">{selectedInvitation.officerName}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-white/30 text-[8px] block uppercase">Peti Serahan Sebutharga</span>
                          <span className="text-white whitespace-pre-wrap leading-normal block max-w-md normal-case font-normal">{selectedInvitation.submissionVenue || 'Pejabat RISDA Daerah Beaufort'}</span>
                        </div>
                        <div>
                          <span className="text-white/30 text-[8px] block uppercase">Tarikh Tutup</span>
                          <span className="text-white font-mono text-red-400">{selectedInvitation.closingDate || '-'}</span>
                        </div>
                        <div>
                          <span className="text-white/30 text-[8px] block uppercase">Masa/Jam Tutup</span>
                          <span className="text-white text-red-400">{selectedInvitation.closingTime || '-'}</span>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-white/5">
                          <span className="text-white/30 text-[8px] block uppercase">Tarikh & Masa Taklimat</span>
                          <span className="text-white">{selectedInvitation.briefingDate ? `${formatBeautifulDate(selectedInvitation.briefingDate)} (${indonesianDayName(selectedInvitation.briefingDate)})` : '-'} jam {selectedInvitation.briefingTime || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-white/30 text-[8px] block uppercase">Tempat/Lokaliti Taklimat</span>
                          <span className="text-white normal-case font-normal">{selectedInvitation.briefingVenue || '-'}</span>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          const def = getStaffDefaultOfficeAndAddress();
                          setEditSubmissionVenue(selectedInvitation.submissionVenue || def.fullAddress);
                          setEditClosingDate(selectedInvitation.closingDate || '');
                          setEditClosingTime(selectedInvitation.closingTime || '');
                          setEditBriefingDate(selectedInvitation.briefingDate || '');
                          setEditBriefingTime(selectedInvitation.briefingTime || '');
                          setEditBriefingVenue(selectedInvitation.briefingVenue || '');
                          setIsEditingInvFields(true);
                        }}
                        className="w-full py-2 border border-dashed border-white/10 hover:border-risda-orange/30 rounded-xl text-white/70 hover:text-white text-[9px] font-bold uppercase tracking-wider transition-all"
                      >
                        ✏️ Sunting Butiran Pejabat, Taklimat & Masa Tutup Surat
                      </button>
                    </div>
                  )}

                  {/* Filter Supplier Selection for printing */}
                  <div className="space-y-1.5 bg-black/20 p-3.5 border border-white/5 rounded-2xl">
                    <label className="text-[8px] text-risda-muted font-black uppercase tracking-wider block">PILIH PEMBEKAL BAGI MENYALIN JANAAN SALINAN CETAK</label>
                    <select 
                      value={selectedPrintSupplierId}
                      onChange={e => setSelectedPrintSupplierId(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl py-2 px-3 text-[11px] text-white outline-none focus:border-risda-orange/40 font-semibold"
                    >
                      <option value="ALL">CETAK SEMUA PEMBEKAL (${selectedInvitation.suppliers.length} KONTRAS)</option>
                      {selectedInvitation.suppliers.map((s, idx) => (
                        <option key={s.id || idx} value={s.companyName}>
                          {idx + 1}. {s.companyName.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Whitelist Suppliers list with instant WhatsApp/Email launch */}
                  <div className="space-y-3">
                    <p className="text-[10px] text-risda-gold font-bold uppercase tracking-[2px]">SALURAN HUBUNGAN KEPADA PEMBEKAL ({selectedInvitation.suppliers.length})</p>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                      {selectedInvitation.suppliers.map((s, idx) => (
                        <div key={idx} className="bg-black/30 border border-white/5 rounded-2xl p-3 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-black text-white uppercase truncate">{s.companyName}</h4>
                            <span className="text-[9px] text-risda-muted font-bold block">{s.phoneNumber} | {s.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* System SMTP Email button */}
                            <button 
                              type="button"
                              onClick={() => handleSendSmtpEmail(s, selectedInvitation)}
                              disabled={sendingEmailStates[s.companyName]}
                              className={`p-2 rounded-xl transition-all ${
                                sendingEmailStates[s.companyName]
                                  ? 'bg-yellow-500/20 text-yellow-400 animate-pulse cursor-not-allowed'
                                  : 'bg-risda-orange/10 hover:bg-risda-orange text-risda-orange hover:text-black'
                              }`}
                              title="Kirim E-mel & Dokumen Digital Rasmi Terus via SMTP Sistem"
                            >
                              <Send size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex flex-wrap gap-2">
                  <button 
                    type="button"
                    onClick={() => handlePrintDraft(selectedInvitation, 'rasmi')}
                    className="flex-1 min-w-[140px] py-3.5 bg-risda-orange hover:bg-opacity-90 text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    <FileText size={13} /> PDF Surat Rasmi
                  </button>
                  <button 
                    type="button"
                    onClick={() => handlePrintDraft(selectedInvitation, 'tawaran')}
                    className="flex-1 min-w-[140px] py-3.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    <Printer size={13} /> Cetak Surat Tawaran
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleBulkSendSmtpEmail(selectedInvitation)}
                    disabled={bulkSending}
                    className={`flex-1 min-w-[160px] py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] flex items-center justify-center gap-2 ${
                      bulkSending 
                        ? 'bg-yellow-500/20 text-yellow-400 animate-pulse cursor-not-allowed'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-black font-black'
                    }`}
                    title="Hantar Hebahan E-mel Pukal secara Autopilot via Pelayan SMTP"
                  >
                    <Send size={13} /> Hebahan E-mel (SMTP)
                  </button>
                  <button 
                    onClick={() => setSelectedInvitation(null)}
                    className="px-4 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Kembali
                  </button>
                </div>
              </div>

              {/* Right Side: Print-preview mockup paper */}
              <div className="hidden md:block w-[50%] bg-[#f7f8fa] p-8 overflow-y-auto max-h-[90vh]">
                <div className="bg-white text-black p-6 rounded-2xl shadow-lg border border-gray-200 text-[10px] font-serif leading-relaxed space-y-4">
                  <div className="border-b border-black text-center pb-2">
                    <span className="font-bold text-[11px]">PEJABAT RISDA DAERAH BEAUFORT</span><br />
                    <span className="text-[6px] text-gray-500">K77 & K78, BLOCK K, BEAUFORT SQUARE AVENUE, JALAN BINUNUK, 89800 BEAUFORT, SABAH | TEL: 087-224 335</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span>Ruj: <strong className="font-sans font-bold">{selectedInvitation.referenceNo}</strong></span>
                    <div className="flex flex-col text-right">
                      <span>Tarikh: {formatBeautifulDate(selectedInvitation.invitationDate)}</span>
                      <span className="text-gray-600 font-medium">{selectedInvitation.hijriDate || (selectedInvitation.invitationDate ? getHijriDate(selectedInvitation.invitationDate) : '')}</span>
                    </div>
                  </div>
                  <div>
                    <strong>PELAWAAN PEROLEHAN SEBUT HARGA BAGI:</strong><br />
                    <strong className="text-gray-900">{selectedInvitation.adTitle}</strong><br />
                    No. Tender: <strong className="font-sans text-red-700">{selectedInvitation.tenderNo}</strong>
                  </div>
                  <p>Butiran Briefing Tapak :<br />
                  📅 {formatBeautifulDate(selectedInvitation.briefingDate || '')} | {selectedInvitation.briefingTime || '-'} jam @ {selectedInvitation.briefingVenue || '-'}
                  </p>
                  <div className="pt-4 border-t border-gray-100 flex justify-between items-end">
                    <div>
                      <p>Saya yang menjalankan amanah,</p>
                      <br />
                      <p className="font-bold">({selectedInvitation.officerName.toUpperCase()})</p>
                      <p className="text-[8px] text-gray-500">Pentadbiran Sebutharga Beaufort</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: ADD / EDIT REGULAR SUPPLIER */}
      <AnimatePresence>
        {showSupplierModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-risda-card border border-white/10 w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl relative"
            >
              <div className="p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    {editingSupplier ? 'Sunting Pembekal' : 'Daftar Pembekal Baru'}
                  </h3>
                  <button 
                    onClick={() => { setShowSupplierModal(false); setEditingSupplier(null); }}
                    className="text-white/50 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveSupplier} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-risda-orange uppercase tracking-[2px] px-1">Nama Syarikat / Pembekal</label>
                    <input 
                      type="text"
                      required
                      value={supForm.companyName}
                      onChange={e => setSupForm({ ...supForm, companyName: e.target.value })}
                      placeholder="cth: Innogranite Enterprise"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:border-risda-orange/50 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-risda-orange uppercase tracking-[2px] px-1">No. Telefon / WA</label>
                      <input 
                        type="text"
                        required
                        value={supForm.phoneNumber}
                        onChange={e => setSupForm({ ...supForm, phoneNumber: e.target.value })}
                        placeholder="cth: 0192345678"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:border-risda-orange/50 outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-risda-orange uppercase tracking-[2px] px-1">Lesen CIDB / SPKK No</label>
                      <input 
                        type="text"
                        value={supForm.cidbSpkk}
                        onChange={e => setSupForm({ ...supForm, cidbSpkk: e.target.value })}
                        placeholder="cth: G2 / G3"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:border-risda-orange/50 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-risda-orange uppercase tracking-[2px] px-1">Alamat E-mel</label>
                    <input 
                      type="text"
                      required
                      value={supForm.email}
                      onChange={e => setSupForm({ ...supForm, email: e.target.value })}
                      placeholder="cth: syarikat@gmail.com (atau '-' jika tiada)"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:border-risda-orange/50 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-risda-orange uppercase tracking-[2px] px-1">Alamat Premis Syarikat</label>
                    <textarea 
                      value={supForm.address}
                      onChange={e => setSupForm({ ...supForm, address: e.target.value })}
                      placeholder="cth: Blok B, Lot 4, Pekan Beaufort, 89807 Beaufort, Sabah"
                      rows={3}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:border-risda-orange/50 outline-none"
                    />
                  </div>

                  <div className="pt-4 flex gap-2">
                    <button 
                      type="submit"
                      className="flex-1 py-4 bg-gradient-to-r from-risda-orange to-risda-gold text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      Simpan Pembekal
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setShowSupplierModal(false); setEditingSupplier(null); }}
                      className="px-5 py-4 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase rounded-xl transition-all"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
