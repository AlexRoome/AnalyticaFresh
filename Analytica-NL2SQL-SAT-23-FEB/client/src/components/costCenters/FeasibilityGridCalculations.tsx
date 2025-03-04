// client/src/components/costCenters/FeasibilityGridCalculations.ts
import Decimal from "decimal.js";
import { v5 as uuidv5 } from "uuid";
import { CashflowProfile, applyCashflowProfile } from "./utils/CashflowProfiles";
import { recalcFinancialMetrics } from "./utils/cashflowFormulas";

// These arrays should be imported from their respective files
import { HEADINGS } from "./HeadingsData";
import { DISCIPLINES } from "./ProfessionalFees";
import { LAND_ACQUISITION } from "./LandAcquisitionCosts";
import { CONSTRUCTION_SUBHEADINGS } from "./ConstructionCosts";
import { CONTINGENCY_SUBHEADINGS } from "./Contingency";
import { STATUTORY_FEES } from "./StatutoryFees";
import { LAND_PURCHASE_SUBHEADINGS } from "./LandPurchaseCost";

const NAMESPACE = "0ba6c1d2-1f07-4a1d-88a8-123456789abc";

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
  cashflow_profile?: "S-curve" | "Linear";
  [key: string]: any;
}

export function createInitialRowData(): RowData[] {
  const rows: RowData[] = [];
  HEADINGS.forEach((heading, index) => {
    // Header row
    rows.push({
      id: uuidv5(`${index}-header`, NAMESPACE),
      feasibility_id: "",
      isHeading: true,
      isTotal: false,
      headingIndex: index,
      Column1: heading,
      defaultCostCategory: heading,
      costCentre: heading,
      Column2: "",
      Column3: "",
      Column4: "",
      Column5: "",
      Column6: "",
      Column7: "Yes",
    });

    let subItems: string[] = [];
    if (heading === "Professional Fees") {
      subItems = DISCIPLINES;
    } else if (heading === "Land Acquisition Costs") {
      subItems = LAND_ACQUISITION;
    } else if (heading === "Land Purchase Cost") {
      subItems = LAND_PURCHASE_SUBHEADINGS;
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

    // Sub-rows
    subItems.forEach((sub, subIndex) => {
      const newId = uuidv5(`${index}-sub-${subIndex}`, NAMESPACE);
      rows.push({
        id: newId,
        feasibility_id: "",
        isHeading: false,
        isTotal: false,
        headingIndex: index,
        Column1: sub,
        defaultCostCategory: sub,
        costCentre: sub,
        Column2: "",
        Column3: "",
        Column4: "",
        Column5: "",
        Column6: "",
        Column7: "Yes",
      });
    });

    // Total row for the heading
    rows.push({
      id: uuidv5(`${index}-total`, NAMESPACE),
      feasibility_id: "",
      isHeading: false,
      isTotal: true,
      headingIndex: index,
      Column1: "Total",
      defaultCostCategory: "Total",
      costCentre: heading,
      Column2: "",
      Column3: "",
      Column4: "",
      Column5: "",
      Column6: "",
      Column7: "Yes",
    });
  });
  return rows;
}

export function mapActualsToRow(
  row: RowData,
  monthly_costs: { [key: string]: any },
  monthsSet: Set<string>
): RowData {
  Object.keys(monthly_costs).forEach((k) => {
    const convertedKey = convertMonthlyCostsKey(k);
    if (!convertedKey) {
      return;
    }
    if (!monthsSet.has(convertedKey)) {
      monthsSet.add(convertedKey);
    }
    row[convertedKey] = monthly_costs[k];
    row[`${convertedKey}_actual`] = true;
  });
  return row;
}

export function recalcFormulas(data: RowData[], tasks: any[]): RowData[] {
  const allTasks = tasks;
  const pass1 = data.map((row) => {
    if (!row.isHeading && !row.isTotal) {
      const units = row.Column2;
      if (
        units !== "Percentage of Land Purchase Price" &&
        units !== "Percentage of Construction Cost" &&
        units !== "* Time"
      ) {
        if (row.Column4 && row.Column4 !== "0") {
          return row;
        }
        const typedVal = new Decimal(row.Column3 || "0");
        return { ...row, Column4: typedVal.toString() };
      }
    }
    return row;
  });

  const singleConstructionRow = pass1.find(
    (r) => r.Column1 === "Construction Cost" && !r.isTotal
  );
  const singleConstVal = new Decimal(singleConstructionRow?.Column4 || "0");

  const singleLandRow = pass1.find(
    (r) => r.Column1 === "Land Purchase Price" && !r.isTotal
  );
  const singleLandVal = new Decimal(singleLandRow?.Column4 || "0");

  const pass2 = pass1.map((row) => {
    if (!row.isHeading && !row.isTotal) {
      const typedVal = new Decimal(row.Column3 || "0");
      const units = row.Column2;
      if (units === "Percentage of Land Purchase Price") {
        const calcVal = singleLandVal.mul(typedVal).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
        return { ...row, Column4: calcVal.toString() };
      } else if (units === "Percentage of Construction Cost") {
        const calcVal = singleConstVal.mul(typedVal).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
        return { ...row, Column4: calcVal.toString() };
      } else if (units === "* Time") {
        let months = 0;
        if (Array.isArray(allTasks) && allTasks.length > 0) {
          const matchedTask = allTasks.find((t: any) => t.text === row.Column6);
          if (matchedTask) {
            const msPerDay = 24 * 60 * 60 * 1000;
            const start = new Date(matchedTask.start_date);
            const end = new Date(matchedTask.end_date);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
              const diffInDays = (end.getTime() - start.getTime()) / msPerDay;
              months = Math.ceil(diffInDays / 30);
            }
          }
        }
        const calcVal = typedVal.mul(months);
        return { ...row, months: months.toString(), Column4: calcVal.toString() };
      }
    }
    return row;
  });

  return pass2;
}

