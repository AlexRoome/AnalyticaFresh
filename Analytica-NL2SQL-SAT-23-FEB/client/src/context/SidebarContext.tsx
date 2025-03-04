import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  // New: share slideIndex across app
  slideIndex: number;
  setSlideIndex: (index: number) => void;
  // New: two pane view state
  isTwoPane: boolean;
  setIsTwoPane: (twoPane: boolean) => void;
  // Dark mode state
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export function useSidebarContext() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebarContext must be used within a SidebarProvider");
  }
  return context;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true); // default sidebar open

  // Track slideIndex, persist in localStorage
  const [slideIndex, setSlideIndexState] = useState<number>(() => {
    const savedIndex = localStorage.getItem("swipeIndex");
    return savedIndex ? parseInt(savedIndex, 10) : 0;
  });

  useEffect(() => {
    localStorage.setItem("swipeIndex", String(slideIndex));
  }, [slideIndex]);

  const setSlideIndex = (newIndex: number) => {
    setSlideIndexState(newIndex);
  };

  // New: two pane view state (default false)
  const [isTwoPane, setIsTwoPane] = useState(false);
  
  // Dark mode state with localStorage persistence
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedMode = localStorage.getItem("darkMode");
    return savedMode ? savedMode === "true" : false; // default to light mode
  });
  
  // Initialize dark mode on page load
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [isDarkMode]);
  
  // Toggle dark mode and save to localStorage
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem("darkMode", String(newMode));
  };

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        setIsOpen,
        slideIndex,
        setSlideIndex,
        isTwoPane,
        setIsTwoPane,
        isDarkMode,
        toggleDarkMode,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
