// GstModeContext.tsx

import React, { createContext, useContext, useState, ReactNode } from "react";

interface GstModeContextValue {
  gstMode: string;
  setGstMode: (mode: string) => void;
}

const GstModeContext = createContext<GstModeContextValue | undefined>(undefined);

export const GstModeProvider = ({ children }: { children: ReactNode }) => {
  // Change default from "incl" to "excl"
  const [gstMode, setGstMode] = useState("excl");
  return (
    <GstModeContext.Provider value={{ gstMode, setGstMode }}>
      {children}
    </GstModeContext.Provider>
  );
};

export const useGstMode = () => {
  const context = useContext(GstModeContext);
  if (!context) {
    throw new Error("useGstMode must be used within a GstModeProvider");
  }
  return context;
};
