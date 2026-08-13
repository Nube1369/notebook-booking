-- ============================================
--  CREATE AAIF TABLES
--  (Same structure as GFCA bookings & slot_limits)
-- ============================================

-- 1) Bookings table for AAIF
CREATE TABLE IF NOT EXISTS bookings_aaif (
  id BIGSERIAL PRIMARY KEY,
  ref_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  machine_code TEXT NOT NULL,
  printer_floors TEXT[] DEFAULT '{}',
  backup_items TEXT[] DEFAULT '{}',
  backup_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  appointment_date TEXT,
  appointment_time TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- 2) Slot Limits table for AAIF
CREATE TABLE IF NOT EXISTS slot_limits_aaif (
  id BIGSERIAL PRIMARY KEY,
  slot_date TEXT NOT NULL,
  slot_time TEXT NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 8,
  UNIQUE(slot_date, slot_time)
);

-- 3) Enable RLS (Row Level Security)
ALTER TABLE bookings_aaif ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_limits_aaif ENABLE ROW LEVEL SECURITY;

-- 4) RLS Policies — Allow anon full access (same as GFCA)
-- bookings_aaif
CREATE POLICY "Allow anon select bookings_aaif" ON bookings_aaif
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert bookings_aaif" ON bookings_aaif
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update bookings_aaif" ON bookings_aaif
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete bookings_aaif" ON bookings_aaif
  FOR DELETE TO anon USING (true);

-- slot_limits_aaif
CREATE POLICY "Allow anon select slot_limits_aaif" ON slot_limits_aaif
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert slot_limits_aaif" ON slot_limits_aaif
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update slot_limits_aaif" ON slot_limits_aaif
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete slot_limits_aaif" ON slot_limits_aaif
  FOR DELETE TO anon USING (true);

-- Done! Now run this in Supabase SQL Editor.
