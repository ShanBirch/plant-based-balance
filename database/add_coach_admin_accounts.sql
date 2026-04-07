-- Add both of Shannon's accounts as admin/coach users
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Add shannon@plantbased-balance.org as admin (if account exists and not already admin)
INSERT INTO public.admin_users (user_id, role, permissions)
SELECT au.id, 'admin', '["view_users", "view_conversations", "view_analytics", "approve_responses"]'::jsonb
FROM auth.users au
WHERE au.email = 'shannon@plantbased-balance.org'
AND NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = au.id
);

-- Add shannonbirch@cocospersonaltraining.com as admin (if account exists and not already admin)
INSERT INTO public.admin_users (user_id, role, permissions)
SELECT au.id, 'admin', '["view_users", "view_conversations", "view_analytics", "approve_responses"]'::jsonb
FROM auth.users au
WHERE au.email = 'shannonbirch@cocospersonaltraining.com'
AND NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = au.id
);
