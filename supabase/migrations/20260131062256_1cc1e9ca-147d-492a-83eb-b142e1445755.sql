-- Create table for storing ad campaign metrics from Meta Ads and Google Ads
CREATE TABLE public.ad_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('meta_ads', 'google_ads')),
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  ad_account_id TEXT,
  date DATE NOT NULL,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  conversion_value NUMERIC NOT NULL DEFAULT 0,
  reach INTEGER DEFAULT 0,
  ctr NUMERIC GENERATED ALWAYS AS (CASE WHEN impressions > 0 THEN (clicks::NUMERIC / impressions) * 100 ELSE 0 END) STORED,
  cpc NUMERIC GENERATED ALWAYS AS (CASE WHEN clicks > 0 THEN spend / clicks ELSE 0 END) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint to prevent duplicate entries per campaign per day
  CONSTRAINT unique_campaign_date UNIQUE (integration_id, campaign_id, date)
);

-- Add indexes for common queries
CREATE INDEX idx_ad_metrics_user_id ON public.ad_metrics(user_id);
CREATE INDEX idx_ad_metrics_org_id ON public.ad_metrics(organization_id);
CREATE INDEX idx_ad_metrics_platform ON public.ad_metrics(platform);
CREATE INDEX idx_ad_metrics_date ON public.ad_metrics(date DESC);
CREATE INDEX idx_ad_metrics_integration ON public.ad_metrics(integration_id);

-- Enable RLS
ALTER TABLE public.ad_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Members can view org metrics
CREATE POLICY "Members can view org ad_metrics"
  ON public.ad_metrics
  FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

-- Writers can insert via service role (Edge Functions), so no direct INSERT policy needed
-- But add one for completeness with service_role
CREATE POLICY "Service role can insert ad_metrics"
  ON public.ad_metrics
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update ad_metrics"
  ON public.ad_metrics
  FOR UPDATE
  USING (true);

CREATE POLICY "Service role can delete ad_metrics"
  ON public.ad_metrics
  FOR DELETE
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_ad_metrics_updated_at
  BEFORE UPDATE ON public.ad_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();