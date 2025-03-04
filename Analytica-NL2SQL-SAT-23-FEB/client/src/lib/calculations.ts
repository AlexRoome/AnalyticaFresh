export interface CellValue {
  value: string | number;
  formula?: string;
}

export interface GridData {
  [key: string]: { [key: string]: CellValue };
}

// Helper functions for formula evaluation
function sum(values: number[]): number {
  return values.reduce((acc, val) => acc + val, 0);
}

function average(values: number[]): number {
  return values.length > 0 ? sum(values) / values.length : 0;
}

function min(values: number[]): number {
  return Math.min(...values);
}

function max(values: number[]): number {
  return Math.max(...values);
}

// Helper to extract cell references from a range (e.g., "A1:A5")
function getCellsInRange(range: string, data: GridData): number[] {
  const [start, end] = range.split(':');
  const startCol = start[0];
  const endCol = end[0];
  const startRow = parseInt(start.substring(1));
  const endRow = parseInt(end.substring(1));

  const values: number[] = [];

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol.charCodeAt(0); col <= endCol.charCodeAt(0); col++) {
      const cellRef = `${String.fromCharCode(col)}${row}`;
      const value = getCellValue(cellRef, data);
      if (typeof value === 'number') {
        values.push(value);
      }
    }
  }

  return values;
}

// Get cell value, handling both direct values and formula results
function getCellValue(cellRef: string, data: GridData): number {
  const col = cellRef[0];
  const row = parseInt(cellRef.substring(1)) - 1;
  const cell = data[row]?.[col];

  if (!cell) return 0;

  if (cell.formula) {
    return evaluateFormula(cell.formula, data);
  }

  return typeof cell.value === 'number' ? cell.value : parseFloat(cell.value) || 0;
}

export function evaluateFormula(formula: string, data: GridData): number {
  try {
    // Remove the = sign at the start
    const expression = formula.substring(1).toUpperCase();

    // Handle built-in functions
    if (expression.startsWith('SUM(')) {
      const range = expression.slice(4, -1);
      return sum(getCellsInRange(range, data));
    }

    if (expression.startsWith('AVERAGE(')) {
      const range = expression.slice(8, -1);
      return average(getCellsInRange(range, data));
    }

    if (expression.startsWith('MIN(')) {
      const range = expression.slice(4, -1);
      return min(getCellsInRange(range, data));
    }

    if (expression.startsWith('MAX(')) {
      const range = expression.slice(4, -1);
      return max(getCellsInRange(range, data));
    }

    // Replace cell references with values
    const evaluatable = expression.replace(/[A-Z]\d+/g, (match) => {
      const value = getCellValue(match, data);
      return value.toString();
    });

    // Safely evaluate the expression
    return Function(`"use strict";return (${evaluatable})`)();
  } catch (e) {
    console.error('Formula evaluation error:', e);
    return 0;
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function isFormula(value: string): boolean {
  return typeof value === 'string' && value.startsWith('=');
}