

# Integrar TikTok Ads

## Resumo

Implementar a integracao completa com TikTok Ads (Marketing API) para importar metricas de campanhas reais no Dashboard de Ads, seguindo o mesmo padrao do Meta Ads.

Atualmente o card "TikTok Ads" esta marcado como `comingSoon: true` e so exibe dados demo. Apos a implementacao, o usuario podera conectar sua conta do TikTok Ads via OAuth, sincronizar metricas reais e visualizar tudo no Dashboard de Ads.

---

## Pre-requisitos do usuario

1. Ter uma conta no TikTok for Business (https://ads.tiktok.com/)
2. O app do UNISTOCK ja deve estar registrado no TikTok Marketing API (https://business-api.tiktok.com/portal/docs)
3. O App ID e Secret do TikTok Marketing API precisam estar como secrets no Supabase

---

## Experiencia do usuario

1. Na pagina de Integracoes, o card "TikTok Ads" exibe o botao "Conectar" (sem "Em breve")
2. Ao clicar, o usuario e redirecionado para o TikTok para autorizar acesso de leitura de ads
3. Apos autorizar, retorna para `/app/integrations?status=success`
4. No Dashboard de Ads, as metricas reais do TikTok aparecem junto com Meta Ads e Google Ads
5. Pode sincronizar dados a qualquer momento

---

## Detalhes tecnicos

### 1. Secrets necessarios

Dois novos secrets precisam ser configurados no Supabase (semelhante ao Meta Ads):
- `TIKTOK_ADS_APP_ID` - App ID do TikTok Marketing API
- `TIKTOK_ADS_APP_SECRET` - Secret do TikTok Marketing API

Nota: estes sao DIFERENTES dos `TIKTOK_SHOP_APP_KEY` / `TIKTOK_SHOP_APP_SECRET` ja existentes. TikTok Shop e TikTok Ads sao plataformas separadas com APIs e credenciais distintas.

### 2. Nova Edge Function: `tiktok-ads-auth/index.ts`

Callback OAuth para troca de tokens, seguindo o padrao do `meta-ads-auth`:

- Recebe `auth_code` e `state` (user_id) via redirect do TikTok
- Como o Meta Ads, usa redirect direto (nao POST do frontend), entao `verify_jwt = false`
- Troca o code por access_token via `POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/`
  - Parametros: `app_id`, `secret`, `auth_code`
  - Retorna: `access_token` (permanente no TikTok Ads, nao expira), `advertiser_ids`
- Busca `organization_id` do usuario via `get_user_org_id`
- Encripta token via `encrypt_token()` e salva na tabela `integrations` com `platform = 'tiktok_ads'`
- Armazena o primeiro `advertiser_id` no campo `marketplace_id`
- Verifica duplicata antes de inserir
- Redireciona para `/app/integrations?status=success`

### 3. Nova Edge Function: `sync-tiktok-ads/index.ts`

Sincronizacao de metricas, seguindo o padrao do `sync-meta-ads`:

- Valida JWT manualmente (mesmo padrao do sync-meta-ads)
- Busca integracao `tiktok_ads` e decripta token
- Chama `GET https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/`
  - Parametros: `advertiser_id`, `report_type=BASIC`, `data_level=AUCTION_CAMPAIGN`
  - Dimensoes: `campaign_id`
  - Metricas: `campaign_name`, `spend`, `impressions`, `clicks`, `conversion`, `complete_payment`
  - Filtro por data (ultimos N dias)
- Mapeia resultados para a tabela `ad_metrics`:
  - `platform = 'tiktok_ads'`
  - `campaign_id`, `campaign_name`, `spend`, `impressions`, `clicks`, `conversions`
- Upsert na tabela `ad_metrics` com conflict em `integration_id,campaign_id,date`

### 4. Modificar: `src/pages/Integrations.tsx`

- Remover `comingSoon: true` do objeto `tiktok_ads` no array `adsIntegrations` (linha ~106)
- Adicionar handler `handleConnect` para `tiktok_ads`:
  - Obtem usuario autenticado
  - Monta URL OAuth: `https://business-api.tiktok.com/portal/auth?app_id=APP_ID&state=USER_ID&redirect_uri=CALLBACK_URL`
  - Redireciona o usuario
- Adicionar handler de sync para tiktok_ads (chamar `sync-tiktok-ads` edge function)

### 5. Modificar: `src/components/ads/AdsDashboard.tsx`

- Adicionar hook para detectar integracao `tiktok_ads` (similar ao `useMetaAdsIntegration`)
- Atualizar `isConnected` para incluir TikTok Ads
- Atualizar o filtro de plataforma para incluir `tiktok_ads` no `platformMap` (linha ~50)

### 6. Modificar: `src/components/ads/useMetaAdsData.ts`

- Adicionar hook `useTikTokAdsIntegration()` seguindo o padrao de `useMetaAdsIntegration()`
- Adicionar hook `useSyncTikTokAds()` seguindo o padrao de `useSyncMetaAds()`

### 7. Modificar: `supabase/config.toml`

```text
[functions.tiktok-ads-auth]
verify_jwt = false

[functions.sync-tiktok-ads]
verify_jwt = false
```

Ambos com `verify_jwt = false` porque:
- `tiktok-ads-auth`: recebe redirect direto do TikTok (sem JWT do usuario)
- `sync-tiktok-ads`: valida JWT manualmente no codigo (mesmo padrao do sync-meta-ads)

### 8. Token refresh

Os tokens do TikTok Ads Marketing API sao permanentes (nao expiram). Nao e necessario adicionar logica de refresh ao `refresh-integration-tokens`. O campo `token_expires_at` sera salvo como `null`.

---

## Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/tiktok-ads-auth/index.ts` | Criar (OAuth callback) |
| `supabase/functions/sync-tiktok-ads/index.ts` | Criar (sync metricas) |
| `supabase/config.toml` | Modificar (2 novas funcoes) |
| `src/pages/Integrations.tsx` | Modificar (remover comingSoon, OAuth flow, sync handler) |
| `src/components/ads/AdsDashboard.tsx` | Modificar (detectar TikTok Ads conectado) |
| `src/components/ads/useMetaAdsData.ts` | Modificar (hooks TikTok Ads) |

---

## Seguranca

- App Secret armazenado como Supabase Secret, nunca exposto no frontend
- App ID e publico e pode ficar no frontend (mesmo padrao do Meta Ads)
- Tokens encriptados em repouso via `encrypt_token()`
- Edge function de auth com `verify_jwt = false` pois recebe redirect direto do TikTok (mesmo padrao Meta Ads)
- RLS nas tabelas garante isolamento por organizacao

