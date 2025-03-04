// /src/components/costCenters/FeasibilitySummary.tsx

import React, { useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry } from "ag-grid-community";
import { RangeSelectionModule } from "@ag-grid-enterprise/range-selection";
import { ClipboardModule } from "@ag-grid-enterprise/clipboard";
import { v4 as uuidv4 } from "uuid";
import { useSidebarContext } from "../../context/SidebarContext";

import {
  REVENUE_HEADINGS,
  COST_HEADINGS,
} from "@/components/costCenters/HeadingsData";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

import { getGanttTasks } from "@/components/GanttView";

import styles from "./myTables.module.css";

import { supabase } from "@/supabaseClient";

ModuleRegistry.registerModules([RangeSelectionModule, ClipboardModule]);

interface RowData {
  id: string;
  isHeading: boolean;
  isTotal: boolean;
  headingIndex: number;
  Column1: string;
  Column2: string;
  Column3: string;
  Column4: string;
  Column5: string;
  Column6: string;
  selectedGanttTask?: string;
}

function createInitialRowData(): RowData[] {
  const rows: RowData[] = [];

  // 1) "Revenues" heading
  rows.push({
    id: uuidv4(),
    isHeading: true,
    isTotal: false,
    headingIndex: 0,
    Column1: "Revenues",
    Column2: "",
    Column3: "",
    Column4: "",
    Column5: "",
    Column6: "",
  });

  REVENUE_HEADINGS.forEach((label) => {
    rows.push({
      id: uuidv4(),
      isHeading: false,
      isTotal: false,
      headingIndex: 0,
      Column1: label,
      Column2: "",
      Column3: "",
      Column4: "",
      Column5: "",
      Column6: "",
    });
  });

  // 2) "Costs" heading
  rows.push({
    id: uuidv4(),
    isHeading: true,
    isTotal: false,
    headingIndex: 1,
    Column1: "Costs",
    Column2: "",
    Column3: "",
    Column4: "",
    Column5: "",
    Column6: "",
  });

  COST_HEADINGS.forEach((label) => {
    rows.push({
      id: uuidv4(),
      isHeading: false,
      isTotal: false,
      headingIndex: 1,
      Column1: label,
      Column2: "",
      Column3: "",
      Column4: "",
      Column5: "",
      Column6: "",
    });
  });

  // Total row for Costs
  rows.push({
    id: uuidv4(),
    isHeading: false,
    isTotal: true,
    headingIndex: 1,
    Column1: "TOTAL GROSS COSTS (before GST reclaimed)",
    Column2: "",
    Column3: "",
    Column4: "",
    Column5: "",
    Column6: "",
  });

  return rows;
}

function headingCellRenderer(params: any) {
  if (params.data.isHeading) {
    return <div style={{ fontWeight: "normal" }}>{params.value}</div>;
  }
  return params.value;
}

/**
 * Renders a cell without a "$" sign, but right-aligns the number.
 * If the value is 0 or invalid, it displays "0".
 */
function moneyCellRenderer(params: any) {
  const rawVal = params.value;
  const parsed = parseFloat(rawVal);

  if (isNaN(parsed)) {
    // Not a valid number; just return raw
    return rawVal || "";
  }

  if (parsed === 0) {
    return "0";
  }

  const formatted = parsed.toLocaleString();
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      {formatted}
    </div>
  );
}

function recalcSummaryTotals(data: RowData[]): RowData[] {
  const grouped: Record<number, { subRows: number[]; totalRowIndex: number }> =
    {};

  data.forEach((row, idx) => {
    const h = row.headingIndex;
    if (h == null) return;
    if (!grouped[h]) {
      grouped[h] = { subRows: [], totalRowIndex: -1 };
    }
    if (row.isHeading) {
      // do nothing
    } else if (row.isTotal) {
      grouped[h].totalRowIndex = idx;
    } else {
      grouped[h].subRows.push(idx);
    }
  });

  Object.values(grouped).forEach(({ subRows, totalRowIndex }) => {
    if (totalRowIndex === -1) return;

    let sumCol2 = 0;
    let sumCol3 = 0;
    let sumCol4 = 0;
    let sumCol5 = 0;

    subRows.forEach((idx) => {
      const r = data[idx];
      sumCol2 += parseFloat(r.Column2) || 0;
      sumCol3 += parseFloat(r.Column3) || 0;
      sumCol4 += parseFloat(r.Column4) || 0;
      sumCol5 += parseFloat(r.Column5) || 0;
    });

    data[totalRowIndex].Column2 = sumCol2.toString();
    data[totalRowIndex].Column3 = sumCol3.toString();
    data[totalRowIndex].Column4 = sumCol4.toString();
    data[totalRowIndex].Column5 = sumCol5.toString();
  });

  return [...data];
}

