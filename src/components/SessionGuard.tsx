import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, LogOut, ArrowRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import toast from 'react-hot-toast';

const AUTO_LOCK_TIME = 10 * 60 * 1000; // 10 minutes

export default function SessionGuard() {
  const { user, role } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!isLocked && user) {
      timeoutRef.current = setTimeout(() => {
        setIsLocked(true);
        toast('Sesi dikunci kerana tidak aktif.', { icon: '🔒', duration: 5000 });
      }, AUTO_LOCK_TIME);
    }
  };

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const activityHandler = () => resetTimer();
    const manualLockHandler = () => {
      setIsLocked(true);
    };
    
    events.forEach(event => window.addEventListener(event, activityHandler));
    window.addEventListener('lock-system', manualLockHandler);
    resetTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, activityHandler));
      window.removeEventListener('lock-system', manualLockHandler);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user, isLocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLocked(false);
    toast.success('Sesi disambung semula.');
  };

  const handleLogout = async () => {
    await auth.signOut();
    setIsLocked(false);
    window.location.href = '/';
  };

  // Helper for Initials
  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.split(' ').filter(n => n.length > 0);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return parts
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) return null;

  return (
    <>
      <AnimatePresence>
        {isLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-sm bg-risda-card border border-risda-border rounded-[40px] p-10 text-center space-y-8 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-risda-orange via-risda-gold to-risda-orange" />
              
              <div className="space-y-4">
                <div className="w-24 h-24 bg-risda-orange/10 border border-risda-orange/20 rounded-full flex items-center justify-center mx-auto relative">
                  <div className="w-20 h-20 bg-gradient-to-tr from-risda-orange to-risda-gold rounded-full flex items-center justify-center text-black font-black text-3xl shadow-2xl">
                    {getInitials(user.displayName || 'Kakitangan')}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-black border-4 border-risda-card rounded-full flex items-center justify-center text-risda-orange">
                    <Lock size={14} />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">{user.displayName || 'Kakitangan'}</h2>
                  <p className="text-[10px] text-risda-muted font-bold uppercase tracking-[3px]">Sesi Dikunci (Auto-Guard)</p>
                </div>
              </div>

              <form onSubmit={handleUnlock} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black text-red-400 uppercase tracking-widest hover:bg-red-500/10 hover:border-red-500/20 transition-all"
                  >
                    <LogOut size={16} />
                    Keluar
                  </button>
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 py-4 bg-risda-orange text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-risda-gold hover:scale-[1.02] transition-all"
                  >
                    Sambung
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>

              <div className="pt-4">
                <div className="flex items-center justify-center gap-2 text-[8px] text-risda-muted font-black tracking-[2px] uppercase opacity-50">
                  <ShieldAlert size={10} />
                  SISTEM RISDA SECURITY GUARD
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
