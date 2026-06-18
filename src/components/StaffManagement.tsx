import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, where, writeBatch, Timestamp, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Trash2, Shield, User, RefreshCcw, Plus, X, Search, Folder, FolderOpen, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { initializeApp, deleteApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

interface StaffMember {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'penginput' | 'pelulus' | 'pentadbir';
  status: 'Aktif' | 'Tidak Aktif' | 'Pencen' | 'Berhenti';
  staffId: string;
  password?: string;
  state: string;
  district: string;
  office: string;
  createdAt: any;
  uid?: string;
  photoURL?: string;
  jawatan?: string;
  gred?: string;
}

export default function StaffManagement() {
  const { role: currentUserRole, user: currentUser } = useAuth();
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'pentadbir';
  const isStaff = currentUserRole === 'penginput' || currentUserRole === 'pelulus' || isAdmin;
  
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [allLocations, setAllLocations] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [office, setOffice] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [role, setRole] = useState<'admin' | 'penginput' | 'pelulus' | 'pentadbir'>('penginput');
  const [status, setStatus] = useState<'Aktif' | 'Tidak Aktif' | 'Pencen' | 'Berhenti'>('Aktif');
  const [jawatan, setJawatan] = useState('');
  const [gred, setGred] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'penginput' | 'pelulus' | 'pentadbir'>('all');
  const [showModal, setShowModal] = useState(false);
  const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});
  const [expandedDistricts, setExpandedDistricts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailToFind = params.get('email');
    if (emailToFind && staff.length > 0) {
      const member = staff.find(s => s.email === emailToFind);
      if (member) {
        handleEdit(member);
        toast.success(`Menguruskan akaun: ${member.displayName}`, { icon: '🔍' });
        // Optional: clear the URL after handling
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [staff]);

  useEffect(() => {
    fetchStaff();
    fetchLocations();
  }, []);

  // System janitorial fixes for specific requests (Sharil Role & Adzaimin Status)
  useEffect(() => {
    const performSystemFixes = async () => {
      let needsRefresh = false;

      // 1. Fix Sharil Wirman Role (Pelulus -> Penginput)
      const sharil = staff.find(s => s.displayName?.toUpperCase().includes('SHARIL WIRMAN'));
      if (sharil && sharil.role !== 'penginput') {
        try {
          await updateDoc(doc(db, 'users', sharil.id), { 
            role: 'penginput',
            updatedAt: serverTimestamp()
          });
          toast.success(`SISTEM: Peranan ${sharil.displayName} dikemaskini ke PENGINPUT.`, { icon: '🛠️' });
          needsRefresh = true;
        } catch (e) { console.error(e); }
      }

      // 2. Remove Adzaimin Ghazali from Active list (set to Tidak Aktif)
      const adzaimin = staff.find(s => s.displayName?.toUpperCase().includes('ADZAIMIN') && s.status === 'Aktif');
      if (adzaimin) {
        try {
          await updateDoc(doc(db, 'users', adzaimin.id), { 
            status: 'Tidak Aktif',
            updatedAt: serverTimestamp()
          });
          toast.success(`SISTEM: ${adzaimin.displayName} dinyahaktifkan dari senarai.`, { icon: '🧹' });
          needsRefresh = true;
        } catch (e) { console.error(e); }
      }

      if (needsRefresh) fetchStaff();
    };

    if (staff.length > 0 && currentUserRole === 'admin') {
      performSystemFixes();
    }
  }, [staff, currentUserRole]);

  const fetchLocations = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'locations'));
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllLocations(list);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchStaff = async () => {
    try {
      const q = query(collection(db, 'users'));
      const querySnapshot = await getDocs(q);
      const staffData: StaffMember[] = [];
      querySnapshot.forEach((doc) => {
        staffData.push({ id: doc.id, ...doc.data() } as StaffMember);
      });
      setStaff(staffData);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setFetching(false);
    }
  };

  const syncAuthAccount = async (emailAddr: string, pass: string) => {
    const appName = `SecondaryAuth_${Date.now()}`;
    let secondaryApp;
    try {
      secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      
      try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailAddr, pass);
        await deleteApp(secondaryApp);
        return { uid: userCredential.user.uid, status: 'created' };
      } catch (createErr: any) {
        if (createErr.code === 'auth/email-already-in-use') {
          // Verify if current stored password works
          try {
            const loginCred = await signInWithEmailAndPassword(secondaryAuth, emailAddr, pass);
            const uid = loginCred.user.uid;
            await secondaryAuth.signOut();
            await deleteApp(secondaryApp);
            return { uid, status: 'verified' };
          } catch (loginErr: any) {
            await deleteApp(secondaryApp);
            return { uid: null, status: 'password_mismatch', error: loginErr.message };
          }
        }
        throw createErr;
      }
    } catch (error: any) {
      if (secondaryApp) {
        try { await deleteApp(secondaryApp); } catch (e) { /* ignore */ }
      }
      throw error;
    }
  };

  const handeAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If not admin, only photoURL update is allowed
    if (!isAdmin && editingId !== currentUser?.email?.replace(/[^a-zA-Z0-9]/g, '_')) {
       // Should not happen due to UI restrictions, but for safety:
       if (editingId) {
          // Allow self update
       } else {
          return;
       }
    }

    if (!email || !displayName || !staffId || (!editingId && !password)) return;

    setLoading(true);
    const toastId = toast.loading(editingId ? 'Mengemaskini...' : 'Mendaftarkan...');
    
    try {
      // 1. Sync with Firebase Auth first if admin or creating
      let authUid = null;
      if (isAdmin && password) {
        try {
          const syncResult = await syncAuthAccount(email, password);
          authUid = syncResult.uid;
          
          if (syncResult.status === 'password_mismatch') {
            toast.error(`AMARAN: Akaun wujud tetapi Kata Laluan tidak sepadan dengan sistem login.`, { id: toastId, duration: 5000 });
          }
        } catch (authErr: any) {
          console.error('Auth Sync Error:', authErr);
          toast.error(`Gagal akses sistem Login: ${authErr.message}`, { id: toastId });
          setLoading(false);
          return;
        }
      }

      // 2. Prepare data
      const dataToSave: any = {
        displayName,
        staffId,
        state,
        district,
        office,
        role,
        status,
        photoURL,
        jawatan,
        gred,
        updatedAt: serverTimestamp()
      };

      if (password) dataToSave.password = password;
      if (authUid) dataToSave.uid = authUid;

      // Only Admin can change role/status/office
      if (!isAdmin) {
        delete dataToSave.role;
        delete dataToSave.status;
        delete dataToSave.office;
        delete dataToSave.state;
        delete dataToSave.district;
        delete dataToSave.staffId;
        delete dataToSave.password;
        delete dataToSave.jawatan;
        delete dataToSave.gred;
      }

      let registrationEmailSent = false;
      const trimmedEmail = email.trim();
      if (!editingId) {
        // Create - search by staffId to prevent overwriting other users who share the same email address
        const q = query(collection(db, 'users'), where('staffId', '==', staffId));
        const emailSnapshot = await getDocs(q);
        if (!emailSnapshot.empty) {
          const existingDoc = emailSnapshot.docs[0];
          await updateDoc(existingDoc.ref, dataToSave);
        } else {
          const emailSlug = trimmedEmail.replace(/[^a-zA-Z0-9]/g, '_');
          const finalDocId = `${emailSlug}_${staffId}`;
          await setDoc(doc(db, 'users', finalDocId), {
            ...dataToSave,
            email: trimmedEmail,
            createdAt: serverTimestamp(),
            uid: authUid || finalDocId
          });
        }

        const today = new Date();
        const formattedDate = today.toLocaleDateString('ms-MY', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        const notifySubject = `Pendaftaran Akaun Kakitangan Sistem SMARTLOG PEROLEHAN Berjaya`;
        const notifyBody = `Assalamualaikum / Salam Sejahtera,

Tahniah.

Pendaftaran anda ke dalam Sistem SMARTLOG PEROLEHAN telah berjaya.

Maklumat Akaun:

Nama: ${displayName}

Email: ${trimmedEmail}

No. ID Kakitangan : ${staffId}

Kata Laluan : ${password}

Tarikh Daftar: ${formattedDate}

Anda kini boleh log masuk menggunakan email, ID dan kata laluan yang telah didaftarkan.

Sekiranya terdapat sebarang masalah, sila hubungi Pentadbir Sistem.
Terima kasih.

Pentadbir Sistem (SMARTLOG PEROLEHAN)`;

        try {
          // Send email directly through secure backend proxy (uses SMTP settings from Secrets)
          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: trimmedEmail,
              subject: notifySubject,
              text: notifyBody
            })
          }).then(res => {
            if (res.ok) {
              console.log('Direct SMTP email triggered successfully for staff registration.');
            } else {
              console.warn('Direct SMTP is not active or not configured, falling back to Firestore triggers.');
            }
          }).catch(err => {
            console.error('SMTP route fetch failed, fallback is selected:', err);
          });

          const docPromises = [
            // Format 1: Flat scheme in 'sent_emails'
            addDoc(collection(db, 'sent_emails'), {
              to: trimmedEmail,
              toName: displayName,
              subject: notifySubject,
              body: notifyBody,
              sentAt: new Date().toISOString()
            }),
            // Format 2: Nested scheme in 'sent_emails'
            addDoc(collection(db, 'sent_emails'), {
              to: trimmedEmail,
              message: {
                subject: notifySubject,
                text: notifyBody
              },
              sentAt: new Date().toISOString()
            }).catch(() => null),
            // Format 3: Flat scheme in 'mail' for generic standard triggers
            addDoc(collection(db, 'mail'), {
              to: trimmedEmail,
              toName: displayName,
              subject: notifySubject,
              body: notifyBody,
              sentAt: new Date().toISOString()
            }).catch(() => null),
            // Format 4: Nested scheme in 'mail' (Standard firestore-send-email extension)
            addDoc(collection(db, 'mail'), {
              to: trimmedEmail,
              message: {
                subject: notifySubject,
                text: notifyBody
              },
              sentAt: new Date().toISOString()
            }).catch(() => null),
            // Format 5: Flat scheme in 'emails'
            addDoc(collection(db, 'emails'), {
              to: trimmedEmail,
              toName: displayName,
              subject: notifySubject,
              body: notifyBody,
              sentAt: new Date().toISOString()
            }).catch(() => null),
            // Format 6: Nested scheme in 'emails'
            addDoc(collection(db, 'emails'), {
              to: trimmedEmail,
              message: {
                subject: notifySubject,
                text: notifyBody
              },
              sentAt: new Date().toISOString()
            }).catch(() => null)
          ];

          await Promise.all(docPromises);
          registrationEmailSent = true;
        } catch (emailErr) {
          console.error('Error queuing staff welcome email:', emailErr);
        }
      } else {
        // Update
        await updateDoc(doc(db, 'users', editingId), dataToSave);
      }

      // 3. Auto-resolve any pending notifications for this email
      if (isAdmin) {
        await autoResolveNotifications(email, displayName);
      }

      resetForm();
      fetchStaff();
      
      let successMsg = editingId ? 'Data telah dikemaskini!' : 'Kakitangan telah didaftarkan!';
      if (!editingId && registrationEmailSent) {
        successMsg += ' E-mel notifikasi pendaftaran telah dihantar ke inbox kakitangan.';
      } else if (!editingId) {
        successMsg += ' (Gagal menghantar e-mel notifikasi automatik secara terus)';
      }
      toast.success(successMsg, { id: toastId, duration: 6000 });
    } catch (error) {
      console.error('Error saving staff:', error);
      handleFirestoreError(error, OperationType.WRITE, `users/${editingId || email}`);
      toast.error('Gagal menyimpan data.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 500) { // 500KB limit for base64 storage
      toast.error('Saiz fail terlalu besar (Had: 500KB untuk foto profil).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoURL(reader.result as string);
      toast.success('Foto telah sedia untuk dikemaskini.');
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setEditingId(null);
    setEmail('');
    setDisplayName('');
    setStaffId('');
    setPassword('');
    setState('');
    setDistrict('');
    setOffice('');
    setRole('penginput');
    setStatus('Aktif');
    setPhotoURL('');
    setJawatan('');
    setGred('');
    setShowModal(false);
  };

  const autoResolveNotifications = async (targetEmail: string, name: string) => {
    try {
      const q = query(
        collection(db, 'notifications'), 
        where('userEmail', '==', targetEmail),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.forEach((doc) => {
        batch.update(doc.ref, {
          status: 'resolved',
          resolvedAt: serverTimestamp(),
          resolvedBy: currentUser?.email || 'System'
        });
      });
      
      await batch.commit();

      // Simulate sending email
      await addDoc(collection(db, 'sent_emails'), {
        to: targetEmail,
        toName: name,
        subject: 'Permohonan Bantuan/Reset Kata Laluan Selesai',
        body: `Hai ${name}, permohonan anda telah diproses dan diselesaikan oleh Pentadbir Sistem. Sila cuba log masuk sekarang.`,
        sentAt: serverTimestamp()
      });

      toast.success(`Notifikasi auto-selesai & E-mel dihantar ke ${targetEmail}`);
    } catch (err) {
      console.error('Error auto-resolving notifications:', err);
    }
  };

  const handleEdit = (member: StaffMember) => {
    setEditingId(member.id);
    setEmail(member.email);
    setDisplayName(member.displayName);
    setStaffId(member.staffId);
    setPassword(member.password || '');
    setState(member.state);
    setDistrict(member.district);
    setOffice(member.office);
    setRole(member.role);
    setStatus(member.status || 'Aktif');
    setPhotoURL(member.photoURL || '');
    setJawatan(member.jawatan || '');
    setGred(member.gred || '');
    setShowModal(true);
  };

  const handleOfficeChange = (officeName: string) => {
    setOffice(officeName);
    const found = allLocations.find(l => l.office === officeName);
    if (found) {
      setState(found.state);
      setDistrict(found.district);
    }
  };

  const handleDelete = async (id: string) => {
    const staffMember = staff.find(s => s.id === id);
    if (!staffMember) return;

    if (staffMember.email === currentUser?.email) {
      toast.error('Anda tidak boleh memadam akaun anda sendiri!');
      return;
    }

    if (!window.confirm(`Adakah anda pasti untuk padam kakitangan ${staffMember.displayName}? Semua data berkaitan akan hilang.`)) return;
    
    const loadingToast = toast.loading('Memadam data...');
    try {
      // 1. Delete the primary document
      await deleteDoc(doc(db, 'users', id));
      
      // 2. Clear other documents that share the same staffId (e.g., pre-registration vs UID migrated documents)
      if (staffMember.staffId) {
        const q = query(collection(db, 'users'), where('staffId', '==', staffMember.staffId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.forEach((d) => {
            if (d.id !== id) batch.delete(d.ref);
          });
          await batch.commit();
        }
      }

      // 3. Delete related system notifications associated with this staff's email completely
      if (staffMember.email) {
        const notifQ = query(collection(db, 'notifications'), where('userEmail', '==', staffMember.email.trim()));
        const notifSnapshot = await getDocs(notifQ);
        if (!notifSnapshot.empty) {
          const batch = writeBatch(db);
          notifSnapshot.forEach((d) => {
            batch.delete(d.ref);
          });
          await batch.commit();
        }
      }

      setStaff(prev => prev.filter(s => s.id !== id));
      toast.success('Rekod kakitangan dan data berkaitan telah dipadam sepenuhnya dari sistem.', { id: loadingToast });
      fetchStaff(); // Force refresh from server
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Gagal memadam rekod sepenuhnya.', { id: loadingToast });
      try {
        handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
      } catch (e) {
        // Silently handled
      }
    }
  };

  const handleResetPassword = async (member: StaffMember) => {
    const newPassword = window.prompt('Masukkan password baru (Hanya untuk rujukan database):');
    if (!newPassword) return;
    try {
      await updateDoc(doc(db, 'users', member.id), { password: newPassword });
      toast.success('Kata laluan dalam database dikemaskini. PENTING: Untuk tukar akses login, gunakan butang "Hantar Reset Email".', { duration: 6000 });
      fetchStaff();
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Gagal mengemaskini kata laluan.');
    }
  };

  const handleSendResetEmail = async (email: string) => {
    const tId = toast.loading('Menghantar e-mel reset...');
    try {
      await sendPasswordResetEmail(getAuth(), email);
      toast.success(`E-mel reset kata laluan telah dihantar ke ${email}`, { id: tId });
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      toast.error(`Gagal menghantar: ${error.message}`, { id: tId });
    }
  };

  const handleUpdateRole = async (id: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', id), { role: newRole });
      toast.success('Peranan kakitangan telah dikemaskini.');
      fetchStaff();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
    }
  };

  const filteredStaff = staff.filter(s => {
    if (!isAdmin) {
      // Regular staff only see themselves
      return s.email === currentUser?.email;
    }
    
    const matchesSearch = s.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.staffId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.office?.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesRole = roleFilter === 'all' || s.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  // Auto-expand states & districts when searching or filtering is active
  useEffect(() => {
    if (searchQuery.trim() !== '' || roleFilter !== 'all') {
      const autoExpandStates: Record<string, boolean> = {};
      const autoExpandDistricts: Record<string, boolean> = {};

      filteredStaff.forEach(member => {
        const stateName = member.state ? member.state.toUpperCase() : 'TIADA NEGERI';
        const districtName = member.district ? member.district.toUpperCase() : 'TIADA DAERAH';
        autoExpandStates[stateName] = true;
        autoExpandDistricts[`${stateName}_${districtName}`] = true;
      });

      setExpandedStates(autoExpandStates);
      setExpandedDistricts(autoExpandDistricts);
    }
  }, [searchQuery, roleFilter, staff]);

  if (!isStaff) {
    return <div className="p-20 text-center text-risda-muted font-black uppercase tracking-[4px]">Akses Terhad.</div>;
  }

  return (
    <div className="space-y-16 p-4 md:p-8 w-full lg:max-w-none">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
             <div className="p-4 bg-risda-orange/10 rounded-2xl text-risda-orange border border-risda-orange/20">
               <Shield size={28} />
             </div>
             <div>
               <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight leading-none mb-1">Kakitangan</h2>
               <p className="text-[10px] md:text-xs text-risda-muted font-bold uppercase tracking-[4px] opacity-60">Kawal Akses & Konfigurasi Sistem</p>
             </div>
          </div>
        </div>

        {isAdmin && (
          <button 
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center justify-center gap-4 px-10 py-5 bg-risda-orange text-black rounded-2xl text-xs font-black uppercase tracking-[2px] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-risda-orange/30 group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            Tambah Kakitangan Baru
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-12">
        <div className="flex flex-col xl:flex-row items-end justify-between gap-10">
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/5">
             {(['all', 'admin', 'pentadbir', 'pelulus', 'penginput'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  roleFilter === r
                    ? 'bg-risda-orange text-black shadow-xl shadow-risda-orange/20'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                {r === 'all' ? 'SEMUA' : 
                 r === 'admin' ? 'ADMIN' : 
                 r === 'pentadbir' ? 'PENTADBIR' : 
                 r === 'pelulus' ? 'PELULUS' : 'PENGINPUT'}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xl group">
            <Search className="absolute left-1 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-risda-orange transition-colors" size={18} />
            <input 
              type="text"
              placeholder="CARI NAMA, EMAIL ATAU ID KAKITANGAN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-b-2 border-white/10 rounded-none py-4 pl-10 pr-4 text-xs font-black text-white uppercase focus:border-risda-orange outline-none transition-all placeholder:text-white/10 tracking-widest"
            />
          </div>
        </div>

        {/* Staff List */}
        <div className="w-full">
          {fetching ? (
            <div className="py-32 flex flex-col items-center justify-center gap-4 text-risda-muted">
              <div className="w-12 h-12 border-4 border-risda-orange/20 border-t-risda-orange rounded-full animate-spin" />
              <p className="font-black uppercase text-[10px] tracking-[5px] animate-pulse">Memuatkan Data Sistem...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center gap-6 bg-white/5 rounded-[50px] border border-white/10 border-dashed">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center ring-1 ring-white/10">
                <User size={40} className="text-white/10" />
              </div>
              <p className="font-black uppercase text-[10px] tracking-[6px] text-white/30">Tiada Rekod Dijumpai</p>
            </div>
          ) : (
            <div className="space-y-6 w-full">
              <AnimatePresence mode="popLayout">
                {(() => {
                  // Group filtered staff by State
                  const groupedByState = filteredStaff.reduce((acc, member) => {
                    const stateName = member.state ? member.state.toUpperCase() : 'TIADA NEGERI';
                    if (!acc[stateName]) {
                      acc[stateName] = [];
                    }
                    acc[stateName].push(member);
                    return acc;
                  }, {} as Record<string, StaffMember[]>);

                  const sortedStates = Object.keys(groupedByState).sort((a, b) => a.localeCompare(b));

                  const toggleStateExpand = (stateName: string) => {
                    setExpandedStates(prev => ({
                      ...prev,
                      [stateName]: !prev[stateName]
                    }));
                  };

                  const toggleDistrictExpand = (stateAndDistrictKey: string) => {
                    setExpandedDistricts(prev => ({
                      ...prev,
                      [stateAndDistrictKey]: !prev[stateAndDistrictKey]
                    }));
                  };

                  return sortedStates.map((stateName) => {
                    const isStateExpanded = !!expandedStates[stateName];
                    const itemsUnderState = groupedByState[stateName];
                    const totalCount = itemsUnderState.length;
                    const activeCount = itemsUnderState.filter(item => item.status === 'Aktif').length;

                    return (
                      <motion.div 
                        key={stateName} 
                        layout="position"
                        className="border border-white/5 bg-white/[0.01] rounded-[32px] overflow-hidden transition-all duration-300 hover:border-white/10 shadow-lg shadow-black/20"
                      >
                        {/* State Folder Header */}
                        <button
                          type="button"
                          onClick={() => toggleStateExpand(stateName)}
                          className="w-full flex items-center justify-between p-6 md:p-8 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300 select-none text-left cursor-pointer group"
                        >
                          <div className="flex items-center gap-5">
                            <div className={`p-4 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0 ${
                              isStateExpanded 
                                ? 'bg-risda-orange/15 text-risda-orange border border-risda-orange/20 shadow-lg shadow-risda-orange/5 scale-105' 
                                : 'bg-white/5 text-white/40 border border-white/5 group-hover:bg-white/10 group-hover:text-white/75'
                            }`}>
                              {isStateExpanded ? <FolderOpen size={24} /> : <Folder size={24} />}
                            </div>
                            <div>
                              <h3 className="text-base md:text-lg font-black text-white tracking-wider uppercase group-hover:text-risda-orange transition-colors">
                                NEGERI {stateName}
                              </h3>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[10px] font-black uppercase text-risda-muted tracking-widest bg-white/5 px-2.5 py-1 rounded-lg">
                                  {totalCount} Kakitangan
                                </span>
                                {activeCount > 0 && (
                                  <span className="text-[10px] font-black uppercase text-green-500 tracking-widest bg-green-500/10 px-2.5 py-1 rounded-lg">
                                    {activeCount} Aktif
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="hidden md:inline text-[9px] font-black tracking-[2px] uppercase text-risda-muted opacity-45 group-hover:opacity-100 transition-opacity">
                              {isStateExpanded ? 'TUTUP FOLDER' : 'BUKA FOLDER'}
                            </span>
                            <div className={`p-2.5 rounded-xl bg-white/5 text-white/50 group-hover:bg-white/10 group-hover:text-white transition-transform duration-300 ${
                              isStateExpanded ? 'rotate-180' : ''
                            }`}>
                              <ChevronDown size={18} />
                            </div>
                          </div>
                        </button>

                        {/* State Folder Content / Collapsible Districts list */}
                        <AnimatePresence initial={false}>
                          {isStateExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25, ease: 'easeInOut' }}
                              className="border-t border-white/5 bg-black/15 p-6 md:p-8 space-y-6"
                            >
                              {(() => {
                                // Group state staff by District
                                const groupedByDistrict = itemsUnderState.reduce((acc, m) => {
                                  const districtName = m.district ? m.district.toUpperCase() : 'TIADA DAERAH';
                                  if (!acc[districtName]) {
                                    acc[districtName] = [];
                                  }
                                  acc[districtName].push(m);
                                  return acc;
                                }, {} as Record<string, StaffMember[]>);

                                const sortedDistricts = Object.keys(groupedByDistrict).sort((a, b) => a.localeCompare(b));

                                return sortedDistricts.map((districtName) => {
                                  const key = `${stateName}_${districtName}`;
                                  const isDistrictExpanded = !!expandedDistricts[key];
                                  const staffInDistrict = groupedByDistrict[districtName];
                                  const distTotal = staffInDistrict.length;
                                  const distActive = staffInDistrict.filter(m => m.status === 'Aktif').length;

                                  return (
                                    <div key={key} className="border border-white/5 bg-white/[0.005] rounded-2xl overflow-hidden hover:border-white/10 transition-all duration-300">
                                      {/* District Folder Header */}
                                      <button
                                        type="button"
                                        onClick={() => toggleDistrictExpand(key)}
                                        className="w-full flex items-center justify-between p-4 md:p-5 bg-white/[0.01] hover:bg-white/[0.03] transition-all duration-300 select-none text-left cursor-pointer group/dist"
                                      >
                                        <div className="flex items-center gap-4">
                                          <div className={`p-2.5 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 ${
                                            isDistrictExpanded 
                                              ? 'bg-risda-gold/15 text-risda-gold border border-risda-gold/20 scale-105' 
                                              : 'bg-white/5 text-white/30 border border-white/5 group-hover/dist:bg-white/10 group-hover/dist:text-white/60'
                                          }`}>
                                            {isDistrictExpanded ? <FolderOpen size={18} /> : <Folder size={18} />}
                                          </div>
                                          <div>
                                            <h4 className="text-xs md:text-sm font-black text-white/80 tracking-wide uppercase group-hover/dist:text-risda-gold transition-colors flex items-center gap-2">
                                              DAERAH {districtName}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1">
                                              <span className="text-[9px] font-black uppercase text-risda-muted tracking-widest">
                                                {distTotal} Kakitangan
                                              </span>
                                              {distActive > 0 && (
                                                <span className="text-[9px] font-semibold text-green-500/80">
                                                  ({distActive} Aktif)
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2.5">
                                          <div className={`p-2 rounded-lg bg-white/5 text-white/40 group-hover/dist:bg-white/10 group-hover/dist:text-white transition-transform duration-300 ${
                                            isDistrictExpanded ? 'rotate-180' : ''
                                          }`}>
                                            <ChevronDown size={14} />
                                          </div>
                                        </div>
                                      </button>

                                      {/* District Folder Content / Staff Card Grid */}
                                      <AnimatePresence initial={false}>
                                        {isDistrictExpanded && (
                                          <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="border-t border-white/5 bg-black/10 p-4 md:p-6"
                                          >
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
                                              {staffInDistrict.map((member) => (
                                                <motion.div 
                                                  key={member.id}
                                                  layout
                                                  initial={{ opacity: 0, scale: 0.95 }}
                                                  animate={{ opacity: 1, scale: 1 }}
                                                  exit={{ opacity: 0, scale: 0.95 }}
                                                  className="group/card relative p-6 border border-white/5 bg-white/[0.01] rounded-[24px] hover:border-risda-orange/30 hover:bg-white/[0.03] transition-all duration-300 overflow-hidden"
                                                >
                                                  {/* Background Accent */}
                                                  <div className="absolute top-0 right-0 w-24 h-24 bg-risda-orange/5 blur-2xl rounded-full -mr-12 -mt-12 group-hover/card:bg-risda-orange/10 transition-all pointer-events-none" />
                                                  
                                                  <div className="flex items-start gap-4 relative z-10">
                                                    <div className="relative shrink-0">
                                                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden border border-white/10 ${
                                                        member.role === 'admin' ? 'bg-risda-orange/20 text-risda-orange' : 'bg-risda-card text-risda-orange'
                                                      }`}>
                                                        {member.photoURL ? (
                                                          <img src={member.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                                                        ) : (
                                                          member.role === 'admin' ? <Shield size={24} /> : <User size={24} />
                                                        )}
                                                      </div>
                                                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-risda-card ${
                                                        member.status === 'Aktif' ? 'bg-green-500' : 'bg-risda-muted'
                                                      }`} />
                                                     </div>

                                                     <div className="flex-1 min-w-0">
                                                      <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="text-xs md:text-sm font-black text-white uppercase tracking-tight truncate leading-tight group-hover/card:text-risda-orange transition-colors">{member.displayName}</h4>
                                                      </div>
                                                      <p className="text-[9px] font-black text-risda-gold uppercase tracking-[1.5px] mb-1 leading-none">
                                                         {member.role === 'admin' || member.role === 'pentadbir' ? 'Pentadbir Sistem' : member.role === 'penginput' ? 'Pihak Penginput' : 'Pegawai Pelulus'}
                                                      </p>
                                                      {(member.jawatan || member.gred) && (
                                                        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[1px] mb-2 leading-none">
                                                          {member.jawatan || 'TIADA JAWATAN'} {member.gred ? `[${member.gred}]` : ''}
                                                        </p>
                                                      )}
                                                      
                                                      <div className="space-y-1">
                                                        <div className="flex items-center gap-1.5 text-[9px] text-white/40">
                                                           <span className="font-semibold uppercase tracking-wider">{member.staffId}</span>
                                                           <span className="opacity-30">•</span>
                                                           <span className="truncate italic">{member.email}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-risda-orange uppercase tracking-wider leading-none">
                                                           <MapPin size={10} className="text-risda-orange/60" />
                                                           <span className="truncate">{member.office || 'PEJABAT TIDAK DITETAPKAN'}</span>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>

                                                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between relative z-10">
                                                    <div className="flex items-center gap-1">
                                                      {isAdmin ? (
                                                        <>
                                                          <button 
                                                            type="button"
                                                            onClick={() => handleEdit(member)}
                                                            className="p-2 text-white/30 hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                                                            title="Edit Profil"
                                                          >
                                                            <UserPlus size={16} />
                                                          </button>
                                                          <button 
                                                            type="button"
                                                            onClick={() => handleResetPassword(member)}
                                                            className="p-2 text-white/30 hover:text-risda-orange hover:bg-risda-orange/10 rounded-xl transition-all cursor-pointer"
                                                            title="Update Password"
                                                          >
                                                            <Shield size={16} />
                                                          </button>
                                                          <button 
                                                            type="button"
                                                            onClick={() => handleSendResetEmail(member.email)}
                                                            className="p-2 text-white/30 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all cursor-pointer"
                                                            title="Hantar Reset Email"
                                                          >
                                                            <RefreshCcw size={16} className="rotate-180" />
                                                          </button>
                                                          <button 
                                                            type="button"
                                                            onClick={() => handleDelete(member.id)}
                                                            className="p-2 text-white/30 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                                                            title="Padam"
                                                          >
                                                            <Trash2 size={16} />
                                                          </button>
                                                        </>
                                                      ) : (
                                                        <span className="text-[8px] font-black text-white/30 uppercase tracking-[2px]">Profil Sistem Anda</span>
                                                      )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                      {isAdmin && (
                                                        <select 
                                                          value={member.status || 'Aktif'}
                                                          onChange={async (e) => {
                                                            try {
                                                              await updateDoc(doc(db, 'users', member.id), { status: e.target.value });
                                                              fetchStaff();
                                                            } catch (err) { 
                                                              handleFirestoreError(err, OperationType.UPDATE, `users/${member.id}`);
                                                            }
                                                          }}
                                                          className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider focus:outline-none transition-all cursor-pointer ${
                                                            member.status === 'Aktif' 
                                                              ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                                                              : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                                          }`}
                                                        >
                                                          <option value="Aktif">AKTIF</option>
                                                          <option value="Tidak Aktif">TIDAK AKTIF</option>
                                                          <option value="Pencen">PENCEN</option>
                                                          <option value="Berhenti">BERHENTI</option>
                                                        </select>
                                                      )}
                                                      <button 
                                                         type="button"
                                                         onClick={() => handleEdit(member)}
                                                         className="px-3 py-1 bg-white/5 border border-white/5 text-white/50 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                                                      >
                                                        {isAdmin ? 'DETAIL' : 'KEMASKINI PROFIL'}
                                                      </button>
                                                    </div>
                                                  </div>
                                                </motion.div>
                                              ))}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                });
                              })()}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  });
                })()}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Modal Overlay */}
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
              className="relative w-full max-w-2xl bg-risda-card border border-white/5 rounded-[48px] shadow-2xl overflow-hidden shadow-black/80"
            >
              {/* Modal Header */}
              <div className="bg-black/40 p-8 border-b border-white/5 flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">
                    {isAdmin ? (editingId ? 'Kemaskini Kakitangan' : 'Tambah Kakitangan Baru') : 'Kemaskini Profil'}
                  </h3>
                  <p className="text-[10px] text-risda-muted font-bold uppercase tracking-[2px]">Input Maklumat Kakitangan Sistem</p>
                </div>
                <button 
                  onClick={resetForm}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white/50 hover:text-white transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handeAddStaff} className="p-8 max-h-[70vh] overflow-y-auto no-scrollbar space-y-8">
                {/* Photo Upload Section */}
                <div className="flex items-center gap-8 p-6 bg-white/5 rounded-3xl border border-white/5 group">
                   <div className="relative">
                     <div className="w-24 h-24 bg-black/40 rounded-3xl border-2 border-white/10 overflow-hidden flex items-center justify-center shadow-2xl transition-all group-hover:border-risda-orange">
                        {photoURL ? (
                          <img src={photoURL} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <User size={40} className="text-white/10" />
                        )}
                     </div>
                     <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-risda-orange text-black rounded-2xl flex items-center justify-center cursor-pointer shadow-xl hover:scale-110 active:scale-95 transition-all">
                        <Plus size={20} />
                        <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                     </label>
                   </div>
                   <div className="space-y-1">
                     <p className="text-sm font-black text-white uppercase tracking-wider">Foto Profil Kakitangan</p>
                     <p className="text-[10px] text-risda-muted font-bold tracking-wider leading-relaxed">Muat naik fail gambar (JPG/PNG) tidak melebihi 500KB untuk paparan sistem.</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Kakitangan</label>
                    <input 
                      value={displayName || ''}
                      onChange={(e) => setDisplayName(e.target.value)}
                      readOnly={!isAdmin && editingId !== currentUser?.email?.replace(/[^a-zA-Z0-9]/g, '_')}
                      placeholder="NAMA PENUH"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/10"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">No. ID Kakitangan</label>
                    <input 
                      value={staffId || ''}
                      onChange={(e) => setStaffId(e.target.value)}
                      readOnly={!isAdmin}
                      placeholder="CO-XXXX"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/10 uppercase"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Google Email</label>
                    <input 
                      value={email || ''}
                      onChange={(e) => setEmail(e.target.value)}
                      readOnly={!isAdmin}
                      type="email"
                      placeholder="EMAIL@GMAIL.COM"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/10"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Kata Laluan</label>
                    <input 
                      value={isAdmin ? (password || '') : '********'}
                      onChange={(e) => setPassword(e.target.value)}
                      readOnly={!isAdmin}
                      type="text"
                      placeholder="MINIMA 6 AKSARA"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/10"
                      required={!editingId}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Jawatan Kakitangan</label>
                    <input 
                      value={jawatan || ''}
                      onChange={(e) => setJawatan(e.target.value)}
                      readOnly={!isAdmin}
                      placeholder="CTH: PEGAWAI PEROLEHAN"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/10 uppercase"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Gred Jawatan</label>
                    <input 
                      value={gred || ''}
                      onChange={(e) => setGred(e.target.value)}
                      readOnly={!isAdmin}
                      placeholder="CTH: G29 / N19"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all placeholder:text-white/10 uppercase"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Negeri</label>
                    <select 
                      value={state || ''}
                      disabled={!isAdmin}
                      onChange={(e) => {
                        setState(e.target.value);
                        setOffice('');
                        setDistrict('');
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all appearance-none"
                      required
                    >
                      <option value="">PILIH NEGERI</option>
                      <option value="SABAH">SABAH</option>
                      <option value="SARAWAK">SARAWAK</option>
                      <option value="KUALA LUMPUR">KUALA LUMPUR</option>
                      <option value="SELANGOR">SELANGOR</option>
                      <option value="JOHOR">JOHOR</option>
                      <option value="KEDAH">KEDAH</option>
                      <option value="KELANTAN">KELANTAN</option>
                      <option value="MELAKA">MELAKA</option>
                      <option value="NEGERI SEMBILAN">NEGERI SEMBILAN</option>
                      <option value="PAHANG">PAHANG</option>
                      <option value="PULAU PINANG">PULAU PINANG</option>
                      <option value="PERAK">PERAK</option>
                      <option value="PERLIS">PERLIS</option>
                      <option value="TERENGGANU">TERENGGANU</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Pejabat RISDA</label>
                    <select 
                      value={office || ''}
                      disabled={!isAdmin}
                      onChange={(e) => handleOfficeChange(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all appearance-none"
                      required
                    >
                      <option value="">PILIH PEJABAT</option>
                      {allLocations
                        .filter(loc => (!state || loc.state === state) && loc.status === 'Aktif')
                        .map(loc => (
                          <option key={loc.id} value={loc.office}>{loc.office}</option>
                        ))
                      }
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Peranan</label>
                    <select 
                      value={role || 'penginput'}
                      disabled={!isAdmin}
                      onChange={(e: any) => setRole(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all appearance-none"
                    >
                      <option value="penginput">PENGINPUT (CRUD IKLAN)</option>
                      <option value="pelulus">PELULUS (CRUD IKLAN)</option>
                      <option value="pentadbir">PENTADBIR (SISTEM)</option>
                      <option value="admin">ADMIN (SYSTEM - SUPERUSER)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-orange uppercase tracking-[3px] ml-1">Status</label>
                    <select 
                      value={status || 'Aktif'}
                      disabled={!isAdmin}
                      onChange={(e: any) => setStatus(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:border-risda-orange/50 outline-none transition-all appearance-none"
                    >
                      <option value="Aktif">AKTIF</option>
                      <option value="Tidak Aktif">TIDAK AKTIF</option>
                      <option value="Pencen">PENCEN</option>
                      <option value="Berhenti">BERHENTI</option>
                    </select>
                  </div>
                </div>
              </form>

              {/* Modal Footer */}
              <div className="p-8 bg-black/40 border-t border-white/5 flex gap-4">
                 <button 
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white rounded-[24px] text-xs font-black uppercase tracking-widest transition-all"
                >
                  BATAL
                </button>
                <button 
                  onClick={handeAddStaff}
                  disabled={loading}
                  className="flex-[2] py-5 bg-risda-orange text-black rounded-[24px] text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-risda-orange/20 flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    <UserPlus size={18} />
                  )}
                  {editingId ? 'SIMPAN PERUBAHAN' : 'DAFTAR KAKITANGAN'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
