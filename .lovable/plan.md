
# Plano: Importar e Editar Descricao de Produtos

## Objetivo

Adicionar suporte completo ao campo Descricao de produtos:
1. Importar descricao de todas as plataformas conectadas (Mercado Livre, Shopify, Amazon)
2. Permitir editar a descricao direto pelo UNISTOCK
3. Sincronizar alteracoes de descricao para os marketplaces

---

## Situacao Atual

| Componente | Status | Observacao |
|------------|--------|------------|
| Campo no banco | Existe | Coluna `description` ja existe na tabela `products` |
| Importacao ML | Nao puxa | Precisa adicionar `plain_text` da API |
| Importacao Shopify | Nao puxa | Precisa adicionar `body_html` da API |
| Importacao Amazon | Nao puxa | Amazon nao tem descricao no relatorio TSV |
| Formulario de edicao | Nao tem | Precisa adicionar Textarea em FinancialDataForm |
| Sincronizacao | Nao envia | Nenhuma funcao de sync atualiza descricao |

---

## Como Funcionara

### Fluxo de Importacao

```text
Mercado Livre API  →  item.plain_text.text         →  products.description
Shopify API        →  product.body_html             →  products.description (sem HTML)
Amazon Reports     →  (nao disponivel no TSV)       →  null
```

### Fluxo de Edicao

```text
+--------------------------------------------------+
|  Dados do Produto                                |
+--------------------------------------------------+
|  Nome: [_________________________]               |
|                                                  |
|  Descricao:                                      |
|  +--------------------------------------------+  |
|  |                                            |  |
|  |  [Textarea com até 4000 caracteres]        |  |
|  |                                            |  |
|  +--------------------------------------------+  |
|  Caracteres: 250/4000                            |
|                                                  |
|  URL da Imagem: [______________________]         |
+--------------------------------------------------+
```

### Fluxo de Sincronizacao

Ao salvar alteracoes no UNISTOCK:
- **Mercado Livre**: PUT /items/{id} com `{ description: texto_plaintext }`
- **Shopify**: PUT /products/{id}.json com `{ product: { body_html: texto } }`
- **Amazon**: PATCH com atributo `product_description` (se disponivel)

---

## Arquivos a Modificar

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `supabase/functions/import-products/index.ts` | Modificar | Extrair descricao de ML e Shopify durante importacao |
| `src/components/financial/FinancialDataForm.tsx` | Modificar | Adicionar Textarea para descricao |
| `supabase/functions/update-product/index.ts` | Modificar | Salvar campo description no banco |
| `supabase/functions/sync-mercadolivre-listing/index.ts` | Modificar | Enviar descricao para ML via API |
| `supabase/functions/sync-shopify-listing/index.ts` | Modificar | Enviar body_html para Shopify |
| `supabase/functions/sync-amazon-listing/index.ts` | Modificar | Enviar product_description para Amazon |
| `supabase/functions/bulk-update-products/index.ts` | Modificar | Incluir descricao nos payloads de sync |
| `src/pages/ProductDetails.tsx` | Modificar | Incluir description na interface Product |

---

## Detalhes Tecnicos

### 1. Importacao - Mercado Livre

Ao buscar detalhes do item, a descricao esta em um endpoint separado:

```text
GET https://api.mercadolibre.com/items/{id}/description

Resposta:
{
  "text": "",
  "plain_text": "Descricao completa do produto...",
  "date_created": "..."
}
```

O campo `plain_text` contem a descricao sem formatacao HTML.

### 2. Importacao - Shopify

A descricao ja vem no objeto do produto como `body_html`:

```text
product.body_html = "<p>Descricao com HTML</p>"
```

Precisamos remover as tags HTML antes de salvar:

```typescript
const description = product.body_html
  ? product.body_html.replace(/<[^>]*>/g, '').trim()
  : null;
```

### 3. Importacao - Amazon

O relatorio GET_MERCHANT_LISTINGS_ALL_DATA da Amazon nao inclui descricao. Para obter a descricao, seria necessario chamar a Catalog Items API para cada produto, o que seria muito lento e custoso. Por isso, para Amazon, a descricao permanecera null na importacao inicial.

### 4. Sincronizacao - Mercado Livre

A API do ML aceita atualizacao de descricao via PUT:

```text
PUT https://api.mercadolibre.com/items/{id}/description

Body:
{
  "plain_text": "Nova descricao do produto..."
}
```

**Importante**: A descricao no ML tem um limite de 50.000 caracteres e nao pode conter HTML.

### 5. Sincronizacao - Shopify

A API da Shopify aceita `body_html` no PUT do produto:

```text
PUT https://{shop}.myshopify.com/admin/api/2024-01/products/{id}.json

Body:
{
  "product": {
    "id": 123,
    "body_html": "Descricao do produto"
  }
}
```

### 6. Sincronizacao - Amazon

A Amazon SP-API aceita descricao via Listings Items PATCH:

```text
{
  "op": "replace",
  "path": "/attributes/product_description",
  "value": [{
    "value": "Descricao do produto",
    "language_tag": "pt_BR",
    "marketplace_id": "A2Q3Y263D00KWC"
  }]
}
```

**Nota**: Muitos ASINs tem descricao gerenciada pelo catalogo Amazon e podem nao aceitar alteracao.

---

## Interface Atualizada do Formulario

A interface do produto sera expandida:

```typescript
interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  cost_price?: number;
  selling_price?: number;
  ad_spend?: number;
  image_url?: string;
  description?: string;  // ← NOVO
}
```

O FinancialDataForm tera um novo campo:

```text
<div className="space-y-2">
  <Label htmlFor="description">Descricao do Produto</Label>
  <Textarea
    id="description"
    placeholder="Descreva seu produto em detalhes..."
    value={formData.description}
    onChange={(e) => handleInputChange('description', e.target.value)}
    rows={4}
    maxLength={4000}
  />
  <p className="text-xs text-muted-foreground">
    {formData.description?.length || 0}/4000 caracteres
  </p>
</div>
```

---

## Ordem de Execucao

1. Atualizar `import-products` para capturar descricao de ML e Shopify
2. Adicionar campo Textarea no `FinancialDataForm.tsx`
3. Atualizar `update-product` para salvar descricao
4. Atualizar `sync-mercadolivre-listing` para enviar descricao
5. Atualizar `sync-shopify-listing` para enviar body_html
6. Atualizar `sync-amazon-listing` para enviar product_description
7. Atualizar `bulk-update-products` para incluir descricao nos syncs
8. Atualizar interfaces Product em todos os arquivos necessarios

---

## Preservacao de Dados na Importacao

Ao reimportar produtos, se a descricao da API vier vazia mas o produto ja tiver descricao no banco, manter a descricao existente:

```typescript
// Logica de preservacao (igual ja existe para imagens)
const existingProduct = existingProducts.find(p => p.sku === newProduct.sku);

// Se nova descricao esta vazia mas existe uma no banco, preservar
if (!newProduct.description && existingProduct?.description) {
  newProduct.description = existingProduct.description;
}
```

---

## Limitacoes Conhecidas

| Plataforma | Limitacao |
|------------|-----------|
| Mercado Livre | Descricao nao pode ter HTML, limite de 50.000 chars |
| Shopify | Aceita HTML, sera convertido para plain text ao sincronizar |
| Amazon | Muitos produtos tem descricao bloqueada pelo catalogo |
| Amazon | Importacao nao traz descricao (seria muito lento) |

