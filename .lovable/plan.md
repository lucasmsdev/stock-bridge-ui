
# Plano: Corrigir Sincronização de Imagens com Mercado Livre

## Diagnóstico

Os logs revelam o problema com clareza:

```text
sync_status: "error"
sync_error: "pictures is not modifiable."
→ No active listings to sync images
```

### Causa Raiz

| Problema | Descrição |
|----------|-----------|
| **Filtro muito restritivo** | O código ignora listings com `sync_status: 'error'`, então não tenta re-sincronizar |
| **Erro do ML não tratado** | O Mercado Livre retorna "pictures is not modifiable" mas não sabemos se é temporário ou permanente |

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────┐
│  ANTES (problema)                                                │
│                                                                   │
│  Listing com sync_status = 'error'                               │
│         ↓                                                         │
│  Filtro: sync_status === 'active' || 'synced'                    │
│         ↓                                                         │
│  IGNORADO → "No active listings to sync"                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  DEPOIS (corrigido)                                              │
│                                                                   │
│  Listing com sync_status = 'error'                               │
│         ↓                                                         │
│  Filtro: sync_status !== 'disconnected'                          │
│         ↓                                                         │
│  TENTA SYNC → Verifica se é catálogo → Mensagem clara            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementação

### Arquivo 1: `src/components/products/ProductImagesGallery.tsx`

#### Mudança: Ajustar filtro para permitir retry em listings com erro

**Antes (linha ~215):**
```typescript
const activeListings = listings.filter(l => 
  l.sync_status === 'active' || l.sync_status === 'synced' || !l.sync_status
);
```

**Depois:**
```typescript
// Include error listings so user can retry sync
// Only exclude explicitly disconnected ones
const syncableListings = listings.filter(l => 
  l.sync_status !== 'disconnected'
);
```

#### Mudança: Adicionar log para debugging

```typescript
console.log(`Listings to sync: ${syncableListings.length}`, 
  syncableListings.map(l => ({ platform: l.platform, status: l.sync_status }))
);
```

---

### Arquivo 2: `supabase/functions/update-product-images/index.ts`

#### Mudança: Melhorar detecção de anúncios de catálogo

A função `updateMercadoLivreImages` já verifica `catalog_listing` e `catalog_product_id`, mas o erro "pictures is not modifiable" pode ocorrer por outros motivos. Precisamos:

1. Verificar na API do ML se o item tem restrições
2. Fornecer mensagem mais específica ao usuário

```typescript
// Após obter itemData
if (itemData.catalog_listing || itemData.catalog_product_id) {
  return { 
    success: false, 
    error: 'Este anúncio é de catálogo. As imagens são gerenciadas pelo Mercado Livre.',
    details: 'catalog_listing'
  };
}

// Verificar se há restrições adicionais (anúncios com vendas)
if (itemData.health?.aces_status === 'mandatory' || itemData.health?.pictures?.length > 0) {
  console.log('Item has health/pictures restrictions:', itemData.health);
}
```

---

### Arquivo 3: Limpar status de erro anterior

Quando o usuário tenta sincronizar novamente, devemos primeiro limpar o erro anterior para dar uma chance de funcionar:

```typescript
// No início de updateMercadoLivreImages, antes de tentar sync
// (já logamos que estamos tentando novamente)
console.log(`Attempting to sync images to ${platform}, current status: ${listing.sync_status}`);
```

---

## Fluxo Corrigido

```text
┌────────────────────┐
│  Usuário reordena  │
│  imagens           │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Clica "Salvar e   │
│  Sincronizar"      │
└─────────┬──────────┘
          │
          ▼
┌────────────────────────────────────────────┐
│  Filtra listings !== 'disconnected'         │
│  (inclui 'error' para retry)               │
└─────────┬──────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────┐
│  Edge Function verifica:                    │
│  1. É catálogo? → Mensagem específica       │
│  2. Tem restrições? → Log detalhado         │
│  3. OK? → Faz sync com IDs                  │
└─────────┬──────────────────────────────────┘
          │
          ├── Sucesso → sync_status = 'active'
          │
          └── Erro → sync_status = 'error' + mensagem clara
                     (mostra toast explicando o motivo)
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/products/ProductImagesGallery.tsx` | Ajustar filtro para incluir listings com `error` |
| `supabase/functions/update-product-images/index.ts` | Melhorar logs e detecção de restrições |

---

## Benefícios

1. **Retry automático**: Listings com erro anterior podem ser sincronizados novamente
2. **Feedback claro**: Mensagem específica quando imagens são bloqueadas por catálogo
3. **Debug facilitado**: Logs mais detalhados para identificar causa de falhas
4. **Experiência melhor**: Usuário entende por que não consegue alterar imagens

---

## Testes Esperados

| Cenário | Resultado |
|---------|-----------|
| Listing com `sync_status: 'error'` | Tenta sincronizar novamente |
| Anúncio de catálogo | Toast: "Este anúncio é de catálogo..." |
| Anúncio comum | Imagens sincronizadas com sucesso |
| Listing desconectado | Ignorado (não tenta sync) |
