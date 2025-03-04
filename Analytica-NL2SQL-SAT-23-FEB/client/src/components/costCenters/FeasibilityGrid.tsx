import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, GridReadyEvent } from "ag-grid-community";
import { RangeSelectionModule } from "@ag-grid-enterprise/range-selection";
import { ClipboardModule } from "@ag-grid-enterprise/clipboard";
import Decimal from "decimal.js";
import { supabase } from "../../supabaseClient";
import { getGanttTasks, getGanttMonths } from "../GanttView";
import { useRowDataContext, RowDataProvider } from "../../context/RowDataContext";
import { useGstMode } from "../../context/GstModeContext";
import { useCashflowMode } from "../../context/CashflowModeContext";
import { useCashflowProfile } from "../../context/CashflowProfileContext";
import { useSidebarContext } from "../../context/SidebarContext";
import LeftNavBar, { Settings as LeftNavSettings, ReferenceValues } from "../ui/LeftNavBar";
import { useLeftNavBarContext } from "../../context/LeftNavBarContext";
import styles from "./myTables.module.css";
import { formatWithCommas } from "./utils/formatNumbers";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { v4 as uuidv4 } from "uuid";
import { sCurveProfile, linearProfile, applyCashflowProfile } from "./utils/CashflowProfiles";

// Import calculations and helper functions from your dedicated calculations file.
import {
  createInitialRowData,
  mapActualsToRow,
  recalcFormulas,
  recalcTotals,
  recalcGST,
  recalcForecastForRow,
  recalcAllFinancialMetrics,
  debouncedUpsertRow,
  convertMonthlyCostsKey,
  syncRowMonthsToGantt,
} from "./FeasibilityGridCalculations";

// Import the new cashflow formulas
import { recalcFinancialMetrics } from "./utils/cashflowFormulas";

// Import header components
import {
  headingCellRenderer,
  VariationHeader,
  FinancialMetricHeader,
  BudgetHeader,
} from "./FeasibilityGridHeaders";

// Register enterprise features
ModuleRegistry.registerModules([RangeSelectionModule, ClipboardModule]);

export interface RowData {
  id?: string;
  feasibility_id?: string;
  isHeading?: boolean;
  isTotal?: boolean;
  headingIndex?: number;
  Column1?: string;
  defaultCostCategory?: string;
  costCentre?: string;
  Column2?: string;
  Column3?: string;
  Column4?: string;
  Column5?: string;
  Column6?: string;
  Column7?: string;
  months?: string;
  cashflow_profile?: "S-Curve" | "Linear";
  FinancialMetric?: string;
  current_forecast?: string;
  variation_to_original?: string;
  monthly_manual_overrides?: { [month: string]: boolean };
  previous_forecast?: string;
  original_budget_excluding_gst?: string;
  original_budget_including_gst?: string;
  committed_excluding_gst?: string;
  committed_including_gst?: string;
  [key: string]: any;
}

function formatCurrency(value: number): string {
  const formatted = formatWithCommas(Math.abs(value));
  return value < 0 ? `($${formatted})` : `$${formatted}`;
}

function computeTotalExclGSTLocal(settings: LeftNavSettings, refs: ReferenceValues = {}): string {
  const amount = new Decimal(settings.amount || "0");
  switch (settings.calculationType) {
    case "Lump Sum":
      return amount.toDecimalPlaces(2).toString();
    case "Percentage of Land Purchase Price": {
      const refValue = refs["Land Purchase Price"];
      if (!refValue || refValue.trim() === "") return "";
      const ref = new Decimal(refValue);
      return amount.dividedBy(100).mul(ref).toDecimalPlaces(2).toString();
    }
    case "Percentage of Construction Cost": {
      const ref = new Decimal(refs["Construction Cost"] || "0");
      return amount.dividedBy(100).mul(ref).toDecimalPlaces(2).toString();
    }
    case "Percentage of Total Development Cost": {
      const ref = new Decimal(refs["Total Dev. Cost"] || "0");
      return amount.dividedBy(100).mul(ref).toDecimalPlaces(2).toString();
    }
    case "Percentage of Gross Revenue": {
      const ref = new Decimal(refs["Gross Revenue"] || "0");
      return amount.dividedBy(100).mul(ref).toDecimalPlaces(2).toString();
    }
    case "Number of Dwellings": {
      const ref = new Decimal(refs["Dwellings Unit Cost"] || "300000");
      return amount.mul(ref).toDecimalPlaces(2).toString();
    }
    case "Monthly Cost": {
      const ref = new Decimal(refs["Time Multiplier"] || "12");
      return amount.mul(ref).toDecimalPlaces(2).toString();
    }
    default:
      return amount.toDecimalPlaces(2).toString();
  }
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// Add a debounce function for real-time updates
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  return function(...args: any[]) {
    const context = this;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      func.apply(context, args);
    }, wait);
  };
}

