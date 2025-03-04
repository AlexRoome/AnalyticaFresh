import React, { useState, useEffect, useMemo } from "react";
import { useRowDataContext } from "../../contexts/RowDataContext";
import { useGstMode } from "../../contexts/GstModeContext";
import { useCashflowMode } from "../../contexts/CashflowModeContext";
import { useCashflowProfile } from "../../contexts/CashflowProfileContext";
import { useSidebarContext } from "../../contexts/SidebarContext";
import { supabase } from "../../lib/supabase";
import { formatWithCommas } from "../../utils/formatWithCommas";
import { formatCurrency } from "../../utils/formatCurrency";

function FeasibilityGridInner({ feasibilityId }: { feasibilityId?: string }) {
  const { rowData, setRowData } = useRowDataContext();
  const { gstMode } = useGstMode();
  const { cashflowMode } = useCashflowMode();
  const { selectedProfile } = useCashflowProfile();
  const { isDarkMode } = useSidebarContext();

  // Add state to track management costs data for the fee proposal link
  const [managementCostsData, setManagementCostsData] = useState<any[]>([]);

  // Add effect to fetch management costs data when feasibilityId is available
  useEffect(() => {
    if (feasibilityId) {
      // Fetch management costs data for this feasibility
      const fetchManagementCosts = async () => {
        try {
          const { data, error } = await supabase
            .from("management_costs_view")
            .select("*")
            .eq("feasibility_id", feasibilityId);
            
          if (error) {
            console.error("Error fetching management costs data:", error);
          } else {
            setManagementCostsData(data || []);
            
            // Update the rows with the management costs data
            updateRowsWithManagementCostsData(data || []);
          }
        } catch (err) {
          console.error("Error in fetchManagementCosts:", err);
        }
      };
      
      fetchManagementCosts();
    }
  }, [feasibilityId]);
  
  // Function to update rows with management costs data
  const updateRowsWithManagementCostsData = (managementCosts: any[]) => {
    if (!managementCosts.length) return;
    
    console.log("[DEBUG] All management costs data:", managementCosts);
    
    setRowData(prevRows => {
      const newRows = [...prevRows];
      
      // Loop through rows to map management costs by cost_centre
      newRows.forEach((row, index) => {
        // Skip heading rows and total rows
        if (row.isHeading || row.isTotal) return;
        
        const rowName = row.Column1;
        
        // Find matching management costs by cost_centre
        const matchingCosts = managementCosts.filter(cost => 
          cost.cost_centre?.toLowerCase() === rowName.toLowerCase()
        );
        
        console.log(`[DEBUG] Row "${rowName}" - Matching costs:`, matchingCosts.length > 0 ? matchingCosts : "None");
        
        if (matchingCosts.length > 0) {
          // Sum up fees from matched management costs
          const totalFee = matchingCosts.reduce((sum, cost) => 
            sum + (parseFloat(cost.fee_excluding_gst) || 0), 0);
          
          console.log(`[DEBUG] Row "${rowName}" - Total fee: ${totalFee}`);
          
          // Update the row with the calculated fee
          if (totalFee > 0) {
            // Calculate original budget and remaining budget (if any)
            const originalBudget = gstMode === "incl"
              ? parseFloat(row.original_budget_including_gst || "0")
              : parseFloat(row.original_budget_excluding_gst || "0");
            
            const remainingBudget = Math.max(0, originalBudget - totalFee);
            
            console.log(`[DEBUG] Row "${rowName}" - Original budget: ${originalBudget}, Remaining: ${remainingBudget}`);
            
            // Only update if there's no manual override
            if (!row.monthly_manual_overrides || 
                Object.keys(row.monthly_manual_overrides).length === 0) {
              
              // Update the current forecast with the calculated fee
              newRows[index] = {
                ...row,
                current_forecast: totalFee.toString(),
                Column4: totalFee.toString(),
                // Add total committed amount for use in distribution
                total_committed_amount: totalFee,
                // Add remaining budget for use in distribution
                remaining_budget: remainingBudget
              };
              
              // Get the programme/task name from the first matching cost
              // (assuming all costs for the same centre have the same programme)
              const programmeName = matchingCosts[0]?.programme;
              
              console.log(`[DEBUG] Row "${rowName}" - Programme name: ${programmeName || "None"}`);
              
              // Recalculate distribution if there are months defined and a programme is available
              if (ganttMonths?.length > 0 && programmeName) {
                // Find the matching gantt task by task_name
                const matchingTask = ganttTasks?.find(task => task.text === programmeName);
                
                console.log(`[DEBUG] Row "${rowName}" - Matching task:`, matchingTask || "None");
                
                if (matchingTask) {
                  // Custom distribution that handles committed + remaining
                  const currentMonthIndex = ganttMonths.findIndex(
                    month => month === currentMonth.toLocaleDateString("en-US", { month: "short", year: "numeric" })
                  );
                  
                  console.log(`[DEBUG] Row "${rowName}" - Current month index: ${currentMonthIndex}`);
                  
                  // Build a month distribution object that will be applied to the row
                  const monthDistribution = {};
                  
                  // First pass: Distribute the committed amount
                  // If we're in or past the task timeframe, put committed amount in current month
                  // Otherwise distribute according to the cashflow profile
                  if (currentMonthIndex >= 0) {
                    // Get distribution using the standard function (will be modified)
                    const distributedRow = recalcForecastForRow(
                      { ...newRows[index], current_forecast: totalFee.toString() },
                      ganttMonths,
                      ganttTasks || [],
                      matchingTask,
                      row.cashflow_profile === "S-Curve" ? sCurveProfile : undefined
                    );
                    
                    console.log(`[DEBUG] Row "${rowName}" - Distributed row:`, distributedRow);
                    
                    // Mark all distributed amounts as committed (for pink styling)
                    Object.keys(distributedRow).forEach(key => {
                      if (ganttMonths.includes(key) && distributedRow[key]) {
                        monthDistribution[key] = {
                          value: distributedRow[key],
                          isCommitted: true
                        };
                        console.log(`[DEBUG] Row "${rowName}" - Month ${key} marked as committed with value: ${distributedRow[key]}`);
                      }
                    });
                    
                    console.log(`[DEBUG] Row "${rowName}" - Month distribution (committed values):`, monthDistribution);
                    
                    // If there's a remaining budget and we have future months
                    if (remainingBudget > 0 && currentMonthIndex < ganttMonths.length - 1) {
                      // Put remaining budget in the next month
                      const nextMonth = ganttMonths[currentMonthIndex + 1];
                      if (nextMonth) {
                        monthDistribution[nextMonth] = {
                          value: remainingBudget,
                          isCommitted: false
                        };
                        console.log(`[DEBUG] Row "${rowName}" - Month ${nextMonth} for remaining budget: ${remainingBudget} (not committed)`);
                      }
                    }
                    
                    console.log(`[DEBUG] Row "${rowName}" - Final month distribution:`, monthDistribution);
                    
                    // Apply the custom distribution to the row
                    Object.keys(monthDistribution).forEach(month => {
                      const monthData = monthDistribution[month];
                      newRows[index][month] = monthData.value;
                      // Add marker for committed amounts to enable pink styling
                      if (monthData.isCommitted) {
                        newRows[index][`${month}_committed`] = true;
                        console.log(`[DEBUG] Row "${rowName}" - Marked ${month} as committed: ${monthData.value} - Property name: "${month}_committed"`);
                      }
                    });
                    
                    // Log the updated row's month values for verification
                    const monthValues = {};
                    ganttMonths.forEach(month => {
                      monthValues[month] = {
                        value: newRows[index][month],
                        isCommitted: newRows[index][`${month}_committed`] === true
                      };
                    });
                    console.log(`[DEBUG] Row "${rowName}" - Final month values with commit status:`, monthValues);
                  } else {
                    // Fallback to standard distribution if we can't determine current month
                    newRows[index] = recalcForecastForRow(
                      newRows[index],
                      ganttMonths,
                      ganttTasks || [],
                      matchingTask,
                      row.cashflow_profile === "S-Curve" ? sCurveProfile : undefined
                    );
                    console.log(`[DEBUG] Row "${rowName}" - Used standard distribution (no current month)`);
                  }
                } else {
                  // Fallback to standard distribution if no matching task
                  newRows[index] = recalcForecastForRow(
                    newRows[index],
                    ganttMonths,
                    ganttTasks || [],
                    undefined,
                    row.cashflow_profile === "S-Curve" ? sCurveProfile : undefined
                  );
                  console.log(`[DEBUG] Row "${rowName}" - Used standard distribution (no matching task)`);
                }
              }
            } else {
              console.log(`[DEBUG] Row "${rowName}" - Skipped due to manual overrides`);
            }
            
            // Mark this row as linked to management costs by adding a property
            newRows[index].linkedToFeeProposal = true;
            console.log(`[DEBUG] Row "${rowName}" - Marked as linkedToFeeProposal: true`);
          }
        }
        // Keep the existing "Link to Fee Proposal" behavior as a fallback
        else if (row.Column6 === "Link to Fee Proposal") {
          // For backwards compatibility, try matching by stage for rows explicitly marked
          const matchingCostsByStage = managementCosts.filter(cost => 
            cost.stage?.toLowerCase() === rowName.toLowerCase()
          );
          
          if (matchingCostsByStage.length > 0) {
            // Sum up fees from matched management costs
            const totalFee = matchingCostsByStage.reduce((sum, cost) => 
              sum + (parseFloat(cost.fee_excluding_gst) || 0), 0);
            
            // Update the row with the calculated fee
            if (totalFee > 0) {
              // Only update if there's no manual override
              if (!row.monthly_manual_overrides || 
                  Object.keys(row.monthly_manual_overrides).length === 0) {
                
                // Update the current forecast with the calculated fee
                newRows[index] = {
                  ...row,
                  current_forecast: totalFee.toString(),
                  Column4: totalFee.toString()
                };
                
                // Recalculate distribution if there are months defined
                if (ganttMonths?.length > 0) {
                  newRows[index] = recalcForecastForRow(
                    newRows[index],
                    ganttMonths,
                    ganttTasks || [],
                    undefined,
                    row.cashflow_profile === "S-Curve" ? sCurveProfile : undefined
                  );
                }
              }
              
              // Mark this row as linked to a fee proposal by adding a property
              newRows[index].linkedToFeeProposal = true;
            }
          }
        }
      });
      
      // Recalculate formulas and totals
      const updatedRows = recalcFormulas(newRows, ganttTasks || []);
      const rowsWithMetrics = recalcAllFinancialMetrics(updatedRows);
      const rowsWithTotals = recalcTotals(rowsWithMetrics, ganttMonths || []);
      return recalcGST(rowsWithTotals);
    });
  };

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
        cellStyle: (params: any) => {
          // Add pink text for rows linked to committed costs only
          if (params.data?.linkedToCommittedCosts) {
            return { color: "#ff69b4" }; // Pink color
          }
          return {};
        }
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
        cellStyle: (params: any) => {
          const baseStyle = { textAlign: "right" };
          // Add pink text for rows linked to committed costs only
          if (params.data?.linkedToCommittedCosts) {
            baseStyle.color = "#ff69b4"; // Pink color
          }
          return baseStyle;
        },
        valueFormatter: (params: any) => {
          const value = parseFloat(params.value);
          if (!value) return "";
          return `$${formatWithCommas(value)}`;
        },
      },
      // ... existing code for remaining base columns ...

      // Modify the second column (Budget column) to add fee proposal styling
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
        cellStyle: (params: any) => {
          const baseStyle = { textAlign: "right" };
          // Add pink text for rows linked to committed costs only
          if (params.data?.linkedToCommittedCosts) {
            baseStyle.color = "#ff69b4"; // Pink color
          }
          return baseStyle;
        },
        valueFormatter: (params: any) => {
          const value = parseFloat(params.value);
          if (!value) return "";
          return `$${formatWithCommas(value)}`;
        },
      },
      
      // Modify the Variation to Original column for fee proposal styling
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
        cellStyle: (params: any) => {
          const baseStyle = { textAlign: "right" };
          // Add pink text for rows linked to committed costs only
          if (params.data?.linkedToCommittedCosts) {
            baseStyle.color = "#ff69b4"; // Pink color
          }
          return baseStyle;
        },
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
      
      // Modify the Committed Costs column for fee proposal styling
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
        cellStyle: (params: any) => {
          const baseStyle = { textAlign: "right" };
          // Never apply pink text to this column, as it's from management costs not committed costs
          return baseStyle;
        },
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
              
              // Debug cell styling for all rows (not just Architectural Services)
              if (params.data && !params.data.isHeading && !params.data.isTotal) {
                const isCommitted = params.data?.[`${params.colDef.field}_committed`] === true;
                const hasValue = !!params.data?.[params.colDef.field];
                
                if (hasValue) {
                  console.log(`[DEBUG-CELL] Row: "${params.data.Column1}", Month: ${params.colDef.field}`, {
                    value: params.value,
                    linkedToCommittedCosts: params.data?.linkedToCommittedCosts,
                    isCommitted: isCommitted,
                    commitProperty: `${params.colDef.field}_committed`,
                    commitValue: params.data?.[`${params.colDef.field}_committed`]
                  });
                }
              }
              
              // Add pink color for committed costs in this specific month - ONLY from committed_costs_view
              if (params.data?.linkedToCommittedCosts && params.data?.[`${params.colDef.field}_committed`]) {
                baseStyle.color = "#ff69b4"; // Pink color
                
                // Debug when pink styling is applied for all rows
                if (!params.data.isHeading && !params.data.isTotal) {
                  console.log(`[DEBUG-PINK] Applied pink styling to "${params.data.Column1}" for ${params.colDef.field}:`, {
                    value: params.value,
                    commitProperty: `${params.colDef.field}_committed`,
                    commitValue: params.data[`${params.colDef.field}_committed`]
                  });
                }
              } else if (params.data && params.data[`${params.colDef.field}_actual`]) {
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
            // ... rest of the month column definition ...
          };
        })
      : [];

    return [...baseCols, ...monthCols];
  }, [gstMode, ganttDropdownValues, ganttMonths, cashflowMode, budgetMode, currentMonth]);

  // ... existing code ...
}

// ... existing code ... 