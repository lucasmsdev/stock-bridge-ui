import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkUpdateRequest {
  productIds: string[];
  updates: {
    selling_price?: number;
    cost_price?: number;
    stock_mode?: 'set' | 'add' | 'subtract';
    stock_value?: number;
    supplier_id?: string | null;
  };
}

interface SyncResult {
  productId: string;
  platform: string;
  success: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has write permission in their organization
    const { data: canWrite } = await supabase.rpc('can_write_in_org', { user_uuid: user.id });
    if (!canWrite) {
      return new Response(
        JSON.stringify({ error: 'Permission denied. You need operator or admin role.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: BulkUpdateRequest = await req.json();
    const { productIds, updates } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'productIds array is required and cannot be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one update field is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify all products belong to the user
    const { data: userProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, stock')
      .eq('user_id', user.id)
      .in('id', productIds);

    if (fetchError) {
      console.error('Error fetching products:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch products' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const foundProductIds = new Set(userProducts?.map(p => p.id) || []);
    const unauthorizedIds = productIds.filter(id => !foundProductIds.has(id));

    if (unauthorizedIds.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Some products do not belong to you',
          unauthorizedIds 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build update object
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.selling_price !== undefined) {
      updatePayload.selling_price = updates.selling_price;
    }

    if (updates.cost_price !== undefined) {
      updatePayload.cost_price = updates.cost_price;
    }

    if (updates.supplier_id !== undefined) {
      updatePayload.supplier_id = updates.supplier_id;
    }

    // Handle stock updates based on mode
    const stockMode = updates.stock_mode;
    const stockValue = updates.stock_value ?? 0;
    const productStockMap = new Map(userProducts?.map(p => [p.id, p.stock]) || []);

    let updatedCount = 0;
    const errors: Array<{ productId: string; error: string }> = [];

    // Process each product
    for (const productId of productIds) {
      try {
        let productUpdate = { ...updatePayload };

        // Calculate new stock based on mode
        if (stockMode && stockMode !== 'none') {
          const currentStock = productStockMap.get(productId) || 0;
          let newStock = currentStock;

          switch (stockMode) {
            case 'set':
              newStock = stockValue;
              break;
            case 'add':
              newStock = currentStock + stockValue;
              break;
            case 'subtract':
              newStock = Math.max(0, currentStock - stockValue);
              break;
          }

          productUpdate.stock = newStock;
        }

        // Update the product
        const { error: updateError } = await supabase
          .from('products')
          .update(productUpdate)
          .eq('id', productId)
          .eq('user_id', user.id);

        if (updateError) {
          console.error(`Error updating product ${productId}:`, updateError);
          errors.push({ productId, error: updateError.message });
        } else {
          updatedCount++;
        }
      } catch (err) {
        console.error(`Unexpected error updating product ${productId}:`, err);
        errors.push({ productId, error: 'Unexpected error during update' });
      }
    }

    // Sync with marketplaces for each updated product
    const syncResults: SyncResult[] = [];
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseServiceRoleKey) {
      // Fetch complete product data for sync
      const { data: updatedProducts } = await supabase
        .from('products')
        .select('id, sku, stock, selling_price, name, image_url, images')
        .in('id', productIds);

      const productMap = new Map(updatedProducts?.map(p => [p.id, p]) || []);

      // Get all listings for updated products with full details
      const { data: listings } = await supabase
        .from('product_listings')
        .select('id, product_id, platform, integration_id, platform_product_id, platform_variant_id')
        .in('product_id', productIds);

      if (listings && listings.length > 0) {
        for (const listing of listings) {
          const product = productMap.get(listing.product_id);
          if (!product) continue;

          try {
            let syncFunction = '';
            let payload: Record<string, any> = {};

            switch (listing.platform) {
              case 'mercadolivre':
                syncFunction = 'sync-mercadolivre-listing';
                payload = {
                  productId: product.id,
                  listingId: listing.id,
                  integrationId: listing.integration_id,
                  platformProductId: listing.platform_product_id,
                  sellingPrice: product.selling_price,
                  stock: product.stock,
                  name: product.name,
                  imageUrl: product.image_url,
                };
                break;
              case 'amazon':
                syncFunction = 'sync-amazon-listing';
                payload = {
                  productId: product.id,
                  sku: product.sku,
                  stock: product.stock,
                  sellingPrice: product.selling_price,
                  name: product.name,
                  imageUrl: product.image_url,
                  integrationId: listing.integration_id,
                };
                break;
              case 'shopify':
                syncFunction = 'sync-shopify-listing';
                payload = {
                  productId: product.id,
                  listingId: listing.id,
                  integrationId: listing.integration_id,
                  platformProductId: listing.platform_product_id,
                  platformVariantId: listing.platform_variant_id,
                  sellingPrice: product.selling_price,
                  stock: product.stock,
                  name: product.name,
                  imageUrl: product.image_url,
                };
                break;
              default:
                continue; // Skip unsupported platforms
            }

            // Call the sync function using fetch for reliability
            const response = await fetch(`${supabaseUrl}/functions/v1/${syncFunction}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceRoleKey}`,
              },
              body: JSON.stringify(payload),
            });

            const result = await response.json().catch(() => ({}));
            const success = response.ok && result.success !== false;

            syncResults.push({
              productId: listing.product_id,
              platform: listing.platform,
              success,
              error: success ? undefined : (result.error || `HTTP ${response.status}`),
            });

            console.log(`Sync ${listing.platform} for product ${product.id}: ${success ? 'OK' : 'FAILED'}`, result);
          } catch (err) {
            console.error(`Error syncing listing ${listing.id}:`, err);
            syncResults.push({
              productId: listing.product_id,
              platform: listing.platform,
              success: false,
              error: 'Sync failed',
            });
          }
        }
      }
    }

    const successfulSyncs = syncResults.filter(r => r.success).length;
    const totalSyncs = syncResults.length;

    return new Response(
      JSON.stringify({
        success: true,
        updated: updatedCount,
        synced: successfulSyncs,
        totalListings: totalSyncs,
        errors: errors.length > 0 ? errors : undefined,
        syncResults: syncResults.length > 0 ? syncResults : undefined,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Bulk update error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
