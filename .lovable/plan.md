
# Implementar Sincronização de Produtos com Mercado Livre

## Resumo

Quando você atualiza um produto na UNISTOCK (preço, nome, estoque, imagem), a alteração será automaticamente enviada para o Mercado Livre via API, mantendo os dados sincronizados em ambas as plataformas.

---

## O que será sincronizado

| Campo UNISTOCK | Campo Mercado Livre | Observação |
|----------------|---------------------|------------|
| `selling_price` | `price` | Preço de venda |
| `stock` | `available_quantity` | Quantidade disponível |
| `name` | `title` | Só funciona se o item não tiver vendas |
| `image_url` | `pictures` | Imagem principal |

---

## Fluxo de Sincronização

```text
┌──────────────────┐     ┌──────────────────────┐     ┌────────────────────────────┐
│  Editar Produto  │────>│  update-product      │────>│  sync-mercadolivre-listing │
│  (Products.tsx)  │     │  (Edge Function)     │     │  (Nova Edge Function)      │
└──────────────────┘     └──────────────────────┘     └────────────────────────────┘
                                   │                              │
                                   │                              │
                              Salva local                   PUT /items/{ID}
                              no Supabase                   na API ML
```

---

## Etapas de Implementação

### Etapa 1: Criar Edge Function `sync-mercadolivre-listing`

Nova função que receberá os dados do produto e enviará para a API do Mercado Livre:

**Responsabilidades:**
- Buscar integração e descriptografar token
- Verificar se token é válido (renovar se expirado)
- Chamar `PUT https://api.mercadolibre.com/items/{ITEM_ID}` com os campos atualizados
- Tratar erros da API (ex: título não pode ser alterado se já teve vendas)
- Atualizar status de sincronização no `product_listings`

**Campos que a API do Mercado Livre aceita para atualização:**
- `price` - Preço de venda
- `available_quantity` - Estoque (se 0, o item é pausado automaticamente)
- `title` - Nome (apenas se não tiver vendas)
- `pictures` - Array de imagens

### Etapa 2: Integrar no `update-product`

Modificar a Edge Function existente para chamar `sync-mercadolivre-listing` quando detectar listings da plataforma `mercadolivre`.

### Etapa 3: Feedback Visual no Frontend

Mostrar resultado da sincronização para o usuário:
- Sucesso: "Produto atualizado no Mercado Livre"
- Erro de título: "Nome não pode ser alterado (produto já teve vendas)"
- Token expirado: "Reconecte sua conta do Mercado Livre"

---

## Comportamentos Especiais

### Estoque Zero
Quando estoque = 0, o Mercado Livre automaticamente pausa o anúncio com status `out_of_stock`. Quando estoque > 0, o anúncio é reativado.

### Alteração de Título
O Mercado Livre **não permite** alterar o título de produtos que já tiveram vendas (`sold_quantity > 0`). A função detectará isso e informará ao usuário.

### Token Expirado
Se o token de acesso estiver expirado, a função tentará renovar automaticamente usando o refresh token antes de falhar.

---

## Seção Técnica

### Arquivos a Criar

**`supabase/functions/sync-mercadolivre-listing/index.ts`**

```typescript
// Parâmetros de entrada:
interface SyncRequest {
  productId: string;
  integrationId: string;
  platformProductId: string; // MLB123...
  sellingPrice?: number;
  stock?: number;
  name?: string;
  imageUrl?: string;
}

// Payload para API Mercado Livre:
const mlPayload = {
  price: sellingPrice,
  available_quantity: stock,
  title: name, // se permitido
  pictures: imageUrl ? [{ source: imageUrl }] : undefined
};

// Chamada API:
PUT https://api.mercadolibre.com/items/{platformProductId}
Headers: Authorization: Bearer {access_token}
```

### Arquivos a Modificar

**`supabase/functions/update-product/index.ts`**
- Linhas 173-180: Substituir o TODO por chamada real à `sync-mercadolivre-listing`
- Passar `platform_product_id` do listing para a função de sincronização

### Tratamento de Erros da API ML

| Erro | Causa | Ação |
|------|-------|------|
| 401 Unauthorized | Token expirado | Renovar token e tentar novamente |
| 403 Forbidden | Sem permissão | Informar reconexão necessária |
| 400 "title cannot be changed" | Produto tem vendas | Sincronizar apenas preço/estoque |

### Atualização do Banco de Dados

Após sincronização bem-sucedida:
```sql
UPDATE product_listings 
SET 
  sync_status = 'active',
  last_sync_at = NOW(),
  sync_error = NULL
WHERE id = {listing_id}
```

Após falha:
```sql
UPDATE product_listings 
SET 
  sync_status = 'error',
  sync_error = {mensagem_erro}
WHERE id = {listing_id}
```

---

## Resultado Final

- Editar produto na UNISTOCK atualiza automaticamente no Mercado Livre
- Preço e estoque sempre sincronizados
- Nome sincronizado quando possível (sem vendas)
- Feedback claro sobre sucesso ou erros
- Status de sincronização visível na página do produto
