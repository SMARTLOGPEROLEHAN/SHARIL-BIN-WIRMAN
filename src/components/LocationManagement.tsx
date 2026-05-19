import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, setDoc } from 'firebase/firestore';
import { MapPin, Plus, Trash2, Building2, Edit2, AlertCircle } from 'lucide-react';
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

  useEffect(() => {
    fetchLocations();
  }, []);

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
  };

  const handleEdit = (loc: LocationItem) => {
    setEditingId(loc.id);
    setState(loc.state);
    setDistrict(loc.district);
    setOffice(loc.office);
    setStation(loc.station || '');
    setStatus(loc.status || 'Aktif');
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

  return (
    <div className="space-y-16 p-4 md:p-8 w-full lg:max-w-none">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        {/* Form Add */}
        <div className="lg:col-span-4 space-y-10">
          <div className="flex items-center justify-between border-b border-white/10 pb-6">
            <h3 className="text-sm font-black uppercase tracking-[4px] text-risda-orange">
              {editingId ? 'Kemaskini Data' : 'Daftar Kawasan Baru'}
            </h3>
            {editingId && (
              <button onClick={resetForm} className="text-[9px] font-black text-risda-muted hover:text-white uppercase tracking-widest">Batal Edit</button>
            )}
          </div>
          
          <form onSubmit={handleAdd} className="space-y-8">
             <div className="space-y-3">
              <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Negeri</label>
              <div className="relative">
                <select 
                  value={state || ''}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-white/10 rounded-none py-4 px-1 text-[13px] font-black text-white focus:border-risda-orange outline-none transition-all appearance-none cursor-pointer"
                  required
                >
                  <option value="" className="bg-risda-dark">PILIH NEGERI</option>
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
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Daerah</label>
              <input 
                value={district || ''}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="cth: Kota Kinabalu"
                className="w-full bg-transparent border-b-2 border-white/10 rounded-none py-4 px-1 text-[13px] font-black text-white focus:border-risda-orange outline-none transition-all placeholder:text-white/10 uppercase tracking-widest"
                required
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Pejabat RISDA</label>
              <input 
                value={office || ''}
                onChange={(e) => setOffice(e.target.value)}
                placeholder="cth: Pejabat RISDA Negeri Sabah"
                className="w-full bg-transparent border-b-2 border-white/10 rounded-none py-4 px-1 text-[13px] font-black text-white focus:border-risda-orange outline-none transition-all placeholder:text-white/10 uppercase tracking-widest"
                required
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Stesen (Opsional)</label>
              <input 
                value={station || ''}
                onChange={(e) => setStation(e.target.value)}
                placeholder="cth: Stesen RISDA Beaufort"
                className="w-full bg-transparent border-b-2 border-white/10 rounded-none py-4 px-1 text-[13px] font-black text-white focus:border-risda-orange outline-none transition-all placeholder:text-white/10 uppercase tracking-widest"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Status Pejabat</label>
              <div className="relative">
                <select 
                  value={status || 'Aktif'}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-white/10 rounded-none py-4 px-1 text-[13px] font-black text-white focus:border-risda-orange outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="Aktif" className="bg-risda-dark">AKTIF</option>
                  <option value="Tidak Aktif" className="bg-risda-dark">TIDAK AKTIF</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            </div>

            <button 
              disabled={loading}
              className="w-full py-5 bg-risda-orange text-black rounded-2xl text-[11px] font-black uppercase tracking-[3px] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-risda-orange/30 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin mx-auto" />
              ) : editingId ? 'Simpan Perubahan' : 'Daftar Kawasan'}
            </button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-8 space-y-10">
          <div className="flex items-center justify-between border-b border-white/10 pb-6">
            <h3 className="text-sm font-black uppercase tracking-[4px] text-white">Pejabat & Kawasan Berdaftar</h3>
            <span className="text-[10px] font-black text-risda-orange uppercase tracking-widest">{locations.length} JUMLAH REKOD</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
            <AnimatePresence>
              {fetching ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="h-32 bg-white/5 animate-pulse rounded-3xl" />
                ))
              ) : locations.length === 0 ? (
                <div className="col-span-1 text-center py-32 border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center gap-4">
                  <AlertCircle size={48} className="text-white/10" />
                  <p className="text-xs text-risda-muted font-bold uppercase tracking-[5px]">Tiada kawasan didaftarkan.</p>
                </div>
              ) : (
                locations.map((loc) => (
                  <motion.div 
                    key={loc.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-10 border border-white/5 bg-white/[0.02] rounded-[40px] group relative hover:border-risda-orange/30 transition-all duration-500 overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-risda-orange/5 blur-[100px] -mr-32 -mt-32 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    
                    <div className="flex items-start gap-8 relative z-10">
                      <div className="w-16 h-16 bg-risda-orange/10 rounded-[24px] flex items-center justify-center text-risda-orange border border-risda-orange/20 shrink-0 group-hover:scale-110 transition-transform">
                        <Building2 size={32} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-4">
                          <h4 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight leading-none group-hover:text-risda-orange transition-colors">
                            {loc.office}
                            {loc.station && <span className="text-risda-orange/50 ml-4">[{loc.station}]</span>}
                          </h4>
                          <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-2xl ${
                            loc.status === 'Tidak Aktif' 
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                              : 'bg-green-500/10 text-green-500 border border-green-500/20'
                          }`}>
                            {loc.status || 'Aktif'}
                          </span>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="flex items-center gap-3">
                              <div className="w-2 h-2 bg-risda-orange rounded-full shadow-[0_0_10px_rgba(255,176,0,0.5)]" />
                              <span className="text-sm font-black text-white/50 uppercase tracking-[2px]">{loc.state}</span>
                           </div>
                           <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                              <span className="text-xs font-bold text-risda-muted uppercase tracking-[1px]">{loc.district}</span>
                           </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEdit(loc)}
                          className="p-4 bg-white/5 hover:bg-white/10 text-white/30 hover:text-white rounded-2xl transition-all border border-white/5"
                          title="Kemaskini"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button 
                          onClick={() => handleDelete(loc.id)}
                          className="p-4 bg-white/5 hover:bg-red-500/10 text-white/30 hover:text-red-500 rounded-2xl transition-all border border-white/5"
                          title="Padam"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
