import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import SettingsLayout from "./SettingsLayout";
import "./ProjectSettings.css";

interface SettingsGeneralLocalisationProps {
  feasibilityId: string;
}

export default function SettingsGeneralLocalisation({ feasibilityId }: SettingsGeneralLocalisationProps) {
  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load the record from the "feasibilities" table
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
          console.error("Error fetching project:", error);
          return;
        }
        // If no tax_policy is returned, default to "NONE"
        if (!data.tax_policy) {
          data.tax_policy = "NONE";
        }
        setProjectData(data);
      });
  }, [feasibilityId]);

  // Update local state on user input
  function handleChange(fieldName: string, value: string) {
    setProjectData((prev: any) => ({
      ...prev,
      [fieldName]: value,
    }));
  }

  // Write changes to "feasibilities" after user leaves the field
  async function handleBlur() {
    if (!feasibilityId || !projectData) return;

    try {
      const { error } = await supabase
        .from("feasibilities")
        .update({
          title: projectData.title,
          country_code: projectData.country_code,
          tax_policy: projectData.tax_policy,
        })
        .eq("id", feasibilityId);

      if (error) {
        console.error("Error updating project:", error);
      }
    } catch (err) {
      console.error("Error saving project:", err);
    }
  }

  if (!feasibilityId || loading) return null;
  if (!projectData) return <div>No data found for this project.</div>;

  return (
    <SettingsLayout>
      {/* Header */}
      <div className="projectNameWrapper" style={{ marginBottom: "1rem" }}>
        <span
          className="projectNameInput"
          style={{ width: "100%", border: "none", outline: "none" }}
        >
          General &amp; Localisation
        </span>
      </div>

      {/* Settings Fields Below Header */}
      {/* Project Name */}
      <div className="projectInfoWrapper" style={{ marginBottom: "1rem" }}>
        <label
          className="sectionLabel"
          style={{ display: "block", marginBottom: "0.25rem" }}
        >
          Project Name
        </label>
        <input
          type="text"
          value={projectData.title || ""}
          onChange={(e) => handleChange("title", e.target.value)}
          onBlur={handleBlur}
          className="projectInfoInput"
          style={{ width: "100%", border: "none", outline: "none" }}
        />
      </div>

      {/* Project ID */}
      <div className="projectInfoWrapper" style={{ marginBottom: "1rem" }}>
        <label
          className="sectionLabel"
          style={{ display: "block", marginBottom: "0.25rem" }}
        >
          Project ID
        </label>
        <input
          type="text"
          value={projectData.id || ""}
          readOnly
          className="projectInfoInput"
          style={{ width: "100%", border: "none", outline: "none" }}
        />
      </div>

      {/* Created At */}
      <div className="projectInfoWrapper" style={{ marginBottom: "1.5rem" }}>
        <label
          className="sectionLabel"
          style={{ display: "block", marginBottom: "0.25rem" }}
        >
          Created At
        </label>
        <input
          type="text"
          value={projectData.created_at || ""}
          readOnly
          className="projectInfoInput"
          style={{ width: "100%", border: "none", outline: "none" }}
        />
      </div>
    </SettingsLayout>
  );
}
