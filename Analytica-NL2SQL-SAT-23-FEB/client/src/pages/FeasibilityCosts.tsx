import React, { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry } from "ag-grid-community";
import { RangeSelectionModule } from "@ag-grid-enterprise/range-selection";
import { ClipboardModule } from "@ag-grid-enterprise/clipboard";
import { v4 as uuidv4 } from "uuid";

// Keep using RowDataContext ONLY IF you still want to access it
import { useRowDataContext } from "../context/RowDataContext";
import styles from "../components/costCenters/myTables.module.css";

// 1) Import a regular CSS file side-effect only (no default export)
import "./DisciplinePage.css";

// *** Import getGanttTasks to supply dropdown values ***
import { getGanttTasks } from "../components/GanttView";

// Register AG Grid modules
ModuleRegistry.registerModules([RangeSelectionModule, ClipboardModule]);

/** 1) Example local row data for the three grids **/
const initialSummaryData = [
  { id: uuidv4(), Column1: "Budget", Column2: "$2,000,000" },
  { id: uuidv4(), Column1: "Committed", Column2: "$1,150,000" },
  { id: uuidv4(), Column1: "Expended", Column2: "$800,000" },
  { id: uuidv4(), Column1: "Cost To Complete Fee", Column2: "$350,000" },
  { id: uuidv4(), Column1: "Cost To Complete Budget", Column2: "$1,200,000" },
];

// Updated: Remove the “hard-coded” text from Column6
// so the user can pick from the dropdown.
const initialStagesData = [
  {
    id: uuidv4(),
    Column1: "Schematic Design",
    Column2: "$80,000",
    Column3: "$60,000",
    Column4: "75%",
    Column5: "$20,000",
    Column6: "", // was "Draft Planning Plans"
  },
  {
    id: uuidv4(),
    Column1: "Town Planning",
    Column2: "$10,000",
    Column3: "$5,000",
    Column4: "50%",
    Column5: "$5,000",
    Column6: "", // was "Finishing Phase (Obtain Permits)"
  },
  {
    id: uuidv4(),
    Column1: "Design Development",
    Column2: "$50,000",
    Column3: "$50,000",
    Column4: "100%",
    Column5: "$0",
    Column6: "", // was "Design Development"
  },
  {
    id: uuidv4(),
    Column1: "Tender Documentation",
    Column2: "$30,000",
    Column3: "$0",
    Column4: "0%",
    Column5: "$30,000",
    Column6: "", // was "Request For Tenders"
  },
  {
    id: uuidv4(),
    Column1: "Construction Documentation",
    Column2: "$25,000",
    Column3: "$0",
    Column4: "0%",
    Column5: "$25,000",
    Column6: "", // was "Construction Documentation"
  },
  {
    id: uuidv4(),
    Column1: "Construction Admin",
    Column2: "$40,000",
    Column3: "$0",
    Column4: "0%",
    Column5: "$40,000",
    Column6: "", // was "Construction"
  },
  // Example variations
  {
    id: uuidv4(),
    Column1: "Variation 1",
    Column2: "$15,000",
    Column3: "$0",
    Column4: "0%",
    Column5: "$15,000",
    Column6: "", // was "Additional scope"
  },
  {
    id: uuidv4(),
    Column1: "Variation 2",
    Column2: "$25,000",
    Column3: "$0",
    Column4: "0%",
    Column5: "$25,000",
    Column6: "", // was "Design Development"
  },
  {
    id: uuidv4(),
    Column1: "Variation 3",
    Column2: "$20,000",
    Column3: "$0",
    Column4: "0%",
    Column5: "$20,000",
    Column6: "", // was "Concept revision"
  },
];

