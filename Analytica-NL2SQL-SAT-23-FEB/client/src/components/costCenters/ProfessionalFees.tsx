// ProfessionalFees.tsx

import React, { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry } from "ag-grid-community";
import { RangeSelectionModule } from "@ag-grid-enterprise/range-selection";
import { ClipboardModule } from "@ag-grid-enterprise/clipboard";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

// 1) Register AG Grid modules
ModuleRegistry.registerModules([RangeSelectionModule, ClipboardModule]);

// 2) Export the 20 disciplines so other files (e.g., Grid.tsx) can import them
export const DISCIPLINES = [
  "Arborist",
  "Architectural Services",
  "Interior Designer",
  "Acoustics Engineer",
  "Building Surveyor",
  "Environmental Engineer",
  "Fire Engineer",
  "Heritage Consultant",
  "Landscape Designer",
  "Land Surveyors",
  "Services Engineer",
  "Planning Consultant",
  "Quantity Surveyor",
  "Geotechnical Engineer",
  "Structural Engineer",
  "Sustainable Development",
  "Traffic Engineer",
  "Waste Management",
  "DDA Consultant",
  "Construction Legal",
  "Development Manager",
];

interface RowData {
  Column1?: string;
  [key: string]: any;
}

/**
 * A standalone component that shows "Professional Fees" in a small AG Grid.
 * - Uses the DISCIPLINES array above as row data.
 * - This file also exports DISCIPLINES so other components can reuse it (e.g. Grid.tsx).
 */
export function ProfessionalFees() {
  // Build row data from DISCIPLINES
  const [rowData] = useState<RowData[]>(() =>
    DISCIPLINES.map((name) => ({ Column1: name }))
  );

  // Define a single column that displays the discipline name
  const columnDefs = useMemo(() => {
    return [
      {
        headerName: "Discipline",
        field: "Column1",
        editable: true,
        sortable: true,
        resizable: true,
      },
    ];
  }, []);

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Professional Fees</h1>
      {/* We’re limiting the width/height so you can see a small table */}
      <div className="ag-theme-alpine" style={{ width: "600px", height: "400px" }}>
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
