import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import SettingsLayout from "./SettingsLayout";
import "./ProjectSettings.css";

interface SettingsTaxationComplianceProps {
  feasibilityId: string;
}

export default function SettingsTaxationCompliance({ feasibilityId }: SettingsTaxationComplianceProps) {
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

  // Helper to get default tax policy based on the selected country
  function getDefaultTaxPolicy(country: string): { value: string; label: string } {
    switch (country) {
      case "AU":
        return { value: "GST", label: "GST (generic)" };
      case "UK":
        return { value: "VAT", label: "VAT (UK/EU)" };
      case "NZ":
        return { value: "GST", label: "GST (generic)" };
      case "US":
        return { value: "SALES_TAX", label: "Sales Tax (US)" };
      case "CA":
        return { value: "GST", label: "GST (generic)" };
      default:
        return { value: "NONE", label: "No Tax" };
    }
  }

  // Helper to determine if the tax policy is enabled
  function isTaxPolicyEnabled() {
    return projectData && projectData.tax_policy && projectData.tax_policy !== "NONE";
  }

  // Update local state on user input
  function handleChange(fieldName: string, value: string) {
    setProjectData((prev: any) => {
      const updated = { ...prev, [fieldName]: value };
      if (fieldName === "country_code") {
        if (prev && prev.tax_policy && prev.tax_policy !== "NONE") {
          updated.tax_policy = getDefaultTaxPolicy(value).value;
        }
      }
      return updated;
    });
  }

  // Dedicated handler for country changes: update state and immediately send the new country_code to Supabase
  async function handleCountryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    handleChange("country_code", value);

    const newTaxPolicy =
      projectData && projectData.tax_policy && projectData.tax_policy !== "NONE"
        ? getDefaultTaxPolicy(value).value
        : "NONE";
    try {
      const { error } = await supabase
        .from("feasibilities")
        .update({
          title: projectData.title,
          country_code: value,
          tax_policy: newTaxPolicy,
        })
        .eq("id", feasibilityId);
      if (error) {
        console.error("Error updating country_code and tax policy:", error);
      }
    } catch (err) {
      console.error("Error updating country_code:", err);
    }
  }

  // Handler for the tax policy toggle (on/off)
  function handleTaxToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const enabled = e.target.checked;
    const newTaxPolicy = enabled
      ? getDefaultTaxPolicy(projectData.country_code || "").value
      : "NONE";
    setProjectData((prev: any) => ({ ...prev, tax_policy: newTaxPolicy }));
    supabase
      .from("feasibilities")
      .update({
        title: projectData.title,
        country_code: projectData.country_code,
        tax_policy: newTaxPolicy,
      })
      .eq("id", feasibilityId)
      .then(({ error }) => {
        if (error) {
          console.error("Error updating tax policy:", error);
        }
      });
  }

  // Write changes to "feasibilities" after user leaves the field (if needed)
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

  const taxPolicyLabel = isTaxPolicyEnabled()
    ? getDefaultTaxPolicy(projectData.country_code || "").label
    : "No Tax";

  return (
    <SettingsLayout>
      {/* Header */}
      <div className="projectNameWrapper" style={{ marginBottom: "1rem" }}>
        <span
          className="projectNameInput"
          style={{ width: "100%", border: "none", outline: "none" }}
        >
          Taxation &amp; Compliance
        </span>
      </div>

      {/* Settings Fields Below Header */}
      {/* Country Code */}
      <div className="countryCodeWrapper" style={{ marginBottom: "1.5rem" }}>
        <label className="sectionLabel" style={{ display: "block", marginBottom: "0.5rem" }}>
          Country Code
        </label>
        <select
          value={projectData.country_code || ""}
          onChange={handleCountryChange}
          onBlur={handleBlur}
          className="countryCodeSelect"
          style={{ width: "100%", border: "1px solid var(--gray-300)", padding: "0.25rem" }}
        >
          <option value="">Select Country</option>
          <option value="AU">Australia (AU)</option>
          <option value="NZ">New Zealand (NZ)</option>
          <option value="US">United States (US)</option>
          <option value="UK">United Kingdom (UK)</option>
          <option value="CA">Canada (CA)</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {/* Tax Policy */}
      <div className="taxPolicyWrapper" style={{ marginBottom: "1.5rem" }}>
        <label className="sectionLabel" style={{ display: "block", marginBottom: "0.5rem" }}>
          Tax Policy
        </label>
        <div className="taxPolicyToggleWrapper">
          <label className="toggleSwitch">
            <input
              type="checkbox"
              checked={isTaxPolicyEnabled()}
              onChange={handleTaxToggle}
            />
            <span className="slider"></span>
          </label>
          <span className="taxPolicyLabel">{taxPolicyLabel}</span>
        </div>
      </div>
    </SettingsLayout>
  );
}
