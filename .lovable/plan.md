
# Implementar Sincronização de Produtos com Shopify

## Resumo

Quando você atualiza um produto na UNISTOCK (preço, nome, estoque, imagem), a alteração será automaticamente enviada para a Shopify via API REST Admin, mantendo os dados sincronizados em ambas as plataformas.

---

## O Problema Atual

O código atual em `update-product` tem a sincronização Shopify marcada como "TODO":

```typescript
} else if (listing.platform === 'shopify') {
  // TODO: Implementar sincronização Shopify
  console.log('⏭️ Sincronização Shopify não implementada ainda');
  syncResults.push({
    platform: 'shopify',
    success: false,
    error: 'Sincronização não implementada',
  });
}
```

---

## O que será sincronizado

| Campo UNISTOCK | Campo Shopify | API |
|----------------|---------------|-----|
| `selling_price` | `variants[].price` | PUT /products/{id}.json |
| `stock` | `inventory_levels.set` | POST /inventory_levels/set.json |
| `name` | `title` | PUT /products/{id}.json |
| `image_url` | `images` | PUT /products/{id}.json |

---

## Fluxo de Sincronização

```text
┌──────────────────┐     ┌──────────────────────┐     ┌─────────────────────────┐
│  Editar Produto  │────>│  update-product      │────>│  sync-shopify-listing   │
│  (Products.tsx)  │     │  (Edge Function)     │     │  (Nova Edge Function)   │
└──────────────────┘     └──────────────────────┘     └─────────────────────────┘
                                   │                              │
                                   │                              │
                              Salva local                   PUT /products/{id}
                              no Supabase                   POST /inventory_levels/set
```

---

## Etapas de Implementação

### Etapa 1: Criar Edge Function `sync-shopify-listing`

Nova funcao que recebera os dados do produto e enviara para a API da Shopify:

**Responsabilidades:**
- Buscar integracao e descriptografar token
- Chamar `PUT /admin/api/2024-01/products/{id}.json` para atualizar titulo, preco e imagem
- Chamar `POST /admin/api/2024-01/inventory_levels/set.json` para atualizar estoque
- Buscar location_id da loja (necessario para atualizar estoque)
- Atualizar status de sincronizacao no `product_listings`

### Etapa 2: Integrar no `update-product`

Substituir o TODO por chamada real a `sync-shopify-listing`, similar ao que ja existe para Mercado Livre.

---

## Particularidades da API Shopify

### Atualizacao de Produto (titulo, preco, imagem)
```text
PUT /admin/api/2024-01/products/{product_id}.json
{
  "product": {
    "id": 123456789,
    "title": "Novo nome do produto",
    "variants": [
      {
        "id": 987654321,
        "price": "99.90"
      }
    ],
    "images": [
      { "src": "https://..." }
    ]
  }
}
```

### Atualizacao de Estoque (requer chamada separada)
O estoque no Shopify eh gerenciado pelo sistema de Inventory Levels, que requer:
1. `inventory_item_id` - obtido do variant
2. `location_id` - obtido da loja

```text
POST /admin/api/2024-01/inventory_levels/set.json
{
  "location_id": 123456,
  "inventory_item_id": 789012,
  "available": 50
}
```

---

## Secao Tecnica

### Arquivos a Criar

**`supabase/functions/sync-shopify-listing/index.ts`**

```typescript
// Parametros de entrada:
interface SyncRequest {
  productId: string;
  listingId: string;
  integrationId: string;
  platformProductId: string;      // ID do produto Shopify
  platformVariantId?: string;     // ID da variant (para preco)
  sellingPrice?: number;
  stock?: number;
  name?: string;
  imageUrl?: string;
}

// Fluxo:
// 1. Descriptografar token
// 2. Buscar location_id da loja (GET /locations.json)
// 3. Buscar inventory_item_id do variant (GET /variants/{id}.json)
// 4. Atualizar produto (PUT /products/{id}.json)
// 5. Atualizar estoque (POST /inventory_levels/set.json)
// 6. Atualizar product_listings com status
```

### Arquivos a Modificar

**`supabase/functions/update-product/index.ts`**
- Linhas 225-232: Substituir TODO por chamada a `sync-shopify-listing`
- Passar `platform_product_id` e `platform_variant_id` do listing

**`supabase/config.toml`**
- Adicionar entrada para `sync-shopify-listing`

### Tratamento de Erros

| Erro | Causa | Acao |
|------|-------|------|
| 401 Unauthorized | Token invalido | Informar reconexao necessaria |
| 404 Not Found | Produto deletado na Shopify | Marcar listing como `error` |
| 422 Unprocessable | Dados invalidos | Retornar detalhes do erro |

### Atualizacao do Banco de Dados

Apos sincronizacao bem-sucedida:
```sql
UPDATE product_listings 
SET 
  sync_status = 'active',
  last_sync_at = NOW(),
  sync_error = NULL
WHERE id = {listing_id}
```

---

## Resultado Esperado

| Cenario | Status |
|---------|--------|
| Alterar preco | Atualiza na Shopify |
| Alterar estoque | Atualiza na Shopify |
| Alterar nome | Atualiza na Shopify |
| Alterar imagem | Atualiza na Shopify |
| Token expirado | Mostra erro claro |

---

## Testes

Apos implementacao:
1. Conectar loja Shopify
2. Publicar produto na Shopify
3. Alterar preco/estoque na UNISTOCK
4. Verificar se alterou na Shopify
