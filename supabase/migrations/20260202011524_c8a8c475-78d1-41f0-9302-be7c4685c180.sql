-- Corrigir View para usar SECURITY INVOKER (mais seguro)
DROP VIEW IF EXISTS public.product_roi_metrics;

CREATE VIEW public.product_roi_metrics 
WITH (security_invoker = true) AS
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