

# Reconstrução Completa: Sistema de Importação e Sincronização Shopify

## Diagnóstico Completo dos Problemas

### Problema 1: IDs Incorretos no Product Listings ❌

**Linha problemática:** `supabase/functions/import-products/index.ts:1310`
```typescript
platform_product_id: product.sku, // SKU é usado como identificador
```

**O que está acontecendo:**
- Durante a importação da Shopify, o sistema usa `variant.id` como SKU (linha 454)
- Depois salva esse mesmo `variant.id` como `platform_product_id` no `product_listings`
- Quando tenta sincronizar, usa esse ID na URL `/products/{platform_product_id}.json`
- **Resultado:** 404 Not Found porque `variant.id` ≠ `product.id`

**Evidência no banco:**
```sql
platform_product_id: 53299378323740  -- Este é o variant.id, NÃO o product.id!
platform_variant_id: NULL             -- Deveria ter o variant.id aqui
platform_metadata: NULL               -- Deveria ter os dados completos
```

### Problema 2: Mapeamento Incorreto Durante Importação ❌

**Linhas 448-462 de `import-products/index.ts`:**
```typescript
for (const product of products) {
  for (const variant of product.variants || []) {
    const productData = {
      user_id: user.id,
      name: `${product.title}${variant.title !== 'Default Title' ? ` - ${variant.title}` : ''}`,
      sku: variant.sku || variant.id.toString(),  // ❌ Usando variant.id como SKU
      // ...
    };
    productsToInsert.push(productData);
  }
}
// ⚠️ O product.id original da Shopify é PERDIDO aqui!
```

### Problema 3: Status "disconnected" Não Persiste ❌

**Evidência:**
- Logs mostram: "marcando como desconectado"
- Banco mostra: `sync_status: 'active'` (não mudou!)
- Um produto tem `disconnected`, outro tem `active` com mesmo erro

**Possível causa:** Race condition ou falha silenciosa no UPDATE

### Problema 4: Alerta Não Aparece no Frontend ❌

**Código em `ProductDetails.tsx` linha 143:**
```typescript
const disconnectedListings = listings.filter(l => l.sync_status === 'disconnected');
```

**Problemas:**
1. Cálculo roda antes do `useEffect` atualizar `listings`
2. Mesmo após `loadProductDetails()`, o estado `listings` pode não atualizar
3. O componente não re-renderiza após mutation

---

## Solução Completa: Arquitetura Corrigida

### Arquitetura de Dados Correta

```typescript
// Dados da Shopify API
{
  product: {
    id: 9876543210,              // ← PRODUCT ID (único por produto)
    title: "Camiseta Básica",
    variants: [
      {
        id: 53299378323740,      // ← VARIANT ID (único por variante)
        sku: "CAM-001-P",
        title: "Pequeno",
        price: "49.90",
        inventory_quantity: 10
      },
      {
        id: 53299378323741,
        sku: "CAM-001-M",
        title: "Médio",
        // ...
      }
    ]
  }
}

// Como deve ser salvo no UNISTOCK
products:
  - id: uuid
    sku: "CAM-001-P"            // variant.sku OU variant.id como string
    name: "Camiseta Básica - Pequeno"

product_listings:
  - product_id: uuid (referência ao products.id)
    platform: "shopify"
    platform_product_id: "9876543210"     // ← product.id da Shopify
    platform_variant_id: "53299378323740" // ← variant.id da Shopify
    platform_metadata: { ...dados completos... }
```

---

## Implementação

### Fase 1: Corrigir Importação da Shopify

#### Arquivo: `supabase/functions/import-products/index.ts`

**Mudanças nas linhas 362-462:**

```typescript
} else if (platform === 'shopify') {
  // ... busca de produtos ...

  console.log(`Found ${products.length} products to import from Shopify`);

  // ✅ NOVA ABORDAGEM: Manter referência ao product.id original
  const productMappings = new Map(); // Map<sku, {productId, variantId, fullProduct}>

  // Step 2: Map Shopify products to our format
  for (const product of products) {
    for (const variant of product.variants || []) {
      const sku = variant.sku || variant.id.toString();
      
      // Armazenar mapeamento para criar listings depois
      productMappings.set(sku, {
        shopifyProductId: product.id.toString(),
        shopifyVariantId: variant.id.toString(),
        fullProductData: product, // Dados completos para metadata
      });

      const productData = {
        user_id: user.id,
        name: `${product.title}${variant.title !== 'Default Title' ? ` - ${variant.title}` : ''}`,
        sku: sku,
        stock: variant.inventory_quantity || 0,
        selling_price: variant.price ? parseFloat(variant.price) : null,
        image_url: product.image?.src || null,
      };

      productsToInsert.push(productData);
    }
  }

  // Anexar mapeamentos para uso posterior
  productsToInsert._shopifyMappings = productMappings;
}
```

