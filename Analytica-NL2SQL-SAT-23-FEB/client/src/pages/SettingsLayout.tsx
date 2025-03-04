import React from "react";
import "./ProjectSettings.css";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="tableContainer" onContextMenu={(e) => e.preventDefault()}>
      <div
        className="ag-theme-alpine customPerimeterTheme customHeaderTheme redRowBordersTheme agGridWrapper"
        style={{ padding: "1rem" }}
      >
        {children}
      </div>
    </div>
  );
}
