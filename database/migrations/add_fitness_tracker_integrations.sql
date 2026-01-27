-- Fitness Tracker Integrations Migration
-- Adds support for Fitbit and Garmin integrations

-- ============================================================
-- FITNESS INTEGRATIONS TABLE (OAuth tokens and connections)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fitness_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Integration details
  provider TEXT NOT NULL, -- 'fitbit' or 'garmin'
  provider_user_id TEXT NOT NULL, -- User ID from the provider

  -- OAuth tokens (encrypted in production)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Scope permissions granted
  scopes TEXT[], -- Array of granted permissions

  -- Connection status
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,

  -- Timestamps
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one active connection per provider per user
  UNIQUE(user_id, provider),
  INDEX idx_fitness_integrations_user (user_id, provider),
  INDEX idx_fitness_integrations_active (user_id, is_active)
);

-- ============================================================
-- FITNESS SYNC HISTORY TABLE (track sync operations)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fitness_sync_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES public.fitness_integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Sync details
  sync_type TEXT NOT NULL, -- 'manual', 'automatic', 'initial'
  data_types TEXT[], -- ['activity', 'sleep', 'heart_rate', etc.]

  -- Sync results
  status TEXT NOT NULL, -- 'success', 'partial', 'failed'
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,

  -- Date range synced
  sync_start_date DATE,
  sync_end_date DATE,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  INDEX idx_sync_history_user (user_id, started_at DESC),
  INDEX idx_sync_history_integration (integration_id, started_at DESC)
);

-- ============================================================
-- FITNESS METRICS TABLE (actual health/fitness data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fitness_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES public.fitness_integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Metric details
  metric_date DATE NOT NULL,
  metric_type TEXT NOT NULL, -- 'steps', 'heart_rate', 'sleep', 'calories', 'distance', 'active_minutes', 'weight'

  -- Metric values (use appropriate field based on metric_type)
  value_integer INTEGER, -- For steps, calories, active_minutes
  value_decimal NUMERIC(10, 2), -- For distance, weight
  value_text TEXT, -- For sleep stages, heart rate zones
  value_json JSONB, -- For complex data structures

  -- Additional metadata
  unit TEXT, -- 'steps', 'kcal', 'km', 'kg', 'minutes', 'bpm'
  confidence_level TEXT, -- 'high', 'medium', 'low' (from device)

  -- Timestamps
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate metrics
  UNIQUE(integration_id, metric_date, metric_type),
  INDEX idx_fitness_metrics_user_date (user_id, metric_date DESC),
  INDEX idx_fitness_metrics_type (user_id, metric_type, metric_date DESC)
);

-- ============================================================
-- AUTOMATED TRIGGERS
-- ============================================================

-- Update updated_at timestamp automatically
CREATE TRIGGER update_fitness_integrations_updated_at
  BEFORE UPDATE ON public.fitness_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE public.fitness_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_metrics ENABLE ROW LEVEL SECURITY;

-- Users can only access their own fitness data
CREATE POLICY "Users can view own fitness integrations" ON public.fitness_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fitness integrations" ON public.fitness_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fitness integrations" ON public.fitness_integrations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fitness integrations" ON public.fitness_integrations
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sync history" ON public.fitness_sync_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own fitness metrics" ON public.fitness_metrics
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all fitness data
CREATE POLICY "Admins can view all fitness integrations" ON public.fitness_integrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all fitness metrics" ON public.fitness_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );
