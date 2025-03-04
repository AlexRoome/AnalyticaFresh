import React, { createContext, useContext, useState, ReactNode } from "react";

interface FeasibilityContextType {
  feasibilityId: string | null;
  setFeasibilityId: (id: string) => void;
}

const FeasibilityContext = createContext<FeasibilityContextType | undefined>(undefined);

export const FeasibilityProvider = ({ children }: { children: ReactNode }) => {
  const [feasibilityId, setFeasibilityId] = useState<string | null>(null);

  return (
    <FeasibilityContext.Provider value={{ feasibilityId, setFeasibilityId }}>
      {children}
    </FeasibilityContext.Provider>
  );
};

export const useFeasibility = () => {
  const context = useContext(FeasibilityContext);
  if (!context) {
    throw new Error("useFeasibility must be used within a FeasibilityProvider");
  }
  return context;
};