export function recalcAllFinancialMetrics(data: RowData[]): RowData[] {
  return data.map((row) => {
    if (!row.isHeading && !row.isTotal) {
      const financials = recalcFinancialMetrics(row);
      return { ...row, ...financials };
    }
    return row;
  });
}

export function recalcTotals(data: RowData[], ganttMonths: string[] = []): RowData[] {
  const grouped = data.reduce((acc: any, row, idx) => {
    const hIndex = row.headingIndex;
    if (hIndex == null) return acc;
    if (!acc[hIndex]) {
      acc[hIndex] = { subRows: [] as number[], totalRowIndex: -1 };
    }
    if (row.isHeading) {
      // skip header
    } else if (row.isTotal) {
      acc[hIndex].totalRowIndex = idx;
    } else {
      acc[hIndex].subRows.push(idx);
    }
    return acc;
  }, {});

  Object.values(grouped).forEach((group: any) => {
    const { subRows, totalRowIndex } = group;
    if (totalRowIndex === -1) return;

    let sumCol4 = new Decimal(0);
    let sumCol5 = new Decimal(0);
    const monthlySums: { [month: string]: Decimal } = {};
    ganttMonths.forEach((m) => {
      monthlySums[m] = new Decimal(0);
    });

    subRows.forEach((rowIdx: number) => {
      const subRow = data[rowIdx];
      const col4 = new Decimal(isNaN(parseFloat(subRow.Column4)) ? "0" : subRow.Column4 || "0");
      const col5 = new Decimal(isNaN(parseFloat(subRow.Column5)) ? "0" : subRow.Column5 || "0");
      sumCol4 = sumCol4.plus(col4);
      sumCol5 = sumCol5.plus(col5);

      ganttMonths.forEach((m) => {
        const monthVal = new Decimal(isNaN(parseFloat(subRow[m])) ? "0" : subRow[m] || "0");
        monthlySums[m] = monthlySums[m].plus(monthVal);
      });
    });

    data[totalRowIndex].Column4 = sumCol4.eq(0) ? "" : sumCol4.toString();
    data[totalRowIndex].Column5 = sumCol5.eq(0) ? "" : sumCol5.toString();

    ganttMonths.forEach((m) => {
      data[totalRowIndex][m] = monthlySums[m].eq(0) ? "" : monthlySums[m].toString();
    });
  });

  return [...data];
}

