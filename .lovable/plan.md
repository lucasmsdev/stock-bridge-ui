

# Plano: Corrigir Sincronização de Imagens Amazon

## Diagnóstico do Problema

Quando você edita apenas o estoque na Amazon, o sistema está enviando também o campo `imageUrl` para a função de sincronização. A Amazon então tenta atualizar o slot `main_product_image_locator` com o valor da URL.

**O que pode estar acontecendo:**

1. Se `image_url` no banco estiver vazia ou diferente da imagem atual na Amazon, ela sobrescreve
2. A Amazon processa a atualização de imagem de forma assíncrona (24-48h para refletir) mas o slot de imagem pode ser limpo imediatamente

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/sync-amazon-listing/index.ts` | Adicionar flag `syncImages` e só atualizar imagem quando explicitamente solicitado |
| `supabase/functions/update-product/index.ts` | **NÃO** enviar `imageUrl` para Amazon durante updates de formulário normais |

---

## Alteração 1: `sync-amazon-listing/index.ts`

Modificar para aceitar uma flag `syncImages` similar ao que já fizemos no Mercado Livre:

```typescript
// Linha 108: adicionar syncImages ao destructuring
const { productId, sku, stock, sellingPrice, name, imageUrl, integrationId, description, syncImages } = await req.json();

// Linhas 417-428: só enviar imagem se syncImages === true
// ANTES (atual):
if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
  patches.push({
    op: 'replace',
    path: '/attributes/main_product_image_locator',
    value: [{
      marketplace_id: marketplaceId,
      media_location: imageUrl
    }]
  });
}

// DEPOIS (corrigido):
if (syncImages === true && imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
  console.log('🖼️ Atualizando imagem (ação explícita):', imageUrl);
  patches.push({
    op: 'replace',
    path: '/attributes/main_product_image_locator',
    value: [{
      marketplace_id: marketplaceId,
      media_location: imageUrl
    }]
  });
}
```

---

## Alteração 2: `update-product/index.ts`

Remover o envio de `imageUrl` para Amazon (linhas 124-134) já que imagens devem ser sincronizadas apenas pela galeria:

```typescript
// ANTES (atual):
body: JSON.stringify({
  productId: productId,
  sku: sku,
  stock: stock,
  sellingPrice: selling_price,
  name: name,
  imageUrl: image_url,  // ❌ Remove isso
  integrationId: listing.integration_id,
  description: description,
}),

// DEPOIS (corrigido):
body: JSON.stringify({
  productId: productId,
  sku: sku,
  stock: stock,
  sellingPrice: selling_price,
  name: name,
  // imageUrl: NÃO enviamos aqui - imagens só via galeria explícita
  integrationId: listing.integration_id,
  description: description,
}),
```

---

## Resultado Esperado

Após as correções:

1. **Editar estoque/preço/descrição** → NÃO altera as imagens na Amazon
2. **Usar galeria de imagens** → Sincroniza imagens via ação explícita com `syncImages: true`
3. Imagens existentes na Amazon permanecem intactas durante updates de dados

---

## Nota sobre a Imagem Perdida

Se a imagem já foi removida da Amazon, você precisará:

1. Aguardar a correção ser aplicada
2. Usar a **Galeria de Imagens** no UNISTOCK para sincronizar as fotos novamente
3. Lembrar que a Amazon pode levar 24-48h para processar alterações de imagem

