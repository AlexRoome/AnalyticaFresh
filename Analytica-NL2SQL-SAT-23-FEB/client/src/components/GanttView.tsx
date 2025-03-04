import React, { useEffect, useRef, useState } from "react";
import ReactDOMServer from "react-dom/server";
import { AiOutlinePlus } from "react-icons/ai";
import { IoTrashOutline } from "react-icons/io5";
import { supabase } from "../supabaseClient";
import { useGanttContext } from "../context/GanttContext";
import styles from "./costCenters/myTables.module.css";
import "./Gant.css";
import LeftNavBarGantt, { GanttTask } from "./ui/LeftNavBarGantt";

declare global {
  interface Window {
    gantt: any;
    updateTaskMonthsByText?: (taskText: string, newDurationDays: number) => void;
  }
}

// Helper to convert Date to local "YYYY-MM-DD" at 00:00 local time.
function formatLocalDate(date: Date): string {
  date.setHours(0, 0, 0, 0);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const fallbackTasks = [
  {
    id: 1,
    text: "Planning Phase",
    start_date: "2025-10-01",
    duration: 30,
    critical: true,
  },
  {
    id: 2,
    text: "Design Development",
    start_date: "2025-11-01",
    duration: 40,
    critical: false,
  },
  {
    id: 3,
    text: "Construction Documentation",
    start_date: "2026-01-01",
    duration: 70,
    critical: false,
  },
  {
    id: 4,
    text: "Marketing Preparation",
    start_date: "2026-03-01",
    duration: 60,
    critical: false,
  },
  {
    id: 5,
    text: "Sales",
    start_date: "2026-05-01",
    duration: 120,
    critical: true,
  },
  {
    id: 6,
    text: "Construction Procurement",
    start_date: "2026-09-01",
    duration: 244,
    critical: false,
  },
  {
    id: 7,
    text: "Construction",
    start_date: "2027-06-01",
    duration: 380,
    critical: true,
  },
  {
    id: 8,
    text: "Settlement",
    start_date: "2028-06-17",
    duration: 10,
    critical: false,
  },
];

function withComputedEndDates(tasks: any[]) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return tasks.map((t) => {
    if (!t.start_date) return t;
    const start = new Date(t.start_date);
    // If end_date is missing, compute from duration:
    const end = t.end_date
      ? new Date(t.end_date)
      : new Date(start.getTime() + (t.duration || 0) * msPerDay);
    return {
      ...t,
      start_date: formatLocalDate(start),
      end_date: formatLocalDate(end),
    };
  });
}

function withProgressComputed(tasks: any[]) {
  const now = new Date();
  return tasks.map((t) => {
    const start = new Date(t.start_date);
    const end = new Date(t.end_date);
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    let ratio = total ? elapsed / total : 0;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    return { ...t, progress: ratio };
  });
}

async function loadTasks() {
  try {
    const { data, error } = await supabase.from("gantt").select("*");
    if (error || !data || data.length === 0) {
      console.error("Error or no rows, falling back to heading tasks:", error);
      return withProgressComputed(withComputedEndDates(fallbackTasks));
    }
    const mapped = data.map((row: any) => ({
      id: row.id,
      task_name: row.task_name,
      text: row.task_name,
      start_date: row.start_date,
      end_date: row.end_date,
      duration: row.duration || 0,
      parent: row.parent || 0,
      critical: row.critical ?? false,
    }));
    return withProgressComputed(withComputedEndDates(mapped));
  } catch (err) {
    console.error("Error loading tasks from DB:", err);
    return withProgressComputed(withComputedEndDates(fallbackTasks));
  }
}

async function loadLinks(feasibilityId: string) {
  try {
    const { data, error } = await supabase
      .from("gantt_links")
      .select("*")
      .eq("feasibility_id", feasibilityId);
    if (error) {
      console.error("Error loading links from DB:", error);
      return [];
    }
    return data.map((row: any) => ({
      id: row.id,
      source: row.source,
      target: row.target,
      type: row.type || "0",
    }));
  } catch (err) {
    console.error("Error loading links from DB:", err);
    return [];
  }
}

export async function getGanttTasks() {
  return loadTasks();
}

