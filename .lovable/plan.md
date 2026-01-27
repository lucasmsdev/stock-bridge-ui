
# Plano: Visualização e Edição de Fotos por Marketplace

## Objetivo

Permitir que o usuário visualize as imagens de cada produto em cada marketplace conectado e possa alterar essas imagens individualmente.

---

## Situação Atual

### O que já existe:
- **Mercado Livre**: A função `get-product-details` busca as imagens via API e retorna em `channelStocks.images`
- **Shopify**: As imagens são salvas no `platform_metadata.images` durante a importação
- **Frontend**: Exibe imagens de forma básica no card "Imagens do Produto" (linha 452-478 do ProductDetails.tsx)

### O que falta:
- Visualizar imagens separadas por marketplace (não misturadas)
- Permitir adicionar/remover/reordenar imagens
- Sincronizar alterações de imagens para cada marketplace
- Buscar imagens atualizadas da Shopify (atualmente usa dados estáticos do metadata)

---

## Arquitetura da Solução

### Estrutura de Dados

```text
┌─────────────────────────────────────────────────────────────┐
│                    ProductDetails.tsx                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          MarketplaceImagesCard (NOVO)                 │   │
│  │                                                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │ Mercado     │  │ Shopify     │  │ Amazon      │    │   │
│  │  │ Livre       │  │             │  │             │    │   │
│  │  ├─────────────┤  ├─────────────┤  ├─────────────┤    │   │
│  │  │ [img1][img2]│  │ [img1][img2]│  │ [img1]      │    │   │
│  │  │ [+Adicionar]│  │ [+Adicionar]│  │ [+Adicionar]│    │   │
│  │  │ [Sincroniz] │  │ [Sincroniz] │  │ [Sincroniz] │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Fluxo de Dados

```text
1. Carregar Imagens:
   ProductDetails.tsx
         │
         ▼
   get-product-details (Edge Function)
         │
         ├──► Mercado Livre API: /items/{id} → pictures[]
         ├──► Shopify API: /products/{id}.json → images[]
         └──► Amazon SP-API: GET_LISTINGS_ITEM → main_product_image_locator[]

2. Atualizar Imagens:
   MarketplaceImagesCard.tsx
         │
         ▼
   sync-{platform}-listing (Edge Functions)
         │
         ├──► ML: PUT /items/{id} { pictures: [{source: url}] }
         ├──► Shopify: PUT /products/{id}.json { product: { images: [{src: url}] }}
         └──► Amazon: PATCH_LISTINGS_ITEM { main_product_image_locator: [...] }
```

---

## Implementação

### Fase 1: Novo Componente de Imagens por Marketplace

#### Arquivo: `src/components/products/MarketplaceImagesCard.tsx` (NOVO)

```typescript
interface MarketplaceImagesCardProps {
  productId: string;
  listings: ProductListing[];
  channelStocks: ChannelStock[];
  onImagesUpdated: () => void;
}
```

**Funcionalidades:**
- Tabs separadas para cada marketplace (ML, Shopify, Amazon)
- Grid de imagens com preview
- Botão para adicionar nova imagem (URL ou upload)
- Botão para remover imagem
- Drag and drop para reordenar
- Botão "Sincronizar Imagens" por marketplace
- Indicador de status (sincronizado/pendente/erro)

---

### Fase 2: Melhorar get-product-details

#### Arquivo: `supabase/functions/get-product-details/index.ts`

**Mudanças:**

1. **Shopify**: Buscar imagens atualizadas da API (não apenas do metadata)

```typescript
async function getShopifyStock(
  accessToken: string, 
  sku: string,
  integrationId: string,
  userId: string,
  supabase: any
): Promise<ChannelStock> {
  // Buscar product_listing para pegar platform_product_id
  const { data: listing } = await supabase
    .from('product_listings')
    .select('platform_product_id, platform_variant_id, integration_id')
    .eq('user_id', userId)
    .eq('platform', 'shopify')
    .eq('integration_id', integrationId)
    .maybeSingle();

  if (!listing) {
    return { channel: 'shopify', channelId: '-', stock: 0, status: 'not_published' };
  }

  // Buscar shop_domain
  const { data: integration } = await supabase
    .from('integrations')
    .select('shop_domain')
    .eq('id', integrationId)
    .single();

  // Consultar Shopify API
  const shopUrl = integration.shop_domain.includes('.myshopify.com') 
    ? integration.shop_domain 
    : `${integration.shop_domain}.myshopify.com`;
    
  const response = await fetch(
    `https://${shopUrl}/admin/api/2024-01/products/${listing.platform_product_id}.json`,
    { headers: { 'X-Shopify-Access-Token': accessToken } }
  );

  if (!response.ok) {
    return { channel: 'shopify', channelId: listing.platform_product_id, stock: 0, status: 'error' };
  }

  const data = await response.json();
  const variant = data.product?.variants?.[0];
  const images = data.product?.images?.map((img: any) => img.src) || [];

  return {
    channel: 'shopify',
    channelId: listing.platform_product_id,
    stock: variant?.inventory_quantity || 0,
    status: 'synced',
    images: images,  // ← Retornar array de URLs
  };
}
```

2. **Amazon**: Adicionar busca de imagens (se disponível no listing)

---

### Fase 3: Criar Edge Function para Atualizar Imagens

#### Arquivo: `supabase/functions/update-product-images/index.ts` (NOVO)

**Funcionalidades:**
- Receber: `{ productId, listingId, platform, images: string[] }`
- Rotear para a API correta de cada marketplace
- Retornar status de sincronização

```typescript
// Exemplo de payload
{
  productId: "uuid",
  listingId: "uuid",
  platform: "mercadolivre" | "shopify" | "amazon",
  images: [
    "https://exemplo.com/img1.jpg",
    "https://exemplo.com/img2.jpg"
  ]
}
```

**Por marketplace:**

- **Mercado Livre:**
```typescript
await fetch(`https://api.mercadolibre.com/items/${platformProductId}`, {
  method: 'PUT',
  headers: { 'Authorization': `Bearer ${accessToken}` },
  body: JSON.stringify({
    pictures: images.map(url => ({ source: url }))
  })
});
```

- **Shopify:**
```typescript
await fetch(`https://${shopUrl}/admin/api/2024-01/products/${platformProductId}.json`, {
  method: 'PUT',
  headers: { 'X-Shopify-Access-Token': accessToken },
  body: JSON.stringify({
    product: { images: images.map(url => ({ src: url })) }
  })
});
```

---

### Fase 4: Atualizar Frontend

#### Arquivo: `src/pages/ProductDetails.tsx`

**Mudanças:**

1. Importar novo componente:
```typescript
import { MarketplaceImagesCard } from "@/components/products/MarketplaceImagesCard";
```

2. Substituir card de imagens antigo pelo novo:
```typescript
{/* Imagens por Marketplace */}
<MarketplaceImagesCard
  productId={product.id}
  listings={listings}
  channelStocks={channelStocks}
  onImagesUpdated={loadProductDetails}
