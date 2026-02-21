-- ============================================================
-- Row Level Security Policies
-- Ensures multi-tenant data isolation at the database level.
-- Each user can only access data belonging to their organization.
-- ============================================================

-- ─── Helper Functions ────────────────────────────────────

-- Get the current authenticated user ID
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.sub', true)::uuid,
    (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
  );
$$ LANGUAGE sql STABLE;

-- Get organization IDs the current user belongs to
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS SETOF uuid AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
    AND status = 'active';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user has a specific role in an organization
CREATE OR REPLACE FUNCTION public.user_has_role(
  _org_id uuid,
  _role text
)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = _org_id
      AND user_id = auth.uid()
      AND role = _role
      AND status = 'active'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user is an admin of an organization
CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id uuid)
RETURNS boolean AS $$
  SELECT public.user_has_role(_org_id, 'admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── Enable RLS on All Tables ────────────────────────────

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;


-- ─── Profiles ────────────────────────────────────────────

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can see profiles of people in the same org
CREATE POLICY "Users can view org member profiles"
  ON public.profiles FOR SELECT
  USING (
    id IN (
      SELECT om.user_id
      FROM public.organization_members om
      WHERE om.organization_id IN (SELECT public.get_user_org_ids())
    )
  );


-- ─── Organizations ───────────────────────────────────────

-- Members can view their organizations
CREATE POLICY "Members can view organization"
  ON public.organizations FOR SELECT
  USING (id IN (SELECT public.get_user_org_ids()));

-- Only admins can update organization details
CREATE POLICY "Admins can update organization"
  ON public.organizations FOR UPDATE
  USING (public.is_org_admin(id))
  WITH CHECK (public.is_org_admin(id));

-- Authenticated users can create organizations
CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── Organization Members ────────────────────────────────

-- Members can view other members in their org
CREATE POLICY "Members can view org members"
  ON public.organization_members FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Only admins can add members
CREATE POLICY "Admins can add members"
  ON public.organization_members FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id));

-- Only admins can update member roles
CREATE POLICY "Admins can update members"
  ON public.organization_members FOR UPDATE
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

-- Only admins can remove members (but not themselves)
CREATE POLICY "Admins can remove members"
  ON public.organization_members FOR DELETE
  USING (
    public.is_org_admin(organization_id)
    AND user_id != auth.uid()
  );

-- Members can leave an organization
CREATE POLICY "Members can leave organization"
  ON public.organization_members FOR DELETE
  USING (user_id = auth.uid());


-- ─── Subscriptions ───────────────────────────────────────

-- Members can view their org subscription
CREATE POLICY "Members can view subscription"
  ON public.subscriptions FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Only admins can modify subscriptions
CREATE POLICY "Admins can update subscription"
  ON public.subscriptions FOR UPDATE
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

-- Service role can manage subscriptions (for webhooks)
CREATE POLICY "Service role manages subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.uid() IS NULL AND current_setting('request.jwt.claim.role', true) = 'service_role');


-- ─── Invoices ────────────────────────────────────────────

-- Members can view invoices
CREATE POLICY "Members can view invoices"
  ON public.invoices FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Service role can create invoices (Stripe webhooks)
CREATE POLICY "Service role manages invoices"
  ON public.invoices FOR ALL
  USING (auth.uid() IS NULL AND current_setting('request.jwt.claim.role', true) = 'service_role');

-- ─── API Keys ────────────────────────────────────────────

-- Members can view API keys (masked)
CREATE POLICY "Members can view api keys"
  ON public.api_keys FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Only admins can create API keys
CREATE POLICY "Admins can create api keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id));

-- Only admins can revoke API keys
CREATE POLICY "Admins can update api keys"
  ON public.api_keys FOR UPDATE
  USING (public.is_org_admin(organization_id));

CREATE POLICY "Admins can delete api keys"
  ON public.api_keys FOR DELETE
  USING (public.is_org_admin(organization_id));


-- ─── API Usage ───────────────────────────────────────────

-- Members can view usage data for their org
CREATE POLICY "Members can view api usage events"
  ON public.api_usage_events FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Members can view api usage daily"
  ON public.api_usage_daily FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Service role can insert usage data
CREATE POLICY "Service role records usage"
  ON public.api_usage_events FOR INSERT
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');

CREATE POLICY "Service role updates daily usage"
  ON public.api_usage_daily FOR ALL
  USING (current_setting('request.jwt.claim.role', true) = 'service_role');


-- ─── Invitations ─────────────────────────────────────────

-- Members can view pending invitations
CREATE POLICY "Members can view invitations"
  ON public.invitations FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Only admins can create invitations
CREATE POLICY "Admins can create invitations"
  ON public.invitations FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id));

-- Admins can revoke invitations
CREATE POLICY "Admins can delete invitations"
  ON public.invitations FOR DELETE
  USING (public.is_org_admin(organization_id));


-- ─── Audit Logs ──────────────────────────────────────────

-- Admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_org_admin(organization_id));

-- Service role can insert audit logs
CREATE POLICY "Service role inserts audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');


-- ─── Performance Indexes ─────────────────────────────────

-- Index for fast org membership lookups (critical for RLS)
CREATE INDEX IF NOT EXISTS idx_org_members_user_org
  ON public.organization_members (user_id, organization_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_org_members_org_role
  ON public.organization_members (organization_id, role)
  WHERE status = 'active';

-- Index for API usage queries
CREATE INDEX IF NOT EXISTS idx_api_usage_daily_org_date
  ON public.api_usage_daily (organization_id, date DESC);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
  ON public.audit_logs (organization_id, created_at DESC);
