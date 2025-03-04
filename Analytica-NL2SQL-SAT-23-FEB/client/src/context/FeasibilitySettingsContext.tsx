import React, { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { supabase } from "../supabaseClient";

export interface FeasibilitySettings {
  feasibility_id: string;
  original_budget_locked: boolean;
  // Add additional settings fields here as needed
}

interface FeasibilitySettingsContextProps {
  settings: FeasibilitySettings | null;
  updateSettings: (newSettings: Partial<FeasibilitySettings>) => Promise<void>;
  initialLoading: boolean;
}

const FeasibilitySettingsContext = createContext<FeasibilitySettingsContextProps | undefined>(undefined);

export const FeasibilitySettingsProvider = ({
  feasibilityId,
  children,
}: {
  feasibilityId: string;
  children: ReactNode;
}) => {
  const [settings, setSettings] = useState<FeasibilitySettings | null>(null);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);

  async function fetchSettings() {
    setInitialLoading(true);
    const { data, error } = await supabase
      .from("feasibility_settings")
      .select("*")
      .eq("feasibility_id", feasibilityId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching settings:", error);
    } else if (data) {
      setSettings(data);
    }
    setInitialLoading(false);
  }

  useEffect(() => {
    fetchSettings();
  }, [feasibilityId]);

  async function updateSettings(newSettings: Partial<FeasibilitySettings>) {
    const { data, error } = await supabase
      .from("feasibility_settings")
      .upsert({ feasibility_id: feasibilityId, ...newSettings }, { onConflict: "feasibility_id" })
      .select() // Chain select() so that the updated row is returned
      .maybeSingle();
    if (error) {
      console.error("Error updating settings:", error);
    } else {
      console.log("Settings updated:", data);
      setSettings(data);
    }
  }

  return (
    <FeasibilitySettingsContext.Provider value={{ settings, updateSettings, initialLoading }}>
      {children}
    </FeasibilitySettingsContext.Provider>
  );
};

export const useFeasibilitySettings = () => {
  const context = useContext(FeasibilitySettingsContext);
  if (!context) {
    throw new Error("useFeasibilitySettings must be used within a FeasibilitySettingsProvider");
  }
  return context;
};
