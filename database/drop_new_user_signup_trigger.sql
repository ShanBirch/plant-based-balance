-- Drop the bare "new signup" admin push trigger to prevent double notifications.
--
-- Every new signup now goes through assign_coach_shannon_to_user (called
-- when onboarding completes) → coach_clients_onboarding_trigger →
-- onboarding-welcome-draft. That path produces a personalised welcome
-- draft and pushes a single inline-reply notification to the admin's
-- lockscreen, replacing the bare-signup notification this trigger fired.
--
-- Run this in your Supabase SQL Editor.

DROP TRIGGER IF EXISTS trigger_notify_admin_new_signup ON public.users;
DROP FUNCTION IF EXISTS public.trigger_notify_admin_new_signup();
