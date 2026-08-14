-- เพิ่มคอลัมน์ old_st และ new_st ในตาราง bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS old_st text,
ADD COLUMN IF NOT EXISTS new_st text;

-- เพิ่มคอลัมน์ old_st และ new_st ในตาราง bookings_aaif (ถ้าใช้งาน)
ALTER TABLE public.bookings_aaif 
ADD COLUMN IF NOT EXISTS old_st text,
ADD COLUMN IF NOT EXISTS new_st text;
