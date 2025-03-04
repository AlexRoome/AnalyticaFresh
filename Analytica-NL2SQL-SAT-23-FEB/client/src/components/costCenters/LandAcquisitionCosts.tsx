// src/components/costCenters/LandAcquisitionCosts.tsx

import React, { useState, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry } from "ag-grid-community";
import { RangeSelectionModule } from "@ag-grid-enterprise/range-selection";
import { ClipboardModule } from "@ag-grid-enterprise/clipboard";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

// Register AG Grid modules
ModuleRegistry.registerModules([RangeSelectionModule, ClipboardModule]);

/** 
 * Export this array so Grid.tsx can import and use it
 * for the "Land Acquisition Costs" sub-rows.
 */
export const LAND_ACQUISITION = [
  "Legal - Settlement",
  "Acquisition Fee",
];

/**
 * A sample component that just displays those two items in an AG Grid
 * (like how ProfessionalFees.tsx does it).
 */
export function LandAcquisitionCosts() {
  // Build rowData by mapping each string into {Column1: "..."}.
  const [rowData] = useState(
    LAND_ACQUISITION.map((item) => ({ Column1: item }))
  );

  // Define a single column for the grid
  const columnDefs = useMemo(() => {
    return [
      {
        headerName: "Land Acquisition Row",
        field: "Column1",
        editable: true,
        sortable: true,
        resizable: true,
      },
    ];
  }, []);

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Land Acquisition Costs</h1>
      <div className="ag-theme-alpine" style={{ width: "400px", height: "200px" }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            resizable: true,
            editable: true,
          }}
          modules={[RangeSelectionModule, ClipboardModule]}
        />
      </div>
    </div>
  );
}
