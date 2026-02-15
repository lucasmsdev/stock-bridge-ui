import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "./useOrganization";

export interface ProductROIData {
  product_id: string;
  organization_id: string;
  sku: string;
  product_name: string;
  cost_price: number | null;
  selling_price: number | null;
  total_attributed_revenue: number;
  total_attributed_spend: number;
  total_attributed_units: number;
  attributed_orders: number;
  roas: number;
  cost_per_acquisition: number;
  platforms: string[];
}

export interface ROISummary {
  totalRevenue: number;
  totalSpend: number;
  totalOrders: number;
  averageRoas: number;
  bestProduct: ProductROIData | null;
  worstProduct: ProductROIData | null;
  profitableProducts: number;
  unprofitableProducts: number;
}

export function useProductROI(dateRange?: { from: Date; to: Date }) {
  const { organizationId } = useOrganization();

  const { data: roiData, isLoading, error, refetch } = useQuery({
    queryKey: ['product-roi', organizationId, dateRange?.from, dateRange?.to],
    queryFn: async (): Promise<ProductROIData[]> => {
      if (!organizationId) return [];

      // Query attributed_conversions with product info
      let query = supabase
        .from('attributed_conversions')
        .select(`
          product_id,
          sku,
          attributed_spend,
          order_value,
          quantity,
          conversion_date,
          products!inner (
            name,
            cost_price,
            selling_price,
            organization_id
          )
        `)
        .eq('organization_id', organizationId);

      if (dateRange?.from) {
        query = query.gte('conversion_date', dateRange.from.toISOString().split('T')[0]);
      }
      if (dateRange?.to) {
        query = query.lte('conversion_date', dateRange.to.toISOString().split('T')[0]);
      }

      const { data: conversions, error: convError } = await query;

      if (convError) throw convError;

      // Aggregate by product
      const productMap = new Map<string, ProductROIData>();

      conversions?.forEach((conv: any) => {
        const productId = conv.product_id;
        const platform = conv.platform || 'Desconhecido';
        const existing = productMap.get(productId);

        if (existing) {
          existing.total_attributed_revenue += Number(conv.order_value) || 0;
          existing.total_attributed_spend += Number(conv.attributed_spend) || 0;
          existing.total_attributed_units += Number(conv.quantity) || 0;
          existing.attributed_orders += 1;
          if (!existing.platforms.includes(platform)) {
            existing.platforms.push(platform);
          }
        } else {
          productMap.set(productId, {
            product_id: productId,
            organization_id: conv.products?.organization_id || organizationId,
            sku: conv.sku,
            product_name: conv.products?.name || 'Produto desconhecido',
            cost_price: conv.products?.cost_price,
            selling_price: conv.products?.selling_price,
            total_attributed_revenue: Number(conv.order_value) || 0,
            total_attributed_spend: Number(conv.attributed_spend) || 0,
            total_attributed_units: Number(conv.quantity) || 0,
            attributed_orders: 1,
            roas: 0,
            cost_per_acquisition: 0,
            platforms: [platform],
          });
        }
      });

      // Calculate ROAS and CPA
      const results = Array.from(productMap.values()).map(product => ({
        ...product,
        roas: product.total_attributed_spend > 0 
          ? Number((product.total_attributed_revenue / product.total_attributed_spend).toFixed(2))
          : 0,
        cost_per_acquisition: product.total_attributed_units > 0
          ? Number((product.total_attributed_spend / product.total_attributed_units).toFixed(2))
          : 0,
      }));

      return results.sort((a, b) => b.roas - a.roas);
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Also fetch products without conversions
  const { data: allProducts } = useQuery({
    queryKey: ['products-for-roi', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, sku, name, cost_price, selling_price, total_attributed_spend, total_attributed_revenue, attributed_roas')
        .eq('organization_id', organizationId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Calculate summary
  const summary: ROISummary = {
    totalRevenue: roiData?.reduce((sum, p) => sum + p.total_attributed_revenue, 0) || 0,
    totalSpend: roiData?.reduce((sum, p) => sum + p.total_attributed_spend, 0) || 0,
    totalOrders: roiData?.reduce((sum, p) => sum + p.attributed_orders, 0) || 0,
    averageRoas: 0,
    bestProduct: roiData?.length ? roiData[0] : null,
    worstProduct: roiData?.length ? roiData[roiData.length - 1] : null,
    profitableProducts: roiData?.filter(p => p.roas >= 1).length || 0,
    unprofitableProducts: roiData?.filter(p => p.roas > 0 && p.roas < 1).length || 0,
  };

  if (summary.totalSpend > 0) {
    summary.averageRoas = Number((summary.totalRevenue / summary.totalSpend).toFixed(2));
  }

  return {
    roiData: roiData || [],
    allProducts: allProducts || [],
    summary,
    isLoading,
    error,
    refetch,
  };
}
