
-- Create ai_insights table for proactive AI insights cache
CREATE TABLE public.ai_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '12 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Users can only view insights from their own organization
CREATE POLICY "Users can view own org insights"
ON public.ai_insights
FOR SELECT
USING (
  organization_id = public.get_user_org_id(auth.uid())
);

-- Users can insert insights for their own organization
CREATE POLICY "Users can insert own org insights"
ON public.ai_insights
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND organization_id = public.get_user_org_id(auth.uid())
);

-- Users can delete expired insights from their own organization
CREATE POLICY "Users can delete own org insights"
ON public.ai_insights
FOR DELETE
USING (
  organization_id = public.get_user_org_id(auth.uid())
);

-- Index for fast lookups by organization
CREATE INDEX idx_ai_insights_org_expires ON public.ai_insights (organization_id, expires_at DESC);
