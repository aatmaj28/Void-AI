-- Modify saved_screens table to use user_email instead of auth.users since auth is mock
ALTER TABLE public.saved_screens DROP CONSTRAINT IF EXISTS saved_screens_user_id_fkey;
ALTER TABLE public.saved_screens ADD COLUMN IF NOT EXISTS user_email TEXT NOT NULL DEFAULT 'mock@example.com';

-- Use CASCADE to automatically drop the RLS policies that depend on user_id
ALTER TABLE public.saved_screens DROP COLUMN IF EXISTS user_id CASCADE;

-- Drop required old RLS policies since we're using anon key + server actions manually
ALTER TABLE public.saved_screens DISABLE ROW LEVEL SECURITY;
