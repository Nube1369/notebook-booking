-- ============================================
--  Create slot_limits table for capacity
--  Run this in: Supabase Dashboard → SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.slot_limits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_date date NOT NULL,
  slot_time text NOT NULL,
  max_capacity integer NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

-- Ensure we can easily upsert by date and time
ALTER TABLE public.slot_limits ADD CONSTRAINT slot_limits_date_time_key UNIQUE (slot_date, slot_time);

-- Allow public read/write (for simple client-side access)
ALTER TABLE public.slot_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read/write slot_limits" ON public.slot_limits FOR ALL USING (true);

-- Reload schema cache just in case
NOTIFY pgrst, 'reload schema';