const initialInvoicesData = [
  {
    id: uuidv4(),
    Column1: "1/10/2027",
    Column2: "ARCH-0001",
    Column3: "Smith & Co. Architects",
    Column4: "Schematic design",
    Column5: "$8,000",
    Column6: "$800",
    Column7: "$8,800",
    Column8: "3-001",
    Column9: "Schematic Design",
    Column10: "1/10/2025",
    Column11: "Paid",
    Column12: "View Invoice",
  },
  {
    id: uuidv4(),
    Column1: "2/10/2027",
    Column2: "ARCH-0002",
    Column3: "Smith & Co. Architects",
    Column4: "Design Development",
    Column5: "$4,500",
    Column6: "$450",
    Column7: "$4,950",
    Column8: "3-001",
    Column9: "Design Development",
    Column10: "2/11/2025",
    Column11: "Pending",
    Column12: "View Invoice",
  },
];

/** Example cell renderer for headings */
function headingCellRenderer(params: any) {
  if (params.data.isHeading) {
    return <div style={{ fontWeight: "normal" }}>{params.value}</div>;
  }
  return params.value;
}

/** Helper to convert the disciplineName to Title Case */
function toTitleCase(str: string) {
  return str
    .split(" ")
    .map(
      (word) => word.charAt(0).toUpperCase() + word.substring(1).toLowerCase()
    )
    .join(" ");
}

