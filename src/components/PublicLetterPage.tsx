import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Printer, ArrowLeft, FileText, CheckCircle, ExternalLink, ShieldAlert, Award } from 'lucide-react';

interface PublicLetterPageProps {
  invitationId: string;
  companyName: string | null;
  onBackToPortal?: () => void;
}

export default function PublicLetterPage({ invitationId, companyName, onBackToPortal }: PublicLetterPageProps) {
  const [invitation, setInvitation] = useState<any | null>(null);
  const [ad, setAd] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFormat, setActiveFormat] = useState<'rasmi' | 'tawaran'>('rasmi');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const invDocRef = doc(db, 'supplier_invitations', invitationId);
        const invDocSnap = await getDoc(invDocRef);
        
        if (invDocSnap.exists()) {
          const invData = invDocSnap.data();
          setInvitation({ id: invDocSnap.id, ...invData });
          
          if (invData.adId) {
            const adDocRef = doc(db, 'ads', invData.adId);
            const adDocSnap = await getDoc(adDocRef);
            if (adDocSnap.exists()) {
              setAd({ id: adDocSnap.id, ...adDocSnap.data() });
            }
          }
        } else {
          setError('Maklumat rekod pelawaan sebut harga tidak ditemui atau telah dipadam.');
        }
      } catch (err: any) {
        console.error('Error fetching invitation details:', err);
        setError('Gagal memuat turun dokumen pelawaan. Sila cuba lagi.');
      } finally {
        setLoading(false);
      }
    };

    if (invitationId) {
      fetchData();
    }
  }, [invitationId]);

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

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b12] text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-risda-orange border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-xs uppercase font-black tracking-widest text-risda-muted animate-pulse">
          Menjana Surat Pelawaan Rasmi...
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-[#070b12] text-white flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-4">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-2">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-lg font-black uppercase tracking-wider text-white">Dokumen Tidak Ditemui</h2>
        <p className="text-xs text-risda-muted leading-relaxed uppercase">{error || 'Rekod siri pelawaan tidak sah.'}</p>
        {onBackToPortal && (
          <button
            onClick={onBackToPortal}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft size={14} /> Kembali Ke Portal Utama
          </button>
        )}
      </div>
    );
  }

  // Find the current supplier matching URL query, or default to first
  const currentSupplierName = companyName || invitation.suppliers[0]?.companyName || '';
  const matchedSupplier = invitation.suppliers.find(
    (s: any) => s.companyName.toLowerCase().trim() === currentSupplierName.toLowerCase().trim()
  ) || invitation.suppliers[0];

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

  let officeVal = 'PEJABAT RISDA DAERAH BEAUFORT';
  let addressVal = 'K77 & K78, Block K, Beaufort Square Avenue 1,<br/>Jalan Binunuk,<br/>89800 Beaufort, Sabah';
  let emailVal = 'prdbeaufort@risda.gov.my';
  let telVal = '087-224335/336';
  
  if (invitation?.submissionVenue) {
    const parts = invitation.submissionVenue.split(',');
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
  }

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-800 flex flex-col selection:bg-risda-orange/30 print:bg-white">
      
      {/* Dynamic Header Action Bar - hidden during standard physical printing */}
      <div id="no-print-actionbar" className="no-print w-full bg-[#0d1421] border-b border-white/5 py-4 px-4 sticky top-0 z-50 shadow-lg backdrop-blur-md bg-opacity-95">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (onBackToPortal) {
                  onBackToPortal();
                } else {
                  window.location.href = '/';
                }
              }}
              className="p-2 bg-white/5 border border-white/10 rounded-xl text-white hover:text-risda-orange transition-all hover:bg-white/10"
              title="Kembali ke Portal"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <h1 className="text-xs font-black text-white uppercase tracking-widest">Digital Letter Portal</h1>
              </div>
              <p className="text-[10px] text-risda-muted font-bold uppercase">Siri Rujukan: {invitation.referenceNo}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {/* View Ad Button */}
            <a 
              href={`/?adId=${invitation.adId}`}
              className="px-4 py-2.5 bg-black/40 hover:bg-black/60 border border-white/5 hover:border-white/10 text-white rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2"
            >
              <FileText size={14} className="text-sky-400" /> Lihat Iklan Sebut Harga
            </a>

            {/* Direct Register Button */}
            <a 
              href={`/?adId=${invitation.adId}`}
              className="px-4 py-2.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/30 text-sky-400 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2"
            >
              <CheckCircle size={14} /> Daftar Kehadiran Tapak
            </a>

            {/* Print & PDF Button */}
            <button 
              onClick={handlePrint}
              className="px-5 py-2.5 bg-risda-orange hover:bg-risda-orange-hover text-black rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2"
            >
              <Printer size={15} /> Cetak / Simpan PDF
            </button>
          </div>
        </div>
      </div>

      {/* Floating Instructions Banner - hidden in print */}
      <div className="no-print max-w-4xl mx-auto w-full px-4 mt-6">
        <div className="bg-gradient-to-r from-risda-orange/10 to-transparent border border-risda-orange/20 p-4 rounded-3xl flex items-start gap-3.5">
          <div className="p-2.5 bg-risda-orange/20 border border-risda-orange/20 rounded-2xl text-risda-orange">
            <Award size={18} />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-black text-white uppercase tracking-wider">Surat Pelawaan Sebut Harga Rasmi Digital</h4>
            <p className="text-[11px] text-risda-muted leading-relaxed uppercase">
              Tuan / Puan boleh meneliti dua perkara wajib di tab pilihan bawah: **(1) Surat Pelawaan Rasmi** dan **(2) Format Surat Tawaran (Dokumen Harga)**. Sila klik butang <strong className="text-risda-orange">"Cetak / Simpan PDF"</strong> di atas untuk mencetak atau menyimpan format terpilih bagi urusan rasmi syarikat.
            </p>
          </div>
        </div>
      </div>

      {/* Elegant Format Tab Selector Deck - hidden in print */}
      <div className="no-print max-w-4xl mx-auto w-full px-4 mt-4">
        <div className="bg-[#0d1421] border border-white/5 p-1 rounded-2xl flex relative shadow-inner">
          <button 
            type="button"
            onClick={() => setActiveFormat('rasmi')}
            className={`flex-1 py-3 px-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeFormat === 'rasmi'
                ? 'bg-gradient-to-r from-risda-orange to-risda-gold text-black shadow-lg'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            📄 1. Format Surat Rasmi Pelawaan
          </button>
          <button 
            type="button"
            onClick={() => setActiveFormat('tawaran')}
            className={`flex-1 py-3 px-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeFormat === 'tawaran'
                ? 'bg-gradient-to-r from-risda-orange to-risda-gold text-black shadow-lg'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            ✏️ 2. Format Surat Tawaran Pelawaan (Borang Harga sebutharga)
          </button>
        </div>
      </div>

      {/* simulated A4 Document Container */}
      <div className="flex-1 py-8 px-4 print:py-0 print:px-0">
        <div className="max-w-[210mm] mx-auto select-none print:max-w-none">
          {activeFormat === 'rasmi' ? (
            <div className="flex flex-col gap-6 print:gap-0 font-serif" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
              
              {/* PAGE 1 */}
              <div className="print-page print-page-first relative">
                <div className="print-content-wrap">
                  {/* Shared Official Header - Identical on Pages 1, 2, and 3 */}
                  <div className="border-b-2 border-solid border-black pb-4 mb-6 text-center flex items-center justify-between">
                    <div className="w-[85px] text-left shrink-0">
                      <img 
                        src="/PUBLIC/intrologo_RISDA.png" 
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.src = "https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png";
                        }}
                        className="h-[75px] w-auto block"
                        referrerPolicy="no-referrer"
                        alt="RISDA Logo"
                      />
                    </div>
                    <div className="flex-1 text-left pl-4 font-serif text-black leading-tight">
                      <strong className="text-[11pt] block mb-0.5 uppercase tracking-wide font-extrabold text-black">
                        PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH<br/>(RISDA)
                      </strong>
                      <strong className="text-[11pt] block mb-0.5 uppercase tracking-wide font-bold text-black font-serif">
                        {officeVal}
                      </strong>
                      <div className="text-[8.5pt] leading-normal mt-2 flex justify-between items-end bg-transparent font-sans">
                        <div className="text-left font-sans text-slate-800 font-medium" dangerouslySetInnerHTML={{ __html: addressVal }} />
                        <div className="text-right font-sans whitespace-nowrap pl-2 space-y-0.5 text-zinc-600">
                          <div><strong className="text-black font-semibold">TEL:</strong> {telVal}</div>
                          <div><strong className="text-black font-semibold">EMAIL:</strong> {emailVal}</div>
                          <div><strong className="text-black font-semibold">WEB:</strong> www.risda.gov.my</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Section */}
                  <table className="w-full text-[11pt] border-collapse mb-5 font-serif text-black">
                    <tbody>
                      <tr>
                        <td className="w-[18%] py-0.5 text-black">Rujukan Kami</td>
                        <td className="w-[2%] py-0.5 text-center text-black">:</td>
                        <td className="w-[45%] py-0.5 font-sans font-bold text-black uppercase">{invitation.referenceNo}</td>
                        <td className="w-[35%] py-0.5 text-right text-black">
                          Tarikh: <span className="font-bold text-black uppercase">{formatBeautifulDate(invitation.invitationDate)}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Recipient details */}
                  <div className="mb-5 text-[11pt] leading-relaxed text-black font-serif">
                    <div className="font-bold underline uppercase text-xs tracking-wider">KEPADA SYARIKAT EDARAN BERDAFTAR:</div>
                    <div className="font-bold text-[12pt] tracking-wide mt-1 uppercase">{matchedSupplier?.companyName || 'PIHAK TUAN / PUAN'}</div>
                    <div className="text-[11pt] mt-0.5 whitespace-pre-wrap max-w-xl uppercase font-serif">
                      {matchedSupplier?.address || 'Alamat Perniagaan Syarikat Berdaftar'}
                    </div>
                    {matchedSupplier?.phoneNumber && (
                      <div className="text-[10pt] text-slate-700 mt-1 uppercase font-sans">
                        No. Tel: {matchedSupplier.phoneNumber} {matchedSupplier.email ? ` | E-mel: ${matchedSupplier.email}` : ''}
                      </div>
                    )}
                  </div>

                  <div className="text-[11pt] mb-3 text-black font-serif">
                    Tuan / Puan,
                  </div>

                  {/* Letter Title */}
                  <div className="font-bold text-[11.5pt] mb-4 border-b border-black pb-2 uppercase tracking-wide leading-relaxed text-black font-serif">
                    PELAWAAN MENYERTAI SEBUT HARGA BAGI:<br/>
                    "{invitation.adTitle}"<br/>
                    NO. RUJUKAN SEBUT HARGA: <span className="underline font-mono">{invitation.tenderNo}</span>
                  </div>

                  {/* Letter Body paragraphs */}
                  <div className="text-[11pt] leading-relaxed text-black text-justify space-y-3 font-serif">
                    <p>
                      Dengan hormatnya perkara di atas adalah dirujuk.
                    </p>

                    <p className="indent-8">
                      2. &nbsp;&nbsp; Sukacita dimaklumkan bahawa Pejabat RISDA Daerah Beaufort bersetuju mengundang syarikat pihak tuan / puan yang terpilih untuk menyertai sebut harga perolehan bagi projek/bekalan yang dinyatakan di atas berteraskan kriteria pendaftaran syarikat di Sabah.
                    </p>

                    <p className="indent-8">
                      3. &nbsp;&nbsp; Selaras dengan ketetapan perolehan, taklimat, lawatan tapak wajib serta tarikh tutup penutupan sebut harga akan dilaksanakan mengikut jadual ketat di bawah:
                    </p>

                    {/* Sub-table with details */}
                    <div className="pl-6 py-1">
                      <table className="w-full border-collapse text-[10pt]">
                        <tbody>
                          <tr>
                            <td className="w-[32%] font-bold py-1 text-black">A) SEBUT HARGA / PROJEK</td>
                            <td className="w-[3%] py-1 text-center text-black">:</td>
                            <td className="w-[65%] py-1 text-black font-semibold uppercase">{invitation.adTitle}</td>
                          </tr>
                          <tr>
                            <td className="font-bold py-1 text-black">B) RAWATAN & TAKLIMAT TAPAK</td>
                            <td className="py-1 text-center text-black">:</td>
                            <td className="py-1 text-sky-700 font-bold uppercase text-[10.5pt]">WAJIB HADIR</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 pl-4 text-slate-800">Tarikh & Hari Taklimat</td>
                            <td className="py-0.5 text-center text-black">:</td>
                            <td className="py-0.5 text-black font-bold uppercase">
                              {formatBeautifulDate(invitation.briefingDate || '')} ({indonesianDayName(invitation.briefingDate || '')})
                            </td>
                          </tr>
                          <tr>
                            <td className="py-0.5 pl-4 text-slate-800">Masa Taklimat</td>
                            <td className="py-0.5 text-center text-black">:</td>
                            <td className="py-0.5 text-black uppercase">{invitation.briefingTime || '-'}</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 pl-4 text-slate-800">Tempat Berkumpul</td>
                            <td className="py-0.5 text-center text-black">:</td>
                            <td className="py-0.5 text-black whitespace-pre-wrap max-w-md uppercase">{invitation.briefingVenue || '-'}</td>
                          </tr>
                          <tr className="h-1"><td></td><td></td><td></td></tr>
                          <tr>
                            <td className="font-bold py-0.5 text-black">C) TARIKH TUTUP SEBUT HARGA</td>
                            <td className="py-0.5 text-center text-black">:</td>
                            <td className="py-0.5 text-black"></td>
                          </tr>
                          <tr>
                            <td className="py-0.5 pl-4 text-slate-800">Tarikh & Jam Tutup</td>
                            <td className="py-0.5 text-center text-black">:</td>
                            <td className="py-0.5 text-black font-bold text-red-600 uppercase">
                              {indonesianDayName(invitation.closingDate || '')}, {formatBeautifulDate(invitation.closingDate || '')} SEBELUM JAM {invitation.closingTime || '-'}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-0.5 pl-4 text-slate-800">Tempat Penghantaran</td>
                            <td className="py-0.5 text-center text-black">:</td>
                            <td className="py-0.5 text-black uppercase text-[9.5pt]">
                              {invitation.submissionVenue || 'PEJABAT RISDA DAERAH BEAUFORT, SABAH'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <p className="indent-8">
                      4. &nbsp;&nbsp; Bersama-sama ini disertakan salinan butiran iklan sebut harga untuk rujukan pihak tuan/puan selanjutnya. Sila bawa sijil kelayakan asal syarikat semasa taklimat dijalankan.
                    </p>
                  </div>
                </div>

                {/* Page 1 Footer */}
                <div className="print-footer select-none">
                  <div className="mb-1 uppercase tracking-wide text-center text-[7.5pt]">
                    MEMACU MASYARAKAT PEKEBUN KECIL MAKMUR DARIPADA SUMBER KOMODITI DAN HASIL<br/>
                    BAHARU BERLANDASKAN REVOLUSI PERINDUSTRIAN DIGITAL SERTA TEKNOLOGI HIJAU
                  </div>
                  <div className="font-bold text-[10pt] font-serif text-center mt-1">1/3</div>
                </div>
              </div>

              {/* PAGE 2 */}
              <div className="print-page relative">
                <div className="print-content-wrap">
                  {/* Ref repeats */}
                  <div className="flex justify-between items-center text-[11pt] font-serif mb-8 text-black border-b border-gray-100 pb-2">
                    <span>Ruj. Kami &nbsp;: &nbsp;<strong className="font-sans text-[10pt] font-black uppercase text-black">{invitation.referenceNo}</strong></span>
                    <span>Tarikh: {formatBeautifulDate(invitation.invitationDate)}</span>
                  </div>

                  <div className="text-[11pt] leading-relaxed text-black text-justify space-y-4 font-serif mt-12 bg-transparent">
                    <p className="indent-8">
                      Sila lakukan pendaftaran rekod kehadiran tapak secara digital sebaik sahaja tiba di lokasi taklimat menerusi pautan pengesahan kehadiran di bawah:
                    </p>
                    
                    <div className="no-print p-3 bg-[#0d1421]/90 rounded-2xl border border-risda-orange/15 shadow-inner mt-4 select-all">
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Pautan Log Masuk Kehadiran Digital:</div>
                      <a 
                        href={`${window.location.protocol}//${window.location.host}/?adId=${invitation.adId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono text-risda-orange hover:underline font-bold block truncate"
                      >
                        {window.location.protocol}//{window.location.host}/?adId={invitation.adId}
                      </a>
                    </div>
                    
                    <div className="print-only hidden print:block text-slate-800">
                      <strong className="text-black block underline font-mono text-center text-xs p-2 bg-slate-50 border border-slate-100 rounded">
                        {window.location.protocol}//{window.location.host}/?adId={invitation.adId}
                      </strong>
                    </div>

                    <p className="pt-6">Sekian, terima kasih.</p>
                  </div>

                  {/* Slogan */}
                  <div className="mt-10 text-[11pt] text-black font-serif leading-relaxed">
                    <strong>"MALAYSIA MADANI"</strong><br/>
                    <strong className="text-[10pt] uppercase">"BERKHIDMAT UNTUK NEGARA"</strong>
                  </div>

                  {/* Signoff */}
                  <div className="mt-14 text-[11pt] leading-thick text-black font-serif break-inside-avoid">
                    <p>Saya yang menjalankan amanah,</p>
                    <div className="h-20" />
                    <strong className="text-[11.5pt] block">({invitation.officerName ? invitation.officerName.toUpperCase() : 'PEGAWAI PENTADBIRAN DISTRICT'})</strong>
                    <span className="text-[10.5pt] block mt-0.5 text-zinc-700">b.p. Pegawai RISDA Daerah Beaufort</span>
                    <span className="text-[10.5pt] block text-zinc-600">Pejabat RISDA Beaufort, Negeri Sabah</span>
                    
                    <div className="text-slate-400 font-mono text-[9px] mt-10 italic">
                      sebutharga{new Date(invitation.invitationDate).getFullYear() || new Date().getFullYear()}/digital-safeguard
                    </div>
                  </div>
                </div>

                {/* Page 2 Footer */}
                <div className="print-footer select-none">
                  <div className="mb-1 uppercase tracking-wide text-center text-[7.5pt]">
                    MEMACU MASYARAKAT PEKEBUN KECIL MAKMUR DARIPADA SUMBER KOMODITI DAN HASIL<br/>
                    BAHARU BERLANDASKAN REVOLUSI PERINDUSTRIAN DIGITAL SERTA TEKNOLOGI HIJAU
                  </div>
                  <div className="font-bold text-[10pt] font-serif text-center mt-1">2/3</div>
                </div>
              </div>

              {/* PAGE 3 */}
              <div className="print-page relative">
                <div className="print-content-wrap">
                  {/* Ref repeats */}
                  <div className="flex justify-between items-center text-[11pt] font-serif mb-5 text-black border-b border-gray-100 pb-2 bg-transparent">
                    <span>Ruj. Kami &nbsp;: &nbsp;<strong className="font-sans text-[10pt] font-black uppercase text-black">{invitation.referenceNo}</strong></span>
                    <span>Tarikh: {formatBeautifulDate(invitation.invitationDate)}</span>
                  </div>

                  <div className="text-left mt-6 font-serif">
                    <h3 className="text-[12pt] font-bold text-black uppercase tracking-wider underline mb-4">
                      LAMPIRAN EDARAN PELAWAAN SEBUT HARGA
                    </h3>
                    <p className="text-[10pt] text-slate-700 font-serif leading-relaxed mb-6">
                      Senarai penuh kontraktor tempatan berwibawa di daerah Beaufort Sabah yang dijemput secara rasmi untuk menyertai perolehan ini:
                    </p>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {invitation.suppliers.map((s: any, idx: number) => (
                      <div 
                        key={s.id || idx} 
                        className={`p-3 border rounded-[15px] text-[10pt] break-inside-avoid ${s.companyName.toLowerCase().trim() === currentSupplierName.toLowerCase().trim() ? 'border-2 border-black bg-slate-50 font-bold shadow-sm' : 'border-slate-200'}`}
                      >
                        <div className="flex justify-between items-start font-serif">
                          <span className="font-bold text-slate-900">{idx + 1}. {s.companyName.toUpperCase()}</span>
                          {s.companyName.toLowerCase().trim() === currentSupplierName.toLowerCase().trim() && (
                            <span className="no-print text-[8px] bg-risda-orange text-black px-2 py-0.5 rounded font-black font-sans uppercase">Syarikat Anda</span>
                          )}
                        </div>
                        <div className="text-[9pt] text-slate-600 font-normal mt-1 whitespace-pre-wrap pl-4 leading-normal font-sans">
                          {s.address || 'Alamat tidak berdaftar'}<br/>
                          Tel: {s.phoneNumber} {s.email ? ` | E-mel: ${s.email}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Page 3 Footer */}
                <div className="print-footer select-none">
                  <div className="mb-1 uppercase tracking-wide text-center text-[7.5pt]">
                    MEMACU MASYARAKAT PEKEBUN KECIL MAKMUR DARIPADA SUMBER KOMODITI DAN HASIL<br/>
                    BAHARU BERLANDASKAN REVOLUSI PERINDUSTRIAN DIGITAL SERTA TEKNOLOGI HIJAU
                  </div>
                  <div className="font-bold text-[10pt] font-serif text-center mt-1">3/3</div>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex flex-col gap-6 print:gap-0 font-serif" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
              
              {/* PAGE 1: DOKUMEN HARGA / TAWARAN */}
              <div className="print-page print-page-first relative">
                <div className="print-content-wrap">
                  
                  {/* Shared Official Header - Identical on Pages 1, 2, and 3 */}
                  <div className="border-b-2 border-solid border-black pb-4 mb-6 text-center flex items-center justify-between">
                    <div className="w-[85px] text-left shrink-0">
                      <img 
                        src="/PUBLIC/intrologo_RISDA.png" 
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.src = "https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png";
                        }}
                        className="h-[75px] w-auto block"
                        referrerPolicy="no-referrer"
                        alt="RISDA Logo"
                      />
                    </div>
                    <div className="flex-1"></div>
                  </div>

                  <h1 className="font-black text-[13pt] text-black tracking-widest mt-1 underline uppercase text-center mb-6">
                    SURAT TAWARAN PELAWAAN SEBUT HARGA
                  </h1>

                  {/* Aligned Metdata */}
                  <table className="w-full text-[11pt] leading-normal text-black border-collapse mb-5 font-serif bg-transparent">
                    <tbody>
                      <tr>
                        <td className="w-[25%] font-bold py-1.5 align-top text-black">No.Sebutharga</td>
                        <td className="w-[3%] py-1.5 text-center align-top text-black">:</td>
                        <td className="w-[72%] py-1.5 align-top font-sans font-bold text-black uppercase">{invitation.tenderNo}</td>
                      </tr>
                      <tr>
                        <td className="font-bold py-1.5 align-top text-black">Tajuk Perolehan</td>
                        <td className="py-1.5 text-center align-top text-black">:</td>
                        <td className="py-1.5 align-top font-serif uppercase leading-relaxed text-black">{invitation.adTitle}</td>
                      </tr>
                      <tr>
                        <td className="font-bold py-1.5 align-top text-black">Syarikat Dipelawa</td>
                        <td className="py-1.5 text-center align-top text-black">:</td>
                        <td className="py-1.5 align-top font-bold text-[11.5pt] uppercase text-black font-serif">
                          {matchedSupplier?.companyName || 'PIHAK KONTRAKTOR JEMPUTAN'}
                        </td>
                      </tr>
                      <tr>
                        <td className="font-bold py-1.5 align-top text-black">Alamat Penerima</td>
                        <td className="py-1.5 text-center align-top text-black">:</td>
                        <td className="py-1.5 align-top font-serif text-[10.5pt] text-slate-800 uppercase leading-relaxed font-serif whitespace-pre-wrap">
                          {matchedSupplier?.address || 'Alamat Perniagaan Terdaftar'}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Pricing Matrix Form */}
                  <div className="border border-black p-4 bg-slate-50/50 rounded-none mb-4 font-serif">
                    <h3 className="font-bold text-[11pt] text-black uppercase tracking-wider text-center border-b border-black pb-2 mb-3">
                      AKUAN PENERIMAAN TAWARAN HARGA KONTRAKTOR
                    </h3>
                    <p className="text-[10pt] leading-relaxed text-black mb-3 text-justify font-serif">
                      Pihak kami dengan ini bersetuju untuk melaksanakan kerja-kerja / pembekalan sehubungan dengan spesifikasi yang ditetapkan dengan kadar tawaran harga tunai bersih di bawah:
                    </p>

                    <table className="w-full border-collapse text-[10pt] font-serif">
                      <thead>
                        <tr>
                          <th className="border border-black px-3 py-1.5 text-center w-[10%] text-black bg-slate-100">BIL</th>
                          <th className="border border-black px-3 py-1.5 text-left text-black bg-slate-100 font-bold">BUTIRAN RINGKAS SPESIFIKASI</th>
                          <th className="border border-black px-3 py-1.5 text-right w-[35%] text-black bg-slate-100 font-bold">KADAR TAWARAN (RM)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="h-10">
                          <td className="border border-black px-3 py-1.5 text-center text-black">1.</td>
                          <td className="border border-black px-3 py-1.5 text-black text-[9pt] uppercase leading-tight">
                            {invitation.adTitle}
                          </td>
                          <td className="border border-black px-3 py-1.5 text-right font-mono font-bold text-black bg-slate-100/50">
                            RM <span className="inline-block w-28 border-b border-dotted border-black"></span>
                          </td>
                        </tr>
                        <tr className="h-10">
                          <td className="border border-black px-3 py-1.5 text-center font-bold text-black" colSpan={2}>
                            JUMLAH BESAR TAWARAN PIHAK KONTRAKTOR (RM)
                          </td>
                          <td className="border border-black px-3 py-1.5 text-right font-mono font-bold text-black bg-slate-100/50">
                            RM <span className="inline-block w-28 border-b border-double border-black"></span>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <p className="text-[8.5pt] italic text-slate-700 mt-3 leading-relaxed">
                      *Cara Pengurusan: Sila tuliskan Jumlah Penawaran Harga di atas menggunakan pena dakwat hitam, tandatangan, bubuh cop rasmi syarikat, dan bawa bersama dokumen kelayakan lesen syarikat semasa tarikh taklimat dan lawatan tapak wajib dijalankan.*
                    </p>
                  </div>

                  {/* Submission and Signoff Section */}
                  <div className="grid grid-cols-2 gap-8 pt-4 font-serif">
                    <div className="text-left text-[9.5pt] leading-relaxed text-black">
                      <p className="font-bold underline uppercase">AKUAN AKUR & TANDATANGAN (SYARIKAT):</p>
                      <p className="mt-1 text-slate-600 font-serif">Saya mengesahkan tawaran ini bagi pihak syarikat:</p>
                      <div className="h-12 border-b border-dotted border-black mt-2"></div>
                      <p className="mt-2 text-black font-bold">Tandatangan Penama Sijil & Cop</p>
                      <p className="text-zinc-600 text-[9pt] mt-1 font-serif">Tarikh : <span className="inline-block w-24 border-b border-dotted border-black"></span></p>
                    </div>

                    <div className="text-left text-[9.5pt] leading-relaxed text-black font-serif">
                      <p className="font-bold underline uppercase">DILULUSKAN OLEH JABATAN PEROLEHAN (RISDA):</p>
                      <div className="h-12 mt-4 animate-transparent"></div>
                      <p className="text-black font-bold">({invitation.officerName ? invitation.officerName.toUpperCase() : 'PEGAWAI PENTADBIRAN DISTRICT'})</p>
                      <p className="text-zinc-600">b.p. Pegawai RISDA Daerah Beaufort</p>
                      <p className="text-zinc-500">Negeri Sabah</p>
                    </div>
                  </div>

                </div>

                {/* Format 2 Footer */}
                <div className="print-footer select-none">
                  <div className="mb-1 uppercase tracking-wide text-center text-[7.5pt]">
                    MEMACU MASYARAKAT PEKEBUN KECIL MAKMUR DARIPADA SUMBER KOMODITI DAN HASIL<br/>
                    BAHARU BERLANDASKAN REVOLUSI PERINDUSTRIAN DIGITAL SERTA TEKNOLOGI HIJAU
                  </div>
                  <div className="font-bold text-[10pt] font-serif text-center mt-1">FORMAT 2: BORANG TAWARAN HARGA</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
