-- Migration to record the dropdown implementation in management costs
-- Author: AR
-- Date: 2025-03-02

-- Create a notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.development_notes (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  developer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert the note about the dropdown implementation
INSERT INTO public.development_notes (title, description, developer, created_at)
VALUES (
  'DROPDOWN WORKING MANAGEMENT COSTS AR',
  'Programme column in table 2 of management costs page now uses a dropdown with gantt programme items',
  'AR',
  NOW()
);

-- Grant permissions
ALTER TABLE public.development_notes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.development_notes TO authenticated;
GRANT ALL ON public.development_notes TO service_role;

-- Create a policy for viewing notes
CREATE POLICY "Anyone can view notes" 
ON public.development_notes
FOR SELECT USING (true);

-- Create a policy for inserting notes
CREATE POLICY "Authenticated users can add notes" 
ON public.development_notes
FOR INSERT WITH CHECK (auth.role() = 'authenticated'); 