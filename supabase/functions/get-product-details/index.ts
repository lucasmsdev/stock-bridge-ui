import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChannelStock {
  channel: string;
  channelId: string;
  stock: number;
  status: 'synchronized' | 'divergent' | 'not_published';
  images?: string[];
}

interface ProductDetailsResponse {
  product: any;
  centralStock: number;
  channelStocks: ChannelStock[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header missing' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { sku } = await req.json();
    
    if (!sku) {
      return new Response(JSON.stringify({ error: 'SKU is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Getting product details for SKU: ${sku}, User: ${user.id}`);

    // Get product from database
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('sku', sku)
      .eq('user_id', user.id)
      .single();

    if (productError || !product) {
      console.error('Product not found:', productError);
      return new Response(JSON.stringify({ error: 'Product not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's integrations
    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations')
      .select('id, platform, access_token')
      .eq('user_id', user.id)
      .not('access_token', 'is', null);

    if (integrationsError) {
      console.error('Error fetching integrations:', integrationsError);
      return new Response(JSON.stringify({ error: 'Error fetching integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const channelStocks: ChannelStock[] = [];

    // For each integration, fetch stock data from the respective platform
    for (const integration of integrations || []) {
      try {
        let channelStock: ChannelStock;

        if (integration.platform === 'mercadolivre') {
          channelStock = await getMercadoLivreStock(integration.access_token, sku);
        } else if (integration.platform === 'shopify') {
          channelStock = await getShopifyStock(integration.access_token, sku);
        } else if (integration.platform === 'shopee') {
          channelStock = await getShopeeStock(integration.access_token, sku);
        } else {
          // Unknown platform - mark as not published
          channelStock = {
            channel: integration.platform,
            channelId: '-',
            stock: 0,
            status: 'not_published'
          };
        }

        // Determine if stock is synchronized
        if (channelStock.channelId !== '-' && channelStock.stock !== product.stock) {
          channelStock.status = 'divergent';
        } else if (channelStock.channelId !== '-' && channelStock.stock === product.stock) {
          channelStock.status = 'synchronized';
        }

        channelStocks.push(channelStock);
      } catch (error) {
        console.error(`Error fetching stock for ${integration.platform}:`, error);
        // Add error entry for this channel
        channelStocks.push({
          channel: integration.platform,
          channelId: '-',
          stock: 0,
          status: 'not_published'
        });
      }
    }

    const response: ProductDetailsResponse = {
      product,
      centralStock: product.stock,
      channelStocks
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-product-details function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getMercadoLivreStock(accessToken: string, sku: string): Promise<ChannelStock> {
  try {
    // First, get user info to get the seller ID
    const userResponse = await fetch('https://api.mercadolibre.com/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Mercado Livre user API error: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    const sellerId = userData.id;

    // Search for items by the seller
    const searchResponse = await fetch(
      `https://api.mercadolibre.com/users/${sellerId}/items/search?limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error(`Mercado Livre search API error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    
    // Find item with matching SKU
    for (const itemId of searchData.results || []) {
      try {
        const itemResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (itemResponse.ok) {
          const itemData = await itemResponse.json();
          
          // Check if this item matches our SKU (using seller_custom_field or title)
          if (itemData.seller_custom_field === sku || itemId === sku) {
            // Extract images from the item
            const images = itemData.pictures ? itemData.pictures.map((pic: any) => pic.url || pic.secure_url).filter(Boolean) : [];
            
            return {
              channel: 'mercadolivre',
              channelId: itemId,
              stock: itemData.available_quantity || 0,
              status: 'synchronized', // Will be recalculated in main function
              images: images
            };
          }
        }
      } catch (itemError) {
        console.error(`Error fetching item ${itemId}:`, itemError);
        continue;
      }
    }

    // Item not found
    return {
      channel: 'mercadolivre',
      channelId: '-',
      stock: 0,
      status: 'not_published'
    };
  } catch (error) {
    console.error('Error in getMercadoLivreStock:', error);
    return {
      channel: 'mercadolivre',
      channelId: '-',
      stock: 0,
      status: 'not_published'
    };
  }
}

async function getShopifyStock(accessToken: string, sku: string): Promise<ChannelStock> {
  // TODO: Implement Shopify stock fetching
  // This is a placeholder - will need Shopify store domain and proper API integration
  return {
    channel: 'shopify',
    channelId: 'SHO987654321',
    stock: 5,
    status: 'synchronized' // Will be recalculated in main function
  };
}

async function getShopeeStock(accessToken: string, sku: string): Promise<ChannelStock> {
  // TODO: Implement Shopee stock fetching
  // This is a placeholder - Shopee API integration would go here
  return {
    channel: 'shopee',
    channelId: '-',
    stock: 0,
    status: 'not_published'
  };
}