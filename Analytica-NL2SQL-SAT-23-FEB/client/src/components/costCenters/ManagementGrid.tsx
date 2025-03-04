import React, { useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry } from "ag-grid-community";
import { RangeSelectionModule } from "@ag-grid-enterprise/range-selection";
import { ClipboardModule } from "@ag-grid-enterprise/clipboard";
import { v4 as uuidv4 } from "uuid";

import { useRowDataContext } from "@/context/RowDataContext";

// Headings & Subheadings
import { HEADINGS } from "./HeadingsData";
import { DISCIPLINES } from "./ProfessionalFees";
import { LAND_ACQUISITION } from "./LandAcquisitionCosts";
import { CONSTRUCTION_SUBHEADINGS } from "./ConstructionCosts";
import { CONTINGENCY_SUBHEADINGS } from "./Contingency";
import { STATUTORY_FEES } from "./StatutoryFees";

// Gantt tasks & months (both async)
import { getGanttTasks, getGanttMonths } from "@/components/GanttView";

// Styles
import styles from "./myTables.module.css";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

// Register enterprise modules
ModuleRegistry.registerModules([RangeSelectionModule, ClipboardModule]);

interface RowData {
  id?: string;
  isHeading?: boolean;
  isTotal?: boolean;
  headingIndex?: number;
  Column1?: string;
  Column2?: string;
  Column3?: string;
  Column4?: string;
  Column5?: string;
  Column6?: string;
  selectedGanttTask?: string;
  // Dynamic month columns will be added
  [key: string]: any;
}

function createInitialRowData(): RowData[] {
  const rows: RowData[] = [];
  HEADINGS.forEach((heading, index) => {
    // Black header row (cost centre label) – no cashflow values here.
    rows.push({
      id: uuidv4(),
      isHeading: true,
      isTotal: false,
      headingIndex: index,
      Column1: heading,
      Column2: "",
      Column3: "",
      Column4: "",
      Column5: "",
      Column6: "",
      selectedGanttTask: "",
    });
    let subItems: string[] = [];
    if (heading === "Professional Fees") {
      subItems = DISCIPLINES;
    } else if (heading === "Land Acquisition Costs") {
      subItems = LAND_ACQUISITION;
    } else if (heading === "Construction Costs") {
      subItems = CONSTRUCTION_SUBHEADINGS;
    } else if (heading === "Contingency") {
      subItems = CONTINGENCY_SUBHEADINGS;
    } else if (heading === "Statutory Fees") {
      subItems = STATUTORY_FEES;
    } else {
      for (let i = 1; i <= 5; i++) {
        subItems.push(`Row ${i} of ${heading}`);
      }
    }
    subItems.forEach((sub) => {
      rows.push({
        id: uuidv4(),
        isHeading: false,
        isTotal: false,
        headingIndex: index,
        Column1: sub,
        Column2: "",
        Column3: "",
        Column4: "",
        Column5: "",
        Column6: "",
        selectedGanttTask: "",
      });
    });
    // Total row – this row will display the cashflow values.
    rows.push({
      id: uuidv4(),
      isHeading: false,
      isTotal: true,
      headingIndex: index,
      Column1: "Total",
      Column2: "",
      Column3: "",
      // Column4 holds Total Excluding GST (the budget)
      Column4: "",
      // Column5 holds Total Including GST (if needed)
      Column5: "",
      Column6: "",
      selectedGanttTask: "",
    });
  });
  return rows;
}

function headingCellRenderer(params: any) {
  if (params.data.isHeading) {
    return <div style={{ fontWeight: "normal" }}>{params.value}</div>;
  }
  return params.value;
}

