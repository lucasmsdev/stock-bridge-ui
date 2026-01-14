import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Standardized order status
type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

// Standard order interface for all marketplaces
interface StandardOrder {
  order_id_channel: string;
  platform: string;
  status: OrderStatus;
  customer_name: string | null;
  customer_email: string | null;
  shipping_address: any;
  total_value: number;
  order_date: string;
  items: any[];
}

// Abstract provider interface - extensible for future marketplaces
interface MarketplaceOrderProvider {
  platform: string;
  fetchOrders(accessToken: string, integration: any, since: Date): Promise<StandardOrder[]>;
  mapStatus(platformStatus: string): OrderStatus;
}

// ================= MERCADO LIVRE PROVIDER =================
const MercadoLivreProvider: MarketplaceOrderProvider = {
  platform: 'mercadolivre',
  
  mapStatus(platformStatus: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'payment_required': 'pending',
      'payment_in_process': 'processing',
      'paid': 'paid',
      'shipped': 'shipped',
      'delivered': 'delivered',
      'cancelled': 'cancelled',
      'refunded': 'refunded',
    };
    return statusMap[platformStatus.toLowerCase()] || 'pending';
  },

  async fetchOrders(accessToken: string, integration: any, since: Date): Promise<StandardOrder[]> {
    const orders: StandardOrder[] = [];
    
    try {
      // Get user ID from Mercado Livre
      const meResponse = await fetch('https://api.mercadolibre.com/users/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (!meResponse.ok) {
        console.error('Failed to get ML user info:', await meResponse.text());
        return orders;
      }
      
      const meData = await meResponse.json();
      const sellerId = meData.id;
      
      // Format date for ML API
      const sinceStr = since.toISOString();
      
      // Fetch orders
      const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${sellerId}&order.date_created.from=${sinceStr}&sort=date_desc`;
      const ordersResponse = await fetch(ordersUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (!ordersResponse.ok) {
        console.error('Failed to fetch ML orders:', await ordersResponse.text());
        return orders;
      }
      
      const ordersData = await ordersResponse.json();
      
      for (const order of ordersData.results || []) {
        const totalValue = order.order_items?.reduce((sum: number, item: any) => 
          sum + (item.unit_price * item.quantity), 0) || order.total_amount || 0;
        
        orders.push({
          order_id_channel: order.id.toString(),
          platform: 'mercadolivre',
          status: this.mapStatus(order.status),
          customer_name: order.buyer?.nickname || order.buyer?.first_name || null,
          customer_email: order.buyer?.email || null,
          shipping_address: order.shipping?.receiver_address || null,
          total_value: totalValue,
          order_date: order.date_created,
          items: order.order_items || []
        });
      }
      
      console.log(`ML: Fetched ${orders.length} orders`);
    } catch (error) {
      console.error('Error fetching ML orders:', error);
    }
    
    return orders;
  }
};

// ================= AMAZON PROVIDER =================
const AmazonProvider: MarketplaceOrderProvider = {
  platform: 'amazon',
  
  mapStatus(platformStatus: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'pending': 'pending',
      'pendingavailability': 'pending',
      'unshipped': 'paid',
      'partiallyshipped': 'processing',
      'shipped': 'shipped',
      'invoiceunconfirmed': 'processing',
      'canceled': 'cancelled',
      'unfulfillable': 'cancelled',
    };
    return statusMap[platformStatus.toLowerCase()] || 'pending';
  },

  async fetchOrders(accessToken: string, integration: any, since: Date): Promise<StandardOrder[]> {
    const orders: StandardOrder[] = [];
    
    try {
      const marketplaceId = integration.marketplace_id || 'ATVPDKIKX0DER';
      const region = Deno.env.get('AMAZON_REGION') || 'na';
      
      // Build SP-API endpoint based on region
      const endpoints: Record<string, string> = {
        'na': 'https://sellingpartnerapi-na.amazon.com',
        'eu': 'https://sellingpartnerapi-eu.amazon.com',
        'fe': 'https://sellingpartnerapi-fe.amazon.com',
      };
      const baseUrl = endpoints[region] || endpoints['na'];
      
      // Format date for Amazon API
      const sinceStr = since.toISOString();
      
      // Fetch orders using SP-API
      const ordersUrl = `${baseUrl}/orders/v0/orders?MarketplaceIds=${marketplaceId}&CreatedAfter=${encodeURIComponent(sinceStr)}`;
      const ordersResponse = await fetch(ordersUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json'
        }
      });
      
      if (!ordersResponse.ok) {
        console.error('Failed to fetch Amazon orders:', await ordersResponse.text());
        return orders;
      }
      
      const ordersData = await ordersResponse.json();
      
      for (const order of ordersData.payload?.Orders || []) {
        // Fetch order items
        let orderItems: any[] = [];
        try {
          const itemsUrl = `${baseUrl}/orders/v0/orders/${order.AmazonOrderId}/orderItems`;
          const itemsResponse = await fetch(itemsUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'x-amz-access-token': accessToken,
              'Content-Type': 'application/json'
            }
          });
          
          if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();
            orderItems = itemsData.payload?.OrderItems || [];
          }
        } catch (e) {
          console.error('Error fetching order items:', e);
        }
        
        const totalValue = parseFloat(order.OrderTotal?.Amount || '0');
        
        orders.push({
          order_id_channel: order.AmazonOrderId,
          platform: 'amazon',
          status: this.mapStatus(order.OrderStatus),
          customer_name: order.BuyerInfo?.BuyerName || null,
          customer_email: order.BuyerInfo?.BuyerEmail || null,
          shipping_address: order.ShippingAddress || null,
          total_value: totalValue,
          order_date: order.PurchaseDate,
          items: orderItems.map((item: any) => ({
            id: item.OrderItemId,
            seller_sku: item.SellerSKU,
            title: item.Title,
            quantity: item.QuantityOrdered,
            unit_price: parseFloat(item.ItemPrice?.Amount || '0') / (item.QuantityOrdered || 1)
          }))
        });
      }
      
      console.log(`Amazon: Fetched ${orders.length} orders`);
    } catch (error) {
      console.error('Error fetching Amazon orders:', error);
    }
    
    return orders;
  }
};

// ================= SHOPIFY PROVIDER =================
const ShopifyProvider: MarketplaceOrderProvider = {
  platform: 'shopify',
  
  mapStatus(platformStatus: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'pending': 'pending',
      'authorized': 'processing',
      'paid': 'paid',
      'partially_paid': 'processing',
      'partially_refunded': 'refunded',
      'refunded': 'refunded',
      'voided': 'cancelled',
    };
    return statusMap[platformStatus.toLowerCase()] || 'pending';
  },

  async fetchOrders(accessToken: string, integration: any, since: Date): Promise<StandardOrder[]> {
    const orders: StandardOrder[] = [];
    
    try {
      const shopDomain = integration.shop_domain;
      if (!shopDomain) {
        console.error('No shop_domain found for Shopify integration');
        return orders;
      }
      
      // Format date for Shopify API
      const sinceStr = since.toISOString();
      
      // Fetch orders from Shopify Admin API
      const ordersUrl = `https://${shopDomain}.myshopify.com/admin/api/2024-01/orders.json?created_at_min=${sinceStr}&status=any`;
      const ordersResponse = await fetch(ordersUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });
      
      if (!ordersResponse.ok) {
        console.error('Failed to fetch Shopify orders:', await ordersResponse.text());
        return orders;
      }
      
      const ordersData = await ordersResponse.json();
      
      for (const order of ordersData.orders || []) {
        const totalValue = parseFloat(order.total_price || '0');
        
        // Map fulfillment status to our standard
        let status: OrderStatus = this.mapStatus(order.financial_status);
        if (order.fulfillment_status === 'fulfilled') {
          status = 'delivered';
        } else if (order.fulfillment_status === 'partial') {
          status = 'shipped';
        }
        if (order.cancelled_at) {
          status = 'cancelled';
        }
        
        orders.push({
          order_id_channel: order.id.toString(),
          platform: 'shopify',
          status,
          customer_name: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : null,
          customer_email: order.customer?.email || order.email || null,
          shipping_address: order.shipping_address || null,
          total_value: totalValue,
          order_date: order.created_at,
          items: (order.line_items || []).map((item: any) => ({
            id: item.id.toString(),
            seller_sku: item.sku || '',
            title: item.title,
            quantity: item.quantity,
            unit_price: parseFloat(item.price || '0')
          }))
        });
      }
      
      console.log(`Shopify: Fetched ${orders.length} orders`);
    } catch (error) {
      console.error('Error fetching Shopify orders:', error);
    }
    
    return orders;
  }
};