**Mudanças nas linhas 1303-1330:**

```typescript
// PASSO 11: Criar vínculos na tabela product_listings
if (insertedProducts && insertedProducts.length > 0 && platform) {
  console.log('🔗 Criando vínculos em product_listings...');
  
  const listingsToInsert = [];

  if (platform === 'shopify' && productsToInsert._shopifyMappings) {
    // ✅ SHOPIFY: Usar IDs corretos do mapeamento
    for (const product of insertedProducts) {
      const mapping = productsToInsert._shopifyMappings.get(product.sku);
      
      if (mapping) {
        listingsToInsert.push({
          user_id: user.id,
          product_id: product.id,
          platform: 'shopify',
          platform_product_id: mapping.shopifyProductId,     // ✅ product.id da Shopify
          platform_variant_id: mapping.shopifyVariantId,     // ✅ variant.id da Shopify
          platform_metadata: mapping.fullProductData,        // ✅ Dados completos
          integration_id: integration.id,
          sync_status: 'active',
          last_sync_at: new Date().toISOString(),
        });
      }
    }
  } else {
    // Outras plataformas (Mercado Livre, Amazon)
    for (const product of insertedProducts) {
      listingsToInsert.push({
        user_id: user.id,
        product_id: product.id,
        platform: platform,
        platform_product_id: product.sku,
        integration_id: integration.id,
        sync_status: 'active',
        last_sync_at: new Date().toISOString(),
      });
    }
  }

  if (listingsToInsert.length > 0) {
    const { data: insertedListings, error: listingsError } = await supabaseClient
      .from('product_listings')
      .upsert(listingsToInsert, {
        onConflict: 'product_id,integration_id',
        ignoreDuplicates: false,
      })
      .select();

    if (listingsError) {
      console.warn('⚠️ Erro ao criar vínculos em product_listings:', listingsError);
    } else {
      console.log(`✅ ${insertedListings?.length || 0} vínculos criados em product_listings`);
    }
  }
}
```

---

### Fase 2: Corrigir Sincronização Shopify

#### Arquivo: `supabase/functions/sync-shopify-listing/index.ts`

**Nenhuma mudança necessária!** O código já está correto, só estava recebendo IDs errados.

**Validação adicional (linhas 54-70):**

```typescript
const body: SyncRequest = await req.json();
const { productId, listingId, integrationId, platformProductId, platformVariantId, sellingPrice, stock, name, imageUrl } = body;

if (!integrationId || !platformProductId) {
  return new Response(
    JSON.stringify({ error: 'Missing required fields: integrationId, platformProductId' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ✅ NOVO: Validar que platformProductId não é um variant ID
if (platformProductId && platformProductId.length > 12) {
  console.warn('⚠️ platformProductId parece ser um variant ID (muito longo):', platformProductId);
  console.warn('⚠️ Isso causará erro 404. Verifique se o product_listing está correto.');
}

console.log('🔄 Sincronizando produto com Shopify:', {
  productId,
  platformProductId,      // ← Deve ser o product.id (ex: 9876543210)
  platformVariantId,      // ← Deve ser o variant.id (ex: 53299378323740)
  sellingPrice,
  stock,
  name: name?.substring(0, 30) + '...',
});
```

---

### Fase 3: Garantir Persistência do Status "disconnected"

#### Arquivo: `supabase/functions/sync-shopify-listing/index.ts`

**Melhorar tratamento de 404 (linhas 184-212):**

