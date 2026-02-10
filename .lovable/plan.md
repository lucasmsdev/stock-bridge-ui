

# Corrigir Customer ID do Google Ads e garantir sync funcional

## Problema

A API do Google Ads **v18 foi descontinuada**. O endpoint `https://googleads.googleapis.com/v18/customers:listAccessibleCustomers` retorna **404 Not Found**, por isso o `customer_id` ficou `null` durante a conexao OAuth. A versao atual da API e a **v20**.

Isso afeta dois arquivos:
- `google-ads-auth` -- nao conseguiu buscar o Customer ID durante o OAuth
- `sync-google-ads` -- usa v18 tanto para `listAccessibleCustomers` quanto para `searchStream`

## Mudancas

### 1. `supabase/functions/google-ads-auth/index.ts` (linha 110)

Atualizar a URL da API de v18 para v20:

```
// Antes
'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers'

// Depois
'https://googleads.googleapis.com/v20/customers:listAccessibleCustomers'
```

### 2. `supabase/functions/sync-google-ads/index.ts` (linhas 120 e 188)

Atualizar ambas as chamadas de API de v18 para v20:

- Linha 120: `listAccessibleCustomers` (fallback quando nao tem customer_id salvo)
- Linha 188: `searchStream` (busca de metricas de campanhas)

```
// Antes
'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers'
`https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`

// Depois
'https://googleads.googleapis.com/v20/customers:listAccessibleCustomers'
`https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:searchStream`
```

### 3. Redeploy das duas Edge Functions

Apos as mudancas, redeploy de `google-ads-auth` e `sync-google-ads`.

## Apos implementar

Como o Customer ID ficou `null` na conexao atual, voce precisara:
1. **Desconectar e reconectar** o Google Ads na pagina de integracoes (para buscar o Customer ID com a API v20)
2. Ou sincronizar manualmente -- o `sync-google-ads` tambem tenta buscar o Customer ID como fallback

