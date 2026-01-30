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
  status: 'synchronized' | 'divergent' | 'not_published' | 'synced' | 'error' | 'not_found' | 'token_expired';
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
    const { sku, id } = await req.json();
    
    if (!sku && !id) {
      return new Response(JSON.stringify({ error: 'SKU or ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Getting product details for ${id ? 'ID' : 'SKU'}: ${id || sku}, User: ${user.id}`);

    // Get product from database - search by ID first, then by SKU
    let productQuery = supabase
      .from('products')
      .select('id, name, sku, stock, user_id, created_at, updated_at, cost_price, selling_price, ad_spend, image_url, images')
      .eq('user_id', user.id);

    if (id) {
      productQuery = productQuery.eq('id', id);
    } else if (sku) {
      productQuery = productQuery.eq('sku', sku);
    }

    const { data: product, error: productError } = await productQuery.single();

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
      .select('id, platform, encrypted_access_token, encrypted_refresh_token, shop_domain, marketplace_id, selling_partner_id')
      .eq('user_id', user.id)
      .not('encrypted_access_token', 'is', null);

    if (integrationsError) {
      console.error('Error fetching integrations:', integrationsError);
      return new Response(JSON.stringify({ error: 'Error fetching integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get product listings for Shopify
    const { data: productListings } = await supabase
      .from('product_listings')
      .select('id, platform, platform_product_id, platform_variant_id, integration_id')
      .eq('product_id', product.id)
      .eq('user_id', user.id);

    const channelStocks: ChannelStock[] = [];

    // For each integration, fetch stock data from the respective platform
    for (const integration of integrations || []) {
      try {
        // Decrypt tokens
        const { data: accessToken, error: decryptAccessError } = await supabase.rpc('decrypt_token', {
          encrypted_token: integration.encrypted_access_token
        });
        
        if (decryptAccessError || !accessToken) {
          console.error(`Failed to decrypt token for ${integration.platform}:`, decryptAccessError);
          channelStocks.push({
            channel: integration.platform,
            channelId: '-',
            stock: 0,
            status: 'token_expired' as const
          });
          continue;
        }
        
        let refreshToken = null;
        if (integration.encrypted_refresh_token) {
          const { data: decryptedRefresh } = await supabase.rpc('decrypt_token', {
            encrypted_token: integration.encrypted_refresh_token
          });
          refreshToken = decryptedRefresh;
        }
        
        let channelStock: ChannelStock;

        if (integration.platform === 'mercadolivre') {
          channelStock = await getMercadoLivreStock(
            accessToken, 
            sku, 
            refreshToken,
            integration.id,
            supabase
          );
        } else if (integration.platform === 'shopify') {
          // Find the product listing for this integration
          const shopifyListing = productListings?.find(
            l => l.platform === 'shopify' && l.integration_id === integration.id
          );
          channelStock = await getShopifyStock(
            accessToken, 
            sku,
            integration.shop_domain,
            shopifyListing?.platform_product_id || null
          );
        } else if (integration.platform === 'shopee') {
          channelStock = await getShopeeStock(accessToken, sku);
        } else if (integration.platform === 'amazon') {
          // Find the product listing for this integration
          const amazonListing = productListings?.find(
            l => l.platform === 'amazon' && l.integration_id === integration.id
          );
          channelStock = await getAmazonStock(
            refreshToken,
            sku,
            integration.selling_partner_id || '',
            integration.marketplace_id || 'A2Q3Y263D00KWC',
            amazonListing?.platform_product_id || null
          );
        } else {
          // Unknown platform - mark as not published
          channelStock = {
            channel: 'amazon',
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

async function refreshMercadoLivreToken(refreshToken: string, integrationId: string, supabase: any): Promise<string | null> {
  try {
    const appId = Deno.env.get('MERCADOLIVRE_APP_ID');
    const secretKey = Deno.env.get('MERCADOLIVRE_SECRET_KEY');

    if (!appId || !secretKey) {
      console.error('Missing Mercado Livre credentials for token refresh');
      return null;
    }

    console.log('Attempting to refresh Mercado Livre token...');

    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: appId,
        client_secret: secretKey,
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      console.error(`Failed to refresh token: ${tokenResponse.status}`);
      return null;
    }

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      console.error('No access token in refresh response');
      return null;
    }

    // Encrypt and update the integration with new tokens
    const { data: encryptedAccessToken } = await supabase.rpc('encrypt_token', { token: tokenData.access_token });
    const { data: encryptedRefreshToken } = await supabase.rpc('encrypt_token', { token: tokenData.refresh_token || refreshToken });
    
    const { error: updateError } = await supabase
      .from('integrations')
      .update({
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integrationId);

    if (updateError) {
      console.error('Error updating integration with new token:', updateError);
      return null;
    }

    console.log('✅ Token refreshed successfully');
    return tokenData.access_token;
  } catch (error) {
    console.error('Error refreshing Mercado Livre token:', error);
    return null;
  }
}

async function getMercadoLivreStock(
  accessToken: string, 
  sku: string, 
  refreshToken: string | null,
  integrationId: string,
  supabase: any
): Promise<ChannelStock> {
  let currentToken = accessToken;
  let retryCount = 0;
  const maxRetries = 1;

  while (retryCount <= maxRetries) {
    try {
      console.log(`Fetching Mercado Livre stock for SKU: ${sku} (attempt ${retryCount + 1})`);
      
      // Get user info first to validate token
      const userResponse = await fetch(`https://api.mercadolibre.com/users/me`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });

      if (!userResponse.ok) {
        if ((userResponse.status === 401 || userResponse.status === 403) && retryCount === 0 && refreshToken) {
          console.log('Token expired, attempting to refresh...');
          const newToken = await refreshMercadoLivreToken(refreshToken, integrationId, supabase);
          
          if (newToken) {
            currentToken = newToken;
            retryCount++;
            continue; // Retry with new token
          }
        }
        
        console.error(`Failed to get user info from Mercado Livre: ${userResponse.status}`);
        return {
          channel: 'mercadolivre',
          channelId: '-',
          stock: 0,
          status: 'token_expired' as const,
          images: []
        };
      }

      const userData = await userResponse.json();
      const sellerId = userData.id;
      console.log(`Mercado Livre seller ID: ${sellerId}`);

      // Search for items by this seller
      const searchResponse = await fetch(`https://api.mercadolibre.com/sites/MLB/search?seller_id=${sellerId}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });
      
      if (!searchResponse.ok) {
        console.error(`Failed to search items from Mercado Livre: ${searchResponse.status}`);
        return {
          channel: 'mercadolivre',
          channelId: '-',
          stock: 0,
          status: 'token_expired' as const,
          images: []
        };
      }

      const searchData = await searchResponse.json();
      console.log(`Found ${searchData.results?.length || 0} items for seller`);
      
      // Find item with matching SKU in seller_custom_field
      let targetItemId = null;
      for (const item of searchData.results || []) {
        console.log(`Checking item ${item.id} with custom field: ${item.seller_custom_field}`);
        if (item.seller_custom_field === sku) {
          targetItemId = item.id;
          console.log(`Found matching item: ${targetItemId}`);
          break;
        }
      }

      if (!targetItemId) {
        console.log(`No item found with SKU: ${sku}`);
        return {
          channel: 'mercadolivre',
          channelId: 'N/A',
          stock: 0,
          status: 'not_found' as const,
          images: []
        };
      }

      // Get detailed item information
      const itemResponse = await fetch(`https://api.mercadolibre.com/items/${targetItemId}`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });
      
      if (!itemResponse.ok) {
        console.error(`Failed to get item details from Mercado Livre: ${itemResponse.status}`);
        throw new Error(`Failed to get item details from Mercado Livre: ${itemResponse.status}`);
      }

      const itemData = await itemResponse.json();
      console.log(`Item stock: ${itemData.available_quantity}`);
      
      return {
        channel: 'mercadolivre',
        channelId: targetItemId,
        stock: itemData.available_quantity || 0,
        status: 'synced' as const,
        images: itemData.pictures?.slice(0, 3).map((pic: any) => pic.secure_url) || []
      };

    } catch (error) {
      if (retryCount < maxRetries) {
        console.error('Error in attempt, will retry if token can be refreshed:', error);
        retryCount++;
        continue;
      }
      
      console.error('Error fetching Mercado Livre stock:', error);
      return {
        channel: 'mercadolivre',
        channelId: '-',
        stock: 0,
        status: 'error' as const,
        images: []
      };
    }
  }

  // If we get here, all retries failed
  return {
    channel: 'mercadolivre',
    channelId: '-',
    stock: 0,
    status: 'token_expired' as const,
    images: []
  };
}

async function getShopifyStock(
  accessToken: string, 
  sku: string,
  shopDomain: string | null,
  platformProductId: string | null
): Promise<ChannelStock> {
  try {
    if (!shopDomain) {
      console.log('No shop domain configured for Shopify');
      return {
        channel: 'shopify',
        channelId: '-',
        stock: 0,
        status: 'not_published',
        images: []
      };
    }

    if (!platformProductId) {
      console.log('No product listing found for Shopify');
      return {
        channel: 'shopify',
        channelId: '-',
        stock: 0,
        status: 'not_published',
        images: []
      };
    }

    // Ensure proper shop URL format
    const shopUrl = shopDomain.includes('.myshopify.com') 
      ? shopDomain 
      : `${shopDomain}.myshopify.com`;

    console.log(`Fetching Shopify product ${platformProductId} from ${shopUrl}`);

    const response = await fetch(
      `https://${shopUrl}/admin/api/2024-01/products/${platformProductId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      console.error(`Shopify API error: ${response.status}`);
      if (response.status === 404) {
        return {
          channel: 'shopify',
          channelId: platformProductId,
          stock: 0,
          status: 'not_found' as const,
          images: []
        };
      }
      if (response.status === 401) {
        return {
          channel: 'shopify',
          channelId: platformProductId,
          stock: 0,
          status: 'token_expired' as const,
          images: []
        };
      }
      return {
        channel: 'shopify',
        channelId: platformProductId,
        stock: 0,
        status: 'error' as const,
        images: []
      };
    }

    const data = await response.json();
    const product = data.product;
    
    // Get stock from first variant
    const variant = product?.variants?.[0];
    const stock = variant?.inventory_quantity || 0;
    
    // Get all images
    const images = product?.images?.map((img: any) => img.src) || [];
    
    console.log(`Shopify product found - stock: ${stock}, images: ${images.length}`);

    return {
      channel: 'shopify',
      channelId: platformProductId,
      stock,
      status: 'synced' as const,
      images
    };

  } catch (error) {
    console.error('Error fetching Shopify stock:', error);
    return {
      channel: 'shopify',
      channelId: platformProductId || '-',
      stock: 0,
      status: 'error' as const,
      images: []
    };
  }
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

async function getAmazonStock(
  refreshToken: string | null,
  sku: string,
  sellerId: string,
  marketplaceId: string,
  platformProductId: string | null
): Promise<ChannelStock> {
  try {
    // Check if we have the required credentials
    if (!refreshToken || !sellerId || !sellerId.startsWith('A')) {
      console.log('Amazon: Missing refresh token or seller ID');
      return {
        channel: 'amazon',
        channelId: '-',
        stock: 0,
        status: 'not_published' as const,
        images: []
      };
    }

    // If no listing exists for this product, it's not published
    if (!platformProductId) {
      console.log('Amazon: No product listing found for this product');
      return {
        channel: 'amazon',
        channelId: '-',
        stock: 0,
        status: 'not_published' as const,
        images: []
      };
    }

    console.log(`Fetching Amazon stock for SKU: ${platformProductId}, Seller: ${sellerId}`);

    // Initialize Amazon SP-API client
    const { default: SellingPartnerAPI } = await import('npm:amazon-sp-api@latest');
    
    const sellingPartner = new SellingPartnerAPI({
      region: 'na',
      refresh_token: refreshToken,
      credentials: {
        SELLING_PARTNER_APP_CLIENT_ID: Deno.env.get('AMAZON_CLIENT_ID'),
        SELLING_PARTNER_APP_CLIENT_SECRET: Deno.env.get('AMAZON_CLIENT_SECRET'),
      },
    });

    // Call getListingsItem to get full product details
    const response = await sellingPartner.callAPI({
      operation: 'getListingsItem',
      endpoint: 'listingsItems',
      path: {
        sellerId: sellerId,
        sku: platformProductId,
      },
      query: {
        marketplaceIds: [marketplaceId],
        includedData: ['attributes', 'summaries'],
      },
    });

    console.log('Amazon getListingsItem response received');

    // Extract stock from fulfillment_availability
    let stock = 0;
    if (response?.attributes?.fulfillment_availability) {
      const availability = response.attributes.fulfillment_availability[0];
      stock = availability?.quantity ?? 0;
    }

    // Extract ALL images
    const images: string[] = [];
    
    // Main image from summaries (processed/optimized URL)
    if (response?.summaries?.[0]?.mainImage?.link) {
      images.push(response.summaries[0].mainImage.link);
    }
    
    // Additional images from attributes (other_product_image_locator_1 to 8)
    for (let i = 1; i <= 8; i++) {
      const locator = response?.attributes?.[`other_product_image_locator_${i}`];
      if (locator?.[0]?.media_location) {
        images.push(locator[0].media_location);
      }
    }

    console.log(`Amazon product found - stock: ${stock}, images: ${images.length}`);

    return {
      channel: 'amazon',
      channelId: platformProductId,
      stock,
      status: 'synced' as const,
      images
    };

  } catch (error: any) {
    console.error('Error fetching Amazon stock:', error);
    
    // Check for specific error types
    if (error.message?.includes('token') || error.message?.includes('unauthorized') || error.message?.includes('401')) {
      return {
        channel: 'amazon',
        channelId: platformProductId || '-',
        stock: 0,
        status: 'token_expired' as const,
        images: []
      };
    }
    
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      return {
        channel: 'amazon',
        channelId: platformProductId || '-',
        stock: 0,
        status: 'not_found' as const,
        images: []
      };
    }
    
    return {
      channel: 'amazon',
      channelId: platformProductId || '-',
      stock: 0,
      status: 'error' as const,
      images: []
    };
  }
}