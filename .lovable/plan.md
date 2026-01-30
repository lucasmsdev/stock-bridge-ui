
# Plano: Sincronização Completa de Imagens com Amazon

## Visão Geral

Completar a integração da Amazon para que todas as funcionalidades disponíveis no Mercado Livre e Shopify também funcionem com a Amazon: alterar nome, imagem, preço e estoque. A maioria já funciona - falta apenas a sincronização de imagens pela galeria.

## Status Atual

| Funcionalidade | Mercado Livre | Shopify | Amazon |
|----------------|---------------|---------|--------|
| Alterar nome | ✅ | ✅ | ✅ (já funciona via FinancialDataForm) |
| Alterar preço | ✅ | ✅ | ✅ (já funciona via FinancialDataForm) |
| Alterar estoque | ✅ | ✅ | ✅ (já funciona via FinancialDataForm) |
| Alterar imagem principal | ✅ | ✅ | ✅ (já funciona via FinancialDataForm) |
| Galeria de imagens (múltiplas) | ✅ | ✅ | ❌ Precisa implementar |

## O que já está funcionando

O sistema atual já sincroniza com a Amazon quando o usuário salva o produto na página de detalhes:

1. `FinancialDataForm` chama `update-product` edge function
2. `update-product` detecta listings Amazon e chama `sync-amazon-listing`
3. `sync-amazon-listing` envia para Amazon SP-API:
   - Preço via `purchasable_offer`
   - Estoque via `fulfillment_availability`
   - Nome via `item_name`
   - Imagem principal via `main_product_image_locator`

## O que falta implementar

### 1. Função de atualização de múltiplas imagens na Amazon

A edge function `update-product-images` tem um stub para Amazon que precisa ser implementado:

```typescript
case 'amazon':
  result = { success: false, error: 'Amazon image sync not yet implemented' };
```

Precisamos implementar `updateAmazonImages()` usando a Amazon SP-API.

### 2. Frontend - Exibir Amazon na galeria de marketplace

O componente `MarketplaceImagesCard` já lista plataformas dinamicamente baseado nos listings ativos. Porém, as funcionalidades de upload e sincronização precisam ser habilitadas para Amazon.

## Arquitetura Técnica

### Amazon SP-API para Imagens

A Amazon usa a Listings Items API para gerenciar imagens:

```text
PATCH /listings/2021-08-01/items/{sellerId}/{sku}

Atributos de imagem suportados:
- main_product_image_locator (imagem principal)
- other_product_image_locator_1 até other_product_image_locator_8 (imagens adicionais)

Cada atributo recebe:
{
  "marketplace_id": "A2Q3Y263D00KWC",
  "media_location": "https://url-da-imagem.jpg"
}
```

### Limitações da Amazon

1. **Máximo de 9 imagens** (1 principal + 8 adicionais)
2. **Formatos aceitos**: JPEG, PNG, TIFF, GIF
3. **Tamanho máximo**: 10MB por imagem
4. **Requisitos de qualidade**: mínimo 1000px no lado maior para zoom
5. **Processamento assíncrono**: alterações podem levar até 24h para refletir

## Implementação

### Arquivo 1: `supabase/functions/update-product-images/index.ts`

Adicionar a função `updateAmazonImages`:

```typescript
async function updateAmazonImages(
  refreshToken: string,
  sku: string,
  images: string[],
  integrationId: string,
  marketplaceId: string,
  sellerId: string
): Promise<UpdateResult> {
  // 1. Inicializar cliente Amazon SP-API
  // 2. Construir patches para cada imagem:
  //    - images[0] -> main_product_image_locator
  //    - images[1-8] -> other_product_image_locator_1 a 8
  // 3. Enviar PATCH via Listings Items API
  // 4. Retornar resultado
}
```

Modificar o switch case para chamar a nova função:

