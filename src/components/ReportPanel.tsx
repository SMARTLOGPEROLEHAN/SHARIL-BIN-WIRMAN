import { motion, AnimatePresence } from 'motion/react';
import { FileBarChart, Download, FileText, TrendingUp, Users, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';

export default function ReportPanel() {
  const { role } = useAuth();
  const [view, setView] = useState<'summary' | 'sukuan' | 'tahunan'>('summary');

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#sukuan') setView('sukuan');
      else if (hash === '#tahunan') setView('tahunan');
      else setView('summary');
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const isStaff = role === 'admin' || role === 'penginput' || role === 'pelulus' || role === 'pentadbir';

  if (!isStaff) {
    return (
      <div className="p-20 text-center">
        <div className="w-20 h-20 bg-risda-orange/10 rounded-full flex items-center justify-center mx-auto mb-6 text-risda-orange">
          <FileBarChart size={40} />
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Akses Terhad</h2>
        <p className="text-sm text-risda-muted mt-2 uppercase tracking-[2px]">Ciri ini hanya boleh diakses oleh Kakitangan Sahaja.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 w-full min-h-screen">
      <header className="space-y-2 border-b border-white/5 pb-8">
        <div className="flex items-center gap-4 text-risda-orange mb-2">
          <FileBarChart size={32} />
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-[6px] text-white">
            {view === 'summary' && 'Ringkasan Laporan Sebutharga'}
            {view === 'sukuan' && 'Laporan Sukuan Bulanan'}
            {view === 'tahunan' && 'Laporan Tahunan'}
          </h1>
        </div>
        <p className="text-[10px] md:text-xs text-risda-muted font-bold uppercase tracking-[4px]">
          {view === 'summary' && 'Paparan Keseluruhan Prestasi Perolehan RISDA Sabah'}
          {view === 'sukuan' && 'Analisis Suku Tahunan (Q1 - Q4) bagi Prestasi Tender'}
          {view === 'tahunan' && 'Rekod Arkib Analisis Komprehensif Perolehan Berjalan'}
        </p>
      </header>

      <AnimatePresence mode="wait">
        {view === 'summary' && (
          <motion.div 
            key="summary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 py-10 border-b border-white/10">
        <ReportStat cardTitle="Jumlah Iklan" value="124" trend="+12" icon={FileText} />
        <ReportStat cardTitle="Kakitangan Aktif" value="32" trend="+3" icon={Users} />
        <ReportStat cardTitle="Keputusan Sah" value="89" trend="+5" icon={CheckCircle} />
        <ReportStat cardTitle="Purata Kehadiran" value="18" trend="+2.4" icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 py-12">
        <div className="space-y-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-[11px] font-black uppercase tracking-[4px] text-risda-orange">Sebut Harga Mengikut Negeri</h3>
            <FileBarChart size={18} className="text-risda-muted" />
          </div>
          <div className="space-y-8">
            <StateBar name="SABAH" percentage={75} count={45} />
            <StateBar name="SELANGOR" percentage={60} count={32} />
            <StateBar name="KUALA LUMPUR" percentage={40} count={21} />
            <StateBar name="SARAWAK" percentage={30} count={16} />
          </div>
        </div>

        <div className="space-y-8">
           <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-[11px] font-black uppercase tracking-[4px] text-risda-orange">Laporan Eksklusif</h3>
            <Download size={18} className="text-risda-muted" />
           </div>
           <div className="space-y-4">
             <DownloadItem title="Laporan Bulanan Perolehan (April 2024)" size="2.4 MB" date="28 Apr 2024" />
             <DownloadItem title="Statistik Kehadiran Pembekal (Q1)" size="1.8 MB" date="15 Apr 2024" />
             <DownloadItem title="Analisis Keputusan Sebut Harga" size="3.1 MB" date="10 Apr 2024" />
           </div>
           <button className="w-full bg-risda-orange text-black font-black uppercase tracking-[4px] py-5 rounded-2xl hover:bg-risda-gold transition-all shadow-xl shadow-risda-orange/20 mt-4 text-[10px]">JANA LAPORAN TERKINI</button>
        </div>
      </div>
          </motion.div>
        )}

        {view === 'sukuan' && (
          <motion.div 
            key="sukuan"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="glass-card p-8 rounded-3xl space-y-8 bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/10">
              <div className="flex items-center justify-between transition-all">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-[2px] text-white">Laporan Sukuan Bulanan</h3>
                  <p className="text-[9px] text-risda-muted font-bold uppercase tracking-widest">Rumusan Prestasi setiap 3 Bulan (Q1-Q4)</p>
                </div>
                <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                   <TrendingUp size={20} />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <QuarterItem title="SUKUAN PERTAMA (Q1)" period="Januari - Mac" status="Tersedia" />
                 <QuarterItem title="SUKUAN KEDUA (Q2)" period="April - Jun" status="Dalam Proses" />
                 <QuarterItem title="SUKUAN KETIGA (Q3)" period="Julai - September" status="Akan Datang" />
                 <QuarterItem title="SUKUAN KEEMPAT (Q4)" period="Oktober - Disember" status="Akan Datang" />
              </div>
            </div>
          </motion.div>
        )}

        {view === 'tahunan' && (
          <motion.div 
            key="tahunan"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="glass-card p-8 rounded-3xl space-y-8 bg-gradient-to-br from-risda-gold/5 to-transparent border-risda-gold/10">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-[2px] text-white">Laporan Tahunan</h3>
                  <p className="text-[9px] text-risda-muted font-bold uppercase tracking-widest">Analisis Komprehensif Tahunan Perolehan</p>
                </div>
                <div className="p-2.5 bg-risda-gold/10 rounded-xl text-risda-gold">
                   <FileText size={20} />
                </div>
              </div>

              <div className="space-y-4">
                 <AnnualReportItem year="2024" totalAds="124" status="Draf Perolehan" />
                 <AnnualReportItem year="2023" totalAds="458" status="Arkib Selesai" />
                 <AnnualReportItem year="2022" totalAds="412" status="Arkib Selesai" />
                 <AnnualReportItem year="2021" totalAds="350" status="Arkib Selesai" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuarterItem({ title, period, status }: any) {
  const isAvailable = status === 'Tersedia';
  return (
    <div className={`p-4 rounded-2xl border transition-all ${isAvailable ? 'bg-white/5 border-white/10 hover:border-blue-500/50 cursor-pointer' : 'bg-black/20 border-white/5 opacity-50 cursor-not-allowed'}`}>
      <h4 className="text-[10px] font-black text-white uppercase tracking-tight mb-1">{title}</h4>
      <p className="text-[9px] text-risda-muted uppercase font-bold tracking-widest mb-3">{period}</p>
      <div className="flex items-center justify-between">
        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${isAvailable ? 'bg-green-500/10 text-green-500' : 'bg-risda-muted/10 text-risda-muted'}`}>
          {status}
        </span>
        {isAvailable && <Download size={12} className="text-risda-muted" />}
      </div>
    </div>
  );
}

function AnnualReportItem({ year, totalAds, status }: any) {
  const isComplete = status === 'Arkib Selesai';
  return (
    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black ${isComplete ? 'bg-risda-gold/10 text-risda-gold' : 'bg-blue-500/10 text-blue-400'}`}>
          <span className="text-[8px] uppercase tracking-tighter opacity-50">Tahun</span>
          <span className="text-sm">{year}</span>
        </div>
        <div className="flex flex-col">
          <h4 className="text-xs font-bold text-white uppercase tracking-tight">LAPORAN TAHUNAN PEROLEHAN {year}</h4>
          <p className="text-[9px] text-risda-muted font-bold uppercase tracking-widest">{totalAds} Iklan • {status}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-risda-muted hover:text-white">
          <Download size={14} />
        </button>
      </div>
    </div>
  );
}

function ReportStat({ cardTitle, value, trend, icon: Icon }: any) {
  return (
    <div className="p-8 border border-white/5 rounded-3xl bg-white/5 transition-all group cursor-default">
      <div className="flex justify-between items-start mb-6">
        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-risda-orange group-hover:bg-risda-orange group-hover:text-black transition-all duration-500 shadow-inner">
          <Icon size={24} />
        </div>
        <span className="text-[10px] font-black text-green-500 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">{trend}</span>
      </div>
      <p className="text-[10px] font-black text-risda-muted uppercase tracking-[3px] mb-2 opacity-60">{cardTitle}</p>
      <p className="text-4xl font-black text-white tracking-tighter group-hover:text-risda-orange transition-colors">{value}</p>
    </div>
  );
}

function StateBar({ name, percentage, count }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-[1px]">
        <span className="text-white">{name}</span>
        <span className="text-risda-orange">{count} Iklan</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full bg-risda-orange shadow-[0_0_10px_rgba(0,176,255,0.3)]"
        />
      </div>
    </div>
  );
}

function DownloadItem({ title, size, date }: any) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group">
      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-bold text-white group-hover:text-risda-orange transition-colors">{title}</h4>
        <p className="text-[9px] text-risda-muted font-bold uppercase tracking-[1px]">{date} • {size}</p>
      </div>
      <Download size={16} className="text-risda-muted group-hover:text-white transition-colors" />
    </div>
  );
}
