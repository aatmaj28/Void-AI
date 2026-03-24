-- Create watchlists table
CREATE TABLE watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  name TEXT NOT NULL,
  is_general BOOLEAN DEFAULT false,
  stocks TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Note: We disable RLS on this table for the mock user setup, mirroring saved_screens patch
ALTER TABLE watchlists DISABLE ROW LEVEL SECURITY;

-- Optional: Add index on user_email for faster fetch
CREATE INDEX idx_watchlists_user_email ON watchlists(user_email);
