// client/src/components/costCenters/utils/pdfHelpers.ts

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { performOCR } from "./ocrHelpers";

// Use the matching worker for pdfjs-dist@2.14.305
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.min.js";

// Add console log to verify worker URL
console.log("PDF.js worker URL set to:", pdfjsLib.GlobalWorkerOptions.workerSrc);

/**
 * Extracts text from a PDF. If a page has no text layer, we render it to a canvas
 * and run Tesseract OCR, then combine both results into a single string.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  console.log("extractTextFromPDF called for:", file.name);
  try {
    if (file.type !== "application/pdf") {
      console.warn(`"${file.name}" is not a PDF (type: ${file.type}). Attempting parse anyway.`);
    }

    // Convert the file to an ArrayBuffer for pdf.js
    console.log("Reading file as ArrayBuffer...");
    const arrayBuffer = await file.arrayBuffer();
    console.log("File read as ArrayBuffer, size:", arrayBuffer.byteLength);
    
    console.log("Creating PDF.js document...");
    // Use a Uint8Array to wrap the ArrayBuffer for pdf.js
    const uint8Array = new Uint8Array(arrayBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    
    console.log("Waiting for PDF.js promise...");
    const pdfDocument = await loadingTask.promise;

    console.log(`PDF loaded: ${file.name} (pages: ${pdfDocument.numPages})`);

    let fullText = "";

    // Create a temporary <canvas> for rendering pages
    console.log("Creating canvas for rendering...");
    const tempCanvas = document.createElement("canvas");
    const canvasContext = tempCanvas.getContext("2d");
    
    if (!canvasContext) {
      throw new Error("Failed to get 2D context from canvas");
    }

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      try {
        console.log(`Processing page ${pageNum}...`);
        const page = await pdfDocument.getPage(pageNum);
        console.log(`Got page ${pageNum}, getting text content...`);
        const textContent = await page.getTextContent();

        if (textContent.items.length > 0) {
          // pdf.js found a text layer, so let's use it
          console.log(`Page ${pageNum} has text layer with ${textContent.items.length} items`);
          const pageText = textContent.items
            .map((item: any) => item.str || "")
            .join(" ");
          fullText += pageText + "\n";
        } else {
          // No text layer => fallback to OCR
          console.log(`Page ${pageNum} has no text layer. Using OCR...`);

          // Render the page onto our temp <canvas>
          const viewport = page.getViewport({ scale: 1.5 }); // Adjust scale as needed
          tempCanvas.width = viewport.width;
          tempCanvas.height = viewport.height;

          console.log(`Rendering page ${pageNum} to canvas (${viewport.width}x${viewport.height})...`);
          const renderContext = { canvasContext, viewport };
          await page.render(renderContext).promise;
          console.log(`Page ${pageNum} rendered to canvas`);

          // Convert canvas to a Blob (PNG) for Tesseract
          console.log(`Converting canvas to blob for OCR...`);
          const blob = await new Promise<Blob | null>((resolve) => {
            tempCanvas.toBlob((b) => resolve(b), "image/png");
          });
          if (!blob) {
            console.error("Failed to create canvas blob for OCR.");
            continue;
          }
          console.log(`Canvas converted to blob, size: ${blob.size} bytes`);

          // Perform OCR
          console.log(`Starting OCR for page ${pageNum}...`);
          const ocrText = await performOCR(blob);
          console.log(`OCR completed for page ${pageNum}`);

          // Debug log to see exactly what Tesseract recognized
          console.log(`OCR raw text for page ${pageNum}:`, ocrText);

          fullText += ocrText + "\n";
        }
      } catch (pageError) {
        console.error(`Error reading page ${pageNum} of "${file.name}":`, pageError);
      }
    }

    console.log(`PDF extraction complete for ${file.name}, text length: ${fullText.length}`);
    return fullText;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return "";
  }
}
