-- alerts-migrations.sql
-- Create the alert_settings table
CREATE TABLE IF NOT EXISTS public.alert_settings (
    user_email TEXT PRIMARY KEY,
    gap_increase BOOLEAN DEFAULT true,
    volume_spike BOOLEAN DEFAULT true,
    new_opportunity BOOLEAN DEFAULT true,
    coverage_change BOOLEAN DEFAULT true,
    price_movement BOOLEAN DEFAULT false,
    email_notifications BOOLEAN DEFAULT true,
    gap_threshold INTEGER DEFAULT 5,
    volume_threshold INTEGER DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: We assume RLS or secure policies are enforced if needed. 
-- Right now, we will allow standard access for simplicity, or you can add policies like:
-- ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;

-- Create the alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    ticker TEXT NOT NULL,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by user and unread status
CREATE INDEX IF NOT EXISTS idx_alerts_user_email ON public.alerts(user_email);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON public.alerts(user_email) WHERE read = false;
