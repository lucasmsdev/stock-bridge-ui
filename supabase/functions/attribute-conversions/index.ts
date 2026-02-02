import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderItem {
  sku?: string;
  product_id?: string;
  quantity?: number;
  price?: number;
  name?: string;
}

interface CampaignLink {
  id: string;
  campaign_id: string;
  campaign_name: string;
  platform: string;
  product_id: string;
  sku: string;
  organization_id: string;
  user_id: string;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

interface AdMetric {
  campaign_id: string;
  spend: number;
  date: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { organization_id, days_back = 7 } = await req.json();

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    console.log(`Processing attribution for org: ${organization_id}, days_back: ${days_back}`);

    // Get the date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days_back);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // 1. Fetch all active campaign-product links for this organization
    const { data: campaignLinks, error: linksError } = await supabase
      .from('campaign_product_links')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('is_active', true);

    if (linksError) throw linksError;

    if (!campaignLinks || campaignLinks.length === 0) {
      console.log('No active campaign links found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active campaign links to process',
        attributed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${campaignLinks.length} active campaign links`);

    // Create a map of SKU to campaign links
    const skuToCampaigns = new Map<string, CampaignLink[]>();
    campaignLinks.forEach((link: CampaignLink) => {
      const existing = skuToCampaigns.get(link.sku) || [];
      existing.push(link);
      skuToCampaigns.set(link.sku, existing);
    });

    // 2. Fetch orders within the date range
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('organization_id', organization_id)
      .gte('order_date', startDateStr)
      .lte('order_date', endDateStr);

    if (ordersError) throw ordersError;

    if (!orders || orders.length === 0) {
      console.log('No orders found in date range');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No orders to process in date range',
        attributed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${orders.length} orders to process`);

    // 3. Fetch ad metrics (spend) for the campaigns in the date range
    const campaignIds = [...new Set(campaignLinks.map((l: CampaignLink) => l.campaign_id))];
    
    const { data: adMetrics, error: metricsError } = await supabase
      .from('ad_metrics')
      .select('campaign_id, spend, date')
      .eq('organization_id', organization_id)
      .in('campaign_id', campaignIds)
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (metricsError) throw metricsError;

    // Create a map of campaign_id to total spend in period
    const campaignSpend = new Map<string, number>();
    adMetrics?.forEach((metric: AdMetric) => {
      const current = campaignSpend.get(metric.campaign_id) || 0;
      campaignSpend.set(metric.campaign_id, current + Number(metric.spend));
    });

    // 4. Process each order and attribute conversions
    const conversionsToInsert: any[] = [];
    const processedOrderIds = new Set<string>();

    for (const order of orders) {
      // Skip if already processed
      if (processedOrderIds.has(order.id)) continue;

      // Parse items from the order
      const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
      
      for (const item of items) {
        const sku = item.sku;
        if (!sku) continue;

        // Check if we have campaign links for this SKU
        const linkedCampaigns = skuToCampaigns.get(sku);
        if (!linkedCampaigns || linkedCampaigns.length === 0) continue;

        const orderDate = new Date(order.order_date);
        const orderValue = Number(item.price) * (Number(item.quantity) || 1);
        const quantity = Number(item.quantity) || 1;

        // Filter campaigns active during order date
        const activeCampaigns = linkedCampaigns.filter((link: CampaignLink) => {
          if (link.start_date && new Date(link.start_date) > orderDate) return false;
          if (link.end_date && new Date(link.end_date) < orderDate) return false;
          return true;
        });

        if (activeCampaigns.length === 0) continue;

        // Calculate attribution weight (proportional if multiple campaigns)
        const weight = 1 / activeCampaigns.length;

        for (const campaign of activeCampaigns) {
          const totalSpend = campaignSpend.get(campaign.campaign_id) || 0;
          
          // Attribute spend proportionally based on:
          // 1. Weight (if multiple campaigns)
          // 2. Proportion of this order value to total attributed value
          // For simplicity, we'll distribute spend evenly across attributed orders
          const attributedSpend = totalSpend > 0 
            ? (totalSpend * weight) / Math.max(orders.length, 1)
            : 0;

          conversionsToInsert.push({
            organization_id: campaign.organization_id,
            user_id: campaign.user_id,
            order_id: order.id,
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            platform: campaign.platform,
            product_id: campaign.product_id,
            sku: sku,
            attributed_spend: attributedSpend,
            order_value: orderValue,
            quantity: quantity,
            attribution_method: activeCampaigns.length > 1 ? 'proportional' : 'time_window',
            attribution_weight: weight,
            conversion_date: order.order_date.split('T')[0],
          });
        }
      }

      processedOrderIds.add(order.id);
    }

    console.log(`Generated ${conversionsToInsert.length} conversions to insert`);

    if (conversionsToInsert.length > 0) {
      // Delete existing attributions for these orders to avoid duplicates
      const orderIds = [...processedOrderIds];
      await supabase
        .from('attributed_conversions')
        .delete()
        .in('order_id', orderIds);

      // Insert new attributions
      const { error: insertError } = await supabase
        .from('attributed_conversions')
        .insert(conversionsToInsert);

      if (insertError) throw insertError;

      // Update product aggregated metrics
      const productMetrics = new Map<string, { spend: number; revenue: number }>();
      conversionsToInsert.forEach(conv => {
        if (conv.product_id) {
          const existing = productMetrics.get(conv.product_id) || { spend: 0, revenue: 0 };
          existing.spend += conv.attributed_spend;
          existing.revenue += conv.order_value;
          productMetrics.set(conv.product_id, existing);
        }
      });

      // Update products with new metrics
      for (const [productId, metrics] of productMetrics) {
        const roas = metrics.spend > 0 ? metrics.revenue / metrics.spend : 0;
        
        await supabase
          .from('products')
          .update({
            total_attributed_spend: metrics.spend,
            total_attributed_revenue: metrics.revenue,
            attributed_roas: roas,
          })
          .eq('id', productId);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Attributed ${conversionsToInsert.length} conversions`,
      attributed: conversionsToInsert.length,
      orders_processed: processedOrderIds.size,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in attribute-conversions:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
