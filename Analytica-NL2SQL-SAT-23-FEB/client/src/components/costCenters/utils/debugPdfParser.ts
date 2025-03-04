// Debug script for PDF parsing issues
import { extractTextFromPDF } from "./pdfHelpers";

/**
 * Debug function to test PDF parsing
 * This can be called from the browser console to test PDF parsing
 */
export async function debugPdfParsing(file: File) {
  console.log("=== DEBUG PDF PARSING ===");
  console.log("File:", file.name, file.type, file.size);
  
  try {
    // Test file reading
    console.log("Testing file reading...");
    const arrayBuffer = await file.arrayBuffer();
    console.log("File read successfully, size:", arrayBuffer.byteLength);
    
    // Test PDF.js worker
    console.log("Testing PDF.js worker...");
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
    console.log("PDF.js worker URL:", pdfjsLib.GlobalWorkerOptions.workerSrc);
    
    // Test full extraction
    console.log("Testing full text extraction...");
    const startTime = performance.now();
    const text = await extractTextFromPDF(file);
    const endTime = performance.now();
    
    console.log(`Extraction completed in ${(endTime - startTime).toFixed(2)}ms`);
    console.log("Extracted text length:", text.length);
    console.log("First 200 chars:", text.substring(0, 200));
    
    return {
      success: true,
      text,
      executionTime: endTime - startTime
    };
  } catch (error) {
    console.error("PDF parsing debug error:", error);
    return {
      success: false,
      error
    };
  }
}

// Make it available globally for console debugging
(window as any).debugPdfParsing = debugPdfParsing; 