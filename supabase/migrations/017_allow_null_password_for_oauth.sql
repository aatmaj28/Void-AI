-- Allow NULL password for OAuth users (Google sign-in)
ALTER TABLE public.users ALTER COLUMN password DROP NOT NULL;
