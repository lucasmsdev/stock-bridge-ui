
-- Criar tabela marketplace_fee_profiles
CREATE TABLE public.marketplace_fee_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  commission_percent NUMERIC NOT NULL DEFAULT 0,
  payment_fee_percent NUMERIC NOT NULL DEFAULT 0,
  fixed_fee_amount NUMERIC NOT NULL DEFAULT 0,
  shipping_subsidy NUMERIC NOT NULL DEFAULT 0,
  tax_regime TEXT NOT NULL DEFAULT 'simples_nacional',
  tax_percent NUMERIC NOT NULL DEFAULT 6,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, platform)
);

-- Enable RLS
ALTER TABLE public.marketplace_fee_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can view org fee profiles"
  ON public.marketplace_fee_profiles FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins can insert org fee profiles"
  ON public.marketplace_fee_profiles FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND is_org_admin(auth.uid()));

CREATE POLICY "Admins can update org fee profiles"
  ON public.marketplace_fee_profiles FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()))
  WITH CHECK (is_org_admin(auth.uid()));

CREATE POLICY "Admins can delete org fee profiles"
  ON public.marketplace_fee_profiles FOR DELETE
  USING (organization_id = get_user_org_id(auth.uid()) AND is_org_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_marketplace_fee_profiles_updated_at
  BEFORE UPDATE ON public.marketplace_fee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to seed default fee profiles for a new organization
CREATE OR REPLACE FUNCTION public.seed_marketplace_fee_profiles()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.marketplace_fee_profiles (organization_id, platform, commission_percent, payment_fee_percent, fixed_fee_amount, tax_regime, tax_percent)
  VALUES
    (NEW.id, 'mercadolivre', 13, 4.99, 0, 'simples_nacional', 6),
    (NEW.id, 'shopee', 14, 0, 0, 'simples_nacional', 6),
    (NEW.id, 'amazon', 15, 0, 0, 'simples_nacional', 6),
    (NEW.id, 'shopify', 0, 2.5, 0, 'simples_nacional', 6),
    (NEW.id, 'magalu', 16, 0, 0, 'simples_nacional', 6),
    (NEW.id, 'shein', 12, 0, 0, 'simples_nacional', 6),
    (NEW.id, 'tiktok_shop', 5, 0, 0, 'simples_nacional', 6);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-seed when organization is created
CREATE TRIGGER seed_org_marketplace_fees
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_marketplace_fee_profiles();

-- Seed existing organizations that don't have fee profiles yet
INSERT INTO public.marketplace_fee_profiles (organization_id, platform, commission_percent, payment_fee_percent, fixed_fee_amount, tax_regime, tax_percent)
SELECT o.id, p.platform, p.commission, p.payment_fee, 0, 'simples_nacional', 6
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('mercadolivre', 13::numeric, 4.99::numeric),
    ('shopee', 14::numeric, 0::numeric),
    ('amazon', 15::numeric, 0::numeric),
    ('shopify', 0::numeric, 2.5::numeric),
    ('magalu', 16::numeric, 0::numeric),
    ('shein', 12::numeric, 0::numeric),
    ('tiktok_shop', 5::numeric, 0::numeric)
) AS p(platform, commission, payment_fee)
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketplace_fee_profiles mfp
  WHERE mfp.organization_id = o.id AND mfp.platform = p.platform
);
