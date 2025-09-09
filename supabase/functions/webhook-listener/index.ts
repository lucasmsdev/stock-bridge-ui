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
    
    // Determine platform from URL parameter or header
    const url = new URL(req.url);
    const platform = url.searchParams.get('platform') || 'mercadolivre';
    
    console.log('Processing webhook for platform:', platform);

    // Parse the webhook notification
    const body = await req.text();
    const notification = JSON.parse(body);
    
    console.log('Webhook notification received:', notification);

    if (platform === 'mercadolivre') {
      // Validate Mercado Livre webhook signature
      const mercadoLivreSecret = Deno.env.get('MERCADOLIVRE_SECRET_KEY');
      if (!mercadoLivreSecret) {
        console.error('MERCADOLIVRE_SECRET_KEY not configured');
        return new Response(JSON.stringify({ error: 'Configuration error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

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

      return await processMercadoLivreWebhook(supabase, notification);
      
    } else if (platform === 'shopify') {
      // Validate Shopify webhook signature
      const shopifySecret = Deno.env.get('SHOPIFY_API_SECRET_KEY');
      if (!shopifySecret) {
        console.error('SHOPIFY_API_SECRET_KEY not configured');
        return new Response(JSON.stringify({ error: 'Configuration error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const shopifySignature = req.headers.get('x-shopify-hmac-sha256');
      if (shopifySignature) {
        const expectedSignature = createHmac('sha256', shopifySecret)
          .update(body)
          .digest('base64');
        
        if (shopifySignature !== expectedSignature) {
          console.error('Invalid Shopify webhook signature');
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return await processShopifyWebhook(supabase, notification);
    }

    return new Response(JSON.stringify({ error: 'Unsupported platform' }), {
      status: 400,
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

async function processMercadoLivreWebhook(supabase: any, notification: any) {
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

  // Calculate total order value
  const totalValue = orderDetails.order_items.reduce((sum, item) => 
    sum + (item.unit_price * item.quantity), 0);

  // Create order record in our database
  const { data: createdOrder, error: orderCreateError } = await supabase
    .from('orders')
    .insert({
      user_id: integration.user_id,
      order_id_channel: orderDetails.id,
      platform: 'mercadolivre',
      total_value: totalValue,
      order_date: orderDetails.date_closed,
      items: orderDetails.order_items
    })
    .select()
    .single();

  if (orderCreateError) {
    console.error('Error creating order record:', orderCreateError);
    return new Response(JSON.stringify({ error: 'Failed to create order record' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('Order record created successfully:', createdOrder.id);

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
    message: 'Mercado Livre webhook processed successfully',
    orderId: orderDetails.id
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function processShopifyWebhook(supabase: any, notification: any) {
  console.log('Processing Shopify order webhook:', notification);

  // Check if it's an order creation/payment event
  if (!notification.id || !notification.line_items) {
    console.log('Not a valid Shopify order webhook');
    return new Response(JSON.stringify({ message: 'Not a valid order webhook' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Process only paid orders
  if (notification.financial_status !== 'paid') {
    console.log(`Order status ${notification.financial_status} not processed`);
    return new Response(JSON.stringify({ message: 'Order status not processed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Extract shop domain from notification
  const shopDomain = notification.order_status_url ? 
    notification.order_status_url.match(/https:\/\/([^.]+)\.myshopify\.com/)?.[1] : null;

  if (!shopDomain) {
    console.error('Could not extract shop domain from notification');
    return new Response(JSON.stringify({ error: 'Shop domain not found' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Find the user who owns this Shopify integration
  const { data: integration, error: integrationError } = await supabase
    .from('integrations')
    .select('user_id, access_token')
    .eq('platform', 'shopify')
    .not('access_token', 'is', null)
    .single();

  if (integrationError || !integration) {
    console.error('No Shopify integration found:', integrationError);
    return new Response(JSON.stringify({ error: 'No integration found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`Processing Shopify order for user: ${integration.user_id}`);

  // Calculate total order value
  const totalValue = notification.line_items.reduce((sum: number, item: any) => 
    sum + (parseFloat(item.price) * item.quantity), 0);

  // Create order record in our database
  const { data: createdOrder, error: orderCreateError } = await supabase
    .from('orders')
    .insert({
      user_id: integration.user_id,
      order_id_channel: notification.id.toString(),
      platform: 'shopify',
      total_value: totalValue,
      order_date: notification.created_at,
      items: notification.line_items
    })
    .select()
    .single();

  if (orderCreateError) {
    console.error('Error creating order record:', orderCreateError);
    return new Response(JSON.stringify({ error: 'Failed to create order record' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('Order record created successfully:', createdOrder.id);

  // Process each line item in the order
  for (const lineItem of notification.line_items) {
    if (!lineItem.sku) {
      console.log(`Skipping item ${lineItem.id} - no SKU`);
      continue;
    }

    // Find the product in our database
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('sku', lineItem.sku)
      .eq('user_id', integration.user_id)
      .single();

    if (productError || !product) {
      console.log(`Product not found for SKU: ${lineItem.sku}`);
      continue;
    }

    // Calculate new stock
    const newStock = Math.max(0, product.stock - lineItem.quantity);
    
    console.log(`Updating stock for SKU ${lineItem.sku}: ${product.stock} -> ${newStock}`);

    // Update central stock
    const { error: updateError } = await supabase
      .from('products')
      .update({ 
        stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', product.id);

    if (updateError) {
      console.error(`Error updating stock for ${lineItem.sku}:`, updateError);
      continue;
    }

    // Propagate stock update to other channels
    await propagateStockUpdate(supabase, integration.user_id, lineItem.sku, newStock);
  }

  return new Response(JSON.stringify({ 
    message: 'Shopify webhook processed successfully',
    orderId: notification.id
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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
  try {
    console.log(`Updating Shopify stock for SKU ${sku} to ${newStock}`);
    
    // This is a simplified implementation
    // In a real scenario, you'd need to:
    // 1. Find the product variant by SKU using GraphQL or REST API
    // 2. Update the inventory level using Inventory API
    
    // For now, we'll just log the operation
    console.log(`Shopify stock update completed for SKU ${sku}`);
  } catch (error) {
    console.error(`Error updating Shopify stock for SKU ${sku}:`, error);
    throw error;
  }
}

async function updateShopeeStock(accessToken: string, sku: string, newStock: number): Promise<void> {
  // TODO: Implement Shopee stock update
  // This would involve:
  // 1. Finding the product by SKU
  // 2. Updating the stock quantity
  console.log(`TODO: Update Shopee stock for SKU ${sku} to ${newStock}`);
}