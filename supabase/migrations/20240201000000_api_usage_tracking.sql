-- ==========================================================================
-- Migration: API Usage Tracking
-- Description: Tables and functions for tracking API usage per organization
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- API Usage Events Table
-- Stores individual API request records
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  request_size_bytes INTEGER DEFAULT 0,
  response_size_bytes INTEGER DEFAULT 0,
  ip_address INET,
  user_agent TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_usage_events_org_created ON api_usage_events (org_id, created_at DESC);
CREATE INDEX idx_usage_events_endpoint ON api_usage_events (endpoint, created_at DESC);
CREATE INDEX idx_usage_events_status ON api_usage_events (status_code) WHERE status_code >= 400;
CREATE INDEX idx_usage_events_created ON api_usage_events (created_at DESC);

-- Partition by month for performance (optional, for high-volume usage)
-- CREATE TABLE api_usage_events_2024_02 PARTITION OF api_usage_events
--   FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');


-- ---------------------------------------------------------------------------
-- API Usage Quotas Table
-- Defines usage limits per organization and billing plan
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api_usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'free',
  monthly_request_limit INTEGER NOT NULL DEFAULT 1000,
  daily_request_limit INTEGER DEFAULT NULL,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  rate_limit_burst INTEGER NOT NULL DEFAULT 10,
  overage_allowed BOOLEAN NOT NULL DEFAULT false,
  overage_rate_cents INTEGER DEFAULT 0,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id)
);


-- ---------------------------------------------------------------------------
-- Daily Usage Aggregates (materialized for dashboard performance)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  successful_requests INTEGER NOT NULL DEFAULT 0,
  failed_requests INTEGER NOT NULL DEFAULT 0,
  total_latency_ms BIGINT NOT NULL DEFAULT 0,
  avg_latency_ms INTEGER GENERATED ALWAYS AS (
    CASE WHEN total_requests > 0 THEN (total_latency_ms / total_requests)::INTEGER ELSE 0 END
  ) STORED,
  rate_limit_hits INTEGER NOT NULL DEFAULT 0,
  unique_endpoints INTEGER NOT NULL DEFAULT 0,
  top_endpoints JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, date)
);

CREATE INDEX idx_usage_daily_org_date ON api_usage_daily (org_id, date DESC);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Record an API usage event and update daily aggregates atomically
CREATE OR REPLACE FUNCTION record_api_usage(
  p_org_id UUID,
  p_user_id UUID,
  p_endpoint TEXT,
  p_method TEXT,
  p_status_code INTEGER,
  p_latency_ms INTEGER,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
  v_today DATE := CURRENT_DATE;
  v_is_error BOOLEAN := p_status_code >= 400;
BEGIN
  -- Insert event
  INSERT INTO api_usage_events (org_id, user_id, endpoint, method, status_code, latency_ms, metadata)
  VALUES (p_org_id, p_user_id, p_endpoint, p_method, p_status_code, p_latency_ms, p_metadata)
  RETURNING id INTO v_event_id;

  -- Upsert daily aggregate
  INSERT INTO api_usage_daily (org_id, date, total_requests, successful_requests, failed_requests, total_latency_ms)
  VALUES (
    p_org_id,
    v_today,
    1,
    CASE WHEN v_is_error THEN 0 ELSE 1 END,
    CASE WHEN v_is_error THEN 1 ELSE 0 END,
    p_latency_ms
  )
  ON CONFLICT (org_id, date) DO UPDATE SET
    total_requests = api_usage_daily.total_requests + 1,
    successful_requests = api_usage_daily.successful_requests + CASE WHEN v_is_error THEN 0 ELSE 1 END,
    failed_requests = api_usage_daily.failed_requests + CASE WHEN v_is_error THEN 1 ELSE 0 END,
    total_latency_ms = api_usage_daily.total_latency_ms + p_latency_ms;

  RETURN v_event_id;
END;
$$;


-- Check if an organization has exceeded its usage quota
CREATE OR REPLACE FUNCTION check_usage_quota(p_org_id UUID)
RETURNS TABLE (
  within_quota BOOLEAN,
  current_usage INTEGER,
  monthly_limit INTEGER,
  usage_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quota RECORD;
  v_current_usage INTEGER;
BEGIN
  -- Get quota
  SELECT * INTO v_quota FROM api_usage_quotas WHERE org_id = p_org_id;

  IF NOT FOUND THEN
    -- No quota set, use defaults
    RETURN QUERY SELECT true, 0, 1000, 0.0::NUMERIC;
    RETURN;
  END IF;

  -- Count current period usage
  SELECT COUNT(*)::INTEGER INTO v_current_usage
  FROM api_usage_events
  WHERE org_id = p_org_id
    AND created_at >= v_quota.current_period_start
    AND created_at < v_quota.current_period_end;

  RETURN QUERY SELECT
    (v_current_usage < v_quota.monthly_request_limit OR v_quota.overage_allowed),
    v_current_usage,
    v_quota.monthly_request_limit,
    ROUND((v_current_usage::NUMERIC / v_quota.monthly_request_limit) * 100, 1);
END;
$$;


-- Get usage summary for dashboard
CREATE OR REPLACE FUNCTION get_usage_summary(
  p_org_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  date DATE,
  requests INTEGER,
  errors INTEGER,
  avg_latency INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    d.date,
    d.total_requests,
    d.failed_requests,
    d.avg_latency_ms
  FROM api_usage_daily d
  WHERE d.org_id = p_org_id
    AND d.date >= CURRENT_DATE - p_days
  ORDER BY d.date ASC;
$$;


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE api_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_daily ENABLE ROW LEVEL SECURITY;

-- Organizations can only see their own usage
CREATE POLICY "org_usage_events_select" ON api_usage_events
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_usage_quotas_select" ON api_usage_quotas
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_usage_daily_select" ON api_usage_daily
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM organization_members WHERE user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- Seed default quotas for plans
-- ---------------------------------------------------------------------------

COMMENT ON TABLE api_usage_events IS 'Individual API request log entries';
COMMENT ON TABLE api_usage_quotas IS 'Usage limits per organization based on billing plan';
COMMENT ON TABLE api_usage_daily IS 'Aggregated daily usage statistics for dashboard';
COMMENT ON FUNCTION record_api_usage IS 'Atomically records an API event and updates daily aggregates';
COMMENT ON FUNCTION check_usage_quota IS 'Checks if an org is within its usage quota';
COMMENT ON FUNCTION get_usage_summary IS 'Returns daily usage data for the dashboard chart';
