import { extractTextFromPDF } from "./pdfHelpers";

// Define the API URL - using relative URL by default
// const API_URL = "http://localhost:5001/api/openai";
const API_URL = "/api/openai"; // Use relative path to avoid CORS issues

// Add advanced error logging function
function logNetworkError(error: any, context: string) {
  console.error(`==== NETWORK ERROR in ${context} ====`);
  console.error(`Error type: ${error.name}`);
  console.error(`Error message: ${error.message}`);
  console.error(`Error stack: ${error.stack}`);
  
  // Check if server is running
  console.log("Troubleshooting steps:");
  console.log("1. Ensure the server is running on port 5001");
  console.log("2. Check if VITE_OPENAI_API_KEY is set in .env file");
  console.log("3. Verify network connectivity to OpenAI API");
  console.log("4. Inspect browser network tab for CORS issues");
  
  // Try to ping the server to see if it's reachable
  fetch("http://localhost:5001/health", { method: "GET" })
    .then(response => {
      console.log("Server health check status:", response.status);
      return response.text();
    })
    .then(text => console.log("Server response:", text))
    .catch(err => console.error("Server unreachable:", err.message));
}

/**
 * parseInvoiceWithGPT:
 * - Extracts text from a PDF file
 * - Calls your local /api/openai endpoint to parse invoice details
 * - Returns the JSON invoice details or throws an error
 */
