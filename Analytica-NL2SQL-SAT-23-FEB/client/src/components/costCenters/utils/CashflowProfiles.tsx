// client/src/components/costCenters/utils/CashflowProfiles.tsx
import Decimal from "decimal.js";

export interface CashflowProfile {
  name: string;
  // Returns an array of normalized weights that sum to 1.
  distribution: (n: number) => number[];
}

// S‑Curve profile using a logistic function with tapering at the top
export const sCurveProfile: CashflowProfile = {
  name: "S‑Curve",
  distribution: (n: number) => {
    const values: number[] = [];
    // Start tapering after 80% of the periods; taper to 50% at period n.
    const taperStart = Math.floor(0.8 * n);
    const taperEndFactor = 0.5;
    for (let i = 1; i <= n; i++) {
      // Center the logistic curve at n/2; control spread via n/10.
      const x = (i - n / 2) / (n / 10);
      const logisticValue = 1 / (1 + Math.exp(-x));
      let taper = 1;
      if (i > taperStart) {
        taper = 1 - ((i - taperStart) / (n - taperStart)) * (1 - taperEndFactor);
      }
      const value = logisticValue * taper;
      values.push(value);
    }
    const sum = values.reduce((acc, cur) => acc + cur, 0);
    return values.map((v) => v / sum);
  },
};

// Linear profile for even distribution
export const linearProfile: CashflowProfile = {
  name: "Linear",
  distribution: (n: number) => Array(n).fill(1 / n),
};

export const profiles: CashflowProfile[] = [linearProfile, sCurveProfile];

// Given a total (as a Decimal), number of periods (months), and a profile,
// returns an array of Decimal allocations.
export function applyCashflowProfile(total: Decimal, months: number, profile: CashflowProfile): Decimal[] {
  const distribution = profile.distribution(months);
  return distribution.map((ratio) => total.mul(ratio));
}
