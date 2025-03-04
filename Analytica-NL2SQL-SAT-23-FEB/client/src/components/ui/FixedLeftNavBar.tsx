import React, { useMemo, useState, useEffect, ChangeEvent } from "react";
import { supabase } from "../../supabaseClient";
import Decimal from "decimal.js";
import { useGstMode } from "../../context/GstModeContext";
import { useCashflowMode } from "../../context/CashflowModeContext";
import { formatWithCommas } from "../costCenters/utils/formatNumbers";
import { useSidebarContext } from "../../context/SidebarContext";

export interface ReferenceValues {
  [key: string]: string;
}

export interface Settings {
  id?: string;
  feasibilityId?: string;
  headingIndex?: number;
  name: string;
  calculationType: string;
  amount: string;
  programme: string;
  taxation: boolean;
  useSCurve?: boolean;
  previous_forecast?: string;
  current_forecast?: string;
}

interface ProgrammeDates {
  id?: number;
  start_date?: string;
  end_date?: string;
}

export interface LeftNavBarProps {
  isVisible: boolean;
  settings: Settings;
  onSettingsChange: (newSettings: Settings) => void;
  ganttOptions: string[];
  referenceValues: ReferenceValues;
  onProgrammeDateChange?: () => void;
  // NEW: Callbacks for roll forward/backward actions.
  onRollBackward?: () => void;
  onRollForward?: () => void;
}

const topHeadingStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "bold",
  color: "var(--gray-600)",
  marginBottom: "1rem",
  textAlign: "left",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "normal",
  color: "var(--gray-600)",
  marginBottom: "0.5rem",
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.25rem 1rem 0.25rem 0.5rem",
  height: "30px",
  border: "1px solid #ccc",
  borderRadius: "8px",
  color: "var(--gray-600)",
  marginBottom: "1rem",
  boxSizing: "border-box",
  lineHeight: "30px",
  fontSize: "13px",
  fontFamily: "Arial, sans-serif",
};

function computeTotalExclGST(settings: Settings, refs: ReferenceValues = {}): string {
  const amount = new Decimal(settings.amount || "0");
  switch (settings.calculationType) {
    case "Lump Sum":
      return amount.toString();
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
      return amount.toString();
  }
}

