import React, { createContext, useContext, useState, useEffect } from "react";

// We'll reuse createInitialRowData from Grid (or ManagementGrid)
import { createInitialRowData } from "../components/costCenters/FeasibilityGrid";

interface RowData {
  id?: string;
  isHeading?: boolean;
  headingIndex?: number;
  [key: string]: any;
}

interface RowDataContextProps {
  rowData: RowData[];
  setRowData: React.Dispatch<React.SetStateAction<RowData[]>>;
}

// Create a default value for the context to prevent errors when used outside a provider
const defaultContextValue: RowDataContextProps = {
  rowData: [],
  setRowData: () => {},
};

// Provide the default value to createContext
const RowDataContext = createContext<RowDataContextProps>(defaultContextValue);

export function useRowDataContext() {
  return useContext(RowDataContext);
}

export function RowDataProvider({ children }: { children: React.ReactNode }) {
  const [rowData, setRowData] = useState<RowData[]>([]);

  // Initialize global row data (headings) once, so you can go directly to DisciplinePage
  useEffect(() => {
    if (rowData.length === 0) {
      setRowData(createInitialRowData());
    }
  }, [rowData]);

  return (
    <RowDataContext.Provider value={{ rowData, setRowData }}>
      {children}
    </RowDataContext.Provider>
  );
}
