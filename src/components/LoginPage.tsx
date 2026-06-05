import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Mail, Lock, ShieldCheck, ArrowRight, Chrome, AlertCircle, Eye, EyeOff, X, User } from 'lucide-react';
import { signInWithGoogle, auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, Timestamp, query, where, getDocs, limit, updateDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleResetRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error('Sila masukkan E-mel anda.');
      return;
    }

    const path = 'notifications';
    setResetLoading(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        type: 'reset_password',
        userId: 'anonymous',
        userName: 'Permohonan Reset',
        userEmail: resetEmail,
        message: `Memohon reset kata laluan untuk akaun: ${resetEmail}`,
        status: 'pending',
        createdAt: Timestamp.now()
      });
      toast.success('Permintaan reset kata laluan telah dihantar ke Pentadbir Sistem.');
      setShowResetModal(false);
      setResetEmail('');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const user = await signInWithGoogle();
      if (!user) {
        // User cancelled or closed the popup, don't show error
        return;
      }
    } catch (err: any) {
      if (err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Gagal log masuk dengan Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const cleanIdentifier = identifier.trim();
      let targetEmail = cleanIdentifier;
      let dbUserDoc: any = null;
      let dbUserDocId: string | null = null;
      const usersRef = collection(db, 'users');

      // If it doesn't look like an email, try lookup by staffId or displayName
      if (!cleanIdentifier.includes('@')) {
        const searchId = cleanIdentifier;
        
        // Try exact match first
        let qId = query(usersRef, where('staffId', '==', searchId), limit(1));
        let snapshot = await getDocs(qId);
        
        if (snapshot.empty) {
          // Try exact match for name
          const qName = query(usersRef, where('displayName', '==', searchId), limit(1));
          snapshot = await getDocs(qName);
        }

        // If still empty, try case-insensitive lookup via uppercase pattern
        if (snapshot.empty) {
          const qLowerId = query(usersRef, where('staffId', '==', searchId.toUpperCase()), limit(1));
          snapshot = await getDocs(qLowerId);
        }
        
        if (snapshot.empty) {
          const qLowerName = query(usersRef, where('displayName', '==', searchId.toUpperCase()), limit(1));
          snapshot = await getDocs(qLowerName);
        }

        if (snapshot.empty) {
          // Final attempt for mixed case names - fetch first 100 and filter (client-side backup for small user counts)
          const qAll = query(usersRef, limit(100));
          const allSnap = await getDocs(qAll);
          const foundDoc = allSnap.docs.find(d => {
            const data = d.data();
            return data.displayName?.toLowerCase() === searchId.toLowerCase() || 
                   data.staffId?.toLowerCase() === searchId.toLowerCase();
          });
          if (foundDoc) {
            targetEmail = foundDoc.data().email;
            dbUserDoc = foundDoc.data();
            dbUserDocId = foundDoc.id;
          } else {
            throw new Error('ID / Nama tidak dijumpai dalam sistem.');
          }
        } else {
          targetEmail = snapshot.docs[0].data().email;
          dbUserDoc = snapshot.docs[0].data();
          dbUserDocId = snapshot.docs[0].id;
        }
      } else {
        // It is an email, let's fetch the Firestore document to compare passwords
        const qEmail = query(usersRef, where('email', '==', targetEmail.trim()), limit(1));
        const snapshot = await getDocs(qEmail);
        if (!snapshot.empty) {
          dbUserDoc = snapshot.docs[0].data();
          dbUserDocId = snapshot.docs[0].id;
        }
      }

      if (!targetEmail) {
        throw new Error('E-mel akaun tidak ditemui.');
      }

      try {
        await signInWithEmailAndPassword(auth, targetEmail.trim(), password);
      } catch (signInErr: any) {
        // AUTO-HEALING AUTH AND CREDENTIALS:
        // If sign-in failed but the user provided the exact password stored in their Firestore document,
        // we can dynamically provision or sync the auth account!
        if (dbUserDoc && dbUserDoc.password === password) {
          if (signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/user-not-found') {
            try {
              const res = await createUserWithEmailAndPassword(auth, targetEmail.trim(), password);
              
              if (dbUserDocId) {
                await updateDoc(doc(db, 'users', dbUserDocId), {
                  uid: res.user.uid,
                  updatedAt: Timestamp.now()
                });
              }
              toast.success('Penyelarasan kata laluan & akaun berjaya! Selamat datang.');
              return;
            } catch (createErr: any) {
              console.error('Auto-healing registration error:', createErr);
              throw signInErr;
            }
          }
        }
        throw signInErr;
      }
    } catch (err: any) {
      console.error('Login error details:', err.code, err.message);
      
      let errorMessage = 'Gagal log masuk. Sila cuba lagi atau hubungi Pentadbir.';
      
      if (err.message === 'ID / Nama tidak dijumpai dalam sistem.' || err.message === 'E-mel akaun tidak ditemui.') {
        errorMessage = err.message;
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errorMessage = 'KREDENTIAL TIDAK SAH: ID Staff / E-mel atau Kata Laluan adalah salah. Sila pastikan anda menggunakan maklumat yang didaftarkan oleh Pentadbir.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'TERLALU BANYAK PERCUBAAN: Akaun ini disekat sementara. Sila cuba sebentar lagi atau set semula kata laluan.';
      } else if (err.code === 'auth/user-disabled') {
        errorMessage = 'AKAUN DISEKAT: Sila hubungi Pentadbir Sistem.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-risda-dark technical-grid p-6 relative overflow-hidden">
      {/* Decorative Glows */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-risda-gold/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-risda-gold/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8 relative z-10"
      >
        {/* Brand */}
        <div className="text-center space-y-5">
          <div className="inline-flex items-center justify-center p-3 h-28 w-28 group transition-transform duration-500 mx-auto overflow-hidden">
            <img 
              src="/PUBLIC/intrologo_RISDA.png" 
              alt="RISDA" 
              className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-transform duration-500 group-hover:scale-110" 
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src !== "/api/logo") {
                  img.src = "/api/logo";
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-poppins font-light text-risda-text tracking-tight">SMART LOG <span className="font-bold text-risda-gold-light">PEROLEHAN</span></h1>
            <p className="text-[10px] text-risda-gold font-black uppercase tracking-[5px]">RISDA DAERAH BEAUFORT</p>
          </div>
        </div>

        <div className="bg-risda-card border border-risda-border rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="p-10 space-y-8">
            <div className="space-y-2 border-l-2 border-risda-gold pl-5">
              <h2 className="text-lg font-bold text-risda-text uppercase tracking-widest leading-none">Akses Sistem</h2>
              <p className="text-xs text-risda-text-secondary font-medium">Log masuk mengikut peranan anda.</p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-red-500/5 border-l-2 border-red-500 text-[10px] text-red-400 font-bold uppercase tracking-wider"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-6">
              {/* Google Login for Admin */}
              <button 
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-14 bg-white text-black font-black text-[11px] uppercase tracking-[2px] rounded-xl flex items-center justify-center gap-3 hover:bg-gray-200 transition-all active:scale-[0.98] disabled:opacity-50 shadow-xl"
              >
                <Chrome size={20} />
                Pentadbir (Google)
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-risda-border"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-black tracking-[4px]">
                  <span className="bg-risda-card px-4 text-risda-muted italic">E-Portal Staff</span>
                </div>
              </div>

              {/* Staff Login Form */}
              <form onSubmit={handleStaffLogin} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-risda-muted uppercase tracking-[3px] px-1">Nama / ID Staff / Email</label>
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-risda-gold/50" />
                    <input 
                      type="text" 
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Contoh: Ali / RS-1002"
                      className="w-full bg-risda-dark/40 border border-risda-border rounded-xl py-3.5 pl-12 pr-4 text-xs text-risda-text focus:outline-none focus:border-risda-gold/40 transition-all placeholder-risda-muted shadow-inner"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-risda-muted uppercase tracking-[3px]">Kata Laluan</label>
                    <button 
                      type="button"
                      onClick={() => setShowResetModal(true)}
                      className="text-[9px] font-black text-risda-orange uppercase tracking-[1px] hover:underline transition-all"
                    >
                      Lupa Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-risda-gold/50" />
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-risda-dark/40 border border-risda-border rounded-xl py-3.5 pl-12 pr-12 text-xs text-risda-text focus:outline-none focus:border-risda-gold/40 transition-all placeholder-risda-muted shadow-inner"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-risda-muted hover:text-risda-gold transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="btn-gold w-full h-14 text-[11px] font-black uppercase tracking-[3px] shadow-2xl"
                >
                  <LogIn size={18} />
                  Log Masuk Staff
                </button>
              </form>
            </div>
          </div>

          <div className="p-5 bg-risda-dark/60 border-t border-risda-border flex items-center justify-center gap-3">
            <ShieldCheck size={18} className="text-risda-gold" />
            <span className="text-[10px] text-risda-muted font-black uppercase tracking-[3px]">Secure Protocol Active</span>
          </div>
        </div>

        <div className="text-center">
          <button 
            onClick={() => {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="text-[11px] text-risda-gold/60 font-bold uppercase tracking-[3px] hover:text-risda-gold transition-colors inline-flex items-center gap-3"
          >
            Dashboard Awam
            <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-risda-card border border-risda-border rounded-3xl overflow-hidden shadow-2xl p-8"
            >
              <button 
                onClick={() => setShowResetModal(false)}
                className="absolute right-6 top-6 text-risda-muted hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-risda-text tracking-tight">Lupa Kata Laluan?</h3>
                  <p className="text-xs text-risda-muted font-medium">Sila masukkan e-mel anda. Kami akan menghantar makluman kepada Pentadbir Sistem untuk tindakan selanjutnya.</p>
                </div>

                <form onSubmit={handleResetRequest} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-risda-muted uppercase tracking-[3px] px-1">E-mel Berdaftar</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-risda-gold/50" />
                      <input 
                        type="email" 
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="nama@email.com"
                        className="w-full bg-risda-dark/40 border border-risda-border rounded-xl py-3.5 pl-12 pr-4 text-xs text-risda-text focus:outline-none focus:border-risda-gold/40 transition-all placeholder-risda-muted shadow-inner"
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={resetLoading}
                    className="btn-gold w-full h-14 text-[11px] font-black uppercase tracking-[3px] shadow-2xl flex items-center justify-center gap-3"
                  >
                    {resetLoading ? (
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        <ArrowRight size={18} />
                        Hantar ke Pentadbir
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
