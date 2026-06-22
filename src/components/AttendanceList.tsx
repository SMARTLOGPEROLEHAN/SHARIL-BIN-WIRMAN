import React, { useState, useEffect } from 'react';
import { ClipboardList, Users, Calendar, Building2, Trash2, Eye, Search, ChevronDown, X, Phone, Mail, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, getDocs, orderBy, where, deleteDoc, doc, updateDoc, getDoc, writeBatch, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import AttendanceForm from './AttendanceForm';
import { toast } from 'react-hot-toast';

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr || dateStr === '-' || dateStr === 'TIADA') return dateStr || '-';
  
  try {
    const standardized = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
    const d = new Date(standardized);
    if (isNaN(d.getTime())) return dateStr;
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    const days = ['AHAD', 'ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT', 'SABTU'];
    const dayName = days[d.getDay()];
    
    return `${day}/${month}/${year} (${dayName})`;
  } catch (e) {
    return dateStr;
  }
};

interface AttendanceRecord {
  id: string;
  adId: string;
  adTitle?: string;
  companyName: string;
  ownerName: string;
  companyAddress?: string;
  icNumber: string;
  phoneNumber: string;
  timestamp: string;
}

export default function AttendanceList() {
  const { role, office: userOffice } = useAuth();
  const isStaff = role === 'penginput' || role === 'pelulus' || role === 'admin' || role === 'pentadbir';
  const isAdmin = role === 'admin';
  
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewRecord, setPreviewRecord] = useState<any | null>(null);
  const currentYearStr = new Date().getFullYear().toString();
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(currentYearStr);
  const [projects, setProjects] = useState<string[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleResendEmail = async (record: any) => {
    if (!record.email || !record.email.trim() || record.email.trim() === '-') {
      toast.error('Gagal menghantar semula: Tiada alamat e-mel yang sah disimpan dalam rekod ini.');
      return;
    }

    if (resendingId) return;

    const confirmResend = window.confirm(`Adakah anda mahu menghantar semula e-mel pendaftaran kehadiran taklimat tapak kepada ${record.companyName} (${record.email})?`);
    if (!confirmResend) return;

    setResendingId(record.id);
    const toastId = toast.loading('Menjana dokumen & menghantar e-mel...');

    try {
      // 1. Fetch live ad data from Firestore
      let adData: any = null;
      try {
        const adDocRef = doc(db, 'ads', record.adId);
        const adDocSnap = await getDoc(adDocRef);
        if (adDocSnap.exists()) {
          adData = adDocSnap.data();
        }
      } catch (adErr) {
        console.error('Error fetching ad detail during resend:', adErr);
      }

      const briefingDate = adData?.briefingDate || '';
      const briefingTime = adData?.briefingTime || 'Seperti diiklankan';
      const briefingVenue = adData?.briefingVenue || 'Pejabat RISDA Beaufort';
      const visitVenue = adData?.visitVenue || adData?.briefingVenue || 'Pejabat RISDA Beaufort';
      const office = adData?.office || record.office || 'PEJABAT RISDA DAERAH BEAUFORT';
      const tenderNo = adData?.tenderNo || record.tenderNo || '-';
      const adTitle = record.adTitle || adData?.title || '';

      // 2. Prepare virtual objects for PDF generator
      const virtualInv = {
        adId: record.adId,
        adTitle: adTitle,
        tenderNo: tenderNo,
        referenceNo: adData?.referenceNo || '',
        invitationDate: adData?.publishedDate || '',
        closingDate: adData?.closingDate || '',
        closingTime: adData?.closingTime || '',
        briefingDate: briefingDate || '',
        briefingTime: briefingTime || '',
        briefingVenue: briefingVenue || '',
        submissionVenue: visitVenue || briefingVenue || 'PEJABAT RISDA DAERAH BEAUFORT',
        officerName: adData?.officerName || 'PEGAWAI PEROLEHAN RISDA',
        state: adData?.state || 'Sabah',
        office: office || 'PEJABAT RISDA DAERAH BEAUFORT'
      };

      const virtualSupplier = {
        companyName: record.companyName.toUpperCase().trim(),
        address: record.companyAddress || 'Kawasan Beaufort, Sabah'
      };

      // 3. Generate PDF base64
      let b64 = '';
      try {
        b64 = '';
      } catch (pdfErr) {
        console.error('Failed to generate Surat Tawaran PDF:', pdfErr);
        throw new Error('Gagal menjana fail PDF Surat Tawaran.');
      }

      const normalizedCompanyName = record.companyName.toUpperCase().trim();
      const seriesNo = record.docSeriesNo || '001';

      const formatAbbreviatedDateResend = (dateStr: string) => {
        if (!dateStr) return '';
        try {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return dateStr;
          const months = [
            'JAN', 'FEB', 'MAC', 'APR', 'MEI', 'JUN',
            'JUL', 'OGS', 'SEP', 'OKT', 'NOV', 'DIS'
          ];
          return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        } catch (e) {
          return dateStr;
        }
      };

      const dayNameResend = (dateStr: string) => {
        try {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return '';
          const days = ['AHAD', 'ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT', 'SABTU'];
          return days[d.getDay()];
        } catch (e) {
          return '';
        }
      };

      const formattedBriefingDateEmail = briefingDate ? `${formatAbbreviatedDateResend(briefingDate)} (${dayNameResend(briefingDate).toUpperCase()})` : 'Seperti diiklankan';

      // 4. Create email templates
      const emailSubject = `PENDAFTARAN TAKLIMAT TAPAK BAGI SEBUTHARGA ${adTitle.toUpperCase()} TELAH BERJAYA - No. Siri: ${seriesNo}`;
      const emailBody = `Assalamualaikum dan Salam Sejahtera,

Tuan/Puan,

PENGESAHAN PENDAFTARAN KEHADIRAN TAKLIMAT / LAWATAN TAPAK SECARA ONLINE

Syarikat: ${normalizedCompanyName.toUpperCase()}
Pemilik/Penama: ${record.ownerName.trim().toUpperCase()}
Emel: ${record.email ? record.email.trim() : '-'}
Telefon: ${record.phoneNumber ? record.phoneNumber.trim() : '-'}

Dengan hormatnya dimaklumkan bahawa pendaftaran taklimat tapak bagi sebutharga berikut TELAH BERJAYA:

Tajuk Sebut Harga: ${adTitle.toUpperCase()}
No. Sebut Harga: ${tenderNo.toUpperCase()}

Sila ambil maklum maklumat penting bagi lawatan tapak yang bakal dijalankan seperti berikut:

1. NO. SIRI PENDAFTARAN : ${seriesNo}
2. TEMPAT LAWATAN TAPAK : ${visitVenue}
3. HARI & TARIKH LAWATAN : ${formattedBriefingDateEmail}
4. MASA LAWATAN TAPAK : ${briefingTime}

Sila bawa bersama dokumen lesen syarikat asal (CIDB, SPKK, PUKONSA atau MOF yang berkaitan) beserta satu salinan dan dokumen-dokumen yang diperlukan semasa mengemukakan tawaran.`;

      const emailHtml = `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #000000; white-space: pre-wrap; word-break: break-word;">${emailBody}</div>
`;

      const attachments = [];
      if (b64) {
        attachments.push({
          filename: `Surat_Tawaran_Pelawaan_${normalizedCompanyName.replace(/\s+/g, '_')}.pdf`,
          content: b64,
          contentType: 'application/pdf'
        });
      }

      // 5. Trigger back-end direct SMTP send
      const sendRes = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: record.email.trim(),
          subject: emailSubject,
          text: emailBody,
          html: emailHtml,
          attachments
        })
      });

      if (sendRes.ok) {
        // Log in sent_emails
        await addDoc(collection(db, 'sent_emails'), {
          to: record.email.trim(),
          toName: record.ownerName.trim(),
          subject: emailSubject,
          body: emailBody,
          html: emailHtml,
          sentAt: new Date().toISOString()
        });

        toast.success(`E-mel pendaftaran kehadiran berjaya dihantar semula kepada ${record.companyName}!`, { id: toastId });
      } else {
        const errData = await sendRes.json();
        throw new Error(errData.error || 'Server SMTP failed to send e-mail.');
      }
    } catch (err: any) {
      console.error('SMTP resend error:', err);
      toast.error(`Gagal menghantar e-mel: ${err.message || 'Sila semak konfigurasi e-mel SMTP.'}`, { id: toastId });
    } finally {
      setResendingId(null);
    }
  };

  useEffect(() => {
    if (isStaff) {
      fetchAttendance();
    }
  }, [isStaff, userOffice, role]);

  const filteredAttendance = attendance.filter(record => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      record.companyName.toLowerCase().includes(searchLower) ||
      (record.adTitle?.toLowerCase() || '').includes(searchLower) ||
      record.ownerName.toLowerCase().includes(searchLower) ||
      record.adId.toLowerCase().includes(searchLower)
    );
    const matchesProject = !projectFilter || record.adTitle === projectFilter;
    const matchesYear = yearFilter === 'ALL' || (record.timestamp ? new Date(record.timestamp).getFullYear().toString() : '') === yearFilter;
    return matchesSearch && matchesProject && matchesYear;
  });

  const groupedAttendance = filteredAttendance.reduce((acc: any, record) => {
    if (!record.adTitle) return acc; // Only show records with valid projects
    const projectTitle = record.adTitle;
    if (!acc[projectTitle]) {
      acc[projectTitle] = [];
    }
    acc[projectTitle].push(record);
    return acc;
  }, {});

  const fetchAttendance = async () => {
    const collName = 'attendance';
    try {
      let q;
      if (isAdmin) {
        q = query(collection(db, collName), orderBy('timestamp', 'asc'));
      } else {
        q = query(collection(db, collName), where('office', '==', userOffice || ''), orderBy('timestamp', 'asc'));
      }

      const querySnapshot = await getDocs(q);
      const attendanceData: AttendanceRecord[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        attendanceData.push({ id: doc.id, ...(data as any) } as AttendanceRecord);
      });
      
      // Sort client-side to handle docSeriesNo as primary sort key
      const sortedAttendance = attendanceData.sort((a: any, b: any) => {
        const aNo = parseInt(a.docSeriesNo || '0');
        const bNo = parseInt(b.docSeriesNo || '0');
        if (aNo !== bNo && aNo !== 0 && bNo !== 0) return aNo - bNo;
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return aTime - bTime;
      });
      
      setAttendance(sortedAttendance);
      
      // Update projects list for filter
      const uniqueProjects = Array.from(new Set(attendanceData.map(rec => rec.adTitle).filter(Boolean))) as string[];
      setProjects(uniqueProjects.sort());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, collName);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (attendanceId: string) => {
    const record = attendance.find(r => r.id === attendanceId);
    if (!record) return;

    if (!window.confirm('Adakah anda pasti untuk padam rekod kehadiran ini? Semua data berkaitan akan hilang.')) return;
    
    const loadingToast = toast.loading('Memadam rekod...');
    try {
      // 1. Delete the primary attendance document
      await deleteDoc(doc(db, 'attendance', attendanceId));

      // 2. Clear related sent emails / transient logs in 'sent_emails', 'mail', 'emails'
      if (record.email) {
        const collectionsToPurge = ['sent_emails', 'mail', 'emails'];
        for (const colName of collectionsToPurge) {
          try {
            const emailQ = query(collection(db, colName), where('to', '==', record.email.trim()));
            const qSnap = await getDocs(emailQ);
            if (!qSnap.empty) {
              const batch = writeBatch(db);
              qSnap.forEach((d) => {
                const data = d.data();
                const textContent = JSON.stringify(data).toUpperCase();
                const tenderMatch = record.adTitle ? textContent.includes(record.adTitle.toUpperCase()) : true;
                const typeMatch = textContent.includes('PENDAFTARAN') || textContent.includes('KEHADIRAN') || textContent.includes('TAKLIMAT');
                
                if (tenderMatch || typeMatch) {
                  batch.delete(d.ref);
                }
              });
              await batch.commit();
            }
          } catch (colErr) {
            console.warn(`Could not purge ${colName} records:`, colErr);
          }
        }

        // 3. Clear any related pending/resolved notification flags
        try {
          const notifQ = query(collection(db, 'notifications'), where('userEmail', '==', record.email.trim()));
          const notSnap = await getDocs(notifQ);
          if (!notSnap.empty) {
            const batch = writeBatch(db);
            notSnap.forEach((d) => {
              batch.delete(d.ref);
            });
            await batch.commit();
          }
        } catch (notifErr) {
          console.warn('Could not purge notifications records:', notifErr);
        }
      }

      setAttendance(prev => prev.filter(r => r.id !== attendanceId));
      toast.success('Rekod kehadiran dan seluruh data berkaitan telah dipadam.', { id: loadingToast });
    } catch (error) {
      console.error('Error deleting attendance:', error);
      toast.error('Gagal memadam rekod sepenuhnya.', { id: loadingToast });
    }
  };

  const years = Array.from(new Set([
    new Date().getFullYear().toString(),
    ...attendance.map(rec => rec.timestamp ? new Date(rec.timestamp).getFullYear().toString() : null).filter(Boolean)
  ])).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-8 p-8 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">Data Kehadiran</h1>
          <p className="text-[10px] text-risda-muted font-black uppercase tracking-[4px]">
            {isAdmin ? 'SEMUA REKOD' : `REKOD PEJABAT: ${userOffice || 'TIDAK DITETAPKAN'}`}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-end gap-4 w-full md:w-auto">
          <div className="flex flex-col gap-1 w-full sm:w-64">
            <label className="text-[9px] font-black text-risda-orange uppercase tracking-[3px] px-1">Carian</label>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-risda-muted group-focus-within:text-risda-orange transition-colors" size={16} />
              <input 
                type="text"
                placeholder="Syarikat atau Wakil..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-risda-card border border-risda-border rounded-xl py-3 pl-12 pr-6 text-xs text-white focus:outline-none focus:border-risda-orange/50 transition-all shadow-inner"
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-1 w-full sm:w-64">
            <label className="text-[9px] font-black text-risda-orange uppercase tracking-[3px] px-1">Tapis Projek</label>
            <select 
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full bg-risda-card border border-risda-border rounded-xl py-3 px-6 text-xs text-white focus:outline-none focus:border-risda-orange/50 transition-all shadow-inner appearance-none cursor-pointer"
            >
              <option value="">Semua Projek</option>
              {projects.map(proj => (
                <option key={proj} value={proj}>{proj}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 w-full sm:w-32">
            <label className="text-[9px] font-black text-risda-orange uppercase tracking-[3px] px-1">Pilih Tahun</label>
            <select 
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="bg-risda-card border border-risda-border rounded-xl py-3 px-6 text-xs text-white focus:outline-none focus:border-risda-orange/50 transition-all shadow-inner appearance-none cursor-pointer"
            >
              <option value="ALL">Semua Tahun</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 bg-risda-orange/10 border border-risda-orange/20 px-6 py-3 rounded-xl shadow-lg shrink-0 w-full sm:w-auto h-11 justify-center mt-auto">
            <Users size={18} className="text-risda-orange" />
            <span className="text-sm font-black text-white">{filteredAttendance.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="py-20 text-center text-risda-muted animate-pulse font-black uppercase tracking-[4px]">Menyelaras Data...</div>
        ) : Object.keys(groupedAttendance).length === 0 ? (
          <div className="py-20 text-center text-risda-muted font-black uppercase tracking-[4px] bg-risda-card rounded-[40px] border border-risda-border border-dashed">
            {searchTerm ? 'Tiada Padanan Carian' : 'Tiada Rekod Kehadiran'}
          </div>
        ) : Object.keys(groupedAttendance).sort().map((projectTitle, idx) => {
          const projectRecords = groupedAttendance[projectTitle];
          const isExpanded = expandedProject === projectTitle;
          
          return (
            <motion.div 
              key={projectTitle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-risda-card border transition-all duration-500 overflow-hidden ${
                isExpanded ? 'border-risda-orange/40 ring-1 ring-risda-orange/20 rounded-[40px]' : 'border-risda-border hover:border-white/20 rounded-[30px]'
              }`}
            >
              <div 
                className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer group"
                onClick={() => setExpandedProject(isExpanded ? null : projectTitle)}
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-risda-orange rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-risda-orange uppercase tracking-[3px]">Ringkasan Projek</span>
                  </div>
                  <h3 className="text-sm md:text-lg font-black text-white uppercase leading-tight tracking-tight group-hover:text-risda-gold transition-colors">
                    {projectTitle}
                  </h3>
                </div>

                <div className="flex items-center gap-4">
                  <div className="bg-black/40 px-6 py-3 rounded-2xl border border-white/5 flex items-center gap-3">
                    <Users size={16} className="text-risda-gold" />
                    <div className="flex flex-col">
                      <span className="text-xl font-black text-white leading-none">{projectRecords.length}</span>
                      <span className="text-[8px] font-black text-risda-muted uppercase tracking-widest mt-1">Kehadiran</span>
                    </div>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isExpanded ? 'bg-risda-orange text-black rotate-180' : 'bg-white/5 text-risda-muted group-hover:bg-white/10 group-hover:text-white'
                  }`}>
                    <ChevronDown size={20} strokeWidth={3} />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.5, ease: 'circOut' }}
                    className="border-t border-white/5 bg-black/40"
                  >
                    <div className="p-2 md:p-8 overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[9px] font-black text-risda-muted uppercase tracking-[3px] border-b border-white/10">
                            <th className="px-6 py-4">No.</th>
                            <th className="px-6 py-4">Syarikat / Alamat</th>
                            <th className="px-6 py-4">Pemilik / No. Tel</th>
                            <th className="px-6 py-4">Siri No.</th>
                            <th className="px-6 py-4">Tindakan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {projectRecords.map((record: any, pIdx: number) => (
                            <tr key={record.id} className="text-[11px] text-white/70 hover:bg-white/[0.03] transition-colors group/row">
                              <td className="px-6 py-5 font-mono text-risda-orange">{pIdx + 1}</td>
                              <td className="px-6 py-5">
                                <span className="font-black text-white uppercase tracking-wide group-hover/row:text-risda-gold transition-colors">{record.companyName}</span>
                                {record.companyAddress && <div className="text-[9px] text-risda-muted mt-0.5 line-clamp-1">{record.companyAddress}</div>}
                                <div className="text-[8px] text-risda-muted mt-0.5">{formatDate(record.timestamp)}</div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="font-bold uppercase text-white/90">{record.ownerName}</div>
                                <div className="text-[9px] font-mono text-risda-muted">{record.phoneNumber}</div>
                              </td>
                              <td className="px-6 py-5 font-mono font-bold text-risda-gold">
                                {record.docSeriesNo || '-'}
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => setPreviewRecord(record)}
                                    className="p-2 bg-white/5 hover:bg-risda-gold/20 text-risda-muted hover:text-risda-gold rounded-lg transition-all"
                                    title="Lihat Butiran Syarikat"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleResendEmail(record)}
                                    disabled={resendingId === record.id}
                                    className={`p-2 bg-white/5 rounded-lg transition-all ${
                                      resendingId === record.id 
                                        ? 'opacity-50 cursor-not-allowed text-white/30' 
                                        : 'hover:bg-blue-500/20 text-risda-muted hover:text-blue-400'
                                    }`}
                                    title="Hantar Semula E-mel Pendaftaran"
                                  >
                                    {resendingId === record.id ? (
                                      <span className="inline-block animate-spin border-2 border-current border-t-transparent rounded-full h-3.5 w-3.5" />
                                    ) : (
                                      <Mail size={14} />
                                    )}
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(record.id)}
                                    className="p-2 bg-white/5 hover:bg-red-500/20 text-risda-muted hover:text-red-500 rounded-lg transition-all"
                                    title="Padam Rekod Kehadiran"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {previewRecord && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/90 backdrop-blur-xl"
               onClick={() => setPreviewRecord(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-risda-card border border-risda-border w-full max-w-2xl rounded-[40px] overflow-hidden relative z-10 shadow-2xl shadow-black/50"
            >
              {/* Header */}
              <div className="p-6 sm:p-8 border-b border-white/5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-risda-orange uppercase tracking-[3px]">Pratonton Butiran</span>
                  <h3 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tight">Maklumat Berdaftar</h3>
                </div>
                <button 
                  onClick={() => setPreviewRecord(null)}
                  className="p-3 bg-white/5 hover:bg-white/10 text-risda-muted hover:text-white rounded-full transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 sm:p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                {/* Project Header */}
                <div className="bg-black/30 p-6 rounded-[24px] border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-risda-gold uppercase tracking-[2px] font-bold">Projek Sebut Harga</span>
                    <span className="bg-risda-orange/15 border border-risda-orange/30 text-risda-orange font-mono text-xs px-3 py-1 rounded-full font-bold">
                      SIRI NO: {previewRecord.docSeriesNo || '-'}
                    </span>
                  </div>
                  <h4 className="text-white text-sm sm:text-base font-black uppercase leading-snug">
                    {previewRecord.adTitle || '-'}
                  </h4>
                  <div className="text-[9px] font-mono text-risda-muted uppercase">
                    Tarikh Daftar: {previewRecord.timestamp ? formatDate(previewRecord.timestamp) : '-'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - Company Info */}
                  <div className="space-y-4">
                    <h5 className="text-[10px] font-black text-risda-gold uppercase tracking-[2px]">Profil Syarikat</h5>
                    
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1 bg-black/20 p-4 rounded-2xl border border-white/5">
                        <span className="text-[8px] font-black text-risda-muted uppercase">Nama Syarikat</span>
                        <span className="text-white text-xs font-black uppercase tracking-wide leading-tight">
                          {previewRecord.companyName}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 bg-black/20 p-4 rounded-2xl border border-white/5">
                        <span className="text-[8px] font-black text-risda-muted uppercase">Alamat Syarikat</span>
                        <span className="text-white text-xs font-medium uppercase leading-relaxed whitespace-pre-line">
                          {previewRecord.companyAddress || 'Tiada Alamat'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Representative Info */}
                  <div className="space-y-4">
                    <h5 className="text-[10px] font-black text-risda-gold uppercase tracking-[2px]">Maklumat Wakil / Pemilik</h5>
                    
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1 bg-black/20 p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2">
                          <User size={12} className="text-risda-orange" />
                          <span className="text-[8px] font-black text-risda-muted uppercase">Nama Penuh</span>
                        </div>
                        <span className="text-white text-xs font-bold uppercase">
                          {previewRecord.ownerName}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 bg-black/20 p-4 rounded-2xl border border-white/5">
                        <span className="text-[8px] font-black text-risda-muted uppercase">No. Kad Pengenalan</span>
                        <span className="text-white text-xs font-mono font-bold">
                          {previewRecord.icNumber || '-'}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 bg-black/20 p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2">
                          <Phone size={12} className="text-risda-orange" />
                          <span className="text-[8px] font-black text-risda-muted uppercase">No. Telefon Bimbit</span>
                        </div>
                        <span className="text-white text-xs font-mono font-bold">
                          {previewRecord.phoneNumber}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 bg-black/20 p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2">
                          <Mail size={12} className="text-risda-orange" />
                          <span className="text-[8px] font-black text-risda-muted uppercase">E-mel</span>
                        </div>
                        <span className="text-white text-xs font-mono select-all">
                          {previewRecord.email || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sijil / Dokumen Section */}
                <div className="space-y-4">
                  <div className="bg-black/20 p-5 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-risda-muted uppercase">Sijil CIDB & SSM Pembekal</span>
                      <p className="text-white text-xs font-bold">
                        {previewRecord.hasCertificate ? 'Dokumen Sijil Telah Dimuat Naik' : 'Tiada Sijil Dimuat Naik'}
                      </p>
                      {previewRecord.certificateName && (
                        <span className="text-[9px] text-risda-gold italic font-mono block mt-1">{previewRecord.certificateName}</span>
                      )}
                    </div>
                    {previewRecord.hasCertificate && (
                      <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-[9px] font-bold px-3 py-1.5 rounded-lg shrink-0 uppercase tracking-widest">
                        Lengkap
                      </span>
                    )}
                  </div>

                  {/* Inline Document/Image Attachment Viewer */}
                  {previewRecord.certificatesBase64 && Object.keys(previewRecord.certificatesBase64).length > 0 ? (
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <h5 className="text-[10px] font-black text-risda-gold uppercase tracking-[2px]">Dokumen / Sijil Tempelan Kontraktor</h5>
                      <div className="grid grid-cols-1 gap-4">
                        {Object.entries(previewRecord.certificatesBase64).map(([key, base64Str]: [string, any]) => {
                          const isImage = typeof base64Str === 'string' && base64Str.startsWith('data:image/');
                          const isPdf = typeof base64Str === 'string' && base64Str.startsWith('data:application/pdf');
                          
                          // Find descriptive name for the certificate key
                          const fileLabel = key === 'cidb' ? 'Sijil CIDB' :
                                            key === 'stb' ? 'Sijil Taraf Bumiputera' :
                                            key === 'mof' ? 'Kementerian Kewangan (MOF)' :
                                            key === 'tcc' ? 'Sijil Pelepasan Cukai (TCC)' :
                                            key === 'pukonsa' ? 'Sijil PUKONSA' :
                                            key === 'kuhean' ? 'Sijil KUHEAN' : 'Sijil Pendaftaran';

                          const fileName = previewRecord.certificates?.[key] || `${fileLabel}.webp`;

                          return (
                            <div key={key} className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="text-[8px] font-black text-risda-orange uppercase tracking-wider">{fileLabel}</span>
                                  <span className="text-white text-[11px] font-bold uppercase truncate max-w-[250px] sm:max-w-md">{fileName}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = base64Str;
                                    link.download = fileName;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }}
                                  className="px-3 py-1.5 bg-risda-orange/15 hover:bg-risda-orange/30 border border-risda-orange/20 text-risda-orange text-[9px] font-black uppercase tracking-wider rounded-lg transition-all"
                                >
                                  Muat Turun
                                </button>
                              </div>
                              {isImage ? (
                                <div className="relative group rounded-xl overflow-hidden border border-white/5 bg-black/40 p-2 max-h-[300px] flex items-center justify-center">
                                  <img 
                                    src={base64Str} 
                                    alt={fileName} 
                                    className="max-h-[280px] object-contain rounded-lg w-auto"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              ) : isPdf ? (
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                                  <span className="text-risda-muted font-mono">{fileName} (Dokumen PDF)</span>
                                  <span className="text-risda-gold font-bold">PDF</span>
                                </div>
                              ) : (
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                                  <span className="text-risda-muted font-mono">{fileName} (Format tersimpan)</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : previewRecord.hasCertificate ? (
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center text-risda-muted text-[10px] font-bold uppercase tracking-wider">
                      Sijil sedia ada disimpan secara berasingan. Sila hubungi pembekal jika imej lampiran fizikal tidak dipaparkan.
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-black/20 border-t border-white/5 flex justify-end">
                <button 
                  onClick={() => setPreviewRecord(null)}
                  className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold hover:scale-95 transition-all uppercase tracking-wide"
                >
                  Tutup Pratonton
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
