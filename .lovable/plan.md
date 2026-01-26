
# Plano: Corrigir Visualização de Status "Disconnected" no Frontend

## Problema Identificado

O banco de dados está salvando corretamente `sync_status: 'disconnected'`, mas o frontend não mostra o Alert porque **não recarrega os listings após editar o produto**.

### Fluxo Atual (Quebrado)

```
1. Usuário edita produto
2. update-product Edge Function detecta 404
3. sync-shopify-listing salva 'disconnected' no banco ✅
4. Frontend recebe resposta da update-product
5. Frontend NÃO recarrega listings ❌
6. Estado 'listings' continua com valores antigos ❌
7. Alert não aparece ❌
```

### Evidência

**Banco de dados (correto):**
```sql
SELECT sync_status FROM product_listings 
WHERE product_id = 'e0c6f74f-69eb-42ce-b273-8aea63b50835'
-- Retorna: 'disconnected' ✅
```

**Frontend (desatualizado):**
```typescript
const disconnectedListings = listings.filter(l => l.sync_status === 'disconnected');
// listings está com valores antigos porque não foi recarregado
```

---

## Solução 1: Recarregar Dados Após Edição (RECOMENDADO)

**Vantagem:** Simples, direto, garante dados sempre atualizados  
**Desvantagem:** Faz uma query extra ao banco

### Mudanças Necessárias

#### Arquivo: `src/pages/ProductDetails.tsx`

**Linha ~203 (função `handleProductUpdate`):**

**Antes:**
```typescript
const handleProductUpdate = (updatedProduct: Product) => {
  if (productDetails) {
    setProductDetails({
      ...productDetails,
      product: updatedProduct
    });
  }
};
```

**Depois:**
```typescript
const handleProductUpdate = async (updatedProduct: Product) => {
  if (productDetails) {
    setProductDetails({
      ...productDetails,
      product: updatedProduct
    });
    
    // Recarregar listings para capturar mudanças de sync_status
    await loadProductDetails();
  }
};
```

**Por que funciona:**
- `loadProductDetails()` já existe e busca os `listings` do banco (linhas 265-273)
- Após editar, os listings são recarregados automaticamente
- `disconnectedListings` recalcula com dados frescos
- Alert aparece imediatamente se status for `'disconnected'`

---

## Solução 2: Atualizar Estado Local Após Resposta da API

**Vantagem:** Não faz query extra, usa dados da resposta  
**Desvantagem:** Mais complexo, depende da Edge Function retornar listings atualizados

### Mudanças Necessárias

#### Arquivo: `supabase/functions/update-product/index.ts`

**Adicionar ao final da resposta (após linha ~230):**

```typescript
// Buscar listings atualizados para retornar ao frontend
const { data: updatedListings } = await supabaseAdmin
  .from('product_listings')
  .select('id, platform, integration_id, platform_product_id, sync_status, sync_error')
  .eq('product_id', productId)
  .eq('user_id', userId);

return new Response(
  JSON.stringify({ 
    success: true, 
    product: updatedProduct,
    listings: updatedListings || [], // NOVO
    syncResults,
    message
  }),
  // ...
);
```

#### Arquivo: `src/components/financial/FinancialDataForm.tsx`

**Atualizar para passar listings ao callback `onUpdate`:**

```typescript
// Após salvar produto com sucesso
if (response.data.success) {
  onUpdate(response.data.product, response.data.listings); // Passar listings também
}
```

#### Arquivo: `src/pages/ProductDetails.tsx`

**Atualizar assinatura de `handleProductUpdate`:**

```typescript
const handleProductUpdate = (updatedProduct: Product, updatedListings?: ProductListing[]) => {
  if (productDetails) {
    setProductDetails({
      ...productDetails,
      product: updatedProduct
    });
    
    if (updatedListings) {
      setListings(updatedListings);
    }
  }
};
```

---

## Solução 3: Implementar getShopifyStock Real (COMPLETO, MAS COMPLEXO)

**Vantagem:** Resolve o problema de raiz, torna `get-product-details` realmente funcional  
**Desvantagem:** Muito trabalho, requer integração completa com Shopify API

### Mudanças Necessárias

#### Arquivo: `supabase/functions/get-product-details/index.ts`

**Substituir placeholder `getShopifyStock` (linhas 404-413):**

