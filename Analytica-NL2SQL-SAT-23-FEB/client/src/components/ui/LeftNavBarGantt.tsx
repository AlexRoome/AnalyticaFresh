import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { IoTrashOutline } from "react-icons/io5";

/** Represents a Gantt task row, with optional fields. */
export interface GanttTask {
  id?: number;
  text: string;
  start_date?: string | Date;
  end_date?: string | Date;
  duration?: number;
  critical?: boolean;
}

interface LeftNavBarGanttProps {
  /** Whether the nav bar is visible or not */
  isVisible: boolean;
  /** The currently selected Gantt task */
  selectedTask: GanttTask | null;
  /** Called whenever a field is changed so parent can update */
  onTaskChange: (updated: GanttTask) => void;
  /** Called when "New Main Task" button is clicked */
  onAddMainTask: () => void;
  /** Called when "New Sub Task" button is clicked;
      it should add a subtask to the selected task (by its id) */
  onAddSubTask: (parentId: number) => void;
}

/**
 * A left-hand side nav bar for editing the selected Gantt task.
 */
export default function LeftNavBarGantt({
  isVisible,
  selectedTask,
  onTaskChange,
  onAddMainTask,
  onAddSubTask,
}: LeftNavBarGanttProps) {
  const [showContainer, setShowContainer] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setShowContainer(true);
    } else {
      const timer = setTimeout(() => setShowContainer(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  const containerWidth = showContainer ? "330px" : "0px";

  /**
   * Convert a stored date (string or Date) to "YYYY-MM-DD".
   */
  function formatDateForInput(dateValue: string | Date | undefined): string {
    if (!dateValue) return "";
    if (typeof dateValue === "string") {
      return dateValue.slice(0, 10);
    }
    if (dateValue instanceof Date) {
      return dateValue.toISOString().slice(0, 10);
    }
    return "";
  }

  const handleFieldChange = (
    field: keyof GanttTask,
    value: string | number | boolean
  ) => {
    if (!selectedTask) return;
    onTaskChange({ ...selectedTask, [field]: value });
  };

  // On blur, upsert the Task Name
  const handleTaskNameBlur = async () => {
    if (!selectedTask?.id) return;
    try {
      const { error } = await supabase
        .from("gantt")
        .upsert({
          id: selectedTask.id,
          task_name: selectedTask.text,
        });
      if (error) {
        console.error("Error updating task name:", error);
      } else if (window.gantt) {
        const task = window.gantt.getTask(selectedTask.id);
        if (task) {
          task.text = selectedTask.text;
          window.gantt.updateTask(selectedTask.id);
        }
      }
    } catch (err) {
      console.error("Error updating task name on blur:", err);
    }
  };

  // On blur, upsert the Start Date
  const handleStartDateBlur = async () => {
    if (!selectedTask?.id) return;
    try {
      const startStr = formatDateForInput(selectedTask.start_date);
      const { error } = await supabase
        .from("gantt")
        .upsert({
          id: selectedTask.id,
          start_date: startStr,
        });
      if (error) {
        console.error("Error updating start date:", error);
      } else if (window.gantt) {
        const task = window.gantt.getTask(selectedTask.id);
        if (task) {
          task.start_date = new Date(startStr);
          window.gantt.updateTask(selectedTask.id);
        }
      }
    } catch (err) {
      console.error("Error updating start date on blur:", err);
    }
  };

  // On blur, upsert the End Date
  const handleEndDateBlur = async () => {
    if (!selectedTask?.id) return;
    try {
      const endStr = formatDateForInput(selectedTask.end_date);
      const { error } = await supabase
        .from("gantt")
        .upsert({
          id: selectedTask.id,
          end_date: endStr,
        });
      if (error) {
        console.error("Error updating end date:", error);
      } else if (window.gantt) {
        const task = window.gantt.getTask(selectedTask.id);
        if (task) {
          task.end_date = new Date(endStr);
          window.gantt.updateTask(selectedTask.id);
        }
      }
    } catch (err) {
      console.error("Error updating end date on blur:", err);
    }
  };

  // On blur, upsert the Duration
  const handleDurationBlur = async () => {
    if (!selectedTask?.id) return;
    try {
      const { error } = await supabase
        .from("gantt")
        .upsert({
          id: selectedTask.id,
          duration: selectedTask.duration ?? 0,
        });
      if (error) {
        console.error("Error updating duration:", error);
      } else if (window.gantt) {
        const task = window.gantt.getTask(selectedTask.id);
        if (task) {
          task.duration = selectedTask.duration ?? 0;
          window.gantt.updateTask(selectedTask.id);
        }
      }
    } catch (err) {
      console.error("Error updating duration on blur:", err);
    }
  };

  // Delete the current selected task from Supabase and Gantt
  const handleDeleteTask = async () => {
    if (!selectedTask?.id) return;
    try {
      const { error } = await supabase.from("gantt").delete().eq("id", selectedTask.id);
      if (error) {
        console.error("Error deleting task:", error);
      } else if (window.gantt) {
        window.gantt.deleteTask(selectedTask.id);
      }
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  // Toggle the critical field and upsert to Supabase
  const handleCriticalToggle = async () => {
    if (!selectedTask?.id) return;
    const newVal = !selectedTask.critical;
    // Update local state so the UI toggles immediately
    onTaskChange({ ...selectedTask, critical: newVal });
    // Upsert to Supabase
    try {
      const { error } = await supabase
        .from("gantt")
        .upsert({
          id: selectedTask.id,
          critical: newVal,
        });
      if (error) {
        console.error("Error updating critical:", error);
      } else if (window.gantt) {
        const task = window.gantt.getTask(selectedTask.id);
        if (task) {
          task.critical = newVal;
          window.gantt.updateTask(selectedTask.id);
        }
      }
    } catch (err) {
      console.error("Error toggling critical path:", err);
    }
  };

  if (!selectedTask) return null;

  const topHeadingStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: "bold",
    color: "#fff",
    marginBottom: "1rem",
    textAlign: "left",
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: "normal",
    color: "#fff",
    marginBottom: "0.5rem",
    display: "block",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.25rem 1rem 0.25rem 0.5rem",
    height: "30px",
    border: "1px solid var(--gray-500)",
    borderRadius: "8px",
    color: "#fff",
    marginBottom: "1rem",
    boxSizing: "border-box",
    lineHeight: "30px",
    fontSize: "13px",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "transparent",
  };

  const toggleStyle: React.CSSProperties = {
    width: "22.5px",
    height: "11.25px",
    borderRadius: "15px",
    position: "relative",
    cursor: "pointer",
  };

  // Bottom buttons row style
  const buttonHeight = "2rem";
  const buttonFontSize = "9px"; // ~70% of 13px

  return (
    <div
      style={{
        width: containerWidth,
        minWidth: containerWidth,
        transition: "all 0.3s ease",
        overflow: "hidden",
        backgroundColor: "var(--gray-200)",
        borderRight: "1px solid var(--gray-500)",
        boxSizing: "border-box",
        height: "100%",
        position: "relative",
        opacity: isVisible ? 1 : 0,
        transitionDelay: isVisible ? "0s" : "0.3s",
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

        /* Remove gray background from up/down arrows on number inputs */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          background: transparent;
          margin: 0;
        }

        /* Style the calendar icon in date inputs to match the grey outline */
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: brightness(0) saturate(100%) invert(50%);
        }
      `}</style>

      <div style={{ padding: "1rem 1rem 1rem 0" }}>
        <div style={topHeadingStyle}>Gantt Task Settings</div>

        {/* TASK NAME */}
        <div>
          <label style={fieldLabelStyle}>Task Name</label>
          <input
            type="text"
            value={selectedTask.text}
            onChange={(e) => handleFieldChange("text", e.target.value)}
            onBlur={handleTaskNameBlur}
            style={inputStyle}
            className="leftNavInput"
          />
        </div>

        {/* START DATE */}
        <div>
          <label style={fieldLabelStyle}>Start Date</label>
          <input
            type="date"
            value={formatDateForInput(selectedTask.start_date)}
            onChange={(e) => handleFieldChange("start_date", e.target.value)}
            onBlur={handleStartDateBlur}
            style={inputStyle}
            className="leftNavInput"
          />
        </div>

        {/* END DATE */}
        <div>
          <label style={fieldLabelStyle}>End Date</label>
          <input
            type="date"
            value={formatDateForInput(selectedTask.end_date)}
            onChange={(e) => handleFieldChange("end_date", e.target.value)}
            onBlur={handleEndDateBlur}
            style={inputStyle}
            className="leftNavInput"
          />
        </div>

        {/* DURATION */}
        <div>
          <label style={fieldLabelStyle}>Duration (days)</label>
          <input
            type="number"
            value={selectedTask.duration || 0}
            onChange={(e) =>
              handleFieldChange("duration", parseInt(e.target.value, 10))
            }
            onBlur={handleDurationBlur}
            style={inputStyle}
            className="leftNavInput"
          />
        </div>

        {/* CRITICAL PATH TOGGLE */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <div
            onClick={handleCriticalToggle}
            style={{
              ...toggleStyle,
              background: selectedTask.critical ? "var(--green)" : "#ccc",
            }}
          >
            <div
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: "#fff",
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                left: selectedTask.critical ? "12px" : "1.5px",
                transition: "left 0.3s ease",
              }}
            />
          </div>
          <span style={{ marginLeft: "8px", fontSize: "13px", color: "#fff" }}>
            Critical Path
          </span>
        </div>
      </div>

      {/* Bottom Buttons Row */}
      <div
        style={{
          position: "absolute",
          bottom: "2rem",
          left: 0,
          width: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0 1rem 0 0",
        }}
      >
        {/* Delete Button (fixed 3rem width, on the left) */}
        <button
          onClick={handleDeleteTask}
          style={{
            width: "3rem",
            height: buttonHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "transparent",
            border: "1px solid var(--gray-500)",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: buttonFontSize,
          }}
        >
          <IoTrashOutline color="#fff" size={16} />
        </button>

        {/* New Sub Task Button (flex: 2) */}
        <button
          onClick={() => {
            if (selectedTask?.id) {
              onAddSubTask(selectedTask.id);
            }
          }}
          style={{
            flex: 2,
            height: buttonHeight,
            fontSize: buttonFontSize,
            color: "#fff",
            backgroundColor: "transparent",
            border: "1px solid var(--gray-500)",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          New Sub Task
        </button>

        {/* New Main Task Button (flex: 2) */}
        <button
          onClick={onAddMainTask}
          style={{
            flex: 2,
            height: buttonHeight,
            fontSize: buttonFontSize,
            color: "#fff",
            backgroundColor: "transparent",
            border: "1px solid var(--gray-500)",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          New Main Task
        </button>
      </div>
    </div>
  );
}
