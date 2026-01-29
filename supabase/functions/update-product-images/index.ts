import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Error codes for structured responses
const ErrorCodes = {
  CATALOG_LOCKED: 'CATALOG_LOCKED',
  PICTURES_NOT_MODIFIABLE: 'PICTURES_NOT_MODIFIABLE',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

// Upload image to Mercado Livre via multipart
async function uploadImageToMercadoLivre(
  accessToken: string,
  imageUrl: string
): Promise<{ success: boolean; pictureId?: string; error?: string }> {
  try {
    console.log(`Downloading image from: ${imageUrl}`);
    
    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.log(`Failed to download image: ${imageResponse.status}`);
      return { success: false, error: `Não foi possível baixar a imagem (${imageResponse.status})` };
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    // Determine file extension from content type
    let extension = 'jpg';
    if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('webp')) extension = 'webp';
    else if (contentType.includes('gif')) extension = 'gif';
    
    console.log(`Image downloaded: ${imageBuffer.byteLength} bytes, type: ${contentType}`);
    
    // Create FormData for multipart upload
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: contentType });
    formData.append('file', blob, `image.${extension}`);
    
    // Upload to ML
    console.log('Uploading to Mercado Livre pictures API...');
    const uploadResponse = await fetch(
      'https://api.mercadolibre.com/pictures/items/upload',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData,
      }
    );
    
    const uploadText = await uploadResponse.text();
    console.log('ML upload response:', uploadText);
    
    if (!uploadResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(uploadText);
      } catch {
        errorData = { message: uploadText };
      }
      return { success: false, error: errorData.message || 'Erro no upload para ML' };
    }
    
    const uploadData = JSON.parse(uploadText);
    if (uploadData.id) {
      console.log(`Image uploaded successfully: ${uploadData.id}`);
      return { success: true, pictureId: uploadData.id };
    }
    
    return { success: false, error: 'ML não retornou ID da imagem' };
    
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error.message || 'Erro desconhecido no upload' };
  }
}

// Extract picture ID from ML URL
function extractMlPictureId(url: string): string | null {
  // ML image URL formats:
  // D_868544-MLA83755569527_042025-O.jpg (most common)
  // D_NQ_NP_654616-MLA100052373945_122025-O.jpg
  // D_Q_NP_745762-MLA88339485001_072025-V.jpg
  // 782129-MLB105943089361_012026 (direct ID)
  
  const patterns = [
    // Match D_XXXXXX-MLx format (most common) - captures after D_
    /D_(\d+-ML[A-Z]\d+[_-]\d+)/i,
    // Match D_NQ_NP_XXXXXX-MLx format
    /D_NQ_NP_(\d+-ML[A-Z]\d+[_-]\d+)/i,
    // Match D_Q_NP_XXXXXX-MLx format
    /D_Q_NP_(\d+-ML[A-Z]\d+[_-]\d+)/i,
    // Match direct XXXXXX-MLx format (fallback for IDs without prefix)
    /(\d{6,}-ML[A-Z]\d+[_-]\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      console.log(`Extracted ML picture ID: ${match[1]} from URL: ${url.substring(0, 80)}...`);
      return match[1];
    }
  }
  
  console.log(`Could not extract ML picture ID from: ${url.substring(0, 80)}...`);
  return null;
}

// Check if URL is from Mercado Livre
function isMlUrl(url: string): boolean {
  return url.includes('mlstatic.com') || url.includes('mercadolibre.com') || url.includes('mercadolivre.com');
}

interface UpdateResult {
  success: boolean;
  error?: string;
  code?: string;
  details?: string;
  itemId?: string;
  catalogProductId?: string;
}

