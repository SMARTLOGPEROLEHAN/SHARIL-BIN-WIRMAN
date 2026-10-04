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
import LoginPage from './components/LoginPage';
import DecorationBackground from './components/DecorationBackground';
import StaffManagement from './components/StaffManagement';
import TenderManagement from './components/TenderManagement';
import AttendanceList from './components/AttendanceList';
import LocationManagement from './components/LocationManagement';
import ReportPanel from './components/ReportPanel';
import InfoPortal from './components/InfoPortal';
import SessionGuard from './components/SessionGuard';
import SupplierInvitation from './components/SupplierInvitation';
import OrderRequestManagement from './components/OrderRequestManagement';
import AllocationCodeManagement from './components/AllocationCodeManagement';
import DirectAwardBudgetBook from './components/DirectAwardBudgetBook';
import AttendanceAndSubmission from './components/AttendanceAndSubmission';
import UserInfo from './components/UserInfo';
import DirectAwardDashboard from './components/DirectAwardDashboard';
import DirectAwardGuide from './components/DirectAwardGuide';
import DirectAwardManagement from './components/DirectAwardManagement';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ModuleProvider, useProcurementModule } from './context/ModuleContext';
import PublicAttendancePage from './components/PublicAttendancePage';
import PublicLetterPage from './components/PublicLetterPage';
import AttendanceNotificationModal from './components/AttendanceNotificationModal';
import NewAdNotificationBanner from './components/NewAdNotificationBanner';
import QRScannerModal from './components/QRScannerModal';
import { OfflineIndicator } from './components/OfflineIndicator';

