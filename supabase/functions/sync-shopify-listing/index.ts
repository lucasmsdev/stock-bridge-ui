import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncRequest {
  productId: string;
  listingId: string;
  integrationId: string;
  platformProductId: string;      // ID do produto Shopify (numerico)
  platformVariantId?: string;     // ID da variant (para preco)
  sellingPrice?: number;
  stock?: number;
  name?: string;
  imageUrl?: string;
}

const SHOPIFY_API_VERSION = '2024-01';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Cliente com auth do usuario para validacao
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    // Cliente admin para operacoes privilegiadas (decrypt tokens)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validar usuario
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SyncRequest = await req.json();
    const { productId, listingId, integrationId, platformProductId, platformVariantId, sellingPrice, stock, name, imageUrl } = body;

    if (!integrationId || !platformProductId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: integrationId, platformProductId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔄 Sincronizando produto com Shopify:', {
      productId,
      platformProductId,
      platformVariantId,
      sellingPrice,
      stock,
      name: name?.substring(0, 30) + '...',
    });

    // Buscar integracao e descriptografar token
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integrations')
      .select('id, encrypted_access_token, shop_domain, user_id')
      .eq('id', integrationId)
      .eq('platform', 'shopify')
      .single();

    if (integrationError || !integration) {
      console.error('❌ Integracao nao encontrada:', integrationError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Integracao Shopify nao encontrada',
          requiresReconnect: true,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se a integracao pertence ao usuario
    if (integration.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - integration belongs to another user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!integration.shop_domain) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Dominio da loja Shopify nao encontrado',
          requiresReconnect: true,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Descriptografar access token
    const { data: accessToken, error: decryptError } = await supabaseAdmin.rpc(
      'decrypt_token',
      { encrypted_token: integration.encrypted_access_token }
    );

    if (decryptError || !accessToken) {
      console.error('❌ Erro ao descriptografar token:', decryptError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao descriptografar token. Reconecte sua loja Shopify.',
          requiresReconnect: true,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const shopDomain = integration.shop_domain;
    const shopUrl = shopDomain.includes('.myshopify.com') 
      ? shopDomain 
      : `${shopDomain}.myshopify.com`;
    const baseUrl = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}`;
    
    const headers = {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    };

    const updatedFields: string[] = [];
    const warnings: Array<{ code: string; message: string }> = [];

    // ========================================
    // 1. Atualizar produto (titulo e imagem)
    // ========================================
    if (name || imageUrl) {
      const productPayload: Record<string, any> = {
        product: {
          id: parseInt(platformProductId),
        },
      };

      if (name) {
        productPayload.product.title = name;
      }

      if (imageUrl) {
        productPayload.product.images = [{ src: imageUrl }];
      }

      console.log('📤 Atualizando produto Shopify:', JSON.stringify(productPayload, null, 2));

      const productResponse = await fetch(
        `${baseUrl}/products/${platformProductId}.json`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(productPayload),
        }
      );

      const productResponseText = await productResponse.text();
      let productResult: any;

      try {
        productResult = JSON.parse(productResponseText);
      } catch {
        productResult = { raw: productResponseText };
      }

      console.log('📥 Resposta Shopify (produto):', productResponse.status, JSON.stringify(productResult, null, 2));

      if (!productResponse.ok) {
        const errorMessage = productResult.errors 
          ? (typeof productResult.errors === 'string' ? productResult.errors : JSON.stringify(productResult.errors))
          : 'Erro ao atualizar produto';

        // Atualizar status do listing com erro
        await supabaseAdmin
          .from('product_listings')
          .update({
            sync_status: 'error',
            sync_error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', listingId);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: errorMessage,
            shopifyStatus: productResponse.status,
            requiresReconnect: productResponse.status === 401,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (name) updatedFields.push('title');
      if (imageUrl) updatedFields.push('images');
    }

    // ========================================
    // 2. Atualizar preco (via variant)
    // ========================================
    let variantId = platformVariantId;

    if (sellingPrice !== undefined && sellingPrice !== null) {
      // Se nao temos o variantId, buscar o primeiro variant do produto
      if (!variantId) {
        console.log('🔍 Buscando variant do produto...');
        const productResponse = await fetch(
          `${baseUrl}/products/${platformProductId}.json`,
          { headers }
        );

        if (productResponse.ok) {
          const productData = await productResponse.json();
          if (productData.product?.variants?.length > 0) {
            variantId = productData.product.variants[0].id.toString();
            console.log('✅ Variant encontrada:', variantId);
          }
        }
      }

      if (variantId) {
        const variantPayload = {
          variant: {
            id: parseInt(variantId),
            price: sellingPrice.toFixed(2),
          },
        };

        console.log('📤 Atualizando preco Shopify:', JSON.stringify(variantPayload, null, 2));

        const variantResponse = await fetch(
          `${baseUrl}/variants/${variantId}.json`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify(variantPayload),
          }
        );

        const variantResponseText = await variantResponse.text();
        let variantResult: any;

        try {
          variantResult = JSON.parse(variantResponseText);
        } catch {
          variantResult = { raw: variantResponseText };
        }

        console.log('📥 Resposta Shopify (variant):', variantResponse.status, JSON.stringify(variantResult, null, 2));

        if (variantResponse.ok) {
          updatedFields.push('price');
        } else {
          warnings.push({
            code: 'price_update_failed',
            message: variantResult.errors 
              ? (typeof variantResult.errors === 'string' ? variantResult.errors : JSON.stringify(variantResult.errors))
              : 'Erro ao atualizar preco',
          });
        }
      } else {
        warnings.push({
          code: 'variant_not_found',
          message: 'Variant nao encontrada. Preco nao foi atualizado.',
        });
      }
    }

    // ========================================
    // 3. Atualizar estoque (via Inventory Levels)
    // ========================================
    if (stock !== undefined && stock !== null && variantId) {
      console.log('🔍 Buscando inventory_item_id e location_id...');

      // Buscar inventory_item_id da variant
      const variantResponse = await fetch(
        `${baseUrl}/variants/${variantId}.json`,
        { headers }
      );

      let inventoryItemId: string | null = null;

      if (variantResponse.ok) {
        const variantData = await variantResponse.json();
        inventoryItemId = variantData.variant?.inventory_item_id?.toString();
        console.log('✅ Inventory Item ID:', inventoryItemId);
      }

      // Buscar location_id da loja
      const locationsResponse = await fetch(
        `${baseUrl}/locations.json`,
        { headers }
      );

      let locationId: string | null = null;

      if (locationsResponse.ok) {
        const locationsData = await locationsResponse.json();
        if (locationsData.locations?.length > 0) {
          // Usar a primeira location ativa
          const activeLocation = locationsData.locations.find((loc: any) => loc.active) || locationsData.locations[0];
          locationId = activeLocation.id.toString();
          console.log('✅ Location ID:', locationId);
        }
      }

      if (inventoryItemId && locationId) {
        const inventoryPayload = {
          location_id: parseInt(locationId),
          inventory_item_id: parseInt(inventoryItemId),
          available: stock,
        };

        console.log('📤 Atualizando estoque Shopify:', JSON.stringify(inventoryPayload, null, 2));

        const inventoryResponse = await fetch(
          `${baseUrl}/inventory_levels/set.json`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(inventoryPayload),
          }
        );

        const inventoryResponseText = await inventoryResponse.text();
        let inventoryResult: any;

        try {
          inventoryResult = JSON.parse(inventoryResponseText);
        } catch {
          inventoryResult = { raw: inventoryResponseText };
        }

        console.log('📥 Resposta Shopify (estoque):', inventoryResponse.status, JSON.stringify(inventoryResult, null, 2));

        if (inventoryResponse.ok) {
          updatedFields.push('stock');
        } else {
          warnings.push({
            code: 'stock_update_failed',
            message: inventoryResult.errors 
              ? (typeof inventoryResult.errors === 'string' ? inventoryResult.errors : JSON.stringify(inventoryResult.errors))
              : 'Erro ao atualizar estoque',
          });
        }
      } else {
        if (!inventoryItemId) {
          warnings.push({
            code: 'inventory_item_not_found',
            message: 'Inventory Item nao encontrado. Estoque nao foi atualizado.',
          });
        }
        if (!locationId) {
          warnings.push({
            code: 'location_not_found',
            message: 'Location nao encontrada. Estoque nao foi atualizado.',
          });
        }
      }
    } else if (stock !== undefined && stock !== null && !variantId) {
      // Se temos estoque para atualizar mas nao temos variant, buscar
      console.log('🔍 Buscando variant para atualizar estoque...');
      const productResponse = await fetch(
        `${baseUrl}/products/${platformProductId}.json`,
        { headers }
      );

      if (productResponse.ok) {
        const productData = await productResponse.json();
        if (productData.product?.variants?.length > 0) {
          const variant = productData.product.variants[0];
          variantId = variant.id.toString();
          const inventoryItemId = variant.inventory_item_id?.toString();

          // Buscar location
          const locationsResponse = await fetch(
            `${baseUrl}/locations.json`,
            { headers }
          );

          let locationId: string | null = null;

          if (locationsResponse.ok) {
            const locationsData = await locationsResponse.json();
            if (locationsData.locations?.length > 0) {
              const activeLocation = locationsData.locations.find((loc: any) => loc.active) || locationsData.locations[0];
              locationId = activeLocation.id.toString();
            }
          }

          if (inventoryItemId && locationId) {
            const inventoryPayload = {
              location_id: parseInt(locationId),
              inventory_item_id: parseInt(inventoryItemId),
              available: stock,
            };

            console.log('📤 Atualizando estoque Shopify:', JSON.stringify(inventoryPayload, null, 2));

            const inventoryResponse = await fetch(
              `${baseUrl}/inventory_levels/set.json`,
              {
                method: 'POST',
                headers,
                body: JSON.stringify(inventoryPayload),
              }
            );

            if (inventoryResponse.ok) {
              updatedFields.push('stock');
            } else {
              const inventoryResult = await inventoryResponse.json().catch(() => ({}));
              warnings.push({
                code: 'stock_update_failed',
                message: inventoryResult.errors 
                  ? (typeof inventoryResult.errors === 'string' ? inventoryResult.errors : JSON.stringify(inventoryResult.errors))
                  : 'Erro ao atualizar estoque',
              });
            }
          }
        }
      }
    }

    // ========================================
    // 4. Atualizar status do listing no banco
    // ========================================
    if (updatedFields.length > 0) {
      await supabaseAdmin
        .from('product_listings')
        .update({
          sync_status: 'active',
          last_sync_at: new Date().toISOString(),
          sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', listingId);

      console.log('✅ Shopify sincronizado com sucesso:', updatedFields);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Produto atualizado na Shopify',
          platformProductId,
          updatedFields,
          warnings: warnings.length > 0 ? warnings : undefined,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (warnings.length > 0) {
      // Nenhum campo atualizado mas temos warnings
      await supabaseAdmin
        .from('product_listings')
        .update({
          sync_status: 'error',
          sync_error: warnings.map(w => w.message).join('; '),
          updated_at: new Date().toISOString(),
        })
        .eq('id', listingId);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Nenhum campo foi atualizado',
          warnings,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Nada para atualizar
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum campo para atualizar',
          skipped: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('💥 Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro interno do servidor',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
