import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header missing' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { productId, listingId, platform, images } = await req.json();

    if (!productId || !listingId || !platform || !Array.isArray(images)) {
      return new Response(JSON.stringify({ error: 'Missing required fields: productId, listingId, platform, images' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Updating images for ${platform} - product: ${productId}, listing: ${listingId}`);
    console.log(`Images to sync: ${images.length}`);

    // Get the listing with integration details
    const { data: listing, error: listingError } = await supabase
      .from('product_listings')
      .select('id, platform, platform_product_id, integration_id')
      .eq('id', listingId)
      .eq('user_id', user.id)
      .single();

    if (listingError || !listing) {
      console.error('Listing not found:', listingError);
      return new Response(JSON.stringify({ error: 'Listing not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get integration with tokens
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('id, platform, encrypted_access_token, encrypted_refresh_token, shop_domain')
      .eq('id', listing.integration_id)
      .eq('user_id', user.id)
      .single();

    if (integrationError || !integration) {
      console.error('Integration not found:', integrationError);
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decrypt access token
    const { data: accessToken, error: decryptError } = await supabase.rpc('decrypt_token', {
      encrypted_token: integration.encrypted_access_token
    });

    if (decryptError || !accessToken) {
      console.error('Failed to decrypt token:', decryptError);
      return new Response(JSON.stringify({ error: 'Failed to decrypt access token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result;

    switch (platform) {
      case 'mercadolivre':
        result = await updateMercadoLivreImages(accessToken, listing.platform_product_id, images);
        break;
      case 'shopify':
        result = await updateShopifyImages(accessToken, listing.platform_product_id, images, integration.shop_domain);
        break;
      case 'amazon':
        result = { success: false, error: 'Amazon image sync not yet implemented' };
        break;
      default:
        result = { success: false, error: `Platform ${platform} not supported` };
    }

    if (!result.success) {
      // Update listing with sync error
      await supabase
        .from('product_listings')
        .update({
          sync_status: 'error',
          sync_error: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq('id', listingId);

      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update listing with success
    await supabase
      .from('product_listings')
      .update({
        sync_status: 'active',
        sync_error: null,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', listingId);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Images updated successfully on ${platform}`,
      updatedImages: images.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-product-images:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function updateMercadoLivreImages(
  accessToken: string, 
  itemId: string, 
  images: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Updating Mercado Livre images for item: ${itemId}`);
    
    // Mercado Livre expects pictures as array of objects with source URL
    const pictures = images.map(url => ({ source: url }));

    const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pictures }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Mercado Livre API error:', errorData);
      
      // Handle specific ML errors
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: 'Token expirado. Reconecte sua conta do Mercado Livre.' };
      }
      
      return { 
        success: false, 
        error: errorData.message || `Erro ao atualizar imagens: ${response.status}` 
      };
    }

    const data = await response.json();
    console.log('Mercado Livre images updated:', data.pictures?.length);
    
    return { success: true };
  } catch (error) {
    console.error('Error updating Mercado Livre images:', error);
    return { success: false, error: 'Falha ao conectar com Mercado Livre' };
  }
}

async function updateShopifyImages(
  accessToken: string,
  productId: string,
  images: string[],
  shopDomain: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!shopDomain) {
      return { success: false, error: 'Shop domain not configured' };
    }

    // Ensure proper shop URL format
    const shopUrl = shopDomain.includes('.myshopify.com') 
      ? shopDomain 
      : `${shopDomain}.myshopify.com`;

    console.log(`Updating Shopify images for product: ${productId} on ${shopUrl}`);

    // Shopify expects images as array of objects with src
    const shopifyImages = images.map((url, index) => ({
      src: url,
      position: index + 1,
    }));

    const response = await fetch(
      `https://${shopUrl}/admin/api/2024-01/products/${productId}.json`,
      {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product: { images: shopifyImages }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API error:', errorText);

      if (response.status === 401) {
        return { success: false, error: 'Token expirado. Reconecte sua loja Shopify.' };
      }
      if (response.status === 404) {
        return { success: false, error: 'Produto não encontrado na Shopify.' };
      }

      return { 
        success: false, 
        error: `Erro ao atualizar imagens: ${response.status}` 
      };
    }

    const data = await response.json();
    console.log('Shopify images updated:', data.product?.images?.length);

    return { success: true };
  } catch (error) {
    console.error('Error updating Shopify images:', error);
    return { success: false, error: 'Falha ao conectar com Shopify' };
  }
}
