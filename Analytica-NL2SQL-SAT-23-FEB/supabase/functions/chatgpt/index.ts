import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.3.0";
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";

serve(async (req) => {
  try {
    // 1) Parse the incoming JSON body
    const body = await req.json();
    const { action } = body;

    // 2) Read environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAiKey = Deno.env.get("OPENAI_KEY");

    // Make sure all are present
    if (!supabaseUrl || !supabaseServiceKey || !openAiKey) {
      throw new Error("Missing environment variables in Edge Function.");
    }

    // 3) Create clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAIApi(new Configuration({ apiKey: openAiKey }));

    let responseData: any = {};

    // 4) Switch logic based on 'action'
    switch (action) {
      case "update_vector_store":
        responseData = await handleUpdateVectorStore(body, supabase, openai);
        break;

      // You can add other actions later (like "ask_assistant", "create_assistant", etc.)
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // 5) Return success
    return new Response(JSON.stringify({ status: "success", ...responseData }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ status: "error", message: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * Handle "update_vector_store"
 *  - Reads `combinedData` from request body
 *  - Embeds each item with OpenAI
 *  - Inserts rows into `documents` table
 */
async function handleUpdateVectorStore(body: any, supabase: any, openai: any) {
  const { combinedData } = body;

  // 1) Create a unique vector_store_id (or pass in from body)
  const vector_store_id = crypto.randomUUID();

  // 2) For each item, embed + insert into DB
  for (const item of combinedData) {
    // If your item is an object, convert to JSON string. Otherwise, assume it's already string.
    const content = typeof item === "string" ? item : JSON.stringify(item);

    // a) Create an embedding
    const embeddingRes = await openai.createEmbedding({
      model: "text-embedding-ada-002",
      input: content,
    });
    const [{ embedding }] = embeddingRes.data.data;

    // b) Insert into the documents table
    const { error } = await supabase.from("documents").insert({
      content,
      embedding,
      vector_store_id,
    });

    if (error) {
      throw new Error(`Error inserting document: ${error.message}`);
    }
  }

  // 3) Return the new vector_store_id
  return { vector_store_id };
}
