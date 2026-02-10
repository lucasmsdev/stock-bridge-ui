
# Corrigir sync-meta-ads: Buscar dados de contas inativas

## Problema raiz

Os logs confirmam que **todas as 4 contas de anúncio** do Meta estão sendo ignoradas:

```
⏭️ Skipping inactive account: awbshop
⏭️ Skipping inactive account: awbshop1
⏭️ Skipping inactive account: SmartCompras
⏭️ Skipping inactive account: Lucas Machado
```

A linha 154-158 do `sync-meta-ads/index.ts` pula qualquer conta com `account_status !== 1`. Porém, contas com status diferente de 1 (desabilitadas, em revisao, etc.) **ainda possuem dados historicos de campanhas** que devem ser exibidos no dashboard.

## Solucao

### 1. `supabase/functions/sync-meta-ads/index.ts`

- **Remover o filtro que pula contas inativas** (linhas 154-158)
- Permitir que o sistema busque insights de **todas** as contas, independente do `account_status`
- A API do Meta retorna dados historicos mesmo de contas pausadas/desabilitadas
- Adicionar log do `account_status` para debug, mas sem bloquear

**Antes:**
```typescript
if (adAccount.account_status !== 1) {
  console.log('Skipping inactive account:', adAccount.name);
  continue;
}
```

**Depois:**
```typescript
console.log('Processing account:', adAccount.name, 'status:', adAccount.account_status);
// Busca insights de todas as contas (inclusive pausadas) para dados historicos
```

### 2. Resultado esperado

- O sync vai tentar buscar insights de todas as 4 contas
- Contas que tiveram campanhas (mesmo pausadas) vao retornar dados historicos
- A tabela `ad_metrics` sera populada com os insights encontrados
- O Dashboard de Ads vai mostrar os dados reais do Meta Ads
