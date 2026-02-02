-- Fase 1: Estrutura de Dados para Cruzamento Vendas x Anúncios

-- 1.1 Tabela: campaign_product_links
-- Vincula campanhas de anúncios a produtos específicos
CREATE TABLE public.campaign_product_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('meta_ads', 'google_ads', 'tiktok_ads', 'mercadolivre_ads')),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'manual' CHECK (link_type IN ('manual', 'auto_detected', 'utm')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_campaign_product_links_campaign ON public.campaign_product_links(campaign_id);
CREATE INDEX idx_campaign_product_links_product ON public.campaign_product_links(product_id);
CREATE INDEX idx_campaign_product_links_sku ON public.campaign_product_links(sku);
CREATE INDEX idx_campaign_product_links_org ON public.campaign_product_links(organization_id);
CREATE INDEX idx_campaign_product_links_active ON public.campaign_product_links(is_active) WHERE is_active = true;

-- RLS para campaign_product_links
ALTER TABLE public.campaign_product_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org campaign links"
ON public.campaign_product_links FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Writers can insert org campaign links"
ON public.campaign_product_links FOR INSERT
WITH CHECK ((organization_id = get_user_org_id(auth.uid())) AND can_write_in_org(auth.uid()));

CREATE POLICY "Writers can update org campaign links"
ON public.campaign_product_links FOR UPDATE
USING (organization_id = get_user_org_id(auth.uid()))
WITH CHECK (can_write_in_org(auth.uid()));

CREATE POLICY "Admins can delete org campaign links"
ON public.campaign_product_links FOR DELETE
USING ((organization_id = get_user_org_id(auth.uid())) AND is_org_admin(auth.uid()));

-- 1.2 Tabela: attributed_conversions
-- Registra conversões (vendas) atribuídas a campanhas específicas
CREATE TABLE public.attributed_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  platform TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  sku TEXT NOT NULL,
  attributed_spend DECIMAL NOT NULL DEFAULT 0,
  order_value DECIMAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  attribution_method TEXT NOT NULL DEFAULT 'time_window' CHECK (attribution_method IN ('time_window', 'manual', 'utm', 'proportional')),
  attribution_weight DECIMAL NOT NULL DEFAULT 1.0 CHECK (attribution_weight > 0 AND attribution_weight <= 1),
  conversion_date DATE NOT NULL,
  attributed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_attributed_conversions_campaign ON public.attributed_conversions(campaign_id);
CREATE INDEX idx_attributed_conversions_order ON public.attributed_conversions(order_id);
CREATE INDEX idx_attributed_conversions_product ON public.attributed_conversions(product_id);
CREATE INDEX idx_attributed_conversions_sku ON public.attributed_conversions(sku);
CREATE INDEX idx_attributed_conversions_date ON public.attributed_conversions(conversion_date);
CREATE INDEX idx_attributed_conversions_org ON public.attributed_conversions(organization_id);

-- RLS para attributed_conversions
ALTER TABLE public.attributed_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org attributed conversions"
ON public.attributed_conversions FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Service role can insert attributed conversions"
ON public.attributed_conversions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update attributed conversions"
ON public.attributed_conversions FOR UPDATE
USING (true);

CREATE POLICY "Service role can delete attributed conversions"
ON public.attributed_conversions FOR DELETE
USING (true);

-- 1.3 Extensão da tabela products
-- Adicionar campos para rastreamento de métricas de ads
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS active_campaign_ids JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS total_attributed_spend DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_attributed_revenue DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS attributed_roas DECIMAL DEFAULT 0;

-- Trigger para atualizar updated_at em campaign_product_links
CREATE TRIGGER update_campaign_product_links_updated_at
BEFORE UPDATE ON public.campaign_product_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- View para métricas agregadas de ROI por produto
CREATE OR REPLACE VIEW public.product_roi_metrics AS
SELECT 
  p.id as product_id,
  p.organization_id,
  p.sku,
  p.name as product_name,
  p.cost_price,
  p.selling_price,
  COALESCE(SUM(ac.order_value), 0) as total_attributed_revenue,
  COALESCE(SUM(ac.attributed_spend), 0) as total_attributed_spend,
  COALESCE(SUM(ac.quantity), 0) as total_attributed_units,
  COUNT(DISTINCT ac.order_id) as attributed_orders,
  CASE 
    WHEN COALESCE(SUM(ac.attributed_spend), 0) > 0 
    THEN ROUND((COALESCE(SUM(ac.order_value), 0) / SUM(ac.attributed_spend))::numeric, 2)
    ELSE 0 
  END as roas,
  CASE 
    WHEN COALESCE(SUM(ac.quantity), 0) > 0 
    THEN ROUND((COALESCE(SUM(ac.attributed_spend), 0) / SUM(ac.quantity))::numeric, 2)
    ELSE 0 
  END as cost_per_acquisition
FROM public.products p
LEFT JOIN public.attributed_conversions ac ON p.id = ac.product_id
GROUP BY p.id, p.organization_id, p.sku, p.name, p.cost_price, p.selling_price;