function FeasibilityGridInner({ feasibilityId }: { feasibilityId?: string }) {
  const { rowData, setRowData } = useRowDataContext();
  const { gstMode } = useGstMode();
  const { cashflowMode } = useCashflowMode();
  const { selectedProfile } = useCashflowProfile();
  const { isDarkMode } = useSidebarContext();

  const [ganttDropdownValues, setGanttDropdownValues] = useState<string[]>([]);
  const [ganttMonths, setGanttMonths] = useState<string[]>([]);
  const [ganttTasks, setGanttTasks] = useState<any[]>([]);
  const [collapsedHeadings, setCollapsedHeadings] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ mouseX: number | null; mouseY: number | null; rowIndex: number | null; }>({
    mouseX: null,
    mouseY: null,
    rowIndex: null,
  });
  const [loading, setLoading] = useState(true);
  const gridApiRef = useRef<any>(null);
  const gridColumnApiRef = useRef<any>(null);
  const upsertTimeoutsRef = useRef<{ [key: string]: any }>({});
  const initialLoadCompleteRef = useRef(false);

  const [leftNavSettings, setLeftNavSettings] = useState<LeftNavSettings>({
    id: "",
    feasibilityId: feasibilityId || "",
    headingIndex: null,
    name: "",
    calculationType: "Lump Sum",
    amount: "",
    programme: "(None)",
    taxation: true,
    useSCurve: false,
  });
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [budgetMode, setBudgetMode] = useState("Current Forecast");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const { showLeftNavBar } = useLeftNavBarContext();

  // Add a ref for the grid container
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Function to refresh all grid cells (avoiding duplicated implementations)
  const refreshAllCells = useCallback(() => {
    if (gridApiRef.current) {
      gridApiRef.current.refreshCells({ force: true });
      gridApiRef.current.redrawRows();
    }
  }, []);

  const referenceValues = useMemo<ReferenceValues>(() => {
    const refs: ReferenceValues = {};
    const landRow = rowData.find((r) => r.Column1 === "Land Purchase Price" && !r.isTotal);
    if (landRow) {
      refs["Land Purchase Price"] = landRow.Column4;
    }
    return refs;
  }, [rowData]);

  useEffect(() => {
    async function loadCurrentMonth() {
      if (!feasibilityId) return;
      const { data, error } = await supabase
        .from("feasibility_line_items")
        .select("current_month")
        .eq("feasibility_id", feasibilityId)
        .limit(1)
        .single();
      if (error) {
        console.error("Error fetching current_month:", error);
      } else if (data && data.current_month) {
        setCurrentMonth(new Date(data.current_month));
      }
    }
    loadCurrentMonth();
  }, [feasibilityId]);

  const upsertRow = async (row: RowData) => {
    if (!row.id) {
      row.id = uuidv4();
    }
    const actuals: { [key: string]: number } = {};
    const forecasts: { [key: string]: number } = {};

    Object.keys(row).forEach((key) => {
      if (/^[A-Z][a-z]{2} \d{4}$/.test(key)) {
        if (row[`${key}_actual`]) {
          actuals[key] = parseFloat(parseFloat(row[key] || "0").toFixed(2)) || 0;
        } else {
          forecasts[key] = parseFloat(parseFloat(row[key] || "0").toFixed(2)) || 0;
        }
      }
    });

    try {
      let cost_centre = row.costCentre || row.defaultCostCategory || "";
      if (!row.isHeading && row.headingIndex != null) {
        const parentRow = rowData.find((r) => r.isHeading && r.headingIndex === row.headingIndex);
        if (parentRow) {
          cost_centre = parentRow.Column1;
        }
      }

      // Calculate current forecast if it's not already calculated
      let currentForecast = row.current_forecast;
      if (!currentForecast) {
        // If current_forecast isn't available, recalculate it
        const financialMetrics = recalcFinancialMetrics(row);
        currentForecast = financialMetrics.current_forecast;
      }

      // Calculate variation_to_original if it's not already calculated
      let variationToOriginal = row.variation_to_original;
      if (!variationToOriginal) {
        // If variation_to_original isn't available, recalculate it
        const financialMetrics = recalcFinancialMetrics(row);
        variationToOriginal = financialMetrics.variation_to_original;
      }

      const payload = {
        id: row.id,
        feasibility_id: row.feasibility_id || feasibilityId || null,
        cost_category: row.Column1,
        cost_centre: cost_centre,
        calculation_type: row.Column2,
        amount: parseFloat(parseFloat(row.Column3 || "0").toFixed(2)) || 0,
        original_budget_excluding_gst: parseFloat(parseFloat(row.Column4 || "0").toFixed(2)) || 0,
        original_budget_including_gst: parseFloat(parseFloat(row.Column5 || "0").toFixed(2)) || 0,
        programme_id: row.Column6,
        months: row.months ? Number(row.months) : 0,
        taxation_applicable: row.Column7 === "Yes",
        monthly_costs: actuals,
        original_monthly_cashflow: forecasts,
        monthly_manual_overrides: row.monthly_manual_overrides || {},
        cashflow_profile: row.cashflow_profile,
        previous_forecast: row.previous_forecast || "0",
        current_forecast: parseFloat(parseFloat(currentForecast || row.Column3 || "0").toFixed(2)) || 0,
        variation_to_original: parseFloat(parseFloat(variationToOriginal || "0").toFixed(2)) || 0,
      };

      const { error: upsertError } = await supabase
        .from("feasibility_line_items")
        .upsert(payload, { onConflict: "id" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
      }
    } catch (err) {
      console.error("Auto-save error:", err);
    }
  };

  const loadAllData = async () => {
    if (!feasibilityId) return;
    try {
      const [tasks, initialMonths] = await Promise.all([getGanttTasks(), getGanttMonths()]);
      let monthsSet = new Set<string>(Array.isArray(initialMonths) ? initialMonths : []);
      if (Array.isArray(tasks)) {
        setGanttDropdownValues(tasks.map((t: any) => t.text));
        setGanttTasks(tasks);
      } else {
        setGanttDropdownValues([]);
        setGanttTasks([]);
      }
      const defaultRows = createInitialRowData();
      const { data: dbRows, error } = await supabase
        .from("feasibility_line_items")
        .select("*")
        .eq("feasibility_id", feasibilityId);

      if (error) {
        let recalced = recalcTotals(recalcFormulas(defaultRows, tasks || []), [...monthsSet]);
        recalced = recalcGST(recalced);
        recalced = recalcAllFinancialMetrics(recalced);
        setRowData(recalced);
        setGanttMonths([...monthsSet]);
        return;
      }

      if (dbRows && dbRows.length > 0) {
        const mergedRows = [...defaultRows];
        dbRows.forEach((dbRow: any) => {
          if (!dbRow.cost_category) return;
          let matchIndex = -1;
          if (dbRow.id) {
            matchIndex = mergedRows.findIndex((r) => r.id === dbRow.id);
          }
          if (matchIndex === -1) {
            matchIndex = mergedRows.findIndex(
              (r) => r.costCentre === dbRow.cost_centre && r.defaultCostCategory === dbRow.cost_category
            );
          }
          const baseRow = {
            id: dbRow.id,
            feasibility_id: dbRow.feasibility_id || "",
            Column1: dbRow.cost_category,
            defaultCostCategory: dbRow.cost_category,
            costCentre: dbRow.cost_centre,
            Column2: dbRow.calculation_type || "",
            Column3: dbRow.amount?.toString() || "",
            original_budget_excluding_gst: dbRow.original_budget_excluding_gst?.toString() || "",
            original_budget_including_gst: dbRow.original_budget_including_gst?.toString() || "",
            Column6: dbRow.programme_id || "",
            Column7: dbRow.taxation_applicable ? "Yes" : "No",
            months: dbRow.months?.toString() || "",
            FinancialMetric: dbRow.expended_to_date?.toString() || "",
            current_forecast: dbRow.current_forecast?.toString() || "",
            previous_forecast: dbRow.previous_forecast?.toString() || "",
            committed_excluding_gst: dbRow.committed_excluding_gst?.toString() || "",
            committed_including_gst: dbRow.committed_including_gst?.toString() || "",
            isHeading: false,
            isTotal: false,
            monthly_manual_overrides: dbRow.monthly_manual_overrides || {},
          };

          if (matchIndex !== -1) {
            let updatedRow = { ...mergedRows[matchIndex], ...baseRow };
            if (dbRow.monthly_costs) {
              updatedRow = mapActualsToRow(updatedRow, dbRow.monthly_costs, monthsSet);
            }
            if (dbRow.original_monthly_cashflow) {
              Object.keys(dbRow.original_monthly_cashflow).forEach((forecastKey) => {
                const convertedKey = convertMonthlyCostsKey(forecastKey);
                if (convertedKey && !updatedRow[`${convertedKey}_actual`]) {
                  updatedRow[`${convertedKey}`] = dbRow.original_monthly_cashflow[forecastKey];
                }
              });
            }
            if (dbRow.cashflow_profile) {
              updatedRow["cashflow_profile"] = dbRow.cashflow_profile;
            }
            mergedRows[matchIndex] = updatedRow;
          } else {
            let newRow = { ...baseRow, headingIndex: null };
            if (dbRow.monthly_costs) {
              newRow = mapActualsToRow(newRow, dbRow.monthly_costs, monthsSet);
            }
            if (dbRow.original_monthly_cashflow) {
              Object.keys(dbRow.original_monthly_cashflow).forEach((forecastKey) => {
                const convertedKey = convertMonthlyCostsKey(forecastKey);
                if (convertedKey) {
                  newRow[convertedKey] = dbRow.original_monthly_cashflow[forecastKey];
                }
              });
            }
            if (dbRow.cashflow_profile) {
              newRow["cashflow_profile"] = dbRow.cashflow_profile;
            }
            mergedRows.push(newRow);
          }
        });

        // Ensure all rows have the correct headingIndex
        mergedRows.forEach((row, i) => {
          if (!row.isHeading && !row.isTotal && row.headingIndex === undefined) {
            const costCentre = row.costCentre;
            // Use the cost centers from the data instead of HEADINGS
            const headingRows = mergedRows.filter(r => r.isHeading);
            const headingIndex = headingRows.findIndex(h => h.costCentre === costCentre);
            if (headingIndex !== -1) {
              row.headingIndex = headingIndex;
            }
          }
        });

        // Perform automatic recalculation of cashflow amounts for all rows
        let updatedRows = mergedRows.map((row) => {
          if (row.isHeading || row.isTotal) {
            return row;
          }
          
          return recalcForecastForRow(
            { ...row },
            [...monthsSet],
            tasks || [],
            undefined,
            row.cashflow_profile === "S-Curve" || row.cashflow_profile === "S-curve" ? sCurveProfile : undefined
          );
        });

        let newData = recalcTotals(recalcFormulas(updatedRows, tasks), [...monthsSet]);
        newData = recalcGST(newData);
        newData = recalcAllFinancialMetrics(newData);
        setRowData(newData);
        setGanttMonths([...monthsSet]);
      } else {
        let recalced = recalcTotals(recalcFormulas(defaultRows, tasks), [...monthsSet]);
        recalced = recalcGST(recalced);
        recalced = recalcAllFinancialMetrics(recalced);
        setRowData(recalced);
        setGanttMonths([...monthsSet]);
      }
      
      // After setting rowData, add more robust grid refresh
      setTimeout(() => {
        if (gridApiRef.current) {
          // Force a complete refresh of all cells
          gridApiRef.current.refreshCells({ force: true });
          
          // Redraw all rows to ensure proper rendering
          gridApiRef.current.redrawRows();
          
          // Refresh column headers
          gridApiRef.current.refreshHeader();
          
          // Try multiple refreshes with increasing delays to ensure rendering
          setTimeout(() => {
            if (gridApiRef.current) {
              gridApiRef.current.refreshCells({ force: true });
              gridApiRef.current.redrawRows();
            }
          }, 500);
          
          setTimeout(() => {
            if (gridApiRef.current) {
              gridApiRef.current.refreshCells({ force: true });
              gridApiRef.current.redrawRows();
            }
          }, 1000);
        }
      }, 200);
      
      setLoading(false);
    } catch (err) {
      console.error("Error loading data:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (feasibilityId) {
      loadAllData();
    }
  }, [feasibilityId]);

  // This effect runs after the initial data load is complete
  useEffect(() => {
    // Add early return with proper checks to prevent unnecessary executions
    if (!rowData?.length || !ganttMonths?.length || !ganttTasks?.length || loading || initialLoadCompleteRef.current) {
      return;
    }

    try {
      console.log("Initial load complete, recalculating all rows");
      
      // Use a local variable to track changes instead of immediately triggering setRowData
      let updatedData = [...rowData];
      let hasChanges = false;
      
      // Recalculate forecast for each row
      updatedData.forEach((row, index) => {
        // Skip heading and total rows
        if (row.isHeading || row.isTotal) return;
        
        // Force recalculation for all rows, not just when there are changes
        const recalculated = recalcForecastForRow(
          { ...row }, // Create a copy to avoid mutation
          ganttMonths,
          ganttTasks,
          undefined,
          row.cashflow_profile === "S-Curve" ? sCurveProfile : undefined
        );
        
        // Compare if anything changed to avoid unnecessary updates
        if (JSON.stringify(recalculated) !== JSON.stringify(updatedData[index])) {
          updatedData[index] = recalculated;
          hasChanges = true;
        }
      });
      
      // Only update state if there were actual changes
      if (hasChanges) {
        updatedData = recalcAllFinancialMetrics(updatedData);
        updatedData = recalcTotals(updatedData, ganttMonths);
        updatedData = recalcGST(updatedData);
        setRowData(updatedData);
      }
      
      // Set the initialLoadComplete flag regardless
      initialLoadCompleteRef.current = true;
      
      // Use a single timeout for refresh
      setTimeout(() => {
        refreshAllCells();
      }, 300);
    } catch (error) {
      console.error("Error in initial load effect:", error);
      // Still set initialLoadComplete even if there's an error
      initialLoadCompleteRef.current = true;
    }
  }, [rowData, ganttMonths, ganttTasks, loading, refreshAllCells]);

  // Reduced dependencies to avoid unnecessary recalculations
  useEffect(() => {
    // Skip effect if tasks or months aren't loaded or if we're in initial load
    if (!ganttTasks?.length || !ganttMonths?.length || initialLoadCompleteRef.current === false) {
      return;
    }
    
    // Use a local variable to track state instead of immediately updating
    let shouldUpdate = false;
    const newData = [...rowData].map(row => {
      if (row.isHeading || row.isTotal) return row;
      
      const updatedRow = recalcForecastForRow(
        { ...row },
        ganttMonths,
        ganttTasks,
        undefined,
        row.cashflow_profile === "S-Curve" ? sCurveProfile : undefined
      );
      
      // Check if anything actually changed
      if (JSON.stringify(updatedRow) !== JSON.stringify(row)) {
        shouldUpdate = true;
        return updatedRow;
      }
      return row;
    });
    
    // Only update state if there were actual changes
    if (shouldUpdate) {
      const finalData = recalcAllFinancialMetrics(
        recalcTotals(
          recalcFormulas(newData, ganttTasks),
          ganttMonths
        )
      );
      
      setRowData(finalData);
      
      // Schedule refresh only if we updated
      setTimeout(() => {
        refreshAllCells();
      }, 300);
    }
  }, [ganttTasks, ganttMonths, refreshAllCells]); // Remove rowData from dependencies

  useEffect(() => {
    if (selectedRowIndex === null) return;
    setRowData((prev) => {
      let newData = [...prev];
      let rowToUpdate = { ...newData[selectedRowIndex] };
      rowToUpdate.Column1 = leftNavSettings.name;
      rowToUpdate.defaultCostCategory = leftNavSettings.name;
      rowToUpdate.Column2 = leftNavSettings.calculationType;
      rowToUpdate.Column3 = leftNavSettings.amount;
      rowToUpdate.Column6 = leftNavSettings.programme;
      rowToUpdate.Column7 = leftNavSettings.taxation ? "Yes" : "No";
      rowToUpdate.cashflow_profile = leftNavSettings.useSCurve ? "S-Curve" : "Linear";

      const computedExclStr = computeTotalExclGSTLocal(leftNavSettings, referenceValues);
      const computedExcl = new Decimal(computedExclStr || "0");
      const computedIncl = leftNavSettings.taxation ? computedExcl.mul(1.1) : computedExcl;
      const formattedExcl = computedExcl.toDecimalPlaces(2).toString();
      const formattedIncl = computedIncl.toDecimalPlaces(2).toString();

      rowToUpdate.Column4 = formattedExcl;
      rowToUpdate.Column5 = formattedIncl;
      rowToUpdate.original_budget_excluding_gst = formattedExcl;
      rowToUpdate.original_budget_including_gst = formattedIncl;

      if (ganttMonths?.length > 0) {
        rowToUpdate = recalcForecastForRow(
          rowToUpdate,
          ganttMonths,
          ganttTasks || [],
          undefined,
          rowToUpdate.cashflow_profile === "S-Curve" ? sCurveProfile : undefined
        );
      }
      newData[selectedRowIndex] = rowToUpdate;
      newData = recalcFormulas(newData, ganttTasks || []);
      newData = recalcAllFinancialMetrics(newData);
      newData = recalcTotals(newData, ganttMonths || []);
      newData = recalcGST(newData);
      debouncedUpsertRow(rowToUpdate, upsertTimeoutsRef, upsertRow);
      return newData;
    });
    if (gridApiRef.current) {
      gridApiRef.current.refreshCells({ force: true });
    }
  }, [leftNavSettings, selectedRowIndex, setRowData, ganttTasks, ganttMonths, feasibilityId, referenceValues]);

  // Add effect to fetch committed costs data when feasibilityId is available
  useEffect(() => {
    if (feasibilityId && ganttMonths.length > 0) {
      // Fetch committed costs data for this feasibility
      const fetchCommittedCosts = async () => {
        try {
          const { data, error } = await supabase
            .from("committed_costs_view")
            .select("*")
            .eq("feasibility_id", feasibilityId);
            
          if (error) {
            console.error("Error fetching committed costs data:", error);
          } else {
            console.log("Fetched committed costs data:", data);
            
            // Add a summary log of the data values we care about
            if (data && data.length > 0) {
              const commitmentSummary = data.map(cost => ({
                cost_centre: cost.cost_centre,
                total_fee_excluding_gst: cost.total_fee_excluding_gst,
                start_date: cost.start_date,
                end_date: cost.end_date
              }));
              console.log("COMMITTED COSTS SUMMARY:", commitmentSummary);
            } else {
              console.log("COMMITTED COSTS SUMMARY: No data found");
            }
            
            // Update the rows with the committed costs data
            updateRowsWithCommittedCostsData(data || []);
          }
        } catch (err) {
          console.error("Error in fetchCommittedCosts:", err);
        }
      };
      
      fetchCommittedCosts();
    }
  }, [feasibilityId, ganttMonths]);
  
  // Function to update rows with committed costs data
  const updateRowsWithCommittedCostsData = (committedCosts: any[]) => {
    if (!committedCosts.length) return;
    
    console.log("[DEBUG] All committed costs data:", committedCosts);
    console.log("[DEBUG] Available ganttMonths:", ganttMonths);
    
    setRowData(prevRows => {
      const newRows = [...prevRows];
      
      // Loop through rows to map committed costs by cost_centre
      newRows.forEach((row, index) => {
        // Skip heading rows and total rows
        if (row.isHeading || row.isTotal) return;
        
        const rowName = row.Column1;
        
        // Find matching committed costs by cost_centre
        const matchingCosts = committedCosts.filter(cost => 
          cost.cost_centre?.toLowerCase() === rowName.toLowerCase()
        );
        
        console.log(`[DEBUG] Row "${rowName}" - Matching committed costs:`, matchingCosts.length > 0 ? matchingCosts : "None");
        
        if (matchingCosts.length > 0) {
          // For each matching cost entry
          matchingCosts.forEach(cost => {
            // Get the total fee excluding GST
            const totalFee = parseFloat(cost.total_fee_excluding_gst || "0");
            
            if (totalFee > 0) {
              console.log(`[DEBUG] Row "${rowName}" - Total fee: ${totalFee}`);
              console.log(`[DEBUG] Row "${rowName}" - Monthly manual overrides:`, row.monthly_manual_overrides);
              
              // Only update if there's no manual override
              if (!row.monthly_manual_overrides || 
                  Object.keys(row.monthly_manual_overrides).length === 0) {
                
                // Parse the start and end dates safely
                let startDate: Date | null = null;
                let endDate: Date | null = null;
                
                try {
                  if (cost.start_date) startDate = new Date(cost.start_date);
                  if (cost.end_date) endDate = new Date(cost.end_date);
                  
                  console.log(`[DEBUG] Row "${rowName}" - Parsed dates:`, { 
                    startDate: startDate ? startDate.toISOString() : 'null',
                    endDate: endDate ? endDate.toISOString() : 'null'
                  });
                } catch (e) {
                  console.error("Error parsing dates:", e);
                }
                
                // Only proceed if we have valid dates and gantt months
                if (startDate && endDate && ganttMonths?.length > 0) {
                  console.log(`[DEBUG] Row "${rowName}" - Have valid dates and gantt months`);
                  
                  // Find months that fall within the date range
                  const dateRangeMonths = ganttMonths.filter(monthLabel => {
                    // Parse month label to create a date object
                    const [monthStr, yearStr] = monthLabel.split(" ");
                    const monthMap: { [key: string]: number } = {
                      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
                      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
                    };
                    const month = monthMap[monthStr] || 0;
                    const year = parseInt(yearStr) || new Date().getFullYear();
                    
                    // Create date object for month
                    const monthDate = new Date(year, month, 15); // Use 15th day of month for comparison
                    
                    // Debug the date comparison
                    const isAfterStart = startDate ? monthDate >= startDate : false;
                    const isBeforeEnd = endDate ? monthDate <= endDate : false;
                    const isInRange = isAfterStart && isBeforeEnd;
                    
                    console.log(`[DEBUG] Month "${monthLabel}" - Comparison:`, { 
                      monthDate: monthDate.toISOString(),
                      isAfterStart,
                      isBeforeEnd,
                      isInRange
                    });
                    
                    // Check if month is within the date range
                    // @ts-ignore - We've checked startDate and endDate are not null above
                    return isInRange;
                  });
                  
                  console.log(`[DEBUG] Row "${rowName}" - Months in date range:`, dateRangeMonths);
                  
                  if (dateRangeMonths.length > 0) {
                    // Determine which distribution profile to use
                    // Handle both "S-Curve" and "S-curve" variations
                    const profileType = (cost.cashflow_profile || "").toLowerCase();
                    const useProfile = profileType === "s-curve" ? sCurveProfile : linearProfile;
                    
                    console.log(`[DEBUG] Row "${rowName}" - Using profile:`, profileType === "s-curve" ? "S-Curve" : "Linear");
                    
                    // Distribute the fee across the date range months
                    const feePerMonth = new Decimal(totalFee);
                    const allocations = applyCashflowProfile(feePerMonth, dateRangeMonths.length, useProfile);
                    
                    console.log(`[DEBUG] Row "${rowName}" - Allocations:`, allocations.map(a => a.toNumber()));
                    
                    // Create a distribution object for these months
                    const monthDistribution: { [key: string]: number } = {};
                    dateRangeMonths.forEach((month, idx) => {
                      monthDistribution[month] = allocations[idx].toNumber();
                    });
                    
                    console.log(`[DEBUG] Row "${rowName}" - Month distribution:`, monthDistribution);
                    
                    // Apply the distribution to the row
                    Object.keys(monthDistribution).forEach(month => {
                      // Log before value
                      const beforeValue = parseFloat(newRows[index][month] || "0");
                      console.log(`[DEBUG] Row "${rowName}" - Month "${month}" before: ${beforeValue}, adding: ${monthDistribution[month]}`);
                      
                      // Instead of adding to existing value, directly set the committed cost value
                      newRows[index][month] = monthDistribution[month];
                      
                      // Log after value
                      console.log(`[DEBUG] Row "${rowName}" - Month "${month}" after: ${newRows[index][month]}`);
                      
                      // Mark this month value as committed
                      newRows[index][`${month}_committed`] = true;
                    });
                    
                    // Update the row's total committed amount
                    // If there's an existing value, add to it; otherwise, set it
                    const existingCommitted = parseFloat(newRows[index].committed_excluding_gst || "0");
                    newRows[index].committed_excluding_gst = (existingCommitted + totalFee).toString();
                    
                    console.log(`[DEBUG] Row "${rowName}" - Updated committed amount: ${newRows[index].committed_excluding_gst}`);
                    
                    if (gstMode === "incl") {
                      // Calculate GST if needed
                      const gstRate = 0.1; // 10% GST
                      const existingCommittedGst = parseFloat(newRows[index].committed_including_gst || "0");
                      const totalWithGst = totalFee * (1 + gstRate);
                      newRows[index].committed_including_gst = (existingCommittedGst + totalWithGst).toString();
                    }
                  } else {
                    console.log(`[DEBUG] Row "${rowName}" - No months found in date range`);
                  }
                } else {
                  console.log(`[DEBUG] Row "${rowName}" - Missing valid dates or gantt months:`, {
                    hasStartDate: !!startDate,
                    hasEndDate: !!endDate,
                    ganttMonthsCount: ganttMonths?.length || 0
                  });
                }
              } else {
                console.log(`[DEBUG] Row "${rowName}" - Skipping due to manual overrides`);
              }
            } else {
              console.log(`[DEBUG] Row "${rowName}" - Total fee is zero or invalid: ${totalFee}`);
            }
          });
        }
      });
      
      // Recalculate formulas and totals
      // @ts-ignore - Types between recalcFormulas and recalcTotals may not perfectly align
      const updatedRows = recalcTotals(recalcFormulas(newRows, ganttTasks || []), ganttMonths);
      return recalcGST(updatedRows);
    });
  };

  const columnDefs = useMemo(() => {
    const currentMonthLabel = currentMonth.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const baseCols = [
      {
        headerName: "Item",
        field: "Column1",
        width: 350,
        minWidth: 350,
        maxWidth: 350,
        pinned: "left",
        cellRenderer: headingCellRenderer,
      },
      {
        headerName: "Original Budget",
        valueGetter: (params: any) => {
          if (params.data?.isHeading || params.data?.isTotal) return "";
          return gstMode === "incl"
            ? params.data.original_budget_including_gst
            : params.data.original_budget_excluding_gst;
        },
        width: 180,
        suppressSizeToFit: true,
        headerClass: "centered-header",
        editable: false,
        suppressNavigable: true,
        cellStyle: { textAlign: "right" },
        valueFormatter: (params: any) => {
          const value = parseFloat(params.value);
          if (!value) return "";
          return `$${formatWithCommas(value)}`;
        },
      },
      {
        headerComponent: BudgetHeader,
        headerComponentParams: {
          options: ["Previous Forecast", "Current Forecast"],
          budgetMode: budgetMode,
          onBudgetModeChange: setBudgetMode,
        },
        valueGetter: (params: any) => {
          if (params.data?.isHeading || params.data?.isTotal) return "";
          return budgetMode === "Previous Forecast"
            ? params.data.previous_forecast || ""
            : params.data.current_forecast || "";
        },
        width: 200,
        suppressSizeToFit: true,
        headerClass: "centered-header",
        editable: false,
        suppressNavigable: true,
        cellStyle: { textAlign: "right" },
        valueFormatter: (params: any) => {
          const value = parseFloat(params.value);
          if (!value) return "";
          return `$${formatWithCommas(value)}`;
        },
      },
      {
        headerName: "Variation to Original",
        field: "VariationToOriginal",
        width: 200,
        suppressSizeToFit: true,
        editable: false,
        headerComponent: VariationHeader,
        headerComponentParams: {
          options: ["Variation to Original", "Variation to Previous"],
        },
        cellStyle: { textAlign: "right" },
        cellRenderer: (params: any) => {
          if (!params.data || params.data.isHeading || params.data.isTotal) return "";
          const forecast = budgetMode === "Previous Forecast"
            ? parseFloat(params.data.previous_forecast || "0")
            : parseFloat(params.data.current_forecast || "0");
          const original = gstMode === "incl"
            ? parseFloat(params.data.original_budget_including_gst || "0")
            : parseFloat(params.data.original_budget_excluding_gst || "0");
          const diff = forecast - original;
          if (isNaN(diff) || diff === 0) return "";
          return formatCurrency(diff);
        },
      },
      {
        headerName: "Committed",
        field: "Committed",
        width: 150,
        suppressSizeToFit: true,
        editable: false,
        cellStyle: { textAlign: "right" },
        valueFormatter: (params: any) => {
          if (params.data?.isHeading || params.data?.isTotal) return "";
          const value = gstMode === "incl" 
            ? parseFloat(params.data?.committed_including_gst || "0")
            : parseFloat(params.data?.committed_excluding_gst || "0");
          if (!value) return "";
          return `$${formatWithCommas(value)}`;
        },
      },
      {
        headerName: "Committed Costs",
        field: "FinancialMetric",
        width: 200,
        suppressSizeToFit: true,
        editable: false,
        headerComponent: FinancialMetricHeader,
        headerComponentParams: {
          options: ["Expended to Date", "Remaining Budget", "Percentage Complete"],
        },
        cellRenderer: (params) => {
          if (!params.value) return "";
          const numericVal = parseFloat(params.value);
          if (isNaN(numericVal) || numericVal === 0) return "";
          return `$${formatWithCommas(numericVal)}`;
        },
        cellStyle: { textAlign: "right", color: "#ff69b4" },
      },
    ];

    const monthCols = cashflowMode
      ? ganttMonths.map((monthLabel) => {
          const isCurrentMonth = monthLabel === currentMonthLabel;
          return {
            headerName: monthLabel,
            field: monthLabel,
            editable: (params: any) => !params.data?.isHeading && !params.data?.isTotal,
            headerClass: "centered-header",
            cellStyle: (params: any) => {
              if (params.data && params.data.isHeading) return { textAlign: "right" };
              const baseStyle: React.CSSProperties = { textAlign: "right" };
              if (isCurrentMonth) baseStyle.backgroundColor = "rgba(0, 128, 0, 0.2)";
              
              // Check for committed values and apply styling without console logs
              if (params.data && params.data[`${params.colDef.field}_committed`]) {
                baseStyle.backgroundColor = "rgba(255, 0, 127, 0.8)";
                baseStyle.color = "#FFFFFF";
                baseStyle.fontWeight = 800;
                return baseStyle;
              }
              
              if (params.data && params.data[`${params.colDef.field}_actual`]) {
                baseStyle.color = "green";
                baseStyle.fontWeight = 400;
              } else if (
                params.data &&
                params.data.monthly_manual_overrides &&
                params.data.monthly_manual_overrides[params.colDef.field]
              ) {
                baseStyle.color = "black";
              } else {
                baseStyle.color = "#555555";
              }
              return baseStyle;
            },
            cellClass: (params: any) => {
              // Don't apply classes to header or total rows
              if (params.data?.isHeading || params.data?.isTotal) return "";
              
              // For actual costs, don't apply special styling
              if (params.data && params.data[`${params.colDef.field}_actual`]) {
                return "";
              }
              
              // Apply manual-override-cell class to manually overridden values
              if (
                params.data &&
                params.data.monthly_manual_overrides &&
                params.data.monthly_manual_overrides[params.colDef.field]
              ) {
                return "manual-override-cell";
              }
              
              // Check if this is a future month (forecast)
              const monthLabel = params.colDef.field;
              const monthDate = new Date(monthLabel + " 01");
              const now = new Date();
              const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
              
              // Apply forecast-cell class to all future months, regardless of value
              if (monthDate >= currentMonthStart) {
                return "forecast-cell";
              }
              
              return "";
            },
            width: 120,
            suppressSizeToFit: true,
            valueFormatter: (params: any) => {
              if (params.data?.isHeading || params.data?.isTotal) return "";
              const monthLabel = params.colDef.field;
              const monthDate = new Date(monthLabel + " 01");
              const now = new Date();
              const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
              if (monthDate < currentMonthStart && !params.data[`${monthLabel}_actual`]) {
                return "";
              }
              const numericVal = parseFloat(params.value);
              if (isNaN(numericVal) || numericVal === 0) return "";
              return `$${formatWithCommas(numericVal)}`;
            },
            cellRenderer: (params: any) => {
              if (params.data?.isHeading || params.data?.isTotal) return "";
              
              const value = params.value;
              const formattedValue = value ? `$${formatWithCommas(parseFloat(value))}` : "";
              
              // Check if this is an actual cost and handle right-click in onCellContextMenu
              if (params.data && params.data[`${params.colDef.field}_actual`]) {
                return formattedValue; // Just return the formatted value
              }
              
              return formattedValue; // Just return the formatted value
            }
          };
        })
      : [];

    return [...baseCols, ...monthCols];
  }, [gstMode, ganttDropdownValues, ganttMonths, cashflowMode, budgetMode, currentMonth]);

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

  function onRowClicked(params: any) {
    if (params.data?.isHeading) {
      const hIndex = params.data.headingIndex;
      setCollapsedHeadings((prev) => {
        const copy = new Set(prev);
        if (copy.has(hIndex)) copy.delete(hIndex);
        else copy.add(hIndex);
        return copy;
      });
    } else if (!params.data?.isTotal) {
      setLeftNavSettings({
        id: params.data.id,
        feasibilityId: params.data.feasibility_id || feasibilityId,
        headingIndex: params.data.headingIndex,
        name: params.data.Column1,
        calculationType: params.data.Column2 || "Lump Sum",
        amount: params.data.Column3 || "",
        programme: params.data.Column6 || "",
        taxation: params.data.Column7 === "Yes",
        useSCurve: params.data.cashflow_profile === "S-Curve",
      });
      setSelectedRowIndex(params.node.rowIndex);
    }
  }

  async function handleCellContextMenu(params: any) {
    if (params.data.isTotal) return;
    
    // Check if this is a month column
    if (ganttMonths.includes(params.colDef.field)) {
      // Toggle the actual cost flag for this cell
      const isActual = params.data[`${params.colDef.field}_actual`];
      const newData = { ...params.data };
      
      if (isActual) {
        // If it's already an actual cost, remove the flag
        delete newData[`${params.colDef.field}_actual`];
      } else {
        // If it's not an actual cost, set the flag
        newData[`${params.colDef.field}_actual`] = true;
      }
      
      // Create a synthetic event to trigger the onCellValueChanged handler
      const syntheticEvent = {
        data: params.data,
        node: params.node,
        colDef: { 
          field: isActual ? params.colDef.field : `${params.colDef.field}_actual` 
        },
        newValue: params.value,
        api: params.api
      };
      
      // Call the onCellValueChanged handler with the synthetic event
      onCellValueChanged(syntheticEvent);
      return;
    }
    
    // Regular context menu handling for other columns
    params.event.preventDefault();
    setContextMenu({
      mouseX: params.event.clientX,
      mouseY: params.event.clientY,
      rowIndex: params.node.rowIndex,
    });
  }

  function closeContextMenu() {
    setContextMenu({ mouseX: null, mouseY: null, rowIndex: null });
  }

  async function handleDeleteRow() {
    if (contextMenu.rowIndex == null) return;
    const deletedRow = rowData[contextMenu.rowIndex];
    const newData = [...rowData];
    newData.splice(contextMenu.rowIndex, 1);
    try {
      const { error: deleteError } = await supabase
        .from("feasibility_line_items")
        .delete()
        .eq("id", deletedRow.id);
      if (deleteError) console.error("Delete error:", deleteError);
    } catch (err) {
      console.error("Delete row error:", err);
    }
    let passData = recalcFormulas(newData, ganttTasks || []);
    passData = recalcAllFinancialMetrics(passData);
    passData = recalcTotals(passData, ganttMonths || []);
    passData = recalcGST(passData);
    setRowData(passData);
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

  async function onCellValueChanged(params: any) {
    const totalField = gstMode === "incl" ? "Column5" : "Column4";
    if (params.colDef.field === totalField) {
      params.api.refreshCells({ force: true });
      return;
    }
    let updatedData = [...rowData];
    const changedRowIndex = params.node.rowIndex;
    let changedRow = { ...params.data };

    if (params.colDef.field === "Column1") {
      changedRow.defaultCostCategory = params.newValue;
    }
    
    // Check if the changed field is an actual cost field (ends with _actual)
    const isActualCost = params.colDef.field.endsWith('_actual');
    const monthKey = isActualCost ? params.colDef.field.replace('_actual', '') : null;
    
    if (["Column7", "Column6"].includes(params.colDef.field)) {
      updatedData[changedRowIndex] = changedRow;
      updatedData = recalcFormulas(updatedData, ganttTasks || []);
      changedRow = recalcForecastForRow(
        changedRow,
        ganttMonths || [],
        ganttTasks || [],
        undefined,
        changedRow.cashflow_profile === "S-Curve" ? sCurveProfile : undefined
      );
      updatedData[changedRowIndex] = changedRow;
    } else if (ganttMonths.includes(params.colDef.field) || isActualCost) {
      // Handle both regular month fields and actual cost fields
      if (!changedRow.monthly_manual_overrides) {
        changedRow.monthly_manual_overrides = {};
      }
      
      if (isActualCost) {
        // For actual costs, update the corresponding month value
        if (monthKey) {
          changedRow[monthKey] = parseFloat(parseFloat(params.newValue || "0").toFixed(2)) || 0;
          // Mark this as an actual cost
          changedRow[`${monthKey}_actual`] = true;
          // Ensure it's in the monthly costs
          if (!changedRow.monthly_costs) {
            changedRow.monthly_costs = {};
          }
          changedRow.monthly_costs[monthKey] = parseFloat(parseFloat(params.newValue || "0").toFixed(2)) || 0;
        }
      } else {
        // Regular month field handling (existing code)
        changedRow.monthly_manual_overrides[params.colDef.field] = true;
        if (!changedRow.monthly_costs) {
          changedRow.monthly_costs = {};
        }
        changedRow.monthly_costs[params.colDef.field] = parseFloat(parseFloat(params.newValue || "0").toFixed(2)) || 0;
      }
      
      // Update the changed row first
      changedRow = recalcForecastForRow(
        changedRow,
        ganttMonths || [],
        ganttTasks || [],
        isActualCost ? monthKey : params.colDef.field,
        changedRow.cashflow_profile === "S-Curve" ? sCurveProfile : undefined
      );
      updatedData[changedRowIndex] = changedRow;
      
      // If this is an actual cost change, recalculate all rows to ensure proper distribution
      if (isActualCost) {
        // Recalculate forecasts for all non-heading, non-total rows
        updatedData = updatedData.map((row, index) => {
          if (index === changedRowIndex || row.isHeading || row.isTotal) {
            return row;
          }
          
          return recalcForecastForRow(
            { ...row },
            ganttMonths || [],
            ganttTasks || [],
            undefined,
            row.cashflow_profile === "S-Curve" ? sCurveProfile : undefined
          );
        });
      }
    } else {
      updatedData[changedRowIndex] = changedRow;
      updatedData = recalcFormulas(updatedData, ganttTasks || []);
    }

    updatedData = recalcAllFinancialMetrics(updatedData);
    updatedData = recalcTotals(updatedData, ganttMonths || []);
    updatedData = recalcGST(updatedData);
    setRowData(updatedData);
    params.api.refreshCells({ force: true });
    syncRowMonthsToGantt(updatedData[changedRowIndex]);
    debouncedUpsertRow(updatedData[changedRowIndex], upsertTimeoutsRef, upsertRow);
  }

  const contextMenuPopup = useMemo(() => {
    return contextMenu.mouseX !== null && contextMenu.mouseY !== null ? (
      <div className={styles.popupMenu} style={{ top: contextMenu.mouseY, left: contextMenu.mouseX }}>
        <div className={styles.menuItem} onClick={handleDeleteRow}>
          Delete Row
        </div>
      </div>
    ) : null;
  }, [contextMenu]);

  if (loading) return null;

  const handleRollForward = async () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    if (feasibilityId) {
      const { error } = await supabase
        .from("feasibility_line_items")
        .update({ current_month: newMonth.toISOString() })
        .eq("feasibility_id", feasibilityId);
      if (error) console.error("Error updating current month:", error);
    }
  };

  const handleRollBackward = async () => {
    const newMonth = addMonths(currentMonth, -1);
    setCurrentMonth(newMonth);
    if (feasibilityId) {
      const { error } = await supabase
        .from("feasibility_line_items")
        .update({ current_month: newMonth.toISOString() })
        .eq("feasibility_id", feasibilityId);
      if (error) console.error("Error updating current month:", error);
    }
  };

  // Ensure all columns are properly sized
  const onGridReady = (params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    gridColumnApiRef.current = params.columnApi;

    // Ensure the grid is properly sized
    params.api.sizeColumnsToFit();
    
    // Optimize scroll handling with requestAnimationFrame
    setTimeout(() => {
      if (!gridContainerRef.current) return;
      
      const headerContainer = gridContainerRef.current.querySelector('.ag-header-container');
      const bodyViewport = gridContainerRef.current.querySelector('.ag-body-viewport');
      const horizontalScrollbar = gridContainerRef.current.querySelector('.ag-body-horizontal-scroll-viewport');
      
      if (!headerContainer || !bodyViewport) return;
      
      // Store last scroll position to avoid unnecessary updates
      let lastKnownScrollLeft = { value: 0 };
      let isScrolling = false;
      let rafId = null;
      
      // Unified scroll handler to minimize DOM reads/writes
      const handleScroll = (source, scrollLeft) => {
        // Don't process if already handling a scroll event
        if (isScrolling) return;
        
        // Skip if scroll position hasn't changed significantly
        if (Math.abs(lastKnownScrollLeft.value - scrollLeft) < 1) return;
        
        // Update the last known position
        lastKnownScrollLeft.value = scrollLeft;
        isScrolling = true;
        
        // Cancel any pending animation frame
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        
        // Schedule DOM updates in the next animation frame
        rafId = requestAnimationFrame(() => {
          // If source is header, update body
          if (source === headerContainer) {
            bodyViewport.scrollLeft = scrollLeft;
            if (horizontalScrollbar) horizontalScrollbar.scrollLeft = scrollLeft;
          } 
          // If source is body, update header
          else if (source === bodyViewport) {
            headerContainer.scrollLeft = scrollLeft;
            if (horizontalScrollbar) horizontalScrollbar.scrollLeft = scrollLeft;
          }
          // If source is scrollbar, update both
          else if (source === horizontalScrollbar) {
            bodyViewport.scrollLeft = scrollLeft;
            headerContainer.scrollLeft = scrollLeft;
          }
          
          isScrolling = false;
          rafId = null;
        });
      };
      
      // Attach event listeners
      headerContainer.addEventListener('scroll', () => {
        handleScroll(headerContainer, headerContainer.scrollLeft);
      }, { passive: true });
      
      bodyViewport.addEventListener('scroll', () => {
        handleScroll(bodyViewport, bodyViewport.scrollLeft);
      }, { passive: true });
      
      if (horizontalScrollbar) {
        horizontalScrollbar.addEventListener('scroll', () => {
          handleScroll(horizontalScrollbar, horizontalScrollbar.scrollLeft);
        }, { passive: true });
      }
      
      // Initial sync
      headerContainer.scrollLeft = bodyViewport.scrollLeft;
    }, 300);
  };
  
  // Simple callback for when data is first rendered
  const onFirstDataRendered = () => {
    console.log('Grid first data rendered');
  };

  return (
    <div
      className={isDarkMode ? styles.tableContainer : styles.tableContainerWhite}
      onContextMenu={(e) => {
        e.preventDefault();
        if (contextMenu.mouseX !== null) closeContextMenu();
      }}
    >
      <div style={{ display: "flex", height: "100%" }}>
        <LeftNavBar
          isVisible={showLeftNavBar}
          settings={leftNavSettings}
          onSettingsChange={setLeftNavSettings}
          ganttOptions={ganttDropdownValues}
          referenceValues={referenceValues}
          onRollForward={handleRollForward}
          onRollBackward={handleRollBackward}
        />
        <div style={{ flex: 1 }}>
          {/* The custom scrollbar styles have been moved to myTables.module.css */}
          <div
            ref={gridContainerRef}
            style={{ paddingLeft: "16px" }}
            className={`ag-theme-alpine customPerimeterTheme customHeaderTheme redRowBordersTheme ${styles.agGridWrapper}`}
          >
            <AgGridReact
              onGridReady={onGridReady}
              onFirstDataRendered={onFirstDataRendered}
              rowData={rowData.filter((r) => {
                if (r.isHeading || r.isTotal) return true;
                if (r.headingIndex === null || r.headingIndex === undefined) return true;
                return !collapsedHeadings.has(r.headingIndex);
              })}
              columnDefs={columnDefs}
              defaultColDef={{
                editable: (params) => {
                  if (params.data?.isHeading || params.data?.isTotal) return false;
                  return true;
                },
                cellClass: "lightGreyCell",
                sortable: false,
              }}
              onCellValueChanged={onCellValueChanged}
              isRowSelectable={(node) => !node.data?.isHeading && !node.data?.isTotal}
              onRowClicked={onRowClicked}
              animateRows
              deltaRowDataMode
              getRowId={(params) => params.data.id}
              getRowHeight={getRowHeight}
              onCellContextMenu={handleCellContextMenu}
              onGridSizeChanged={(params) => params.api.sizeColumnsToFit?.()}
              onCellKeyDown={handleCellKeyDown}
              rowClassRules={rowClassRules}
              context={{ rowData, setRowData, ganttDropdownValues, feasibilityId, ganttMonths, ganttTasks }}
            />
          </div>
        </div>
      </div>
      {contextMenuPopup}
    </div>
  );
}

export default function FeasibilityGrid(props: { feasibilityId?: string }) {
  return (
    <RowDataProvider>
      <FeasibilityGridInner {...props} />
    </RowDataProvider>
  );
}

export { createInitialRowData } from "./FeasibilityGridCalculations";
