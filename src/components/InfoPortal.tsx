import { motion } from 'motion/react';
import { Info, Target, Zap, Cpu, Bell, Download } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export default function InfoPortal() {
  return (
    <div className="space-y-8 p-8 w-full max-w-5xl mx-auto">
      <div className="bg-risda-card border border-risda-border rounded-2xl md:rounded-[24px] p-6 md:p-8 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-risda-orange rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
              <Info size={28} />
            </div>
            <div>
              <p className="text-[10px] text-risda-orange font-black uppercase tracking-[6px] mb-1">Portal Maklumat</p>
              <h2 className="text-2xl md:text-3xl font-black text-risda-text uppercase tracking-tight leading-none">Info Portal</h2>
              <p className="text-[10px] text-risda-muted font-bold uppercase tracking-[3px] mt-1.5">
                Pusat Rujukan Maklumat Rasmi Inisiatif Digital & Pendaftaran Sebut Harga RISDA
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* PWA Direct Download Banner */}
      <PWAInstallButton variant="banner" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-12">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-risda-card p-10 rounded-[32px] border border-risda-border shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-risda-orange/5 blur-[100px] pointer-events-none" />
            
            <h3 className="text-xl lg:text-2xl font-black text-risda-orange uppercase tracking-wide mb-6 border-l-4 border-risda-orange pl-6">
              Mengenai Sistem
            </h3>
            
            <p className="text-lg lg:text-xl text-risda-text leading-relaxed font-semibold">
              Sistem ini merupakan inisiatif perintis yang dibangunkan untuk mendigitalkan proses perolehan di peringkat agensi. 
              Ia memfokuskan kepada ketelusan dan kecekapan dalam pengurusan sebut harga, terutamanya bagi 
              aktiviti lawatan tapak yang memerlukan pengesahan fizikal dan digital yang kukuh. Selain itu juga, sistem ini juga memfokuskan kepada tawaran terus perkhidmatan, bekalan dan kerja agar selari dengan perolehan yang terdapat di RISDA.
            </p>
          </motion.div>
        </div>

        <div className="lg:col-span-12 space-y-6">
          <motion.h3 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 0.2 }}
             className="text-sm font-black text-risda-muted uppercase tracking-[4px] pl-2"
          >
            Matlamat Sistem
          </motion.h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GoalCard 
              icon={Zap} 
              title="Akses Pantas" 
              description="Memudahkan kontraktor mengakses iklan sebut harga terkini dari mana-mana sahaja." 
              delay={0.3}
            />
            <GoalCard 
              icon={Cpu} 
              title="Automasi Rekod" 
              description="Automasi rekod kehadiran lawatan tapak yang lebih efisien dan telus." 
              delay={0.4}
            />
            <GoalCard 
              icon={Bell} 
              title="Keputusan Segera" 
              description="Mempercepatkan proses pengumuman keputusan sebut harga kepada pembida." 
              delay={0.5}
            />
          </div>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="pt-12 text-center"
      >
        <p className="text-[10px] text-risda-muted font-bold uppercase tracking-[4px]">
          Hak Cipta Terpelihara © 2024 RISDA Digital Ecosystem
        </p>
      </motion.div>
    </div>
  );
}

function GoalCard({ icon: Icon, title, description, delay }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="h-full bg-risda-card p-8 rounded-3xl border border-risda-border hover:border-risda-orange/40 shadow-sm transition-all group flex flex-col justify-start"
    >
      <div className="w-14 h-14 bg-risda-orange/15 rounded-2xl flex items-center justify-center text-risda-orange mb-6 group-hover:scale-110 transition-transform shrink-0">
        <Icon size={28} />
      </div>
      <h4 className="text-xl font-bold text-risda-text uppercase tracking-tight mb-4 group-hover:text-risda-gold transition-colors">{title}</h4>
      <p className="text-sm text-risda-muted leading-relaxed font-semibold uppercase tracking-[2px] mt-auto">{description}</p>
    </motion.div>
  );
}
