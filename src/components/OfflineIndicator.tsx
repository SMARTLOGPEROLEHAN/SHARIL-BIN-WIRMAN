import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 rounded-xl bg-amber-600/95 backdrop-blur-md px-4 py-2 text-xs font-bold text-white shadow-xl border border-amber-400/30 animate-pulse">
      <WifiOff size={14} />
      <span>Mod Luar Talian — Data dicapai daripada memori peranti anda.</span>
    </div>
  );
}
