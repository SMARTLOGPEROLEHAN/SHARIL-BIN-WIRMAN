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
  Coins
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
    if (active) {
      setIsExpanded(true);
    }
  }, [active]);

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
  const isStaff = role === 'penginput' || role === 'pelulus' || isAdmin;

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
              className={`flex ${collapsed ? 'items-center justify-center' : 'flex-col items-start gap-2'} mb-3 cursor-pointer p-1 group/logo relative shrink-0`}
              onClick={() => setCollapsed(!collapsed)}
              onMouseEnter={() => collapsed && setIsLogoHovered(true)}
              onMouseLeave={() => setIsLogoHovered(false)}
            >
              {collapsed ? (
                <div className="w-11 h-11 bg-[#070e1d] rounded-xl border border-risda-gold/50 flex items-center justify-center overflow-hidden shadow-lg p-1 relative group-hover/logo:scale-105 group-hover/logo:border-risda-gold transition-all duration-300">
                  <img 
                    src="/smartlog-logo.png" 
                    alt="SMART LOG PEROLEHAN" 
                    className="w-full h-full object-cover object-center rounded-lg"
                    onError={(e) => {
                      e.currentTarget.src = "/photo_6325549721438589280_y.jpg";
                    }}
                  />
                </div>
              ) : (
                <div className="w-full h-24 bg-[#070e1d] rounded-2xl border border-risda-gold/50 shadow-xl overflow-hidden relative group-hover/logo:border-risda-gold transition-all duration-300 p-1.5 flex items-center justify-center">
                  <img 
                    src="/smartlog-logo.png" 
                    alt="SMART LOG PEROLEHAN" 
                    className="w-full h-full object-contain object-center transition-transform duration-500 group-hover/logo:scale-105"
                    onError={(e) => {
                      e.currentTarget.src = "/photo_6325549721438589280_y.jpg";
                    }}
                  />
                </div>
              )}

              <AnimatePresence>
                {collapsed && isLogoHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: 20, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.9 }}
                    className="fixed left-[90px] bg-[#071326] border border-risda-gold/60 p-2.5 rounded-2xl shadow-2xl z-[1000] pointer-events-none flex items-center gap-3 whitespace-nowrap"
                  >
                    <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-[#071326] border-l border-b border-risda-gold/60 rotate-45" />
                    <img src="/smartlog-logo.png" alt="SMART LOG PEROLEHAN" className="w-12 h-12 object-contain rounded-xl border border-risda-gold/40 bg-black/60 p-0.5" />
                    <div className="flex flex-col pr-2">
                      <span className="text-white text-[12px] font-black uppercase tracking-[2px]">SMART LOG</span>
                      <span className="text-risda-gold text-[10px] font-black uppercase tracking-[1.5px]">PEROLEHAN</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!collapsed && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col w-full pl-1 mt-0.5"
                >
                  <div className="flex items-center justify-between border-b border-risda-orange/30 pb-1 mb-1">
                    <span className="text-2xl font-black tracking-[-0.05em] text-risda-text uppercase italic leading-none font-editorial-heading">
                      RISDA
                    </span>
                    <span className="text-[8px] bg-risda-orange/20 text-risda-orange border border-risda-orange/40 font-black px-1.5 py-0.5 rounded">
                      E-PEROLEHAN
                    </span>
                  </div>
                  <span className="text-[9px] text-risda-gold font-black tracking-[1.2px] uppercase whitespace-nowrap">
                    {isAdmin ? 'PENTADBIR SISTEM (SEMUA PEJABAT)' : `DAERAH ${district ? district.toUpperCase() : 'BEAUFORT'}`}
                  </span>
                </motion.div>
              )}
            </div>

            <nav className="flex-1 flex flex-col gap-2.5">
              <div className="space-y-0.5">
                {!collapsed && (
                  <div className="text-[9px] text-risda-muted font-black uppercase tracking-[1.5px] mb-1 px-2">Papan Pemuka</div>
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
                    <SidebarItem icon={BookOpen} label="INFO PORTAL" active={currentPath === '/info'} collapsed={collapsed} onClick={() => navigateTo('/info')} />
                  </>
                )}
              </div>

              {isStaff && (
                <div className="space-y-0.5">
                  {!collapsed && (
                    <div className="text-[9px] text-risda-muted font-black uppercase tracking-[1.5px] mb-1 px-2">Kawalan Operasi</div>
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

              {isStaff && (
                <div className="space-y-0.5">
                  {!collapsed && (
                    <div className="text-[9px] text-risda-muted font-black uppercase tracking-[1.5px] mb-1 px-2">Kawalan Sistem</div>
                  )}
                  <SidebarItem icon={UserCog} label="URUS KAKITANGAN" active={currentPath === '/urus-staff'} collapsed={collapsed} onClick={() => navigateTo('/urus-staff')} />
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
