/**
 * File: client/src/components/costCenters/InvoiceUploadManager.tsx
 * Route: /invoice-upload
 */

import React, { useState } from "react";
import InvoiceUploadModal from "./InvoiceUploadModal";
import { extractTextFromPDF } from "./utils/pdfHelpers";
import { supabase } from "../../supabaseClient";
import { parseInvoiceWithGPT } from "./utils/InvoiceGPT";

// Enhanced component with improved error handling and feedback
const InvoiceUploadManager: React.FC = () => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<{
    status: 'idle' | 'processing' | 'success' | 'error';
    message: string;
    details?: string;
  }>({
    status: 'idle',
    message: ''
  });

  const handleFilesUploaded = async (files: File[]) => {
    console.log("Files uploaded:", files);
    setProcessingStatus({
      status: 'processing',
      message: `Processing ${files.length} invoice(s)...`
    });
    
    for (const file of files) {
      try {
        console.log("Starting PDF extraction for:", file.name);
        const pdfText = await extractTextFromPDF(file);
        console.log("Extracted PDF text for", file.name, ":", pdfText.substring(0, 100) + "...");
        
        if (!pdfText || pdfText.trim().length === 0) {
          throw new Error("No text could be extracted from the PDF");
        }

        console.log("Calling parseInvoiceWithGPT for", file.name);
        try {
          // Call OpenAI to extract invoice details
          const invoiceDetails = await parseInvoiceWithGPT(file);
          console.log("Invoice details extracted:", invoiceDetails);
          
          // Store in Supabase if invoice details were successfully extracted
          if (invoiceDetails) {
            console.log("Storing invoice in Supabase:", invoiceDetails);
            try {
              const { data, error } = await supabase
                .from('invoices')
                .insert([
                  {
                    invoice_number: invoiceDetails.invoice_number,
                    invoice_date: invoiceDetails.invoice_date,
                    supplier: invoiceDetails.supplier,
                    description: invoiceDetails.description,
                    amount_excl_gst: invoiceDetails.amount_excl_gst,
                    gst: invoiceDetails.gst,
                    amount_incl_gst: invoiceDetails.amount_incl_gst,
                    due_date: invoiceDetails.due_date,
                    processed_at: new Date().toISOString()
                  }
                ]);
                
              if (error) {
                console.error("Supabase error storing invoice:", error);
                throw new Error(`Database error: ${error.message}`);
              }
              
              console.log("Invoice stored successfully:", data);
              setProcessingStatus({
                status: 'success',
                message: `Successfully processed invoice ${invoiceDetails.invoice_number}`
              });
            } catch (supabaseError) {
              console.error("Error storing invoice in database:", supabaseError);
              setProcessingStatus({
                status: 'error',
                message: "Failed to store invoice in database",
                details: supabaseError instanceof Error ? supabaseError.message : String(supabaseError)
              });
            }
          }
        } catch (openaiError) {
          console.error("Error processing invoice with OpenAI:", openaiError);
          setProcessingStatus({
            status: 'error',
            message: "Failed to process invoice with AI",
            details: openaiError instanceof Error ? openaiError.message : String(openaiError)
          });
          
          // Check for network connectivity issues
          if (openaiError instanceof Error && 
            (openaiError.message.includes("Failed to fetch") || 
             openaiError.message.includes("NetworkError"))) {
            
            console.error("Network error detected. Checking server status...");
            
            // Try to reach the server health endpoint
            try {
              const healthResponse = await fetch("http://localhost:5001/health");
              if (healthResponse.ok) {
                const healthData = await healthResponse.json();
                console.log("Server health status:", healthData);
              } else {
                console.error("Server health endpoint returned error:", healthResponse.status);
              }
            } catch (healthError) {
              console.error("Server health check failed:", healthError);
              console.log("Server might not be running on port 5001");
            }
          }
        }

      } catch (error) {
        console.error("Error processing file:", file.name, error);
        setProcessingStatus({
          status: 'error',
          message: `Error processing file: ${file.name}`,
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    setIsUploadModalOpen(false);
  };

  return (
    <div className="invoice-upload-container">
      <button 
        className="invoice-upload-button"
        onClick={() => setIsUploadModalOpen(true)}
      >
        Upload Invoices
      </button>
      
      {processingStatus.status !== 'idle' && (
        <div className={`status-message ${processingStatus.status}`}>
          <p>{processingStatus.message}</p>
          {processingStatus.details && (
            <p className="error-details">{processingStatus.details}</p>
          )}
        </div>
      )}
      
      <InvoiceUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onFilesUploaded={handleFilesUploaded}
      />
    </div>
  );
};

export default InvoiceUploadManager;
