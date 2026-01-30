
# Plano: Exibir Imagens da Amazon na Galeria do Produto

## Problema Identificado

Quando um produto está publicado na Amazon, as imagens que estão na plataforma **não aparecem na galeria** para gerenciamento (excluir, reordenar). Isso acontece porque:

1. **`get-product-details`** (que alimenta `channelStocks`) não tem tratamento para Amazon - ela cai no `else` genérico e retorna `status: 'not_published'` com `images: []`

2. **`verify-amazon-listing`** busca apenas a imagem principal (`mainImage` do `summaries`), mas não busca as imagens adicionais (`other_product_image_locator_1` a `8`)

## Solução

### Etapa 1: Adicionar função `getAmazonStock` em `get-product-details`

Criar uma nova função similar às existentes para Mercado Livre e Shopify que:
- Busque o listing Amazon via SP-API (`getListingsItem`)
- Extraia o estoque de `fulfillment_availability`
- Extraia **todas as imagens** (principal + adicionais)
- Retorne no formato `ChannelStock` com array `images`

### Etapa 2: Atualizar o switch/case para chamar `getAmazonStock`

No loop das integrações, adicionar caso para `integration.platform === 'amazon'` que chama a nova função.

### Etapa 3: Melhorar `verify-amazon-listing` para retornar todas as imagens

Atualizar para retornar array `observedAmazonImages` com todas as imagens (principal + adicionais) para uso futuro pelo botão "Revalidar".

## Detalhes Técnicos

### Nova função `getAmazonStock`

```typescript
async function getAmazonStock(
  refreshToken: string,
  sku: string,
  sellerId: string,
  marketplaceId: string,
  productListingId: string | null
): Promise<ChannelStock> {
  // 1. Inicializar Amazon SP-API
  const sellingPartner = new SellingPartnerAPI({...});

  // 2. Chamar getListingsItem com includedData=['attributes','summaries']
  const response = await sellingPartner.callAPI({
    operation: 'getListingsItem',
    ...
  });

  // 3. Extrair estoque
  const stock = response?.attributes?.fulfillment_availability?.[0]?.quantity ?? 0;

  // 4. Extrair TODAS as imagens
  const images: string[] = [];
  
  // Imagem principal do summaries
  if (response?.summaries?.[0]?.mainImage?.link) {
    images.push(response.summaries[0].mainImage.link);
  }
  
  // Imagens adicionais dos attributes
  for (let i = 1; i <= 8; i++) {
    const locator = response?.attributes?.[`other_product_image_locator_${i}`];
    if (locator?.[0]?.media_location) {
      images.push(locator[0].media_location);
    }
  }

  return {
    channel: 'amazon',
    channelId: sku,
    stock,
    status: 'synced',
    images
  };
}
```

### Estrutura de dados da Amazon SP-API

A Amazon armazena imagens em dois lugares:

1. **`summaries[0].mainImage.link`** - URL da imagem principal (já processada)
2. **`attributes.main_product_image_locator[0].media_location`** - URL original da imagem principal
3. **`attributes.other_product_image_locator_1` a `8`** - URLs das imagens adicionais

### Integração query adicional

Precisamos buscar mais campos da tabela `integrations` para Amazon:
- `marketplace_id`
- `selling_partner_id`
- `encrypted_refresh_token`

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/get-product-details/index.ts` | Modificar | Adicionar `getAmazonStock()` e integrar no loop principal |
| `supabase/functions/verify-amazon-listing/index.ts` | Modificar | Retornar array completo de imagens (`observedAmazonImages`) |

## Fluxo Após Implementação

```text
ProductDetails carrega
       │
       ▼
get-product-details busca integrações
       │
       ▼
Para cada integração Amazon:
  ├─ Busca listing no banco (product_listings)
  ├─ Descriptografa refresh token
  ├─ Chama Amazon SP-API (getListingsItem)
  ├─ Extrai estoque + TODAS imagens
  └─ Retorna ChannelStock com images[]
       │
       ▼
MarketplaceImagesCard recebe channelStocks
       │
       ▼
Tab Amazon mostra galeria com todas as imagens
para edição (excluir, reordenar)
```

## Tratamento de Erros

- **Token expirado**: Retornar `status: 'token_expired'`
- **Seller ID não configurado**: Retornar `status: 'error'` com mensagem
- **Produto não encontrado**: Retornar `status: 'not_found'`
- **Falha na API**: Retornar `status: 'error'` com `images: []`
