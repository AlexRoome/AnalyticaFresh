import React, { createContext, useState, useContext } from "react";

interface LeftNavBarContextProps {
  showLeftNavBar: boolean;
  setShowLeftNavBar: (visible: boolean) => void;
}

const LeftNavBarContext = createContext<LeftNavBarContextProps>({
  showLeftNavBar: true,
  setShowLeftNavBar: () => {},
});

export const LeftNavBarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showLeftNavBar, setShowLeftNavBar] = useState(true);
  return (
    <LeftNavBarContext.Provider value={{ showLeftNavBar, setShowLeftNavBar }}>
      {children}
    </LeftNavBarContext.Provider>
  );
};

export const useLeftNavBarContext = () => useContext(LeftNavBarContext);
