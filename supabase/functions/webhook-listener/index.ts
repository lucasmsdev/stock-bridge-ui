import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderItem {
  id: string;
  seller_sku: string;
  quantity: number;
  unit_price: number;
}

interface OrderData {
  id: string;
  buyer: {
    id: number;
  };
  seller: {
    id: number;
  };
  order_items: OrderItem[];
  status: string;
  date_closed: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`Webhook received: ${req.method} ${req.url}`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get Mercado Livre secret key for signature validation
    const mercadoLivreSecret = Deno.env.get('MERCADOLIVRE_SECRET_KEY');
    if (!mercadoLivreSecret) {
      console.error('MERCADOLIVRE_SECRET_KEY not configured');
      return new Response(JSON.stringify({ error: 'Configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse the webhook notification
    const body = await req.text();
    const notification = JSON.parse(body);
    
    console.log('Webhook notification received:', notification);

    // Validate webhook signature (Mercado Livre security)
    const signature = req.headers.get('x-signature');
    if (signature) {
      const expectedSignature = createHmac('sha256', mercadoLivreSecret)
        .update(body)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Process only order notifications
    if (notification.topic !== 'orders_v2') {
      console.log(`Ignoring notification with topic: ${notification.topic}`);
      return new Response(JSON.stringify({ message: 'Notification ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract order resource URL
    const resourceUrl = notification.resource;
    if (!resourceUrl) {
      console.error('No resource URL in notification');
      return new Response(JSON.stringify({ error: 'No resource URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get order details from Mercado Livre API
    const orderDetails = await fetchOrderDetails(resourceUrl);
    if (!orderDetails) {
      console.error('Failed to fetch order details');
      return new Response(JSON.stringify({ error: 'Failed to fetch order details' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Order details fetched:', orderDetails);

    // Process only closed/paid orders
    const validStatuses = ['paid', 'shipped', 'delivered'];
    if (!validStatuses.includes(orderDetails.status)) {
      console.log(`Order status ${orderDetails.status} not processed`);
      return new Response(JSON.stringify({ message: 'Order status not processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the user who owns this Mercado Livre integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('user_id, access_token')
      .eq('platform', 'mercadolivre')
      .not('access_token', 'is', null)
      .single();

    if (integrationError || !integration) {
      console.error('No Mercado Livre integration found:', integrationError);
      return new Response(JSON.stringify({ error: 'No integration found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing order for user: ${integration.user_id}`);

    // Process each item in the order
    for (const item of orderDetails.order_items) {
      if (!item.seller_sku) {
        console.log(`Skipping item ${item.id} - no seller_sku`);
        continue;
      }

      // Find the product in our database
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('sku', item.seller_sku)
        .eq('user_id', integration.user_id)
        .single();

      if (productError || !product) {
        console.log(`Product not found for SKU: ${item.seller_sku}`);
        continue;
      }

      // Calculate new stock
      const newStock = Math.max(0, product.stock - item.quantity);
      
      console.log(`Updating stock for SKU ${item.seller_sku}: ${product.stock} -> ${newStock}`);

      // Update central stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ 
          stock: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);

      if (updateError) {
        console.error(`Error updating stock for ${item.seller_sku}:`, updateError);
        continue;
      }

      // Propagate stock update to other channels
      await propagateStockUpdate(supabase, integration.user_id, item.seller_sku, newStock);
    }

    return new Response(JSON.stringify({ 
      message: 'Webhook processed successfully',
      orderId: orderDetails.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function fetchOrderDetails(resourceUrl: string): Promise<OrderData | null> {
  try {
    // The resource URL is relative, we need to make it absolute
    const fullUrl = `https://api.mercadolibre.com${resourceUrl}`;
    
    console.log(`Fetching order details from: ${fullUrl}`);
    
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch order details: ${response.status}`);
      return null;
    }

    const orderData = await response.json();
    return orderData;
  } catch (error) {
    console.error('Error fetching order details:', error);
    return null;
  }
}

async function propagateStockUpdate(
  supabase: any, 
  userId: string, 
  sku: string, 
  newStock: number
): Promise<void> {
  try {
    console.log(`Propagating stock update for SKU ${sku} to other channels`);

    // Get all other active integrations for this user (excluding Mercado Livre)
    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('platform, access_token')
      .eq('user_id', userId)
      .neq('platform', 'mercadolivre')
      .not('access_token', 'is', null);

    if (error) {
      console.error('Error fetching integrations:', error);
      return;
    }

    if (!integrations || integrations.length === 0) {
      console.log('No other integrations found to sync');
      return;
    }

    // Update stock in each platform
    for (const integration of integrations) {
      try {
        if (integration.platform === 'shopify') {
          await updateShopifyStock(integration.access_token, sku, newStock);
        } else if (integration.platform === 'shopee') {
          await updateShopeeStock(integration.access_token, sku, newStock);
        }
        // Add more platforms as needed
        
        console.log(`Stock updated in ${integration.platform} for SKU ${sku}`);
      } catch (platformError) {
        console.error(`Error updating ${integration.platform} stock:`, platformError);
        // Continue with other platforms even if one fails
      }
    }
  } catch (error) {
    console.error('Error in propagateStockUpdate:', error);
  }
}

async function updateShopifyStock(accessToken: string, sku: string, newStock: number): Promise<void> {
  // TODO: Implement Shopify stock update
  // This would involve:
  // 1. Finding the product variant by SKU
  // 2. Updating the inventory level
  console.log(`TODO: Update Shopify stock for SKU ${sku} to ${newStock}`);
}

async function updateShopeeStock(accessToken: string, sku: string, newStock: number): Promise<void> {
  // TODO: Implement Shopee stock update
  // This would involve:
  // 1. Finding the product by SKU
  // 2. Updating the stock quantity
  console.log(`TODO: Update Shopee stock for SKU ${sku} to ${newStock}`);
}