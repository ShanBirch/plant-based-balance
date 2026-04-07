-- Enable Supabase Realtime for the nudges table
-- This is REQUIRED for the postgres_changes subscription in dashboard.html
-- (subscribeToCoachMessages) to receive events when new DMs are inserted.
--
-- Without this, the Realtime channel connects but never fires callbacks,
-- which means in-app notification banners, sounds, and badges never trigger.
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query).

ALTER PUBLICATION supabase_realtime ADD TABLE public.nudges;
