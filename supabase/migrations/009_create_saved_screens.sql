-- Create saved_screens table
CREATE TABLE IF NOT EXISTS public.saved_screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Turn on RLS
ALTER TABLE public.saved_screens ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own saved screens"
    ON public.saved_screens
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved screens"
    ON public.saved_screens
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved screens"
    ON public.saved_screens
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved screens"
    ON public.saved_screens
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_saved_screens_updated
  BEFORE UPDATE ON public.saved_screens
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Indices to optimize fetches
CREATE INDEX IF NOT EXISTS saved_screens_user_id_idx ON public.saved_screens(user_id);
