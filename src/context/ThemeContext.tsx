import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'executive' | 'custom';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('risda-theme');
    if (saved && ['executive', 'custom'].includes(saved)) {
      return saved as Theme;
    }
    return 'executive';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('executive-theme', 'natural-theme', 'custom-theme', 'emerald-theme', 'light-theme', 'black-theme', 'dark-theme', 'dark');
    
    if (theme === 'executive') {
      root.classList.add('executive-theme');
    } else if (theme === 'custom') {
      root.classList.add('custom-theme', 'dark');
    }
    
    localStorage.setItem('risda-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
