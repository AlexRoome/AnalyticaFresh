import { supabase } from './supabaseClient';

async function saveNote() {
  try {
    // Option 1: Save directly to an existing table
    // Try saving to the gantt table which we know exists
    const { data, error } = await supabase
      .from('gantt')
      .insert([
        { 
          task_name: 'DROPDOWN WORKING MANAGEMENT COSTS AR',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          duration: 1,
          notes: 'Programme column in table 2 of management costs page now uses a dropdown with gantt programme items'
        }
      ]);
    
    if (error) {
      console.error('Error saving to gantt table:', error);
      
      // Option 2: Try saving as custom SQL through RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('run_sql_query', {
        sql_query: `
          INSERT INTO public.feasibility_notes (note_title, note_content, created_at)
          VALUES (
            'DROPDOWN WORKING MANAGEMENT COSTS AR', 
            'Programme column in table 2 of management costs page now uses a dropdown with gantt programme items',
            NOW()
          )
          ON CONFLICT DO NOTHING;
        `
      });
      
      if (rpcError) {
        console.error('Error running SQL query:', rpcError);
      } else {
        console.log('Note saved through SQL query:', rpcData);
      }
    } else {
      console.log('Note saved to gantt table:', data);
    }
  } catch (err) {
    console.error('Exception saving note:', err);
  }
}

saveNote(); 