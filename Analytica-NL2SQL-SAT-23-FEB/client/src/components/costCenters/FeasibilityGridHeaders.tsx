// FeasibilityGridHeaders.tsx
import React, { useState } from "react";
import { RiArrowDropDownLine } from "react-icons/ri";
import styles from "./myTables.module.css";

export function headingCellRenderer(params: any) {
  if (params.data.isHeading) {
    return <div style={{ fontWeight: "normal", cursor: "pointer" }}>{params.value}</div>;
  }
  return params.value;
}

export function VariationHeader(props: any) {
  const { options } = props;
  const [selected, setSelected] = useState("Variation to Original");
  const onChange = (e: any) => setSelected(e.target.value);

  return (
    <div
      className="ag-header-cell-label"
      style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <select
        value={selected}
        onChange={onChange}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          font: "inherit",
          color: "inherit",
          padding: 0,
          margin: 0,
          cursor: "pointer",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          textAlign: "center",
          paddingRight: "1.5rem",
        }}
        onFocus={(e) => {
          e.target.style.outline = "none";
        }}
      >
        {options.map((option: string) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <RiArrowDropDownLine
        style={{
          position: "absolute",
          right: "0.75rem",
          pointerEvents: "none",
          fontSize: "1rem",
        }}
      />
    </div>
  );
}

export function FinancialMetricHeader(props: any) {
  const { options } = props;
  const [selected, setSelected] = useState("Expended to Date");
  const onChange = (e: any) => setSelected(e.target.value);

  return (
    <div
      className="ag-header-cell-label"
      style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <select
        value={selected}
        onChange={onChange}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          font: "inherit",
          color: "inherit",
          padding: 0,
          margin: 0,
          cursor: "pointer",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          textAlign: "center",
          paddingRight: "1.5rem",
        }}
        onFocus={(e) => {
          e.target.style.outline = "none";
        }}
      >
        {options.map((option: string) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <RiArrowDropDownLine
        style={{
          position: "absolute",
          right: "0.75rem",
          pointerEvents: "none",
          fontSize: "1rem",
        }}
      />
    </div>
  );
}

export function BudgetHeader(props: any) {
  const { options, budgetMode, onBudgetModeChange } = props;
  const onChange = (e: any) => {
    onBudgetModeChange(e.target.value);
  };

  return (
    <div
      className="ag-header-cell-label"
      style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <select
        value={budgetMode}
        onChange={onChange}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          font: "inherit",
          color: "inherit",
          padding: 0,
          margin: 0,
          cursor: "pointer",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          textAlign: "center",
          paddingRight: "1.5rem",
        }}
        onFocus={(e) => {
          e.target.style.outline = "none";
        }}
      >
        {options.map((option: string) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <RiArrowDropDownLine
        style={{
          position: "absolute",
          right: "0.75rem",
          pointerEvents: "none",
          fontSize: "1rem",
        }}
      />
    </div>
  );
}