export default function LeftNavBar({
  isVisible,
  settings,
  onSettingsChange,
  ganttOptions,
  referenceValues,
  onProgrammeDateChange,
  onRollBackward,
  onRollForward,
}: LeftNavBarProps) {
  console.log("LeftNavBar component received isVisible:", isVisible);
  const [showContainer, setShowContainer] = useState(isVisible);
  useEffect(() => {
    console.log("LeftNavBar useEffect - isVisible changed to:", isVisible);
    if (isVisible) {
      setShowContainer(true);
    } else {
      const timer = setTimeout(() => setShowContainer(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);
  console.log("LeftNavBar showContainer state:", showContainer);
  const containerWidth = showContainer ? "312px" : "0px";

  const { gstMode, setGstMode } = useGstMode();
  const { cashflowMode, setCashflowMode } = useCashflowMode();
  const { isDarkMode } = useSidebarContext();

  const [programmeDates, setProgrammeDates] = useState<ProgrammeDates>({});
  const [adjustMode, setAdjustMode] = useState("Adjust Cashflow");
  const [forecastMode, setForecastMode] = useState("Current Forecast");
  const [checkboxHovering, setCheckboxHovering] = useState(false);

  const toggleForecastMode = () => {
    setForecastMode(prev => (prev === "Current Forecast" ? "Previous Forecast" : "Current Forecast"));
  };

  const toggleAdjustMode = async () => {
    const newMode = adjustMode === "Adjust Cashflow" ? "Adjust Forecast Budget" : "Adjust Cashflow";
    setAdjustMode(newMode);
    if (settings.id) {
      const { error } = await supabase
        .from("feasibility_line_items")
        .update({ adjust_mode: newMode })
        .eq("id", settings.id);
      if (error) {
        console.error("Error updating adjust_mode:", error);
      }
    }
  };

  useEffect(() => {
    async function fetchProgrammeDates() {
      if (settings.programme && settings.programme !== "(None)") {
        try {
          const { data, error } = await supabase
            .from("gantt")
            .select("id, start_date, end_date")
            .eq("task_name", settings.programme)
            .maybeSingle();
          if (error) {
            console.error("Error fetching programme dates:", error);
            setProgrammeDates({});
          } else if (data) {
            setProgrammeDates({
              id: data.id,
              start_date: data.start_date || "",
              end_date: data.end_date || "",
            });
          } else {
            setProgrammeDates({});
          }
        } catch (err) {
          console.error("Error in fetchProgrammeDates:", err);
          setProgrammeDates({});
        }
      } else {
        setProgrammeDates({});
      }
    }
    fetchProgrammeDates();
  }, [settings.programme]);

  useEffect(() => {
    if (!programmeDates.id) return;
    const timer = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("gantt")
          .update({
            start_date: programmeDates.start_date || null,
            end_date: programmeDates.end_date || null,
          })
          .eq("id", programmeDates.id);
        if (error) {
          console.error("Error updating gantt row:", error);
          return;
        }
        if (window.gantt) {
          const ganttTask = window.gantt.getTask(programmeDates.id);
          if (ganttTask) {
            ganttTask.start_date = new Date(programmeDates.start_date || "");
            ganttTask.end_date = new Date(programmeDates.end_date || "");
            ganttTask.duration = window.gantt.calculateDuration(
              ganttTask.start_date,
              ganttTask.end_date
            );
            window.gantt.updateTask(programmeDates.id);
          }
        }
        if (onProgrammeDateChange) {
          onProgrammeDateChange();
        }
      } catch (err) {
        console.error("Error updating programme dates:", err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [programmeDates, onProgrammeDateChange]);

  const handleDateChange = (field: "start_date" | "end_date", e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setProgrammeDates((prev) => ({ ...prev, [field]: value }));
  };

  const toggleGstMode = () => {
    setGstMode(gstMode === "incl" ? "excl" : "incl");
  };
  const toggleCashflowMode = () => {
    setCashflowMode(!cashflowMode);
  };
  const toggleSCurve = () => {
    onSettingsChange({ ...settings, useSCurve: !settings.useSCurve });
  };

  const handleSetPrevForecast = async () => {
    const newPrevForecast = settings.current_forecast || "0";
    const updatedSettings = { ...settings, previous_forecast: newPrevForecast };
    onSettingsChange(updatedSettings);
    if (settings.id) {
      const { error } = await supabase
        .from("feasibility_line_items")
        .update({ previous_forecast: newPrevForecast })
        .eq("id", settings.id);
      if (error) {
        console.error("Error updating previous forecast:", error);
      } else {
        console.log("Previous forecast updated successfully.");
      }
    }
  };

  const totalExclGST = useMemo(() => computeTotalExclGST(settings, referenceValues), [settings, referenceValues]);
  const computedExcl = new Decimal(totalExclGST || "0");
  const totalInclGST = settings.taxation ? computedExcl.mul(1.1).toDecimalPlaces(2).toString() : computedExcl.toString();

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[\$,]/g, "");
    if (settings.calculationType.includes("Percentage")) {
      value = value.replace(/%/g, "");
    }
    onSettingsChange({ ...settings, amount: value });
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ ...settings, name: e.target.value });
  };

  const handleCalculationChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onSettingsChange({ ...settings, calculationType: e.target.value });
  };

  const handleProgrammeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onSettingsChange({ ...settings, programme: e.target.value });
  };

  const handleTaxToggle = () => {
    onSettingsChange({ ...settings, taxation: !settings.taxation });
  };

  // Force a simple test element to render regardless of isVisible
  return (
    <>
      {/* Always visible test element */}
      <div style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "200px",
        height: "200px",
        backgroundColor: "red",
        zIndex: 9999,
        display: isVisible ? "block" : "none",
        border: "5px solid black",
        color: "white",
        padding: "20px",
        textAlign: "center",
        fontWeight: "bold",
      }}>
        LEFT NAV BAR TEST ELEMENT
        <div>isVisible: {isVisible.toString()}</div>
      </div>
      
      {/* Original component rendering */}
      {isVisible && (
      <div
        style={{
          position: "fixed",
          top: "60px", // Adjust to account for header
          left: "60px", // Adjust to account for sidebar
          width: "270px",
          height: "calc(100vh - 60px)",
          backgroundColor: isDarkMode ? "rgb(31, 33, 35)" : "white",
          borderRight: "1px solid #ccc",
          zIndex: 1000,
          padding: "1rem",
          overflowY: "auto",
          transition: "left 0.3s ease-in-out",
          boxShadow: "2px 0 5px rgba(0, 0, 0, 0.1)",
          border: "3px solid red",
          opacity: 1,
        }}
      >
        <style>{`
          input.leftNavInput:focus,
          select.leftNavInput:focus {
            border-color: var(--green) !important;
            box-shadow: inset 0 0 0 1px var(--green) !important;
            transition: box-shadow 0.4s ease;
            outline: none !important;
          }
          
          /* Unified text colors based on mode */
          ${isDarkMode ? 
            `.leftNavBar-content, .leftNavBar-content label, .leftNavBar-content span, .leftNavBar-content div {
              color: var(--gray-300) !important;
            }
            .leftNavBar-content input, .leftNavBar-content select {
              color: var(--gray-300) !important;
              background-color: var(--gray-300) !important;
            }` 
            : 
            `.leftNavBar-content, .leftNavBar-content label, .leftNavBar-content span, .leftNavBar-content div {
              color: var(--gray-600) !important;
            }`
          }
        `}</style>
        <div className="leftNavBar-content" style={{ padding: "1rem 1rem 1rem 0" }}>
          <div style={{ ...topHeadingStyle, color: isDarkMode ? "var(--gray-300)" : "var(--gray-600)" }}>Settings</div>
          <div>
            <label style={{ ...fieldLabelStyle, color: isDarkMode ? "var(--gray-300)" : "var(--gray-600)" }}>Name</label>
            <input
              type="text"
              value={settings.name}
              onChange={handleNameChange}
              style={{
                ...inputStyle,
                color: isDarkMode ? "var(--gray-300)" : "var(--gray-600)",
                backgroundColor: isDarkMode ? "var(--gray-300)" : inputStyle.backgroundColor
              }}
              className="leftNavInput"
            />
          </div>
          {/* Rest of the component JSX */}
        </div>
        <div
          className="leftNavBar-content"
          style={{
            position: "absolute",
            bottom: "0.5rem",
            left: 0,
            width: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0 1rem 0 0",
          }}
        >
          <button
            onClick={handleSetPrevForecast}
            style={{
              flex: 1,
              height: "2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "var(--white)",
              border: "1px solid #ccc",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "9px",
              color: isDarkMode ? "var(--gray-300)" : "var(--gray-600)",
            }}
          >
            Set Prev Forecast
          </button>
          <button
            onClick={onRollBackward}
            style={{
              flex: 1,
              height: "2rem",
              fontSize: "9px",
              color: isDarkMode ? "var(--gray-300)" : "var(--gray-600)",
              backgroundColor: "var(--white)",
              border: "1px solid #ccc",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Roll Backward
          </button>
          <button
            onClick={onRollForward}
            style={{
              flex: 1,
              height: "2rem",
              fontSize: "9px",
              color: isDarkMode ? "var(--gray-300)" : "var(--gray-600)",
              backgroundColor: "var(--white)",
              border: "1px solid #ccc",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Roll Forward
          </button>
        </div>
      </div>
      )}
    </>
  );
} 