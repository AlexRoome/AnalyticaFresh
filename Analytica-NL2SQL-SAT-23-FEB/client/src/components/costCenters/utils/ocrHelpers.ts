// client/src/components/costCenters/utils/ocrHelpers.ts
import Tesseract from "tesseract.js";

// Try to log Tesseract version if available
try {
  console.log("Tesseract.js loaded");
} catch (e) {
  console.error("Error accessing Tesseract:", e);
}

/**
 * Optionally convert a source image Blob to grayscale to improve OCR on colored backgrounds.
 * @param srcBlob The original PNG/JPEG blob to grayscale.
 * @returns A Promise resolving to a new grayscale Blob (PNG).
 */
async function convertToGrayscale(srcBlob: Blob): Promise<Blob> {
  console.log("convertToGrayscale called with blob size:", srcBlob.size);
  return new Promise<Blob>((resolve) => {
    const img = new Image();
    img.onload = () => {
      console.log("Image loaded for grayscale conversion, dimensions:", img.width, "x", img.height);
      // Create an offscreen canvas
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Failed to get 2D context for grayscale conversion.");
        resolve(srcBlob);
        return;
      }

      // Draw the source image
      ctx.drawImage(img, 0, 0);
      console.log("Image drawn to canvas");

      // Get image data and manually convert to grayscale
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data; // [r, g, b, a, r, g, b, a, ...]
      console.log("Processing image data for grayscale, total pixels:", data.length / 4);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Simple average or a better formula like .299r + .587g + .114b
        const gray = (r + g + b) / 3;
        data[i] = data[i + 1] = data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
      console.log("Grayscale conversion complete");

      // Convert final canvas back to blob
      canvas.toBlob((blob) => {
        if (blob) {
          console.log("Grayscale blob created, size:", blob.size);
          resolve(blob);
        } else {
          console.error("Failed to create grayscale blob. Returning original.");
          resolve(srcBlob);
        }
      }, "image/png");
    };
    img.onerror = (err) => {
      console.error("Grayscale image load error:", err);
      resolve(srcBlob); // fallback to original
    };
    console.log("Setting image source from blob...");
    img.src = URL.createObjectURL(srcBlob);
  });
}

/**
 * Perform OCR on a PNG/JPG Blob or File,
 * using Tesseract with a recommended page segmentation mode.
 *
 * - Converts the image to grayscale to help remove colored backgrounds
 * - By default uses English. Adjust if needed.
 */
export async function performOCR(fileOrBlob: File | Blob): Promise<string> {
  console.log("performOCR called with:", fileOrBlob instanceof File ? "File" : "Blob");
  try {
    // Optionally convert to grayscale first:
    console.log("Converting to grayscale...");
    const grayscaleBlob = await convertToGrayscale(fileOrBlob);
    console.log("Grayscale conversion complete, blob size:", grayscaleBlob.size);

    // Now feed Tesseract
    console.log("Starting Tesseract recognition...");
    const { data } = await Tesseract.recognize(grayscaleBlob, "eng", {
      // Use standard Tesseract options
      logger: (m) => console.log("[Tesseract]:", m),
    });
    console.log("Tesseract recognition complete");

    if (!data.text) {
      console.warn("Tesseract returned empty text");
    } else {
      console.log("Tesseract text length:", data.text.length);
    }

    return data.text || "";
  } catch (error) {
    console.error("OCR error:", error);
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return "";
  }
}