async function updateMercadoLivreImages(
  accessToken: string, 
  itemId: string, 
  images: string[]
): Promise<UpdateResult> {
  try {
    console.log(`Updating Mercado Livre images for item: ${itemId}`);
    console.log(`Images to process: ${images.length}`);
    
    // Filter and validate URLs - ML only accepts HTTPS URLs
    const validImages = images.filter(url => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:';
      } catch {
        console.log(`Invalid URL skipped: ${url}`);
        return false;
      }
    });

    if (validImages.length === 0) {
      return { 
        success: false, 
        error: 'Nenhuma imagem válida para enviar (apenas HTTPS é aceito)',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    console.log(`Valid images count: ${validImages.length}`);
    
    // Check if item is a catalog listing (pictures not modifiable)
    const itemCheck = await fetch(
      `https://api.mercadolibre.com/items/${itemId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const itemData = await itemCheck.json();
    
    console.log(`Item check - catalog_listing: ${itemData.catalog_listing}, catalog_product_id: ${itemData.catalog_product_id}`);
    
    // Detect catalog listings BEFORE attempting update
    if (itemData.catalog_listing || itemData.catalog_product_id) {
      console.log(`Item ${itemId} is a catalog listing - images cannot be modified`);
      return { 
        success: false, 
        error: 'Este anúncio é de catálogo. As imagens são gerenciadas pelo Mercado Livre e não podem ser alteradas via UNISTOCK.',
        code: ErrorCodes.CATALOG_LOCKED,
        details: 'catalog_listing',
        itemId: itemId,
        catalogProductId: itemData.catalog_product_id,
      };
    }
    
    // Process each image - either extract existing ML ID or upload new
    const pictureIds: string[] = [];
    const errors: string[] = [];
    
    for (const imageUrl of validImages) {
      // If it's already a ML URL, try to extract the picture ID
      if (isMlUrl(imageUrl)) {
        const existingId = extractMlPictureId(imageUrl);
        if (existingId) {
          console.log(`Reusing existing ML picture ID: ${existingId}`);
          pictureIds.push(existingId);
          continue;
        }
      }
      
      // Upload external images via multipart
      const result = await uploadImageToMercadoLivre(accessToken, imageUrl);
      if (result.success && result.pictureId) {
        pictureIds.push(result.pictureId);
      } else {
        console.log(`Failed to upload: ${imageUrl} - ${result.error}`);
        errors.push(result.error || 'Erro desconhecido');
      }
    }
    
    console.log(`Processed images: ${pictureIds.length} success, ${errors.length} failed`);
    
    if (pictureIds.length === 0) {
      return { 
        success: false, 
        error: 'Nenhuma imagem foi processada com sucesso.',
        code: ErrorCodes.VALIDATION_ERROR,
        details: errors.join('; ')
      };
    }
    
    // Update item with picture IDs (using { id } format, not { source })
    const updatePayload = {
      pictures: pictureIds.map(id => ({ id }))
    };
    
    console.log('Updating item with pictures:', JSON.stringify(updatePayload));
    
    const updateResponse = await fetch(
      `https://api.mercadolibre.com/items/${itemId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      }
    );

    const responseText = await updateResponse.text();
    console.log(`ML update response status: ${updateResponse.status}`);
    console.log(`ML update response: ${responseText}`);

    if (!updateResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { message: responseText };
      }
      
      console.error('Mercado Livre API error:', errorData);
      
      // Handle specific ML errors
      if (updateResponse.status === 401 || updateResponse.status === 403) {
        return { 
          success: false, 
          error: 'Token expirado. Reconecte sua conta do Mercado Livre.',
          code: ErrorCodes.TOKEN_EXPIRED,
        };
      }
      
      // Detect pictures not modifiable errors (catalog or other restrictions)
      const isPicturesNotModifiable = errorData.cause?.some((c: any) => 
        c.code === 'field_not_updatable' || 
        c.code === 'item.pictures.error' ||
        c.message?.toLowerCase().includes('pictures is not modifiable') ||
        c.message?.toLowerCase().includes('pictures are not modifiable')
      ) || errorData.message?.toLowerCase().includes('pictures is not modifiable');
      
      if (isPicturesNotModifiable) {
        console.log(`Item ${itemId} has pictures restriction - marking as PICTURES_NOT_MODIFIABLE`);
        return { 
          success: false, 
          error: 'As imagens deste anúncio não podem ser alteradas. Isso pode ocorrer em anúncios de catálogo, com vendas ativas, ou com restrições do Mercado Livre.',
          code: ErrorCodes.PICTURES_NOT_MODIFIABLE,
          details: JSON.stringify(errorData.cause || errorData),
          itemId: itemId,
        };
      }
      
      return { 
        success: false, 
        error: errorData.message || `Erro ao atualizar imagens: ${updateResponse.status}`,
        code: ErrorCodes.UNKNOWN_ERROR,
        details: JSON.stringify(errorData)
      };
    }

    const successMsg = errors.length > 0 
      ? `${pictureIds.length} imagens atualizadas, ${errors.length} falharam`
      : `${pictureIds.length} imagens atualizadas com sucesso`;
      
    console.log(successMsg);
    return { success: true, details: successMsg };
  } catch (error) {
    console.error('Error updating Mercado Livre images:', error);
    return { 
      success: false, 
      error: 'Falha ao conectar com Mercado Livre',
      code: ErrorCodes.UNKNOWN_ERROR,
    };
  }
}

