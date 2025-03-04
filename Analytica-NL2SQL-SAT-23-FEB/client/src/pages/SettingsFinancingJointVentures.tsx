import React from "react";
import SettingsLayout from "./SettingsLayout";
import "./ProjectSettings.css";

interface SettingsFinancingJointVenturesProps {
  feasibilityId: string;
}

export default function SettingsFinancingJointVentures({ feasibilityId }: SettingsFinancingJointVenturesProps) {
  return (
    <SettingsLayout>
      <div className="projectNameWrapper" style={{ marginBottom: "1rem" }}>
        <span
          className="projectNameInput"
          style={{ width: "100%", border: "none", outline: "none" }}
        >
          Financing &amp; Joint Ventures
        </span>
      </div>
    </SettingsLayout>
  );
}