export async function getGanttMonths(): Promise<string[]> {
  const tasks = await loadTasks();
  if (!tasks || tasks.length === 0) return [];
  let earliest = new Date(tasks[0].start_date);
  let latest = new Date(tasks[0].end_date);
  for (const task of tasks) {
    const start = new Date(task.start_date);
    const end = new Date(task.end_date);
    if (start < earliest) earliest = start;
    if (end > latest) latest = end;
  }
  const months: string[] = [];
  const current = new Date(earliest);
  current.setDate(1);
  const monthEnd = new Date(latest);
  monthEnd.setDate(1);
  while (current <= monthEnd) {
    const label = current.toLocaleString("default", {
      month: "short",
      year: "numeric",
    });
    months.push(label);
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

export default function GanttView({ feasibilityId }: { feasibilityId: string }) {
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const { tasks, setTasks } = useGanttContext();
  const [links, setLinks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<GanttTask>({
    id: 0,
    text: "",
    start_date: "",
    end_date: "",
    duration: 0,
    critical: false,
  });

  async function ensureFallbackInDB(): Promise<boolean> {
    try {
      const { data: existing, error: checkErr } = await supabase
        .from("gantt")
        .select("id")
        .limit(1);
      if (checkErr) {
        console.error("Error checking DB:", checkErr);
        return false;
      }
      const isEmpty = !existing || existing.length === 0;
      if (!isEmpty) return false;

      const msPerDay = 24 * 60 * 60 * 1000;
      const fallbackRowsToInsert = fallbackTasks.map((ft) => {
        const sDate = new Date(ft.start_date);
        const eDate = new Date(sDate.getTime() + ft.duration * msPerDay);
        return {
          task_name: ft.text,
          start_date: formatLocalDate(sDate),
          end_date: formatLocalDate(eDate),
          duration: ft.duration,
          parent: 0,
          critical: ft.critical,
          feasibility_id: feasibilityId,
        };
      });
      const { data: inserted, error: insErr } = await supabase
        .from("gantt")
        .insert(fallbackRowsToInsert)
        .select("*");
      if (insErr) {
        console.error("Error bulk-inserting fallback tasks:", insErr);
        return false;
      }
      const reloaded = await loadTasks();
      setTasks(reloaded);
      return true;
    } catch (err) {
      console.error("Error in ensureFallbackInDB:", err);
      return false;
    }
  }

  async function handleAddSubTask(parentId: number) {
    try {
      const isFallbackParent = fallbackTasks.some((f) => f.id === parentId);
      let realParentId = parentId;
      if (isFallbackParent) {
        const didInsertFallback = await ensureFallbackInDB();
        if (didInsertFallback) {
          const fallbackObj = fallbackTasks.find((f) => f.id === parentId);
          if (fallbackObj) {
            const matched = tasks.find((t) => t.text === fallbackObj.text);
            if (matched) realParentId = matched.id;
          }
        }
      }
      const msPerDay = 24 * 60 * 60 * 1000;
      const defaultDuration = 5;
      const start = new Date();
      const end = new Date(start.getTime() + defaultDuration * msPerDay);

      const subtaskRow = {
        task_name: "New Subtask",
        start_date: formatLocalDate(start),
        end_date: formatLocalDate(end),
        duration: defaultDuration,
        parent: realParentId,
        critical: false,
        feasibility_id: feasibilityId,
      };

      const { data, error } = await supabase
        .from("gantt")
        .insert([subtaskRow])
        .select("*");
      if (error || !data || data.length === 0) {
        throw new Error("Error inserting subtask: " + (error?.message || "No data returned"));
      }
      const newRow = data[0];
      window.gantt.addTask({
        id: newRow.id,
        text: newRow.task_name,
        start_date: newRow.start_date,
        end_date: newRow.end_date,
        duration: newRow.duration,
        parent: newRow.parent,
        critical: newRow.critical,
      });
      window.gantt.showTask(newRow.id);
      setTasks((prev) => [...prev, { ...newRow, text: newRow.task_name }]);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddMainTask() {
    try {
      await ensureFallbackInDB();
      const msPerDay = 24 * 60 * 60 * 1000;
      const defaultDuration = 10;
      const start = new Date();
      const end = new Date(start.getTime() + defaultDuration * msPerDay);

      const newMainRow = {
        task_name: "New Main Task",
        start_date: formatLocalDate(start),
        end_date: formatLocalDate(end),
        duration: defaultDuration,
        parent: 0,
        critical: false,
        feasibility_id: feasibilityId,
      };

      const { data, error } = await supabase
        .from("gantt")
        .insert([newMainRow])
        .select("*");
      if (error || !data || data.length === 0) {
        throw new Error(
          "Error inserting new main task: " + (error?.message || "No data returned")
        );
      }
      const insertedRow = data[0];
      window.gantt.addTask({
        id: insertedRow.id,
        text: insertedRow.task_name,
        start_date: insertedRow.start_date,
        end_date: insertedRow.end_date,
        duration: insertedRow.duration,
        parent: insertedRow.parent,
        critical: insertedRow.critical,
      });
      window.gantt.showTask(insertedRow.id);
      setTasks((prev) => [...prev, { ...insertedRow, text: insertedRow.task_name }]);
    } catch (err) {
      console.error("handleAddMainTask error:", err);
    }
  }

  useEffect(() => {
    if (!ganttContainerRef.current || !window.gantt) return;
    const { gantt } = window;

    // If you want the library to treat all times as UTC, uncomment this:
    // gantt.config.server_utc = true;

    // Disable the progress drag handle
    gantt.config.drag_progress = false;
    // Set to not auto-scroll on task click
    gantt.config.scroll_on_click = false;
    // Show only the "Task name" column
    gantt.config.columns = [
      {
        name: "text",
        label: "Task name",
        tree: true,
        width: 250,
        align: "left",
        headerCss: "leftAlignedHeader",
      },
    ];
    gantt.config.xml_date = "%Y-%m-%d";
    
    // Replace obsolete scale configuration with new scales array
    gantt.config.scales = [
      {
        unit: "month",
        step: 1,
        format: "%F %Y"
      }
    ];
    
    // Keep other configurations
    gantt.config.scale_height = 48;
    gantt.config.min_column_width = 130;
    gantt.config.round_dnd_dates = false;
    gantt.config.drag_step = 1;
    gantt.config.autosize = "y";
    gantt.config.show_horizontal_scroll = false;
    gantt.config.drag_links = true;
    gantt.config.editable = true;
    // Prevent default lightbox
    gantt.attachEvent("onBeforeLightbox", () => false);

    // Style tasks
    gantt.templates.task_class = function (start, end, task) {
      return task.critical ? "gantt_critical_task" : "nonCritical";
    };
    gantt.templates.link_class = function (link) {
      const s = gantt.getTask(link.source);
      const t = gantt.getTask(link.target);
      return s.critical || t.critical ? "gantt_critical_link" : "";
    };

    gantt.init(ganttContainerRef.current);

    gantt.attachEvent("onTaskClick", (id: number) => {
      const task = gantt.getTask(id);
      setSelectedTask({ ...task, text: task.text });
      return true;
    });

    gantt.attachEvent("onAfterTaskUpdate", async (id: number, task: any) => {
      const { error } = await supabase.from("gantt").upsert({
        id: task.id,
        task_name: task.text,
        start_date: task.start_date,
        end_date: task.end_date,
        duration: task.duration,
        parent: task.parent || 0,
        critical: task.critical ?? false,
        feasibility_id: feasibilityId,
      });
      if (error) console.error("Error updating task:", error);
      setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, ...task } : x)));
    });

    gantt.attachEvent("onAfterTaskDelete", async (id: number) => {
      const { error } = await supabase.from("gantt").delete().eq("id", id);
      if (error) console.error("Error deleting task:", error);
      setTasks((prev) => prev.filter((x) => x.id !== id));
    });

    gantt.attachEvent("onAfterLinkAdd", async (tempId: number, link: any) => {
      try {
        const { data, error } = await supabase
          .from("gantt_links")
          .insert([
            {
              source: link.source,
              target: link.target,
              type: link.type,
              feasibility_id: feasibilityId,
            },
          ])
          .select("*");
        if (error || !data || data.length === 0) {
          console.error("Error inserting link:", error);
          gantt.deleteLink(tempId);
          return;
        }
        const newLink = data[0];
        gantt.changeLinkId(tempId, newLink.id);
        setLinks((prev) => [
          ...prev,
          {
            id: newLink.id,
            source: newLink.source,
            target: newLink.target,
            type: newLink.type || "0",
          },
        ]);
      } catch (err) {
        console.error("onAfterLinkAdd error:", err);
      }
    });

    gantt.attachEvent("onAfterLinkUpdate", async (id: number, link: any) => {
      try {
        const { error } = await supabase
          .from("gantt_links")
          .update({
            source: link.source,
            target: link.target,
            type: link.type,
          })
          .eq("id", id);
        if (error) console.error("Error updating link:", error);
        setLinks((prev) =>
          prev.map((l) =>
            l.id === id
              ? { ...l, source: link.source, target: link.target, type: link.type }
              : l
          )
        );
      } catch (err) {
        console.error("onAfterLinkUpdate error:", err);
      }
    });

    gantt.attachEvent("onAfterLinkDelete", async (id: number) => {
      try {
        const { error } = await supabase.from("gantt_links").delete().eq("id", id);
        if (error) console.error("Error deleting link:", error);
        setLinks((prev) => prev.filter((l) => l.id !== id));
      } catch (err) {
        console.error("onAfterLinkDelete error:", err);
      }
    });

    (window as any).updateTaskMonthsByText = (taskText: string, newDurationDays: number) => {
      gantt.eachTask((taskItem: any) => {
        if (taskItem.text === taskText) {
          taskItem.duration = newDurationDays;
          gantt.updateTask(taskItem.id);
        }
      });
      gantt.render();
    };

    (async () => {
      const loadedTasks = await loadTasks();
      const loadedLinks = await loadLinks(feasibilityId);
      gantt.parse({ data: loadedTasks, links: loadedLinks });
      setTasks(loadedTasks);
      setLinks(loadedLinks);
    })();
  }, [feasibilityId, setTasks]);

  useEffect(() => {
    if (!window.gantt) return;
    const { gantt } = window;
    const scrollState = gantt.getScrollState();
    gantt.clearAll();
    gantt.parse({ data: tasks, links });
    gantt.eachTask((t: any) => gantt.open(t.id));
    gantt.scrollTo(scrollState.x, scrollState.y);
    gantt.render();
  }, [tasks, links]);

  useEffect(() => {
    if (!ganttContainerRef.current) return;
    const container = ganttContainerRef.current;
    const clickHandler = (e: MouseEvent) => {
      const element = e.target as HTMLElement;
      const subtaskBtn = element.closest(".subtask-btn") as HTMLButtonElement;
      if (subtaskBtn) {
        const parentId = subtaskBtn.getAttribute("data-parent-id");
        if (parentId) handleAddSubTask(parseInt(parentId, 10));
        return;
      }
      const deleteBtn = element.closest(".delete-btn") as HTMLButtonElement;
      if (deleteBtn) {
        const delId = deleteBtn.getAttribute("data-delete-id");
        if (delId) window.gantt.deleteTask(parseInt(delId, 10));
      }
    };
    container.addEventListener("click", clickHandler);
    return () => {
      container.removeEventListener("click", clickHandler);
    };
  }, []);

  return (
    <div
      className={styles.tableContainer}
      style={{
        display: "flex",
        flexDirection: "row",
        width: "100%",
        minHeight: "600px",
        overflow: "hidden",
      }}
    >
      {/* Left side: Gantt Task Settings Nav with 1rem right spacing */}
      <div
        style={{
          width: "330px",
          overflowY: "auto",
          overflowX: "hidden",
          marginRight: "1rem",
          boxSizing: "border-box",
        }}
      >
        <LeftNavBarGantt
          isVisible={true}
          selectedTask={selectedTask}
          onTaskChange={setSelectedTask}
          onAddMainTask={handleAddMainTask}
          onAddSubTask={handleAddSubTask}
        />
      </div>

      {/* Right side: Gantt chart */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <style>{`
          .leftAlignedHeader {
            text-align: left !important;
          }
          .gantt_scale_cell {
            font-weight: 700;
            font-size: 13px;
          }
        `}</style>
        <div
          ref={ganttContainerRef}
          style={{
            width: "100%",
            flex: 1,
            minHeight: "600px",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
