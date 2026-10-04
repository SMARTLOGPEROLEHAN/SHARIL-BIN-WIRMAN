import React from 'react';
import { 
  FileText, 
  CheckCircle2, 
  Megaphone, 
  Inbox, 
  Scale, 
  Trophy, 
  ShieldCheck, 
  FileCheck, 
  BarChart3, 
  ChevronRight,
  ArrowRight,
  Clock,
  Sparkles
} from 'lucide-react';
import { DirectAwardSection } from './DirectAwardManagement';

export interface WorkflowStageInfo {
  step: number;
  id: DirectAwardSection;
  tab?: string;
  name: string;
  shortName: string;
  icon: any;
  description: string;
  ruleRef: string;
}

export const WORKFLOW_STAGES: WorkflowStageInfo[] = [
  {
    step: 1,
    id: 'permohonan',
    tab: 'baharu',
    name: '1. PERMOHONAN',
    shortName: 'PERMOHONAN',
    icon: FileText,
    description: 'Pendaftaran & Draf Permohonan Tawaran Terus (≤RM50k bekalan/perkhidmatan, ≤RM100k kerja)',
    ruleRef: '1PP PK 2'
  },
  {
    step: 2,
    id: 'permohonan',
    tab: 'kelulusan',
    name: '2. KELULUSAN (PERMOHONAN)',
    shortName: 'KELULUSAN',
    icon: CheckCircle2,
    description: 'Kelulusan Awal Permohonan Perolehan oleh Pegawai Pelulus / Ketua PTJ sebelum pelawaan',
    ruleRef: 'AP 173'
  },
  {
    step: 3,
    id: 'pelawaan',
    tab: 'baharu',
    name: '3. PELAWAAN 3 PEMBEKAL',
    shortName: 'PELAWAAN 3 PEMBEKAL',
    icon: Megaphone,
    description: 'Kajian pasaran dengan pelawaan kepada sekurang-kurangnya 3 pembekal berdaftar',
    ruleRef: 'AP 173'
  },
  {
    step: 4,
    id: 'tawaran',
    tab: 'semua',
    name: '4. TAWARAN DITERIMA',
    shortName: 'TAWARAN DITERIMA',
    icon: Inbox,
    description: 'Penerimaan sebutharga, profil SSM, SST dan dokumen spesifikasi ketiga-tiga pembekal',
    ruleRef: '1PP PK 2'
  },
  {
    step: 5,
    id: 'penilaian',
    tab: 'perbandingan',
    name: '5. PENILAIAN',
    shortName: 'PENILAIAN',
    icon: Scale,
    description: 'Perbandingan tawaran 3 pembekal (harga, spesifikasi, penghantaran & catatan penilai)',
    ruleRef: 'AP 173'
  },
  {
    step: 6,
    id: 'penilaian',
    tab: 'cadangan',
    name: '6. PEMILIHAN',
    shortName: 'PEMILIHAN',
    icon: Trophy,
    description: 'Senarai pemilihan, perakuan pembekal terbaik dan justifikasi pemilihan oleh pegawai',
    ruleRef: '1PP PK 2'
  },
  {
    step: 7,
    id: 'pemilihan',
    tab: 'kelulusan',
    name: '7. KELULUSAN (PEMILIHAN)',
    shortName: 'KELULUSAN',
    icon: ShieldCheck,
    description: 'Kelulusan muktamad pemilihan pembekal oleh Pegawai Pengesah / Pelulus PTJ',
    ruleRef: 'AP 173'
  },
  {
    step: 8,
    id: 'pesanan',
    tab: 'jana',
    name: '8. JANA LO',
    shortName: 'JANA LO',
    icon: FileCheck,
    description: 'Penjanaan Pesanan Tempatan (LO) rasmi berdasar permohonan yang diluluskan & hantar kewangan',
    ruleRef: 'AP 176'
  },
  {
    step: 9,
    id: 'laporan',
    tab: 'ringkasan',
    name: '9. LAPORAN',
    shortName: 'LAPORAN',
    icon: BarChart3,
    description: 'Laporan perolehan lengkap, statistik perbelanjaan, pematuhan had nilai dan audit',
    ruleRef: '1PP PK 2'
  }
];

interface DirectAwardWorkflowTrackerProps {
  currentSection: DirectAwardSection;
  currentTab?: string;
  onNavigateStage: (section: DirectAwardSection, tab?: string) => void;
  onOpenDossier?: () => void;
}

