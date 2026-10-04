import { Search, User, Menu, LogOut, AlertCircle, CheckCircle2, X, Mail, Shield, Smartphone, MapPin, Briefcase, Moon, Sun, Palette, Check, Layers, Sparkles, ShoppingBag, Megaphone, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useProcurementModule } from '../context/ModuleContext';
import { logOut, db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PWAInstallButton } from './PWAInstallButton';

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, role, district, switchRole } = useAuth();
  const { activeModule, setActiveModule } = useProcurementModule();
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showModuleMenu, setShowModuleMenu] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const isAdmin = role === 'admin' || role === 'pentadbir';
  const isStaff = role === 'penginput' || role === 'penyemak' || role === 'pelulus' || isAdmin;
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
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl p-0.5 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
              <img 
                src="/logo-etapak.png" 
                alt="Logo eTapak SMART LOG PEROLEHAN" 
                className="w-full h-full object-contain drop-shadow-sm"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.includes('logo%20etapak.png') && !target.src.endsWith('logo etapak.png')) {
                    target.src = '/logo etapak.png';
                  }
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
          <div className="flex items-center gap-3">
            {/* Module Switcher Dropdown (dibuat seperti pilihan tema untuk menjimatkan ruang) */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowModuleMenu(!showModuleMenu)}
                className="p-2.5 bg-risda-card border border-risda-border rounded-xl hover:text-risda-text hover:border-risda-orange/40 transition-all flex items-center gap-2 text-xs font-black uppercase tracking-wider text-risda-text shadow-sm cursor-pointer"
                title="Pilihan Modul Sistem"
              >
                {activeModule === 'tawaran_terus' ? (
                  <ShoppingBag size={16} className="text-amber-500" />
                ) : (
                  <Megaphone size={16} className="text-risda-orange" />
                )}
                <span className="hidden sm:inline text-risda-muted">Modul: </span>
                <span className={`font-black ${activeModule === 'tawaran_terus' ? 'text-amber-400' : 'text-risda-orange'}`}>
                  {activeModule === 'tawaran_terus' ? 'Tawaran Terus' : 'Sebutharga'}
                </span>
                <ChevronDown size={14} className={`text-risda-muted transition-transform duration-200 ${showModuleMenu ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showModuleMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowModuleMenu(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      className="header-dropdown-solid absolute left-0 mt-2 w-[270px] rounded-2xl shadow-2xl overflow-hidden z-[9999] p-2 space-y-1.5 border border-white/15"
                      style={{
                        backgroundColor: '#061D38',
                        backgroundImage: 'none',
                        opacity: 1,
                        backdropFilter: 'none',
                        WebkitBackdropFilter: 'none',
                        boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.95), 0 0 0 1.5px rgba(30, 63, 115, 0.8)'
                      }}
                    >
                      <div className="space-y-1.5">
                        {[
                          {
                            id: 'sebutharga' as const,
                            name: 'Sebutharga',
                            subtitle: 'Iklan, Kehadiran & Keputusan',
                            icon: Megaphone,
                            colorClass: 'text-risda-orange',
                            borderActive: 'border-risda-orange/60',
                          },
                          {
                            id: 'tawaran_terus' as const,
                            name: 'Tawaran Terus',
                            subtitle: 'Pembelian Terus (LPO)',
                            icon: ShoppingBag,
                            colorClass: 'text-amber-400',
                            borderActive: 'border-amber-500/60',
                          },
                        ].map((m) => {
                          const isSelected = activeModule === m.id;
                          const Icon = m.icon;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setActiveModule(m.id);
                                window.dispatchEvent(new CustomEvent('moduleChanged', { detail: m.id }));
                                setShowModuleMenu(false);
                              }}
                              className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between group cursor-pointer ${
                                isSelected
                                  ? `${m.borderActive} bg-white/10 shadow-md`
                                  : 'border-white/5 hover:border-white/20 hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white/15' : 'bg-white/5 group-hover:bg-white/10'}`}>
                                  <Icon size={16} className={isSelected ? m.colorClass : 'text-slate-400 group-hover:text-white'} />
                                </div>
                                <div>
                                  <div className={`text-xs font-black uppercase tracking-wide flex items-center gap-1.5 ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                                    {m.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-medium">
                                    {m.subtitle}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <Check size={14} className={m.colorClass} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="relative group hidden 2xl:block">
              <Search 
                size={14} 
                className="absolute left-4 top-1/2 -translate-y-1/2 text-risda-muted group-focus-within:text-risda-orange transition-colors" 
              />
              <input 
                placeholder="Carian pantas sistem..." 
                className="bg-risda-card border border-risda-border text-[11px] font-medium rounded-xl pl-12 pr-6 py-2.5 w-[220px] focus:outline-none focus:border-risda-orange text-risda-text placeholder:text-risda-muted transition-all"
                type="text"
              />
            </div>
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

          {/* Install PWA App Button */}
          <PWAInstallButton variant="header" />

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
              {theme === 'executive' ? 'Executive Dashboard' : 'Diraja Emas'}
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
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  className="header-dropdown-solid absolute right-0 mt-2 w-[260px] rounded-2xl shadow-2xl overflow-hidden z-[9999] p-2 space-y-1.5 border border-white/15"
                  style={{ 
                    backgroundColor: '#061D38', 
                    backgroundImage: 'none',
                    opacity: 1, 
                    backdropFilter: 'none', 
                    WebkitBackdropFilter: 'none',
                    boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.95), 0 0 0 1.5px rgba(30, 63, 115, 0.8)'
                  }}
                >
                  <div className="space-y-1.5">
                    {[
                      { 
                        id: 'executive' as const, 
                        name: 'Executive Dashboard', 
                        colors: ['#061B3A', '#1557B0', '#F4B41A'] 
                      },
                      { 
                        id: 'custom' as const, 
                        name: 'Diraja Emas', 
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
                          className={`w-full px-3.5 py-2.5 rounded-xl transition-all text-left flex items-center justify-between gap-3 group cursor-pointer border ${
                            isSelected 
                              ? 'border-[#F4B41A] shadow-md' 
                              : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                          }`}
                          style={{
                            backgroundColor: isSelected ? '#0E335E' : '#08172B',
                            opacity: 1,
                          }}
                        >
                          <span className={`text-[12px] font-bold tracking-wide transition-colors ${
                            isSelected ? 'text-[#F4B41A]' : 'text-white group-hover:text-[#F4B41A]'
                          }`}>
                            {t.name}
                          </span>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="flex items-center -space-x-1.5">
                              {t.colors.map((c, i) => (
                                <div 
                                  key={i} 
                                  className="w-4 h-4 rounded-full border border-[#061D38] shadow-sm shrink-0" 
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                            {isSelected ? (
                              <div className="w-5 h-5 rounded-full bg-[#F4B41A] text-[#061D38] flex items-center justify-center shrink-0 shadow-sm">
                                <Check size={12} className="stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border border-white/20 group-hover:border-[#F4B41A]/60 flex items-center justify-center shrink-0" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
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
                  {role === 'admin' || role === 'pentadbir' ? 'PENTADBIR' : role === 'penginput' ? 'PENGINPUT' : role === 'penyemak' ? 'PENYEMAK' : 'PELULUS'}
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

                  <div className="bg-black/20 border border-risda-border rounded-2xl p-3.5 space-y-1.5">
                    <p className="text-[8px] text-risda-muted font-black uppercase tracking-widest">Peranan Kakitangan (Uji Aliran Kerja)</p>
                    <select
                      value={role}
                      onChange={(e) => {
                        if (switchRole) switchRole(e.target.value as any);
                      }}
                      className="w-full bg-slate-900 border border-risda-border rounded-xl px-3 py-2 text-xs font-black uppercase text-amber-400 focus:outline-none cursor-pointer"
                    >
                      <option value="penginput">PENGINPUT (Draf & Permohonan)</option>
                      <option value="penyemak">PENYEMAK (Semakan & 3 Pembekal)</option>
                      <option value="pelulus">PELULUS (Kelulusan)</option>
                      <option value="admin">PENTADBIR (Semua Akses)</option>
                    </select>
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
