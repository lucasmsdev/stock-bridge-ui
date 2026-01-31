
# Plano: Importar Descrições dos Produtos da Amazon

## Diagnóstico do Problema

O código atual já tenta extrair descrições da Amazon (linhas 1060-1070), porém a chamada à Catalog Items API não solicita os dados corretos:

**Problema identificado na linha 1013:**
```typescript
includedData: 'images,summaries', // ❌ Falta 'attributes'
```

A descrição do produto na Amazon fica no campo `product_description` dentro de `attributes`, mas esse campo não é retornado porque `attributes` não está no parâmetro `includedData`.

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/import-products/index.ts` | Adicionar `'attributes'` ao `includedData` da Catalog Items API |

---

## Alteração Necessária

**Linha 1013 - Adicionar `attributes` ao includedData:**

```typescript
// ANTES (atual):
query: {
  marketplaceIds: [validatedMarketplaceId],
  includedData: 'images,summaries', // Include summaries for description
},

// DEPOIS (corrigido):
query: {
  marketplaceIds: [validatedMarketplaceId],
  includedData: 'images,summaries,attributes', // Include attributes for product_description
},
```

---

## Por Que Isso Resolve

1. A Amazon Catalog Items API retorna diferentes datasets dependendo do parâmetro `includedData`
2. O campo `product_description` fica dentro de `attributes`, não em `summaries`
3. O código já está preparado para ler `catalogResponse?.attributes?.product_description` (linhas 1060-1070)
4. Apenas faltava solicitar esses dados na query

---

## Resultado Esperado

Após a correção:
- A descrição dos produtos Amazon será importada junto com imagens e demais dados
- O campo aparecerá preenchido na página de detalhes do produto no UNISTOCK
- O log mostrará: `📝 Descrição encontrada para SKU X: ...`

---

## Nota sobre Produtos Já Importados

Para produtos que já foram importados sem descrição, será necessário:
1. Excluir os produtos da Amazon no UNISTOCK
2. Reimportar após a correção ser aplicada
3. Ou editar manualmente a descrição se preferir