/>
```

---

## Componentes Visuais

### MarketplaceImagesCard - Layout

```text
┌─────────────────────────────────────────────────────────────┐
│  📸 Imagens por Marketplace                                  │
│  Gerencie as imagens do produto em cada plataforma          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                        │
│  │ ML      │ │ Shopify │ │ Amazon  │  ← Tabs                │
│  └─────────┘ └─────────┘ └─────────┘                        │
│                                                              │
│  ╔═══════════════════════════════════════════════════════╗  │
│  ║  Mercado Livre  ✓ Sincronizado                        ║  │
│  ╠═══════════════════════════════════════════════════════╣  │
│  ║                                                        ║  │
│  ║  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     ║  │
│  ║  │  img1   │ │  img2   │ │  img3   │ │   +     │     ║  │
│  ║  │  [🗑️]  │ │  [🗑️]  │ │  [🗑️]  │ │ Adicionar│    ║  │
│  ║  └─────────┘ └─────────┘ └─────────┘ └─────────┘     ║  │
│  ║                                                        ║  │
│  ║  Arraste para reordenar                               ║  │
│  ║                                                        ║  │
│  ║  ┌──────────────────────────────────────────────────┐ ║  │
│  ║  │ 🔗 Cole a URL da nova imagem...                  │ ║  │
│  ║  └──────────────────────────────────────────────────┘ ║  │
│  ║                                                        ║  │
│  ║  [ 🔄 Sincronizar Imagens ]                           ║  │
│  ╚═══════════════════════════════════════════════════════╝  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/products/MarketplaceImagesCard.tsx` | Criar | Componente principal de gerenciamento de imagens |
| `supabase/functions/get-product-details/index.ts` | Modificar | Adicionar busca real de imagens Shopify/Amazon |
| `supabase/functions/update-product-images/index.ts` | Criar | Edge function para sincronizar imagens |
| `src/pages/ProductDetails.tsx` | Modificar | Integrar novo componente |
| `supabase/config.toml` | Modificar | Adicionar nova edge function |

---

## Limitações por Marketplace

| Marketplace | Max Imagens | Formatos | Tamanho Máximo | Notas |
|-------------|-------------|----------|----------------|-------|
| Mercado Livre | 10 | JPEG, PNG | 4MB | Primeira imagem é a principal |
| Shopify | Ilimitado | JPEG, PNG, GIF, WebP | 20MB | Pode ter múltiplas variantes |
| Amazon | 9 | JPEG, PNG, TIFF, GIF | 10MB | MAIN_IMAGE obrigatória, regras específicas |

---

## Próximos Passos (Após Implementação)

1. **Upload direto**: Permitir upload de arquivos locais (não apenas URLs)
2. **Compressão**: Comprimir imagens automaticamente antes do upload
3. **Validação**: Verificar dimensões mínimas/máximas por marketplace
4. **Histórico**: Manter histórico de imagens alteradas
5. **Bulk edit**: Editar imagens de múltiplos produtos de uma vez

---

## Ordem de Implementação

1. Criar `MarketplaceImagesCard.tsx` com UI básica
2. Atualizar `get-product-details` para buscar imagens Shopify
3. Criar `update-product-images` edge function
4. Integrar no `ProductDetails.tsx`
5. Testar com Mercado Livre
6. Testar com Shopify
7. Adicionar Amazon (quando integração estiver completa)
