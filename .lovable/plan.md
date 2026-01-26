

# Corrigir Sincronização Shopify: Lidar com Produtos Deletados (404)

## Problema Root Cause

O produto na UNISTOCK está vinculado a um produto Shopify que **não existe mais**:

```
product_listings:
  platform_product_id: "53299378323740"
  sync_status: "error"
  sync_error: "Not Found"
```

Quando você tenta editar o produto na UNISTOCK, o sistema tenta sincronizar com esse ID inexistente, resultando em 404.

**Por que isso acontece?**
- O produto foi importado/publicado com sucesso inicialmente
- Depois foi deletado manualmente na Shopify (ou falhou na criação)
- O vínculo no banco ainda aponta para o ID antigo
- Toda tentativa de sincronização falha

---

## Solução Imediata (Manual)

Para resolver agora, você precisa:

1. **Desvincular o produto da Shopify**
   - Na página de Produtos, clicar no produto problemático
   - Remover o vínculo com Shopify (ou deletar o registro em `product_listings`)

2. **Republicar o produto**
   - Clicar em "Publicar na Shopify" novamente
   - Isso criará um novo produto na Shopify com novo ID
   - O vínculo será atualizado com o ID correto

---

## Solução Permanente (Código)

Implementar sistema inteligente que detecta e lida automaticamente com produtos deletados.

### Mudanças Necessárias

#### 1. Melhorar detecção de 404 em `sync-shopify-listing`

**Arquivo**: `supabase/functions/sync-shopify-listing/index.ts`

**O que fazer**: Quando receber 404, marcar o listing como "desvinculado" em vez de "error"

```typescript
// Linha ~165 - Adicionar lógica especial para 404
if (!productResponse.ok) {
  if (productResponse.status === 404) {
    // Produto não existe mais na Shopify - marcar como desvinculado
    await supabase
      .from('product_listings')
      .update({
        sync_status: 'disconnected', // Novo status
        sync_error: 'Produto não encontrado na Shopify. Clique em "Republicar" para criar novamente.',
        last_sync_at: new Date().toISOString()
      })
      .eq('id', listingId);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Produto não encontrado na Shopify',
        requiresRepublish: true // Flag para UI
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  // ... outros erros
}
```

#### 2. Adicionar coluna `sync_status` com novo valor

**Mudança no schema**: Alterar enum de `sync_status` para incluir `'disconnected'`

```sql
ALTER TYPE sync_status ADD VALUE IF NOT EXISTS 'disconnected';
```

Valores possíveis:
- `active` - Sincronizando normalmente
- `error` - Erro temporário (reconexão pode resolver)
- `disconnected` - Produto não existe mais (precisa republicar)
- `pending` - Aguardando primeira sincronização

#### 3. Atualizar UI para mostrar status de desconexão

**Arquivo**: `src/pages/ProductDetails.tsx` (ou onde mostra status de sincronização)

**O que fazer**: 
- Mostrar badge diferente para status "disconnected"
- Adicionar botão "Republicar na Shopify" quando status for disconnected
- Desabilitar edição de campos sincronizados enquanto desconectado

```tsx
{listing.sync_status === 'disconnected' && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Produto não encontrado na Shopify</AlertTitle>
    <AlertDescription>
      Este produto foi deletado ou não existe mais na Shopify. 
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => handleRepublish(listing.platform)}
      >
        Republicar agora
      </Button>
    </AlertDescription>
  </Alert>
)}
```

#### 4. Implementar função "Republicar"

**Onde**: Adicionar handler no componente de produtos

**O que faz**:
1. Deletar o vínculo antigo em `product_listings`
2. Chamar a Edge Function de criar produto (ex: `create-shopify-product`)
3. Criar novo vínculo com o ID correto
4. Mostrar sucesso/erro ao usuário

