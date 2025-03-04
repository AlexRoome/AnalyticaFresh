// client/src/components/costCenters/utils/cashflowFormulas.ts
import Decimal from "decimal.js";

/**
 * Calculates the automated cashflow based on the current forecast and manual input.
 * If manual cashflow exceeds currentForecast, automated cashflow becomes 0.
 *
 * @param currentForecast - Sum of all monthly values.
 * @param manualCashflow - Sum of monthly values flagged as manual.
 * @returns The automated cashflow.
 */
export function calculateAutomatedCashflow(
  currentForecast: number,
  manualCashflow: number
): number {
  return manualCashflow > currentForecast ? 0 : currentForecast - manualCashflow;
}

/**
 * Updates the overall forecast.
 * Normally, newForecast = manualCashflow + automatedCashflow.
 * But if manualCashflow exceeds currentForecast, the forecast is bumped to manualCashflow.
 *
 * @param currentForecast - The current overall forecast.
 * @param manualCashflow - The sum of manual entries.
 * @returns An object containing the updated forecast and automated cashflow.
 */
export function updateForecast(
  currentForecast: number,
  manualCashflow: number
): { newForecast: number; automatedCashflow: number } {
  const automatedCashflow = calculateAutomatedCashflow(currentForecast, manualCashflow);
  let newForecast = manualCashflow + automatedCashflow;
  if (manualCashflow > currentForecast) {
    newForecast = manualCashflow;
  }
  return { newForecast, automatedCashflow };
}

/**
 * Recalculates financial metrics using the new cashflow logic.
 *
 * New logic:
 *  - current_forecast is the sum of all monthly values (both automatic, manual, and actual).
 *  - manual_cashflow is the sum of monthly values flagged as manual or actual.
 *  - automated_cashflow = current_forecast - manual_cashflow (or 0 if manual > current).
 *  - variation_to_original = updated forecast minus the original amount.
 *
 * This function now reads the monthly values directly from the row,
 * using the union of keys from row.monthly_costs and row.monthly_manual_overrides.
 *
 * It now attempts to read each month's value from row[m]; if that's missing,
 * it falls back to row.monthly_costs[m] so that manual values stored in the JSON are not lost on page load.
 *
 * @param row - The entire row data, which should include:
 *              - monthly_costs (if any),
 *              - monthly_manual_overrides,
 *              - and the monthly fields (e.g. "Feb 2025") containing the actual values.
 * @returns An object with:
 *   - automated_cashflow,
 *   - current_forecast, and
 *   - variation_to_original.
 */
export function recalcFinancialMetrics(row: any): { automated_cashflow: string; current_forecast: string; variation_to_original: string } {
  const originalAmount = row.Column3 || "0";
  const monthly_manual_overrides = row.monthly_manual_overrides || {};
  
  // Build a union of keys from row.monthly_costs and row.monthly_manual_overrides.
  const autoKeys = row.monthly_costs ? Object.keys(row.monthly_costs) : [];
  const manualKeys = Object.keys(monthly_manual_overrides);
  
  // Create a set of all month keys to process
  const monthKeysSet = new Set([...autoKeys, ...manualKeys]);
  
  // Also check for actual cost months (marked with _actual suffix)
  const actualMonths: string[] = [];
  Object.keys(row).forEach(key => {
    if (key.endsWith('_actual')) {
      const monthKey = key.replace('_actual', '');
      monthKeysSet.add(monthKey);
      actualMonths.push(monthKey);
    }
  });

  let sumAll = new Decimal(0);
  let sumManual = new Decimal(0);
  
  // Process all months in the set
  monthKeysSet.forEach((m) => {
    // First try to get the monthly value from the row.
    // If not present, fall back to row.monthly_costs[m].
    const valStr = row[m] !== undefined ? row[m] : (row.monthly_costs && row.monthly_costs[m]) || "0";
    const val = new Decimal(valStr || "0");
    
    // Add to total sum
    sumAll = sumAll.plus(val);
    
    // Count as manual if it's a manual override or an actual cost
    if (monthly_manual_overrides[m] || actualMonths.includes(m) || row[`${m}_actual`]) {
      sumManual = sumManual.plus(val);
    }
  });
  
  const currentForecast = sumAll;
  const automatedCashflow = sumManual.gt(currentForecast) ? new Decimal(0) : currentForecast.minus(sumManual);
  const newForecast = sumManual.gt(currentForecast) ? sumManual : currentForecast;
  const variationToOriginal = new Decimal(newForecast).minus(new Decimal(originalAmount));

  return {
    automated_cashflow: automatedCashflow.toString(),
    current_forecast: newForecast.toString(),
    variation_to_original: variationToOriginal.toString(),
  };
}