```typescript
if (!productResponse.ok) {
  // Tratamento especial para 404 - produto não existe mais na Shopify
  if (productResponse.status === 404) {
    console.log('⚠️ Produto não encontrado na Shopify (404) - marcando como desconectado');
    
    // ✅ MELHORADO: Usar .single() e capturar erro explicitamente
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('product_listings')
      .update({
        sync_status: 'disconnected',
        sync_error: 'Produto não encontrado na Shopify. Clique em "Republicar" para criar novamente.',
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', listingId)
      .select()
      .single(); // ✅ Forçar retorno de dados
    
    if (updateError) {
      console.error('❌ CRÍTICO: Erro ao atualizar status para disconnected:', updateError);
      console.error('❌ Detalhes:', JSON.stringify(updateError, null, 2));
      // Tentar novamente sem .single()
      const { error: retryError } = await supabaseAdmin
        .from('product_listings')
        .update({
          sync_status: 'disconnected',
          sync_error: 'Produto não encontrado na Shopify. Clique em "Republicar" para criar novamente.',
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', listingId);
      
      if (retryError) {
        console.error('❌ RETRY FALHOU:', retryError);
      } else {
        console.log('✅ Retry bem-sucedido');
      }
    } else {
      console.log('✅ Status atualizado para disconnected:', updateData);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Produto não encontrado na Shopify',
        shopifyStatus: 404,
        requiresRepublish: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  // ... resto do código ...
}
```

---

### Fase 4: Corrigir Frontend para Mostrar Alerta

#### Arquivo: `src/pages/ProductDetails.tsx`

**Mudança na linha 143:**

```typescript
// ❌ ANTES: Cálculo executado fora do corpo da função
const disconnectedListings = listings.filter(l => l.sync_status === 'disconnected');

// ✅ DEPOIS: Mover para dentro do render (recalcula em toda re-renderização)
export default function ProductDetails() {
  // ... estados ...
  
  // ✅ Recalcular sempre que listings mudar
  const disconnectedListings = useMemo(() => {
    return listings.filter(l => l.sync_status === 'disconnected');
  }, [listings]);
  
  // ... resto do código ...
}
```

**Adicionar import:**

```typescript
import { useState, useEffect, useMemo } from "react";
```

**Melhorar feedback visual após loadProductDetails (linha 211):**

```typescript
const handleProductUpdate = async (updatedProduct: Product) => {
  if (productDetails) {
    setProductDetails({
      ...productDetails,
      product: updatedProduct
    });
    
    // ✅ MELHORADO: Mostrar loading e garantir atualização
    console.log('🔄 Recarregando listings após atualização...');
    await loadProductDetails();
    console.log('✅ Listings recarregados:', listings);
  }
};
```

---

### Fase 5: Criar Função de Migração de Dados

