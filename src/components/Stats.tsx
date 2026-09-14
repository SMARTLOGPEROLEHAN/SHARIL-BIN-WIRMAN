import { motion } from 'motion/react';
import { Target, ShieldCheck, Activity } from 'lucide-react';

export default function Stats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-risda-card border border-risda-border rounded-2xl p-5 sm:p-6 shadow-sm hover:border-risda-orange/40 hover:shadow-md transition-all flex items-center gap-5 group"
      >
        <div className="w-14 h-14 bg-risda-orange/10 rounded-xl flex items-center justify-center text-risda-orange shrink-0 border border-risda-orange/20 group-hover:bg-risda-orange group-hover:text-white transition-all duration-300">
          <Target size={26} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-risda-orange uppercase tracking-[2px] mb-1">Integriti</p>
          <h3 className="text-base sm:text-lg font-bold text-risda-text uppercase tracking-tight leading-snug">Ketelusan Data</h3>
          <p className="text-xs text-risda-muted mt-0.5 font-medium">Rekod digital dipantau secara telus</p>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-risda-card border border-risda-border rounded-2xl p-5 sm:p-6 shadow-sm hover:border-risda-gold/40 hover:shadow-md transition-all flex items-center gap-5 group"
      >
        <div className="w-14 h-14 bg-risda-gold/10 rounded-xl flex items-center justify-center text-risda-gold shrink-0 border border-risda-gold/20 group-hover:bg-risda-gold group-hover:text-white transition-all duration-300">
          <ShieldCheck size={26} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-risda-gold uppercase tracking-[2px] mb-1">Kawalan</p>
          <h3 className="text-base sm:text-lg font-bold text-risda-text uppercase tracking-tight leading-snug">Tadbir Urus Digital</h3>
          <p className="text-xs text-risda-muted mt-0.5 font-medium">Pematuhan syarat & kelayakan sah</p>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-risda-card border border-risda-border rounded-2xl p-5 sm:p-6 shadow-sm hover:border-risda-orange/40 hover:shadow-md transition-all flex items-center gap-5 group"
      >
        <div className="w-14 h-14 bg-risda-card-muted rounded-xl flex items-center justify-center text-risda-muted shrink-0 border border-risda-border group-hover:bg-risda-orange group-hover:text-white transition-all duration-300">
          <Activity size={26} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-risda-muted uppercase tracking-[2px] mb-1">Sistem</p>
          <h3 className="text-base sm:text-lg font-bold text-risda-text uppercase tracking-tight leading-snug">Pemantauan 24/7</h3>
          <p className="text-xs text-risda-muted mt-0.5 font-medium">Akses masa nyata urusan sebut harga</p>
        </div>
      </motion.div>
    </div>
  );
}
