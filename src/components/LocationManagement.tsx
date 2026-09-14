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
  address?: string;
  postcode?: string;
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
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
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
            (loc.station || loc.address || '').toLowerCase().includes(qLower) ||
            (loc.postcode || '').toLowerCase().includes(qLower)
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
          address,
          postcode,
          station: address,
          status,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else {
        await addDoc(collection(db, 'locations'), {
          state,
          district,
          office,
          address,
          postcode,
          station: address,
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
    setAddress('');
    setPostcode('');
    setStatus('Aktif');
    setShowModal(false);
  };

  const handleEdit = (loc: LocationItem) => {
    setEditingId(loc.id);
    setState(loc.state);
    setDistrict(loc.district);
    setOffice(loc.office);
    setAddress(loc.address || loc.station || '');
    setPostcode(loc.postcode || '');
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
      (loc.address || loc.station || '').toLowerCase().includes(qLower) ||
      (loc.postcode || '').toLowerCase().includes(qLower)
    );
  });

  return (
    <div className="space-y-16 p-4 md:p-8 w-full lg:max-w-none">
      {/* Header Section */}
      <div className="bg-risda-card border border-risda-border rounded-2xl md:rounded-[24px] p-6 md:p-8 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-risda-orange rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
              <MapPin size={28} />
            </div>
            <div>
              <p className="text-[10px] text-risda-orange font-black uppercase tracking-[6px] mb-1">Konfigurasi Sistem</p>
              <h2 className="text-2xl md:text-3xl font-black text-risda-text uppercase tracking-tight leading-none">Urus Kawasan</h2>
              <p className="text-[10px] text-risda-muted font-bold uppercase tracking-[3px] mt-1.5">
                Tetapkan Struktur Negeri, Daerah Dan Pejabat RISDA
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-risda-orange text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-risda-orange-hover active:scale-95 transition-all shadow-md group cursor-pointer self-start md:self-auto"
        >
          <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
          <span>Tambah Kawasan Baru</span>
        </button>
      </div>

      {/* Search / Filter Section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-xs font-black uppercase tracking-wider text-risda-text">
            Pejabat & Kawasan Berdaftar <span className="text-risda-orange ml-1">({filteredLocations.length} Rekod)</span>
          </div>

          <div className="relative flex-1 max-w-md group w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-risda-muted group-focus-within:text-risda-orange transition-colors" size={16} />
            <input 
              type="text"
              placeholder="CARI NEGERI, DAERAH, ATAU PEJABAT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-risda-card border border-risda-border rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-risda-text uppercase focus:outline-none focus:border-risda-orange focus:ring-1 focus:ring-risda-orange transition-all placeholder:text-risda-muted tracking-wider shadow-sm"
            />
          </div>
        </div>

        {/* Dynamic State Folders Container */}
        <div className="w-full">
          <AnimatePresence mode="popLayout">
            {fetching ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="h-28 bg-risda-card border border-risda-border animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="w-full text-center py-20 border border-dashed border-risda-border rounded-3xl flex flex-col items-center justify-center gap-4 bg-risda-card">
                <div className="w-16 h-16 bg-risda-card-muted rounded-2xl flex items-center justify-center border border-risda-border text-risda-muted">
                  <MapPin size={32} />
                </div>
                <p className="font-bold text-xs uppercase tracking-wider text-risda-text">Tiada Rekod Kawasan Ditemui</p>
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
                        className="border border-risda-border bg-risda-card rounded-3xl overflow-hidden transition-all duration-300 hover:border-risda-orange/60 shadow-sm"
                      >
                        {/* State Group Folder Header */}
                        <button
                          type="button"
                          onClick={() => toggleStateExpand(stateName)}
                          className="w-full flex items-center justify-between p-5 md:p-6 bg-risda-card-muted/80 hover:bg-risda-card-muted transition-all duration-300 select-none text-left cursor-pointer group border-b border-risda-border"
                        >
                          <div className="flex items-center gap-4 md:gap-5">
                            <div className={`p-3.5 md:p-4 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0 ${
                              isExpanded 
                                ? 'bg-risda-orange text-white shadow-md scale-105' 
                                : 'bg-risda-card text-risda-text border border-risda-border group-hover:bg-risda-orange group-hover:text-white'
                            }`}>
                              {isExpanded ? <FolderOpen size={24} /> : <Folder size={24} />}
                            </div>
                            <div>
                              <h3 className="text-base md:text-lg font-black text-risda-text tracking-wider uppercase group-hover:text-risda-orange transition-colors">
                                NEGERI {stateName}
                              </h3>
                              <div className="flex items-center gap-2.5 mt-1.5">
                                <span className="text-[10px] font-black uppercase text-risda-text-secondary tracking-widest bg-risda-card px-2.5 py-1 rounded-lg border border-risda-border">
                                  {totalCount} Pejabat Berdaftar
                                </span>
                                {activeCount !== totalCount && (
                                  <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest bg-emerald-500/15 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                                    {activeCount} Aktif
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="hidden md:inline text-[10px] font-black tracking-[2px] uppercase text-risda-muted group-hover:text-risda-text transition-colors">
                              {isExpanded ? 'TUTUP FOLDER' : 'BUKA FOLDER'}
                            </span>
                            <div className={`p-2.5 rounded-xl bg-risda-card text-risda-text group-hover:bg-risda-orange group-hover:text-white border border-risda-border transition-transform duration-300 ${
                              isExpanded ? 'rotate-180 text-risda-orange border-risda-orange/40' : ''
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
                              className="border-t border-risda-border bg-risda-card-muted/30 p-5 md:p-7"
                            >
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
                                {itemsUnderState.map((loc) => (
                                  <motion.div 
                                    key={loc.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    className="h-full flex flex-col justify-between p-5 md:p-6 bg-risda-card hover:bg-risda-card-muted/50 border border-risda-border hover:border-risda-orange/50 rounded-2xl group/item relative transition-all duration-300 shadow-sm overflow-hidden"
                                  >
                                    {/* Card Header: Icon, Status, Office Name & Actions */}
                                    <div className="flex items-start justify-between gap-3 relative z-10">
                                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                        <div className="w-11 h-11 bg-risda-orange/15 rounded-xl flex items-center justify-center text-risda-orange border border-risda-orange/30 shrink-0 shadow-sm group-hover/item:scale-105 transition-transform duration-300">
                                          <Building2 size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shadow-sm ${
                                              loc.status === 'Tidak Aktif' 
                                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30' 
                                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                            }`}>
                                              {loc.status || 'Aktif'}
                                            </span>
                                          </div>
                                          <h4 className="text-sm md:text-base font-black text-risda-text uppercase tracking-wider leading-snug group-hover/item:text-risda-orange transition-colors line-clamp-2 min-h-[2.5rem] flex items-center">
                                            {loc.office}
                                          </h4>
                                        </div>
                                      </div>
                                      
                                      {/* Action Buttons */}
                                      <div className="flex items-center gap-1.5 shrink-0 bg-risda-card-muted p-1 rounded-xl border border-risda-border">
                                        <button 
                                          type="button"
                                          onClick={() => handleEdit(loc)}
                                          className="p-2 text-risda-muted hover:text-risda-text hover:bg-risda-card rounded-lg transition-all border border-transparent hover:border-risda-border cursor-pointer"
                                          title="Kemaskini"
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => handleDelete(loc.id)}
                                          className="p-2 text-risda-muted hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all border border-transparent hover:border-rose-500/20 cursor-pointer"
                                          title="Padam"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Card Middle: Structured Address Box (Equal height ensures parallel alignment) */}
                                    <div className="my-3.5 p-3 rounded-xl bg-risda-card-muted border border-risda-border flex flex-col justify-center min-h-[72px] relative z-10">
                                      {(loc.address || loc.station) ? (
                                        <div className="space-y-1">
                                          <div className="flex items-start gap-2">
                                            <MapPin size={13} className="text-risda-orange shrink-0 mt-0.5" />
                                            <p className="text-[11px] font-medium text-risda-text uppercase leading-snug line-clamp-2">
                                              {loc.address || loc.station}
                                            </p>
                                          </div>
                                          {loc.postcode && (
                                            <div className="flex items-center gap-1.5 pl-5">
                                              <span className="text-[9px] font-bold text-risda-orange tracking-wider">POSKOD:</span>
                                              <span className="text-[10px] font-black text-risda-text tracking-widest bg-risda-card px-1.5 py-0.5 rounded border border-risda-border">
                                                {loc.postcode}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2 text-risda-muted text-[11px] font-medium italic">
                                          <MapPin size={14} className="opacity-35 shrink-0" />
                                          <span>Alamat belum didaftarkan</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Card Footer: District & State metadata */}
                                    <div className="mt-auto pt-3 border-t border-risda-border flex items-center justify-between text-xs relative z-10">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-risda-orange shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                                        <span className="text-[11px] font-black text-risda-text uppercase tracking-widest">
                                          DAERAH {loc.district}
                                        </span>
                                      </div>
                                      <span className="text-[9px] font-black text-risda-text-secondary uppercase tracking-widest bg-risda-card-muted px-2.5 py-1 rounded-md border border-risda-border">
                                        {loc.state}
                                      </span>
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
              className="relative w-full max-w-xl bg-risda-card border border-risda-border rounded-[32px] shadow-2xl overflow-hidden text-risda-text"
            >
              {/* Modal Header */}
              <div className="bg-risda-card-muted p-6 md:p-8 border-b border-risda-border flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-risda-text uppercase tracking-tight">
                    {editingId ? 'Kemaskini Kawasan' : 'Daftar Kawasan Baru'}
                  </h3>
                  <p className="text-[10px] text-risda-muted font-bold uppercase tracking-[2px]">Masukkan Maklumat Struktur RISDA Daerah / Pejabat</p>
                </div>
                <button 
                  onClick={resetForm}
                  className="p-2.5 bg-risda-card hover:bg-risda-card-muted rounded-xl text-risda-muted hover:text-risda-text transition-all border border-risda-border cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleAdd} className="p-6 md:p-8 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[2.5px] ml-1">Negeri</label>
                  <div className="relative">
                    <select 
                      value={state || ''}
                      onChange={(e) => {
                        setState(e.target.value);
                        setDistrict('');
                      }}
                      className="w-full bg-risda-card border border-risda-border rounded-xl py-3.5 px-5 text-xs text-risda-text focus:border-risda-orange outline-none transition-all appearance-none cursor-pointer"
                      required
                    >
                      <option value="" className="bg-risda-card text-risda-muted">PILIH NEGERI</option>
                      <option value="SABAH" className="bg-risda-card">SABAH</option>
                      <option value="SARAWAK" className="bg-risda-card">SARAWAK</option>
                      <option value="SELANGOR" className="bg-risda-card">SELANGOR</option>
                      <option value="PERAK" className="bg-risda-card">PERAK</option>
                      <option value="JOHOR" className="bg-risda-card">JOHOR</option>
                      <option value="KEDAH" className="bg-risda-card">KEDAH</option>
                      <option value="KELANTAN" className="bg-risda-card">KELANTAN</option>
                      <option value="MELAKA" className="bg-risda-card">MELAKA</option>
                      <option value="NEGERI SEMBILAN" className="bg-risda-card">NEGERI SEMBILAN</option>
                      <option value="PAHANG" className="bg-risda-card">PAHANG</option>
                      <option value="PULAU PINANG" className="bg-risda-card">PULAU PINANG</option>
                      <option value="PERLIS" className="bg-risda-card">PERLIS</option>
                      <option value="TERENGGANU" className="bg-risda-card">TERENGGANU</option>
                      <option value="KUALA LUMPUR" className="bg-risda-card">KUALA LUMPUR</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 text-risda-muted">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[2.5px] ml-1">Daerah</label>
                  <div className="relative">
                    <select 
                      value={district || ''}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full bg-risda-card border border-risda-border rounded-xl py-3.5 px-5 text-xs text-risda-text focus:border-risda-orange outline-none transition-all appearance-none cursor-pointer"
                      required
                      disabled={!state}
                    >
                      <option value="" className="bg-risda-card text-risda-muted">
                        {!state ? 'SILA PILIH NEGERI TERDAHULU' : 'PILIH DAERAH'}
                      </option>
                      {state && MALAYSIA_DISTRICTS[state]?.map((d) => (
                        <option key={d} value={d} className="bg-risda-card">
                          {d}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 text-risda-muted">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[2.5px] ml-1">Pejabat RISDA</label>
                  <input 
                    value={office || ''}
                    onChange={(e) => setOffice(e.target.value)}
                    placeholder="cth: PEJABAT RISDA DAERAH BEAUFORT"
                    className="w-full bg-risda-card border border-risda-border rounded-xl py-3.5 px-5 text-xs text-risda-text focus:border-risda-orange outline-none transition-all placeholder:text-risda-muted uppercase tracking-wider"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[2.5px] ml-1">Alamat Pejabat</label>
                  <textarea 
                    value={address || ''}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="CTH: K77 DAN K78, BLOK K, BEAUFORT SQUARE AVENUE 1, BEAUFORT, SABAH"
                    className="w-full bg-risda-card border border-risda-border rounded-xl py-3.5 px-5 text-xs text-risda-text focus:border-risda-orange outline-none transition-all placeholder:text-risda-muted uppercase tracking-wider min-h-[80px]"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[2.5px] ml-1">Poskod</label>
                  <input 
                    type="text"
                    maxLength={5}
                    value={postcode || ''}
                    onChange={(e) => setPostcode(e.target.value.replace(/\D/g, ''))}
                    placeholder="CTH: 89800"
                    className="w-full bg-risda-card border border-risda-border rounded-xl py-3.5 px-5 text-xs text-risda-text focus:border-risda-orange outline-none transition-all placeholder:text-risda-muted tracking-widest"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-risda-orange uppercase tracking-[2.5px] ml-1">Status Pejabat</label>
                  <div className="relative">
                    <select 
                      value={status || 'Aktif'}
                      onChange={(e: any) => setStatus(e.target.value)}
                      className="w-full bg-risda-card border border-risda-border rounded-xl py-3.5 px-5 text-xs text-risda-text focus:border-risda-orange outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="Aktif" className="bg-risda-card">AKTIF</option>
                      <option value="Tidak Aktif" className="bg-risda-card">TIDAK AKTIF</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 text-risda-muted">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-6 border-t border-risda-border flex gap-4">
                  <button 
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-3.5 bg-risda-card-muted hover:bg-risda-border text-risda-text rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-risda-border cursor-pointer"
                  >
                    BATAL
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-3.5 bg-risda-orange hover:bg-risda-orange/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.01] active:scale-95 transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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
