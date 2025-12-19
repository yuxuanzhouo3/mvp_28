'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { DEFAULT_LANGUAGE } from '../config';

interface LanguageContextType {
  currentLanguage: string;
  setCurrentLanguage: (lang: string) => void;
  isDomesticVersion: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Edition (domestic / international) is fixed by env default language
  const isDomesticVersion = DEFAULT_LANGUAGE === 'zh';

  // Keep per-deployment language so CN / EN sites don't override each other
  const storageKey = `mornGPT-language-${DEFAULT_LANGUAGE}`;

  // Initialize UI language with env default; user can override
  const [currentLanguage, setCurrentLanguage] = useState<string>(DEFAULT_LANGUAGE);
  
  // Load saved language from localStorage if available
  useEffect(() => {
    const savedLanguage = localStorage.getItem(storageKey);
    if (savedLanguage === 'zh' || savedLanguage === 'en') {
      setCurrentLanguage(savedLanguage);
    }
  }, [storageKey]);
  
  // Save language to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(storageKey, currentLanguage);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = currentLanguage;
    }
  }, [currentLanguage, storageKey]);
  
  return (
    <LanguageContext.Provider value={{ currentLanguage, setCurrentLanguage, isDomesticVersion }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
