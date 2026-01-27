
# Plano: Importar Todas as Imagens dos Produtos por Marketplace

## Resumo

Atualmente a importação só salva **uma imagem** (thumbnail) por produto. Vamos modificar para puxar **todas as imagens** de cada marketplace e salvar no campo `images` (JSON array) da tabela `products`.

---

## Situação Atual

| Marketplace | O que importa hoje | O que deveria importar |
|-------------|-------------------|------------------------|
| Mercado Livre | `item.thumbnail` (1 imagem) | `item.pictures[]` (até 10 imagens) |
| Shopify | `product.image.src` (1 imagem) | `product.images[]` (todas) |
| Amazon | `image_url` do TSV (1 imagem) | Via Catalog Items API (múltiplas) |

### Campos Disponíveis no Banco

```text
products:
├── image_url (string) → Imagem principal (já existe)
└── images (JSON)      → Array de imagens (já existe, mas NÃO está sendo usado!)
```

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────┐
│                    IMPORTAÇÃO ATUAL                              │
│                                                                  │
│  API ML         →  thumbnail (1 img)  →  products.image_url     │
│  API Shopify    →  image.src (1 img)  →  products.image_url     │
│  Relatório TSV  →  image_url (1 img)  →  products.image_url     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    IMPORTAÇÃO NOVA                               │
│                                                                  │
│  API ML         →  pictures[] (todas) →  products.images []     │
│  API Shopify    →  images[] (todas)   →  products.images []     │
│  Catalog API    →  images[] (várias)  →  products.images []     │
│                                                                  │
│  * A primeira imagem do array é copiada para image_url          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementação

### Arquivo: `supabase/functions/import-products/index.ts`

#### Mudança 1: Mercado Livre (linhas ~298-340)

**Antes:**
```typescript
return {
  ...
  image_url: item.thumbnail ? item.thumbnail.replace('http://', 'https://') : null,
};
```

**Depois:**
```typescript
// Extrair todas as imagens do Mercado Livre
const allImages = item.pictures?.map((pic: any) => 
  (pic.secure_url || pic.url || '').replace('http://', 'https://')
).filter(Boolean) || [];

return {
  ...
  image_url: allImages[0] || (item.thumbnail ? item.thumbnail.replace('http://', 'https://') : null),
  images: allImages.length > 0 ? allImages : null,
};
```

---

#### Mudança 2: Shopify (linhas ~465-472)

**Antes:**
```typescript
const productData = {
  ...
  image_url: product.image?.src || null,
};
```

**Depois:**
```typescript
// Extrair todas as imagens do Shopify
const allImages = product.images?.map((img: any) => img.src).filter(Boolean) || [];

const productData = {
  ...
  image_url: allImages[0] || product.image?.src || null,
  images: allImages.length > 0 ? allImages : null,
};
```

---

#### Mudança 3: Amazon (linhas ~883-893)

A Amazon usa o relatório TSV que só tem 1 imagem. Para pegar múltiplas imagens, seria necessário chamar a Catalog Items API para cada ASIN - isso é custoso e lento.

**Abordagem otimizada**: Usar a imagem do TSV como principal, e opcionalmente buscar imagens extras via API só para produtos específicos (pode ser um segundo passo).

**Implementação inicial:**
```typescript
const productData = {
  ...
  image_url: processedImageUrl,
  images: processedImageUrl ? [processedImageUrl] : null,
};
```

---

#### Mudança 4: Preservar Imagens Existentes (linhas ~1260-1289)

Atualizar a lógica de preservação para incluir o campo `images`:

**Antes:**
```typescript
const { data: existingProducts } = await supabaseClient
  .from('products')
  .select('sku, image_url')
  ...
```

**Depois:**
```typescript
const { data: existingProducts } = await supabaseClient
  .from('products')
  .select('sku, image_url, images')
  ...

// Preservar images existentes também
if (!product.images && existingImagesMap.has(product.sku)) {
  product.images = existingImagesMap.get(product.sku);
}
```

---

## Formato de Dados

### Estrutura do campo `images`

```json
{
  "images": [
    "https://http2.mlstatic.com/D_NQ_NP_123-MLA456.jpg",
    "https://http2.mlstatic.com/D_NQ_NP_789-MLA012.jpg",
    "https://http2.mlstatic.com/D_NQ_NP_345-MLA678.jpg"
  ]
}
```

### Relação com MarketplaceImagesCard

O componente `MarketplaceImagesCard` já busca imagens em tempo real das APIs. O campo `images` no produto serve como:

1. **Cache inicial** - Exibir imagens enquanto carrega dados em tempo real
2. **Fallback** - Caso a API falhe
3. **Histórico** - Referência das imagens importadas originalmente

---

## Fluxo Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│                      IMPORTAÇÃO                                  │
│                                                                  │
│   1. Chamar API do marketplace                                   │
│   2. Extrair TODAS as imagens (não só thumbnail)                │
│   3. Salvar no campo products.images (JSON array)               │
│   4. Primeira imagem → products.image_url (compatibilidade)     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    VISUALIZAÇÃO                                  │
│                                                                  │
│   ProductDetails.tsx                                             │
│   └── MarketplaceImagesCard                                      │
│       ├── Mercado Livre: busca via API em tempo real            │
│       ├── Shopify: busca via Admin API em tempo real            │
│       └── Amazon: usa products.images (cache)                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/import-products/index.ts` | Extrair todas as imagens por marketplace |

---

## Detalhes Técnicos

### Mercado Livre - Estrutura da API

```json
{
  "id": "MLB123456",
  "pictures": [
    { "id": "123-MLA", "url": "http://...", "secure_url": "https://..." },
    { "id": "456-MLA", "url": "http://...", "secure_url": "https://..." }
  ],
  "thumbnail": "http://..." 
}
```

### Shopify - Estrutura da API

```json
{
  "product": {
    "id": 123,
    "images": [
      { "id": 1, "src": "https://cdn.shopify.com/..." },
      { "id": 2, "src": "https://cdn.shopify.com/..." }
    ],
    "image": { "src": "https://..." }
  }
}
```

### Amazon - Estrutura do Relatório TSV

```text
item-name  seller-sku  price  quantity  asin1  image-url
Produto X  SKU123      99.90  50        B0XXX  https://...
```

**Nota**: O relatório TSV tem apenas 1 imagem. Para múltiplas, seria necessário usar Catalog Items API (`GET /catalog/2022-04-01/items/{asin}?includedData=images`).

---

## Limitações e Considerações

| Item | Status |
|------|--------|
| ML: Todas as imagens | Disponível na API (até 10) |
| Shopify: Todas as imagens | Disponível na API (ilimitado) |
| Amazon: Múltiplas imagens | Requer chamada extra (Catalog Items API) |
| Performance | Sem impacto - já buscamos os dados completos |

---

## Benefícios

1. **Galeria completa** - Usuário vê todas as fotos importadas
2. **Cache local** - Menos chamadas à API ao visualizar produto
3. **Consistência** - Campo `images` sempre reflete o que foi importado
4. **Base para edição** - MarketplaceImagesCard pode usar como ponto de partida
