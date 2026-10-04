import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Mail, Lock, ArrowRight, AlertCircle, Eye, EyeOff, X, User } from 'lucide-react';
import { signInWithGoogle, auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, addDoc, Timestamp, query, where, getDocs, limit, updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
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
      // 1. Try sending the automated reset password email directly via Firebase
      let authMailSent = false;
      try {
        await sendPasswordResetEmail(auth, resetEmail.trim());
        authMailSent = true;
      } catch (authMailErr: any) {
        console.warn('Direct Auth Reset Email send warning/failed:', authMailErr);
      }

      // 2. Log request in system notifications so Admin is also looped in
      await addDoc(collection(db, 'notifications'), {
        type: 'reset_password',
        userId: 'anonymous',
        userName: 'Permohonan Reset',
        userEmail: resetEmail.trim(),
        message: `Memohon reset kata laluan untuk akaun: ${resetEmail.trim()}`,
        status: 'pending',
        createdAt: Timestamp.now()
      });

      if (authMailSent) {
        toast.success('Pautan reset kata laluan telah dihantar ke e-mel anda! Permintaan juga direkodkan untuk pentadbir.', { duration: 6000 });
      } else {
        toast.success('Permintaan reset kata laluan telah dihantar ke Pentadbir Sistem untuk tindakan manual.');
      }
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
        let snapshot = await getDocs(qEmail);
        if (!snapshot.empty) {
          dbUserDoc = snapshot.docs[0].data();
          dbUserDocId = snapshot.docs[0].id;
        } else {
          // Fallback to case-insensitive client-side search across first 100 documents
          const qAll = query(usersRef, limit(100));
          const allSnap = await getDocs(qAll);
          const foundDoc = allSnap.docs.find(d => {
            const data = d.data();
            return (data.email || '').toLowerCase() === targetEmail.trim().toLowerCase();
          });
          if (foundDoc) {
            targetEmail = foundDoc.data().email;
            dbUserDoc = foundDoc.data();
            dbUserDocId = foundDoc.id;
          }
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
              
              // Ensure primary document at users/${res.user.uid} contains all staff profile details
              await setDoc(doc(db, 'users', res.user.uid), {
                ...dbUserDoc,
                uid: res.user.uid,
                updatedAt: Timestamp.now()
              }, { merge: true });

              // Clean up duplicate old document ID if different
              if (dbUserDocId && dbUserDocId !== res.user.uid) {
                await deleteDoc(doc(db, 'users', dbUserDocId)).catch(() => null);
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
        className="w-full max-w-md space-y-7 relative z-10"
      >
        {/* Brand */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-2.5 h-24 w-24 group transition-transform duration-500 mx-auto">
            <img 
              src="/PUBLIC/intrologo_RISDA.png" 
              alt="RISDA" 
              className="w-full h-full object-contain filter drop-shadow-md transition-transform duration-500 group-hover:scale-105" 
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.src.includes("/api/logo") && !img.src.endsWith("/api/logo")) {
                  img.src = "/api/logo";
                } else if (!img.src.includes("Logo_RISDA.png") && !img.src.includes("logo_risda.png")) {
                  img.src = "https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png";
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-poppins text-risda-text">
              SMART LOG <span className="text-risda-orange font-black">PEROLEHAN</span>
            </h1>
            <p className="text-[11px] text-risda-gold font-black uppercase tracking-[3.5px]">
              RISDA DAERAH BEAUFORT
            </p>
          </div>
        </div>

        <div className="bg-risda-card border border-risda-border rounded-2xl shadow-xl overflow-hidden transition-colors">
          <div className="p-7 sm:p-8 space-y-6">
            <div className="space-y-1 pb-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-risda-orange inline-block shrink-0" />
                <h2 className="text-base sm:text-lg font-black text-risda-text uppercase tracking-wider leading-none">
                  Akses Sistem
                </h2>
              </div>
              <p className="text-xs text-risda-text-secondary font-medium pl-4.5">
                Sila log masuk mengikut peranan akaun anda.
              </p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 font-bold flex items-center gap-2.5"
              >
                <AlertCircle size={16} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </motion.div>
            )}

            <div className="space-y-5">
              {/* Login for Admin */}
              <button 
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-12 bg-risda-card-muted/80 hover:bg-risda-card-muted border border-risda-border hover:border-risda-orange/60 text-risda-text font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center transition-all active:scale-[0.99] disabled:opacity-50 shadow-sm cursor-pointer"
              >
                <span>Pentadbir Sistem</span>
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-risda-border"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-[2.5px]">
                  <span className="bg-risda-card px-3 text-risda-text-secondary/70">Portal Kakitangan</span>
                </div>
              </div>

              {/* Staff Login Form */}
              <form onSubmit={handleStaffLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-risda-text uppercase tracking-wider block">
                    Nama / ID Staf / E-mel
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-risda-orange shrink-0 pointer-events-none" />
                    <input 
                      type="text" 
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Contoh: Ali / RS-1002"
                      className="w-full bg-risda-card-muted/60 border border-risda-border rounded-xl py-3 pl-10 pr-4 text-xs sm:text-sm text-risda-text font-medium focus:outline-none focus:border-risda-orange focus:ring-2 focus:ring-risda-orange/20 transition-all placeholder:text-risda-text-secondary/50 shadow-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-risda-text uppercase tracking-wider">
                      Kata Laluan
                    </label>
                    <button 
                      type="button"
                      onClick={() => setShowResetModal(true)}
                      className="text-[11px] font-bold text-risda-orange hover:text-risda-orange-hover hover:underline transition-colors cursor-pointer"
                    >
                      Lupa Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-risda-orange shrink-0 pointer-events-none" />
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-risda-card-muted/60 border border-risda-border rounded-xl py-3 pl-10 pr-10 text-xs sm:text-sm text-risda-text font-medium focus:outline-none focus:border-risda-orange focus:ring-2 focus:ring-risda-orange/20 transition-all placeholder:text-risda-text-secondary/50 shadow-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-risda-text-secondary/70 hover:text-risda-orange transition-colors cursor-pointer p-1"
                      title={showPassword ? "Sembunyi kata laluan" : "Papar kata laluan"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="btn-gold w-full h-12 text-xs font-black uppercase tracking-[2.5px] rounded-xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-50 shadow-md cursor-pointer pt-0.5"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn size={17} />
                      <span>Log Masuk Staf</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="text-center pt-1">
          <button 
            onClick={() => {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="text-xs text-risda-orange hover:text-risda-orange-hover font-bold uppercase tracking-wider hover:underline transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Dashboard Awam</span>
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
              className="relative w-full max-w-sm bg-risda-card border border-risda-border rounded-2xl overflow-hidden shadow-2xl p-7"
            >
              <button 
                onClick={() => setShowResetModal(false)}
                className="absolute right-5 top-5 text-risda-text-secondary/70 hover:text-risda-text transition-colors p-1"
              >
                <X size={20} />
              </button>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-risda-text tracking-tight uppercase">Lupa Kata Laluan?</h3>
                  <p className="text-xs text-risda-text-secondary font-medium">Sila masukkan e-mel anda. Kami akan menghantar makluman kepada Pentadbir Sistem untuk tindakan selanjutnya.</p>
                </div>

                <form onSubmit={handleResetRequest} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-risda-text uppercase tracking-wider block">E-mel Berdaftar</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-risda-orange pointer-events-none" />
                      <input 
                        type="email" 
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="nama@email.com"
                        className="w-full bg-risda-card-muted/60 border border-risda-border rounded-xl py-3 pl-10 pr-4 text-xs text-risda-text font-medium focus:outline-none focus:border-risda-orange focus:ring-2 focus:ring-risda-orange/20 transition-all placeholder:text-risda-text-secondary/50 shadow-sm"
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={resetLoading}
                    className="btn-gold w-full h-12 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {resetLoading ? (
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <ArrowRight size={17} />
                        <span>Hantar ke Pentadbir</span>
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
