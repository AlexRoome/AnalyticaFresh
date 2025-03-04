import React from "react";
import SettingsLayout from "./SettingsLayout";
import "./ProjectSettings.css";

interface SettingsCollaborationIntegrationProps {
  feasibilityId: string;
}

export default function SettingsCollaborationIntegration({ feasibilityId }: SettingsCollaborationIntegrationProps) {
  return (
    <SettingsLayout>
      <div className="projectNameWrapper" style={{ marginBottom: "1rem" }}>
        <span
          className="projectNameInput"
          style={{ width: "100%", border: "none", outline: "none" }}
        >
          Collaboration &amp; Integration
        </span>
      </div>
    </SettingsLayout>
  );
}
