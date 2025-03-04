// /client/src/pages/Programme.tsx
import React from "react";
import GanttView from "../components/GanttView";
import styles from "../components/costCenters/myTables.module.css";
import { useSidebarContext } from "../context/SidebarContext";
import { useLocation } from "wouter";

export default function Programme() {
  const { isDarkMode } = useSidebarContext();
  const [location] = useLocation();
  
  // Extract feasibilityId from URL if it exists
  const match = location.match(/^\/feasibility\/([^/]+)/);
  const feasibilityId = match ? match[1] : "";
  
  return (
    // 1) Use the .tableContainer class for your grey background
    // 2) Add inline padding if you wish (e.g. style={{ padding: '1rem' }})
    <div className={isDarkMode ? styles.tableContainer : styles.tableContainerWhite} style={{ padding: "1rem" }}>
      <GanttView feasibilityId={feasibilityId} />
    </div>
  );
}