export function FeasibilitySummary({
  feasibilityId,
}: {
  feasibilityId?: string;
}) {
  const { isDarkMode } = useSidebarContext();
  // Debug logs turned off
  // console.log("FeasibilitySummary got ID:", feasibilityId);

  const [rowData, setRowData] = useState<RowData[]>(() => {
    const initial = createInitialRowData();
    return recalcSummaryTotals(initial);
  });

  const [ganttDropdownValues, setGanttDropdownValues] = useState<string[]>([]);

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number | null;
    mouseY: number | null;
    rowIndex: number | null;
  }>({
    mouseX: null,
    mouseY: null,
    rowIndex: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const tasks = await getGanttTasks();
        if (Array.isArray(tasks)) {
          setGanttDropdownValues(tasks.map((t: any) => t.text));
        } else {
          // console.error("getGanttTasks did not return an array:", tasks);
        }
      } catch (err) {
        // console.error("Error fetching Gantt tasks:", err);
      }
    })();
  }, []);

  // ------------------ Updated loadCosts to use the RPC for summed data ------------------ //
  async function loadCosts() {
    if (!feasibilityId) return;

    const { data, error } = await supabase.rpc("get_cost_centre_sums", {
      _fid: feasibilityId,
    });

    if (error) {
      // console.error("RPC error calling get_cost_centre_sums:", error);
      return;
    }
    if (!data) return;

    // console.log("Fetched cost items by cost_centre (summed):", data);

    setRowData((oldRows) => {
      const newData = [...oldRows];

      data.forEach((item: any) => {
        // console.log("Trying to match item:", item.cost_centre, item.total_excl);

        const matchRow = newData.find(
          (r) =>
            r.headingIndex === 1 &&
            !r.isTotal &&
            r.Column1 === item.cost_centre
        );

        if (matchRow) {
          // console.log("Matched sub-row with Column1:", matchRow.Column1);
          matchRow.Column3 = item.total_excl?.toString() || "0";
        }
      });

      return recalcSummaryTotals(newData);
    });
  }

  useEffect(() => {
    loadCosts();
  }, [feasibilityId]);

  // Also call get_cost_centre_sums to log DB Summaries (unchanged)
  useEffect(() => {
    if (!feasibilityId) return;

    async function loadCostCentreSums() {
      try {
        const { data, error } = await supabase.rpc("get_cost_centre_sums", {
          _fid: feasibilityId,
        });
        if (error) {
          // console.error("RPC error calling get_cost_centre_sums:", error);
        } else {
          // console.log("DB Summaries (cost_centre):", data);
        }
      } catch (err) {
        // console.error("Error calling get_cost_centre_sums:", err);
      }
    }

    loadCostCentreSums();
  }, [feasibilityId]);

  // Real-time subscription remains the same
  useEffect(() => {
    if (!feasibilityId) return;

    const channel = supabase
      .channel(`feasibility_line_items_changes_${feasibilityId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feasibility_line_items",
          filter: `feasibility_id=eq.${feasibilityId}`,
        },
        (payload) => {
          // console.log("Realtime change in feasibility_line_items:", payload);
          loadCosts(); // re-fetch after any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [feasibilityId]);

  const columnDefs = useMemo(() => {
    return [
      {
        headerName: "Item",
        field: "Column1",
        minWidth: 350,
        maxWidth: 350,
        cellRenderer: headingCellRenderer,
      },
      {
        headerName: "Total Excl. GST",
        field: "Column3",
        flex: 1,
        minWidth: 220,
        maxWidth: 220,
        cellRenderer: moneyCellRenderer,
      },
      {
        headerName: "Total Incl. GST",
        field: "Column2",
        flex: 1,
        minWidth: 120,
        cellRenderer: moneyCellRenderer,
      },
      {
        headerName: "Per Unit",
        field: "Column4",
        flex: 1,
        minWidth: 120,
        cellRenderer: moneyCellRenderer,
      },
      {
        headerName: "% TNR",
        field: "Column5",
        flex: 1,
        minWidth: 120,
        cellRenderer: moneyCellRenderer,
      },
      {
        headerName: "Programme",
        field: "selectedGanttTask",
        editable: false,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: ganttDropdownValues,
        },
        flex: 1,
        minWidth: 140,
      },
    ];
  }, [ganttDropdownValues]);

  function onCellValueChanged(params: any) {
    const updatedRows = [...rowData];
    updatedRows[params.node.rowIndex] = { ...params.data };

    const recalced = recalcSummaryTotals(updatedRows);
    setRowData(recalced);
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
    const referenceRow = rowData[contextMenu.rowIndex];
    const newRow: RowData = {
      id: uuidv4(),
      isHeading: false,
      isTotal: false,
      headingIndex: referenceRow.headingIndex,
      Column1: "New Row",
      Column2: "",
      Column3: "",
      Column4: "",
      Column5: "",
      Column6: "",
    };

    const newData = [...rowData];
    newData.splice(contextMenu.rowIndex + 1, 0, newRow);

    const recalced = recalcSummaryTotals(newData);
    setRowData(recalced);
    closeContextMenu();
  }

  function handleDeleteRow() {
    if (contextMenu.rowIndex == null) return;
    const newData = [...rowData];
    newData.splice(contextMenu.rowIndex, 1);

    const recalced = recalcSummaryTotals(newData);
    setRowData(recalced);
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

      if (api.getEditingCells().length > 0) {
        api.stopEditing(false);
      }
      const nextRowIndex = node.rowIndex + 1;
      if (nextRowIndex < api.getDisplayedRowCount()) {
        api.setFocusedCell(nextRowIndex, column.getId());
      }
    }
  }

  const rowClassRules = useMemo(() => {
    return {
      [styles.headingRow]: (params: any) => params.data.isHeading,
      [styles.totalRow]: (params: any) => params.data.isTotal,
      [styles.normalRow]: (params: any) =>
        !params.data.isHeading && !params.data.isTotal,
    };
  }, []);

  function getRowHeight(params: any) {
    if (params.data.isHeading) return 40;
    if (params.data.isTotal) return 30;
    return 30;
  }

  const contextMenuPopup =
    contextMenu.mouseX !== null && contextMenu.mouseY !== null ? (
      <div
        className={styles.popupMenu}
        style={{ top: contextMenu.mouseY, left: contextMenu.mouseX }}
      >
        <div className={styles.menuItem} onClick={handleAddRowBelow}>
          Add Row Below
        </div>
        <div className={styles.menuItem} onClick={handleDeleteRow}>
          Delete Row
        </div>
      </div>
    ) : null;

  return (
    <div
      className={isDarkMode ? styles.tableContainer : styles.tableContainerWhite}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (contextMenu.mouseX !== null) closeContextMenu();
      }}
    >
      <div
        className={`ag-theme-alpine customPerimeterTheme customHeaderTheme redRowBordersTheme ${styles.agGridWrapper}`}
      >
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            editable: (params) => {
              if (params.data.isHeading) return false;
              if (params.data.isTotal) return false;
              return false;
            },
            cellClass: "lightGreyCell",
          }}
          onCellKeyDown={handleCellKeyDown}
          onCellContextMenu={handleCellContextMenu}
          onCellValueChanged={onCellValueChanged}
          rowClassRules={rowClassRules}
          animateRows
          deltaRowDataMode
          getRowHeight={getRowHeight}
          getRowId={(params) => params.data.id}
          onGridSizeChanged={(params) => params.api.sizeColumnsToFit?.()}
        />
        {contextMenuPopup}
      </div>
    </div>
  );
}
