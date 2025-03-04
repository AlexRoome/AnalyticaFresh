// /client/src/pages/Feasibility.tsx

import React, { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { RowDataProvider } from "../context/RowDataContext";
import FeasibilityGrid from "../components/costCenters/FeasibilityGrid";
import { supabase } from "../supabaseClient";
import { useSidebarContext } from "../context/SidebarContext";
import styles from "../components/costCenters/myTables.module.css";

export default function Feasibility() {
  const { isDarkMode } = useSidebarContext();
  // This reads the /feasibility/:id param from Wouter's route
  const [match, params] = useRoute("/feasibility/:id");
  const feasibilityId = params?.id; // the string after /feasibility/

  const [feasRow, setFeasRow] = useState<any>(null);

  useEffect(() => {
    if (!feasibilityId) return;
    // fetch the specific feasibility row from supabase
    (async () => {
      const { data, error } = await supabase
        .from("feasibilities")
        .select("*")
        .eq("id", feasibilityId)
        .single();

      if (error) {
        console.error("Error fetching single feasibility:", error);
      } else {
        setFeasRow(data);
      }
    })();
  }, [feasibilityId]);

  return (
    <div className={isDarkMode ? styles.tableContainer : styles.tableContainerWhite}>
      <RowDataProvider>
        <FeasibilityGrid feasibilityId={feasibilityId} feasRow={feasRow} />
      </RowDataProvider>
    </div>
  );
}
