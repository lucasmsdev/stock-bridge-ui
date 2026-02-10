

# Suporte ao Sandbox do TikTok Business

## Contexto

O TikTok Business disponibiliza um ambiente Sandbox para testes, com URLs distintas:

```text
Producao:  https://business-api.tiktok.com
Sandbox:   https://sandbox-ads.tiktok.com
```

Atualmente, 3 pontos no codigo usam a URL de producao hardcoded. O plano adiciona suporte para alternar entre sandbox e producao.

## Mudancas necessarias

### 1. Frontend - Pagina de Integracoes (`src/pages/Integrations.tsx`)

- Alterar a URL de autorizacao OAuth para usar o endpoint sandbox quando em modo teste:
  - Producao: `https://business-api.tiktok.com/portal/auth`
  - Sandbox: `https://sandbox-ads.tiktok.com/portal/auth`
- Adicionar um parametro `&sandbox=true` no state do OAuth para que a edge function saiba qual ambiente usar.

### 2. Edge Function - Auth (`supabase/functions/tiktok-ads-auth/index.ts`)

- Detectar se o fluxo e sandbox (via parametro no state ou query param).
- Usar a URL sandbox para trocar o auth_code por token:
  - Producao: `https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/`
  - Sandbox: `https://sandbox-ads.tiktok.com/open_api/v1.3/oauth2/access_token/`
- Salvar um flag `is_sandbox` nos metadados da integracao para que o sync tambem use o endpoint correto.

### 3. Edge Function - Sync (`supabase/functions/sync-tiktok-ads/index.ts`)

- Ler o flag `is_sandbox` da integracao.
- Usar a URL base correspondente para buscar relatorios:
  - Producao: `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/`
  - Sandbox: `https://sandbox-ads.tiktok.com/open_api/v1.3/report/integrated/get/`

## Detalhes tecnicos

| Arquivo | Alteracao |
|---|---|
| `src/pages/Integrations.tsx` | Trocar URL de auth para sandbox; enviar flag no state |
| `supabase/functions/tiktok-ads-auth/index.ts` | Usar base URL sandbox para token exchange; salvar flag na integracao |
| `supabase/functions/sync-tiktok-ads/index.ts` | Ler flag e usar base URL sandbox para relatorios |

### Estrategia de controle

O modo sandbox sera ativado via uma variavel de ambiente `TIKTOK_ADS_SANDBOX` (valor `true`/`false`), configurada como Secret no Supabase. Assim, para alternar entre sandbox e producao, basta mudar o valor do secret sem alterar codigo.

No frontend, usaremos uma variavel `VITE_TIKTOK_ADS_SANDBOX` no `.env` para controlar a URL de auth.

### Nota importante

O sandbox do TikTok retorna dados ficticios. Ele e util para validar o fluxo OAuth, a troca de tokens e a estrutura dos relatorios, mas os valores de metricas (spend, clicks, etc.) serao simulados.

