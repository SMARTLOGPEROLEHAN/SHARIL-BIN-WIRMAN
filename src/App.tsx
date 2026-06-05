/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Hero from './components/Hero';
import Stats from './components/Stats';
import ProjectFilters from './components/ProjectFilters';
import AIButton from './components/AIButton';
import LoginPage from './components/LoginPage';
import DecorationBackground from './components/DecorationBackground';
import StaffManagement from './components/StaffManagement';
import TenderManagement from './components/TenderManagement';
import AttendanceList from './components/AttendanceList';
import LocationManagement from './components/LocationManagement';
import ReportPanel from './components/ReportPanel';
import InfoPortal from './components/InfoPortal';
import SessionGuard from './components/SessionGuard';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import PublicAttendancePage from './components/PublicAttendancePage';

function AppContent() {
  const { user, role } = useAuth();
  const [view, setView] = useState<'dashboard' | 'login' | 'staff' | 'tenders' | 'attendance' | 'laporan' | 'info' | 'locations' | 'userInfo' | 'projek' | 'keputusan' | 'attendance-records'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [adIdParam, setAdIdParam] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('adId');
  });

  // Sync search parameters to detect if we have adId
  useEffect(() => {
    const checkParams = () => {
      const params = new URLSearchParams(window.location.search);
      setAdIdParam(params.get('adId'));
    };

    window.addEventListener('popstate', checkParams);
    return () => window.removeEventListener('popstate', checkParams);
  }, []);

  const handleBackToPortal = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('adId');
    window.history.replaceState({}, '', url.pathname + url.search);
    setAdIdParam(null);
  };
  
  // Simple routing logic
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/login') {
        setView('login');
      } else if (path === '/urus-staff') {
        setView('staff');
      } else if (path === '/urus-sebut-harga') {
        setView('tenders');
      } else if (path === '/data-kehadiran') {
        setView('attendance');
      } else if (path === '/laporan') {
        setView('laporan');
      } else if (path === '/info') {
        setView('info');
      } else if (path === '/info-pengguna') {
        setView('userInfo');
      } else if (path === '/urus-kawasan') {
        setView('locations');
      } else if (path === '/projek') {
        setView('projek');
      } else if (path === '/keputusan') {
        setView('keputusan');
      } else if (path === '/rekod-kehadiran') {
        setView('attendance-records');
      } else {
        setView('dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);
    handlePopState();

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (adIdParam) {
    return (
      <>
        <PublicAttendancePage 
          adId={adIdParam} 
          onBackToPortal={handleBackToPortal} 
        />
        <Toaster 
          position="top-center"
          toastOptions={{
            className: 'bg-risda-card text-white border border-white/10 rounded-2xl font-bold uppercase tracking-wider text-xs p-4',
            duration: 4000,
            style: {
              background: 'rgba(17, 20, 25, 0.95)',
              backdropFilter: 'blur(10px)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            },
          }}
        />
      </>
    );
  }

  if (view === 'login' && !user) {
    return <LoginPage />;
  }

  // Redirect to dashboard if logged in and trying to access login
  if (view === 'login' && user) {
    window.history.pushState({}, '', '/');
    setView('dashboard');
  }

  const renderView = () => {
    switch (view) {
      case 'staff':
        return <StaffManagement />;
      case 'tenders':
        return <TenderManagement />;
      case 'attendance':
        return <AttendanceList />;
      case 'laporan':
        return <ReportPanel />;
      case 'locations':
        return <LocationManagement />;
      case 'info':
        return <InfoPortal />;
      case 'projek':
        return (
          <div className="w-full pt-10">
            <ProjectFilters showRegistration={false} />
          </div>
        );
      case 'keputusan':
        return (
          <div className="w-full pt-10">
            <ProjectFilters showRegistration={false} initialStatus="SELESAI (KEPUTUSAN)" />
          </div>
        );
      case 'attendance-records':
        const AttendanceAndSubmission = lazy(() => import('./components/AttendanceAndSubmission'));
        return (
          <Suspense fallback={<div className="p-20 text-center text-risda-muted font-black animate-pulse">MEMUATKAN...</div>}>
            <AttendanceAndSubmission />
          </Suspense>
        );
      case 'userInfo':
        const UserInfo = lazy(() => import('./components/UserInfo'));
        return (
          <Suspense fallback={<div className="p-20 text-center text-risda-muted font-black animate-pulse">MEMUATKAN...</div>}>
            <UserInfo />
          </Suspense>
        );
      default:
        return (
          <div className="w-full space-y-8">
            <Hero />
            <div id="main-content" />
            <ProjectFilters />
          </div>
        );
    }
  };

  const isAdmin = role === 'admin' || role === 'pentadbir';
  const isStaff = role === 'penginput' || role === 'pelulus' || isAdmin;

  return (
    <div className="flex bg-transparent min-h-screen text-risda-text font-sans technical-grid w-full relative">
      <DecorationBackground 
        isStaff={Boolean(isStaff)}
        isSidebarCollapsed={isSidebarCollapsed}
      />
      <SessionGuard />
      {isStaff && (
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
          collapsed={isSidebarCollapsed}
          setCollapsed={setIsSidebarCollapsed}
        />
      )}
      
      <div className="flex-1 flex flex-col min-h-screen relative">
        <Header onMenuClick={isStaff ? () => setIsSidebarOpen(true) : undefined} />
        
        <main className="flex-1 p-4 md:p-6 lg:p-10 bg-risda-dark/50 backdrop-blur-sm overflow-x-hidden relative border-t border-l border-white/5 shadow-[inset_0_0_100px_rgba(0,176,255,0.03)]">
          <div className="absolute inset-0 technical-grid pointer-events-none opacity-20" />
          <motion.div 
            key={view}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full lg:max-w-none lg:px-4 overflow-x-hidden"
          >
            {renderView()}
          </motion.div>
        </main>

        <AIButton />
      </div>

      <Toaster 
        position="top-center"
        toastOptions={{
          className: 'bg-risda-card text-white border border-white/10 rounded-2xl font-bold uppercase tracking-wider text-xs p-4',
          duration: 4000,
          style: {
            background: 'rgba(17, 20, 25, 0.95)',
            backdropFilter: 'blur(10px)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
