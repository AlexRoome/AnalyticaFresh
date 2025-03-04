// src/components/costCenters/utils/formulaParser.ts

import * as EFP from "excel-formula-parser";

// Optional: log the entire module to see how Parser is exported
// (Remove once you confirm it works)
// console.log("EFP entire module:", EFP);

// Create one parser instance
const parser = new EFP.Parser();

/**
 * Evaluate a formula string using excel-formula-parser.
 *
 * @param formula      e.g. "=A1 + 5" or "=1+2"
 * @param getCellValue A function that, given "A1", returns the cell’s value
 * @returns            The computed numeric/string result, or "ERROR" if there's a parse/eval error
 */
export function evaluateFormula(
  formula: string,
  getCellValue: (cellRef: string) => any
): number | string {
  // 1) Remove '=' if present
  const expression = formula.startsWith("=") ? formula.slice(1) : formula;

  // 2) Parse into an AST
  const parseResult = parser.parse(expression);
  if (parseResult.error) {
    return "ERROR"; // parse error
  }

  // 3) Evaluate the AST, telling the parser how to get cell references
  const evaluation = parser.evaluate(parseResult.ast, {
    onCell: (ref: any) => {
      // e.g. ref.label = "A1" or "B2"
      const rawValue = getCellValue(ref.label);
      // Return numeric if possible
      return parseFloat(rawValue) || 0;
    },
  });

  if (evaluation.error) {
    return "ERROR"; // evaluation error
  }

  return evaluation.result;
}
