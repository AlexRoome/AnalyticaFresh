import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service role key
const supabase = createClient(supabaseUrl, supabaseKey);

export async function getSchema(req, res) {
  try {
    // Call the custom Postgres function to fetch the public schema
    const { data, error } = await supabase.rpc('fetch_public_schema');
    if (error) {
      console.error("Error fetching schema:", error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error("Unhandled error fetching schema:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
