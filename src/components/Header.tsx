import { Search, Bell, User, Menu, LogOut, LifeBuoy, AlertCircle, CheckCircle2, Clock, X, Mail, Shield, Smartphone, MapPin, Briefcase, UserCheck, Moon, Sun, Palette } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { logOut, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, Timestamp, getDoc } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AppNotification {
  id: string;
  type: 'reset_password' | 'technical_support';
  userId: string;
  userName: string;
  userEmail: string;
  message: string;
  status: 'pending' | 'resolved';
  createdAt: any;
}

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, role, district } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const isAdmin = role === 'admin' || role === 'pentadbir';
  const isStaff = role === 'penginput' || role === 'pelulus' || isAdmin;
  const { theme, setTheme } = useTheme();

  // Helper for Initials - Improved to handle single words better
  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.split(' ').filter(n => n.length > 0);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase(); // Take first 2 letters for single name
    }
    return parts
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  useEffect(() => {
    if (!user) {
      setUserData(null);
      return;
    }
    
    // Use onSnapshot for reactive user data (e.g. photoURL changes)
    const qId = user.uid;
    const sanEmail = user.email ? user.email.replace(/[^a-zA-Z0-9]/g, '_') : qId;
    
    // We try both UID and emailSlug as IDs
    const unsubscribe = onSnapshot(doc(db, 'users', qId), (snapshot) => {
      if (snapshot.exists()) {
        setUserData(snapshot.data());
      } else if (user.email) {
        // Fallback to email slug
        const unsubEmail = onSnapshot(doc(db, 'users', sanEmail), (snapEmail) => {
           if (snapEmail.exists()) {
             setUserData(snapEmail.data());
           }
        });
        return () => unsubEmail();
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(
      collection(db, 'notifications'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: AppNotification[] = [];
      snapshot.forEach((doc) => {
        notifs.push({ id: doc.id, ...doc.data() } as AppNotification);
      });
      setNotifications(notifs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const resolveNotification = async (id: string) => {
    const path = `notifications/${id}`;
    try {
      await updateDoc(doc(db, 'notifications', id), {
        status: 'resolved',
        resolvedAt: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleLoginClick = () => {
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleLogout = async () => {
    try {
      await logOut();
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <header className="h-20 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-risda-sidebar/30 backdrop-blur-3xl z-40 shrink-0 sticky top-0 shadow-[0_1px_40px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-6">
        {isStaff ? (
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 text-risda-orange hover:text-white transition-colors"
          >
            <Menu size={24} />
          </button>
        ) : (
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white tracking-tight leading-none group-hover:text-risda-orange transition-colors font-poppins">
                SMART LOG PEROLEHAN
              </span>
              <span className="text-[8px] text-risda-gold font-bold tracking-widest leading-none mt-1">
                RISDA DAERAH {district ? district.toUpperCase() : 'BEAUFORT'}
              </span>
            </div>
          </div>
        )}
        
        {user && isStaff && (
          <div className="relative group hidden sm:block">
            <Search 
              size={14} 
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-risda-orange transition-colors" 
            />
            <input 
              placeholder="Carian pantas sistem..." 
              className="bg-white/5 border border-white/5 text-[11px] font-medium rounded-xl pl-12 pr-6 py-2.5 w-[300px] lg:w-[400px] focus:outline-none focus:border-risda-orange/20 text-white placeholder-white/20 transition-all focus:bg-white/[0.08]"
              type="text"
            />
          </div>
        )}
      </div>

       <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 text-risda-muted relative">
          {/* RISDA Gold Logo next to helper utilities */}
          <div className="w-10 h-10 bg-white/5 border border-white/10 p-1.5 rounded-xl flex items-center justify-center shadow-lg hover:bg-white/10 transition-all overflow-hidden hidden sm:flex">
            <img 
              src="/PUBLIC/intrologo_RISDA.png" 
              alt="RISDA" 
              className="w-full h-full object-contain filter drop-shadow-sm" 
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

          {/* Technical Support Notification Icon */}
          {isAdmin && (
            <div className="flex items-center gap-3">
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`relative p-2.5 rounded-xl transition-all ${
                    notifications.length > 0 
                    ? 'bg-risda-orange/10 text-risda-orange border border-risda-orange/20' 
                    : 'bg-white/5 border border-white/5 hover:text-white hover:border-white/10'
                  }`}
                  title="Bantuan & Sokongan"
                >
                  <LifeBuoy size={20} className={notifications.length > 0 ? "animate-pulse" : ""} />
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-risda-sidebar" />
                  )}
                </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-[320px] bg-risda-card border border-risda-border rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-50 p-2"
                  >
                    <div className="p-4 border-b border-risda-border flex items-center justify-between">
                      <p className="text-[10px] font-black text-white uppercase tracking-[2px]">Bantuan & Sokongan</p>
                      <span className="bg-risda-orange/20 text-risda-orange px-2 py-0.5 rounded text-[8px] font-black uppercase">
                        {notifications.length} Menunggu
                      </span>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-10 text-center space-y-3">
                          <CheckCircle2 className="mx-auto text-risda-muted opacity-20" size={32} />
                          <p className="text-[10px] text-risda-muted font-bold uppercase tracking-widest leading-relaxed">Semua urusan telah selesai.</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div key={notif.id} className="p-4 hover:bg-white/[0.03] transition-colors rounded-2xl group flex gap-3">
                            <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                              notif.type === 'reset_password' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {notif.type === 'reset_password' ? <AlertCircle size={18} /> : <LifeBuoy size={18} />}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex justify-between items-start">
                                <p className="text-[10px] font-black text-white leading-none uppercase">{notif.userName}</p>
                                <div className="flex items-center gap-1 text-[8px] text-risda-muted font-bold">
                                  <Clock size={8} />
                                  <span>Baru Sahaja</span>
                                </div>
                              </div>
                              <p className="text-[9px] text-risda-muted leading-relaxed line-clamp-2">{notif.message}</p>
                              <div className="flex items-center gap-4 pt-2">
                                <button 
                                  onClick={() => {
                                    // Navigate to Staff Management with email context
                                    const searchParams = new URLSearchParams();
                                    if (notif.userEmail) searchParams.set('email', notif.userEmail);
                                    window.history.pushState({}, '', `/urus-staff?${searchParams.toString()}`);
                                    window.dispatchEvent(new PopStateEvent('popstate'));
                                    setShowNotifications(false);
                                  }}
                                  className="text-[8px] font-black text-blue-400 uppercase tracking-[1.5px] hover:text-white transition-colors"
                                >
                                  Uruskan
                                </button>
                                <button 
                                  onClick={() => resolveNotification(notif.id)}
                                  className="text-[8px] font-black text-risda-orange uppercase tracking-[1.5px] hover:text-white transition-colors"
                                >
                                  Tandakan Selesai
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Theme Switcher */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-2xl p-1 shrink-0">
            <button 
              onClick={() => setTheme('dark')}
              className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'bg-risda-orange shadow-[0_0_15px_rgba(var(--risda-orange-rgb),0.4)] text-white' : 'text-risda-muted hover:text-risda-orange'}`}
              title="Modern"
            >
              <Moon size={14} />
            </button>
            <button 
              onClick={() => setTheme('custom')}
              className={`p-2 rounded-xl transition-all ${theme === 'custom' ? 'bg-risda-orange shadow-[0_0_15px_rgba(var(--risda-orange-rgb),0.4)] text-white' : 'text-risda-muted hover:text-risda-orange'}`}
              title="Klasik"
            >
              <Palette size={14} />
            </button>
          </div>

          <button className="relative p-2 hover:text-white transition-colors">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-risda-orange rounded-full border-2 border-risda-sidebar" />
          </button>
        </div>

        <div className="h-8 w-px bg-risda-border hidden md:block"></div>

        <div className="flex items-center gap-4 group">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-white group-hover:text-risda-orange transition-colors leading-none tracking-tight">
                  {userData?.displayName || userData?.staffId || user.displayName || 'Kakitangan'}
                </p>
                <p className="text-[9px] text-risda-gold font-black uppercase mt-1 tracking-widest bg-risda-gold/10 px-2 py-0.5 rounded border border-risda-gold/20">
                  {role === 'admin' || role === 'pentadbir' ? 'PENTADBIR' : role === 'penginput' ? 'PENGINPUT' : 'PELULUS'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleLogout}
                  className="w-10 h-10 bg-risda-card border border-risda-border rounded-xl flex items-center justify-center text-risda-muted hover:text-red-400 hover:border-red-400/30 transition-all shadow-lg order-2 sm:order-1"
                  title="Log Keluar"
                >
                  <LogOut size={18} />
                </button>
                <button 
                  onClick={() => setShowProfileDetails(true)}
                  className="w-10 h-10 bg-gradient-to-tr from-risda-orange to-risda-gold rounded-xl shadow-xl flex items-center justify-center group-hover:scale-105 transition-all order-1 sm:order-2"
                >
                  {userData?.photoURL || user.photoURL ? (
                    <img src={userData?.photoURL || user.photoURL || ''} alt="User" className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    <span className="text-black font-black text-sm">
                      {getInitials(userData?.displayName || user.displayName || 'K')}
                    </span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 cursor-pointer" onClick={handleLoginClick}>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-white group-hover:text-risda-orange transition-colors leading-none uppercase tracking-widest">
                  Log Masuk
                </p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-risda-orange" />
                  <p className="text-[9px] text-risda-muted font-bold uppercase tracking-[1px]">
                    OFFLINE
                  </p>
                </div>
              </div>
              <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center group-hover:border-risda-orange/50 transition-all">
                <User size={22} className="text-white" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile Details Dropdown */}
      <AnimatePresence>
        {showProfileDetails && (
          <>
            <div 
              className="fixed inset-0 z-[90]" 
              onClick={() => setShowProfileDetails(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-4 top-20 w-72 bg-risda-card border border-risda-border rounded-3xl overflow-hidden shadow-2xl z-[100]"
            >
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4 border-b border-risda-border pb-6">
                  <div className="w-14 h-14 bg-gradient-to-tr from-risda-orange to-risda-gold rounded-2xl flex items-center justify-center text-black font-black text-xl shadow-lg overflow-hidden shrink-0">
                    {userData?.photoURL ? (
                      <img src={userData.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(userData?.displayName || user?.displayName || 'K')
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white uppercase tracking-tight truncate">
                      {userData?.displayName || user?.displayName || 'Kakitangan'}
                    </p>
                    <p className="text-[9px] text-risda-gold font-black uppercase tracking-widest mt-1">
                      {userData?.staffId || 'TIADA ID'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-black/20 border border-risda-border rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-400">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <p className="text-[8px] text-risda-muted font-black uppercase tracking-widest mb-0.5">Pejabat Bertugas</p>
                      <p className="text-xs text-white font-bold">{userData?.office || 'HQ RISDA'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-2">
                  <button 
                    onClick={() => {
                      setShowProfileDetails(false);
                      window.dispatchEvent(new CustomEvent('lock-system'));
                    }}
                    className="w-full h-12 flex items-center justify-center gap-3 bg-risda-orange text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-risda-gold transition-all"
                  >
                    <Shield size={16} />
                    Kunci Sistem (Lock)
                  </button>
                  <button 
                    onClick={() => {
                      setShowProfileDetails(false);
                      logOut();
                    }}
                    className="w-full h-12 flex items-center justify-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
                  >
                    <LogOut size={16} />
                    Log Keluar
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
