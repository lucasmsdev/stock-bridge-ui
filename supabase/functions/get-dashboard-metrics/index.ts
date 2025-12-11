import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DashboardMetrics {
  todayRevenue: number;
  todayOrders: number;
  totalProducts: number;
  totalStock: number;
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

function calculateDateRange(period: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  // Use UTC dates consistently
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  
  let startDate: Date;
  let endDate: Date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  
  switch(period) {
    case 'today':
      startDate = todayStart;
      break;
    case '7days':
      startDate = new Date(todayStart);
      startDate.setUTCDate(startDate.getUTCDate() - 7);
      break;
    case '30days':
      startDate = new Date(todayStart);
      startDate.setUTCDate(startDate.getUTCDate() - 30);
      break;
    case 'this_month':
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
      break;
    case 'last_month':
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
      break;
    case 'custom':
      if (!customStart || !customEnd) {
        throw new Error('Custom period requires start and end dates');
      }
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      endDate.setUTCDate(endDate.getUTCDate() + 1); // Include the end date
      break;
    default:
      startDate = new Date(todayStart);
      startDate.setUTCDate(startDate.getUTCDate() - 7);
  }
  
  return { startDate, endDate };
}

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Starting get-dashboard-metrics function ===');
    
    // Parse request body for filters
    let marketplace = 'all';
    let period = '7days';
    let customStartDate: string | undefined;
    let customEndDate: string | undefined;
    
    try {
      const body = await req.json();
      marketplace = body.marketplace || 'all';
      period = body.period || '7days';
      customStartDate = body.startDate;
      customEndDate = body.endDate;
      console.log('Filters received:', { marketplace, period, customStartDate, customEndDate });
    } catch (e) {
      console.log('No filters provided, using defaults');
    }
    
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

    // Calculate date range based on filters
    const { startDate, endDate } = calculateDateRange(period, customStartDate, customEndDate);
    console.log('Date range:', { startDate: startDate.toISOString(), endDate: endDate.toISOString() });

    // Initialize default metrics
    let todayRevenue = 0;
    let todayOrders = 0;
    let totalProducts = 0;
    let totalStock = 0;
    let salesLast7Days: Array<{date: string; revenue: number}> = [];

    // Get today's dates for "today" metrics - using UTC to match database
    const now = new Date();
    // Create today start in UTC
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    
    console.log('Today UTC range:', { todayStart: todayStart.toISOString(), todayEnd: todayEnd.toISOString() });

    try {
      console.log('Fetching today orders...');
      // Get today's revenue and orders count
      let todayQuery = supabase
        .from('orders')
        .select('total_value')
        .eq('user_id', user.id)
        .gte('order_date', todayStart.toISOString())
        .lt('order_date', todayEnd.toISOString());
      
      // Apply marketplace filter if not "all"
      if (marketplace && marketplace !== 'all') {
        todayQuery = todayQuery.eq('platform', marketplace);
      }
      
      const { data: todayData, error: todayError } = await todayQuery;

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
      console.log('Fetching products and stock...');
      // Get total products count and stock
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, stock')
        .eq('user_id', user.id);

      if (productsError) {
        console.error('Error fetching products:', productsError);
      } else {
        totalProducts = productsData?.length || 0;
        totalStock = productsData?.reduce((sum, p) => sum + (p.stock || 0), 0) || 0;
        console.log(`Total products: ${totalProducts}, Total stock: ${totalStock}`);
      }
    } catch (productsError) {
      console.error('Failed to fetch products, using defaults:', productsError);
    }

    try {
      console.log('Fetching sales data for selected period...');
      // Get sales data for the selected period
      let salesQuery = supabase
        .from('orders')
        .select('order_date, total_value')
        .eq('user_id', user.id)
        .gte('order_date', startDate.toISOString())
        .lt('order_date', endDate.toISOString())
        .order('order_date', { ascending: true });
      
      // Apply marketplace filter if not "all"
      if (marketplace && marketplace !== 'all') {
        salesQuery = salesQuery.eq('platform', marketplace);
      }
      
      const { data: salesDataResult, error: salesError } = await salesQuery;

      if (salesError) {
        console.error('Error fetching sales data:', salesError);
      } else {
        // Group sales by date
        const salesByDate = new Map<string, number>();
        
        // Calculate number of days in the period
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Initialize all days in the range with 0 using UTC
        for (let i = 0; i < daysDiff; i++) {
          const date = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));
          const dateStr = date.toISOString().split('T')[0];
          salesByDate.set(dateStr, 0);
        }
        
        // Add actual sales data
        if (salesDataResult && salesDataResult.length > 0) {
          salesDataResult.forEach(order => {
            const dateStr = order.order_date.split('T')[0];
            const currentValue = salesByDate.get(dateStr) || 0;
            salesByDate.set(dateStr, currentValue + Number(order.total_value));
          });
        }
        
        // Convert to array format
        salesLast7Days = Array.from(salesByDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, revenue]) => ({
            date,
            revenue: Math.round(revenue * 100) / 100
          }));
        
        console.log(`Generated ${salesLast7Days.length} days of sales data with total orders: ${salesDataResult?.length || 0}`);
      }
    } catch (salesError) {
      console.error('Failed to fetch sales data, using defaults:', salesError);
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
      console.log('Fetching comprehensive marketing metrics...');
      
      // Get all orders for the selected period for comprehensive metrics
      let ordersQuery = supabase
        .from('orders')
        .select('total_value, items, platform')
        .eq('user_id', user.id)
        .gte('order_date', startDate.toISOString())
        .lt('order_date', endDate.toISOString());
      
      // Apply marketplace filter if not "all"
      if (marketplace && marketplace !== 'all') {
        ordersQuery = ordersQuery.eq('platform', marketplace);
      }
      
      const { data: ordersData, error: ordersError } = await ordersQuery;

      if (!ordersError && ordersData && ordersData.length > 0) {
        console.log(`Found ${ordersData.length} orders for marketing metrics`);
        
        // Calculate billing (total revenue)
        marketingMetrics.billing = ordersData.reduce((sum, order) => sum + Number(order.total_value), 0);
        marketingMetrics.salesCount = ordersData.length;
        
        // Calculate units sold
        marketingMetrics.unitsSold = ordersData.reduce((sum, order) => {
          const items = order.items || [];
          return sum + items.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 1), 0);
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
                totalCost += Number(product.cost_price) * (item.quantity || 1);
              } else {
                // Assume 30% cost if no product match
                totalCost += Number(item.unit_price || 0) * (item.quantity || 1) * 0.3;
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
      totalStock,
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