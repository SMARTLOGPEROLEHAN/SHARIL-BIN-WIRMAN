import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, setDoc } from 'firebase/firestore';
import { MapPin, Plus, Trash2, Building2, Edit2, AlertCircle, X, Search, Folder, FolderOpen, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

interface LocationItem {
  id: string;
  state: string;
  district: string;
  office: string;
  station?: string;
  status: 'Aktif' | 'Tidak Aktif';
  createdAt: any;
}


const MALAYSIA_DISTRICTS: Record<string, string[]> = {
  SABAH: [
    'BEAUFORT',
    'BELURAN',
    'KENINGAU',
    'KINABATANGAN',
    'KOTA BELUD',
    'KOTA MARUDU',
    'KOTA KINABALU',
    'KUDAT',
    'KUNAK',
    'LAHAD DATU',
    'NABAWAN',
    'PAPAR',
    'PENAMPANG',
    'PITAS',
    'RANAU',
    'SANDAKAN',
    'SEMPORNA',
    'SIPITANG',
    'TAMBUNAN',
    'TAWAU',
    'TENOM',
    'TONGOD',
    'TUARAN',
    'KUALA PENYU',
    'PUTATAN',
    'KALABAKAN',
    'TELUPID'
  ].sort(),
  SARAWAK: [
    'KUCHING',
    'MIRI',
    'SIBU',
    'BINTULU',
    'SAMARAHAN',
    'SRI AMAN',
    'SARIKEI',
    'BETONG',
    'MUKAH',
    'LIMBANG',
    'KAPIT',
    'LAWAS',
    'BAU',
    'BELAGA',
    'KANOWIT',
    'LUBOK ANTU',
    'MARUDI',
    'SERIAN',
    'LUNDU',
    'TATAU',
    'SONG',
    'SARATOK',
    'SIMUNJAN',
    'ASAJAYA',
    'DARO',
    'DALAT',
    'SELANGAU',
    'JULAU',
    'PAKAN',
    'KABONG',
    'TELANG USAN',
    'SUBIS',
    'BELURU',
    'SEBAUH',
    'MATU',
    'TANJONG MANIS',
    'PUSA'
  ].sort(),
  SELANGOR: [
    'GOMBAK',
    'HULU LANGAT',
    'HULU SELANGOR',
    'KLANG',
    'KUALA LANGAT',
    'KUALA SELANGOR',
    'PETALING',
    'SABAK BERNAM',
    'SEPANG'
  ].sort(),
  PERAK: [
    'BAGAN DATUK',
    'BATANG PADANG',
    'HILIR PERAK',
    'HULU PERAK',
    'KAMPAR',
    'KERIAN',
    'KINTA',
    'KUALA KANGSAR',
    'LARUT, MATANG DAN SELAMA',
    'MANJUNG',
    'MUALLIM',
    'PERAK TENGAH'
  ].sort(),
  JOHOR: [
    'JOHOR BAHRU',
    'BATU PAHAT',
    'KLUANG',
    'KOTA TINGGI',
    'KULAI',
    'MERSING',
    'MUAR',
    'PONTIAN',
    'SEGAMAT',
    'TANGKAK'
  ].sort(),
  KEDAH: [
    'BALING',
    'BANDAR BAHARU',
    'KOTA SETAR',
    'KUALA MUDA',
    'KUBANG PASU',
    'KULIM',
    'LANGKAWI',
    'PADANG TERAP',
    'PENDANG',
    'POKOK SENA',
    'SIK',
    'YAN'
  ].sort(),
  KELANTAN: [
    'BACHOK',
    'GUA MUSANG',
    'JELI',
    'KOTA BHARU',
    'KUALA KRAI',
    'MACHANG',
    'PASIR MAS',
    'PASIR PUTEH',
    'TANAH MERAH',
    'TUMPAT'
  ].sort(),
  MELAKA: [
    'ALOR GAJAH',
    'JASIN',
    'MELAKA TENGAH'
  ].sort(),
  'NEGERI SEMBILAN': [
    'JELEBU',
    'JEMPOL',
    'KUALA PILAH',
    'PORT DICKSON',
    'REMBAU',
    'SEREMBAN',
    'TAMPIN'
  ].sort(),
  PAHANG: [
    'BERA',
    'BENTONG',
    'CAMERON HIGHLANDS',
    'JERANTUT',
    'KUANTAN',
    'LIPIS',
    'MARAN',
    'PEKAN',
    'RAUB',
    'ROMPIN',
    'TEMERLOH'
  ].sort(),
  'PULAU PINANG': [
    'SEBERANG PERAI UTARA',
    'SEBERANG PERAI TENGAH',
    'SEBERANG PERAI SELATAN',
    'TIMUR LAUT',
    'BARAT DAYA'
  ].sort(),
  PERLIS: [
    'KANGAR',
    'ARAU',
    'PADANG BESAR'
  ].sort(),
  TERENGGANU: [
    'BESUT',
    'DUNGUN',
    'HULU TERENGGANU',
    'KEMAMAN',
    'KUALA NERUS',
    'KUALA TERENGGANU',
    'MARANG',
    'SETIU'
  ].sort(),
  'KUALA LUMPUR': [
    'KUALA LUMPUR',
    'CHERAS',
    'KEPONG',
    'SENTUL',
    'SETIAWANGSA',
    'TITIWANGSA',
    'WANGSA MAJU',
    'SEGAMBUT',
    'LEMBAH PANTAI',
    'SEPUTEH',
    'BANDAR TUN RAZAK'
  ].sort()
};

export default function LocationManagement() {
  const { role: currentUserRole } = useAuth();
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [office, setOffice] = useState('');
  const [station, setStation] = useState('');
  const [status, setStatus] = useState<'Aktif' | 'Tidak Aktif'>('Aktif');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchLocations();
  }, []);

  // Auto-expand states when searching or when locations update
  useEffect(() => {
    if (searchQuery.trim() !== '') {
      const qLower = searchQuery.toLowerCase();
      const uniqueStates = Array.from(new Set<string>(
        locations
          .filter(loc => 
            loc.state?.toLowerCase().includes(qLower) ||
            loc.district?.toLowerCase().includes(qLower) ||
            loc.office?.toLowerCase().includes(qLower) ||
            loc.station?.toLowerCase().includes(qLower)
          )
          .map(loc => loc.state || 'LAIN-LAIN')
      ));
      
      const autoExpand: Record<string, boolean> = {};
      uniqueStates.forEach(stateName => {
        autoExpand[stateName] = true;
      });
      setExpandedStates(autoExpand);
    }
  }, [searchQuery, locations]);

  const fetchLocations = async () => {
    try {
      const q = query(collection(db, 'locations'), orderBy('office'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LocationItem));
      setLocations(list);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast.error('Gagal memuatkan senarai kawasan.');
    } finally {
      setFetching(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state || !district || !office) return;
    setLoading(true);
    try {
      console.log('Saving location...', { editingId, office });
      if (editingId) {
        await setDoc(doc(db, 'locations', editingId), {
          state,
          district,
          office,
          station,
          status,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else {
        await addDoc(collection(db, 'locations'), {
          state,
          district,
          office,
          station,
          status,
          createdAt: new Date().toISOString()
        });
      }
      resetForm();
      fetchLocations();
      toast.success(editingId ? 'Data kawasan telah dikemaskini!' : 'Kawasan baru telah berjaya disimpan!');
    } catch (error) {
      console.error('Error saving location:', error);
      handleFirestoreError(error, OperationType.WRITE, `locations/${editingId || 'new'}`);
      toast.error('Gagal menyimpan data kawasan.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setState('');
    setDistrict('');
    setOffice('');
    setStation('');
    setStatus('Aktif');
    setShowModal(false);
  };

  const handleEdit = (loc: LocationItem) => {
    setEditingId(loc.id);
    setState(loc.state);
    setDistrict(loc.district);
    setOffice(loc.office);
    setStation(loc.station || '');
    setStatus(loc.status || 'Aktif');
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Adakah anda pasti untuk padam rekod kawasan ini?')) return;
    
    console.log('Attempting to delete location:', id);
    const loadingToast = toast.loading('Memadam kawasan...');
    try {
      await deleteDoc(doc(db, 'locations', id));
      setLocations(prev => prev.filter(l => l.id !== id));
      toast.success('Rekod kawasan telah dipadam.', { id: loadingToast });
    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error('Gagal memadam rekod (Akses Denied).', { id: loadingToast });
      try {
        handleFirestoreError(error, OperationType.DELETE, `locations/${id}`);
      } catch (e) {
        console.error('Detailed Error:', e);
      }
    }
  };

  const isStaff = currentUserRole === 'penginput' || currentUserRole === 'pelulus' || currentUserRole === 'admin' || currentUserRole === 'pentadbir';

  if (!isStaff) {
    return <div className="p-20 text-center text-risda-muted font-black uppercase tracking-[4px]">Akses Terhad.</div>;
  }

  const filteredLocations = locations.filter(loc => {
    const qLower = searchQuery.toLowerCase();
    return (
      loc.state?.toLowerCase().includes(qLower) ||
      loc.district?.toLowerCase().includes(qLower) ||
      loc.office?.toLowerCase().includes(qLower) ||
      loc.station?.toLowerCase().includes(qLower)
    );
  });

  return (
    <div className="space-y-16 p-4 md:p-8 w-full lg:max-w-none">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
             <div className="p-4 bg-risda-orange/10 rounded-2xl text-risda-orange border border-risda-orange/20">
               <MapPin size={28} />
             </div>
             <div>
               <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight leading-none mb-1">Urus Kawasan</h2>
               <p className="text-[10px] md:text-xs text-risda-muted font-bold uppercase tracking-[4px] opacity-60">Tetapkan struktur Negeri, Daerah dan Pejabat RISDA</p>
             </div>
          </div>
        </div>

        <button 
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center justify-center gap-4 px-10 py-5 bg-risda-orange text-black rounded-2xl text-xs font-black uppercase tracking-[2px] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-risda-orange/30 group animate-fade-in"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
          Tambah Kawasan Baru
        </button>
      </div>

      {/* Search / Filter Section */}
      <div className="space-y-12">
        <div className="flex flex-col xl:flex-row items-end justify-between gap-10">
          <div className="text-sm font-black uppercase tracking-[4px] text-white">
            Pejabat & Kawasan Berdaftar <span className="text-risda-orange ml-2">({filteredLocations.length} Rekod)</span>
          </div>

          <div className="relative flex-1 max-w-xl group w-full">
            <Search className="absolute left-1 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-risda-orange transition-colors" size={18} />
            <input 
              type="text"
              placeholder="CARI NEGERI, DAERAH, ATAU PEJABAT RISDA..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-b-2 border-white/10 rounded-none py-4 pl-10 pr-4 text-xs font-black text-white uppercase focus:border-risda-orange outline-none transition-all placeholder:text-white/10 tracking-widest"
            />
          </div>
        </div>

        {/* Dynamic State Folders Container */}
        <div className="w-full">
          <AnimatePresence mode="popLayout">
            {fetching ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="h-32 bg-white/5 animate-pulse rounded-3xl" />
                ))}
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="w-full text-center py-32 border border-dashed border-white/10 rounded-[48px] flex flex-col items-center justify-center gap-6 bg-white/5">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center ring-1 ring-white/10">
                  <MapPin size={40} className="text-white/10" />
                </div>
                <p className="font-black uppercase text-[10px] tracking-[6px] text-white/30">Tiada Rekod Kawasan Ditemui</p>
              </div>
            ) : (
              <div className="space-y-6 w-full">
                {(() => {
                  // Group filtered locations by state
                  const groupedByState = filteredLocations.reduce((acc, loc) => {
                    const stateName = loc.state || 'LAIN-LAIN';
                    if (!acc[stateName]) {
                      acc[stateName] = [];
                    }
                    acc[stateName].push(loc);
                    return acc;
                  }, {} as Record<string, LocationItem[]>);

                  // Get sorted list of states
                  const sortedStates = Object.keys(groupedByState).sort((a, b) => a.localeCompare(b));

                  const toggleStateExpand = (stateName: string) => {
                    setExpandedStates(prev => ({
                      ...prev,
                      [stateName]: !prev[stateName]
                    }));
                  };

                  return sortedStates.map((stateName) => {
                    const itemsUnderState = groupedByState[stateName];
                    const isExpanded = !!expandedStates[stateName];
                    const totalCount = itemsUnderState.length;
                    const activeCount = itemsUnderState.filter(item => item.status !== 'Tidak Aktif').length;

                    return (
                      <motion.div 
                        key={stateName} 
                        layout="position"
                        className="border border-white/5 bg-white/[0.01] rounded-[32px] overflow-hidden transition-all duration-300 hover:border-white/10 shadow-lg shadow-black/20"
                      >
                        {/* State Group Folder Header */}
                        <button
                          type="button"
                          onClick={() => toggleStateExpand(stateName)}
                          className="w-full flex items-center justify-between p-6 md:p-8 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300 select-none text-left cursor-pointer group"
                        >
                          <div className="flex items-center gap-5">
                            <div className={`p-4 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0 ${
                              isExpanded 
                                ? 'bg-risda-orange/15 text-risda-orange border border-risda-orange/20 shadow-lg shadow-risda-orange/5 scale-105' 
                                : 'bg-white/5 text-white/40 border border-white/5 group-hover:bg-white/10 group-hover:text-white/75'
                            }`}>
                              {isExpanded ? <FolderOpen size={24} /> : <Folder size={24} />}
                            </div>
                            <div>
                              <h3 className="text-base md:text-lg font-black text-white tracking-wider uppercase group-hover:text-risda-orange transition-colors">
                                NEGERI {stateName}
                              </h3>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[10px] font-black uppercase text-risda-muted tracking-widest bg-white/5 px-2.5 py-1 rounded-lg">
                                  {totalCount} Pejabat Berdaftar
                                </span>
                                {activeCount !== totalCount && (
                                  <span className="text-[10px] font-black uppercase text-green-500 tracking-widest bg-green-500/10 px-2.5 py-1 rounded-lg">
                                    {activeCount} Aktif
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="hidden md:inline text-[9px] font-black tracking-[2px] uppercase text-risda-muted opacity-45 group-hover:opacity-100 transition-opacity">
                              {isExpanded ? 'TUTUP FOLDER' : 'BUKA FOLDER'}
                            </span>
                            <div className={`p-2.5 rounded-xl bg-white/5 text-white/50 group-hover:bg-white/10 group-hover:text-white transition-transform duration-300 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}>
                              <ChevronDown size={18} />
                            </div>
                          </div>
                        </button>

                        {/* Folder Content / Collapsible Container */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25, ease: 'easeInOut' }}
                              className="border-t border-white/5 bg-black/15 p-6 md:p-8"
                            >
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {itemsUnderState.map((loc) => (
                                  <motion.div 
                                    key={loc.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="p-6 border border-white/5 bg-white/[0.02] rounded-3xl group/item relative hover:border-risda-orange/30 transition-all duration-500 overflow-hidden"
                                  >
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-risda-orange/5 blur-[80px] -mr-24 -mt-24 opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none" />
                                    
                                    <div className="flex items-start justify-between gap-5 relative z-10">
                                      <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-risda-orange/10 rounded-2xl flex items-center justify-center text-risda-orange border border-risda-orange/20 shrink-0 group-hover/item:scale-110 transition-transform duration-300">
                                          <Building2 size={22} />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-3 mb-2">
                                            <h4 className="text-base font-black text-white uppercase tracking-wider leading-none group-hover/item:text-risda-orange transition-colors">
                                              {loc.office}
                                            </h4>
                                            <span className={`px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm ${
                                              loc.status === 'Tidak Aktif' 
                                                ? 'bg-red-500/10 text-red-500 border border-red-500/10' 
                                                : 'bg-green-500/10 text-green-500 border border-green-500/10'
                                            }`}>
                                              {loc.status || 'Aktif'}
                                            </span>
                                          </div>
                                          
                                          {loc.station && (
                                            <p className="text-[10px] font-bold text-risda-gold uppercase tracking-[1px] mb-3">
                                              Stesen: {loc.station}
                                            </p>
                                          )}

                                          <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                                            <span className="text-[11px] font-black text-white/50 uppercase tracking-[1.5px]">{loc.district}</span>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="flex gap-1.5 shrink-0">
                                        <button 
                                          type="button"
                                          onClick={() => handleEdit(loc)}
                                          className="p-2.5 bg-white/5 hover:bg-white/10 text-white/30 hover:text-white rounded-xl transition-all border border-white/5 cursor-pointer"
                                          title="Kemaskini"
                                        >
                                          <Edit2 size={14} />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => handleDelete(loc.id)}
                                          className="p-2.5 bg-white/5 hover:bg-red-500/10 text-white/30 hover:text-red-500 rounded-xl transition-all border border-white/5 cursor-pointer"
                                          title="Padam"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  });
                })()}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modal Form Overlay */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetForm}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-risda-card border border-white/5 rounded-[48px] shadow-2xl overflow-hidden shadow-black/80"
            >
              {/* Modal Header */}
              <div className="bg-black/40 p-8 border-b border-white/5 flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">
                    {editingId ? 'Kemaskini Kawasan' : 'Daftar Kawasan Baru'}
                  </h3>
                  <p className="text-[10px] text-risda-muted font-bold uppercase tracking-[2px]">Masukkan Maklumat Struktur RISDA Daerah / Pejabat</p>
                </div>
                <button 
                  onClick={resetForm}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white/50 hover:text-white transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleAdd} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Negeri</label>
                  <div className="relative">
                    <select 
                      value={state || ''}
                      onChange={(e) => {
                        setState(e.target.value);
                        setDistrict('');
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all appearance-none cursor-pointer"
                      required
                    >
                      <option value="" className="bg-risda-dark text-white/40">PILIH NEGERI</option>
                      <option value="SABAH" className="bg-risda-dark">SABAH</option>
                      <option value="SARAWAK" className="bg-risda-dark">SARAWAK</option>
                      <option value="SELANGOR" className="bg-risda-dark">SELANGOR</option>
                      <option value="PERAK" className="bg-risda-dark">PERAK</option>
                      <option value="JOHOR" className="bg-risda-dark">JOHOR</option>
                      <option value="KEDAH" className="bg-risda-dark">KEDAH</option>
                      <option value="KELANTAN" className="bg-risda-dark">KELANTAN</option>
                      <option value="MELAKA" className="bg-risda-dark">MELAKA</option>
                      <option value="NEGERI SEMBILAN" className="bg-risda-dark">NEGERI SEMBILAN</option>
                      <option value="PAHANG" className="bg-risda-dark">PAHANG</option>
                      <option value="PULAU PINANG" className="bg-risda-dark">PULAU PINANG</option>
                      <option value="PERLIS" className="bg-risda-dark">PERLIS</option>
                      <option value="TERENGGANU" className="bg-risda-dark">TERENGGANU</option>
                      <option value="KUALA LUMPUR" className="bg-risda-dark">KUALA LUMPUR</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Daerah</label>
                  <div className="relative">
                    <select 
                      value={district || ''}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all appearance-none cursor-pointer"
                      required
                      disabled={!state}
                    >
                      <option value="" className="bg-risda-dark text-white/40">
                        {!state ? 'SILA PILIH NEGERI TERDAHULU' : 'PILIH DAERAH'}
                      </option>
                      {state && MALAYSIA_DISTRICTS[state]?.map((d) => (
                        <option key={d} value={d} className="bg-risda-dark">
                          {d}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Pejabat RISDA</label>
                  <input 
                    value={office || ''}
                    onChange={(e) => setOffice(e.target.value)}
                    placeholder="cth: PEJABAT RISDA DAERAH BEAUFORT"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/15 uppercase tracking-widest"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Stesen (Opsional)</label>
                  <input 
                    value={station || ''}
                    onChange={(e) => setStation(e.target.value)}
                    placeholder="cth: STESEN RISDA BEAUFORT"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/15 uppercase tracking-widest"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Status Pejabat</label>
                  <div className="relative">
                    <select 
                      value={status || 'Aktif'}
                      onChange={(e: any) => setStatus(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="Aktif" className="bg-risda-dark">AKTIF</option>
                      <option value="Tidak Aktif" className="bg-risda-dark">TIDAK AKTIF</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-6 border-t border-white/5 flex gap-4">
                  <button 
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    BATAL
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-4 bg-risda-orange text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-risda-orange/20 flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    {editingId ? 'SIMPAN PERUBAHAN' : 'DAFTAR KAWASAN'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