```typescript
const handleRepublish = async (platform: string) => {
  // 1. Deletar vínculo antigo
  await supabase
    .from('product_listings')
    .delete()
    .eq('product_id', productId)
    .eq('platform', platform);

  // 2. Republicar
  const response = await fetch(`/functions/v1/create-${platform}-product`, {
    method: 'POST',
    body: JSON.stringify({
      product_id: productId,
      integration_id: integrationId,
      productData: { /* dados do produto */ }
    })
  });

  // 3. Atualizar UI
  if (response.ok) {
    toast.success('Produto republicado com sucesso!');
    refetch(); // Recarregar dados
  }
};
```

#### 5. Adicionar limpeza automática de vínculos quebrados (opcional)

**Nova Edge Function**: `cleanup-broken-listings`

**Quando executar**: Via cron job diário ou botão manual

**O que faz**:
- Buscar todos os listings com status "error" há mais de 7 dias
- Tentar verificar se o produto existe na plataforma
- Se não existir (404), marcar como "disconnected"
- Notificar usuário sobre produtos desconectados

---

## Arquivos a Modificar

### 1. `supabase/functions/sync-shopify-listing/index.ts`
- **Linhas 160-170**: Adicionar lógica especial para tratar 404
- Retornar flag `requiresRepublish: true` quando 404

### 2. Schema do banco (migration)
- Adicionar valor `'disconnected'` ao enum `sync_status`
- Ou criar nova migration se necessário

### 3. `src/pages/ProductDetails.tsx`
- Adicionar UI para mostrar status "disconnected"
- Adicionar botão "Republicar na Shopify"
- Implementar função `handleRepublish`

### 4. `src/pages/Products.tsx` (listagem)
- Mostrar badge diferenciado para produtos desconectados
- Permitir ação em lote: "Republicar produtos desconectados"

---

## Fluxo Após Implementação

```
┌─────────────────────────┐
│  Usuário edita produto  │
└───────────┬─────────────┘
            │
            v
┌─────────────────────────┐
│   update-product        │
│   Tenta sincronizar     │
└───────────┬─────────────┘
            │
            v
┌─────────────────────────────────────┐
│  sync-shopify-listing               │
│  PUT /products/{id}                 │
└───────────┬─────────────────────────┘
            │
            v
    ┌───────────────┐
    │ Resposta 404? │
    └───┬───────┬───┘
        │       │
       Sim     Não
        │       │
        v       v
  ┌─────────┐  ┌──────────┐
  │ Marcar  │  │ Sucesso! │
  │ como    │  │          │
  │ discon- │  └──────────┘
  │ nected  │
  └────┬────┘
       │
       v
┌──────────────────────────┐
│ Mostrar na UI:           │
│ "Produto não existe      │
│  mais. Republicar?"      │
│                          │
│  [Republicar agora]      │
└──────────────────────────┘
```

---

## Benefícios

✅ **Detecção automática** de produtos deletados
✅ **UI clara** mostrando o problema e a solução
✅ **Republicação fácil** com um clique
✅ **Prevenção** de erros repetitivos
✅ **Mensagens claras** em vez de "Not Found" genérico

---

## Teste

Após implementação:
1. Deletar manualmente um produto na Shopify
2. Tentar editar esse produto na UNISTOCK
3. Verificar que aparece status "desconectado"
4. Clicar em "Republicar"
5. Confirmar que novo produto é criado na Shopify
6. Verificar que sincronização volta a funcionar

---

## Alternativa Rápida (Sem código)

Se você quiser resolver agora sem esperar a implementação:

**SQL direto no banco**:
```sql
-- Ver produtos problemáticos
SELECT * FROM product_listings 
WHERE sync_status = 'error' 
AND sync_error LIKE '%Not Found%';

-- Deletar vínculo quebrado
DELETE FROM product_listings 
WHERE platform_product_id = '53299378323740';
```

Depois, vá na UI e clique em "Publicar na Shopify" novamente para o produto "Produto ".

