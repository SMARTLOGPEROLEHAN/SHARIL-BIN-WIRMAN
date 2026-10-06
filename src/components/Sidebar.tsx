import { 
  Home, 
  Megaphone, 
  Trophy, 
  BarChart3, 
  LogIn,
  UserCog,
  Edit3,
  Users,
  ChevronLeft,
  Menu as MenuIcon,
  BookOpen,
  MapPin,
  Mail,
  ShoppingBag,
  Coins,
  FileCheck,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  ClipboardList,
  BookOpenCheck,
  Scale,
  Inbox,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProcurementModule } from '../context/ModuleContext';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';

interface SidebarItemProps {
  icon: typeof Home;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  subItems?: { label: string; active: boolean; onClick: () => void }[];
}

const SidebarItem = ({ icon: Icon, label, active, collapsed, onClick, subItems }: SidebarItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (active || (subItems && subItems.some(s => s.active))) {
      setIsExpanded(true);
    }
  }, [active, subItems]);

  const handleClick = () => {
    if (subItems && !collapsed) {
      setIsExpanded(!isExpanded);
    }
    onClick?.();
  };

  return (
    <div className="flex flex-col gap-1 relative">
      <button 
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`flex items-center gap-2.5 px-3 py-1.5 sm:py-2 rounded-xl text-[12px] font-bold transition-all duration-300 group relative w-full text-left overflow-hidden
          ${active 
            ? 'bg-risda-orange/15 border border-risda-orange/40 text-risda-text font-black shadow-sm sidebar-item-active-text' 
            : 'text-risda-text-secondary hover:text-risda-text hover:bg-black/5 dark:hover:bg-white/[0.08] border border-transparent'
          }`}
      >
        {active && (
          <motion.div 
            layoutId="sidebar-glow"
            className="absolute inset-0 bg-gradient-to-r from-risda-orange/15 to-transparent pointer-events-none"
          />
        )}
        <div className="relative z-10 shrink-0">
          <Icon 
            size={collapsed ? 20 : 17} 
            className={active ? 'text-risda-orange' : 'text-risda-muted group-hover:text-risda-orange transition-all duration-300'} 
          />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              className="relative z-10 tracking-tight whitespace-nowrap flex items-center justify-between flex-1"
            >
              <span className="font-extrabold">{label}</span>
              {subItems && (
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  className="ml-auto opacity-70"
                >
                  <ChevronLeft size={14} className="-rotate-90" />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Floating Tooltip for Collapsed Sidebar */}
      <AnimatePresence>
        {collapsed && isHovered && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className="fixed left-[90px] bg-risda-card border border-risda-border px-5 py-3 rounded-2xl shadow-xl z-[1000] pointer-events-none whitespace-nowrap"
          >
            <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-4 h-4 bg-risda-card border-l border-b border-risda-border rotate-45" />
            <span className="text-risda-text text-[13px] font-black uppercase tracking-[2px]">{label}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub Items */}
      <AnimatePresence>
        {subItems && isExpanded && !collapsed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden flex flex-col pl-12 gap-1"
          >
            {subItems.map((item, idx) => (
              <button
                key={idx}
                onClick={item.onClick}
                className={`text-left py-2 text-[11px] font-bold uppercase tracking-widest transition-all hover:text-risda-orange relative
                  ${item.active ? 'text-risda-gold font-black' : 'text-risda-muted hover:text-risda-text'}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${item.active ? 'bg-risda-gold' : 'bg-risda-border'}`} />
                  {item.label}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  setCollapsed?: (val: boolean) => void;
}

export default function Sidebar({ isOpen, onClose, collapsed: propCollapsed, setCollapsed: propSetCollapsed }: SidebarProps) {
  const { user, role, district } = useAuth();
  const { activeModule, setActiveModule } = useProcurementModule();
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const collapsed = propCollapsed !== undefined ? propCollapsed : localCollapsed;
  const setCollapsed = propSetCollapsed !== undefined ? propSetCollapsed : setLocalCollapsed;
  const [loginHovered, setLoginHovered] = useState(false);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [currentHash, setCurrentHash] = useState(window.location.hash);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleHash = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const isAdmin = role === 'admin' || role === 'pentadbir';
  const isStaff = role === 'penginput' || role === 'penyemak' || role === 'pelulus' || isAdmin;

  const navigateTo = (path: string, hash?: string) => {
    onClose?.();
    window.history.pushState({}, '', path);
    if (hash) {
      window.location.hash = hash;
    } else {
      // Clear hash if not provided
      window.history.pushState("", document.title, window.location.pathname + window.location.search);
      // Trigger manually
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const currentPath = window.location.pathname;

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Desktop Column Spacer & Continuous Background Pillar (Kekalkan 1 warna penuh ke bawah tanpa terpotong) */}
      {isStaff && (
        <div 
          className={`hidden lg:block shrink-0 transition-all duration-300 bg-risda-sidebar border-r border-risda-border self-stretch min-h-screen sidebar-pillar ${collapsed ? 'w-[80px]' : 'w-[280px]'}`}
          aria-hidden="true"
        />
      )}

      {/* Fixed Sidebar Viewport Element */}
      <motion.aside 
        initial={false}
        animate={isDesktop ? { 
          width: collapsed ? 80 : 280
        } : { 
          width: 280,
          x: isOpen ? 0 : -280
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`bg-risda-sidebar border-r border-risda-border flex flex-col shrink-0 transition-colors duration-300 fixed left-0 top-0 bottom-0 h-screen z-40 overflow-hidden
          ${isOpen 
            ? 'z-[70] flex w-[280px]' 
            : (isStaff ? 'hidden lg:flex' : 'hidden')
          }
        `}
      >
        <div className="h-full w-full flex flex-col relative overflow-hidden bg-risda-sidebar">
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-16 w-6 h-6 bg-risda-orange text-white rounded-full flex items-center justify-center border border-white/20 shadow-md transform scale-0 group-hover/sidebar:scale-100 transition-transform z-50 hover:scale-110 active:scale-95 cursor-pointer"
            title={collapsed ? "Kembangkan Menu" : "Kecilkan Menu"}
          >
            {collapsed ? <MenuIcon size={12} /> : <ChevronLeft size={12} />}
          </button>

          <div className="flex-1 flex flex-col p-2.5 sm:p-3 w-full overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden bg-risda-sidebar">
            {/* Brand Logo */}
            <div 
              className={`flex ${collapsed ? 'items-center justify-center' : 'flex-col items-center justify-center gap-2'} mb-4 cursor-pointer p-1 group/logo relative shrink-0 w-full text-center`}
              onClick={() => setCollapsed(!collapsed)}
              onMouseEnter={() => collapsed && setIsLogoHovered(true)}
              onMouseLeave={() => setIsLogoHovered(false)}
            >
              {/* Logo eTapak on Top */}
              {!collapsed ? (
                <div className="w-full flex items-center justify-center pt-1 pb-0.5">
                  <img 
                    src="/logo-etapak.png" 
                    alt="Logo eTapak SMART LOG PEROLEHAN" 
                    className="w-28 max-w-[125px] h-auto max-h-16 object-contain drop-shadow-md group-hover/logo:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.includes('logo%20etapak.png') && !target.src.endsWith('logo etapak.png')) {
                        target.src = '/logo etapak.png';
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="w-11 h-11 bg-gradient-to-br from-risda-orange/20 to-risda-gold/20 border border-risda-orange/40 rounded-xl p-1.5 flex items-center justify-center shadow-md relative group-hover/logo:scale-110 transition-all duration-300 mx-auto">
                  <img 
                    src="/logo-etapak.png" 
                    alt="Logo eTapak" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.includes('logo%20etapak.png') && !target.src.endsWith('logo etapak.png')) {
                        target.src = '/logo etapak.png';
                      }
                    }}
                  />
                </div>
              )}

              {/* SMART LOG PEROLEHAN Badge Centered Underneath Logo */}
              {!collapsed && (
                <div className="w-auto px-3.5 h-8 bg-gradient-to-br from-risda-orange to-risda-gold rounded-xl flex items-center justify-center text-white font-black italic shrink-0 shadow-md relative group-hover/logo:scale-105 transition-all duration-300 mx-auto">
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/logo:opacity-100 transition-opacity rounded-xl" />
                  <span className="text-[9.5px] whitespace-nowrap relative z-10 tracking-tight font-poppins">
                    SMART LOG PEROLEHAN
                  </span>
                </div>
              )}

              <AnimatePresence>
                {collapsed && isLogoHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: 20, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.9 }}
                    className="fixed left-[90px] bg-risda-card border border-risda-border px-4 py-3 rounded-2xl shadow-xl z-[1000] pointer-events-none whitespace-nowrap flex items-center gap-3"
                  >
                    <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-4 h-4 bg-risda-card border-l border-b border-risda-border rotate-45" />
                    <img 
                      src="/logo-etapak.png" 
                      alt="Logo eTapak" 
                      className="w-9 h-9 object-contain"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.includes('logo%20etapak.png')) {
                          target.src = '/logo etapak.png';
                        }
                      }}
                    />
                    <div className="flex flex-col">
                      <span className="text-risda-text text-[12px] font-black uppercase tracking-[2px]">SMART LOG</span>
                      <span className="text-risda-gold text-[10px] font-black uppercase tracking-[1.5px]">PEROLEHAN</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!collapsed && (
                <motion.div 
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col w-full items-center text-center mt-1 px-1"
                >
                  <span className="text-2xl font-black tracking-[-0.05em] text-risda-text uppercase italic leading-none border-b border-risda-orange/30 pb-1 mb-1 font-editorial-heading w-full text-center">
                    RISDA
                  </span>
                  <span className="text-[9px] text-risda-gold font-black tracking-[1.5px] uppercase whitespace-nowrap text-center">
                    {isAdmin ? 'PENTADBIR SISTEM (SEMUA PEJABAT)' : `DAERAH ${district ? district.toUpperCase() : 'BEAUFORT'}`}
                  </span>
                </motion.div>
              )}
            </div>

            <nav className="flex-1 flex flex-col gap-2.5">
              {/* MODULE: SEBUTHARGA */}
              {activeModule === 'sebutharga' ? (
                <>
                  <div className="space-y-0.5">
                    {!collapsed && (
                      <div className="text-[9px] text-risda-muted font-black uppercase tracking-[1.5px] mb-1 px-2">Papan Pemuka Sebutharga</div>
                    )}
                    <SidebarItem icon={Home} label="PUSAT DASHBOARD" active={currentPath === '/'} collapsed={collapsed} onClick={() => navigateTo('/')} />
                    {isStaff && (
                      <>
                        <SidebarItem icon={Megaphone} label="IKLAN SEBUTHARGA" active={currentPath === '/projek'} collapsed={collapsed} onClick={() => navigateTo('/projek')} />
                        <SidebarItem icon={Trophy} label="KEPUTUSAN RASMI" active={currentPath === '/keputusan'} collapsed={collapsed} onClick={() => navigateTo('/keputusan')} />
                        <SidebarItem icon={Users} label="KEHADIRAN & SERAHAN" active={currentPath === '/rekod-kehadiran'} collapsed={collapsed} onClick={() => navigateTo('/rekod-kehadiran')} />
                        <SidebarItem icon={Users} label="DATA KEHADIRAN" active={currentPath === '/data-kehadiran'} collapsed={collapsed} onClick={() => navigateTo('/data-kehadiran')} />
                        <SidebarItem 
                          icon={BarChart3} 
                          label="LAPORAN SEBUTHARGA" 
                          active={currentPath === '/laporan' && (!currentHash || currentHash === '')} 
                          collapsed={collapsed} 
                          onClick={() => navigateTo('/laporan')} 
                          subItems={[
                            { 
                              label: 'LAPORAN SUKUAN BULANAN', 
                              active: currentHash === '#sukuan', 
                              onClick: () => navigateTo('/laporan', 'sukuan')
                            },
                            { 
                              label: 'LAPORAN TAHUNAN', 
                              active: currentHash === '#tahunan', 
                              onClick: () => navigateTo('/laporan', 'tahunan')
                            }
                          ]}
                        />
                      </>
                    )}
                  </div>

                  {isStaff && (
                    <div className="space-y-0.5">
                      {!collapsed && (
                        <div className="text-[9px] text-risda-muted font-black uppercase tracking-[1.5px] mb-1 px-2">Kawalan Operasi Sebutharga</div>
                      )}
                      <SidebarItem icon={Edit3} label="URUS SEBUT HARGA" active={currentPath === '/urus-sebut-harga'} collapsed={collapsed} onClick={() => navigateTo('/urus-sebut-harga')} />
                      <SidebarItem icon={Mail} label="PELAWAAN SEBUTHARGA" active={currentPath === '/pelawaan-sebutharga'} collapsed={collapsed} onClick={() => navigateTo('/pelawaan-sebutharga')} />
                      <SidebarItem icon={ShoppingBag} label="URUS PERMINTAAN PESANAN" active={currentPath === '/urus-permintaan-pesanan'} collapsed={collapsed} onClick={() => navigateTo('/urus-permintaan-pesanan')} />
                      <SidebarItem 
                        icon={Coins} 
                        label="KOD PERUNTUKAN" 
                        active={currentPath === '/kod-peruntukan'} 
                        collapsed={collapsed} 
                        onClick={() => navigateTo('/kod-peruntukan')} 
                        subItems={[
                          { 
                            label: 'PENGELASAN KOD PERUNTUKAN', 
                            active: currentPath === '/kod-peruntukan' && (!currentHash || currentHash === '' || currentHash === '#pengelasan'), 
                            onClick: () => navigateTo('/kod-peruntukan', 'pengelasan')
                          },
                          { 
                            label: 'LAPORAN PERUNTUKAN TERPERINCI', 
                            active: currentPath === '/kod-peruntukan' && (currentHash === '#terperinci' || currentHash === '#laporan'), 
                            onClick: () => navigateTo('/kod-peruntukan', 'terperinci')
                          }
                        ]}
                      />
                    </div>
                  )}
                </>
              ) : (
                /* MODULE: TAWARAN TERUS */
                <>
                  <div className="space-y-0.5">
                    {!collapsed && (
                      <div className="text-xs text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider mb-1.5 px-2.5">Papan Pemuka Tawaran Terus</div>
                    )}
                    <SidebarItem 
                      icon={Home} 
                      label="DASHBOARD TAWARAN TERUS" 
                      active={currentPath === '/'} 
                      collapsed={collapsed} 
                      onClick={() => navigateTo('/')} 
                    />

                    {/* 📋 PERMOHONAN */}
                    <SidebarItem 
                      icon={FileText} 
                      label="PERMOHONAN" 
                      active={currentPath === '/tt-permohonan'} 
                      collapsed={collapsed} 
                      onClick={() => navigateTo('/tt-permohonan')}
                    />

                    {/* 📢 PELAWAAN */}
                    <SidebarItem 
                      icon={Megaphone} 
                      label="PELAWAAN" 
                      active={currentPath === '/tt-pelawaan'} 
                      collapsed={collapsed} 
                      onClick={() => navigateTo('/tt-pelawaan')}
                    />

                    {/* 📥 TAWARAN PEMBEKAL */}
                    <SidebarItem 
                      icon={Inbox} 
                      label="TAWARAN PEMBEKAL" 
                      active={currentPath === '/tt-tawaran'} 
                      collapsed={collapsed} 
                      onClick={() => navigateTo('/tt-tawaran')}
                    />

                    {/* ⚖️ PENILAIAN */}
                    <SidebarItem 
                      icon={Scale} 
                      label="PENILAIAN" 
                      active={currentPath === '/tt-penilaian'} 
                      collapsed={collapsed} 
                      onClick={() => navigateTo('/tt-penilaian')}
                    />

                    {/* 🏆 PEMILIHAN PEMBEKAL */}
                    <SidebarItem 
                      icon={Trophy} 
                      label="PEMILIHAN PEMBEKAL" 
                      active={currentPath === '/tt-pemilihan'} 
                      collapsed={collapsed} 
                      onClick={() => navigateTo('/tt-pemilihan')}
                    />

                    {/* 📄 PESANAN / LO */}
                    <SidebarItem 
                      icon={FileCheck} 
                      label="PESANAN / LO" 
                      active={currentPath === '/tt-pesanan'} 
                      collapsed={collapsed} 
                      onClick={() => navigateTo('/tt-pesanan')}
                    />

                    {/* 📊 LAPORAN */}
                    <SidebarItem 
                      icon={BarChart3} 
                      label="LAPORAN" 
                      active={currentPath === '/tt-laporan'} 
                      collapsed={collapsed} 
                      onClick={() => navigateTo('/tt-laporan')}
                    />
                  </div>

                  {/* KAWALAN OPERASI */}
                  <div className="space-y-0.5 pt-2">
                    {!collapsed && (
                      <div className="text-xs text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider mb-1.5 px-2.5">Kawalan Operasi</div>
                    )}

                    {/* DATA PEMBEKAL */}
                    <SidebarItem 
                      icon={Users} 
                      label="DATA PEMBEKAL" 
                      active={currentPath === '/pelawaan-sebutharga'} 
                      collapsed={collapsed} 
                      onClick={() => navigateTo('/pelawaan-sebutharga', 'pembekal')} 
                    />

                    {/* PANDUAN TAWARAN TERUS */}
                    <SidebarItem 
                      icon={BookOpenCheck} 
                      label="PANDUAN TAWARAN TERUS" 
                      active={currentPath === '/panduan-tawaran-terus'} 
                      collapsed={collapsed} 
                      onClick={() => navigateTo('/panduan-tawaran-terus')} 
                    />

                    {/* BUKU VOT & PERUNTUKAN */}
                    <SidebarItem 
                      icon={Coins} 
                      label="BUKU VOT & PERUNTUKAN" 
                      active={currentPath === '/kod-peruntukan'} 
                      collapsed={collapsed} 
                      onClick={() => navigateTo('/kod-peruntukan')} 
                    />
                  </div>
                </>
              )}

              {/* Kawalan Sistem (Hanya Dipaparkan Untuk Modul Sebutharga) */}
              {activeModule === 'sebutharga' && (
                <div className="space-y-0.5">
                  {!collapsed && (
                    <div className="text-xs text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider mb-1.5 px-2.5">Kawalan Sistem</div>
                  )}
                  <SidebarItem icon={BookOpen} label="INFO PORTAL" active={currentPath === '/info'} collapsed={collapsed} onClick={() => navigateTo('/info')} />
                  {isStaff && (
                    <SidebarItem icon={UserCog} label="URUS KAKITANGAN" active={currentPath === '/urus-staff'} collapsed={collapsed} onClick={() => navigateTo('/urus-staff')} />
                  )}
                  {isAdmin && (
                    <SidebarItem icon={MapPin} label="URUS KAWASAN" active={currentPath === '/urus-kawasan'} collapsed={collapsed} onClick={() => navigateTo('/urus-kawasan')} />
                  )}
                </div>
              )}
            </nav>

            {!user && (
              <div className="relative">
                <button 
                  onClick={() => navigateTo('/login')}
                  onMouseEnter={() => setLoginHovered(true)}
                  onMouseLeave={() => setLoginHovered(false)}
                  className={`my-3 flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-risda-text-secondary hover:text-risda-text hover:bg-black/5 dark:hover:bg-white/[0.05] transition-all ${collapsed ? 'justify-center' : ''}`}
                >
                  <LogIn size={collapsed ? 18 : 15} />
                  {!collapsed && <span>AKSES STAFF</span>}
                </button>

                <AnimatePresence>
                  {collapsed && loginHovered && (
                    <motion.div
                      initial={{ opacity: 0, x: 20, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 20, scale: 0.9 }}
                      className="fixed left-[90px] bg-risda-card border border-risda-border px-5 py-3 rounded-2xl shadow-xl z-[1000] pointer-events-none whitespace-nowrap"
                    >
                      <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-4 h-4 bg-risda-card border-l border-b border-risda-border rotate-45" />
                      <span className="text-risda-text text-[13px] font-black uppercase tracking-[3px]">AKSES STAFF</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

          </div>

          {/* Dedicated Fixed Footer: Status Sistem (1 Warna Sepenuhnya, Tidak Terpotong) */}
          <div className="p-2.5 pt-2 pb-3 shrink-0 bg-risda-sidebar">
            {!collapsed ? (
              <div className="p-2 bg-white/[0.05] rounded-xl border border-white/10 shadow-xs">
                <div className="text-[8px] text-risda-gold font-black uppercase tracking-widest mb-0.5">STATUS SISTEM</div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-xs animate-pulse shrink-0" />
                  <span className="text-[9px] text-slate-200 font-black uppercase tracking-wider whitespace-nowrap">DATA TERJAMIN</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-1">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-xs animate-pulse" title="STATUS: DATA TERJAMIN" />
              </div>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  );
}
