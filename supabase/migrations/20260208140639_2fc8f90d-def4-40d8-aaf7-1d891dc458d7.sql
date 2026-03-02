
-- Create automation_rules table
CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  rule_type text NOT NULL,
  is_active boolean DEFAULT false,
  config jsonb DEFAULT '{}',
  last_triggered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, rule_type)
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

-- SELECT: all org members can view
CREATE POLICY "Members can view org automation rules"
  ON public.automation_rules FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

-- INSERT: writers only
CREATE POLICY "Writers can insert org automation rules"
  ON public.automation_rules FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND can_write_in_org(auth.uid()));

-- UPDATE: writers only
CREATE POLICY "Writers can update org automation rules"
  ON public.automation_rules FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()))
  WITH CHECK (can_write_in_org(auth.uid()));

-- DELETE: admins only
CREATE POLICY "Admins can delete org automation rules"
  ON public.automation_rules FOR DELETE
  USING (organization_id = get_user_org_id(auth.uid()) AND is_org_admin(auth.uid()));

-- Create automation_logs table
CREATE TABLE public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_rule_id uuid REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  action_taken text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: all org members can view logs
CREATE POLICY "Members can view org automation logs"
  ON public.automation_logs FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

-- INSERT: system inserts via service role, but also allow writers
CREATE POLICY "Writers can insert org automation logs"
  ON public.automation_logs FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND can_write_in_org(auth.uid()));

-- Trigger for updated_at on automation_rules
CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
