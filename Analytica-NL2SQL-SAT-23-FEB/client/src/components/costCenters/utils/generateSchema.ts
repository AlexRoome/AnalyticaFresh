// client/src/components/costCenters/utils/generateSchema.ts

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use your service role key
if (!supabaseUrl || !supabaseKey) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateSchema() {
  // Query the public schema's columns from the information_schema.
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('*')
    .eq('table_schema', 'public');

  if (error) {
    console.error('Error fetching schema:', error);
    process.exit(1);
  }

  // Organize the schema by table name.
  const schema: Record<string, any[]> = {};
  data.forEach((col: any) => {
    const tableName = col.table_name;
    if (!schema[tableName]) {
      schema[tableName] = [];
    }
    schema[tableName].push({
      column_name: col.column_name,
      data_type: col.data_type,
      is_nullable: col.is_nullable,
      column_default: col.column_default,
    });
  });

  fs.writeFileSync('schema.json', JSON.stringify(schema, null, 2));
  console.log('Schema file generated successfully at schema.json.');
}

generateSchema();
