// /client/src/components/FeasibilityIndex.tsx

import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import styles from "./myTables.module.css";
import { useSidebarContext } from "../../context/SidebarContext";

interface FeasibilityIndexProps {
  feasibilityId?: string;
}

export default function FeasibilityIndex({ feasibilityId }: FeasibilityIndexProps) {
  const { isDarkMode } = useSidebarContext();
  const [feasibilityData, setFeasibilityData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // State to hold timeline info (first & last activity dates)
  const [timeline, setTimeline] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  // Helper function to format date and time as "DD Month YYYY, HH:MM"
  function formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  // Fetch the feasibility record
  useEffect(() => {
    if (!feasibilityId) return;

    supabase
      .from("feasibilities")
      .select("*")
      .eq("id", feasibilityId)
      .single()
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          console.error("Error fetching feasibility:", error);
          return;
        }
        setFeasibilityData(data);
      });
  }, [feasibilityId]);

  // Fetch gantt tasks for this feasibility and compute the timeline
  useEffect(() => {
    if (!feasibilityId) return;

    supabase
      .from("gantt")
      .select("start_date, end_date")
      .eq("feasibility_id", feasibilityId)
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching gantt tasks:", error);
          return;
        }
        if (data && data.length > 0) {
          let earliest: Date | null = null;
          let latest: Date | null = null;
          data.forEach((task: any) => {
            if (task.start_date && task.end_date) {
              const taskStart = new Date(task.start_date);
              const taskEnd = new Date(task.end_date);
              if (!earliest || taskStart < earliest) {
                earliest = taskStart;
              }
              if (!latest || taskEnd > latest) {
                latest = taskEnd;
              }
            }
          });
          setTimeline({ start: earliest, end: latest });
        }
      });
  }, [feasibilityId]);

  // Update local state on change
  function handleChange(fieldName: string, value: string) {
    setFeasibilityData((prev: any) => ({ ...prev, [fieldName]: value }));
  }

  // Automatically save onBlur
  async function handleBlur() {
    if (!feasibilityId || !feasibilityData) return;

    try {
      const { error } = await supabase
        .from("feasibilities")
        .update({
          title: feasibilityData.title,
          address: feasibilityData.address,
        })
        .eq("id", feasibilityId);

      if (error) {
        console.error("Error updating feasibility:", error);
      }
    } catch (err) {
      console.error("Error saving feasibility:", err);
    }
  }

  if (!feasibilityId || loading) {
    return null; // No UI shown until the data is fetched
  }

  if (!feasibilityData) {
    return <div>No data found for this feasibility.</div>;
  }

  // Compute progress percentage based on current date versus timeline start/end.
  let progress = 0;
  if (timeline.start && timeline.end) {
    const now = new Date();
    const totalDuration = timeline.end.getTime() - timeline.start.getTime();
    const elapsed = now.getTime() - timeline.start.getTime();
    progress = totalDuration > 0 ? elapsed / totalDuration : 0;
    if (progress < 0) progress = 0;
    if (progress > 1) progress = 1;
  }

  // Compute total days and current day number
  let totalDays = 0;
  let currentDay = 0;
  if (timeline.start && timeline.end) {
    const msPerDay = 24 * 60 * 60 * 1000;
    totalDays = Math.round((timeline.end.getTime() - timeline.start.getTime()) / msPerDay);
    const now = new Date();
    currentDay = Math.floor((now.getTime() - timeline.start.getTime()) / msPerDay) + 1;
    if (currentDay < 0) currentDay = 0;
    if (currentDay > totalDays) currentDay = totalDays;
  }

  return (
    <div
      className={isDarkMode ? styles.tableContainer : styles.tableContainerWhite}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        // Close any open context menus, etc.
      }}
    >
      <div
        className={`ag-theme-alpine customPerimeterTheme customHeaderTheme redRowBordersTheme ${styles.agGridWrapper}`}
        style={{ padding: "1rem" }}
      >
        {/* Project Title (remains large) */}
        <div style={{ marginBottom: "1rem", fontSize: "3rem", fontWeight: "bold" }}>
          <input
            type="text"
            value={feasibilityData.title || ""}
            onChange={(e) => handleChange("title", e.target.value)}
            onBlur={handleBlur}
            placeholder="Project Name"
            style={{
              width: "100%",
              fontSize: "3rem",
              fontWeight: "bold",
              border: "none",
              outline: "none",
            }}
          />
        </div>

        {/* Other fields at font-size 1rem */}
        <div style={{ marginBottom: "1.5rem", fontSize: "1rem" }}>
          <input
            type="text"
            value={feasibilityData.address || ""}
            onChange={(e) => handleChange("address", e.target.value)}
            onBlur={handleBlur}
            placeholder="Project Address"
            style={{
              width: "100%",
              fontSize: "1rem",
              border: "none",
              outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: "1rem", fontSize: "1rem" }}>
          <input
            type="text"
            value={feasibilityData.id || ""}
            readOnly
            style={{
              width: "100%",
              fontSize: "1rem",
              border: "none",
              outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: "1.5rem", fontSize: "1rem" }}>
          <input
            type="text"
            value={feasibilityData.created_at || ""}
            readOnly
            style={{
              width: "100%",
              fontSize: "1rem",
              border: "none",
              outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: "1.5rem", fontSize: "1rem" }}>
          <input
            type="text"
            value={feasibilityData.modified ? formatDateTime(feasibilityData.modified) : ""}
            readOnly
            style={{
              width: "100%",
              fontSize: "1rem",
              border: "none",
              outline: "none",
            }}
          />
        </div>

        {/* Timeline Information & Loading Bar */}
        <div style={{ marginBottom: "1.5rem", fontSize: "1rem" }}>
          {timeline.start && timeline.end ? (
            <>
              {/* Loading Bar Container with fixed width of 25% */}
              <div
                style={{
                  marginTop: "0.5rem",
                  background: "#e0e0e0", // light grey background
                  height: "10px", // slimmer height
                  borderRadius: "5px",
                  overflow: "hidden",
                  width: "25%", // loading bar is 25% the width
                }}
              >
                <div
                  style={{
                    width: `${progress * 100}%`,
                    background: "linear-gradient(90deg, #c7c7cc, #8e8e93)", // grey gradient similar to Apple tones
                    height: "100%",
                    borderRadius: "5px",
                    transition: "width 0.2s ease-in-out",
                  }}
                ></div>
              </div>
              {/* Timeline Details (all at 1rem font size) below the loading bar */}
              <div style={{ marginTop: "1rem" }}>
                {timeline.start.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}{" "}
                -{" "}
                {timeline.end.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <div style={{ marginTop: "0.5rem" }}>
                Day {currentDay} of {totalDays}
              </div>
              <div style={{ marginTop: "0.5rem" }}>
                {Math.round(progress * 100)}%
              </div>
            </>
          ) : (
            <div>No timeline data available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