```typescript
case 'amazon':
  // Buscar dados adicionais da integração
  const { data: amazonInt } = await supabase
    .from('integrations')
    .select('encrypted_refresh_token, marketplace_id, selling_partner_id')
    .eq('id', integration.id)
    .single();
  
  // Descriptografar refresh token
  const { data: refreshToken } = await supabase.rpc('decrypt_token', {
    encrypted_token: amazonInt.encrypted_refresh_token
  });
  
  result = await updateAmazonImages(
    refreshToken,
    listing.platform_product_id, // SKU
    images,
    integration.id,
    amazonInt.marketplace_id || 'A2Q3Y263D00KWC',
    amazonInt.selling_partner_id
  );
  break;
```

### Arquivo 2: `src/components/products/MarketplaceImagesCard.tsx`

O componente já funciona para Amazon pois:
1. Lista plataformas dinamicamente baseado em `listings`
2. Já tem limites definidos para Amazon (9 imagens, formatos JPEG/PNG/TIFF/GIF)
3. Chama `update-product-images` com a plataforma correta

Apenas garantir que a integração busque os dados corretos.

## Fluxo de Sincronização de Imagens

```text
┌─────────────────────────────────────────────┐
│  Usuário edita galeria na página do produto │
│  (ProductDetails > MarketplaceImagesCard)   │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│  Clica "Sincronizar" na aba Amazon          │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│  Frontend chama update-product-images       │
│  body: { productId, listingId,              │
│          platform: 'amazon', images: [...] }│
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│  Edge function:                             │
│  1. Busca listing + integração              │
│  2. Descriptografa refresh token            │
│  3. Inicializa Amazon SP-API                │
│  4. Constrói PATCH com imagens              │
│  5. Envia para Listings Items API           │
│  6. Atualiza sync_status no banco           │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│  Amazon processa (pode levar até 24h)       │
│  Usuário pode clicar "Revalidar" para ver   │
│  status atual via verify-amazon-listing     │
└─────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/update-product-images/index.ts` | Modificar | Implementar `updateAmazonImages()` |

## Detalhes Técnicos da Implementação

### Estrutura do PATCH para Imagens

```typescript
const patches = [
  // Imagem principal (sempre a primeira)
  {
    op: 'replace',
    path: '/attributes/main_product_image_locator',
    value: [{
      marketplace_id: 'A2Q3Y263D00KWC',
      media_location: images[0]
    }]
  },
  // Imagens adicionais (até 8)
  ...images.slice(1, 9).map((url, idx) => ({
    op: 'replace',
    path: `/attributes/other_product_image_locator_${idx + 1}`,
    value: [{
      marketplace_id: 'A2Q3Y263D00KWC',
      media_location: url
    }]
  }))
];
```

### Limpar Imagens Removidas

Se o usuário tinha 5 imagens e agora só tem 2, precisamos enviar `DELETE` para as extras:

```typescript
// Deletar slots não usados
for (let i = images.length - 1; i < 8; i++) {
  patches.push({
    op: 'delete',
    path: `/attributes/other_product_image_locator_${i + 1}`
  });
}
```

### Tratamento de Erros Específicos

- **INVALID_IMAGE_URL**: URL não acessível ou formato inválido
- **IMAGE_TOO_SMALL**: Imagem menor que 1000px
- **UNAUTHORIZED**: Token expirado - pedir reconexão
- **SELLER_NOT_AUTHORIZED**: Seller ID não tem permissão para editar este produto

## Estimativa de Complexidade

- **Backend**: Média (1 função nova similar às existentes)
- **Frontend**: Nenhuma alteração necessária (já suporta Amazon)
- **Testes**: Necessário testar com conta Amazon real

## Observações Importantes

1. **Processamento assíncrono**: A Amazon pode levar de 15 minutos a 24 horas para processar alterações de imagem. O usuário deve ser informado disso.

2. **Catálogo Amazon**: Produtos vinculados a ASINs de catálogo podem ter restrições de edição de imagem (similar ao Mercado Livre). Precisamos detectar e informar o usuário.

3. **Qualidade das imagens**: A Amazon pode rejeitar imagens de baixa qualidade. Devemos mostrar warnings claros.
