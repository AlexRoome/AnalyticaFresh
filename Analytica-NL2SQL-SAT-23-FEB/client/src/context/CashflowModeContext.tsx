import React, { createContext, useContext, useState, ReactNode } from "react";

interface CashflowModeContextType {
  cashflowMode: boolean;
  setCashflowMode: React.Dispatch<React.SetStateAction<boolean>>;
}

const CashflowModeContext = createContext<CashflowModeContextType | undefined>(undefined);

export function useCashflowMode() {
  const context = useContext(CashflowModeContext);
  if (!context) {
    throw new Error("useCashflowMode must be used within a CashflowModeProvider");
  }
  return context;
}

interface Props {
  children: ReactNode;
}

export function CashflowModeProvider({ children }: Props) {
  const [cashflowMode, setCashflowMode] = useState(true);

  return (
    <CashflowModeContext.Provider value={{ cashflowMode, setCashflowMode }}>
      {children}
    </CashflowModeContext.Provider>
  );
}