export function ManagementGrid() {
  const { rowData, setRowData } = useRowDataContext();

  // Right-click menu state
  const [contextMenu, setContextMenu] = useState<{ mouseX: number | null; mouseY: number | null; rowIndex: number | null; }>({
    mouseX: null,
    mouseY: null,
    rowIndex: null,
  });

  // Store Gantt tasks & months in local state
  const [ganttTasks, setGanttTasks] = useState<any[]>([]);
  const [ganttMonths, setGanttMonths] = useState<string[]>([]);

  // Fetch Gantt tasks & months asynchronously
  useEffect(() => {
    (async () => {
      try {
        const tasks = await getGanttTasks();
        setGanttTasks(Array.isArray(tasks) ? tasks : []);
      } catch (err) {
        console.error("Error loading Gantt tasks:", err);
        setGanttTasks([]);
      }
      try {
        const months = await getGanttMonths();
        setGanttMonths(Array.isArray(months) ? months : []);
      } catch (err) {
        console.error("Error loading Gantt months:", err);
        setGanttMonths([]);
      }
    })();
  }, []);

  function onCellValueChanged(params: any) {
    const newData = [...rowData];
    newData[params.node.rowIndex] = { ...params.data };
    setRowData(newData);
  }

  function handleCellContextMenu(params: any) {
    if (params.data.isTotal) return;
    params.event.preventDefault();
    setContextMenu({
      mouseX: params.event.clientX,
      mouseY: params.event.clientY,
      rowIndex: params.node.rowIndex,
    });
  }

  function handleAddRowBelow() {
    if (contextMenu.rowIndex == null) return;
    const above = rowData[contextMenu.rowIndex];
    const newRow: RowData = {
      id: uuidv4(),
      isHeading: false,
      isTotal: false,
      headingIndex: above.headingIndex ?? null,
      Column1: "New Row",
      Column2: "",
      Column3: "",
      Column4: "",
      Column5: "",
      Column6: "",
      selectedGanttTask: "",
    };
    const newData = [...rowData];
    newData.splice(contextMenu.rowIndex + 1, 0, newRow);
    setRowData(newData);
    closeContextMenu();
  }

  function handleDeleteRow() {
    if (contextMenu.rowIndex == null) return;
    const newData = [...rowData];
    newData.splice(contextMenu.rowIndex, 1);
    setRowData(newData);
    closeContextMenu();
  }

  function closeContextMenu() {
    setContextMenu({ mouseX: null, mouseY: null, rowIndex: null });
  }

  function handleCellKeyDown(params: any) {
    const { event, api, node, column } = params;
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (api.getEditingCells().length > 0) api.stopEditing(false);
      const currentRowIndex = node.rowIndex;
      const colId = column.getId();
      const nextRowIndex = currentRowIndex + 1;
      if (nextRowIndex < api.getDisplayedRowCount()) api.setFocusedCell(nextRowIndex, colId);
    }
  }

  // Build dropdown values from gantt tasks.
  const ganttDropdownValues = ganttTasks.map((t) => t.text || "");

  // Build column definitions
  const columnDefs = useMemo(() => {
    const baseCols = [
      {
        headerName: "Category",
        field: "Column1",
        pinned: "left",
        width: 350,
        minWidth: 350,
        cellRenderer: headingCellRenderer,
      },
      {
        headerName: "Units",
        field: "Column2",
        width: 150,
        minWidth: 150,
        maxWidth: 150,
      },
      {
        headerName: "Amount",
        field: "Column3",
        width: 150,
        minWidth: 150,
        maxWidth: 150,
      },
      {
        headerName: "Percentage",
        field: "Column4",
        width: 150,
        minWidth: 150,
        maxWidth: 150,
      },
      {
        headerName: "Total Excl. GST",
        field: "Column5",
        width: 180,
        minWidth: 180,
        maxWidth: 180,
      },
      {
        headerName: "Total Incl. GST",
        field: "Column6",
        width: 180,
        minWidth: 180,
        maxWidth: 180,
      },
      {
        headerName: "Programme",
        field: "selectedGanttTask",
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: ganttDropdownValues,
        },
        width: 250,
        minWidth: 250,
        maxWidth: 250,
      },
    ];

    // Add a column for each Gantt month (these are our cashflow columns)
    const monthCols = ganttMonths.map((month) => ({
      headerName: month,
      field: month,
      editable: true,
      flex: 1,
      width: 150,
      minWidth: 150,
      maxWidth: 180,
    }));
    return [...baseCols, ...monthCols];
  }, [ganttDropdownValues, ganttMonths]);

  const rowClassRules = useMemo(() => {
    return {
      [styles.headingRow]: (params: any) => params.data.isHeading,
      [styles.totalRow]: (params: any) => params.data.isTotal,
      [styles.normalRow]: (params: any) => !params.data.isHeading && !params.data.isTotal,
    };
  }, []);

  function getRowHeight(params: any) {
    if (params.data.isHeading) return 40;
    if (params.data.isTotal) return 30;
    return 30;
  }

  const contextMenuPopup =
    contextMenu.mouseX !== null && contextMenu.mouseY !== null ? (
      <div className={styles.popupMenu} style={{ top: contextMenu.mouseY, left: contextMenu.mouseX }}>
        <div className={styles.menuItem} onClick={handleAddRowBelow}>
          Add Row Below
        </div>
        <div className={styles.menuItem} onClick={handleDeleteRow}>
          Delete Row
        </div>
      </div>
    ) : null;

  // ----------------------------------------------------------------
  // CASHFLOW UPDATE EFFECT
  // For each cost centre, update the corresponding TOTAL row with:
  //  - Actual costs from paid invoices (aggregated by month)
  //  - Forecast costs: if no actuals exist, distribute Total Excl. GST equally;
  //    if actuals exist, for months after the latest actual, distribute the remaining budget equally.
  // The update is applied to the Total row (where isTotal is true and headingIndex matches).
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!ganttMonths.length) return;
    async function updateCashflow() {
      // Make a copy of the current row data
      const newData = [...rowData];
      // For each cost centre (indexed by HEADINGS)
      for (let i = 0; i < HEADINGS.length; i++) {
        const costCentre = HEADINGS[i];
        // Find the Total row for this cost centre (assume Total row has isTotal true and same headingIndex)
        const totalIndex = newData.findIndex(row => row.isTotal && row.headingIndex === i);
        if (totalIndex === -1) continue;
        const row = { ...newData[totalIndex] };
        // Query actual invoices for this cost centre:
        const { data: invoices, error } = await supabase
          .from("invoices")
          .select("*")
          .eq("feasibility_id", "YOUR_FEASIBILITY_ID") // Replace with your feasibility id variable if available
          .eq("cost_centre", costCentre)
          .eq("payment_status", "Paid");
        if (error) {
          console.error("Error fetching paid invoices:", error);
          continue;
        }
        // Build actuals object mapping month label to total paid amount
        const actuals: { [key: string]: number } = {};
        ganttMonths.forEach(m => { actuals[m] = 0; });
        if (invoices && invoices.length > 0) {
          invoices.forEach((invoice: any) => {
            if (invoice.paid_date) {
              const date = new Date(invoice.paid_date);
              const options = { month: 'short', year: 'numeric' } as const;
              const monthLabel = date.toLocaleDateString("en-US", options);
              if (ganttMonths.includes(monthLabel)) {
                actuals[monthLabel] += invoice.amount_excl_gst || 0;
              }
            }
          });
        }
        // Determine latest actual month index and sum of actuals
        let latestActualIndex = -1;
        let sumActual = 0;
        ganttMonths.forEach((month, idx) => {
          if (actuals[month] > 0) {
            latestActualIndex = idx;
            sumActual += actuals[month];
          }
        });
        // Use the Total Excl. GST from the Total row (Column5 holds Total Excl. GST in this layout)
        const totalBudget = parseFloat(row.Column5 || "0");
        let forecastValue = 0;
        if (latestActualIndex === -1) {
          // No actuals: forecast is total divided equally among all months.
          forecastValue = totalBudget / ganttMonths.length;
        } else {
          const remainingBudget = totalBudget - sumActual;
          const remainingMonths = ganttMonths.length - latestActualIndex - 1;
          forecastValue = remainingMonths > 0 ? remainingBudget / remainingMonths : 0;
        }
        // Update the cashflow columns in this total row:
        ganttMonths.forEach((month, idx) => {
          if (actuals[month] > 0) {
            // Use the actual value.
            row[month] = actuals[month];
          } else if (latestActualIndex === -1) {
            // No actuals: forecast for every month.
            row[month] = forecastValue;
          } else if (idx > latestActualIndex) {
            // Months after the latest actual get forecast.
            row[month] = forecastValue;
          } else {
            // Months before (or equal to) the latest actual with no actual data get 0.
            row[month] = 0;
          }
        });
        newData[totalIndex] = row;
      }
      setRowData(newData);
    }
    updateCashflow();
  }, [ganttMonths, rowData]);

  return (
    <div className={styles.tableContainerWhite} onContextMenu={(e) => e.preventDefault()} onClick={() => { if (contextMenu.mouseX !== null) closeContextMenu(); }}>
      <div className={`ag-theme-alpine customPerimeterTheme customHeaderTheme redRowBordersTheme ${styles.agGridWrapper}`}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            editable: (params) => {
              if (params.data?.isHeading) return false;
              if (params.data?.isTotal) return false;
              return true;
            },
            cellClass: "lightGreyCell",
          }}
          onCellKeyDown={handleCellKeyDown}
          animateRows
          deltaRowDataMode
          getRowId={(params) => params.data.id}
          getRowHeight={() => 30}
          onCellContextMenu={handleCellContextMenu}
          onCellValueChanged={onCellValueChanged}
          onGridSizeChanged={(params) => params.api.sizeColumnsToFit?.()}
          rowClassRules={rowClassRules}
        />
        {contextMenuPopup}
      </div>
    </div>
  );
}

export default ManagementGrid;
