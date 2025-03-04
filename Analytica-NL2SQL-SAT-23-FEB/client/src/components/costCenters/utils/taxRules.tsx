/**
 * taxRules.tsx
 *
 * Centralized module for calculating tax amounts across multiple countries,
 * following a similar structure to how EstateMaster DM might manage taxation.
 *
 * Example usage within your feasibility grid or project settings:
 * ------------------------------------------------------------------
 *   import { calculateTax } from "./taxRules";
 *
 *   const taxAmount = calculateTax({
 *     baseAmount: 100000,
 *     country: "AU",
 *     policy: "GST",
 *     options: {
 *       marginScheme: true,
 *       acquisitionCost: 80000,
 *     },
 *   });
 * ------------------------------------------------------------------
 */

import React from "react";

/** 
 * List of recognized countries for property development. 
 * You can expand this as needed. 
 */
export type CountryCode = "AU" | "NZ" | "US" | "UK" | "CA" | "OTHER";

/** 
 * Tax Policy keys for each country. 
 * In practice, you can break these out by country or keep one union type with all. 
 */
export type TaxPolicy =
  | "NONE"          // No tax
  | "GST"           // Generic GST (AU/NZ/Canada)
  | "GST_MARGIN"    // Margin scheme (AU property)
  | "VAT"           // UK/EU
  | "SALES_TAX"     // US
  | "OTHER";        // Fallback or additional

/**
 * Additional parameters that certain tax policies may need. 
 * For instance, the margin scheme in Australia depends on the acquisition cost.
 */
export interface TaxOptions {
  /** If the user chooses margin scheme in Australia, we need the acquisition cost to calculate the margin. */
  marginScheme?: boolean;
  acquisitionCost?: number;

  /** US states / Canadian provinces if needed (like "CA" for California, "BC" for British Columbia). */
  stateOrProvince?: string;

  /** 
   * For advanced use cases, you can store more toggles here:
   * - Exempt items
   * - Zero-rated goods
   * - Partial credits
   * etc.
   */
}

/**
 * The input object to our main `calculateTax` function.
 */
export interface CalculateTaxParams {
  /** Net or base cost/amount to which tax might apply. */
  baseAmount: number;

  /** The selected country from the project settings or feasibility config. */
  country: CountryCode;

  /** The tax policy the user selected (e.g., "GST", "VAT", "GST_MARGIN", etc.). */
  policy: TaxPolicy;

  /** Additional flags or data needed for certain calculations. */
  options?: TaxOptions;
}

/**
 * Example of tax rates for each country. 
 * In a real scenario, you might keep more detail or multiple rates (e.g., standard rate, reduced rate).
 */
const COUNTRY_TAX_RATES: Record<CountryCode, number> = {
  AU: 0.1,  // 10% GST
  NZ: 0.15, // 15% GST
  UK: 0.2,  // 20% VAT
  US: 0,    // We'll handle US differently (varies by state)
  CA: 0.05, // Canada federal GST, ignoring PST/HST for simplicity
  OTHER: 0,
};

/**
 * Example of US state-level sales tax rates (just a few as placeholders).
 * Real production code might be more granular or might combine state + local taxes.
 */
const US_STATE_SALES_TAX: Record<string, number> = {
  CA: 0.0725, // California base rate
  NY: 0.04,   // New York
  TX: 0.0625, // Texas
  FL: 0.06,
  // ...
};

/**
 * 1) A generic function to apply standard GST/VAT based on a single percentage.
 */
function applyStandardRate(baseAmount: number, rate: number): number {
  return baseAmount * rate;
}

/**
 * 2) Australia: Margin Scheme
 *    - GST is applied to the *margin* (difference between sale price and acquisition cost), 
 *      rather than the entire sale price.
 */
function applyMarginScheme(baseAmount: number, acquisitionCost?: number, gstRate = 0.1): number {
  // Margin is the difference
  const margin = (acquisitionCost != null) ? (baseAmount - acquisitionCost) : baseAmount;
  if (margin <= 0) return 0; // No GST if there's no positive margin
  return margin * gstRate;
}

/**
 * 3) US: Sales Tax by state
 *    - In property contexts, you might handle real estate transfer taxes, 
 *      but let's keep it simple by using a "sales tax" style approach for demonstration.
 */
function applyUSStateSalesTax(baseAmount: number, stateOrProvince?: string): number {
  if (!stateOrProvince) {
    // If no state is provided, we either assume 0 or handle a default/fallback.
    return 0;
  }
  const stateRate = US_STATE_SALES_TAX[stateOrProvince.toUpperCase()] || 0;
  return baseAmount * stateRate;
}

/**
 * Main exported function: calculates the **tax amount** (not the total with tax, just the tax portion).
 * 
 * - You can adapt it if you prefer returning total (base + tax). 
 * - This approach returns the raw tax so you can do:
 *   totalInclTax = baseAmount + calculatedTax
 */
export function calculateTax(params: CalculateTaxParams): number {
  const { baseAmount, country, policy, options } = params;
  if (policy === "NONE") {
    return 0; // No tax applied
  }

  switch (country) {
    case "AU":
      // Australia
      switch (policy) {
        case "GST_MARGIN":
          // Margin Scheme
          return applyMarginScheme(baseAmount, options?.acquisitionCost, COUNTRY_TAX_RATES["AU"]);
        case "GST":
          // Standard GST
          return applyStandardRate(baseAmount, COUNTRY_TAX_RATES["AU"]);
        default:
          // Possibly "NONE" or "OTHER"
          return 0;
      }

    case "NZ":
      // New Zealand has a standard 15% GST
      if (policy === "GST") {
        return applyStandardRate(baseAmount, COUNTRY_TAX_RATES["NZ"]);
      }
      return 0;

    case "UK":
      // UK typical 20% VAT
      if (policy === "VAT") {
        return applyStandardRate(baseAmount, COUNTRY_TAX_RATES["UK"]);
      }
      return 0;

    case "CA":
      // Canada has federal 5% GST, but also provinces with PST/HST (not shown).
      // For simplicity, we apply the base GST from the config:
      if (policy === "GST") {
        return applyStandardRate(baseAmount, COUNTRY_TAX_RATES["CA"]);
      }
      return 0;

    case "US":
      // US commonly uses "sales tax" or "transfer tax" by state
      if (policy === "SALES_TAX") {
        return applyUSStateSalesTax(baseAmount, options?.stateOrProvince);
      }
      return 0;

    default:
      // "OTHER" or unrecognized
      return 0;
  }
}

/**
 * Utility to compute the total (base + tax) if you want a single function that returns the entire total.
 * Some prefer having just `calculateTax` and doing `base + tax` outside. 
 */
export function calculateTotalWithTax(params: CalculateTaxParams): number {
  const tax = calculateTax(params);
  return params.baseAmount + tax;
}

/**
 * 
 * The component export is optional if you want to pass it around
 * or if you want to use any React-specific hooking. 
 * Typically, tax rules are pure logic, so they might not need
 * to be a React component at all (i.e. rename to taxRules.ts).
 *
 */
const TaxRulesContext = React.createContext({});

/**
 * You can export a provider if needed for context-based usage,
 * e.g., if you want to store user selections at a global level.
 */
export const TaxRulesProvider = ({ children }: { children: React.ReactNode }) => {
  // Potentially store global user tax settings here
  return (
    <TaxRulesContext.Provider value={{}}>
      {children}
    </TaxRulesContext.Provider>
  );
};

export default TaxRulesContext;
