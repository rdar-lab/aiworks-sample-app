import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

interface UIContextType {
  lightMode: boolean;
  setLightMode: (v: boolean) => void;
  errorMessage: string | null;
  showError: (msg: string, err?: any) => void;
  clearError: () => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (v: boolean) => void;
  isContextModalOpen: boolean;
  setIsContextModalOpen: (v: boolean) => void;
  isHistoryModalOpen: boolean;
  setIsHistoryModalOpen: (v: boolean) => void;
}

const UIContext = createContext<UIContextType | null>(null);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lightMode, setLightMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = useCallback((msg: string, err?: any) => {
    console.error(msg, err);
    const fullMsg = err ? `${msg}: ${err.message}` : msg;
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setErrorMessage(fullMsg);
    errorTimerRef.current = setTimeout(() => setErrorMessage(null), 30000);
  }, []);

  const clearError = useCallback(() => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setErrorMessage(null);
  }, []);

  return (
    <UIContext.Provider value={{
      lightMode, setLightMode,
      errorMessage, showError, clearError,
      isMobileMenuOpen, setIsMobileMenuOpen,
      isContextModalOpen, setIsContextModalOpen,
      isHistoryModalOpen, setIsHistoryModalOpen,
    }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = (): UIContextType => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
};