function AppContent() {
  const { user, role } = useAuth();
  const { activeModule } = useProcurementModule();
  const [view, setView] = useState<'dashboard' | 'login' | 'staff' | 'tenders' | 'attendance' | 'laporan' | 'info' | 'locations' | 'userInfo' | 'projek' | 'keputusan' | 'attendance-records' | 'pelawaan' | 'permintaan' | 'peruntukan' | 'panduan-tt'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [adIdParam, setAdIdParam] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('adId');
  });
  const [letterParam, setLetterParam] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('viewLetter');
  });
  const [companyParam, setCompanyParam] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('company');
  });
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  useEffect(() => {
    const handleOpenQRScanner = () => {
      setIsQRScannerOpen(true);
    };

    window.addEventListener('triggerQRScanner', handleOpenQRScanner);
    return () => window.removeEventListener('triggerQRScanner', handleOpenQRScanner);
  }, []);

  // Sync search parameters to detect if we have adId, viewLetter, etc.
  useEffect(() => {
    const checkParams = () => {
      const params = new URLSearchParams(window.location.search);
      setAdIdParam(params.get('adId'));
      setLetterParam(params.get('viewLetter'));
      setCompanyParam(params.get('company'));
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

  const handleBackToLetterPortal = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('viewLetter');
    url.searchParams.delete('company');
    window.history.replaceState({}, '', url.pathname + url.search);
    setLetterParam(null);
    setCompanyParam(null);
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
      } else if (path === '/pelawaan-sebutharga') {
        setView('pelawaan');
      } else if (path === '/urus-permintaan-pesanan') {
        setView('permintaan');
      } else if (path === '/kod-peruntukan') {
        setView('peruntukan');
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
      } else if (path === '/panduan-tawaran-terus') {
        setView('panduan-tt');
      } else if (path === '/tt-permohonan') {
        setView('tt-permohonan');
      } else if (path === '/tt-pelawaan') {
        setView('tt-pelawaan');
      } else if (path === '/tt-tawaran') {
        setView('tt-tawaran');
      } else if (path === '/tt-penilaian') {
        setView('tt-penilaian');
      } else if (path === '/tt-pemilihan') {
        setView('tt-pemilihan');
      } else if (path === '/tt-pesanan') {
        setView('tt-pesanan');
      } else if (path === '/tt-laporan') {
        setView('tt-laporan');
      } else {
        setView('dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);
    handlePopState();

    const handleModuleChanged = () => {
      // If user switches module while on root or certain subroutes, ensure view is responsive
      if (window.location.pathname === '/') {
        setView('dashboard');
      }
    };
    window.addEventListener('moduleChanged', handleModuleChanged);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('moduleChanged', handleModuleChanged);
    };
  }, []);

  if (letterParam) {
    return (
      <>
        <PublicLetterPage 
          invitationId={letterParam}
          companyName={companyParam}
          onBackToPortal={handleBackToLetterPortal}
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
      case 'pelawaan':
        return <SupplierInvitation />;
      case 'permintaan':
        return <OrderRequestManagement />;
      case 'peruntukan':
        if (activeModule === 'tawaran_terus') {
          return <DirectAwardBudgetBook />;
        }
        return <AllocationCodeManagement />;
      case 'attendance':
        return <AttendanceList />;
      case 'laporan':
        return <ReportPanel />;
      case 'locations':
        return <LocationManagement />;
      case 'info':
        return <InfoPortal />;
      case 'panduan-tt':
        return <DirectAwardGuide />;
      case 'tt-permohonan':
        return <DirectAwardManagement activeSection="permohonan" />;
      case 'tt-pelawaan':
        return <DirectAwardManagement activeSection="pelawaan" />;
      case 'tt-tawaran':
        return <DirectAwardManagement activeSection="tawaran" />;
      case 'tt-penilaian':
        return <DirectAwardManagement activeSection="penilaian" />;
      case 'tt-pemilihan':
        return <DirectAwardManagement activeSection="pemilihan" />;
      case 'tt-pesanan':
        return <DirectAwardManagement activeSection="pesanan" />;
      case 'tt-laporan':
        return <DirectAwardManagement activeSection="laporan" />;
      case 'projek':
        return (
          <div className="w-full pt-10">
            <ProjectFilters showRegistration={false} initialStatus="AKTIF" sourceContext="projek" />
          </div>
        );
      case 'keputusan':
        return (
          <div className="w-full pt-10">
            <ProjectFilters showRegistration={false} initialStatus="SELESAI (KEPUTUSAN)" sourceContext="keputusan" />
          </div>
        );
      case 'attendance-records':
        return <AttendanceAndSubmission />;
      case 'userInfo':
        return <UserInfo />;
      default:
        // When activeModule is Tawaran Terus and user is staff, show DirectAwardDashboard
        if (isStaff && activeModule === 'tawaran_terus') {
          return (
            <div className="w-full space-y-8">
              <DirectAwardDashboard />
            </div>
          );
        }

        return (
          <div className="w-full space-y-8">
            <Hero />
            <div id="main-content" />
            <ProjectFilters initialStatus="AKTIF" sourceContext="dashboard" />
          </div>
        );
    }
  };

  const isAdmin = role === 'admin' || role === 'pentadbir';
  const isStaff = role === 'penginput' || role === 'penyemak' || role === 'pelulus' || isAdmin;

  return (
    <div className="flex items-stretch bg-transparent min-h-screen text-risda-text font-sans technical-grid w-full relative">
      <DecorationBackground 
        isStaff={Boolean(isStaff)}
        isSidebarCollapsed={isSidebarCollapsed}
      />
      <SessionGuard />
      <AttendanceNotificationModal />
      <NewAdNotificationBanner />
      <QRScannerModal 
        isOpen={isQRScannerOpen} 
        onClose={() => setIsQRScannerOpen(false)} 
      />
      {isStaff && (
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
          collapsed={isSidebarCollapsed}
          setCollapsed={setIsSidebarCollapsed}
        />
      )}
      
      <div className="flex-1 flex flex-col min-h-screen relative min-w-0">
        <Header onMenuClick={isStaff ? () => setIsSidebarOpen(true) : undefined} />
        
        <main className="flex-1 p-4 md:p-6 lg:p-10 bg-transparent overflow-x-hidden relative border-t border-risda-border">
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
      </div>

      <OfflineIndicator />
      <Toaster 
        position="top-center"
        toastOptions={{
          className: 'bg-risda-card text-risda-text border border-risda-border rounded-2xl font-bold uppercase tracking-wider text-xs p-4 shadow-xl',
          duration: 4000,
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ModuleProvider>
          <AppContent />
        </ModuleProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