export function recalcGST(data: RowData[]): RowData[] {
  return data.map((row) => {
    if (!row.isHeading && !row.isTotal) {
      const exclVal = new Decimal(row.Column4 || "0");
      const taxationApplicable = row.Column7 === "Yes";
      const inclVal = taxationApplicable ? exclVal.mul(1.1) : exclVal;
      return { ...row, Column5: inclVal.toString() };
    }
    return row;
  });
}

export function recalcForecastForRow(
  row: RowData,
  ganttMonths: string[],
  ganttTasks: any[] = [],
  changedMonth?: string,
  profile?: CashflowProfile
): RowData {
  let programmeStartDate = null;
  let programmeEndDate = null;

  if (row.Column6 && ganttTasks && ganttTasks.length > 0) {
    const matchedTask = ganttTasks.find((t: any) => t.text === row.Column6);
    if (matchedTask) {
      programmeStartDate = new Date(matchedTask.start_date);
      programmeEndDate = new Date(matchedTask.end_date);
    }
  } else if (ganttTasks && ganttTasks.length > 0) {
    // No programme item selected; use overall project duration
    const startTimes = ganttTasks.map((t: any) => new Date(t.start_date).getTime());
    const endTimes = ganttTasks.map((t: any) => new Date(t.end_date).getTime());
    programmeStartDate = new Date(Math.min(...startTimes));
    programmeEndDate = new Date(Math.max(...endTimes));
  }

  let forecastMonths: string[] = [];
  if (programmeStartDate && programmeEndDate) {
    forecastMonths = ganttMonths.filter((m) => {
      const monthDate = new Date(m + " 01");
      return monthDate >= programmeStartDate && monthDate <= programmeEndDate;
    });
    // Ensure the current month is included if it falls within the project duration.
    const currentMonthLabel = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const currentMonthDate = new Date(currentMonthLabel + " 01");
    if (
      currentMonthDate >= programmeStartDate &&
      currentMonthDate <= programmeEndDate &&
      !forecastMonths.includes(currentMonthLabel)
    ) {
      forecastMonths.push(currentMonthLabel);
      forecastMonths.sort((a, b) => new Date(a + " 01").getTime() - new Date(b + " 01").getTime());
    }
  } else {
    forecastMonths = [...ganttMonths];
  }

  // FIX: Include any manual override months not already in the forecastMonths
  if (row.monthly_manual_overrides) {
    Object.keys(row.monthly_manual_overrides).forEach((m) => {
      if (!forecastMonths.includes(m)) {
        forecastMonths.push(m);
      }
    });
  }
  
  // Include any months with actual costs
  Object.keys(row).forEach((key) => {
    if (key.endsWith('_actual')) {
      const monthKey = key.replace('_actual', '');
      if (!forecastMonths.includes(monthKey)) {
        forecastMonths.push(monthKey);
      }
    }
  });
  
  // Sort all months chronologically
  forecastMonths.sort((a, b) => new Date(a + " 01").getTime() - new Date(b + " 01").getTime());

  const N = forecastMonths.length;
  if (N === 0) return row;

  // Calculate sum of manual entries and actual costs
  let sumManual = new Decimal(0);
  let manualAndActualMonths: string[] = [];
  
  forecastMonths.forEach((m) => {
    if (row.monthly_manual_overrides?.[m] || row[`${m}_actual`]) {
      // Use the value from the row directly, or fall back to monthly_costs
      const value = row[m] !== undefined ? row[m] : (row.monthly_costs && row.monthly_costs[m]) || "0";
      sumManual = sumManual.plus(new Decimal(value || "0"));
      manualAndActualMonths.push(m);
    }
  });
  
  const totalBudget = new Decimal(row.Column4 || "0");
  
  // If manual + actual costs exceed the budget, don't adjust anything else
  if (sumManual.gte(totalBudget)) {
    // When manual amounts equal or exceed the original budget,
    // zero out non-manual months so that only manual entries contribute.
    forecastMonths.forEach((m) => {
      if (!row.monthly_manual_overrides?.[m] && !row[`${m}_actual`]) {
        row[m] = 0;
        if (!row.monthly_costs) row.monthly_costs = {};
        row.monthly_costs[m] = 0;
      }
    });
    return row;
  }
  
  // Calculate how many months are available for automated distribution
  const automatedMonths = forecastMonths.filter(m => 
    !row.monthly_manual_overrides?.[m] && !row[`${m}_actual`]
  );
  
  const countAutomated = automatedMonths.length;
  
  if (countAutomated > 0) {
    // Calculate the remaining budget to distribute among automated months
    const remainingBudget = totalBudget.minus(sumManual);
    
    if (profile) {
      // Use S-curve profile for automated distribution
      const allocations = applyCashflowProfile(remainingBudget, countAutomated, profile);
      let allocationIndex = 0;
      
      forecastMonths.forEach((m) => {
        // Skip manual and actual months
        if (row.monthly_manual_overrides?.[m] || row[`${m}_actual`]) {
          return; // Preserve these values
        }
        
        // Apply allocation to this automated month
        if (allocationIndex < allocations.length) {
          row[m] = allocations[allocationIndex].toNumber();
          if (!row.monthly_costs) row.monthly_costs = {};
          row.monthly_costs[m] = allocations[allocationIndex].toNumber();
          allocationIndex++;
        }
      });
    } else {
      // Use linear distribution for automated months
      const amountPerMonth = remainingBudget.dividedBy(countAutomated);
      
      forecastMonths.forEach((m) => {
        // Skip manual and actual months
        if (row.monthly_manual_overrides?.[m] || row[`${m}_actual`]) {
          return; // Preserve these values
        }
        
        // Apply even distribution to this automated month
        row[m] = amountPerMonth.toNumber();
        if (!row.monthly_costs) row.monthly_costs = {};
        row.monthly_costs[m] = amountPerMonth.toNumber();
      });
    }
  }

  // Zero out any months not in the forecast period
  for (let m of ganttMonths) {
    if (!forecastMonths.includes(m) && !row[`${m}_actual`] && !(row.monthly_manual_overrides && row.monthly_manual_overrides[m])) {
      row[m] = 0;
      if (!row.monthly_costs) row.monthly_costs = {};
      row.monthly_costs[m] = 0;
    }
  }
  
  return row;
}

