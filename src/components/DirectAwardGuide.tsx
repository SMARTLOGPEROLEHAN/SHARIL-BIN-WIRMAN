import React from 'react';
import { 
  BookOpen, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Coins, 
  FileText, 
  Hammer, 
  Briefcase, 
  Package, 
  Scale, 
  ArrowRight,
  ExternalLink,
  Award,
  Sparkles,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';

export default function DirectAwardGuide() {
  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="space-y-8 p-4 sm:p-8 max-w-6xl mx-auto animate-fadeIn">
      {/* Header Banner (Matches selected theme) */}
      <div className="bg-risda-card border border-risda-border rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-80 h-60 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black uppercase tracking-wider shadow-xs">
            <Sparkles size={14} className="text-amber-500" />
            <span>Pekeliling Perbendaharaan Malaysia (1PP PK 2 &amp; AP 173)</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight font-poppins text-slate-900 dark:text-white uppercase leading-tight">
            Panduan &amp; Tatacara Perolehan Tawaran Terus
          </h1>

          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 max-w-3xl leading-relaxed font-semibold">
            Garis panduan rasmi had ambang, pendaftaran pembekal, kaedah perolehan bekalan, perkhidmatan bukan perunding, dan kerja-kerja kecil di peringkat Pejabat RISDA Daerah &amp; Bahagian.
          </p>
        </div>
      </div>

      {/* 3 Had Ambang Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Kategori 1: Bekalan */}
        <div className="bg-risda-card border border-risda-border rounded-2xl p-6 shadow-sm hover:border-blue-500/40 transition-all flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 flex items-center justify-center">
                <Package size={24} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-700 shadow-xs">
                1PP PK 2.1
              </span>
            </div>
            <div>
              <h3 className="text-base font-black text-slate-950 dark:text-white uppercase">Kategori 1: Bekalan</h3>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-semibold mt-1 leading-relaxed">
                Pembelian barangan guna habis, alat ganti, perkakasan ICT, baja, dan input pertanian.
              </p>
            </div>
            <div className="pt-2 border-t border-risda-border/60 space-y-1">
              <div className="text-xs text-slate-800 dark:text-slate-200 uppercase font-black">Had Ambang Rasmi:</div>
              <div className="text-xl font-black text-blue-700 dark:text-blue-400">Sehingga RM 50,000</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 font-bold">per transaksi / pesanan</div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-risda-border/40 text-xs text-slate-700 dark:text-slate-300 font-semibold">
            Syarat: Berdaftar dengan Kementerian Kewangan (MOF) mengikut kod bidang berkaitan.
          </div>
        </div>

        {/* Kategori 2: Perkhidmatan */}
        <div className="bg-risda-card border border-risda-border rounded-2xl p-6 shadow-sm hover:border-emerald-500/40 transition-all flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center">
                <Briefcase size={24} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700 shadow-xs">
                1PP PK 2.2
              </span>
            </div>
            <div>
              <h3 className="text-base font-black text-slate-950 dark:text-white uppercase">Kategori 2: Perkhidmatan</h3>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-semibold mt-1 leading-relaxed">
                Penyelenggaraan hawa dingin, kebersihan bangunan, kawalan serangga, dan pembaikan kenderaan.
              </p>
            </div>
            <div className="pt-2 border-t border-risda-border/60 space-y-1">
              <div className="text-xs text-slate-800 dark:text-slate-200 uppercase font-black">Had Ambang Rasmi:</div>
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-400">Sehingga RM 50,000</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 font-bold">bukan perunding sahaja</div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-risda-border/40 text-xs text-slate-700 dark:text-slate-300 font-semibold">
            Syarat: Sijil pendaftaran MOF / Lesen PBT yang masih sah tempoh kuat kuasa.
          </div>
        </div>

        {/* Kategori 3: Kerja */}
        <div className="bg-risda-card border border-risda-border rounded-2xl p-6 shadow-sm hover:border-amber-500/40 transition-all flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center">
                <Hammer size={24} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700 shadow-xs">
                Arahan Perbendaharaan 173
              </span>
            </div>
            <div>
              <h3 className="text-base font-black text-slate-950 dark:text-white uppercase">Kategori 3: Kerja (Works)</h3>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-semibold mt-1 leading-relaxed">
                Kerja pembaikan kecil pejabat, pembersihan parit, mengecat pagar, dan infrastruktur ladang.
              </p>
            </div>
            <div className="pt-2 border-t border-risda-border/60 space-y-1">
              <div className="text-xs text-slate-800 dark:text-slate-200 uppercase font-black">Had Ambang Rasmi:</div>
              <div className="text-xl font-black text-amber-700 dark:text-amber-400">Sehingga RM 100,000</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 font-bold">kontraktor Gred G1</div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-risda-border/40 text-xs text-slate-700 dark:text-slate-300 font-semibold">
            Syarat: Berdaftar dengan CIDB (Gred G1) dan Pusat Khidmat Kontraktor (PKK) jika berkaitan.
          </div>
        </div>
      </div>

      {/* Aliran Kerja 4 Langkah */}
      <div className="bg-risda-card border border-risda-border rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-lg font-black text-slate-950 dark:text-white uppercase tracking-wide flex items-center gap-2">
            <Scale size={20} className="text-amber-500" />
            <span>Aliran Proses Kerja Perolehan Tawaran Terus</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-semibold mt-1">
            Langkah pematuhan penuh daripada kajian pasaran sehingga pembayaran pesanan kerajaan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm">
              1
            </div>
            <h4 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white uppercase">Kajian Pasaran Ringkas</h4>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
              Pegawai peminta mendapatkan sebut harga / katalog harga daripada sekurang-kurangnya 1 hingga 3 pembekal berwibawa bagi memastikan harga berpatutan (value for money).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500 text-white font-black flex items-center justify-center text-sm">
              2
            </div>
            <h4 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white uppercase">Semakan Baki Vot Peruntukan</h4>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
              Memastikan baki peruntukan dalam Buku Vot mencukupi sebelum Pesanan Tempatan (LO) dikeluarkan, selaras dengan Peraturan Kewangan Kerajaan.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500 text-white font-black flex items-center justify-center text-sm">
              3
            </div>
            <h4 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white uppercase">Pengesahan Integriti &amp; Kelulusan</h4>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
              Semakan automatik bagi memastikan tiada amalan pecah kecil (pecah nilai perolehan). Kelulusan oleh Pegawai Pengawal atau Pegawai yang diturunkan kuasa.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white font-black flex items-center justify-center text-sm">
              4
            </div>
            <h4 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white uppercase">Penjanaan Dokumen Pesanan (LO)</h4>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
              Sistem menjana Pesanan Tempatan rasmi bersama butiran kerja/bekalan, tempoh siap, dan terma pembayaran untuk ditandatangani serta diserahkan kepada syarikat.
            </p>
          </div>
        </div>
      </div>

      {/* Garis Panduan Integriti & Larangan Pecah Kecil */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={22} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-black text-amber-500 dark:text-amber-400 uppercase tracking-wide">
              Peringatan Integriti: Larangan Pecah Kecil Perolehan (AP 173.2)
            </h3>
            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-semibold leading-relaxed">
              Pegawai dilarang sama sekali membahagikan atau memecah-kecilkan nilai perolehan bagi tujuan mengelak daripada tatacara Sebut Harga atau Tender rasmi. Sebarang transaksi berulang bagi bekalan/perkhidmatan serupa dalam tempoh singkat hendaklah dirancang secara berpusat.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={() => navigateTo('/')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <span>Kembali ke Dashboard Tawaran Terus</span>
            <ArrowRight size={14} />
          </button>
          <button
            onClick={() => navigateTo('/kod-peruntukan')}
            className="px-4 py-2 bg-risda-card hover:bg-white/10 text-slate-950 dark:text-white border border-risda-border font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
          >
            <Coins size={14} className="text-amber-400" />
            <span>Semak Buku Vot &amp; Peruntukan</span>
          </button>
        </div>
      </div>
    </div>
  );
}
