import { Search, Bell, User, Menu, LogOut, LifeBuoy, AlertCircle, CheckCircle2, Clock, X, Mail, Shield, Smartphone, MapPin, Briefcase, UserCheck, Moon, Sun, Palette, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { logOut, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, Timestamp, getDoc } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { isOfficeMatch } from './AttendanceNotificationModal';
import PWAInstallPrompt from './PWAInstallPrompt';

interface AppNotification {
  id: string;
  type: 'reset_password' | 'technical_support' | 'ATTENDANCE_SUBMITTED';
  userId?: string;
  userName?: string;
  companyName?: string;
  ownerName?: string;
  adTitle?: string;
  userEmail?: string;
  message: string;
  status: 'pending' | 'resolved';
  createdAt: any;
}

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, role, office: userOffice, district } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
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
    let unsubEmail: (() => void) | null = null;
    const unsubscribe = onSnapshot(doc(db, 'users', qId), (snapshot) => {
      if (snapshot.exists()) {
        setUserData(snapshot.data());
      } else if (user.email) {
        // Fallback to email slug
        unsubEmail = onSnapshot(doc(db, 'users', sanEmail), (snapEmail) => {
           if (snapEmail.exists()) {
             setUserData(snapEmail.data());
           }
        }, (err) => {
          console.warn('Fallback user snapshot note:', err);
        });
      }
    }, (err) => {
      console.warn('User snapshot note:', err);
    });

    return () => {
      unsubscribe();
      if (unsubEmail) unsubEmail();
    };
  }, [user]);

  useEffect(() => {
    if (!isStaff) return;

    const q = query(
      collection(db, 'notifications'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: AppNotification[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as AppNotification;
        if (data.type === 'ATTENDANCE_SUBMITTED') {
          if (isAdmin || isOfficeMatch(userOffice, (data as any).office)) {
            notifs.push({ id: docSnap.id, ...data });
          }
        } else {
          notifs.push({ id: docSnap.id, ...data });
        }
      });
      setNotifications(notifs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [isStaff, isAdmin, userOffice]);

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
    <header className="h-20 border-b border-risda-border flex items-center justify-between px-4 md:px-8 bg-risda-sidebar/90 backdrop-blur-xl z-40 shrink-0 sticky top-0 shadow-sm">
      <div className="flex items-center gap-6">
        {isStaff ? (
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 text-risda-orange hover:text-risda-text transition-colors"
          >
            <Menu size={24} />
          </button>
        ) : (
          <div 
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}
          >
            <div className="w-8 h-8 rounded-lg bg-[#070e1d] border border-risda-gold/40 flex items-center justify-center overflow-hidden p-0.5 shrink-0 shadow-sm group-hover:border-risda-gold transition-colors">
              <img 
                src="/smartlog-logo.png" 
                alt="SMART LOG" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = "/photo_6325549721438589280_y.jpg";
                }}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-risda-text tracking-tight leading-none group-hover:text-risda-orange transition-colors font-poppins">
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
              className="absolute left-4 top-1/2 -translate-y-1/2 text-risda-muted group-focus-within:text-risda-orange transition-colors" 
            />
            <input 
              placeholder="Carian pantas sistem..." 
              className="bg-risda-card border border-risda-border text-[11px] font-medium rounded-xl pl-12 pr-6 py-2.5 w-[300px] lg:w-[400px] focus:outline-none focus:border-risda-orange text-risda-text placeholder:text-risda-muted transition-all"
              type="text"
            />
          </div>
        )}
      </div>

       <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 text-risda-muted relative">
          {/* RISDA Gold Logo next to helper utilities */}
          <div className="w-10 h-10 bg-risda-card border border-risda-border p-1.5 rounded-xl flex items-center justify-center shadow-sm hover:border-risda-orange/30 transition-all overflow-hidden hidden sm:flex">
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

          {/* Staff System Notifications Icon */}
          {isStaff && (
            <div className="flex items-center gap-3">
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`relative p-2.5 rounded-xl transition-all ${
                    notifications.length > 0 
                    ? 'bg-risda-orange/10 text-risda-orange border border-risda-orange/30' 
                    : 'bg-risda-card border border-risda-border text-risda-text hover:border-risda-orange/40'
                  }`}
                  title="Pemberitahuan Sistem"
                >
                  <Bell size={20} className={notifications.length > 0 ? "animate-bounce text-amber-500" : "text-risda-text-secondary"} />
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-risda-sidebar animate-pulse" />
                  )}
                </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="header-dropdown-solid absolute right-0 mt-4 w-[340px] border border-[#1E3F73] rounded-3xl shadow-2xl overflow-hidden z-50 p-2"
                    style={{ 
                      backgroundColor: '#061D38', 
                      opacity: 1, 
                      backdropFilter: 'none', 
                      WebkitBackdropFilter: 'none' 
                    }}
                  >
                    <div className="p-4 border-b border-risda-border flex items-center justify-between">
                      <p className="text-[10px] font-black text-risda-text uppercase tracking-[2px]">Pemberitahuan Kakitangan</p>
                      <span className="bg-amber-500/20 text-amber-600 px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                        {notifications.length} Menunggu
                      </span>
                    </div>

                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-10 text-center space-y-3">
                          <CheckCircle2 className="mx-auto text-risda-muted opacity-20" size={32} />
                          <p className="text-[10px] text-risda-muted font-bold uppercase tracking-widest leading-relaxed">Tiada pemberitahuan baharu.</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div key={notif.id} className="p-3.5 hover:bg-black/5 dark:hover:bg-white/[0.03] transition-colors rounded-2xl group flex gap-3 border-b border-risda-border last:border-b-0">
                            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                              notif.type === 'ATTENDANCE_SUBMITTED' ? 'bg-amber-500/20 text-amber-600 border border-amber-500/30' : notif.type === 'reset_password' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'
                            }`}>
                              {notif.type === 'ATTENDANCE_SUBMITTED' ? <UserCheck size={18} /> : notif.type === 'reset_password' ? <AlertCircle size={18} /> : <LifeBuoy size={18} />}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex justify-between items-start">
                                <p className="text-[10px] font-black text-risda-text leading-none uppercase">{notif.companyName || notif.userName || 'PEMBERITAHUAN'}</p>
                                <div className="flex items-center gap-1 text-[8px] text-risda-muted font-bold">
                                  <Clock size={8} />
                                  <span>Terkini</span>
                                </div>
                              </div>
                              <p className="text-[9px] text-risda-muted leading-relaxed line-clamp-2">{notif.message}</p>
                              <div className="flex items-center gap-4 pt-1.5">
                                {notif.type === 'ATTENDANCE_SUBMITTED' ? (
                                  <button 
                                    onClick={() => {
                                      window.history.pushState({}, '', '/rekod-kehadiran');
                                      window.dispatchEvent(new PopStateEvent('popstate'));
                                      setShowNotifications(false);
                                      resolveNotification(notif.id);
                                    }}
                                    className="text-[8px] font-black text-amber-600 uppercase tracking-[1.5px] hover:text-amber-700 transition-colors"
                                  >
                                    Lihat Kehadiran
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => {
                                      const searchParams = new URLSearchParams();
                                      if (notif.userEmail) searchParams.set('email', notif.userEmail);
                                      window.history.pushState({}, '', `/urus-staff?${searchParams.toString()}`);
                                      window.dispatchEvent(new PopStateEvent('popstate'));
                                      setShowNotifications(false);
                                    }}
                                    className="text-[8px] font-black text-blue-600 uppercase tracking-[1.5px] hover:text-blue-700 transition-colors"
                                  >
                                    Uruskan
                                  </button>
                                )}
                                <button 
                                  onClick={() => resolveNotification(notif.id)}
                                  className="text-[8px] font-black text-risda-muted uppercase tracking-[1.5px] hover:text-risda-text transition-colors ml-auto"
                                >
                                  Selesai
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

        {/* PWA Mobile App Install Prompt */}
        <PWAInstallPrompt />

        {/* Theme Switcher with Expanded Options */}
        <div className="relative shrink-0">
          <button 
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="p-2.5 bg-risda-card border border-risda-border rounded-xl hover:text-risda-text hover:border-risda-orange/40 transition-all flex items-center gap-2 text-xs font-black uppercase tracking-wider text-risda-text shadow-sm"
            title="Pilihan Tema Sistem"
          >
            <Palette size={16} className="text-risda-orange" />
            <span className="hidden md:inline text-risda-muted">Tema: </span>
            <span className="text-risda-text font-black">
              {theme === 'executive' ? 'Executive Theme' : theme === 'natural' ? 'Earthy Theme' : 'Gold Theme'}
            </span>
          </button>

          <AnimatePresence>
            {showThemeMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowThemeMenu(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="header-dropdown-solid absolute right-0 mt-2 w-[300px] rounded-2xl shadow-2xl overflow-hidden z-[9999] p-3 space-y-2.5 border"
                  style={{ 
                    backgroundColor: '#061D38', 
                    backgroundImage: 'none',
                    opacity: 1, 
                    backdropFilter: 'none', 
                    WebkitBackdropFilter: 'none',
                    boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.95), 0 0 0 1.5px rgba(30, 63, 115, 0.8)'
                  }}
                >
                  <div className="px-1 py-1 border-b border-white/10 flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#F4B41A]/20 text-[#F4B41A] flex items-center justify-center shadow-inner">
                        <Palette size={14} className="text-[#F4B41A]" />
                      </div>
                      <span className="text-[11px] font-black text-[#F4B41A] uppercase tracking-[2px] block leading-none">
                        Pilihan Tema
                      </span>
                    </div>
                    <span className="text-[9px] font-black text-[#F4B41A] bg-[#F4B41A]/10 border border-[#F4B41A]/30 px-2 py-0.5 rounded-full">
                      3 Tema
                    </span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { 
                        id: 'executive' as const, 
                        name: 'Executive Theme', 
                        colors: ['#061B3A', '#1557B0', '#F4B41A'] 
                      },
                      { 
                        id: 'natural' as const, 
                        name: 'Earthy Theme', 
                        colors: ['#555E40', '#B35232', '#FAF8F5'] 
                      },
                      { 
                        id: 'custom' as const, 
                        name: 'Gold Theme', 
                        colors: ['#0A0F1D', '#F4B41A', '#233352'] 
                      },
                    ].map((t) => {
                      const isSelected = theme === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setTheme(t.id);
                            setShowThemeMenu(false);
                          }}
                          className={`w-full px-3.5 py-3 rounded-xl transition-all text-left relative overflow-hidden group cursor-pointer border ${
                            isSelected 
                              ? 'border-2 border-[#F4B41A] shadow-lg' 
                              : 'border-white/10 hover:border-white/30'
                          }`}
                          style={{
                            backgroundColor: isSelected ? '#0E335E' : '#08172B',
                            borderColor: isSelected ? '#F4B41A' : 'rgba(255, 255, 255, 0.12)',
                            opacity: 1,
                          }}
                        >
                          <div className="flex items-center justify-between gap-3 relative z-10">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[13px] font-black tracking-wide leading-tight truncate ${isSelected ? 'text-[#F4B41A]' : 'text-white group-hover:text-[#F4B41A] transition-colors'}`}>
                                {t.name}
                              </span>
                              {isSelected && (
                                <span className="px-1.5 py-0.5 rounded bg-[#F4B41A] text-[#061D38] text-[8px] font-black uppercase tracking-wider shrink-0 shadow-sm">
                                  AKTIF
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2.5 shrink-0">
                              <div className="flex items-center -space-x-1.5">
                                {t.colors.map((c, i) => (
                                  <div 
                                    key={i} 
                                    className="w-4 h-4 rounded-full border-2 border-[#061D38] shadow-md shrink-0" 
                                    style={{ backgroundColor: c }}
                                    title={c}
                                  />
                                ))}
                              </div>
                              {isSelected ? (
                                <div className="w-5 h-5 rounded-full bg-[#F4B41A] text-[#061D38] flex items-center justify-center shrink-0 shadow-md">
                                  <Check size={12} className="stroke-[3]" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border border-white/20 group-hover:border-[#F4B41A] flex items-center justify-center shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-[#F4B41A]" />
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[9px] text-slate-300 font-medium px-1">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Pertukaran Serta-Merta
                    </span>
                    <span className="text-slate-400 font-semibold">Disimpan secara automatik</span>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

          <button className="relative p-2 text-risda-muted hover:text-risda-text transition-colors">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-risda-orange rounded-full border-2 border-risda-sidebar" />
          </button>
        </div>

        <div className="h-8 w-px bg-risda-border hidden md:block"></div>

        <div className="flex items-center gap-4 group">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-risda-text group-hover:text-risda-orange transition-colors leading-none tracking-tight">
                  {userData?.displayName || userData?.staffId || user.displayName || 'Kakitangan'}
                </p>
                <p className="text-[9px] text-risda-gold font-black uppercase mt-1 tracking-widest bg-risda-gold/10 px-2 py-0.5 rounded border border-risda-gold/20">
                  {role === 'admin' || role === 'pentadbir' ? 'PENTADBIR' : role === 'penginput' ? 'PENGINPUT' : 'PELULUS'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleLogout}
                  className="w-10 h-10 bg-risda-card border border-risda-border rounded-xl flex items-center justify-center text-risda-muted hover:text-red-500 hover:border-red-400/30 transition-all shadow-sm order-2 sm:order-1"
                  title="Log Keluar"
                >
                  <LogOut size={18} />
                </button>
                <button 
                  onClick={() => setShowProfileDetails(true)}
                  className="w-10 h-10 bg-gradient-to-tr from-risda-orange to-risda-gold rounded-xl shadow-md flex items-center justify-center group-hover:scale-105 transition-all order-1 sm:order-2"
                >
                  {userData?.photoURL || user.photoURL ? (
                    <img src={userData?.photoURL || user.photoURL || ''} alt="User" className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    <span className="text-white font-black text-sm">
                      {getInitials(userData?.displayName || user.displayName || 'K')}
                    </span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 cursor-pointer" onClick={handleLoginClick}>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-risda-text group-hover:text-risda-orange transition-colors leading-none uppercase tracking-widest">
                  Log Masuk
                </p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-risda-orange" />
                  <p className="text-[9px] text-risda-muted font-bold uppercase tracking-[1px]">
                    OFFLINE
                  </p>
                </div>
              </div>
              <div className="w-10 h-10 bg-risda-card border border-risda-border rounded-xl flex items-center justify-center group-hover:border-risda-orange/50 transition-all shadow-sm">
                <User size={22} className="text-risda-text" />
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
              className="header-dropdown-solid absolute right-4 top-20 w-72 border border-[#1E3F73] rounded-3xl overflow-hidden shadow-2xl z-[100]"
              style={{ 
                backgroundColor: '#061D38', 
                opacity: 1, 
                backdropFilter: 'none', 
                WebkitBackdropFilter: 'none' 
              }}
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
