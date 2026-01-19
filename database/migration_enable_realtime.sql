-- Migration: Enable Supabase Realtime on conversations table
-- This allows clients to subscribe to INSERT/UPDATE/DELETE events
-- Required for instant coach message delivery to users

-- Enable Realtime on the conversations table
-- Note: This adds the table to the supabase_realtime publication
-- which allows clients to subscribe to changes via WebSockets

-- Check if the publication exists and add the table
-- Supabase automatically creates the 'supabase_realtime' publication

-- First, ensure the table is in the realtime publication
DO $$
BEGIN
    -- Check if conversations is already in the publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'conversations'
    ) THEN
        -- Add conversations table to realtime publication
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
        RAISE NOTICE 'Added conversations table to supabase_realtime publication';
    ELSE
        RAISE NOTICE 'conversations table already in supabase_realtime publication';
    END IF;
END $$;

-- Alternative method (if the above doesn't work, use the Supabase Dashboard):
-- 1. Go to Supabase Dashboard
-- 2. Navigate to Database > Replication
-- 3. Find 'supabase_realtime' publication
-- 4. Click on it and add the 'conversations' table
-- 5. Enable INSERT events (at minimum)

-- Grant necessary permissions for realtime to work
GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.conversations TO anon;

-- Verify the setup
SELECT
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
