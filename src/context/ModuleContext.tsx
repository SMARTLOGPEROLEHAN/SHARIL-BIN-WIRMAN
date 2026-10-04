import React, { createContext, useContext, useEffect, useState } from 'react';

export type ProcurementModule = 'sebutharga' | 'tawaran_terus';

interface ModuleContextType {
  activeModule: ProcurementModule;
  setActiveModule: (module: ProcurementModule) => void;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const [activeModule, setActiveModuleState] = useState<ProcurementModule>(() => {
    try {
      const saved = localStorage.getItem('risda_active_procurement_module');
      if (saved === 'tawaran_terus' || saved === 'sebutharga') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'sebutharga';
  });

  const setActiveModule = (module: ProcurementModule) => {
    setActiveModuleState(module);
    try {
      localStorage.setItem('risda_active_procurement_module', module);
    } catch {
      // ignore
    }
  };

  return (
    <ModuleContext.Provider value={{ activeModule, setActiveModule }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useProcurementModule() {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useProcurementModule must be used within a ModuleProvider');
  }
  return context;
}
