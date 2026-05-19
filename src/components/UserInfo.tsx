import React from 'react';
import { motion } from 'motion/react';
import { Info, Shield, UserPlus, FileCheck } from 'lucide-react';

export default function UserInfo() {
  const roles = [
    {
      title: 'Pentadbir Sistem',
      roleKey: 'Admin',
      icon: Shield,
      color: 'text-risda-orange',
      bg: 'bg-risda-orange/10',
      description: 'Penguasa penuh sistem dengan kawalan mutlak ke atas konfigurasi, kakitangan, dan integriti data sebut harga seluruh negara.',
      tasks: [
        'Urus Kakitangan & Peringkat Akses',
        'Kawalan Kawasan & Stesen RISDA',
        'Urus Iklan Sebut Harga (Global)',
        'Pemantauan Kehadiran Real-time',
        'Analisis Data & Pelaporan Penuh'
      ]
    },
    {
      title: 'Penginput Data',
      roleKey: 'Input Staff',
      icon: UserPlus,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      description: 'Penggerak utama operasi di peringkat pejabat yang bertanggungjawab mendaftar dan menyelenggara data harian sistem.',
      tasks: [
        'Akses Iklan & Status Sebut Harga',
        'Daftar Kehadiran Manual Kontraktor',
        'Urus Rekod Kehadiran Pejabat Sendiri',
        'Validasi Kehadiran Fizikal di Tapak'
      ]
    },
    {
      title: 'Pegawai Pelulus',
      roleKey: 'Approver',
      icon: FileCheck,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
      description: 'Penjaga integriti yang memantau dan mengesahkan ketelusan setiap pendaftaran tapak di peringkat pentadbiran pejabat.',
      tasks: [
        'Semak & Sahkan Senarai Kehadiran',
        'Pantau Status Tender Pejabat Sendiri',
        'Validasi Integriti Data Pendaftaran',
        'Akses Laporan Operasi Pejabat'
      ]
    }
  ];

  return (
    <div className="space-y-12 p-8 lg:max-w-none w-full pb-20">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 mb-10"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-risda-orange/10 border border-risda-orange/20 rounded-full w-fit mb-2">
          <Shield size={14} className="text-risda-orange" />
          <span className="text-[10px] font-black text-risda-orange uppercase tracking-[2px]">Struktur Peranan</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl lg:text-6xl font-black text-white uppercase tracking-tight leading-none">Info Pengguna</h2>
          <p className="text-base lg:text-lg text-white/70 font-medium max-w-3xl leading-relaxed">
            <span className="font-poppins font-bold">SMART LOG PEROLEHAN</span> menggunakan model kawalan akses berasaskan peranan (RBAC) untuk memastikan integriti dan keselamatan data pendaftaran tapak sebut harga RISDA.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {roles.map((role, idx) => (
          <motion.div 
            key={role.title}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass-card p-10 rounded-[40px] border border-white/10 bg-gradient-to-br from-risda-card to-black hover:border-risda-orange/30 transition-all group relative overflow-hidden shadow-2xl"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-risda-orange/10 blur-[50px] pointer-events-none group-hover:bg-risda-orange/20 transition-all" />
            
            <div className={`${role.bg} ${role.color} w-20 h-20 rounded-[28px] flex items-center justify-center mb-8 border border-white/10 group-hover:scale-110 transition-transform shadow-2xl`}>
              <role.icon size={40} />
            </div>

            <div className="space-y-2 mb-6">
              <span className={`text-xs font-black uppercase tracking-[4px] ${role.color}`}>{role.roleKey}</span>
              <h3 className="text-3xl font-black text-white uppercase tracking-tight leading-none">{role.title}</h3>
            </div>

            <div className="bg-white/5 rounded-2xl p-6 mb-10 border border-white/5">
              <p className="text-sm lg:text-base text-white/90 leading-relaxed font-semibold italic">
                "{role.description}"
              </p>
            </div>

            <div className="space-y-5">
               <h4 className="text-[10px] font-black text-white/40 border-b border-white/10 pb-2 uppercase tracking-[5px] mb-6">Tugasan & Tanggungjawab:</h4>
               {role.tasks.map((task, i) => (
                 <div key={i} className="flex gap-4 items-start group/task">
                   <div className="w-2.5 h-2.5 bg-risda-gold rounded-full mt-1.5 shrink-0 shadow-[0_0_15px_rgba(255,215,0,0.6)] group-hover/task:scale-125 transition-transform" />
                   <span className="text-sm font-bold text-white/80 leading-snug group-hover/task:text-white transition-colors">{task}</span>
                 </div>
               ))}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-10 pt-10 border-t border-white/5 text-center"
      >
        <p className="text-[10px] text-risda-muted font-black uppercase tracking-[5px] opacity-30">
          Digital Transformation Taskforce © 2024 RISDA Digital Ecosystem
        </p>
      </motion.div>
    </div>
  );
}
