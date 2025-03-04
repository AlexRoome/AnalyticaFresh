import React from "react";
import SettingsLayout from "./SettingsLayout"; // Corrected path to SettingsLayout.tsx
import { useFeasibilitySettings, FeasibilitySettingsProvider } from "../context/FeasibilitySettingsContext";
import "./ProjectSettings.css";

function SettingsFeasibilityCalculationsContent({ feasibilityId }: { feasibilityId: string }) {
  const { settings, updateSettings, initialLoading } = useFeasibilitySettings();

  if (initialLoading) return <div>Loading...</div>;

  function handleToggle(e: React.ChangeEvent<HTMLInputElement>) {
    updateSettings({ original_budget_locked: e.target.checked });
  }

  return (
    <SettingsLayout>
      <div className="projectNameWrapper" style={{ marginBottom: "1rem" }}>
        <span className="projectNameInput" style={{ width: "100%", border: "none", outline: "none" }}>
          Feasibility &amp; Calculations
        </span>
      </div>
      <div className="taxPolicyWrapper" style={{ marginBottom: "1.5rem" }}>
        <label className="sectionLabel" style={{ display: "block", marginBottom: "0.5rem" }}>
          Original Budget
        </label>
        <div className="taxPolicyToggleWrapper">
          <label className="toggleSwitch">
            <input
              type="checkbox"
              checked={settings?.original_budget_locked || false}
              onChange={handleToggle}
            />
            <span className="slider"></span>
          </label>
          <span className="taxPolicyLabel">
            {settings?.original_budget_locked ? "Original Budget Locked" : "Original Budget Unlocked"}
          </span>
        </div>
      </div>
    </SettingsLayout>
  );
}

export default function SettingsFeasibilityCalculations({ feasibilityId }: { feasibilityId: string }) {
  return (
    <FeasibilitySettingsProvider feasibilityId={feasibilityId}>
      <SettingsFeasibilityCalculationsContent feasibilityId={feasibilityId} />
    </FeasibilitySettingsProvider>
  );
}
