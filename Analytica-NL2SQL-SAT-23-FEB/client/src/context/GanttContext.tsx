// /client/src/context/GanttContext.tsx
import React, { createContext, useContext, useState } from "react";

export interface GanttTask {
  id: number;
  text: string;
  start_date: string;
  end_date: string;
  duration: number;
  // ... add other fields as needed
}

interface GanttContextProps {
  tasks: GanttTask[];
  setTasks: React.Dispatch<React.SetStateAction<GanttTask[]>>;
}

const GanttContext = createContext<GanttContextProps | null>(null);

export function GanttProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  return (
    <GanttContext.Provider value={{ tasks, setTasks }}>
      {children}
    </GanttContext.Provider>
  );
}

export function useGanttContext() {
  const ctx = useContext(GanttContext);
  if (!ctx) {
    throw new Error("useGanttContext must be used inside <GanttProvider>.");
  }
  return ctx;
}
