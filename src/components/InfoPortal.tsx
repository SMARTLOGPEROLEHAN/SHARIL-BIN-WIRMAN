import { motion } from 'motion/react';
import { Info, Target, Zap, Cpu, Bell } from 'lucide-react';

export default function InfoPortal() {
  return (
    <div className="space-y-8 p-8 w-full max-w-5xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 mb-10"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-risda-orange/10 border border-risda-orange/20 rounded-full w-fit mb-2">
          <Info size={14} className="text-risda-orange" />
          <span className="text-[10px] font-black text-risda-orange uppercase tracking-[2px]">Informasi Rasmi</span>
        </div>
        <h2 className="text-4xl lg:text-6xl font-black text-white uppercase tracking-tight leading-none">Info Portal</h2>
        <p className="text-base lg:text-lg text-white/70 font-medium max-w-3xl leading-relaxed mt-4">
          Pusat rujukan maklumat rasmi mengenai inisiatif digital dan ekosistem pendaftaran tapak sebut harga RISDA.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-12">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-10 rounded-[32px] border border-white/5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-risda-orange/5 blur-[100px] pointer-events-none" />
            
            <h3 className="text-xl font-black text-risda-orange uppercase tracking-[2px] mb-6 border-l-4 border-risda-orange pl-6">
              Mengenai Sistem
            </h3>
            
            <p className="text-lg lg:text-xl text-white/80 leading-relaxed font-semibold">
              Sistem ini merupakan inisiatif perintis yang dibangunkan untuk mendigitalkan proses perolehan di peringkat agensi. 
              Ia memfokuskan kepada ketelusan dan kecekapan dalam pengurusan sebut harga, terutamanya bagi 
              aktiviti lawatan tapak yang memerlukan pengesahan fizikal dan digital yang kukuh.
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
        <p className="text-[10px] text-risda-muted font-bold uppercase tracking-[4px] opacity-30">
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
      className="glass-card p-8 rounded-3xl border border-white/5 bg-gradient-to-br from-risda-card to-black hover:border-risda-orange/30 transition-all group"
    >
      <div className="w-14 h-14 bg-risda-orange/10 rounded-2xl flex items-center justify-center text-risda-orange mb-6 group-hover:scale-110 transition-transform">
        <Icon size={28} />
      </div>
      <h4 className="text-xl font-black text-white uppercase tracking-tight mb-4 group-hover:text-risda-gold transition-colors">{title}</h4>
      <p className="text-sm text-white/60 leading-relaxed font-semibold uppercase tracking-[2px]">{description}</p>
    </motion.div>
  );
}