export function debouncedUpsertRow(
  row: RowData,
  upsertTimeoutsRef: React.MutableRefObject<{ [key: string]: any }>,
  upsertRowFn: (row: RowData) => Promise<void>
) {
  if (!row || !row.id) return;
  if (!row.Column3 || row.Column3.trim() === "") {
    return;
  }
  if (upsertTimeoutsRef.current[row.id]) {
    clearTimeout(upsertTimeoutsRef.current[row.id]);
  }
  upsertTimeoutsRef.current[row.id] = setTimeout(() => {
    upsertRowFn(row);
    delete upsertTimeoutsRef.current[row.id];
  }, 500);
}

export function convertMonthlyCostsKey(key: string): string | null {
  const alreadyFormatted = /^([A-Z][a-z]{2} \d{4})(?:_actual)?$/.exec(key);
  if (alreadyFormatted) {
    return alreadyFormatted[1];
  }
  const parts = key.split("-");
  if (parts.length !== 2) {
    return null;
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const date = new Date(year, month);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function syncRowMonthsToGantt(row: RowData) {
  if (!row || row.Column2 !== "* Time") return;
  if (!row.Column6 || !(window as any).gantt) return;
  const m = parseFloat(row.months || "0") || 0;
  const days = Math.round(m * 30);
  if ((window as any).updateTaskMonthsByText) {
    (window as any).updateTaskMonthsByText(row.Column6, days);
  }
}
