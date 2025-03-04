// client/src/context/CashflowProfileContext.tsx
import React, { createContext, useContext, useState, ReactNode } from "react";
import { CashflowProfile, profiles } from "../components/costCenters/utils/CashflowProfiles";

interface CashflowProfileContextType {
  selectedProfile: CashflowProfile;
  setSelectedProfile: (profile: CashflowProfile) => void;
}

const CashflowProfileContext = createContext<CashflowProfileContextType | undefined>(undefined);

export const CashflowProfileProvider = ({ children }: { children: ReactNode }) => {
  const [selectedProfile, setSelectedProfile] = useState(profiles[0]);
  return (
    <CashflowProfileContext.Provider value={{ selectedProfile, setSelectedProfile }}>
      {children}
    </CashflowProfileContext.Provider>
  );
};

export const useCashflowProfile = () => {
  const context = useContext(CashflowProfileContext);
  if (!context) {
    throw new Error("useCashflowProfile must be used within a CashflowProfileProvider");
  }
  return context;
};
