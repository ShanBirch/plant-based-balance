-- Migration: Add Pending Coach Responses Table
-- Purpose: Store AI-generated responses for approval before sending to users

-- ============================================================
-- PENDING COACH RESPONSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pending_coach_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Response content
  message_text TEXT NOT NULL,
  original_message_text TEXT NOT NULL, -- Track original AI response for audit trail

  -- Metadata
  chat_type TEXT NOT NULL DEFAULT 'shannon',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'

  -- Context at time of generation
  user_message_text TEXT, -- The user message this is responding to
  context_snapshot JSONB, -- Store user facts, check-ins, etc. at time of generation

  -- Approval tracking
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Timestamps
  timestamp BIGINT NOT NULL, -- Unix timestamp in milliseconds
  brisbane_time TEXT, -- Formatted time string
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Index for faster queries
  INDEX idx_pending_responses_user (user_id, created_at DESC),
  INDEX idx_pending_responses_status (status, created_at DESC)
);

-- Enable RLS on pending_coach_responses table
ALTER TABLE public.pending_coach_responses ENABLE ROW LEVEL SECURITY;

-- Admins can view all pending responses
CREATE POLICY "Admins can view all pending responses" ON public.pending_coach_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Admins can update pending responses (approve/reject/edit)
CREATE POLICY "Admins can update pending responses" ON public.pending_coach_responses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Admins can insert pending responses
CREATE POLICY "Admins can insert pending responses" ON public.pending_coach_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Service role can insert pending responses (for AI chat function)
CREATE POLICY "Service can insert pending responses" ON public.pending_coach_responses
  FOR INSERT WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_pending_responses_updated_at BEFORE UPDATE ON public.pending_coach_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- HELPER FUNCTION: Get Pending Response Count
-- ============================================================
CREATE OR REPLACE FUNCTION get_pending_response_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.pending_coach_responses
    WHERE status = 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
