// src/components/costCenters/Invoices.tsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry } from "ag-grid-community";
import { RangeSelectionModule } from "@ag-grid-enterprise/range-selection";
import { ClipboardModule } from "@ag-grid-enterprise/clipboard";
import { useDropzone } from "react-dropzone";
import { v4 as uuidv4 } from "uuid";
import ReactDOM from "react-dom";
import { parse, format } from "date-fns"; // NEW: robust date parsing

import styles from "../components/costCenters/myTables.module.css";
import { supabase } from "../supabaseClient";
import { parseInvoiceWithGPT } from "../components/costCenters/utils/InvoiceGPT";
import { formatWithCommas } from "../components/costCenters/utils/formatNumbers";
import { debugPdfParsing } from "../components/costCenters/utils/debugPdfParser";
import { useSidebarContext } from "../context/SidebarContext"; // Added for dark mode

// Register AG Grid modules
ModuleRegistry.registerModules([RangeSelectionModule, ClipboardModule]);

// --- Updated Utility functions for date parsing ---
function reformatDate(dateStr: string): string {
  const formats = ["yyyy-MM-dd", "dd/MM/yyyy", "MM/dd/yyyy", "d MMM yyyy", "dd.MM.yyyy"];
  for (const fmt of formats) {
    const parsed = parse(dateStr, fmt, new Date());
    if (!isNaN(parsed.getTime())) {
      return format(parsed, "yyyy-MM-dd");
    }
  }
  console.warn(`reformatDate: Unrecognized date format: "${dateStr}"`);
  return "";
}

function sanitizeDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  const upper = dateStr.toUpperCase();
  if (upper === "N/A" || upper === "UNKNOWN") return null;
  const result = reformatDate(dateStr);
  return result && result.length >= 6 ? result : null;
}

interface InvoicesProps {
  feasibilityId: string;
}

