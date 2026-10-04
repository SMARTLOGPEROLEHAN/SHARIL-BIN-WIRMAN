import React from 'react';
import { motion } from 'motion/react';
import { Info, Shield, UserPlus, FileCheck, CheckSquare } from 'lucide-react';

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
      roleKey: 'Penginput',
      icon: UserPlus,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      description: 'Penggerak utama operasi di peringkat pejabat yang bertanggungjawab memasukkan draf iklan, draf pelawaan, dan permohonan tawaran terus.',
      tasks: [
        'Daftar & Draf Iklan Sebut Harga',
        'Sedia Draf Surat Pelawaan Sebut Harga',
        'Isi Permohonan Pesanan Tawaran Terus (Jadual Item & BQ)',
        'Daftar Kehadiran Manual Kontraktor di Tapak'
      ]
    },
    {
      title: 'Pegawai Penyemak',
      roleKey: 'Penyemak',
      icon: CheckSquare,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
      description: 'Penyemak teliti yang menyemak iklan, pelawaan dan keputusan sebut harga, serta menyemak kajian pasaran 3 pembekal tawaran terus sebelum dikemukakan kepada Pegawai Pelulus.',
      tasks: [
        'Semak Iklan Sebut Harga Sebelum Dikeluarkan',
        'Semak & Sahkan Senarai Pelawaan Sebut Harga',
        'Semak Cadangan Keputusan & Pemenang Sebut Harga',
        'Pilih 3 Pembekal Kajian Pasaran Tawaran Terus',
        'Tentukan & Syorkan Pembekal Yang Layak Menerima Tawaran Terus'
      ]
    },
    {
      title: 'Pegawai Pelulus',
      roleKey: 'Pelulus',
      icon: FileCheck,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
      description: 'Penjaga integriti dan kuasa melulus yang mengesahkan penerbitan iklan, pengeluaran pelawaan, keputusan sebut harga, dan perolehan tawaran terus.',
      tasks: [
        'Lulus & Terbitkan Iklan Sebut Harga Rasmi',
        'Luluskan Pengeluaran Surat Pelawaan Sebut Harga',
        'Lulus & Muktamadkan Keputusan Pemenang Sebut Harga',
        'Luluskan Permohonan & Pesanan Rasmi Tawaran Terus'
      ]
    }
  ];

  return (
    <div className="space-y-12 p-8 lg:max-w-none w-full pb-20">
      <div className="bg-risda-card border border-risda-border rounded-2xl md:rounded-[24px] p-6 md:p-8 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-risda-orange rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
              <Shield size={28} />
            </div>
            <div>
              <p className="text-[10px] text-risda-orange font-black uppercase tracking-[6px] mb-1">Struktur Peranan</p>
              <h2 className="text-2xl md:text-3xl font-black text-risda-text uppercase tracking-tight leading-none">Info Pengguna</h2>
              <p className="text-[10px] text-risda-muted font-bold uppercase tracking-[3px] mt-1.5">
                Model Kawalan Akses Berasaskan Peranan (RBAC) SMART LOG PEROLEHAN
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {roles.map((role, idx) => (
          <motion.div 
            key={role.title}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="p-6 md:p-8 rounded-3xl border border-risda-border bg-risda-card hover:border-risda-orange/40 transition-all group relative overflow-hidden shadow-sm flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-risda-orange/5 blur-[40px] pointer-events-none group-hover:bg-risda-orange/15 transition-all" />
            
            <div>
              <div className={`${role.bg} ${role.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-risda-border shadow-sm group-hover:scale-105 transition-transform`}>
                <role.icon size={32} />
              </div>

              <div className="space-y-2 mb-6">
                <span className={`text-xs font-black uppercase tracking-widest ${role.color}`}>{role.roleKey}</span>
                <h3 className="text-2xl font-bold text-risda-text uppercase tracking-tight leading-tight">{role.title}</h3>
              </div>

              <div className="bg-risda-card-muted rounded-xl p-5 mb-6 border border-risda-border">
                <p className="text-xs md:text-sm text-risda-text leading-relaxed font-medium italic">
                  "{role.description}"
                </p>
              </div>

              <div className="space-y-4">
                 <h4 className="text-xs font-bold text-risda-orange border-b border-risda-border pb-2 uppercase tracking-wider">Tugasan & Tanggungjawab:</h4>
                 <div className="space-y-3">
                   {role.tasks.map((task, i) => (
                     <div key={i} className="flex gap-3 items-start group/task">
                       <div className="w-2 h-2 bg-risda-orange rounded-full mt-1.5 shrink-0" />
                       <span className="text-xs md:text-sm font-medium text-risda-text leading-snug">{task}</span>
                     </div>
                   ))}
                 </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-10 pt-10 border-t border-risda-border text-center"
      >
        <p className="text-xs text-risda-muted font-bold uppercase tracking-wider">
          Digital Transformation Taskforce © 2024 RISDA Digital Ecosystem
        </p>
      </motion.div>
    </div>
  );
}
