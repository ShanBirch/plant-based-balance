-- Multi-Coach Client Management Migration
-- Enables multiple coaches to manage their own clients independently.
-- Each coach only sees alerts/data for their assigned clients.
-- Super admins (like Shannon) can see everything.

-- ============================================================
-- 1. COACH_CLIENTS TABLE — assigns clients to coaches
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coach_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The coach (must be an admin user)
    coach_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- The client
    client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Relationship status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),

    -- Optional notes
    notes TEXT,

    -- Timestamps
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,

    -- A client can only be assigned to one coach at a time
    UNIQUE(client_id, coach_id),

    -- Can't coach yourself
    CHECK (coach_id != client_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coach_clients_coach ON public.coach_clients(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_clients_client ON public.coach_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_coach_clients_status ON public.coach_clients(status);

-- RLS
ALTER TABLE public.coach_clients ENABLE ROW LEVEL SECURITY;

-- Coaches can see their own client assignments
CREATE POLICY "Coaches can view their clients"
    ON public.coach_clients FOR SELECT
    USING (
        coach_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role = 'super_admin')
    );

-- Only super admins can assign/reassign clients
CREATE POLICY "Super admins can manage client assignments"
    ON public.coach_clients FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role = 'super_admin')
    );

-- Coaches can also insert (assign unassigned clients to themselves)
CREATE POLICY "Coaches can assign unassigned clients"
    ON public.coach_clients FOR INSERT
    WITH CHECK (
        coach_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
    );

-- ============================================================
-- 2. ADD coach_id TO coach_alerts
-- ============================================================
ALTER TABLE public.coach_alerts
    ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coach_alerts_coach ON public.coach_alerts(coach_id);

-- Update RLS: coaches see only their own alerts, super admins see all
DROP POLICY IF EXISTS "Admins can view all alerts" ON public.coach_alerts;
CREATE POLICY "Coaches see their own alerts, super admins see all"
    ON public.coach_alerts FOR SELECT
    USING (
        coach_id = auth.uid()
        OR coach_id IS NULL
        OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role = 'super_admin')
    );

-- ============================================================
-- 3. UPDATE admin_users ROLE for Shannon (super_admin)
-- ============================================================
-- Shannon is the platform owner, so she gets super_admin
UPDATE public.admin_users
SET role = 'super_admin'
WHERE user_id IN (
    SELECT id FROM auth.users
    WHERE email IN ('shannonbirch@cocospersonaltraining.com', 'shannon@plantbased-balance.org')
);

-- ============================================================
-- 4. AUTO-ASSIGN all existing clients to Shannon
-- ============================================================
-- Since this is transitioning from single-coach to multi-coach,
-- assign all existing users to Shannon's account.
INSERT INTO public.coach_clients (coach_id, client_id, status, notes)
SELECT
    (SELECT id FROM public.users WHERE email = 'shannonbirch@cocospersonaltraining.com' LIMIT 1),
    u.id,
    'active',
    'Auto-assigned during multi-coach migration'
FROM public.users u
WHERE u.email != 'shannonbirch@cocospersonaltraining.com'
  AND u.email != 'shannon@plantbased-balance.org'
  AND NOT EXISTS (
      SELECT 1 FROM public.coach_clients cc WHERE cc.client_id = u.id
  )
ON CONFLICT (client_id, coach_id) DO NOTHING;

-- ============================================================
-- 5. HELPER FUNCTIONS
-- ============================================================

-- Get all clients for a specific coach
CREATE OR REPLACE FUNCTION get_coach_client_ids(coach_uuid UUID)
RETURNS SETOF UUID AS $$
BEGIN
    -- Super admins see all users
    IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = coach_uuid AND role = 'super_admin') THEN
        RETURN QUERY SELECT id FROM public.users WHERE id != coach_uuid;
    ELSE
        -- Regular coaches see only their assigned clients
        RETURN QUERY
        SELECT client_id FROM public.coach_clients
        WHERE coach_id = coach_uuid AND status = 'active';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if a user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE user_id = user_uuid AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
