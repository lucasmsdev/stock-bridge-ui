
# Plano: Corrigir Sincronização do Bulk Update com Amazon

## Problema Identificado

A função `bulk-update-products` está chamando a sincronização de forma incorreta. Atualmente usa:

```typescript
await supabase.functions.invoke(syncFunction, {
  body: { 
    productId: listing.product_id,
    listingId: listing.id 
  },
});
```

Mas a função `sync-amazon-listing` espera receber:

```typescript
{ 
  productId, sku, stock, sellingPrice, name, imageUrl, integrationId 
}
```

**Resultado**: A sincronização é chamada mas sem os dados atualizados, então nada é enviado à Amazon.

---

## Sobre as Imagens

O comportamento que você observou é esperado:

1. **Imagem aparece no Seller Central mas não na página do produto**: A Amazon processa imagens de forma assíncrona. Alterações podem levar de **24 a 48 horas** para refletir no catálogo público.

2. **Imagem setada como principal automaticamente**: Quando você envia uma nova imagem, ela substitui a principal existente. Para manter a ordem das imagens, todo o conjunto deve ser reenviado na ordem desejada.

---

## Solução Proposta

Modificar a função `bulk-update-products` para:

1. Buscar os dados completos de cada produto antes de sincronizar
2. Usar `fetch` direto (como faz `update-product`) em vez de `supabase.functions.invoke`
3. Passar todos os parâmetros necessários para cada função de sync

### Fluxo Corrigido

```text
+-------------------+
| Bulk Update       |
+-------------------+
         |
         v
+----------------------------+
| Para cada produto:         |
| 1. Atualizar no banco      |
| 2. Buscar dados completos  |
| 3. Buscar listing + SKU    |
+----------------------------+
         |
         v
+--------------------------------+
| Para cada listing:              |
| - Amazon: enviar sku, stock,    |
|   price, name, integrationId   |
| - Mercado Livre: enviar         |
|   platformProductId, etc        |
| - Shopify: enviar variantId     |
+--------------------------------+
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/bulk-update-products/index.ts` | Refatorar lógica de sincronização para buscar dados completos do produto e chamar funções de sync com todos os parâmetros necessários |

---

## Código a Ser Alterado

A seção de sincronização (linhas 181-235) será reescrita para:

1. Buscar os produtos atualizados com todos os campos necessários
2. Para cada listing, construir o payload correto baseado na plataforma
3. Usar `fetch` direto para as edge functions (mais confiável que `invoke`)

### Payload Correto para Amazon

```typescript
{
  productId: product.id,
  sku: product.sku,
  stock: product.stock,
  sellingPrice: product.selling_price,
  name: product.name,
  imageUrl: product.image_url,
  integrationId: listing.integration_id
}
```

### Payload Correto para Mercado Livre

```typescript
{
  productId: product.id,
  listingId: listing.id,
  integrationId: listing.integration_id,
  platformProductId: listing.platform_product_id,
  sellingPrice: product.selling_price,
  stock: product.stock,
  name: product.name,
  imageUrl: product.image_url
}
```

### Payload Correto para Shopify

```typescript
{
  productId: product.id,
  listingId: listing.id,
  integrationId: listing.integration_id,
  platformProductId: listing.platform_product_id,
  platformVariantId: listing.platform_variant_id,
  sellingPrice: product.selling_price,
  stock: product.stock,
  name: product.name,
  imageUrl: product.image_url
}
```

---

## Resultado Esperado

Após a correção:
- Alterações de preço e estoque feitas via edição em massa serão sincronizadas corretamente com a Amazon
- O estoque na Amazon refletirá o novo valor em 15 minutos a 2 horas
- Preços serão atualizados quase imediatamente (minutos)
- Imagens continuarão levando 24-48h para refletir no catálogo (limitação da Amazon)
