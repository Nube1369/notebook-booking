-- ============================================
--  FIX: Add 'delivered' status to constraint
--  Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- Drop old constraint and add new one with 'delivered'
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check 
  CHECK (status IN ('pending', 'in_progress', 'completed', 'scheduled', 'delivered', 'cancelled'));

-- Verify
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.bookings'::regclass AND contype = 'c';
