

# Plano: Corrigir Importação de Descrição do Mercado Livre

## Diagnóstico

Após análise dos logs e código, identifiquei que:

1. **A descrição ESTÁ sendo importada corretamente** - Os logs mostram que a descrição foi buscada e salva no banco
2. **O campo existe no banco de dados** - Query confirmou que o produto `MLB3522460977` tem descrição salva
3. **O formulário está correto** - O Textarea para descrição já existe em `FinancialDataForm.tsx`

**O problema real**: A edge function `get-product-details` não inclui o campo `description` na query, então quando os dados são carregados na página de detalhes, a descrição não vem junto.

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/get-product-details/index.ts` | Adicionar `description` na lista de campos do SELECT |

---

## Alteração Necessária

Linha 72 atual:
```typescript
.select('id, name, sku, stock, user_id, created_at, updated_at, cost_price, selling_price, ad_spend, image_url, images')
```

Linha 72 corrigida:
```typescript
.select('id, name, sku, stock, user_id, created_at, updated_at, cost_price, selling_price, ad_spend, image_url, images, description')
```

---

## Resultado Esperado

Após a correção:
- A descrição importada do Mercado Livre aparecerá no campo "Descrição do Produto" na página de detalhes
- O usuário poderá editar e salvar alterações na descrição
- As alterações serão sincronizadas com os marketplaces conectados

---

## Nota Importante

Para produtos já importados, a descrição já está salva no banco de dados. A correção apenas garante que ela seja exibida corretamente no formulário.

