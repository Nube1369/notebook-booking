-- ============================================
--  ADD TIMESTAMPS FOR TRACKING PROCESSES
--  Run this in: Supabase Dashboard → SQL Editor
-- ============================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
