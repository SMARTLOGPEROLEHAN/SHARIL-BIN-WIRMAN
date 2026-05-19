import { motion } from 'motion/react';
import { Target, ShieldCheck, Activity } from 'lucide-react';

export default function Stats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 py-10 border-b border-white/10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-8 group"
      >
        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-risda-orange shrink-0 border border-white/5 group-hover:border-risda-orange/50 transition-all duration-500 group-hover:shadow-[0_0_20px_rgba(255,176,0,0.15)] group-hover:bg-risda-orange group-hover:text-black">
          <Target size={28} />
        </div>
        <div>
          <p className="text-[10px] font-black text-risda-orange uppercase tracking-[4px] mb-2">Integriti</p>
          <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none group-hover:translate-x-1 transition-transform">Ketelusan Data</h3>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-8 group"
      >
        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-risda-gold shrink-0 border border-white/5 group-hover:border-risda-gold/50 transition-all duration-500 group-hover:shadow-[0_0_20px_rgba(255,215,0,0.15)] group-hover:bg-risda-gold group-hover:text-black">
          <ShieldCheck size={28} />
        </div>
        <div>
          <p className="text-[10px] font-black text-risda-gold uppercase tracking-[4px] mb-2">Kawalan</p>
          <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none group-hover:translate-x-1 transition-transform">Tadbir Urus Digital</h3>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-8 group"
      >
        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-risda-muted shrink-0 border border-white/5 group-hover:border-white/40 transition-all duration-500 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] group-hover:bg-white group-hover:text-black">
          <Activity size={28} />
        </div>
        <div>
          <p className="text-[10px] font-black text-risda-muted uppercase tracking-[4px] mb-2">Sistem</p>
          <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none group-hover:translate-x-1 transition-transform">Pemantauan 24/7</h3>
        </div>
      </motion.div>
    </div>
  );
}