export default function DirectAwardWorkflowTracker({
  currentSection,
  currentTab,
  onNavigateStage,
  onOpenDossier
}: DirectAwardWorkflowTrackerProps) {
  // Determine current active step index (1-based)
  const currentStepNumber = (() => {
    if (currentSection === 'permohonan') {
      return (currentTab === 'kelulusan' || currentTab === 'selesai') ? 2 : 1;
    }
    if (currentSection === 'pelawaan') return 3;
    if (currentSection === 'tawaran') return 4;
    if (currentSection === 'penilaian') {
      return currentTab === 'cadangan' ? 6 : 5;
    }
    if (currentSection === 'pemilihan') return 7;
    if (currentSection === 'pesanan') return 8;
    if (currentSection === 'laporan') return 9;
    return 1;
  })();

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 text-slate-800 dark:text-slate-100">
      {/* Top Banner Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center font-black">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>Aliran Penuh Perolehan Tawaran Terus (1PP PK 2 / AP 173 / AP 176)</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Satu rekod perolehan lengkap dan bersambung dari permohonan sehingga selesai bayaran.
            </p>
          </div>
        </div>

        {onOpenDossier && (
          <button
            type="button"
            onClick={onOpenDossier}
            className="px-3.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-600 dark:text-amber-300 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <FileText size={13} />
            <span>📜 Lihat Dossier Penuh Perolehan</span>
          </button>
        )}
      </div>

      {/* 9-Step Continuous Interactive Stepper */}
      <div className="overflow-x-auto pb-1 [scrollbar-width:none]">
        <div className="flex items-center min-w-[850px] justify-between relative">
          {/* Connector Line behind steps */}
          <div className="absolute top-5 left-6 right-6 h-0.5 bg-slate-200 dark:bg-white/10 -z-0" />

          {WORKFLOW_STAGES.map((st, idx) => {
            const isCompleted = st.step < currentStepNumber;
            const isCurrent = st.step === currentStepNumber;
            const isUpcoming = st.step > currentStepNumber;

            return (
              <React.Fragment key={st.step}>
                <button
                  type="button"
                  onClick={() => onNavigateStage(st.id, st.tab)}
                  className={`group flex flex-col items-center text-center cursor-pointer transition-all relative z-10 px-1 py-1 rounded-2xl ${
                    isCurrent ? 'scale-105' : 'hover:scale-102'
                  }`}
                  title={`${st.name} — ${st.description}`}
                >
                  {/* Step Icon Node */}
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs transition-all shadow-sm ${
                    isCompleted
                      ? 'bg-emerald-500 text-slate-950 font-black ring-4 ring-emerald-500/20 shadow-emerald-500/20'
                      : isCurrent
                      ? 'bg-amber-500 text-slate-950 font-black ring-4 ring-amber-500/30 shadow-lg shadow-amber-500/30 animate-pulse'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-white/10 group-hover:text-slate-700 dark:group-hover:text-white'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 size={18} className="stroke-[3]" />
                    ) : (
                      React.createElement(st.icon, { size: 17, className: 'stroke-[2.5]' })
                    )}
                  </div>

                  {/* Stage Label */}
                  <div className="mt-2 text-center max-w-[90px]">
                    <span className={`block text-[11px] font-black uppercase tracking-tight leading-tight ${
                      isCurrent
                        ? 'text-amber-600 dark:text-amber-400 font-black'
                        : isCompleted
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
                    }`}>
                      {st.shortName}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                      {st.ruleRef}
                    </span>
                  </div>
                </button>

                {/* Arrow between nodes */}
                {idx < WORKFLOW_STAGES.length - 1 && (
                  <div className="text-slate-300 dark:text-slate-700 shrink-0 mx-0.5">
                    <ChevronRight size={14} className="opacity-70" />
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {/* Terminal Milestone: SELESAI */}
          <div className="text-slate-300 dark:text-slate-700 shrink-0 mx-0.5">
            <ChevronRight size={14} className="opacity-70" />
          </div>

          <button
            type="button"
            onClick={onOpenDossier || (() => onNavigateStage('laporan', 'ringkasan'))}
            className="group flex flex-col items-center text-center cursor-pointer transition-all relative z-10 px-1 py-1 rounded-2xl hover:scale-105"
            title="SELESAI — Rekod Perolehan Lengkap Dari Permohonan Sehingga Selesai"
          >
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs transition-all shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/20 ring-2 ring-emerald-500/30">
              <Sparkles size={17} className="stroke-[2.5]" />
            </div>
            <div className="mt-2 text-center max-w-[90px]">
              <span className="block text-[11px] font-black uppercase tracking-tight leading-tight text-emerald-600 dark:text-emerald-400">
                SELESAI
              </span>
              <span className="text-[9px] font-mono text-emerald-500 dark:text-emerald-400 font-bold block mt-0.5">
                REKOD LENGKAP
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Current Step Description Card Footer */}
      {(() => {
        const activeStage = WORKFLOW_STAGES.find(s => s.step === currentStepNumber) || WORKFLOW_STAGES[0];
        return (
          <div className="px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Peringkat Semasa: <strong className="text-amber-600 dark:text-amber-400">{activeStage.name}</strong> — {activeStage.description}
              </span>
            </div>

            <span className="text-[11px] font-mono font-bold text-slate-400">
              {currentStepNumber} daripada 9 Peringkat Dilalui
            </span>
          </div>
        );
      })()}
    </div>
  );
}
