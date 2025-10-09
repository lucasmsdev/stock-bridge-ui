import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DashboardMetrics {
  todayRevenue: number;
  todayOrders: number;
  totalProducts: number;
  salesLast7Days: Array<{
    date: string;
    revenue: number;
  }>;
  marketing: {
    billing: number;
    marketplaceLiquid: number;
    grossProfit: number;
    margin: number;
    salesCount: number;
    unitsSold: number;
    averageTicket: number;
    roi: number;
    adSpend: number;
    tacos: number;
    profitAfterAds: number;
    marginAfterAds: number;
  };
}

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Starting get-dashboard-metrics function ===');
    
    // Get JWT from the Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error('Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Getting dashboard metrics for user:', user.id);

    // Initialize default metrics
    let todayRevenue = 0;
    let todayOrders = 0;
    let totalProducts = 0;
    let salesLast7Days = [];

    // Get today's start and end in user's timezone
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Get 7 days ago
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
      console.log('Fetching today orders...');
      // Get today's revenue and orders count
      const { data: todayData, error: todayError } = await supabase
        .from('orders')
        .select('total_value')
        .eq('user_id', user.id)
        .gte('order_date', todayStart.toISOString())
        .lt('order_date', todayEnd.toISOString());

      if (todayError) {
        console.error('Error fetching today orders:', todayError);
        // Don't throw, just log and continue with default values
      } else {
        todayRevenue = todayData?.reduce((sum, order) => sum + Number(order.total_value), 0) || 0;
        todayOrders = todayData?.length || 0;
        console.log(`Today's metrics: Revenue: ${todayRevenue}, Orders: ${todayOrders}`);
      }
    } catch (ordersError) {
      console.error('Failed to fetch today orders, using defaults:', ordersError);
    }

    try {
      console.log('Fetching products count...');
      // Get total products count
      const { count: productsCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (productsError) {
        console.error('Error fetching products count:', productsError);
        // Don't throw, just log and continue with default values
      } else {
        totalProducts = productsCount || 0;
        console.log(`Total products: ${totalProducts}`);
      }
    } catch (productsError) {
      console.error('Failed to fetch products count, using defaults:', productsError);
    }

    try {
      console.log('Fetching sales data for last 7 days...');
      // Get sales for last 7 days
      const { data: salesData, error: salesError } = await supabase
        .from('orders')
        .select('order_date, total_value')
        .eq('user_id', user.id)
        .gte('order_date', sevenDaysAgo.toISOString())
        .order('order_date', { ascending: true });

      if (salesError) {
        console.error('Error fetching sales data:', salesError);
        // Don't throw, continue with default empty array
      } else {
        // Group sales by date
        const salesByDate: { [key: string]: number } = {};
        
        // Initialize all 7 days with 0
        for (let i = 6; i >= 0; i--) {
          const date = new Date(todayStart);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          salesByDate[dateStr] = 0;
        }

        // Add actual sales data
        salesData?.forEach(order => {
          const dateStr = order.order_date.split('T')[0];
          if (salesByDate.hasOwnProperty(dateStr)) {
            salesByDate[dateStr] += Number(order.total_value);
          }
        });

        salesLast7Days = Object.entries(salesByDate).map(([date, revenue]) => ({
          date,
          revenue: Math.round(revenue * 100) / 100 // Round to 2 decimal places
        }));

        console.log('Sales last 7 days:', salesLast7Days);
      }
    } catch (salesError) {
      console.error('Failed to fetch sales data, using defaults:', salesError);
      // Initialize default 7 days with 0 revenue
      salesLast7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(todayStart);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        salesLast7Days.push({
          date: dateStr,
          revenue: 0
        });
      }
    }

    // Calculate marketing metrics
    let marketingMetrics = {
      billing: 0,
      marketplaceLiquid: 0,
      grossProfit: 0,
      margin: 0,
      salesCount: 0,
      unitsSold: 0,
      averageTicket: 0,
      roi: 0,
      adSpend: 0,
      tacos: 0,
      profitAfterAds: 0,
      marginAfterAds: 0
    };

    try {
      console.log('Calculating marketing metrics...');
      
      // Get all orders for the period (last 30 days for better metrics)
      const thirtyDaysAgo = new Date(todayStart);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('total_value, items')
        .eq('user_id', user.id)
        .gte('order_date', thirtyDaysAgo.toISOString());

      if (!ordersError && ordersData && ordersData.length > 0) {
        // Calculate billing (total revenue)
        marketingMetrics.billing = ordersData.reduce((sum, order) => sum + Number(order.total_value), 0);
        marketingMetrics.salesCount = ordersData.length;
        
        // Calculate units sold
        marketingMetrics.unitsSold = ordersData.reduce((sum, order) => {
          const items = order.items || [];
          return sum + items.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0);
        }, 0);
        
        // Get products with cost and ad spend data
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('cost_price, selling_price, ad_spend')
          .eq('user_id', user.id);
        
        if (!productsError && productsData) {
          // Calculate total ad spend
          marketingMetrics.adSpend = productsData.reduce((sum, p) => sum + Number(p.ad_spend || 0), 0);
          
          // Calculate cost of goods sold and gross profit
          let totalCost = 0;
          ordersData.forEach(order => {
            const items = order.items || [];
            items.forEach((item: any) => {
              const product = productsData.find(p => p.selling_price === item.unit_price);
              if (product && product.cost_price) {
                totalCost += Number(product.cost_price) * (item.quantity || 0);
              }
            });
          });
          
          // Marketplace liquid (assuming 12% marketplace fee)
          marketingMetrics.marketplaceLiquid = marketingMetrics.billing * 0.88;
          
          // Gross profit
          marketingMetrics.grossProfit = marketingMetrics.marketplaceLiquid - totalCost;
          
          // Margin
          if (marketingMetrics.marketplaceLiquid > 0) {
            marketingMetrics.margin = (marketingMetrics.grossProfit / marketingMetrics.marketplaceLiquid) * 100;
          }
          
          // Average ticket
          if (marketingMetrics.salesCount > 0) {
            marketingMetrics.averageTicket = marketingMetrics.billing / marketingMetrics.salesCount;
          }
          
          // Profit after ads
          marketingMetrics.profitAfterAds = marketingMetrics.grossProfit - marketingMetrics.adSpend;
          
          // Margin after ads
          if (marketingMetrics.marketplaceLiquid > 0) {
            marketingMetrics.marginAfterAds = (marketingMetrics.profitAfterAds / marketingMetrics.marketplaceLiquid) * 100;
          }
          
          // TACOS (Total Advertising Cost of Sales)
          if (marketingMetrics.billing > 0) {
            marketingMetrics.tacos = (marketingMetrics.adSpend / marketingMetrics.billing) * 100;
          }
          
          // ROI
          if (marketingMetrics.adSpend > 0) {
            marketingMetrics.roi = ((marketingMetrics.grossProfit - marketingMetrics.adSpend) / marketingMetrics.adSpend) * 100;
          }
        }
        
        // Round all values
        Object.keys(marketingMetrics).forEach(key => {
          marketingMetrics[key as keyof typeof marketingMetrics] = Math.round(marketingMetrics[key as keyof typeof marketingMetrics] * 100) / 100;
        });
        
        console.log('Marketing metrics calculated:', marketingMetrics);
      }
    } catch (marketingError) {
      console.error('Failed to calculate marketing metrics, using defaults:', marketingError);
    }

    const metrics: DashboardMetrics = {
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      todayOrders,
      totalProducts,
      salesLast7Days,
      marketing: marketingMetrics
    };

    console.log('Final metrics being returned:', metrics);
    console.log('=== Dashboard metrics function completed successfully ===');

    return new Response(JSON.stringify(metrics), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== CRITICAL ERROR in get-dashboard-metrics function ===');
    console.error('Error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: 'Falha ao carregar dados do dashboard.',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}