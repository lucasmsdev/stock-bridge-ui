

# Corrigir Sincronização do Mercado Livre para Produtos de Catálogo

## O Problema Identificado

Os logs mostram que a sincronização está acontecendo, mas o Mercado Livre está rejeitando a requisição:

```
"code": "item.title.not_modifiable"
"references": ["title", "item.catalog_listing"]
```

O produto `MLB4193807241` está vinculado ao **Catálogo do Mercado Livre**. Produtos de catálogo têm o título controlado pelo ML e nunca podem ser alterados. O código atual não detecta essa situação corretamente.

---

## Solução

Implementar duas correções na Edge Function `sync-mercadolivre-listing`:

### 1. Detectar Produtos de Catálogo
Verificar se o item tem `catalog_listing: true` ou `catalog_product_id` na resposta da API, além da verificação de vendas.

### 2. Fallback Inteligente
Se a requisição falhar por causa do título, tentar novamente automaticamente **sem o título**, garantindo que preço e estoque sejam atualizados.

---

## Fluxo Corrigido

```text
┌─────────────────────────┐
│  Enviar: price, stock,  │
│  title (se permitido)   │
└───────────┬─────────────┘
            │
            v
      ┌───────────┐
      │ Sucesso?  │───Sim───> ✅ Atualizado
      └─────┬─────┘
            │ Não
            v
   ┌────────────────────┐
   │ Erro é de título?  │───Não───> ❌ Erro real
   └─────────┬──────────┘
             │ Sim
             v
  ┌──────────────────────┐
  │ Tentar novamente SEM │
  │ o campo "title"      │
  └──────────┬───────────┘
             │
             v
       ┌───────────┐
       │ Sucesso?  │───Sim───> ✅ Preço/Estoque OK
       └─────┬─────┘          ⚠️ Aviso: título não alterado
             │ Não
             v
        ❌ Erro real
```

---

## Mudancas Tecnicas

### Arquivo: `supabase/functions/sync-mercadolivre-listing/index.ts`

**1. Melhorar deteccao de produtos de catalogo (linhas 238-260)**

Verificar `catalog_listing` e `catalog_product_id` na resposta da API:

```typescript
if (itemResponse.ok) {
  const itemData = await itemResponse.json();
  soldQuantity = itemData.sold_quantity || 0;
  itemStatus = itemData.status || 'unknown';
  
  // Produtos de catálogo NÃO podem ter título alterado
  if (itemData.catalog_listing || itemData.catalog_product_id) {
    canChangeTitle = false;
    console.log('📦 Produto de catálogo - título controlado pelo ML');
  } else if (soldQuantity > 0) {
    canChangeTitle = false;
    console.log(`⚠️ Produto tem ${soldQuantity} vendas - título não pode ser alterado`);
  }
}
```

**2. Adicionar fallback quando titulo falha (apos linha 304)**

Se a requisicao falhar com erro de titulo, tentar novamente sem o titulo:

```typescript
// Se falhou por causa do título, tentar sem ele
if (!mlResponse.ok && mlPayload.title) {
  const mlError = mlResult as MercadoLivreError;
  const isTitleError = mlError.cause?.some(c => 
    c.code?.includes('title') || 
    c.message?.includes('title')
  );
  
  if (isTitleError) {
    console.log('🔄 Título rejeitado, tentando novamente sem ele...');
    delete mlPayload.title;
    
    if (Object.keys(mlPayload).length > 0) {
      // Fazer nova requisição sem o título
      const retryResponse = await fetch(...);
      // Processar resposta...
    }
  }
}
```

**3. Mensagem de feedback mais clara**

Quando o titulo nao puder ser alterado mas preco/estoque foram:

```typescript
response.warnings = [{
  code: 'title_not_modifiable',
  message: 'Nome não foi alterado (produto de catálogo ou com vendas). Preço e estoque foram atualizados.',
}];
```

---

## Resultado Esperado

| Cenario | Antes | Depois |
|---------|-------|--------|
| Produto de catalogo | ❌ Falha total | ✅ Preco/estoque OK + aviso |
| Produto com vendas | ❌ Falha total | ✅ Preco/estoque OK + aviso |
| Produto normal | ✅ Tudo OK | ✅ Tudo OK |

---

## Testes

Apos a implementacao, voce podera testar alterando:
1. **Apenas preco** - Deve funcionar
2. **Apenas estoque** - Deve funcionar  
3. **Preco + nome** - Preco atualiza, nome mostra aviso
4. **Tudo junto** - Preco e estoque atualizam, nome mostra aviso