export default function DisciplinePage() {
  // 1) Grab discipline name from route
  const [match, params] = useRoute("/:disciplineName");
  if (!match) return <div>404 Not Found</div>;
  const { disciplineName } = params;

  // 2) Access global rowData (if needed)
  const { rowData, setRowData } = useRowDataContext();

  // 3) Local states for each of the 3 grids
  const [summaryData, setSummaryData] = useState(initialSummaryData);
  const [stagesData, setStagesData] = useState(initialStagesData);
  const [invoicesData, setInvoicesData] = useState(initialInvoicesData);

  // Track actual Gantt tasks in local state
  const [ganttTasksState, setGanttTasksState] = useState<any[]>([]);

  // Fetch Gantt tasks (async) one time on mount
  useEffect(() => {
    getGanttTasks().then((data) => {
      // data will be an array once resolved
      setGanttTasksState(data || []);
    });
  }, []);

  // 4) Context Menu (kept exactly the same)
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number | null;
    mouseY: number | null;
    rowIndex: number | null;
    gridId?: string; // optional to know which grid was right-clicked
  }>({
    mouseX: null,
    mouseY: null,
    rowIndex: null,
  });

  function closeContextMenu() {
    setContextMenu({ mouseX: null, mouseY: null, rowIndex: null });
  }

  function handleCellContextMenu(params: any, gridId: string) {
    params.event.preventDefault();
    setContextMenu({
      mouseX: params.event.clientX,
      mouseY: params.event.clientY,
      rowIndex: params.node.rowIndex,
      gridId,
    });
  }

  function handleAddRowBelow() {
    if (contextMenu.rowIndex == null || !contextMenu.gridId) return;

    if (contextMenu.gridId === "summary") {
      const newRow = { id: uuidv4(), Column1: "New Summary Item", Column2: "$0" };
      const newData = [...summaryData];
      newData.splice(contextMenu.rowIndex + 1, 0, newRow);
      setSummaryData(newData);
    } else if (contextMenu.gridId === "stages") {
      const newRow = { id: uuidv4(), Column1: "New Stage", Column2: "$0" };
      const newData = [...stagesData];
      newData.splice(contextMenu.rowIndex + 1, 0, newRow);
      setStagesData(newData);
    } else if (contextMenu.gridId === "invoices") {
      const newRow = {
        id: uuidv4(),
        Column1: "New Invoice Date",
        Column2: "ARCH-NEW",
        Column3: "Supplier Name",
      };
      const newData = [...invoicesData];
      newData.splice(contextMenu.rowIndex + 1, 0, newRow);
      setInvoicesData(newData);
    }
    closeContextMenu();
  }

  function handleDeleteRow() {
    if (contextMenu.rowIndex == null || !contextMenu.gridId) return;

    if (contextMenu.gridId === "summary") {
      const newData = [...summaryData];
      newData.splice(contextMenu.rowIndex, 1);
      setSummaryData(newData);
    } else if (contextMenu.gridId === "stages") {
      const newData = [...stagesData];
      newData.splice(contextMenu.rowIndex, 1);
      setStagesData(newData);
    } else if (contextMenu.gridId === "invoices") {
      const newData = [...invoicesData];
      newData.splice(contextMenu.rowIndex, 1);
      setInvoicesData(newData);
    }
    closeContextMenu();
  }

  function handleCellKeyDown(params: any) {
    const { event, api, node, column } = params;
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (api.getEditingCells().length > 0) {
        api.stopEditing(false);
      }
      const currentRowIndex = node.rowIndex;
      const colId = column.getId();
      const nextRowIndex = currentRowIndex + 1;
      if (nextRowIndex < api.getDisplayedRowCount()) {
        api.setFocusedCell(nextRowIndex, colId);
      }
    }
  }

  // *** Now we use ganttTasksState (which is guaranteed to be an array) ***
  const ganttDropdownValues = ganttTasksState.map((t: any) => t.text);

  // Helper to format date as YYYY-MM-DD
  function formatDate(dateObj: Date) {
    return dateObj.toISOString().split("T")[0];
  }

  // 5) Column defs
  const summaryColDefs = useMemo(() => {
    return [
      { headerName: "Item", field: "Column1", width: 250 },
      { headerName: "Amount", field: "Column2", width: 120 },
    ];
  }, []);

  const stagesColDefs = useMemo(() => {
    return [
      { headerName: "Stage", field: "Column1", width: 250 },
      { headerName: "Fee", field: "Column2", width: 180 },
      { headerName: "Paid", field: "Column3", minWidth: 120 },
      { headerName: "Percentage Complete", field: "Column4", minWidth: 150 },
      { headerName: "Cost To Complete Fee", field: "Column5", minWidth: 150 },
      {
        headerName: "Programme",
        field: "Column6",
        minWidth: 250,
        // Make it a dropdown using AG Grid's select editor
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: ganttDropdownValues,
        },
      },
      {
        headerName: "Start Date",
        minWidth: 150,
        editable: false,
        valueGetter: (params) => {
          const selectedProgramme = params.data?.Column6 || "";
          const task = ganttTasksState.find((t) => t.text === selectedProgramme);
          if (!task) return "";
          return formatDate(new Date(task.start_date));
        },
      },
      {
        headerName: "End Date",
        minWidth: 150,
        editable: false,
        valueGetter: (params) => {
          const selectedProgramme = params.data?.Column6 || "";
          const task = ganttTasksState.find((t) => t.text === selectedProgramme);
          if (!task) return "";
          const endDate = new Date(
            new Date(task.start_date).getTime() + task.duration * 86400000
          );
          return formatDate(endDate);
        },
      },
    ];
    // Recompute if ganttDropdownValues or ganttTasksState changes
  }, [ganttDropdownValues, ganttTasksState]);

  const invoicesColDefs = useMemo(() => {
    return [
      { headerName: "Invoice Date", field: "Column1", width: 250 },
      { headerName: "Invoice Number", field: "Column2", width: 200 },
      { headerName: "Supplier", field: "Column3", width: 200 },
      { headerName: "Description", field: "Column4", width: 180 },
      { headerName: "Amount (Excl. GST)", field: "Column5", width: 180 },
      { headerName: "GST", field: "Column6", width: 180 },
      { headerName: "Amount (Incl. GST)", field: "Column7", width: 180 },
      { headerName: "Cost Code", field: "Column8", width: 180 },
      { headerName: "Stage", field: "Column9", width: 180 },
      { headerName: "Due Date", field: "Column10", width: 180 },
      { headerName: "Payment Status", field: "Column11", width: 180 },
      { headerName: "Attachment", field: "Column12", width: 180 },
    ];
  }, []);

  // 6) rowClassRules
  const rowClassRules = useMemo(() => {
    return {
      [styles.headingRow]: (params: any) => params.data.isHeading,
      [styles.totalRow]: (params: any) => params.data.isTotal,
      [styles.normalRow]: (params: any) =>
        !params.data.isHeading && !params.data.isTotal,
    };
  }, []);

  function getRowHeight(params: any) {
    if (params.data.isHeading) return 50;
    if (params.data.isTotal) return 40;
    return 35;
  }

  const defaultColDef = useMemo(() => {
    return {
      editable: true,
      cellClass: "lightGreyCell",
      resizable: false,
    };
  }, []);

  const contextMenuPopup =
    contextMenu.mouseX !== null && contextMenu.mouseY !== null ? (
      <div
        className={styles.popupMenu}
        style={{
          top: contextMenu.mouseY,
          left: contextMenu.mouseX,
        }}
      >
        <div className={styles.menuItem} onClick={handleAddRowBelow}>
          Add Row Below
        </div>
        <div className={styles.menuItem} onClick={handleDeleteRow}>
          Delete Row
        </div>
      </div>
    ) : null;

  const disciplineTitle = useMemo(
    () => toTitleCase(disciplineName),
    [disciplineName]
  );

  return (
    <div
      className={styles.tableContainerWhite}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (contextMenu.mouseX !== null) closeContextMenu();
      }}
    >
      {/* The heading uses a normal CSS class from DisciplinePage.css */}
      <h2 className="headingTitle">{disciplineTitle}</h2>

      {/* 1) SUMMARY GRID */}
      <div
        className={`ag-theme-alpine customPerimeterTheme customHeaderTheme redRowBordersTheme ${styles.agGridWrapper}`}
      >
        <AgGridReact
          rowData={summaryData}
          columnDefs={summaryColDefs}
          defaultColDef={defaultColDef}
          onCellKeyDown={handleCellKeyDown}
          animateRows
          deltaRowDataMode
          getRowId={(params) => params.data.id}
          getRowHeight={getRowHeight}
          onCellContextMenu={(params) => handleCellContextMenu(params, "summary")}
          onCellValueChanged={(params) => {
            const newData = [...summaryData];
            newData[params.node.rowIndex] = { ...params.data };
            setSummaryData(newData);
          }}
          rowClassRules={rowClassRules}
        />
      </div>

      {/* 2) STAGES GRID */}
      <div
        className={`ag-theme-alpine customPerimeterTheme customHeaderTheme redRowBordersTheme ${styles.agGridWrapper}`}
        style={{ marginTop: "-9rem" }}
      >
        <AgGridReact
          rowData={stagesData}
          columnDefs={stagesColDefs}
          defaultColDef={defaultColDef}
          onCellKeyDown={handleCellKeyDown}
          animateRows
          deltaRowDataMode
          getRowId={(params) => params.data.id}
          getRowHeight={getRowHeight}
          onCellContextMenu={(params) => handleCellContextMenu(params, "stages")}
          onCellValueChanged={(params) => {
            const newData = [...stagesData];
            newData[params.node.rowIndex] = { ...params.data };
            setStagesData(newData);
          }}
          rowClassRules={rowClassRules}
        />
      </div>

      {/* 3) INVOICES GRID */}
      <div
        className={`ag-theme-alpine customPerimeterTheme customHeaderTheme redRowBordersTheme ${styles.agGridWrapper}`}
        style={{ marginTop: "0rem" }}
      >
        <AgGridReact
          rowData={invoicesData}
          columnDefs={invoicesColDefs}
          defaultColDef={defaultColDef}
          onCellKeyDown={handleCellKeyDown}
          animateRows
          deltaRowDataMode
          getRowId={(params) => params.data.id}
          getRowHeight={getRowHeight}
          onCellContextMenu={(params) => handleCellContextMenu(params, "invoices")}
          onCellValueChanged={(params) => {
            const newData = [...invoicesData];
            newData[params.node.rowIndex] = { ...params.data };
            setInvoicesData(newData);
          }}
          rowClassRules={rowClassRules}
        />
      </div>

      {contextMenuPopup}
    </div>
  );
}
