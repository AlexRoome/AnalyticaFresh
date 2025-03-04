import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRoute } from "wouter";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry } from "ag-grid-community";
import { RangeSelectionModule } from "@ag-grid-enterprise/range-selection";
import { ClipboardModule } from "@ag-grid-enterprise/clipboard";
import { v4 as uuidv4 } from "uuid";
import { AiOutlineFileAdd } from "react-icons/ai";

import { useRowDataContext } from "../context/RowDataContext";
import styles from "../components/costCenters/myTables.module.css";
import "./DisciplinePage.css";
import { getGanttTasks } from "../components/GanttView";
import { supabase } from "../supabaseClient";
import InvoiceUploadModal from "../components/costCenters/InvoiceUploadModal";

// GPT helper
import { parseInvoiceWithGPT } from "../components/costCenters/utils/InvoiceGPT";
// Number formatting function
import { formatWithCommas } from "../components/costCenters/utils/formatNumbers";

// Register AG Grid modules
ModuleRegistry.registerModules([RangeSelectionModule, ClipboardModule]);

// --- Helper Functions ---

// Convert string to title case
function toTitleCase(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Formatter for dollar values
function dollarFormatter(params: any): string {
  if (typeof params.value === "number") {
    return "$" + formatWithCommas(params.value);
  }
  return params.value;
}

// Formatter for percentages
function percentFormatter(params: any): string {
  if (params.value === undefined || params.value === null) return "";
  return `${Math.round(params.value)}%`;
}

// Date reformatting helpers
function reformatDate(input: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(input)) {
    const [day, month, year] = input.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05",
    jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const match = input.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    const [_, day, monthStr, year] = match;
    const month = monthMap[monthStr.toLowerCase()] || "01";
    return `${year}-${month}-${day.padStart(2, "0")}`;
  }
  console.warn(`reformatDate: Unrecognized date format: "${input}"`);
  return "";
}

function sanitizeDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  const upper = dateStr.toUpperCase();
  if (upper === "N/A" || upper === "UNKNOWN") return null;
  const result = reformatDate(dateStr);
  if (!result || result.length < 6) return null;
  return result;
}

// --- Initial Data ---
const initialSummaryData = [
  { id: uuidv4(), Column1: "Original Budget", Column2: 0, Column3: 0 },
  { id: uuidv4(), Column1: "Current Forecast", Column2: 0, Column3: 0 },
  { id: uuidv4(), Column1: "Committed", Column2: 1150000, Column3: 0 },
  { id: uuidv4(), Column1: "Expended", Column2: 800000, Column3: 0 },
  { id: uuidv4(), Column1: "Cost To Complete Fee", Column2: 350000, Column3: 0 },
  { id: uuidv4(), Column1: "Cost To Complete Budget", Column2: 1200000, Column3: 0 },
];

// For the stage grid, we start with an empty array.
const initialStagesData: any[] = [];