export default function Invoices({ feasibilityId }: InvoicesProps) {
  const [invoicesData, setInvoicesData] = useState<any[]>([]);
  const [costCentreOptions, setCostCentreOptions] = useState<string[]>([]);
  const [notification, setNotification] = useState("");
  const [processing, setProcessing] = useState(false);
  const [dropzoneText, setDropzoneText] = useState("Drag and drop PDF files here");

  const { isDarkMode } = useSidebarContext(); // Dark mode context

  function showDuplicateNotification() {
    setNotification("Duplicate invoice was omitted!");
    setTimeout(() => setNotification(""), 3000);
  }

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number | null;
    mouseY: number | null;
    rowIndex: number | null;
  }>({ mouseX: null, mouseY: null, rowIndex: null });

  const closeContextMenu = () => {
    setContextMenu({ mouseX: null, mouseY: null, rowIndex: null });
  };

  const handleCellContextMenu = (params: any) => {
    params.event.preventDefault();
    setContextMenu({
      mouseX: params.event.clientX,
      mouseY: params.event.clientY,
      rowIndex: params.node.rowIndex,
    });
  };

  const handleAddRowAtTop = async () => {
    const newRow = {
      invoice_date: "New Invoice Date",
      invoice_number: "ARCH-NEW",
      supplier: "Supplier Name",
      description: "Description",
      amount_excl_gst: 0,
      gst: 0,
      amount_incl_gst: 0,
      cost_centre: "",
      due_date: "",
      approval_status: "Hold",
      attachment: "",
      feasibility_id: feasibilityId,
    };
    const { data, error } = await supabase.from("invoices").insert([newRow]).select();
    if (error) {
      console.error("Error inserting new invoice:", error);
      return;
    }
    setInvoicesData((prev) => [data[0], ...prev]);
    closeContextMenu();
  };

  const handleDeleteRow = async () => {
    if (contextMenu.rowIndex == null) return;
    const invoiceToDelete = invoicesData[contextMenu.rowIndex];
    if (!invoiceToDelete) return;
    const invoiceId = invoiceToDelete.invoice_id;
    const { error } = await supabase.from("invoices").delete().eq("invoice_id", invoiceId);
    if (error) {
      console.error("Error deleting invoice:", error);
      return;
    }
    setInvoicesData((prev) => {
      const newData = [...prev];
      newData.splice(contextMenu.rowIndex, 1);
      return newData;
    });
    closeContextMenu();
  };

  const handleViewInvoice = async () => {
    if (contextMenu.rowIndex == null) return;
    const invoiceToView = invoicesData[contextMenu.rowIndex];
    if (!invoiceToView) return;
    if (invoiceToView.attachment) {
      console.log("Attempting to create signed URL for:", invoiceToView.attachment);
      const { data, error } = await supabase.storage
        .from("invoices")
        .createSignedUrl(invoiceToView.attachment, 31536000);
      if (error) {
        console.error("Error generating signed URL:", error);
        return;
      }
      console.log("Signed URL response:", data);
      const signedUrl = data.signedURL || data.signedUrl;
      if (signedUrl && signedUrl.startsWith("http")) {
        window.open(signedUrl, "_blank");
      } else {
        console.error("Signed URL not valid:", data);
      }
    } else {
      console.error("No attachment available");
    }
    closeContextMenu();
  };

  const handleGoToManagementGrid = () => {
    if (contextMenu.rowIndex == null) return;
    const invoice = invoicesData[contextMenu.rowIndex];
    if (!invoice) return;
    const costCentre = invoice.cost_centre;
    if (costCentre) {
      window.location.href = `/feasibility/${feasibilityId}/${encodeURIComponent(costCentre)}`;
    } else {
      console.error("No cost centre found for this invoice");
    }
    closeContextMenu();
  };

  const handleCellKeyDown = (params: any) => {
    const { event, api, node, column } = params;
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (api.getEditingCells().length > 0) api.stopEditing(false);
      const nextRowIndex = node.rowIndex + 1;
      if (nextRowIndex < api.getDisplayedRowCount()) {
        api.setFocusedCell(nextRowIndex, column.getId());
      }
    }
  };

  const handleCellValueChanged = useCallback(async (params: any) => {
    console.log("Cell value changed", params);
    if (params.colDef.field === "cost_centre" && params.oldValue !== params.newValue) {
      const invoiceId = params.data.invoice_id;
      if (!invoiceId) {
        console.error("Missing invoice_id for cost centre update:", params.data);
        return;
      }
      const { data, error } = await supabase
        .from("invoices")
        .update({ cost_centre: params.newValue })
        .eq("invoice_id", invoiceId);
      if (error) console.error("Error updating cost centre:", error);
      else console.log("Cost centre updated:", data);
    }
    if (params.colDef.field === "approval_status" && params.oldValue !== params.newValue) {
      const invoiceId = params.data.invoice_id;
      if (!invoiceId) {
        console.error("Missing invoice_id for approval status update:", params.data);
        return;
      }
      const { data, error } = await supabase
        .from("invoices")
        .update({ approval_status: params.newValue })
        .eq("invoice_id", invoiceId);
      if (error) console.error("Error updating approval status:", error);
      else console.log("Approval status updated:", data);
    }
  }, []);

  const invoicesColDefs = useMemo(() => [
    { headerName: "Invoice Date", field: "invoice_date", minWidth: 150, flex: 1 },
    { headerName: "Due Date", field: "due_date", minWidth: 150, flex: 1 },
    { headerName: "Invoice Number", field: "invoice_number", minWidth: 150, flex: 1 },
    { headerName: "Supplier", field: "supplier", minWidth: 250, flex: 1 },
    { 
      headerName: "Amount (Excl. GST)", 
      field: "amount_excl_gst", 
      minWidth: 180, 
      flex: 1,
      valueFormatter: (params: any) => `$${formatWithCommas(params.value)}`,
      cellStyle: { textAlign: "right" },
      headerClass: "centerHeader",
    },
    {
      headerName: "GST",
      field: "gst",
      minWidth: 180,
      flex: 1,
      valueFormatter: (params: any) => `$${formatWithCommas(params.value)}`,
      cellStyle: { textAlign: "right" },
      headerClass: "centerHeader",
    },
    {
      headerName: "Amount (Incl. GST)",
      field: "amount_incl_gst",
      minWidth: 180,
      flex: 1,
      valueFormatter: (params: any) => `$${formatWithCommas(params.value)}`,
      cellStyle: { textAlign: "right" },
      headerClass: "centerHeader",
    },
    {
      headerName: "Cost Centre",
      field: "cost_centre",
      minWidth: 180,
      flex: 1,
      editable: true,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: costCentreOptions },
    },
    {
      headerName: "Approval Status",
      field: "approval_status",
      minWidth: 180,
      flex: 1,
      editable: true,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: ["Approved", "Partially Approved", "Hold"] },
    },
    { headerName: "Attachment", field: "attachment", hide: true },
  ], [costCentreOptions]);

  const defaultColDef = useMemo(() => ({
    editable: true,
    resizable: true,
  }), []);

  const getRowId = useCallback((params: any) => {
    return String(params.data.invoice_id || params.data.invoice_number);
  }, []);

  const getRowHeight = useCallback((params: any) => {
    if (params.data?.isHeading) return 40;
    if (params.data?.isTotal) return 30;
    return 30;
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("feasibility_id", feasibilityId);
      if (error) {
        console.error("Error fetching invoices:", error);
      } else if (data) {
        setInvoicesData(data);
      }
    } catch (err) {
      console.error("Unexpected error fetching invoices:", err);
    }
  }, [feasibilityId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    async function loadCostCentres() {
      const { data, error } = await supabase.from("feasibility_line_items").select("cost_category");
      if (error) {
        console.error("Error fetching cost centre options:", error);
        return;
      }
      if (data) {
        const uniqueCentres = Array.from(new Set(data.map((row) => row.cost_category).filter(Boolean)));
        uniqueCentres.sort((a, b) => a.localeCompare(b));
        setCostCentreOptions(uniqueCentres);
      }
    }
    loadCostCentres();
  }, [feasibilityId]);

  async function uploadInvoiceFile(file: File): Promise<string> {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = fileName;
      const { error: uploadError } = await supabase.storage
        .from("invoices")
        .upload(filePath, file);
      if (uploadError) {
        console.error("Error uploading file:", uploadError);
        throw uploadError;
      }
      return filePath;
    } catch (err) {
      console.error("uploadInvoiceFile -> caught error:", err);
      throw err;
    }
  }

  async function handleFilesUploaded(files: File[]) {
    setProcessing(true);
    const newInvoices: any[] = [];
    for (const file of files) {
      console.log("Starting debug for file:", file.name);
      try {
        const debugResult = await debugPdfParsing(file);
        console.log("Debug result:", debugResult);
        
        if (!debugResult.success) {
          console.error("Debug failed for file:", file.name);
          continue;
        }
      } catch (debugErr) {
        console.error("Debug error:", debugErr);
      }
      
      let filePath = "";
      try {
        filePath = await uploadInvoiceFile(file);
      } catch (uploadErr) {
        console.error("handleFilesUploaded -> Upload failed:", uploadErr);
        continue;
      }
      try {
        const invoiceDetails = await parseInvoiceWithGPT(file);
        const safeInvoiceDate = sanitizeDate(invoiceDetails.invoice_date);
        const safeDueDate = sanitizeDate(invoiceDetails.due_date);
        const { data, error: insertError } = await supabase
          .from("invoices")
          .insert([
            {
              invoice_number: invoiceDetails.invoice_number || "",
              invoice_date: safeInvoiceDate,
              supplier: invoiceDetails.supplier || "",
              description: invoiceDetails.description || "",
              amount_excl_gst: invoiceDetails.amount_excl_gst ?? 0,
              gst: invoiceDetails.gst ?? 0,
              amount_incl_gst: invoiceDetails.amount_incl_gst ?? 0,
              due_date: safeDueDate,
              feasibility_id: feasibilityId,
              approval_status: "Hold",
              attachment: filePath,
            },
          ])
          .select();
        if (insertError) {
          console.error("Insertion error:", insertError);
          if (insertError.code === "23505") showDuplicateNotification();
        } else if (data) {
          newInvoices.push(data[0]);
        }
      } catch (parseOrInsertErr) {
        console.error("handleFilesUploaded -> Error processing file:", file.name, parseOrInsertErr);
      }
    }
    if (newInvoices.length > 0) {
      setInvoicesData((prev) => [...prev, ...newInvoices]);
    }
    const invoiceCount = newInvoices.length;
    setDropzoneText(`${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"} processed`);
    setProcessing(false);
    setTimeout(() => {
      setDropzoneText("Drag and drop PDF files here");
    }, 3000);
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFilesUploaded,
    accept: { "application/pdf": [".pdf"] },
  });

  const dynamicMenuText =
    contextMenu.rowIndex !== null && invoicesData[contextMenu.rowIndex]?.cost_centre
      ? `View ${invoicesData[contextMenu.rowIndex].cost_centre}`
      : "Open Management Grid";

  return (
    <div
      className={isDarkMode ? styles.tableContainer : styles.tableContainerWhite}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (contextMenu.mouseX !== null) closeContextMenu();
      }}
      style={{ position: "relative" }}
    >
      {notification && (
        <div
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            backgroundColor: "red",
            color: "white",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            zIndex: 9999,
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          }}
        >
          {notification}
        </div>
      )}

      <style>{`
        .ag-theme-alpine .ag-header,
        .ag-theme-alpine .ag-header-row {
          border-bottom: 0.5px solid var(--gray-400) !important;
        }
        .ag-theme-alpine .ag-header-row {
          border-bottom: none !important;
        }
        .centerHeader .ag-header-cell-label {
          justify-content: center;
        }
      `}</style>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: 200px 0; }
        }
        .shimmer {
          display: inline-block;
          background: linear-gradient(90deg, #999 25%, #f9f9f9 50%, #999 75%);
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          animation: shimmer 4s linear infinite;
        }
      `}</style>

      <div className={`ag-theme-alpine customPerimeterTheme customHeaderTheme redRowBordersTheme ${styles.agGridWrapper}`}>
        <AgGridReact
          domLayout="autoHeight"
          rowData={invoicesData}
          columnDefs={invoicesColDefs}
          defaultColDef={defaultColDef}
          immutableData={true}
          getRowId={getRowId}
          getRowHeight={getRowHeight}
          headerHeight={47}
          rowStyle={{ background: isDarkMode ? "#1f2022" : "white" }}
          onGridReady={(params) => {
            setTimeout(() => {
              params.api.sizeColumnsToFit();
            }, 50);
          }}
          onGridSizeChanged={(params) => {
            params.api.sizeColumnsToFit();
          }}
          onCellKeyDown={handleCellKeyDown}
          onCellValueChanged={handleCellValueChanged}
          animateRows
          onCellContextMenu={handleCellContextMenu}
        />
      </div>

      {contextMenu.mouseX !== null && contextMenu.mouseY !== null &&
        ReactDOM.createPortal(
          <div
            className={styles.popupMenu}
            style={{
              top: contextMenu.mouseY,
              left: contextMenu.mouseX,
              position: "fixed",
            }}
          >
            <div className={styles.menuItem} onClick={handleViewInvoice}>
              View Invoice
            </div>
            <div className={styles.menuItem} onClick={handleGoToManagementGrid}>
              {dynamicMenuText}
            </div>
            <div className={styles.menuItem} onClick={handleAddRowAtTop}>
              Add Row At Top
            </div>
            <div className={styles.menuItem} onClick={handleDeleteRow}>
              Delete Row
            </div>
          </div>,
          document.body
        )
      }

      <div
        {...getRootProps()}
        style={{
          margin: "1rem auto",
          border: "none",
          borderRadius: "24px",
          padding: "30px",
          backgroundColor: isDragActive ? "#f0f0f0" : "#f9f9f9",
          width: "450px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          color: "#999999",
          fontSize: "75%",
        }}
      >
        <input {...getInputProps()} />
        {processing ? (
          <p className="shimmer" style={{ transform: "translateY(0.5rem)" }}>
            Processing Invoices
          </p>
        ) : isDragActive ? (
          <p style={{ transform: "translateY(0.5rem)" }}>Drop PDF files here...</p>
        ) : (
          <p style={{ transform: "translateY(0.5rem)" }}>{dropzoneText}</p>
        )}
      </div>
    </div>
  );
}