```typescript
async function getShopifyStock(
  accessToken: string, 
  sku: string,
  integrationId: string,
  userId: string,
  supabase: any
): Promise<ChannelStock> {
  try {
    // 1. Buscar shop domain da integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('shop_domain')
      .eq('id', integrationId)
      .single();
    
    if (!integration?.shop_domain) {
      return {
        channel: 'shopify',
        channelId: '-',
        stock: 0,
        status: 'error'
      };
    }
    
    // 2. Buscar product_listing para pegar platform_product_id
    const { data: listing } = await supabase
      .from('product_listings')
      .select('platform_product_id, sync_status')
      .eq('user_id', userId)
      .eq('platform', 'shopify')
      .eq('integration_id', integrationId)
      .maybeSingle();
    
    if (!listing) {
      return {
        channel: 'shopify',
        channelId: '-',
        stock: 0,
        status: 'not_published'
      };
    }
    
    // Se o listing está disconnected, retornar isso
    if (listing.sync_status === 'disconnected') {
      return {
        channel: 'shopify',
        channelId: listing.platform_product_id,
        stock: 0,
        status: 'disconnected' // NOVO status
      };
    }
    
    // 3. Consultar Shopify API
    const shopifyUrl = `https://${integration.shop_domain}/admin/api/2024-01/products/${listing.platform_product_id}.json`;
    
    const response = await fetch(shopifyUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 404) {
      return {
        channel: 'shopify',
        channelId: listing.platform_product_id,
        stock: 0,
        status: 'disconnected' // Produto não existe mais
      };
    }
    
    if (!response.ok) {
      return {
        channel: 'shopify',
        channelId: listing.platform_product_id,
        stock: 0,
        status: 'error'
      };
    }
    
    const data = await response.json();
    const variant = data.product?.variants?.[0];
    
    return {
      channel: 'shopify',
      channelId: listing.platform_product_id,
      stock: variant?.inventory_quantity || 0,
      status: 'synced'
    };
    
  } catch (error) {
    console.error('Error fetching Shopify stock:', error);
    return {
      channel: 'shopify',
      channelId: '-',
      stock: 0,
      status: 'error'
    };
  }
}
```

**Atualizar type ChannelStock (linha 14):**

```typescript
interface ChannelStock {
  channel: string;
  channelId: string;
  stock: number;
  status: 'synchronized' | 'divergent' | 'not_published' | 'synced' | 'error' | 'not_found' | 'token_expired' | 'disconnected';
  //                                                                                                                    ^^^^^^^^^ NOVO
  images?: string[];
}
```

**Atualizar chamada (linha 146):**

```typescript
} else if (integration.platform === 'shopify') {
  channelStock = await getShopifyStock(
    accessToken, 
    sku,
    integration.id,
    user.id,
    supabase
  );
}
```

---

## Comparação das Soluções

| Solução | Complexidade | Tempo | Eficácia | Recomendação |
|---------|--------------|-------|----------|--------------|
| 1. Recarregar após edição | Baixa | 5 min | ✅ Alta | ⭐⭐⭐⭐⭐ **MELHOR** |
| 2. Retornar listings na resposta | Média | 15 min | ✅ Alta | ⭐⭐⭐⭐ |
| 3. Implementar Shopify real | Alta | 1-2h | ✅✅ Muito Alta | ⭐⭐⭐ (overkill para o problema atual) |

---

## Recomendação Final

**Implementar Solução 1** porque:
- ✅ Resolve o problema imediatamente
- ✅ Código mínimo (3 linhas)
- ✅ Sem refatoração grande
- ✅ Funciona para todas as plataformas (não só Shopify)
- ✅ Garante dados sempre sincronizados

**Depois (opcional)**, implementar Solução 3 para melhorar performance e ter dados em tempo real.

---

## Arquivos Modificados (Solução 1)

| Arquivo | Mudança | Linhas |
|---------|---------|--------|
| `src/pages/ProductDetails.tsx` | Adicionar `await loadProductDetails()` em `handleProductUpdate` | ~203-210 |

---

## Teste de Validação

1. ✅ Editar o "Produto" na página de detalhes
2. ✅ Verificar que após salvar:
   - Toast de sucesso aparece
   - Página recarrega dados
   - Alert vermelho aparece com botão "Republicar na Shopify"
3. ✅ Clicar em "Republicar"
4. ✅ Verificar que cria novo produto na Shopify

---

## Logs Esperados (após correção)

**Console do navegador:**
```
Calling get-product-details function for product SKU: 53299378323740
Product details received: {...}
```

**Estado atualizado:**
```javascript
listings = [
  {
    id: "0de0e982-1ca3-4b76-b198-0d1778b09d52",
    platform: "shopify",
    sync_status: "disconnected", // ✅
    sync_error: "Produto não encontrado na Shopify..."
  }
]

disconnectedListings = [...]  // ✅ length > 0
```

**UI:**
```
⚠️ Alert vermelho exibido
🔄 Botão "Republicar na Shopify" visível
```
