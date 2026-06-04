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
  MapPin
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
        className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[13px] font-bold transition-all duration-500 group relative w-full text-left overflow-hidden
          ${active 
            ? 'bg-risda-orange/10 border border-risda-orange/30 text-white shadow-[0_0_30px_rgba(0,176,255,0.15)]' 
            : 'text-white/70 hover:text-white hover:bg-white/[0.08] border border-transparent blur-[0.1px] hover:blur-0'
          }`}
      >
        {active && (
          <motion.div 
            layoutId="sidebar-glow"
            className="absolute inset-0 bg-gradient-to-r from-risda-orange/10 to-transparent pointer-events-none"
          />
        )}
        <div className="relative z-10 shrink-0">
          <Icon 
            size={collapsed ? 22 : 18} 
            className={active ? 'text-risda-orange drop-shadow-[0_0_10px_rgba(0,176,255,0.6)]' : 'text-risda-muted group-hover:text-risda-orange transition-all duration-300'} 
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
              <span className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] font-black">{label}</span>
              {subItems && (
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  className="ml-auto opacity-50"
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
            className="fixed left-[90px] bg-risda-sidebar border-2 border-risda-orange/30 px-5 py-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[1000] pointer-events-none whitespace-nowrap"
          >
            <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-4 h-4 bg-risda-sidebar border-l-2 border-b-2 border-risda-orange/30 rotate-45" />
            <span className="text-white text-[13px] font-black uppercase tracking-[3px] drop-shadow-lg">{label}</span>
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
                  ${item.active ? 'text-risda-gold' : 'text-risda-muted'}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1 h-1 rounded-full ${item.active ? 'bg-risda-gold shadow-[0_0_8px_rgba(0,176,255,0.5)]' : 'bg-white/10'}`} />
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
  const { user, role } = useAuth();
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const collapsed = propCollapsed !== undefined ? propCollapsed : localCollapsed;
  const setCollapsed = propSetCollapsed !== undefined ? propSetCollapsed : setLocalCollapsed;
  const [loginHovered, setLoginHovered] = useState(false);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [currentHash, setCurrentHash] = useState(window.location.hash);

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

      <motion.aside 
        initial={false}
        animate={{ 
          width: collapsed ? 80 : 280,
          x: isOpen ? 0 : (window.innerWidth < 1024 ? -280 : 0)
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`bg-risda-sidebar/95 backdrop-blur-3xl border-r border-white/5 flex flex-col p-4 shrink-0 transition-all duration-300 relative group/sidebar h-screen z-50
          ${isOpen ? 'fixed left-0 top-0 bottom-0 z-[70] flex' : (isStaff ? 'hidden lg:flex' : 'hidden')}
        `}
      >
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-gradient-to-r from-risda-orange to-risda-gold text-white rounded-full flex items-center justify-center border border-white/20 shadow-[0_0_20px_rgba(0,176,255,0.5)] transform scale-0 group-hover/sidebar:scale-100 transition-transform z-50 hover:scale-110 active:scale-95"
      >
        {collapsed ? <MenuIcon size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Brand Logo */}
      <div 
        className={`flex ${collapsed ? 'items-center justify-center' : 'flex-col items-start gap-4'} mb-12 cursor-pointer p-2 group/logo relative`}
        onClick={() => setCollapsed(!collapsed)}
        onMouseEnter={() => collapsed && setIsLogoHovered(true)}
        onMouseLeave={() => setIsLogoHovered(false)}
      >
        <div className={`${collapsed ? 'w-10 h-10' : 'w-auto px-4 h-11'} bg-gradient-to-br from-risda-orange to-risda-gold rounded-xl flex items-center justify-center text-white font-black italic shrink-0 shadow-[0_10px_25px_rgba(0,176,255,0.4)] relative group-hover/logo:scale-105 transition-all duration-500`}>
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/logo:opacity-100 transition-opacity rounded-xl" />
          <span className={`${collapsed ? 'text-lg' : 'text-[10px]'} whitespace-nowrap relative z-10 tracking-tight font-poppins`}>
            {collapsed ? 'S' : 'SMART LOG PEROLEHAN'}
          </span>
        </div>

        <AnimatePresence>
          {collapsed && isLogoHovered && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className="fixed left-[90px] bg-risda-sidebar border-2 border-risda-orange/30 px-5 py-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[1000] pointer-events-none whitespace-nowrap"
            >
              <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-4 h-4 bg-risda-sidebar border-l-2 border-b-2 border-risda-orange/30 rotate-45" />
              <div className="flex flex-col">
                <span className="text-white text-[13px] font-black uppercase tracking-[3px] drop-shadow-lg">SMART LOG</span>
                <span className="text-risda-gold text-[11px] font-black uppercase tracking-[2px]">PEROLEHAN</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!collapsed && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col w-full pl-1"
          >
            <span className="text-4xl font-black tracking-[-0.05em] text-white uppercase italic leading-none text-glow-orange border-b-2 border-risda-orange/30 pb-2 mb-2">
              RISDA
            </span>
            <span className="text-[10px] text-risda-gold font-black tracking-[2.5px] uppercase whitespace-nowrap opacity-80">
              DAERAH BEAUFORT
            </span>
          </motion.div>
        )}
      </div>

      <nav className="flex-1 flex flex-col gap-8 pr-1 custom-scrollbar">
        <div className="space-y-2">
          {!collapsed && (
            <div className="text-[10px] text-white/50 font-black uppercase tracking-[4px] mb-5 px-2">Papan Pemuka</div>
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
          <div className="space-y-1">
            {!collapsed && (
              <div className="text-[10px] text-white/50 font-black uppercase tracking-[4px] mb-5 px-2">Kawalan Operasi</div>
            )}
            <SidebarItem icon={Edit3} label="URUS SEBUT HARGA" active={currentPath === '/urus-sebut-harga'} collapsed={collapsed} onClick={() => navigateTo('/urus-sebut-harga')} />
          </div>
        )}

        {isStaff && (
          <div className="space-y-1">
            {!collapsed && (
              <div className="text-[10px] text-white/50 font-black uppercase tracking-[4px] mb-5 px-2">Kawalan Sistem</div>
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
            className={`my-6 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-risda-text-secondary hover:text-white hover:bg-white/[0.05] transition-all ${collapsed ? 'justify-center' : ''}`}
          >
            <LogIn size={collapsed ? 20 : 16} />
            {!collapsed && <span>AKSES STAFF</span>}
          </button>

          <AnimatePresence>
            {collapsed && loginHovered && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                className="fixed left-[90px] bg-risda-sidebar border-2 border-risda-orange/30 px-5 py-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[1000] pointer-events-none whitespace-nowrap"
              >
                <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-4 h-4 bg-risda-sidebar border-l-2 border-b-2 border-risda-orange/30 rotate-45" />
                <span className="text-white text-[13px] font-black uppercase tracking-[3px] drop-shadow-lg">AKSES STAFF</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {!collapsed && (
        <div className="mt-auto p-4 bg-gradient-to-b from-risda-card to-black rounded-xl border border-risda-border">
          <div className="text-[9px] text-risda-gold font-bold uppercase tracking-widest mb-1">STATUS SISTEM</div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
            <span className="text-[10px] text-white/50 font-bold uppercase">DATA TERJAMIN</span>
          </div>
        </div>
      )}
    </motion.aside>
    </>
  );
}