export async function parseInvoiceWithGPT(file: File) {
  console.log("Starting PDF extraction for:", file.name);
  try {
    const pdfText = await extractTextFromPDF(file);
    console.log("PDF text extracted, length:", pdfText.length);
    
    if (!pdfText || pdfText.trim().length === 0) {
      console.error("No text extracted from PDF");
      throw new Error("No text could be extracted from the PDF");
    }
    
    console.log("First 200 chars of extracted text:", pdfText.substring(0, 200));
    
    // Call your local /api/openai endpoint
    console.log("Calling OpenAI API at:", API_URL);
    try {
      // Log request details for debugging
      console.log("Request payload:", {
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a helpful invoice parser." },
          {
            role: "user",
            content: `Extract invoice details:\n${pdfText.substring(0, 100)}... (${pdfText.length} chars)`,
          },
        ],
        function_call: "auto"
      });
      
      const openAiResponse = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o", // or whichever model you use
          messages: [
            { role: "system", content: "You are a helpful invoice parser." },
            {
              role: "user",
              content: `Extract invoice details:\n${pdfText}\nReturn valid JSON. Omit cost_centre/stage if uncertain.`,
            },
          ],
          functions: [
            {
              name: "extract_invoice_details",
              description: "Extract structured invoice details",
              parameters: {
                type: "object",
                properties: {
                  invoice_number: { type: "string" },
                  invoice_date: { type: "string" },
                  supplier: { type: "string" },
                  description: { type: "string" },
                  amount_excl_gst: { type: "number" },
                  gst: { type: "number" },
                  amount_incl_gst: { type: "number" },
                  due_date: { type: "string" },
                },
                required: [
                  "invoice_number",
                  "invoice_date",
                  "supplier",
                  "description",
                  "amount_excl_gst",
                  "gst",
                  "amount_incl_gst",
                  "due_date",
                ],
              },
            },
          ],
          function_call: "auto",
        }),
      });
      
      if (!openAiResponse.ok) {
        const errorText = await openAiResponse.text();
        console.error("OpenAI API error:", openAiResponse.status, errorText);
        console.error("Response headers:", Object.fromEntries([...openAiResponse.headers.entries()]));
        throw new Error(`OpenAI API error: ${openAiResponse.status} ${errorText}`);
      }

      console.log("OpenAI API response received");
      const openAiJson = await openAiResponse.json();
      console.log("OpenAI API response parsed");
      
      const message = openAiJson.choices?.[0]?.message;
      if (!message) {
        console.error("No message in OpenAI response:", openAiJson);
        throw new Error("Invalid response from OpenAI API");
      }

      let invoiceDetails: any;
      
      // Handle function call response
      if (message.function_call) {
        console.log("Function call detected in response");
        try {
          const functionArgs = JSON.parse(message.function_call.arguments);
          console.log("Function arguments parsed:", functionArgs);
          invoiceDetails = functionArgs;
        } catch (parseError) {
          console.error("Error parsing function arguments:", parseError);
          console.error("Raw arguments:", message.function_call.arguments);
          throw new Error("Failed to parse invoice details from OpenAI response");
        }
      } 
      // Handle direct content response
      else if (message.content) {
        console.log("Content detected in response");
        try {
          // Try to extract JSON from the content
          const jsonMatch = message.content.match(/```json\n([\s\S]*?)\n```/) || 
                          message.content.match(/```\n([\s\S]*?)\n```/) ||
                          message.content.match(/{[\s\S]*?}/);
                          
          const jsonString = jsonMatch ? jsonMatch[0] : message.content;
          console.log("Extracted JSON string:", jsonString);
          
          invoiceDetails = JSON.parse(jsonString);
          console.log("JSON parsed from content");
        } catch (parseError) {
          console.error("Error parsing content as JSON:", parseError);
          console.error("Raw content:", message.content);
          throw new Error("Failed to parse invoice details from OpenAI response");
        }
      } else {
        console.error("No usable data in OpenAI response:", message);
        throw new Error("No usable data in OpenAI response");
      }
      
      console.log("Invoice details extracted:", invoiceDetails);
      return invoiceDetails;
    } catch (fetchError) {
      console.error("Fetch error when calling OpenAI API:", fetchError);
      logNetworkError(fetchError, "OpenAI API fetch");
      
      // If we get a network error, try with a different URL format
      if (fetchError instanceof Error && 
          (fetchError.message.includes("Failed to fetch") || fetchError.message.includes("NetworkError"))) {
        console.log("Trying with alternative URL as fallback...");
        const alternativeUrl = API_URL.includes("localhost") 
          ? "/api/openai"  // If current is absolute, try relative
          : "http://localhost:5001/api/openai"; // If current is relative, try absolute
        console.log("Retrying with alternative URL:", alternativeUrl);
        
        // This is a simplified retry - in a real app, you'd want to refactor to avoid code duplication
        try {
          const retryResponse = await fetch(alternativeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                { role: "system", content: "You are a helpful invoice parser." },
                {
                  role: "user",
                  content: `Extract invoice details:\n${pdfText}\nReturn valid JSON. Omit cost_centre/stage if uncertain.`,
                },
              ],
              functions: [
                {
                  name: "extract_invoice_details",
                  description: "Extract structured invoice details",
                  parameters: {
                    type: "object",
                    properties: {
                      invoice_number: { type: "string" },
                      invoice_date: { type: "string" },
                      supplier: { type: "string" },
                      description: { type: "string" },
                      amount_excl_gst: { type: "number" },
                      gst: { type: "number" },
                      amount_incl_gst: { type: "number" },
                      due_date: { type: "string" },
                    },
                    required: [
                      "invoice_number",
                      "invoice_date",
                      "supplier",
                      "description",
                      "amount_excl_gst",
                      "gst",
                      "amount_incl_gst",
                      "due_date",
                    ],
                  },
                },
              ],
              function_call: "auto",
            }),
          });
          
          console.log("Retry response status:", retryResponse.status);
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text();
            console.error("Retry failed with status:", retryResponse.status, retryErrorText);
            throw new Error(`Retry failed: ${retryResponse.status} - ${retryErrorText}`);
          }
          
          const retryJson = await retryResponse.json();
          const retryMessage = retryJson.choices?.[0]?.message;
          
          if (retryMessage?.function_call?.arguments) {
            return JSON.parse(retryMessage.function_call.arguments);
          } else if (retryMessage?.content) {
            return JSON.parse(retryMessage.content);
          }
        } catch (retryError) {
          console.error("Error in retry:", retryError);
          throw retryError;
        }
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error("Error in parseInvoiceWithGPT:", error);
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw error;
  }
}