#### Nova Edge Function: `supabase/functions/fix-shopify-listings/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Esta função corrige product_listings da Shopify com IDs incorretos.
 * 
 * Problema: platform_product_id contém variant.id ao invés de product.id
 * Solução: Buscar dados corretos na API da Shopify e atualizar banco
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔧 Iniciando correção de listings da Shopify...');

    // Buscar todos os listings Shopify do usuário
    const { data: listings, error: listingsError } = await supabaseAdmin
      .from('product_listings')
      .select('id, platform_product_id, platform_variant_id, integration_id, product_id')
      .eq('user_id', user.id)
      .eq('platform', 'shopify');

    if (listingsError || !listings || listings.length === 0) {
      console.log('Nenhum listing Shopify encontrado');
      return new Response(
        JSON.stringify({ message: 'Nenhum listing Shopify encontrado', fixed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Encontrados ${listings.length} listings para verificar`);

    let fixed = 0;
    let errors = 0;

    for (const listing of listings) {
      try {
        // Se platform_product_id tem mais de 12 dígitos, provavelmente é um variant ID
        if (listing.platform_product_id.length > 12) {
          console.log(`🔍 Verificando listing ${listing.id} (ID suspeito: ${listing.platform_product_id})`);

          // Buscar integração
          const { data: integration } = await supabaseAdmin
            .from('integrations')
            .select('encrypted_access_token, shop_domain')
            .eq('id', listing.integration_id)
            .single();

          if (!integration) {
            console.warn(`⚠️ Integração não encontrada para listing ${listing.id}`);
            continue;
          }

          // Descriptografar token
          const { data: accessToken } = await supabaseAdmin.rpc('decrypt_token', {
            encrypted_token: integration.encrypted_access_token
          });

          if (!accessToken) {
            console.warn(`⚠️ Token não encontrado para listing ${listing.id}`);
            continue;
          }

          const shopUrl = integration.shop_domain.includes('.myshopify.com') 
            ? integration.shop_domain 
            : `${integration.shop_domain}.myshopify.com`;

          // Buscar dados da variant na Shopify
          const variantResponse = await fetch(
            `https://${shopUrl}/admin/api/2024-01/variants/${listing.platform_product_id}.json`,
            {
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
              }
            }
          );

          if (variantResponse.ok) {
            const variantData = await variantResponse.json();
            const correctProductId = variantData.variant.product_id.toString();
            const correctVariantId = variantData.variant.id.toString();

            console.log(`✅ IDs corretos encontrados:`, {
              listingId: listing.id,
              incorrectProductId: listing.platform_product_id,
              correctProductId,
              correctVariantId,
            });

            // Atualizar listing com IDs corretos
            const { error: updateError } = await supabaseAdmin
              .from('product_listings')
              .update({
                platform_product_id: correctProductId,
                platform_variant_id: correctVariantId,
                sync_status: 'active',
                sync_error: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', listing.id);

            if (updateError) {
              console.error(`❌ Erro ao atualizar listing ${listing.id}:`, updateError);
              errors++;
            } else {
              console.log(`✅ Listing ${listing.id} corrigido`);
              fixed++;
            }
          } else if (variantResponse.status === 404) {
            console.log(`⚠️ Variant ${listing.platform_product_id} não encontrada - marcando como disconnected`);
            
            await supabaseAdmin
              .from('product_listings')
              .update({
                sync_status: 'disconnected',
                sync_error: 'Produto não encontrado na Shopify.',
                updated_at: new Date().toISOString(),
              })
              .eq('id', listing.id);
              
            fixed++;
          }
        }
      } catch (error: any) {
        console.error(`💥 Erro ao processar listing ${listing.id}:`, error.message);
        errors++;
      }
    }

    console.log(`🎉 Correção concluída: ${fixed} corrigidos, ${errors} erros`);

    return new Response(
      JSON.stringify({ 
        message: 'Correção concluída',
        fixed,
        errors,
        total: listings.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

**Configuração em `supabase/config.toml`:**

```toml
[functions.fix-shopify-listings]
verify_jwt = false
```

---

### Fase 6: Adicionar Botão de Correção no Frontend

#### Arquivo: `src/pages/Integrations.tsx` (ou criar nova página)

```typescript
const handleFixShopifyListings = async () => {
  setIsFixing(true);
  try {
    const { data, error } = await supabase.functions.invoke('fix-shopify-listings');
    
    if (error) throw error;
    
    toast({
      title: "✅ Correção concluída",
      description: `${data.fixed} listings corrigidos de ${data.total} total.`,
    });
  } catch (error: any) {
    toast({
      title: "❌ Erro na correção",
      description: error.message,
      variant: "destructive",
    });
  } finally {
    setIsFixing(false);
  }
};

// No JSX
<Button onClick={handleFixShopifyListings} disabled={isFixing}>
  {isFixing ? 'Corrigindo...' : 'Corrigir Listings Shopify'}
</Button>
```

---

## Resumo das Mudanças

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `supabase/functions/import-products/index.ts` | Armazenar IDs corretos da Shopify | ✅ Crítico |
| `supabase/functions/sync-shopify-listing/index.ts` | Melhorar persistência do status | ✅ Crítico |
| `src/pages/ProductDetails.tsx` | Usar useMemo para disconnectedListings | ✅ Crítico |
| `supabase/functions/fix-shopify-listings/index.ts` | Nova função para corrigir dados existentes | ✅ Importante |
| `src/pages/Integrations.tsx` | Botão para executar correção | ⚠️ Opcional |

---

## Ordem de Implementação

1. **Criar função de migração** (`fix-shopify-listings`) ← Executar PRIMEIRO para corrigir dados existentes
2. **Deploy da função**
3. **Executar correção via UI** (botão temporário)
4. **Corrigir importação** (`import-products`)
5. **Melhorar sincronização** (`sync-shopify-listing`)
6. **Corrigir frontend** (`ProductDetails.tsx`)
7. **Testar fluxo completo**

---

## Testes de Validação

### Teste 1: Importação Correta
1. Deletar todos os produtos existentes
2. Importar produtos da Shopify
3. Verificar no banco:
```sql
SELECT 
  platform_product_id, 
  platform_variant_id,
  LENGTH(platform_product_id) as product_id_length,
  LENGTH(platform_variant_id) as variant_id_length
FROM product_listings 
WHERE platform = 'shopify';
```
- ✅ `product_id_length` deve ser ≤ 12
- ✅ `variant_id_length` deve ser > 12
- ✅ Ambos devem estar preenchidos

### Teste 2: Sincronização Funcional
1. Editar produto importado
2. Verificar logs da edge function
3. Confirmar que produto foi atualizado na Shopify
4. Verificar que status permanece `active`

### Teste 3: Detecção de Produto Deletado
1. Deletar produto na Shopify manualmente
2. Editar produto no UNISTOCK
3. Verificar que status muda para `disconnected`
4. Confirmar que alerta aparece no frontend
5. Clicar em "Republicar" e verificar sucesso

### Teste 4: Republicação
1. Com produto `disconnected`, clicar "Republicar"
2. Verificar que novo produto é criado na Shopify
3. Verificar que novo listing é criado com IDs corretos
4. Verificar que status muda para `active`

---

## Diagramas

### Fluxo de Importação Correto

```text
SHOPIFY API
    │
    │ GET /products.json
    │
    ▼
┌────────────────────────────────┐
│ {                              │
│   id: 9876543210,        ◄──┐  │
│   title: "Camiseta",        │  │
│   variants: [               │  │
│     {                       │  │
│       id: 53299378323740 ◄─┼──┼── Variant ID
│       sku: "CAM-001",      │  │
│       price: 49.90         │  │
│     }                       │  │
│   ]                         │  │
│ }                           │  │
└────────────────────────────────┘
         │                    │
         │ Mapear             │
         │                    │
         ▼                    │
┌────────────────────────────────┐
│ UNISTOCK: products             │
│ sku: "CAM-001"                 │
│ name: "Camiseta"               │
└────────────────────────────────┘
         │                    │
         │                    │
         ▼                    │
┌────────────────────────────────┐
│ UNISTOCK: product_listings     │
│                                │
│ platform_product_id: "9876..." │◄─┘ Product ID
│ platform_variant_id: "53299..."│   Variant ID
│ platform_metadata: {...}       │
└────────────────────────────────┘
```

### Fluxo de Sincronização Correto

```text
Frontend: Editar Produto
         │
         │ POST /update-product
         │
         ▼
┌────────────────────────────────┐
│ update-product Edge Function   │
│ - Atualiza banco local         │
│ - Busca product_listings       │
└────────────────────────────────┘
         │
         │ POST /sync-shopify-listing
         │ { platformProductId: "9876543210" }  ◄── Product ID correto
         │
         ▼
┌────────────────────────────────┐
│ sync-shopify-listing           │
│ PUT /products/9876543210.json  │  ◄── Usa product.id
│                                │
│ ✅ 200 OK                      │
│ ✅ Status permanece 'active'   │
└────────────────────────────────┘
```

### Fluxo de Detecção de Desconexão

```text
Frontend: Editar Produto Deletado
         │
         │ POST /update-product
         │
         ▼
┌────────────────────────────────┐
│ update-product Edge Function   │
└────────────────────────────────┘
         │
         │ POST /sync-shopify-listing
         │ { platformProductId: "9876543210" }
         │
         ▼
┌────────────────────────────────┐
│ sync-shopify-listing           │
│ PUT /products/9876543210.json  │
│                                │
│ ❌ 404 NOT FOUND               │
└────────────────────────────────┘
         │
         │ UPDATE product_listings
         │ SET sync_status = 'disconnected'
         │
         ▼
┌────────────────────────────────┐
│ Banco de Dados                 │
│ sync_status: 'disconnected' ✅ │
└────────────────────────────────┘
         │
         │ loadProductDetails()
         │
         ▼
┌────────────────────────────────┐
│ Frontend                       │
│ - Alert vermelho exibido ✅    │
│ - Botão "Republicar" ativo ✅  │
└────────────────────────────────┘
```

---

## Notas Finais

**Por que esse problema aconteceu?**
- Falta de documentação sobre IDs da Shopify
- Confusão entre `product.id` (produto) e `variant.id` (variante)
- Falta de validação nos IDs salvos

**Como prevenir no futuro?**
- ✅ Adicionar validações de tamanho de ID
- ✅ Adicionar testes automatizados
- ✅ Documentar estrutura de IDs de cada plataforma
- ✅ Adicionar logs mais detalhados

**Impacto da correção:**
- Produtos importados agora sincronizam corretamente
- Detecção automática de produtos deletados funciona
- Sistema de republicação funciona
- Usuário tem controle total sobre produtos em múltiplas plataformas