// ================= SHOPEE PROVIDER (PLACEHOLDER) =================
const ShopeeProvider: MarketplaceOrderProvider = {
  platform: 'shopee',
  
  mapStatus(platformStatus: string): OrderStatus {
    // TODO: Implement when Shopee integration is ready
    const statusMap: Record<string, OrderStatus> = {
      'unpaid': 'pending',
      'ready_to_ship': 'paid',
      'processed': 'processing',
      'shipped': 'shipped',
      'completed': 'delivered',
      'cancelled': 'cancelled',
      'in_cancel': 'cancelled',
    };
    return statusMap[platformStatus.toLowerCase()] || 'pending';
  },

  async fetchOrders(accessToken: string, integration: any, since: Date): Promise<StandardOrder[]> {
    // TODO: Implement when Shopee integration is ready
    console.log('Shopee provider not yet implemented');
    return [];
  }
};

// Provider registry - easy to extend
const providers: Record<string, MarketplaceOrderProvider> = {
  'mercadolivre': MercadoLivreProvider,
  'amazon': AmazonProvider,
  'shopify': ShopifyProvider,
  'shopee': ShopeeProvider,
};

// Helper function to refresh tokens before syncing
async function refreshTokensForIntegration(
  supabase: any, 
  integration: any
): Promise<{ success: boolean; accessToken: string | null; error?: string }> {
  const platform = integration.platform;
  
  // Decrypt access token
  const { data: accessToken, error: decryptError } = await supabase.rpc('decrypt_token', { 
    encrypted_token: integration.encrypted_access_token 
  });
  
  // Shopify tokens don't expire
  if (platform === 'shopify') {
    return { success: !!accessToken, accessToken, error: accessToken ? undefined : 'Failed to decrypt token' };
  }
  
  // Check if we have a refresh token
  if (!integration.encrypted_refresh_token) {
    console.log(`⚠️ ${platform}: No refresh token available`);
    return { success: !!accessToken, accessToken, error: accessToken ? undefined : 'No tokens available' };
  }
  
  // Decrypt refresh token
  const { data: refreshToken, error: decryptError } = await supabase.rpc('decrypt_token', { 
    encrypted_token: integration.encrypted_refresh_token 
  });
  
  if (decryptError || !refreshToken) {
    console.error(`❌ ${platform}: Failed to decrypt refresh token`);
    return { success: false, accessToken: null, error: 'Failed to decrypt refresh token' };
  }
  
  // Platform-specific token refresh
  try {
    let newTokenData: { access_token?: string; refresh_token?: string } | null = null;
    
    if (platform === 'mercadolivre') {
      const appId = Deno.env.get('MERCADOLIVRE_APP_ID');
      const secretKey = Deno.env.get('MERCADOLIVRE_SECRET_KEY');
      
      if (!appId || !secretKey) {
        throw new Error('Mercado Livre credentials not configured');
      }
      
      console.log(`🔄 ${platform}: Refreshing token...`);
      const response = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: appId,
          client_secret: secretKey,
          refresh_token: refreshToken,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ ${platform}: Refresh failed - ${errorText}`);
        throw new Error(`Refresh failed: ${response.status}`);
      }
      
      const data = await response.json();
      newTokenData = { access_token: data.access_token, refresh_token: data.refresh_token || refreshToken };
      
    } else if (platform === 'amazon') {
      const clientId = Deno.env.get('AMAZON_CLIENT_ID');
      const clientSecret = Deno.env.get('AMAZON_CLIENT_SECRET');
      
      if (!clientId || !clientSecret) {
        throw new Error('Amazon credentials not configured');
      }
      
      console.log(`🔄 ${platform}: Refreshing token...`);
      const response = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ ${platform}: Refresh failed - ${errorText}`);
        throw new Error(`Refresh failed: ${response.status}`);
      }
      
      const data = await response.json();
      newTokenData = { access_token: data.access_token };
      
    } else if (platform === 'shopee') {
      console.log(`⚠️ ${platform}: Token refresh not implemented yet`);
      return { success: false, accessToken: null, error: 'Shopee refresh not implemented' };
    }
    
    if (newTokenData && newTokenData.access_token) {
      // Encrypt and save new tokens
      const { data: encryptedAccessToken } = await supabase.rpc('encrypt_token', { 
        token: newTokenData.access_token 
      });
      
      const updateData: any = {
        encrypted_access_token: encryptedAccessToken,
        updated_at: new Date().toISOString()
      };
      
      if (newTokenData.refresh_token) {
        const { data: encryptedRefreshToken } = await supabase.rpc('encrypt_token', { 
          token: newTokenData.refresh_token 
        });
        updateData.encrypted_refresh_token = encryptedRefreshToken;
      }
      
      await supabase.from('integrations').update(updateData).eq('id', integration.id);
      console.log(`✅ ${platform}: Token refreshed successfully`);
      
      return { success: true, accessToken: newTokenData.access_token };
    }
    
    return { success: false, accessToken: null, error: 'No access token in response' };
    
  } catch (error) {
    console.error(`❌ ${platform}: Token refresh error - ${error.message}`);
    return { success: false, accessToken: null, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for options
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body provided, use defaults
    }

    const platform = body.platform; // Optional: sync only specific platform
    const daysSince = body.days_since || 30; // Default: last 30 days
    const allUsers = body.all_users || false; // For cron job execution
    const skipTokenRefresh = body.skip_token_refresh || false; // Skip refresh if already done
    
    console.log(`🚀 Starting order sync - daysSince: ${daysSince}, allUsers: ${allUsers}`);
    
    const since = new Date();
    since.setDate(since.getDate() - daysSince);

    let usersToSync: { id: string }[] = [];

    // Check if this is a cron job call (all_users mode)
    if (allUsers) {
      console.log('CRON MODE: Syncing orders for all users with integrations');
      
      // Get all unique user_ids with integrations
      const { data: integrations, error: intError } = await supabase
        .from('integrations')
        .select('user_id')
        .not('access_token', 'is', null);
      
      if (intError) {
        console.error('Error fetching users with integrations:', intError);
        return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Get unique user IDs
      const uniqueUserIds = [...new Set(integrations?.map(i => i.user_id) || [])];
      usersToSync = uniqueUserIds.map(id => ({ id }));
      
      console.log(`Found ${usersToSync.length} users with integrations`);
    } else {
      // Single user mode - require authentication
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      usersToSync = [{ id: user.id }];
    }

    let grandTotalSynced = 0;
    let grandNewOrders = 0;
    const allResults: any[] = [];

    // Process each user
    for (const user of usersToSync) {
      console.log(`Syncing orders for user: ${user.id}`);

      // Get user's integrations
      const integrationsQuery = supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id);
      
      if (platform) {
        integrationsQuery.eq('platform', platform);
      }
      
      const { data: integrations, error: integrationError } = await integrationsQuery;

      if (integrationError) {
        console.error('Error fetching integrations:', integrationError);
        continue;
      }

      if (!integrations || integrations.length === 0) {
        continue;
      }

      let totalSynced = 0;
      let newOrders = 0;
      const results: any[] = [];

    // Process each integration
    for (const integration of integrations) {
      const provider = providers[integration.platform];
      
      if (!provider) {
        console.log(`No provider for platform: ${integration.platform}`);
        results.push({
          platform: integration.platform,
          status: 'skipped',
          message: 'Provider not implemented'
        });
        continue;
      }

      try {
        // Refresh tokens before syncing (automatic token validation)
        console.log(`🔐 Validating tokens for ${integration.platform}...`);
        const tokenResult = await refreshTokensForIntegration(supabase, integration);
        
        if (!tokenResult.success || !tokenResult.accessToken) {
          console.error(`❌ Token validation failed for ${integration.platform}: ${tokenResult.error}`);
          results.push({
            platform: integration.platform,
            status: 'error',
            message: `Token error: ${tokenResult.error || 'No valid token'}`,
            needsReconnect: true
          });
          continue;
        }
        
        const accessToken = tokenResult.accessToken;
        console.log(`✅ Token validated for ${integration.platform}`);

        // Fetch orders from marketplace
        const orders = await provider.fetchOrders(accessToken, integration, since);
        
        let platformNew = 0;
        
        // Upsert orders to database
        for (const order of orders) {
          // Check if order already exists
          const { data: existing } = await supabase
            .from('orders')
            .select('id')
            .eq('user_id', user.id)
            .eq('order_id_channel', order.order_id_channel)
            .eq('platform', order.platform)
            .maybeSingle();

          if (existing) {
            // Update existing order
            await supabase
              .from('orders')
              .update({
                status: order.status,
                customer_name: order.customer_name,
                customer_email: order.customer_email,
                shipping_address: order.shipping_address,
                total_value: order.total_value,
                items: order.items,
                last_sync_at: new Date().toISOString()
              })
              .eq('id', existing.id);
          } else {
            // Insert new order
            const { error: insertError } = await supabase
              .from('orders')
              .insert({
                user_id: user.id,
                order_id_channel: order.order_id_channel,
                platform: order.platform,
                status: order.status,
                customer_name: order.customer_name,
                customer_email: order.customer_email,
                shipping_address: order.shipping_address,
                total_value: order.total_value,
                order_date: order.order_date,
                items: order.items,
                last_sync_at: new Date().toISOString()
              });

            if (!insertError) {
              platformNew++;
              newOrders++;
            }
          }
          
          totalSynced++;
        }

        results.push({
          platform: integration.platform,
          account: integration.account_name || integration.platform,
          status: 'success',
          fetched: orders.length,
          new: platformNew
        });

        console.log(`${integration.platform}: Synced ${orders.length} orders, ${platformNew} new`);

      } catch (error) {
        console.error(`Error syncing ${integration.platform}:`, error);
        results.push({
          platform: integration.platform,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Aggregate results for this user
    grandTotalSynced += totalSynced;
    grandNewOrders += newOrders;
    allResults.push({
      user_id: user.id,
      synced: totalSynced,
      new_orders: newOrders,
      results
    });
  }

    return new Response(JSON.stringify({
      message: 'Sync completed',
      total_synced: grandTotalSynced,
      new_orders: grandNewOrders,
      users_processed: usersToSync.length,
      results: allResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in sync-orders:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
