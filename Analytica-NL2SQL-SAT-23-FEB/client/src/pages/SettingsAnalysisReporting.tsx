import React from "react";
import SettingsLayout from "./SettingsLayout";
import "./ProjectSettings.css";

interface SettingsAnalysisReportingProps {
  feasibilityId: string;
}

export default function SettingsAnalysisReporting({ feasibilityId }: SettingsAnalysisReportingProps) {
  return (
    <SettingsLayout>
      <div className="projectNameWrapper" style={{ marginBottom: "1rem" }}>
        <span
          className="projectNameInput"
          style={{ width: "100%", border: "none", outline: "none" }}
        >
          Analysis &amp; Reporting
        </span>
      </div>
    </SettingsLayout>
  );
}