async function updateShopifyImages(
  accessToken: string,
  productId: string,
  images: string[],
  shopDomain: string | null
): Promise<UpdateResult> {
  try {
    if (!shopDomain) {
      return { success: false, error: 'Shop domain not configured', code: ErrorCodes.VALIDATION_ERROR };
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
        return { success: false, error: 'Token expirado. Reconecte sua loja Shopify.', code: ErrorCodes.TOKEN_EXPIRED };
      }
      if (response.status === 404) {
        return { success: false, error: 'Produto não encontrado na Shopify.', code: ErrorCodes.NOT_FOUND };
      }

      return { 
        success: false, 
        error: `Erro ao atualizar imagens: ${response.status}`,
        code: ErrorCodes.UNKNOWN_ERROR,
      };
    }

    const data = await response.json();
    console.log('Shopify images updated:', data.product?.images?.length);

    return { success: true };
  } catch (error) {
    console.error('Error updating Shopify images:', error);
    return { success: false, error: 'Falha ao conectar com Shopify', code: ErrorCodes.UNKNOWN_ERROR };
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
      .select('id, platform, platform_product_id, integration_id, sync_status')
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

    let result: UpdateResult;

    switch (platform) {
      case 'mercadolivre':
        result = await updateMercadoLivreImages(accessToken, listing.platform_product_id, images);
        break;
      case 'shopify':
        result = await updateShopifyImages(accessToken, listing.platform_product_id, images, integration.shop_domain);
        break;
      case 'amazon':
        result = { success: false, error: 'Amazon image sync not yet implemented', code: ErrorCodes.UNKNOWN_ERROR };
        break;
      default:
        result = { success: false, error: `Platform ${platform} not supported`, code: ErrorCodes.UNKNOWN_ERROR };
    }

    if (!result.success) {
      // Determine sync_status based on error code
      let syncStatus = 'error';
      if (result.code === ErrorCodes.CATALOG_LOCKED || result.code === ErrorCodes.PICTURES_NOT_MODIFIABLE) {
        syncStatus = 'restricted';
      }
      
      // Update listing with sync error and appropriate status
      await supabase
        .from('product_listings')
        .update({
          sync_status: syncStatus,
          sync_error: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq('id', listingId);

      // Return structured error response
      const statusCode = result.code === ErrorCodes.CATALOG_LOCKED || result.code === ErrorCodes.PICTURES_NOT_MODIFIABLE 
        ? 409 
        : 400;
      
      return new Response(JSON.stringify({ 
        error: result.error, 
        code: result.code,
        details: result.details,
        itemId: result.itemId,
        catalogProductId: result.catalogProductId,
      }), {
        status: statusCode,
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
      details: result.details,
      updatedImages: images.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-product-images:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', code: ErrorCodes.UNKNOWN_ERROR }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
