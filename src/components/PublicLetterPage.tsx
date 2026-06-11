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
        <div 
          className="bg-white max-w-[210mm] min-h-[297mm] mx-auto p-[1.5in] sm:p-[1in] md:p-[1.2in] shadow-2xl relative border border-slate-200/50 rounded-none print:shadow-none print:border-none print:p-0"
          style={{ fontFamily: "'Times New Roman', Times, serif", contentVisibility: 'auto' }}
        >
          {/* Letterhead Logo Watermark Effect */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.02] flex items-center justify-center p-20 select-none">
            <div className="border-[15px] border-black rounded-full p-20 w-[400px] h-[400px] flex items-center justify-center text-center">
              <span className="text-[40px] font-bold tracking-[8px] uppercase">RISDA</span>
            </div>
          </div>

          {/* Conditionally Render Letterhead & Content depending on activeFormat to match PDF exact layout */}
          {activeFormat === 'rasmi' ? (
            <>
              {/* Reference/Standard Letterhead for Rasmi Layout */}
              <div className="border-b-[4px] border-double border-black pb-4 mb-8 text-center flex flex-col items-center">
                <h2 className="text-lg md:text-xl font-bold tracking-wider leading-tight text-black uppercase">
                  PENTADBIRAN RISDA NEGERI SABAH
                </h2>
                <h1 className="text-base md:text-lg font-bold text-black mt-0.5 uppercase">
                  PEJABAT RISDA DAERAH BEAUFORT
                </h1>
                <p className="text-[9.5pt] font-normal text-slate-700 tracking-wide mt-1">
                  Peti Surat 185, 89807 Beaufort, Sabah | Tel: 087-211142 | Faks: 087-212211
                </p>
              </div>

              {/* Metadata Section */}
              <table className="w-full text-[11pt] border-collapse mb-8">
                <tbody>
                  <tr>
                    <td className="w-[18%] py-0.5 text-black">Rujukan Kami</td>
                    <td className="w-[2%] py-0.5 text-center text-black">:</td>
                    <td className="w-[45%] py-0.5 font-bold text-black uppercase">{invitation.referenceNo}</td>
                    <td className="w-[35%] py-0.5 text-right text-black">
                      Tarikh: <span className="font-bold text-black uppercase">{formatBeautifulDate(invitation.invitationDate)}</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Recipient details */}
              <div className="mb-6 text-[11pt] leading-relaxed text-black">
                <div className="font-bold underline uppercase">KEPADA SYARIKAT EDARAN BERDAFTAR:</div>
                <div className="font-bold text-[12pt] tracking-wide mt-1 uppercase">{matchedSupplier?.companyName || 'PIHAK TUAN / PUAN'}</div>
                <div className="text-[11.5pt] mt-0.5 whitespace-pre-wrap max-w-xl uppercase">
                  {matchedSupplier?.address || 'Alamat Perniagaan Syarikat Berdaftar'}
                </div>
                {matchedSupplier?.phoneNumber && (
                  <div className="text-[10pt] text-slate-700 mt-1 uppercase">
                    No. Tel: {matchedSupplier.phoneNumber} {matchedSupplier.email ? `| E-mel: ${matchedSupplier.email}` : ''}
                  </div>
                )}
              </div>

              <div className="text-[11pt] mb-6 text-black font-serif">
                Tuan / Puan,
              </div>

              {/* Letter Title */}
              <div className="font-bold text-[12pt] mb-6 border-b border-black pb-2 uppercase tracking-wide leading-relaxed text-black">
                PELAWAAN MENYERTAI SEBUT HARGA BAGI:<br/>
                "{invitation.adTitle}"<br/>
                NO. RUJUKAN SEBUT HARGA: <span className="underline font-mono">{invitation.tenderNo}</span>
              </div>

              {/* Letter Body paragraphs */}
              <div className="text-[11pt] leading-relaxed text-black text-justify space-y-4 font-serif">
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
                <div className="pl-8 py-2">
                  <table className="w-full border-collapse text-[10.5pt]">
                    <tbody>
                      <tr>
                        <td className="w-[32%] font-bold py-1 text-black">A) SEBUT HARGA / PROJEK</td>
                        <td className="w-[3%] py-1 text-center text-black">:</td>
                        <td className="w-[65%] py-1 text-black font-semibold uppercase">{invitation.adTitle}</td>
                      </tr>
                      <tr>
                        <td className="font-bold py-1 text-black">B) RAWATAN & TAKLIMAT TAPAK</td>
                        <td className="py-1 text-center text-black">:</td>
                        <td className="py-1 text-black font-bold text-[11pt] text-sky-700 print:text-black uppercase">WAJIB HADIR</td>
                      </tr>
                      <tr>
                        <td className="py-1 pl-4 text-slate-700">Tarikh & Hari Taklimat</td>
                        <td className="py-1 text-center text-black">:</td>
                        <td className="py-1 text-black font-bold uppercase">
                          {formatBeautifulDate(invitation.briefingDate || '')} ({indonesianDayName(invitation.briefingDate || '')})
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 pl-4 text-slate-700">Masa Taklimat</td>
                        <td className="py-1 text-center text-black">:</td>
                        <td className="py-1 text-black uppercase">{invitation.briefingTime || '-'}</td>
                      </tr>
                      <tr>
                        <td className="py-1 pl-4 text-slate-700">Tempat Berkumpul</td>
                        <td className="py-1 text-center text-black">:</td>
                        <td className="py-1 text-black whitespace-pre-wrap max-w-md uppercase">{invitation.briefingVenue || '-'}</td>
                      </tr>
                      <tr className="h-2"><td></td><td></td><td></td></tr>
                      <tr>
                        <td className="font-bold py-1 text-black">C) TARIKH TUTUP SEBUT HARGA</td>
                        <td className="py-1 text-center text-black">:</td>
                        <td className="py-1 text-black"></td>
                      </tr>
                      <tr>
                        <td className="py-1 pl-4 text-slate-700">Tarikh & Jam Tutup</td>
                        <td className="py-1 text-center text-black">:</td>
                        <td className="py-1 text-black font-bold text-red-700 print:text-black uppercase">
                          {indonesianDayName(invitation.closingDate || '')}, {formatBeautifulDate(invitation.closingDate || '')} SEBELUM JAM {invitation.closingTime || '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 pl-4 text-slate-700">Tempat Penghantaran</td>
                        <td className="py-1 text-center text-black">:</td>
                        <td className="py-1 text-black uppercase">
                          {invitation.submissionVenue || 'PEJABAT RISDA DAERAH BEAUFORT, SABAH'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="indent-8">
                  4. &nbsp;&nbsp; Hanya penama rasmi di dalam lesen Sijil Pendaftaran sahaja yang dibenarkan menghadiri taklimat dan lawatan tapak. Wakil kontraktor adalah tidak dibenarkan sama sekali. Sila bawa sijil lesen asal (CIDB, SPKK, PUKONSA atau MOF berkaitan) serta salinan untuk rujukan Jabatan.
                </p>

                <p className="indent-8">
                  Sila mendaftar kehadiran secara digital sebaik sahaja tiba di lokasi taklimat menerusi portal log digital di:
                  <br />
                  <strong className="text-black block underline font-mono select-all text-xs text-center mt-1.5 p-1 bg-slate-50 border border-slate-100 rounded print:border-none print:p-0 print:bg-transparent">
                    {window.location.protocol}//{window.location.host}/?adId={invitation.adId}
                  </strong>
                </p>

                <p>
                  Sekian untuk makluman dan tindakan profesional pihak tuan / puan selanjutnya.
                </p>
              </div>

              {/* Slogan */}
              <div className="mt-8 text-[11pt] text-black">
                <strong>"MALAYSIA MADANI"</strong><br/>
                <span className="italic text-[10pt]">"Berkhidmat Untuk Negara"</span>
              </div>

              {/* Signoff */}
              <div className="mt-12 text-[11px] leading-relaxed text-black break-inside-avoid">
                <p>Saya yang menjalankan amanah,</p>
                <div className="h-16" /> {/* space for sign */}
                <strong>({invitation.officerName ? invitation.officerName.toUpperCase() : 'PEGAWAI PENTADBIRAN'})</strong><br/>
                b.p. Pegawai RISDA Daerah Beaufort<br/>
                RISDA Negeri Sabah
              </div>
            </>
          ) : (
            <>
              {/* HIGH-FIDELITY OFFICIAL SURAT TAWARAN PELAWAAN LAYOUT MATCHING THE PDF ACCURATELY */}
              <div className="text-center mb-6 flex flex-col items-center" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                {/* Gold RISDA Seal Badge inline SVG */}
                <svg width="65" height="65" viewBox="0 0 100 100" className="mb-3 mx-auto block">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#E2A612" strokeWidth="2.5"/>
                  <circle cx="50" cy="50" r="41" fill="none" stroke="#E2A612" strokeWidth="1" strokeDasharray="2,2"/>
                  <path d="M50,15 C35,40 38,70 50,85 C62,70 65,40 50,15 Z" fill="#E2A612" opacity="0.15"/>
                  <path d="M30,75 Q20,50 35,30 Q38,45 32,65" fill="none" stroke="#E2A612" strokeWidth="2"/>
                  <path d="M70,75 Q80,50 65,30 Q62,45 68,65" fill="none" stroke="#E2A612" strokeWidth="2"/>
                  <circle cx="50" cy="53" r="14" fill="#E2A612"/>
                  <text x="50" y="57" fontFamily="sans-serif" fontWeight="900" fontSize="8" fill="#ffffff" textAnchor="middle">RISDA</text>
                </svg>

                <div className="font-bold text-[11pt] text-black tracking-normal leading-tight">
                  PIHAK BERKUASA KEMAJUAN PEKEBUN KECIL PERUSAHAAN GETAH
                </div>
                <div className="font-bold text-[9.5pt] text-black italic tracking-wide mt-1">
                  KEMENTERIAN KEMAJUAN DESA DAN WILAYAH
                </div>
                <div className="w-full border-b-[4px] border-double border-black mt-4 mb-6"></div>
                
                <h1 className="font-black text-[13.5pt] text-black tracking-widest mt-1 underline">
                  SURAT TAWARAN PELAWAAN SEBUTHARGA
                </h1>
              </div>

              {/* Exact Aligned Metadata Block */}
              <table className="w-full text-[11.5pt] leading-normal text-black border-collapse mb-6" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                <tbody>
                  <tr>
                    <td className="w-[25%] font-bold py-1.5 align-top text-black">No.Sebutharga</td>
                    <td className="w-[3%] py-1.5 text-center align-top text-black">:</td>
                    <td className="w-[72%] font-bold py-1.5 align-top font-mono tracking-wide text-black">{invitation.tenderNo}</td>
                  </tr>
                  <tr>
                    <td className="font-bold py-1.5 align-top text-black">Sebutharga</td>
                    <td className="py-1.5 text-center align-top text-black">:</td>
                    <td className="font-bold py-1.5 align-top text-black uppercase leading-relaxed">{invitation.adTitle}</td>
                  </tr>
                  <tr className="h-[12px]"><td colSpan={3}></td></tr>
                  <tr>
                    <td className="font-bold py-1.5 align-top text-black">Pembekal/Kontraktor</td>
                    <td className="py-1.5 text-center align-top text-black">:</td>
                    <td className="font-bold py-1.5 align-top text-black uppercase tracking-wide">{matchedSupplier?.companyName || 'PIHAK KONTRAKTOR TERPILIH'}</td>
                  </tr>
                  <tr>
                    <td className="font-bold py-1.5 align-top text-black">Alamat</td>
                    <td className="py-1.5 text-center align-top text-black">:</td>
                    <td className="py-1.5 align-top text-black uppercase leading-relaxed whitespace-pre-wrap">{matchedSupplier?.address || 'TIADA ALAMAT BERDAFTAR'}</td>
                  </tr>
                </tbody>
              </table>

              {/* Numbered Requirements List matches the exact layout */}
              <div className="text-[11.5pt] leading-relaxed text-black text-justify space-y-4 font-serif" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                <div className="flex items-start">
                  <span className="w-7 font-bold shrink-0">1.</span>
                  <div>
                    Sebut harga adalah dipelawa daripada Kontraktor-Kontraktor yang berdaftar dengan{" "}
                    <strong className="underline text-black uppercase">{getLicensesText(ad)}</strong> dan masih sah laku pendaftaran untuk dibenarkan menyertai sebutharga ini.
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="w-7 font-bold shrink-0">2.</span>
                  <div>
                    Dokumen SebutHarga yang telah dilengkapi hendaklah dimasukkan ke dalam satu sampul surat bermetri dan bertulis nombor tawaran disebelah kiri atasnya dan dimasuk ke dalam Peti Tawaran yang terletak di{" "}
                    <strong className="underline text-black uppercase">
                      {invitation.submissionVenue || 'Pejabat RISDA Daerah Beaufort, K77 dan K78, Blok K, Beaufort Square Avenue 1, Jalan Binunuk, 89800 Beaufort, Sabah'}
                    </strong>{" "}
                    sebelum atau pada{" "}
                    <strong className="underline text-black uppercase">
                      {formatBeautifulDate(invitation.closingDate)}
                    </strong>{" "}
                    jam{" "}
                    <strong className="underline text-black">
                      {invitation.closingTime || '12.00 TENGAHARI'}
                    </strong>
                    .
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="w-7 font-bold shrink-0">3.</span>
                  <div>
                    Syarat-syarat Sebut Harga, Pelan Lukisan serta Ringkasan Sebut Harga dikembarkan bersama-sama ini.
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="w-7 font-bold shrink-0">4.</span>
                  <div>
                    Kontraktor adalah diwajibkan menghadiri taklimat dan lawatan tapak pada{" "}
                    <strong className="underline text-black uppercase">
                      {invitation.briefingDate ? `${formatBeautifulDate(invitation.briefingDate)} (${indonesianDayName(invitation.briefingDate)})` : 'TARIKH TAKLIMAT'}
                    </strong>{" "}
                    Jam{" "}
                    <strong className="underline text-black">
                      {invitation.briefingTime || '-'}
                    </strong>
                    . Taklimat akan di sampaikan hanya sekali sahaja dan pihak kontraktor dikehendaki berkumpul di{" "}
                    <strong className="underline text-black uppercase">
                      {invitation.briefingVenue || 'Pejabat RISDA Beaufort'}
                    </strong>{" "}
                    pada tarikh dan masa yang telah ditetapkan diatas.
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="w-7 font-bold shrink-0">5.</span>
                  <div>
                    Pihak RISDA tidak terikat untuk menerima sebut harga yang terendah sekali atau mana-mana sebutharga lain.
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Page Break for invited suppliers list */}
          <div className="page-break-before border-t border-black mt-16 pt-8 break-before-page">
            <div className="text-center mb-6">
              <h3 className="text-sm font-bold text-black uppercase tracking-widest">
                LAMPIRAN EDARAN PELAWAAN SEBUT HARGA
              </h3>
              <p className="text-xs text-slate-600 font-serif">
                Senarai syarikat / pembekal terpilih yang dipelawa secara rasmi
              </p>
              <p className="text-[10px] font-mono text-black font-bold mt-1">
                RUJUKAN FAIL: {invitation.referenceNo}
              </p>
            </div>

            <div className="space-y-4">
              {invitation.suppliers.map((s: any, idx: number) => (
                <div 
                  key={s.id || idx} 
                  className={`p-3 border rounded text-[10.5pt] break-inside-avoid ${s.companyName.toLowerCase().trim() === currentSupplierName.toLowerCase().trim() ? 'border-black bg-slate-50 font-bold' : 'border-slate-200'}`}
                >
                  <div className="flex justify-between items-start">
                    <span>BIL {idx + 1}: {s.companyName.toUpperCase()}</span>
                    {s.companyName.toLowerCase().trim() === currentSupplierName.toLowerCase().trim() && (
                      <span className="no-print text-[9px] bg-black text-white px-2 py-0.5 rounded font-bold">SYARIKAT ANDA</span>
                    )}
                  </div>
                  <div className="text-[9.5pt] text-slate-700 font-normal mt-1 whitespace-pre-wrap pl-4 leading-normal">
                    {s.address || 'Alamat tidak berdaftar'}<br/>
                    Tel: {s.phoneNumber} {s.email ? `| E-mel: ${s.email}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
