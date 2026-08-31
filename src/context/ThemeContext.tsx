import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'custom' | 'emerald' | 'sunset' | 'black';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('risda-theme');
    return (saved as Theme) || 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('custom-theme', 'emerald-theme', 'sunset-theme', 'light-theme', 'black-theme');
    
    if (theme === 'custom') {
      root.classList.add('custom-theme');
    } else if (theme === 'emerald') {
      root.classList.add('emerald-theme');
    } else if (theme === 'sunset') {
      root.classList.add('sunset-theme');
    } else if (theme === 'black') {
      root.classList.add('black-theme');
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
