// supabase/functions/process-invoice/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts"; // Edge Runtime definitions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Retrieve environment variables from Supabase Edge Function environment
// (These should be set via `supabase secrets set` or in your project settings)
const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_ANON_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// Initialize the Supabase client (using the anon key — ensure your RLS policies allow inserts)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("process-invoice function initialized.");

Deno.serve(async (req) => {
  try {
    // 1. Parse the incoming JSON body, expecting { pdfText: "..."}
    const { pdfText } = await req.json();
    if (!pdfText) {
      return new Response(
        JSON.stringify({ status: "error", message: "Missing pdfText in request" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Build the chat messages for OpenAI
    const messages = [
      {
        role: "system",
        content: `You are a helpful assistant that extracts invoice details from text.
          Extract the following details:
          - Invoice Date
          - Invoice Number
          - Supplier
          - Description
          - Amount (Excl. GST)
          - GST
          - Amount (Incl. GST)
          - Cost Centre
          - Stage
          - Due Date
          - Payment Status

          Return the result as valid JSON.`,
      },
      {
        role: "user",
        content: pdfText,
      },
    ];

    // 3. Call the OpenAI Chat Completions endpoint
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o", // Or adjust if you use a different model
        messages,
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!openAiResponse.ok) {
      const errorData = await openAiResponse.json();
      return new Response(
        JSON.stringify({ status: "error", message: "OpenAI API error", details: errorData }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const openAiData = await openAiResponse.json();

    // 4. Parse the assistant's JSON reply
    let invoiceDetails;
    try {
      invoiceDetails = JSON.parse(openAiData.choices[0].message.content);
    } catch (error) {
      return new Response(
        JSON.stringify({ status: "error", message: "Failed to parse OpenAI response", details: openAiData }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. Insert the extracted invoice data into the "invoices" table
    const { data, error } = await supabase.from("invoices").insert([
      {
        invoice_date: invoiceDetails.invoice_date,
        invoice_number: invoiceDetails.invoice_number,
        supplier: invoiceDetails.supplier,
        description: invoiceDetails.description,
        amount_excl_gst: parseFloat(invoiceDetails.amount_excl_gst),
        gst: parseFloat(invoiceDetails.gst),
        amount_incl_gst: parseFloat(invoiceDetails.amount_incl_gst),
        cost_centre: invoiceDetails.cost_centre,
        stage: invoiceDetails.stage,
        due_date: invoiceDetails.due_date,
        payment_status: invoiceDetails.payment_status,
        attachment: invoiceDetails.attachment || null,
      },
    ]);

    if (error) {
      return new Response(
        JSON.stringify({ status: "error", message: "Failed to insert data into Supabase", details: error }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 6. Return success
    return new Response(
      JSON.stringify({
        status: "success",
        assistant_reply: "Invoice processed and stored successfully.",
        invoice_data: invoiceDetails,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ status: "error", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
