import React from "react";
import { ManagementGrid } from "../components/costCenters/ManagementGrid";

export default function Management() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Another nested container for the grid */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <ManagementGrid />
      </div>
    </div>
  );
}