export default function ManagementCosts() {
  const [match, params] = useRoute("/feasibility/:feasibilityId/:disciplineName");
  if (!match) return <div>404 Not Found</div>;
  const { feasibilityId, disciplineName } = params!;
  console.log("ManagementCosts => Feasibility ID:", feasibilityId);

  const { rowData } = useRowDataContext();

  const [summaryData, setSummaryData] = useState(initialSummaryData);
  const [stagesData, setStagesData] = useState(initialStagesData);
  const [invoicesData, setInvoicesData] = useState<any[]>([]);
  const [invoicePaidSummary, setInvoicePaidSummary] = useState<any[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Generate dropdown list for stage values
  const stageDropdownValues = useMemo(() => {
    return Array.from(new Set(stagesData.map((row) => row.stage).filter(Boolean)));
  }, [stagesData]);

  // Fetch gantt programme items for dropdown
  const [programmeItems, setProgrammeItems] = useState<string[]>([]);
  
  useEffect(() => {
    async function fetchProgrammeItems() {
      try {
        const tasks = await getGanttTasks();
        const items = tasks.map((task: any) => task.text || task.task_name).filter(Boolean);
        setProgrammeItems(Array.from(new Set(items)));
      } catch (error) {
        console.error("Error fetching gantt programme items:", error);
      }
    }
    fetchProgrammeItems();
  }, []);

  // --- Fetch invoice paid summary ---
  const fetchInvoicePaidSummary = useCallback(async () => {
    const { data, error } = await supabase
      .from("invoice_paid_summary")
      .select("*")
      .eq("feasibility_id", feasibilityId)
      .eq("cost_centre", disciplineName);
    if (error) console.error("Error fetching invoice paid summary:", error);
    else setInvoicePaidSummary(data || []);
  }, [feasibilityId, disciplineName]);

  // --- Fetch stage data from management_costs_view ---
  useEffect(() => {
    async function fetchStages() {
      const { data, error } = await supabase
        .from("management_costs_view")
        .select("*")
        .eq("feasibility_id", feasibilityId)
        .eq("cost_centre", disciplineName)
        .order("id", { ascending: true });
      if (error) {
        console.error("Error fetching stage data from management_costs_view:", error);
      } else {
        setStagesData(data || []);
      }
    }
    fetchStages();
  }, [feasibilityId, disciplineName]);

  // --- Invoice Upload Handler ---
  const handleFilesUploaded = async (files: File[]) => {
    console.log("Uploading with feasibilityId:", feasibilityId);
    for (const file of files) {
      try {
        const invoiceDetails = await parseInvoiceWithGPT(file);
        console.log("invoiceDetails from GPT:", invoiceDetails);
        const safeInvoiceDate = sanitizeDate(invoiceDetails.invoice_date);
        const safeDueDate = sanitizeDate(invoiceDetails.due_date);
        const toInsert = {
          invoice_number: invoiceDetails.invoice_number || "",
          invoice_date: safeInvoiceDate,
          supplier: invoiceDetails.supplier || "",
          description: invoiceDetails.description || "",
          amount_excl_gst: invoiceDetails.amount_excl_gst ?? 0,
          gst: invoiceDetails.gst ?? 0,
          amount_incl_gst: invoiceDetails.amount_incl_gst ?? 0,
          due_date: safeDueDate,
          feasibility_id: feasibilityId,
          cost_centre: disciplineName,
          payment_status: "Unpaid",
          approval_status: "Hold",
        };
        console.log("Inserting invoice:", toInsert);
        const { data, error } = await supabase.from("invoices").insert([toInsert]);
        if (error) console.error("Error inserting invoice:", error);
        else {
          console.log("Invoice inserted:", data);
          fetchInvoicePaidSummary();
        }
      } catch (err) {
        console.error("Error processing file:", file.name, err);
      }
    }
    setIsUploadModalOpen(false);
  };

  // --- Fetch budget from feasibility_line_items ---
  useEffect(() => {
    if (!feasibilityId) return;
    async function fetchBudget() {
      console.log("Fetching budget with feasibilityId:", feasibilityId, "disciplineName:", disciplineName);
      try {
        // First attempt with specific fields
        const { data, error } = await supabase
          .from("feasibility_line_items")
          .select("total_excluding_gst, total_including_gst, original_budget_excluding_gst, original_budget_including_gst, current_forecast")
          .eq("feasibility_id", feasibilityId)
          .eq("cost_category", disciplineName)
          .single();
        
        console.log("Fetched budget data:", data);
        console.log("Original Budget:", data?.original_budget_excluding_gst, data?.original_budget_including_gst);
        console.log("Current Forecast:", data?.current_forecast, data?.total_including_gst);
        
        if (!error && data) {
          setSummaryData((prev) =>
            prev.map((row) => {
              if (row.Column1 === "Original Budget") {
                return { 
                  ...row, 
                  Column2: data.original_budget_excluding_gst || 0, 
                  Column3: data.original_budget_including_gst || 0 
                };
              } else if (row.Column1 === "Current Forecast") {
                return { 
                  ...row, 
                  Column2: data.current_forecast || 0, 
                  Column3: data.total_including_gst || 0 
                };
              }
              return row;
            })
          );
        } else if (error) {
          console.error("Error fetching budget:", error);
          
          // Fallback: Retrieve all records for this feasibility ID
          console.log("FALLBACK: Fetching all records for feasibility ID:", feasibilityId);
          const { data: allRecords, error: allError } = await supabase
            .from("feasibility_line_items")
            .select("*")
            .eq("feasibility_id", feasibilityId);
            
          if (allError) {
            console.error("Error fetching all records:", allError);
          } else {
            console.log("All records for this feasibility:", allRecords);
            console.log("Available categories:", allRecords.map((r: any) => r.cost_category));
            
            // Try to find our discipline name
            const matchingRecord = allRecords.find((r: any) => r.cost_category === disciplineName);
            
            if (matchingRecord) {
              console.log("Found matching record:", matchingRecord);
              
              setSummaryData((prev) =>
                prev.map((row) => {
                  if (row.Column1 === "Original Budget") {
                    return { 
                      ...row, 
                      Column2: matchingRecord.original_budget_excluding_gst || 0, 
                      Column3: matchingRecord.original_budget_including_gst || 0 
                    };
                  } else if (row.Column1 === "Current Forecast") {
                    return { 
                      ...row, 
                      Column2: matchingRecord.current_forecast || 0, 
                      Column3: matchingRecord.total_including_gst || 0 
                    };
                  }
                  return row;
                })
              );
            } else {
              console.warn("No matching record found for:", disciplineName);
              
              // Try exact query once more with different approach
              const exactQuery = `
                SELECT * FROM feasibility_line_items 
                WHERE feasibility_id = '${feasibilityId}' 
                AND cost_category = '${disciplineName}'
              `;
              
              const { data: exactData, error: exactError } = await supabase.rpc('run_sql_query', {
                sql_query: exactQuery
              });
              
              if (exactError) {
                console.error("Error executing exact query:", exactError);
              } else if (exactData && exactData.length > 0) {
                console.log("Exact query results:", exactData);
                const record = exactData[0];
                
                setSummaryData((prev) =>
                  prev.map((row) => {
                    if (row.Column1 === "Original Budget") {
                      return { 
                        ...row, 
                        Column2: record.original_budget_excluding_gst || 0, 
                        Column3: record.original_budget_including_gst || 0 
                      };
                    } else if (row.Column1 === "Current Forecast") {
                      return { 
                        ...row, 
                        Column2: record.current_forecast || 0, 
                        Column3: record.total_including_gst || 0 
                      };
                    }
                    return row;
                  })
                );
              }
            }
          }
        }
      } catch (e) {
        console.error("Exception in fetchBudget:", e);
      }
    }
    fetchBudget();
    const subscription = supabase
      .channel("budget-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feasibility_line_items",
          filter: `feasibility_id=eq.${feasibilityId}`
        },
        (payload) => {
          if (payload.new && payload.new.cost_category === disciplineName) {
            setSummaryData((prev) =>
              prev.map((row) => {
                if (row.Column1 === "Original Budget") {
                  return { 
                    ...row, 
                    Column2: payload.new.original_budget_excluding_gst || 0, 
                    Column3: payload.new.original_budget_including_gst || 0 
                  };
                } else if (row.Column1 === "Current Forecast") {
                  return { 
                    ...row, 
                    Column2: payload.new.current_forecast || 0, 
                    Column3: payload.new.total_including_gst || 0 
                  };
                }
                return row;
              })
            );
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchInvoicePaidSummary, feasibilityId, disciplineName]);

  // --- Fetch committed sums via RPC ---
  useEffect(() => {
    async function fetchCommittedSums() {
      const { data, error } = await supabase.rpc("get_committed_sums", {
        p_feasibility_id: feasibilityId,
        p_cost_centre: disciplineName,
      });
      if (error) console.error("Error fetching committed sums:", error);
      else if (data && data.length > 0) {
        setSummaryData((prev) =>
          prev.map((row) =>
            row.Column1 === "Committed"
              ? { ...row, Column2: data[0].sum_fee_excl_gst, Column3: data[0].sum_fee_incl_gst }
              : row
          )
        );
      }
    }
    fetchCommittedSums();
  }, [feasibilityId, disciplineName]);

  // --- Fetch expended sums via RPC ---
  useEffect(() => {
    async function fetchExpendedSums() {
      const { data, error } = await supabase.rpc("get_expended_sums", {
        p_feasibility_id: feasibilityId,
        p_cost_centre: disciplineName,
      });
      if (error) console.error("Error fetching expended sums:", error);
      else if (data && data.length > 0) {
        setSummaryData((prev) =>
          prev.map((row) =>
            row.Column1 === "Expended"
              ? { ...row, Column2: data[0].sum_paid_excl_gst, Column3: data[0].sum_paid_incl_gst }
              : row
          )
        );
      }
    }
    fetchExpendedSums();
  }, [feasibilityId, disciplineName]);

  // --- Fetch approved invoices ---
  useEffect(() => {
    async function fetchApprovedInvoices() {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("feasibility_id", feasibilityId)
        .eq("cost_centre", disciplineName)
        .eq("approval_status", "Approved");
      if (error) console.error("Error fetching approved invoices:", error);
      else if (data) {
        const mappedInvoices = data.map((invoice: any) => ({
          id: invoice.invoice_id || uuidv4(),
          invoice_id: invoice.invoice_id,
          Column1: invoice.invoice_date,
          Column2: invoice.due_date,
          Column3: invoice.invoice_number,
          Column4: invoice.supplier,
          Column5: invoice.description,
          Column6: invoice.amount_excl_gst != null ? invoice.amount_excl_gst : 0,
          Column7: invoice.gst != null ? invoice.gst : 0,
          Column8: invoice.amount_incl_gst != null ? invoice.amount_incl_gst : 0,
          Column9: invoice.cost_centre,
          Column10: invoice.stage || "",
          Column11: invoice.approval_status,
          Column12: invoice.payment_status,
          Column13: invoice.attachment,
          Column14: invoice.paid_date,
          raw_amount_excl_gst: invoice.amount_excl_gst,
        }));
        setInvoicesData(mappedInvoices);
      }
    }
    fetchApprovedInvoices();
  }, [feasibilityId, disciplineName]);

  // --- Global Recalculation using concurrent queries ---
  const recalcAllGrids = useCallback(async () => {
    console.log("recalcAllGrids: Starting data refresh");
    try {
      // Kick off concurrent requests.
      const invoicePaidPromise = fetchInvoicePaidSummary(); // updates invoicePaidSummary state.
      const budgetPromise = supabase
        .from("feasibility_line_items")
        .select("total_excluding_gst, total_including_gst, original_budget_excluding_gst, original_budget_including_gst, current_forecast")
        .eq("feasibility_id", feasibilityId)
        .eq("cost_category", disciplineName)
        .single();

      // Debug query to check what's in feasibility_line_items
      const debugPromise = supabase
        .from("feasibility_line_items")
        .select("*")
        .eq("feasibility_id", feasibilityId);

      const committedPromise = supabase.rpc("get_committed_sums", {
        p_feasibility_id: feasibilityId,
        p_cost_centre: disciplineName,
      });
      
      console.log("recalcAllGrids: Calling get_committed_sums with params:", {
        p_feasibility_id: feasibilityId,
        p_cost_centre: disciplineName,
      });
      
      const expendedPromise = supabase.rpc("get_expended_sums", {
        p_feasibility_id: feasibilityId,
        p_cost_centre: disciplineName,
      });
      const stagesPromise = supabase
        .from("management_costs_view")
        .select("*")
        .eq("feasibility_id", feasibilityId)
        .eq("cost_centre", disciplineName)
        .order("id", { ascending: true });
      const invoicesPromise = supabase
        .from("invoices")
        .select("*")
        .eq("feasibility_id", feasibilityId)
        .eq("cost_centre", disciplineName)
        .eq("approval_status", "Approved");

      const [
        budgetResult,
        committedResult,
        expendedResult,
        stagesResult,
        invoicesResult,
        debugResult,
      ] = await Promise.all([
        budgetPromise,
        committedPromise,
        expendedPromise,
        stagesPromise,
        invoicesPromise,
        debugPromise,
      ]);

      // Debug logging for all feasibility_line_items
      if (debugResult && !debugResult.error) {
        console.log("Debug - All feasibility_line_items records:", debugResult.data);
        console.log("Debug - Found records:", debugResult.data.length);
        console.log("Debug - Looking for cost_category:", disciplineName);
        
        // Find matching records
        const matchingRecords = debugResult.data.filter(
          (record: any) => record.cost_category === disciplineName
        );
        console.log("Debug - Matching records:", matchingRecords);
      }

      // Update Summary Grid – Budget
      if (!budgetResult.error && budgetResult.data) {
        console.log("recalcAllGrids budget data:", budgetResult.data);
        console.log("Original Budget:", budgetResult.data?.original_budget_excluding_gst, budgetResult.data?.original_budget_including_gst);
        console.log("Current Forecast:", budgetResult.data?.current_forecast, budgetResult.data?.total_including_gst);
        
        setSummaryData((prev) =>
          prev.map((row) => {
            if (row.Column1 === "Original Budget") {
              return { 
                ...row, 
                Column2: budgetResult.data.original_budget_excluding_gst || 0, 
                Column3: budgetResult.data.original_budget_including_gst || 0 
              };
            } else if (row.Column1 === "Current Forecast") {
              return { 
                ...row, 
                Column2: budgetResult.data.current_forecast || 0, 
                Column3: budgetResult.data.total_including_gst || 0 
              };
            }
            return row;
          })
        );
      } else if (budgetResult.error) {
        console.error("Error fetching budget:", budgetResult.error);
      }

      // Update Summary Grid – Committed sums
      if (!committedResult.error && committedResult.data && committedResult.data.length > 0) {
        console.log("Committed sums from RPC:", committedResult.data);
        setSummaryData((prev) =>
          prev.map((row) =>
            row.Column1 === "Committed"
              ? {
                  ...row,
                  Column2: committedResult.data[0].sum_fee_excl_gst,
                  Column3: committedResult.data[0].sum_fee_incl_gst,
                }
              : row
          )
        );
      } else {
        console.error("Error fetching committed sums:", committedResult.error);
        console.error("Committed result data:", committedResult.data);
      }

      // Update Summary Grid – Expended sums
      if (!expendedResult.error && expendedResult.data && expendedResult.data.length > 0) {
        setSummaryData((prev) =>
          prev.map((row) =>
            row.Column1 === "Expended"
              ? {
                  ...row,
                  Column2: expendedResult.data[0].sum_paid_excl_gst,
                  Column3: expendedResult.data[0].sum_paid_incl_gst,
                }
              : row
          )
        );
      } else {
        console.error("Error fetching expended sums:", expendedResult.error);
      }

      // Update Stage Grid
      if (!stagesResult.error) {
        console.log("Stages data from view:", stagesResult.data);
        setStagesData(stagesResult.data || []);
      } else {
        console.error("Error fetching stage data:", stagesResult.error);
      }

      // Update Invoices Grid while preserving row order.
      if (!invoicesResult.error && invoicesResult.data) {
        const fetchedInvoicesMap = new Map();
        invoicesResult.data.forEach((invoice: any) => {
          fetchedInvoicesMap.set(invoice.invoice_id, invoice);
        });
        setInvoicesData((currentInvoices) => {
          const updatedInvoices = currentInvoices.map((row) => {
            const updated = fetchedInvoicesMap.get(row.invoice_id);
            if (updated) {
              return {
                ...row,
                Column1: updated.invoice_date,
                Column2: updated.due_date,
                Column3: updated.invoice_number,
                Column4: updated.supplier,
                Column5: updated.description,
                Column6: updated.amount_excl_gst != null ? updated.amount_excl_gst : 0,
                Column7: updated.gst != null ? updated.gst : 0,
                Column8: updated.amount_incl_gst != null ? updated.amount_incl_gst : 0,
                Column9: updated.cost_centre,
                Column10: updated.stage || "",
                Column11: updated.approval_status,
                Column12: updated.payment_status,
                Column13: updated.attachment,
                Column14: updated.paid_date,
                raw_amount_excl_gst: updated.amount_excl_gst,
              };
            }
            return row;
          });
          const existingInvoiceIds = new Set(currentInvoices.map((row) => row.invoice_id));
          invoicesResult.data.forEach((updated: any) => {
            if (!existingInvoiceIds.has(updated.invoice_id)) {
              updatedInvoices.push({
                id: updated.invoice_id || uuidv4(),
                invoice_id: updated.invoice_id,
                Column1: updated.invoice_date,
                Column2: updated.due_date,
                Column3: updated.invoice_number,
                Column4: updated.supplier,
                Column5: updated.description,
                Column6: updated.amount_excl_gst != null ? updated.amount_excl_gst : 0,
                Column7: updated.gst != null ? updated.gst : 0,
                Column8: updated.amount_incl_gst != null ? updated.amount_incl_gst : 0,
                Column9: updated.cost_centre,
                Column10: updated.stage || "",
                Column11: updated.approval_status,
                Column12: updated.payment_status,
                Column13: updated.attachment,
                Column14: updated.paid_date,
                raw_amount_excl_gst: updated.amount_excl_gst,
              });
            }
          });
          return updatedInvoices;
        });
      } else {
        console.error("Error fetching approved invoices:", invoicesResult.error);
      }
      
      console.log("recalcAllGrids: Completed data refresh");
    } catch (err) {
      console.error("Error during recalculation:", err);
    }
  }, [fetchInvoicePaidSummary, feasibilityId, disciplineName]);

  // --- Handle cell key down (Enter moves focus to next row) ---
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

  // --- Context Menu Handlers ---
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number | null;
    mouseY: number | null;
    rowIndex: number | null;
    gridId: string | undefined;
  }>({
    mouseX: null,
    mouseY: null,
    rowIndex: null,
    gridId: "",
  });

  // This handler is used only on the lower two grids.
  function handleCellContextMenu(params: any, gridId: string) {
    setContextMenu({
      mouseX: params.event.clientX,
      mouseY: params.event.clientY,
      rowIndex: params.node.rowIndex,
      gridId,
    });
  }

  async function handleAddRowBelow() {
    if (contextMenu.rowIndex == null || !contextMenu.gridId) return;
    if (contextMenu.gridId === "stages") {
      const newRow = {
        id: uuidv4(),
        feasibility_id: feasibilityId,
        cost_centre: disciplineName,
        stage: "New Stage",
        fee_excluding_gst: 0,
        fee_including_gst: 0,
        total_paid_excluding_gst: 0,
        total_paid_including_gst: 0,
        percentage_complete_excluding_gst: 0,
        percentage_complete_including_gst: 0,
        programme: "",
      };
      const newData = [...stagesData];
      newData.splice(contextMenu.rowIndex + 1, 0, newRow);
      setStagesData(newData);
      
      try {
        // Step 1: Insert the new stage
        const { data, error } = await supabase
          .from("management_costs")
          .insert(newRow);
          
        if (error) {
          console.error("Error inserting stage row:", error);
          console.error("Error details:", JSON.stringify(error));
        } else {
          console.log("Stage row inserted successfully:", data);
          
          try {
            // Step 2: Fetch all stages to calculate total committed amount
            const { data: stages, error: stagesError } = await supabase
              .from("management_costs_view")
              .select("*")
              .eq("feasibility_id", feasibilityId)
              .eq("cost_centre", disciplineName);
              
            if (stagesError) {
              console.error("Error fetching stages:", stagesError);
            } else if (stages && stages.length > 0) {
              // Step 3: Calculate total committed amounts
              const totalExclGST = stages.reduce((sum, stage) => sum + (Number(stage.fee_excluding_gst) || 0), 0);
              const totalInclGST = stages.reduce((sum, stage) => sum + (Number(stage.fee_including_gst) || 0), 0);
              
              console.log("Calculated total committed amounts after adding stage:", {
                excl_gst: totalExclGST,
                incl_gst: totalInclGST
              });
              
              // Step 4: Update the feasibility_line_items table
              try {
                const { data: lineItemData, error: lineItemError } = await supabase
                  .from("feasibility_line_items")
                  .update({
                    committed_excluding_gst: totalExclGST,
                    committed_including_gst: totalInclGST
                  })
                  .eq("feasibility_id", feasibilityId)
                  .eq("cost_category", disciplineName);
                  
                if (lineItemError) {
                  console.error("Error updating feasibility_line_items:", lineItemError);
                  
                  // Check if line item exists
                  const { data: lineItem, error: fetchError } = await supabase
                    .from("feasibility_line_items")
                    .select("*")
                    .eq("feasibility_id", feasibilityId)
                    .eq("cost_category", disciplineName);
                    
                  if (fetchError) {
                    console.error("Error fetching feasibility_line_items:", fetchError);
                  } else if (!lineItem || lineItem.length === 0) {
                    console.log("No existing line item found, creating one");
                    
                    // Create a new line item
                    const { data: insertData, error: insertError } = await supabase
                      .from("feasibility_line_items")
                      .insert({
                        feasibility_id: feasibilityId,
                        cost_category: disciplineName,
                        committed_excluding_gst: totalExclGST,
                        committed_including_gst: totalInclGST
                      });
                      
                    if (insertError) {
                      console.error("Error inserting feasibility_line_items:", insertError);
                    } else {
                      console.log("Created new feasibility line item:", insertData);
                    }
                  }
                } else {
                  console.log("Updated feasibility_line_items successfully:", lineItemData);
                }
              } catch (lineItemError) {
                console.error("Exception updating feasibility_line_items:", lineItemError);
              }
            }
          } catch (e) {
            console.error("Exception processing stages:", e);
          }
          
          await recalcAllGrids();
        }
      } catch (e) {
        console.error("Exception in handleAddRowBelow:", e);
      }
    } else if (contextMenu.gridId === "invoices") {
      const newRow = {
        id: uuidv4(),
        Column1: "New Invoice Date",
        Column2: "New Due Date",
        Column3: "ARCH-NEW",
        Column4: "Supplier Name",
        Column5: "Description",
        Column6: 0,
        Column7: 0,
        Column8: 0,
        Column9: disciplineName,
        Column10: "",
        Column11: "Hold",
        Column12: "Unpaid",
        Column13: "Attachment",
      };
      const newData = [...invoicesData];
      newData.splice(contextMenu.rowIndex + 1, 0, newRow);
      setInvoicesData(newData);
    }
    closeContextMenu();
  }

  async function handleDeleteRow() {
    if (contextMenu.rowIndex == null || !contextMenu.gridId) return;
    if (contextMenu.gridId === "stages") {
      const rowToDelete = stagesData[contextMenu.rowIndex];
      const newData = [...stagesData];
      newData.splice(contextMenu.rowIndex, 1);
      setStagesData(newData);
      const { error } = await supabase.from("management_costs").delete().eq("id", rowToDelete.id);
      if (error) console.error("Error deleting stage row:", error);
      else console.log("Stage row deleted successfully");
    } else if (contextMenu.gridId === "invoices") {
      const newData = [...invoicesData];
      newData.splice(contextMenu.rowIndex, 1);
      setInvoicesData(newData);
    }
    closeContextMenu();
  }

  // --- New: Handle View Invoice (only for invoices grid) ---
  async function handleViewInvoice() {
    if (contextMenu.rowIndex == null || contextMenu.gridId !== "invoices") return;
    const invoiceToView = invoicesData[contextMenu.rowIndex];
    if (!invoiceToView) return;
    if (invoiceToView.Column13) {
      console.log("Attempting to create signed URL for:", invoiceToView.Column13);
      const { data, error } = await supabase.storage
        .from("invoices")
        .createSignedUrl(invoiceToView.Column13, 31536000);
      if (error) {
        console.error("Error generating signed URL:", error);
        return;
      }
      const signedUrl = data.signedURL || data.signedUrl;
      if (signedUrl && signedUrl.startsWith("http")) {
        window.open(signedUrl, "_blank");
      } else {
        console.error("Signed URL not valid:", data);
      }
    } else {
      console.error("No attachment available");
    }
    closeContextMenu();
  }

  function closeContextMenu() {
    setContextMenu({ mouseX: null, mouseY: null, rowIndex: null, gridId: "" });
  }

  // --- Invoice Cell Value Change Handler ---
  const handleInvoiceCellValueChanged = async (params: any) => {
    const newData = [...invoicesData];
    newData[params.node.rowIndex] = { ...params.data };
    setInvoicesData(newData);
    const invoiceId = params.data.invoice_id;
    if (!invoiceId) {
      console.error("Missing invoice_id, cannot update record");
      return;
    }
    if (params.colDef.field === "Column10") {
      const newStage = params.newValue;
      const { error } = await supabase
        .from("invoices")
        .update({ stage: newStage })
        .eq("invoice_id", invoiceId);
      if (error) console.error("Error updating invoice stage:", error);
      else {
        console.log("Invoice stage updated successfully");
        await recalcAllGrids();
      }
    } else if (params.colDef.field === "Column12") {
      const newPaymentStatus = params.newValue;
      const updatePayload: any = { payment_status: newPaymentStatus };
      if (newPaymentStatus === "Paid") {
        updatePayload.paid_date = new Date().toISOString().slice(0, 10);
      } else {
        updatePayload.paid_date = null;
      }
      const { error } = await supabase
        .from("invoices")
        .update(updatePayload)
        .eq("invoice_id", invoiceId);
      if (error) console.error("Error updating invoice payment status:", error);
      else {
        console.log("Invoice payment status updated successfully");
        await recalcAllGrids();
      }
    } else if (params.colDef.field === "Column14") {
      // Manually updated Paid Date cell
      const newPaidDate = params.newValue;
      const safePaidDate = sanitizeDate(newPaidDate);
      const { error } = await supabase
        .from("invoices")
        .update({ paid_date: safePaidDate })
        .eq("invoice_id", invoiceId);
      if (error) console.error("Error updating invoice paid_date:", error);
      else {
        console.log("Invoice paid_date updated successfully");
        await recalcAllGrids();
      }
    }
  };

  // --- Stage Cell Value Change Handler ---
  const handleStageCellValueChanged = async (params: any) => {
    const updatedRow = {
      id: params.data.id,
      stage: params.data.stage,
      fee_excluding_gst: Number(params.data.fee_excluding_gst),
      programme: params.data.programme,
      feasibility_id: feasibilityId,
      cost_centre: disciplineName,
    };
    console.log("Stage update payload:", updatedRow);
    
    try {
      // Step 1: Update the management_costs table
      const { data, error } = await supabase
        .from("management_costs")
        .upsert(updatedRow);
      
      if (error) {
        console.error("Error upserting stage row:", error);
        console.error("Error details:", JSON.stringify(error));
      } else {
        console.log("Stage row updated successfully:", data);
        
        try {
          // Step 2: Fetch all stages for this cost center to calculate total committed amount
          const { data: stages, error: stagesError } = await supabase
            .from("management_costs_view")
            .select("*")
            .eq("feasibility_id", feasibilityId)
            .eq("cost_centre", disciplineName)
            .order("id", { ascending: true });
            
          if (stagesError) {
            console.error("Error fetching updated stage data:", stagesError);
            console.error("Error details:", JSON.stringify(stagesError));
          } else {
            console.log("Fetched updated stages:", stages);
            setStagesData(stages || []);
            
            // Step 3: Calculate total committed amounts
            const totalExclGST = stages.reduce((sum, stage) => sum + (Number(stage.fee_excluding_gst) || 0), 0);
            const totalInclGST = stages.reduce((sum, stage) => sum + (Number(stage.fee_including_gst) || 0), 0);
            
            console.log("Calculated total committed amounts:", {
              excl_gst: totalExclGST,
              incl_gst: totalInclGST
            });
            
            // Step 4: Update the feasibility_line_items table with the committed amounts
            try {
              const { data: lineItemData, error: lineItemError } = await supabase
                .from("feasibility_line_items")
                .update({
                  committed_excluding_gst: totalExclGST,
                  committed_including_gst: totalInclGST
                })
                .eq("feasibility_id", feasibilityId)
                .eq("cost_category", disciplineName);
                
              if (lineItemError) {
                console.error("Error updating feasibility_line_items:", lineItemError);
                console.error("Error details:", JSON.stringify(lineItemError));
                
                // Try to fetch the line item to see if it exists
                const { data: lineItem, error: fetchError } = await supabase
                  .from("feasibility_line_items")
                  .select("*")
                  .eq("feasibility_id", feasibilityId)
                  .eq("cost_category", disciplineName);
                  
                if (fetchError) {
                  console.error("Error fetching feasibility_line_items:", fetchError);
                } else if (!lineItem || lineItem.length === 0) {
                  console.log("No existing line item found, creating one");
                  
                  // Create a new line item if it doesn't exist
                  const { data: insertData, error: insertError } = await supabase
                    .from("feasibility_line_items")
                    .insert({
                      feasibility_id: feasibilityId,
                      cost_category: disciplineName,
                      committed_excluding_gst: totalExclGST,
                      committed_including_gst: totalInclGST
                    });
                    
                  if (insertError) {
                    console.error("Error inserting feasibility_line_items:", insertError);
                    console.error("Error details:", JSON.stringify(insertError));
                  } else {
                    console.log("Created new feasibility line item:", insertData);
                  }
                } else {
                  console.log("Line item exists but update failed:", lineItem);
                }
              } else {
                console.log("Updated feasibility_line_items successfully:", lineItemData);
              }
            } catch (lineItemError) {
              console.error("Exception updating feasibility_line_items:", lineItemError);
            }
          }
          
          await recalcAllGrids();
        } catch (fetchError) {
          console.error("Exception during stage data refresh:", fetchError);
        }
      }
    } catch (e) {
      console.error("Exception in handleStageCellValueChanged:", e);
    }
  };

  return (
    <div
      className={styles.tableContainerWhite}
      style={{ position: "relative", overflowX: "hidden" }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (contextMenu.mouseX !== null) closeContextMenu();
      }}
    >
      <h2 className="headingTitle">{toTitleCase(disciplineName)}</h2>
      <button
        onClick={() => setIsUploadModalOpen(true)}
        title="Upload Invoices"
        style={{
          position: "absolute",
          top: "1rem",
          right: "-2rem",
          padding: "10px 20px",
          backgroundColor: "transparent",
          color: "black",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          width: "10rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AiOutlineFileAdd size={24} />
      </button>
      <InvoiceUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onFilesUploaded={handleFilesUploaded}
      />

      {/* Summary Grid (no context menu) */}
      <div className={`ag-theme-alpine ${styles.agGridWrapper}`}>
        <AgGridReact
          rowData={summaryData}
          columnDefs={[
            { headerName: "Item", field: "Column1", width: 250, editable: false },
            {
              headerName: "Amount (Excl. GST)",
              field: "Column2",
              width: 200,
              editable: false,
              valueFormatter: dollarFormatter,
              valueParser: (params: any) => {
                if (typeof params.newValue === "string") {
                  return parseFloat(params.newValue.replace(/[^0-9.-]+/g, ""));
                }
                return params.newValue;
              },
            },
            {
              headerName: "Amount (Incl. GST)",
              field: "Column3",
              width: 200,
              editable: false,
              valueFormatter: dollarFormatter,
              valueParser: (params: any) => {
                if (typeof params.newValue === "string") {
                  return parseFloat(params.newValue.replace(/[^0-9.-]+/g, ""));
                }
                return params.newValue;
              },
            },
          ]}
          defaultColDef={{
            editable: false, // Make all cells non-editable
            cellClass: "lightGreyCell",
            resizable: false,
            suppressMovable: true,
          }}
          deltaRowDataMode
          getRowId={(params) => params.data.id.toString()}
          getRowHeight={(params) => (params.data.isHeading ? 50 : params.data.isTotal ? 40 : 35)}
          onCellKeyDown={handleCellKeyDown}
          onCellValueChanged={async (params) => {
            const newData = [...summaryData];
            newData[params.node.rowIndex] = { ...params.data };
            setSummaryData(newData);
            
            // If the Committed row is updated, save to Supabase
            if (params.data.Column1 === "Committed") {
              // Find the stage rows to update
              const stageRows = stagesData.map(row => ({
                ...row,
                feasibility_id: feasibilityId,
                cost_centre: disciplineName
              }));
              
              if (stageRows.length === 0) {
                // Create a new default stage for this cost category
                const newStage = {
                  id: uuidv4(),
                  stage: "Default Stage",
                  fee_excluding_gst: params.data.Column2, // Amount (Excl. GST)
                  fee_including_gst: params.data.Column3, // Amount (Incl. GST)
                  feasibility_id: feasibilityId,
                  cost_centre: disciplineName
                };
                
                const { error } = await supabase
                  .from("management_costs")
                  .upsert(newStage, { returning: "minimal" });
                  
                if (error) {
                  console.error("Error creating default stage:", error);
                } else {
                  console.log("Default stage created successfully");
                  await recalcAllGrids();
                }
              } else {
                // Update existing stages to match new committed amounts
                // Proportionally distribute the new committed amount
                const oldTotal = stageRows.reduce((sum, row) => sum + (row.fee_excluding_gst || 0), 0);
                const newTotal = params.data.Column2;
                
                if (oldTotal > 0 && newTotal > 0) {
                  const ratio = newTotal / oldTotal;
                  
                  // Update each stage's fee proportionally
                  for (const row of stageRows) {
                    const updatedFeeExcl = (row.fee_excluding_gst || 0) * ratio;
                    const updatedFeeIncl = updatedFeeExcl * 1.1; // Apply GST
                    
                    const { error } = await supabase
                      .from("management_costs")
                      .update({ 
                        fee_excluding_gst: updatedFeeExcl,
                        fee_including_gst: updatedFeeIncl
                      })
                      .eq("id", row.id);
                      
                    if (error) {
                      console.error(`Error updating stage ${row.stage}:`, error);
                    }
                  }
                  
                  await recalcAllGrids();
                }
              }
            }
          }}
          rowClassRules={{
            [styles.headingRow]: (params: any) => params.data.isHeading,
            [styles.totalRow]: (params: any) => params.data.isTotal,
            [styles.normalRow]: (params: any) => !params.data.isHeading && !params.data.isTotal,
          }}
        />
      </div>

      {/* Stage Grid (context menu enabled) */}
      <div
        className={`ag-theme-alpine ${styles.agGridWrapper}`}
        style={{ marginTop: "-9rem" }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (stagesData.length === 0) {
            setContextMenu({
              mouseX: e.clientX,
              mouseY: e.clientY,
              rowIndex: 0,
              gridId: "stages",
            });
          }
        }}
      >
        <AgGridReact
          rowData={stagesData}
          columnDefs={[
            { headerName: "Stage", field: "stage", width: 250, editable: true },
            {
              headerName: "Fee (Excl. GST)",
              field: "fee_excluding_gst",
              width: 200,
              editable: true,
              valueFormatter: dollarFormatter,
              valueParser: (params: any) => {
                if (typeof params.newValue === "string") {
                  return parseFloat(params.newValue.replace(/[^0-9.-]+/g, ""));
                }
                return params.newValue;
              },
            },
            {
              headerName: "Fee (Incl. GST)",
              field: "fee_including_gst",
              width: 200,
              editable: false,
              valueFormatter: dollarFormatter,
            },
            {
              headerName: "Paid (Excl. GST)",
              field: "total_paid_excluding_gst",
              width: 180,
              editable: false,
              valueFormatter: dollarFormatter,
            },
            {
              headerName: "Paid (Incl. GST)",
              field: "total_paid_including_gst",
              width: 180,
              editable: false,
              valueFormatter: dollarFormatter,
            },
            {
              headerName: "Percentage Complete (Excl. GST)",
              field: "percentage_complete_excluding_gst",
              width: 180,
              editable: false,
              valueFormatter: percentFormatter,
            },
            {
              headerName: "Percentage Complete (Incl. GST)",
              field: "percentage_complete_including_gst",
              width: 180,
              editable: false,
              valueFormatter: percentFormatter,
            },
            { 
              headerName: "Programme", 
              field: "programme", 
              width: 250, 
              editable: true,
              cellEditor: "agSelectCellEditor",
              cellEditorParams: { values: programmeItems },
            },
          ]}
          defaultColDef={{
            editable: true,
            sortable: false,
            cellClass: "lightGreyCell",
            resizable: false,
            suppressMovable: true,
          }}
          deltaRowDataMode
          getRowId={(params) => params.data.id.toString()}
          getRowHeight={(params) => (params.data.isHeading ? 50 : params.data.isTotal ? 40 : 35)}
          onCellKeyDown={handleCellKeyDown}
          onCellContextMenu={(params) => {
            handleCellContextMenu(params, "stages");
          }}
          onCellValueChanged={handleStageCellValueChanged}
          rowClassRules={{
            [styles.headingRow]: (params: any) => params.data.isHeading,
            [styles.totalRow]: (params: any) => params.data.isTotal,
            [styles.normalRow]: (params: any) => !params.data.isHeading && !params.data.isTotal,
          }}
        />
      </div>

      {/* Invoices Grid (context menu enabled) */}
      <div
        className={`ag-theme-alpine ${styles.agGridWrapper}`}
        style={{ marginTop: "0rem" }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (invoicesData.length === 0) {
            setContextMenu({
              mouseX: e.clientX,
              mouseY: e.clientY,
              rowIndex: 0,
              gridId: "invoices",
            });
          }
        }}
      >
        <AgGridReact
          rowData={invoicesData}
          columnDefs={[
            { headerName: "Invoice Date", field: "Column1", width: 180 },
            { headerName: "Due Date", field: "Column2", width: 180 },
            { headerName: "Invoice Number", field: "Column3", width: 200 },
            { headerName: "Supplier", field: "Column4", width: 200 },
            { headerName: "Description", field: "Column5", width: 180 },
            {
              headerName: "Amount (Excl. GST)",
              field: "Column6",
              width: 180,
              valueFormatter: dollarFormatter,
            },
            {
              headerName: "GST",
              field: "Column7",
              width: 180,
              valueFormatter: dollarFormatter,
            },
            {
              headerName: "Amount (Incl. GST)",
              field: "Column8",
              width: 180,
              valueFormatter: dollarFormatter,
            },
            { headerName: "Cost Code", field: "Column9", width: 180 },
            {
              headerName: "Stage",
              field: "Column10",
              width: 180,
              editable: true,
              cellEditor: "agSelectCellEditor",
              cellEditorParams: { values: stageDropdownValues },
            },
            {
              headerName: "Approval Status",
              field: "Column11",
              width: 180,
              editable: true,
              cellEditor: "agSelectCellEditor",
              cellEditorParams: { values: ["Approved", "Partially Approved", "Hold"] },
            },
            {
              headerName: "Payment Status",
              field: "Column12",
              width: 180,
              editable: true,
              cellEditor: "agSelectCellEditor",
              cellEditorParams: { values: ["Paid", "Unpaid"] },
            },
            {
              headerName: "Paid Date",
              field: "Column14",
              width: 180,
            },
            { headerName: "Attachment", field: "Column13", width: 180 },
          ]}
          defaultColDef={{
            editable: true,
            cellClass: "lightGreyCell",
            resizable: false,
            suppressMovable: true,
          }}
          deltaRowDataMode
          getRowId={(params) => params.data.id.toString()}
          getRowHeight={(params) => (params.data.isHeading ? 50 : params.data.isTotal ? 40 : 35)}
          onCellContextMenu={(params) => {
            handleCellContextMenu(params, "invoices");
          }}
          onCellKeyDown={handleCellKeyDown}
          onCellValueChanged={handleInvoiceCellValueChanged}
          rowClassRules={{
            [styles.headingRow]: (params: any) => params.data.isHeading,
            [styles.totalRow]: (params: any) => params.data.isTotal,
            [styles.normalRow]: (params: any) => !params.data.isHeading && !params.data.isTotal,
          }}
        />
      </div>

      {/* Context Menu Popup (only shown for the lower two grids) */}
      {contextMenu.mouseX !== null && contextMenu.mouseY !== null && (
        <div
          className={styles.popupMenu}
          style={{
            top: contextMenu.mouseY,
            left: contextMenu.mouseX,
            position: "fixed",
            zIndex: 1000,
          }}
          onClick={closeContextMenu}
        >
          {/* For invoices grid, show the extra "View Invoice" option */}
          {contextMenu.gridId === "invoices" && (
            <div className={styles.menuItem} onClick={handleViewInvoice}>
              View Invoice
            </div>
          )}
          <div className={styles.menuItem} onClick={handleAddRowBelow}>
            Add Row Below
          </div>
          <div className={styles.menuItem} onClick={handleDeleteRow}>
            Delete Row
          </div>
        </div>
      )}
    </div>
  );
}
