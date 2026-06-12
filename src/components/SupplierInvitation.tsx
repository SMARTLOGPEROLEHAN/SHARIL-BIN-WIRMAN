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
  MessageCircle, 
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
  Clock,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  const { user, role } = useAuth();
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
  
  // Data lists
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [directorySuppliers, setDirectorySuppliers] = useState<Supplier[]>([]);
  
  // Form state
  const [selectedAdId, setSelectedAdId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [invitationDate, setInvitationDate] = useState(new Date().toISOString().split('T')[0]);
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

  const [submissionVenue, setSubmissionVenue] = useState('Pejabat RISDA Daerah Beaufort, K77 dan K78, Blok K, Beaufort Square Avenue 1, Jalan Binunuk, 89800 Beaufort, Sabah');
  const [selectedPrintSupplierId, setSelectedPrintSupplierId] = useState<string>('ALL');
  const [isEditingInvFields, setIsEditingInvFields] = useState(false);
  const [editSubmissionVenue, setEditSubmissionVenue] = useState('');
  const [editClosingDate, setEditClosingDate] = useState('');
  const [editClosingTime, setEditClosingTime] = useState('');
  const [editBriefingDate, setEditBriefingDate] = useState('');
  const [editBriefingTime, setEditBriefingTime] = useState('');
  const [editBriefingVenue, setEditBriefingVenue] = useState('');

  useEffect(() => {
    if (selectedInvitation) {
      setEditSubmissionVenue(selectedInvitation.submissionVenue || 'Pejabat RISDA Daerah Beaufort, K77 dan K78, Blok K, Beaufort Square Avenue 1, Jalan Binunuk, 89800 Beaufort, Sabah');
      setEditClosingDate(selectedInvitation.closingDate || '');
      setEditClosingTime(selectedInvitation.closingTime || '');
      setEditBriefingDate(selectedInvitation.briefingDate || '');
      setEditBriefingTime(selectedInvitation.briefingTime || '');
      setEditBriefingVenue(selectedInvitation.briefingVenue || '');
      setSelectedPrintSupplierId('ALL');
      setIsEditingInvFields(false);
    }
  }, [selectedInvitation]);

  useEffect(() => {
    fetchInvitations();
    fetchAds();
    fetchSuppliers();
    fetchLocations();
  }, []);

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
            cidbSpkk: data.cidbSpkk || '',
            source: 'attendance' as const
          });
        }
      });
      
      // 3. Merge & Deduplicate based on company name (case-insensitive & trimmed)
      const mergedMap = new Map<string, Supplier>();
      
      // Seed with attendance records first
      attendanceSuppliers.forEach(s => {
        const key = s.companyName.toUpperCase().trim();
        const existing = mergedMap.get(key);
        // Keep the one with phone or address if existing has empty values
        if (!existing || (s.phoneNumber && !existing.phoneNumber)) {
          mergedMap.set(key, s);
        }
      });
      
      // Overwrite or enrich with manual registrations (manual always overrides)
      manualSuppliers.forEach(s => {
        const key = s.companyName.toUpperCase().trim();
        mergedMap.set(key, s);
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
    if (selectedAd) {
      setClosingDate(selectedAd.closingDate || '');
      setClosingTime(selectedAd.closingTime || '');
      setBriefingDate(selectedAd.briefingDate || selectedAd.visitDate || '');
      setBriefingTime(selectedAd.briefingTime || '');
      setBriefingVenue(selectedAd.briefingVenue || selectedAd.visitVenue || '');
      setSubmissionVenue(selectedAd.docVenue || 'Pejabat RISDA Daerah Beaufort, K77 dan K78, Blok K, Beaufort Square Avenue 1, Jalan Binunuk, 89800 Beaufort, Sabah');
      
      // Auto generate reference mock number if empty
      if (!referenceNo) {
        const year = new Date().getFullYear();
        const rand = Math.floor(100 + Math.random() * 900);
        setReferenceNo(`RISDA.BFT.100-3/4/(${rand}) Jld.${year % 100}`);
      }
    } else {
      setClosingDate('');
      setClosingTime('');
      setBriefingDate('');
      setBriefingTime('');
      setBriefingVenue('');
      setSubmissionVenue('Pejabat RISDA Daerah Beaufort, K77 dan K78, Blok K, Beaufort Square Avenue 1, Jalan Binunuk, 89800 Beaufort, Sabah');
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
      let id = editingSupplier?.id;
      if (!id || id.startsWith('attendance_')) {
        id = `supplier_${Date.now()}`;
      }
      await setDoc(doc(db, 'suppliers', id), {
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

      // Send direct notification email via sent_emails to each selected supplier
      if (payload.suppliers && payload.suppliers.length > 0) {
        for (const s of payload.suppliers) {
          if (s.email && s.email.trim()) {
            const emailSubject = `Pelawaan Menyertai Sebut Harga RISDA Beaufort - No. Sebut Harga: ${payload.tenderNo}`;
            const emailBody = `Assalamualaikum dan Salam Sejahtera,

Kepada:
${s.companyName.toUpperCase()}
${s.address ? s.address.toUpperCase().replace(/\n/g, ', ') : 'TIADA REKOD ALAMAT'}

Tuan/Puan,

PELAWAAN MENYERTAI SEBUT HARGA BAGI:
"${payload.adTitle.toUpperCase()}"
NO. SEBUT HARGA: ${payload.tenderNo}

Dengan hormatnya perkara di atas adalah dirujuk.

2.    Sukacita dimaklumkan bahawa Pejabat RISDA Daerah Beaufort mempelawa syarikat pihak tuan/puan untuk mengemukakan tawaran bagi perolehan sebut harga tersebut di atas.

3.    Ketetapan bagi taklimat, lawatan tapak dan serahan sebut harga adalah seperti berikut:

TAKLIMAT / LAWATAN TAPAK (WAJIB):
- Tarikh / Hari : ${formatBeautifulDate(payload.briefingDate || '')} (${indonesianDayName(payload.briefingDate || '')})
- Masa         : ${payload.briefingTime || '-'}
- Tempat       : ${payload.briefingVenue || '-'}

TARIKH TUTUP & SERAHAN:
- Tarikh Tutup : Sebelum jam ${payload.closingTime || '-'} pada ${formatBeautifulDate(payload.closingDate || '')} (${indonesianDayName(payload.closingDate || '')})
- Tempat Serah : ${payload.submissionVenue || 'Pejabat RISDA Daerah Beaufort, Sabah'}

No. Rujukan Fail Surat: ${payload.referenceNo}

4.    Sila bawa bersama dokumen lesen syarikat asal (CIDB, SPKK, PUKONSA atau MOF yang berkaitan) beserta satu salinan semasa taklimat dijalankan. Hanya penama di dalam lesen sahaja dibenarkan mendaftar kehadiran taklimat tapak.

Sekian, terima kasih.

"MALAYSIA MADANI"
"BERKHIDMAT UNTUK NEGARA"

Saya yang menjalankan amanah,
(${payload.officerName ? payload.officerName.toUpperCase() : 'PEGAWAI RISDA DAERAH BEAUFORT'})
b.p. Pegawai RISDA Daerah Beaufort / Pengarah RISDA Negeri Sabah`;

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
      setSubmissionVenue('Pejabat RISDA Daerah Beaufort, K77 dan K78, Blok K, Beaufort Square Avenue 1, Jalan Binunuk, 89800 Beaufort, Sabah');
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
    
    const body = `PENTADBIRAN RISDA NEGERI SABAH
PEJABAT RISDA DAERAH BEAUFORT
Peti Surat 185, 89807 Beaufort, Sabah
Tel: 087-211142 | Faks: 087-212211
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

A) SYARAT KELAYAKAN LESEN & PENDAFTARAN:
${licenseReqStr}

B) TAKLIMAT DAN LAWATAN TAPAK (WAJIB):
Tarikh / Hari     : ${formatBeautifulDate(inv.briefingDate || '')} (${indonesianDayName(inv.briefingDate || '')})
Masa              : ${inv.briefingTime || '-'}
Tempat Taklimat   : ${inv.briefingVenue || '-'}
*Nota: Hanya penama di dalam lesen syarikat sahaja yang dibenarkan menghadiri taklimat dan lawatan tapak wajib. Sila bawa sijil asal dan salinan fotostat.*
${docInfoStr}
--------------------------------------------------
D) TARIKH DAN TEMPAT TUTUP SERAHAN:
--------------------------------------------------
Tarikh Tutup      : ${formatBeautifulDate(inv.closingDate || '')} (${indonesianDayName(inv.closingDate || '')})
Masa Tutup        : Sebelum jam ${inv.closingTime || '-'}
Tempat Serahan    : Peti Sebut Harga, Pejabat RISDA Daerah Beaufort, Sabah

--------------------------------------------------
E) PAUTAN RASMI DOKUMEN DIGITAL (CETAK & SIMPAN PDF):
--------------------------------------------------
Sila muat turun, bincang, atau cetak dokumen rasmi di pautan di bawah untuk tujuan simpanan fizikal syarikat tuan/puan:

📄 1. SURAT PELAWAAN RASMI DIGITAL (PDF):
👉 ${window.location.protocol}//${window.location.host}/?viewLetter=${inv.id}&company=${encodeURIComponent(supplier.companyName)}

📢 2. BUTIRAN IKLAN SEBUT HARGA & DAFTAR LOG KEHADIRAN:
👉 ${window.location.protocol}//${window.location.host}/?adId=${inv.adId}

==================================================

Sila bawa bersama dokumen lesen syarikat asal (CIDB, SPKK, PUKONSA atau MOF yang berkaitan) semasa taklimat dijalankan. Hanya penama di dalam lesen sahaja dibenarkan mendaftar kehadiran taklimat tapak digital.

Sekian untuk maklum balas dan tindakan pihak tuan/puan selanjutnya.

"MALAYSIA MADANI"
"Berkhidmat Untuk Negara"

Saya yang menjalankan amanah,

Pejabat RISDA Daerah Beaufort, Sabah.
(Penjanaan Pelawaan Digital b.p. Pegawai RISDA Daerah Beaufort)`;

    return `mailto:${supplier.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handlePrintDraft = (inv: Invitation | any, formatType: 'rasmi' | 'tawaran' = 'rasmi') => {
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
            <div style="font-size: 11pt; font-weight: bold; letter-spacing: 0.5px; color: #000; text-transform: uppercase;">PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH</div>
            <div style="font-size: 9.5pt; font-weight: bold; font-style: italic; color: #000; margin-top: 2px; text-transform: uppercase;">KEMENTERIAN KEMAJUAN DESA DAN WILAYAH</div>
            <div style="border-bottom: 4px double #000; margin-top: 15px; margin-bottom: 25px;"></div>
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
                <strong style="text-decoration: underline;">${(inv.submissionVenue || 'Pejabat RISDA Daerah Beaufort, K77 dan K78, Blok K, Beaufort Square Avenue 1, Jalan Binunuk, 89800 Beaufort, Sabah').toUpperCase()}</strong> sebelum atau pada 
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
                <strong style="text-decoration: underline;">${(inv.briefingVenue || 'Pejabat RISDA Beaufort').toUpperCase()}</strong> pada tarikh dan masa yang telah ditetapkan diatas.
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
          <div class="letter-page" style="page-break-after: always; position: relative; min-height: 10.2in; box-sizing: border-box; padding-bottom: 75px;">
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
                <strong style="font-size: 11pt; display: block; margin-bottom: 2px; text-transform: uppercase;">PEJABAT RISDA DAERAH BEAUFORT</strong>
                <strong style="font-size: 9.5pt; font-style: italic; display: block; margin-bottom: 4px; text-transform: uppercase;">(KEMENTERIAN KEMAJUAN DESA DAN WILAYAH)</strong>
                <div style="font-size: 8.5pt; display: flex; justify-content: space-between; align-items: flex-end; color: #000; line-height: 1.35; margin-top: 4px; width: 100%;">
                  <div style="text-align: left;">
                    K77 & K78, Block K, Beaufort Square Avenue 1,<br/>
                    Jalan Binunuk,<br/>
                    89800 Beaufort, Sabah
                  </div>
                  <div style="text-align: right;">
                    <table style="border-collapse: collapse; font-size: 8.5pt; color: #000; font-family: 'Times New Roman', Times, serif; line-height: 1.3; margin-left: auto;">
                      <tr>
                        <td style="padding: 0; text-align: left; font-weight: bold; width: 85px;">TEL</td>
                        <td style="padding: 0 4px; text-align: left;">:</td>
                        <td style="padding: 0; text-align: left; white-space: nowrap;">087-224335/336</td>
                      </tr>
                      <tr>
                        <td style="padding: 0; text-align: left; font-weight: bold; width: 85px;">EMAIL</td>
                        <td style="padding: 0 4px; text-align: left;">:</td>
                        <td style="padding: 0; text-align: left; white-space: nowrap;">prdbeaufort@risda.gov.my</td>
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
            <div style="border-bottom: 4px double #000; margin-top: 10px; margin-bottom: 15px;"></div>

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
                      ${inv.briefingVenue || 'Pejabat RISDA Beaufort'}
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
            <div class="page-footer" style="position: absolute; bottom: 0.20cm; left: 0.8in; right: 0.8in; font-family: 'Times New Roman', Times, serif; color: #000; text-align: center;">
              <div style="border-top: 1px solid #000; padding-top: 6px; font-size: 8pt; line-height: 1.35; margin-bottom: 2px;">
                MEMACU MASYARAKAT PEKEBUN KECIL MAKMUR DARIPADA SUMBER COMMODITI DAN HASIL<br/>
                BAHARU BERLANDASKAN REVOLUSI PERINDUSTRIAN DIGITAL SERTA TEKNOLOGI HIJAU
              </div>
              <div style="font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 10pt; line-height: 1;">1/3</div>
            </div>
          </div>

          <!-- PAGE 2: SIGN-OFF -->
          <div class="letter-page" style="page-break-after: always; position: relative; min-height: 10.2in; box-sizing: border-box; padding-bottom: 75px;">
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
              <div>Beaufort</div>
              <div style="margin-bottom: 10px;">b.p : Pengarah RISDA Negeri Sabah</div>

              <div style="font-size: 9.5pt; font-family: monospace; color: #333; margin-top: 50px; font-style: italic;">
                sebutharga${(() => {
                  const d = inv.invitationDate ? new Date(inv.invitationDate) : new Date();
                  return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
                })()}/desktop
              </div>
            </div>

            <!-- Page 2 Footer -->
            <div class="page-footer" style="position: absolute; bottom: 0.20cm; left: 0.8in; right: 0.8in; font-family: 'Times New Roman', Times, serif; color: #000; text-align: center;">
              <div style="border-top: 1px solid #000; padding-top: 6px; font-size: 8pt; line-height: 1.35; margin-bottom: 2px;">
                MEMACU MASYARAKAT PEKEBUN KECIL MAKMUR DARIPADA SUMBER COMMODITI DAN HASIL<br/>
                BAHARU BERLANDASKAN REVOLUSI PERINDUSTRIAN DIGITAL SERTA TEKNOLOGI HIJAU
              </div>
              <div style="font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 10pt; line-height: 1;">2/3</div>
            </div>
          </div>

          <!-- PAGE 3: EDARAN LIST (LAMPIRAN) -->
          <div class="letter-page" style="page-break-after: avoid; position: relative; min-height: 10.2in; box-sizing: border-box; padding-bottom: 75px;">
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
                  Pejabat RISDA Daerah Beaufort
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
            <div class="page-footer" style="position: absolute; bottom: 0.20cm; left: 0.8in; right: 0.8in; font-family: 'Times New Roman', Times, serif; color: #000; text-align: center;">
              <div style="border-top: 1px solid #000; padding-top: 6px; font-size: 8pt; line-height: 1.35; margin-bottom: 2px;">
                MEMACU MASYARAKAT PEKEBUN KECIL MAKMUR DARIPADA SUMBER COMMODITI DAN HASIL<br/>
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
            .header-info {
              border-bottom: 3px double #000;
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
                padding: 0.05cm 0.8in 1.4in 0.8in !important; /* Safe printable padding */
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
                bottom: 0.20cm !important;
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
                        title="Cetak Surat Rasmi"
                      >
                        <Printer size={13} />
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
                  <label className="text-[9px] font-black text-risda-orange uppercase tracking-[2px] px-1 block">TARIKH SURAT BELANJA</label>
                  <input 
                    type="date"
                    value={invitationDate}
                    onChange={(e) => setInvitationDate(e.target.value)}
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
            
            {/* Elegant Selector */}
            <div className="flex bg-black/40 border border-white/10 p-1 rounded-2xl relative shadow-inner">
              <button
                type="button"
                onClick={() => setPreviewFormat('rasmi')}
                className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  previewFormat === 'rasmi'
                    ? 'bg-gradient-to-r from-risda-orange to-risda-gold text-black shadow-lg font-black'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                📄 Format 1: Surat Rasmi
              </button>
              <button
                type="button"
                onClick={() => setPreviewFormat('tawaran')}
                className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  previewFormat === 'tawaran'
                    ? 'bg-gradient-to-r from-risda-orange to-risda-gold text-black shadow-lg font-black'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                ✏️ Format 2: Surat Tawaran
              </button>
            </div>

            {previewFormat === 'rasmi' && (
              <div className="flex bg-black/40 border border-white/10 p-1 rounded-2xl relative shadow-inner text-[10px] font-black uppercase text-center">
                <button
                  type="button"
                  onClick={() => setPreviewPage(1)}
                  className={`flex-1 py-2 px-3 rounded-xl transition-all ${
                    previewPage === 1
                      ? 'bg-gradient-to-r from-risda-orange to-risda-gold text-black shadow font-black'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Muka 1: Rujukan & Tajuk
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPage(2)}
                  className={`flex-1 py-2 px-3 rounded-xl transition-all ${
                    previewPage === 2
                      ? 'bg-gradient-to-r from-risda-orange to-risda-gold text-black shadow font-black'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Muka 2: Tandatangan
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPage(3)}
                  className={`flex-1 py-2 px-3 rounded-xl transition-all ${
                    previewPage === 3
                      ? 'bg-gradient-to-r from-risda-orange to-risda-gold text-black shadow font-black'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Muka 3: Edaran Lampiran
                </button>
              </div>
            )}

            <div className="bg-white text-black p-6 md:p-8 rounded-[40px] shadow-2xl min-h-[660px] border border-gray-200 relative overflow-hidden flex flex-col font-serif" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
              {/* Draft marker */}
              <div className="absolute top-2 right-2 bg-red-600 text-white text-[8px] font-mono px-3 py-1 rounded font-black tracking-widest transform rotate-4 shadow-md uppercase z-20">
                PRATINJAU DRAFT
              </div>

              {previewFormat === 'rasmi' ? (
                <div className="flex-1 flex flex-col justify-between text-black text-xs leading-relaxed">
                  {previewPage === 1 && (
                    <div className="animate-[fadeIn_0.3s_ease-out]">
                      {/* Header Logo & Address */}
                      <div className="flex items-start justify-between border-b-[4px] border-double border-black pb-3 mb-4">
                        <div className="w-[65px] h-[65px] shrink-0 mr-3">
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
                            className="w-full h-auto object-contain block"
                            referrerPolicy="no-referrer"
                            alt="RISDA Logo"
                          />
                        </div>
                        <div className="flex-1 text-left leading-tight text-black" style={{ fontSize: '7.5pt' }}>
                          <strong className="text-[8.5pt] block mb-0.5 uppercase">PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH<br/>(RISDA)</strong>
                          <strong className="text-[8.5pt] block mb-0.5 uppercase">PEJABAT RISDA DAERAH BEAUFORT</strong>
                          <strong className="text-[7.5pt] italic block mb-1 uppercase text-slate-700">(KEMENTERIAN KEMAJUAN DESA DAN WILAYAH)</strong>
                          <div className="text-[7pt] text-slate-800 line-clamp-3">
                            K77 & K78, Block K, Beaufort Square Avenue 1, Jalan Binunuk, 89800 Beaufort, Sabah.<br/>
                            Tel: 087-224335/336 &nbsp;|&nbsp; Emel: prdbeaufort@risda.gov.my &nbsp;|&nbsp; Web: http://www.risda.gov.my
                          </div>
                        </div>
                      </div>

                      {/* Reference box right */}
                      <div className="flex justify-end text-[10px] mb-4 text-right">
                        <table className="border-collapse">
                          <tbody>
                            <tr>
                              <td className="font-normal pr-2 text-left">Ruj. Kami</td>
                              <td className="pr-2">:</td>
                              <td className="font-normal text-left">{referenceNo || "RISDA/BFT/...Jld.2"}</td>
                            </tr>
                            <tr>
                              <td className="font-bold pr-2 text-left">Tarikh</td>
                              <td className="pr-2">:</td>
                              <td className="text-left">{invitationDate ? formatBeautifulDate(invitationDate) : "—"}</td>
                            </tr>
                            <tr>
                              <td className="pr-2"></td>
                              <td className="pr-2"></td>
                              <td className="text-[9px] text-slate-500 text-left">11 Syaaban 1446H</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Recipient info on left */}
                      <div className="text-[10px] text-left uppercase mb-4 leading-normal font-sans">
                        {selectedSuppliers.length > 0 ? (
                          <>
                            <strong className="text-blue-900">{selectedSuppliers[0].companyName}</strong><br />
                            <span className="text-slate-700 font-medium whitespace-pre-wrap">{selectedSuppliers[0].address || "ALAMAT KONTRAKTOR TIADA"}</span><br />
                            <span>NO. TEL: {selectedSuppliers[0].phoneNumber}</span>
                          </>
                        ) : (
                          <span className="text-red-500 italic">[Sila pilih sekurang-kurangnya satu pembekal untuk diuji alamatnya]</span>
                        )}
                      </div>

                      <div className="text-[10.5px] mb-2 font-sans text-left">Tuan/Puan,</div>

                      {/* Letter title and body */}
                      <div className="text-[10.5px] text-justify space-y-3 leading-normal">
                        <div className="font-black text-black uppercase underline tracking-normal mb-3">
                          PELAWAAN SEBUT HARGA RISDA : {selectedAdId ? ads.find(a => a.id === selectedAdId)?.tenderNo : "[NO. TENDER]"}<br />
                          {selectedAdId ? ads.find(a => a.id === selectedAdId)?.title : "[TAJUK SEBUT HARGA]"}
                        </div>

                        <p>Perkara di atas adalah dirujuk.</p>
                        <p>2. &nbsp;&nbsp;&nbsp;&nbsp; Dimaklumkan tuan/puan dijemput hadir untuk menyertai sebut harga di atas mengikut ketetapan berikut:</p>

                        {/* Briefing table details */}
                        <table className="w-[90%] mx-auto border border-collapse text-[10px] my-3">
                          <tbody>
                            <tr className="border-b border-gray-100">
                              <td className="w-[22%] py-1 font-bold">Tarikh</td>
                              <td className="w-[3%] py-1 text-center">:</td>
                              <td className="w-[75%] py-1 font-black text-slate-900">
                                {briefingDate ? `${formatBeautifulDate(briefingDate)} (${indonesianDayName(briefingDate)})` : "-"}
                              </td>
                            </tr>
                            <tr className="border-b border-gray-100">
                              <td className="py-1 font-bold">Masa</td>
                              <td className="py-1 text-center">:</td>
                              <td className="py-1 font-black">
                                {briefingTime || "-"}
                              </td>
                            </tr>
                            <tr className="border-b border-gray-100">
                              <td className="py-1 font-bold">Pendaftaran</td>
                              <td className="py-1 text-center">:</td>
                              <td className="py-1">
                                {briefingVenue || "Pejabat RISDA Beaufort"}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1 font-bold">Lawatan</td>
                              <td className="py-1 text-center">:</td>
                              <td className="py-1 italic text-slate-600">
                                {selectedAdId ? (ads.find(a => a.id === selectedAdId)?.visitVenue || ads.find(a => a.id === selectedAdId)?.briefingVenue || briefingVenue || "Lokaliti iklan") : "Lokaliti iklan"}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <p>
                          3. &nbsp;&nbsp;&nbsp;&nbsp; Sehubungan itu, tuan/puan diminta membawa <strong>Sijil Asal {selectedAdId ? getLicensesText(ads.find(a => a.id === selectedAdId)).toUpperCase() : "SIJIL PENDAFTARAN"}</strong> berserta 1 salinan semasa mengambil dokumen.
                        </p>
                        <p>
                          4. &nbsp;&nbsp;&nbsp;&nbsp; Bersama ini disertakan salinan iklan sebut harga untuk rujukan pihak tuan/puan.
                        </p>
                      </div>
                    </div>
                  )}

                  {previewPage === 2 && (
                    <div className="animate-[fadeIn_0.3s_ease-out] flex-1">
                      {/* Rujukan & Halaman Header */}
                      <div className="flex justify-between items-center text-[10px] mb-6 font-serif text-slate-500 relative">
                        <div className="text-left py-0.5 text-black">
                          Ruj. Kami: {referenceNo || "RISDA/BFT/...Jld.2"}
                        </div>
                        <div />
                      </div>

                      <div className="space-y-4 text-[11px] text-left leading-relaxed mt-12">
                        <p>Sekian, terima kasih.</p>
                        
                        <div className="font-extrabold uppercase text-slate-900 tracking-tight">
                          "MALAYSIA MADANI"<br />
                          "BERKHIDMAT UNTUK NEGARA"
                        </div>

                        <p className="pt-2 mb-0">Saya yang menjalankan amanah,</p>
                        <br />
                        <br />
                        <br />
                        <div>
                          <strong className="underline text-[12px] block uppercase">({officerName || "NAMA PEGAWAI"})</strong>
                          <span className="block font-medium">Pegawai RISDA Daerah Beaufort</span>
                          <span className="block text-slate-500 text-[10px] italic">b.p. Pengarah RISDA Negeri Sabah</span>
                        </div>

                        <div className="text-[8.5px] font-mono text-slate-400 pt-16 italic">
                          sebutharga{(() => {
                            const d = invitationDate ? new Date(invitationDate) : new Date();
                            return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
                          })()}/desktop
                        </div>
                      </div>
                    </div>
                  )}

                  {previewPage === 3 && (
                    <div className="animate-[fadeIn_0.3s_ease-out] flex-1">
                      {/* Rujukan & Halaman Header */}
                      <div className="flex justify-between items-center text-[10px] mb-8 font-serif text-slate-500 relative">
                        <div className="text-left py-0.5 text-black">
                          Ruj. Kami: {referenceNo || "RISDA/BFT/...Jld.2"}
                        </div>
                        <div />
                      </div>

                      <div className="space-y-6 text-left text-[11px] leading-relaxed">
                        <div>
                          <strong className="underline text-slate-900 block mb-2 uppercase tracking-wide">EDARAN DALAMAN</strong>
                          <div className="flex gap-2 items-start pl-2">
                            <span>1.</span>
                            <div>
                              <strong>Unit Tanam Semula</strong><br/>
                              Pejabat RISDA Daerah Beaufort, Sabah.
                            </div>
                          </div>
                        </div>

                        <div className="pt-2">
                          <strong className="underline text-slate-900 block mb-2 uppercase tracking-wide">EDARAN LUARAN</strong>
                          <div className="space-y-3 font-sans">
                            {selectedSuppliers.length === 0 ? (
                              <span className="text-red-500 italic">[Sila pilih pembekal untuk menjana edaran luaran di lampiran ini]</span>
                            ) : (
                              selectedSuppliers.map((s, idx) => (
                                <div key={idx} className="flex gap-2 items-start pl-2 border-b border-slate-100 pb-2">
                                  <strong>{idx + 1}.</strong>
                                  <div>
                                    <strong className="text-blue-900">{s.companyName.toUpperCase()}</strong><br />
                                    <span className="text-[10px] text-slate-600 block">{s.address ? s.address.toUpperCase() : "TIADA REKOD ALAMAT"}</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Real page footer representation (with identical centered page number as the printed template) */}
                  <div className="pt-2 border-t border-black text-[7.5px] font-sans tracking-wide leading-tight text-slate-500 mt-6 select-none uppercase shrink-0 text-center">
                    MEMACU MASYARAKAT PEKEBUN KECIL MAKMUR DARIPADA SUMBER COMMODITI DAN HASIL<br />
                    BAHARU BERLANDASKAN REVOLUSI PERINDUSTRIAN DIGITAL SERTA TEKNOLOGI HIJAU
                    <div className="text-center font-black text-black text-[10px] mt-1.5 font-serif">
                      {previewPage === 1 ? "1/3" : previewPage === 2 ? "2/3" : "3/3"}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-full font-serif text-black overflow-y-auto max-h-[80vh] p-2 leading-relaxed" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
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
                      <div className="font-bold text-[11pt] text-black tracking-normal leading-tight uppercase">
                        PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH
                      </div>
                      <div className="font-bold text-[9.5pt] text-black italic tracking-wide mt-1 uppercase">
                        KEMENTERIAN KEMAJUAN DESA DAN WILAYAH
                      </div>
                      <div className="w-full border-b-[4px] border-double border-black mt-3 mb-5"></div>
                      
                      <h1 className="font-bold text-[13pt] text-black tracking-wider mt-1 underline uppercase text-center leading-normal">
                        SURAT TAWARAN PELAWAAN SEBUTHARGA
                      </h1>
                    </div>

                    {/* Metadata table */}
                    <table className="w-full text-[11pt] leading-normal text-black border-collapse mb-5">
                      <tbody>
                        <tr>
                          <td className="w-[28%] font-bold py-1 align-top text-black">No.Sebutharga</td>
                          <td className="w-[3%] py-1 text-center align-top text-black">:</td>
                          <td className="w-[69%] font-bold py-1 align-top font-mono tracking-wide text-black text-red-700">
                            {selectedAdId ? ads.find(a => a.id === selectedAdId)?.tenderNo : "[PILIH PROJEK UNTUK NO. SEBUT HARGA]"}
                          </td>
                        </tr>
                        <tr>
                          <td className="font-bold py-1 align-top text-black">Sebutharga</td>
                          <td className="py-1 text-center align-top text-black">:</td>
                          <td className="font-bold py-1 align-top text-black uppercase leading-relaxed text-left text-blue-900">
                            {selectedAdId ? ads.find(a => a.id === selectedAdId)?.title : "[TAJUK SEBUT HARGA AKAN TERHASIL SECARA AUTOMATIK]"}
                          </td>
                        </tr>
                        <tr className="h-[8px]"><td colSpan={3}></td></tr>
                        <tr>
                          <td className="font-bold py-1 align-top text-black">Pembekal/Kontraktor</td>
                          <td className="py-1 text-center align-top text-black">:</td>
                          <td className="font-bold py-1 align-top text-black uppercase tracking-wide text-slate-800">
                            {selectedSuppliers.length > 0 ? (
                              <span className="bg-amber-50 border border-dashed border-amber-300 px-1 rounded">{selectedSuppliers[0].companyName}</span>
                            ) : (
                              <span className="text-red-500 italic font-normal text-[9.5pt]">[Sila pilih pembekal di bawah untuk auto-masuk di sini]</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="font-bold py-1 align-top text-black">Alamat</td>
                          <td className="py-1 text-center align-top text-black">:</td>
                          <td className="py-1 align-top text-black uppercase leading-relaxed text-left whitespace-pre-wrap text-slate-700">
                            {selectedSuppliers.length > 0 ? (
                              selectedSuppliers[0].address || "ALAMAT TIADA REKOD"
                            ) : (
                              <span className="text-red-300 italic font-normal text-[9.5pt]">[Format Auto-alamat]</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Standard 5 Items */}
                    <div className="text-[11pt] leading-relaxed text-black text-justify space-y-3">
                      <div className="flex items-start">
                        <span className="w-6 font-bold shrink-0">1.</span>
                        <div>
                          Sebut harga adalah dipelawa daripada Kontraktor-Kontraktor yang berdaftar dengan{" "}
                          <strong className="underline text-black uppercase">
                            {selectedAdId ? getLicensesText(ads.find(a => a.id === selectedAdId)) : "sijil pendaftaran yang berkaitan"}
                          </strong>{" "}
                          dan masih sah laku pendaftaran untuk dibenarkan menyertai sebutharga ini.
                        </div>
                      </div>

                      <div className="flex items-start">
                        <span className="w-6 font-bold shrink-0">2.</span>
                        <div>
                          Dokumen SebutHarga yang telah dilengkapi hendaklah dimasukkan ke dalam satu sampul surat bermetri dan bertulis nombor tawaran disebelah kiri atasnya dan dimasuk ke dalam Peti Tawaran yang terletak di{" "}
                          <strong className="underline text-black uppercase">
                            {submissionVenue || "[ALAMAT PETI SERAHAN PEJABAT RISDA]"}
                          </strong>{" "}
                          sebelum atau pada{" "}
                          <strong className="underline text-black uppercase">
                            {closingDate ? formatBeautifulDate(closingDate) : "[TARIKH TUTUP]"}
                          </strong>{" "}
                          Jam/Masa{" "}
                          <strong className="underline text-black uppercase">
                            {closingTime || "12.00 TENGAHARI"}
                          </strong>
                          .
                        </div>
                      </div>

                      <div className="flex items-start">
                        <span className="w-6 font-bold shrink-0">3.</span>
                        <div>
                          Syarat-syarat Sebut Harga, Pelan Lukisan serta Ringkasan Sebut Harga dikembarkan bersama-sama ini.
                        </div>
                      </div>

                      <div className="flex items-start">
                        <span className="w-6 font-bold shrink-0">4.</span>
                        <div>
                          Kontraktor adalah diwajibkan menghadiri taklimat dan lawatan tapak pada{" "}
                          <strong className="underline text-black uppercase">
                            {briefingDate ? `${formatBeautifulDate(briefingDate)} (${indonesianDayName(briefingDate)})` : "[TARIKH TAKLIMAT]"}
                          </strong>{" "}
                          Jam{" "}
                          <strong className="underline text-black uppercase">
                            {briefingTime || "[WAKTU TAKLIMAT]"}
                          </strong>
                          . Taklimat akan di sampaikan hanya sekali sahaja dan pihak kontraktor dikehendaki berkumpul di{" "}
                          <strong className="underline text-black uppercase">
                            {briefingVenue || "[LOKASI HIMPUNAN TAKLIMAT]"}
                          </strong>{" "}
                          pada tarikh dan masa yang telah ditetapkan diatas.
                        </div>
                      </div>

                      <div className="flex items-start">
                        <span className="w-6 font-bold shrink-0">5.</span>
                        <div>
                          Pihak RISDA tidak terikat untuk menerima sebut harga yang terendah sekali atau mana-mana sebutharga lain.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer style for tawaran */}
                  <div className="pt-2 border-t border-gray-100 mt-2 flex justify-between items-center text-[9px] shrink-0">
                    <span className="text-gray-400 tracking-wide font-sans font-medium">E-SebutHarga RISDA Beaufort</span>
                    <span className="text-[8px] bg-risda-orange text-black px-2 py-0.5 rounded font-sans font-black uppercase">
                      Pratinjau Format 2
                    </span>
                  </div>
                </>
              )}
            </div>
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
                                  briefingVenue: editBriefingVenue
                                }, { merge: true });
                                if (selectedInvitation) {
                                  setSelectedInvitation({
                                    ...selectedInvitation,
                                    submissionVenue: editSubmissionVenue,
                                    closingDate: editClosingDate,
                                    closingTime: editClosingTime,
                                    briefingDate: editBriefingDate,
                                    briefingTime: editBriefingTime,
                                    briefingVenue: editBriefingVenue
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
                          setEditSubmissionVenue(selectedInvitation.submissionVenue || 'Pejabat RISDA Daerah Beaufort, K77 dan K78, Blok K, Beaufort Square Avenue 1, Jalan Binunuk, 89800 Beaufort, Sabah');
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
                            {/* WhatsApp button */}
                            <a 
                              href={getWhatsAppURL(s, selectedInvitation)}
                              target="_blank" 
                              rel="noreferrer"
                              className="p-2 bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-black rounded-xl transition-all"
                              title="Kongsi Maklumat Jemputan di WhatsApp"
                            >
                              <MessageCircle size={14} />
                            </a>
                            {/* Email button */}
                            <a 
                              href={getEmailMailto(s, selectedInvitation)}
                              className="p-2 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white rounded-xl transition-all"
                              title="Hantar Mel Pelawaan Rasmi"
                            >
                              <Mail size={14} />
                            </a>
                            {/* Supplier letter PDF link */}
                            <a 
                              href={`/?viewLetter=${selectedInvitation.id}&company=${encodeURIComponent(s.companyName)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white rounded-xl transition-all"
                              title="Lihat Pautan Surat & Iklan PDF Kontraktor"
                            >
                              <ExternalLink size={14} />
                            </a>
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
                    <Printer size={13} /> Cetak Surat Rasmi
                  </button>
                  <button 
                    type="button"
                    onClick={() => handlePrintDraft(selectedInvitation, 'tawaran')}
                    className="flex-1 min-w-[140px] py-3.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    <Printer size={13} /> Cetak Surat Tawaran
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
                    <span className="text-[6px] text-gray-500">Tel: 087-211142 | Faks: 087-212211</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span>Ruj: <strong className="font-sans font-bold">{selectedInvitation.referenceNo}</strong></span>
                    <span>Tarikh: {formatBeautifulDate(selectedInvitation.invitationDate)}</span>
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
