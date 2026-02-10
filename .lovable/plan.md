

# Corrigir URL de autorizacao OAuth do TikTok Sandbox

## Problema

A URL `https://sandbox-ads.tiktok.com/portal/auth` nao existe (404 Not Found). O portal de autorizacao OAuth do TikTok e sempre no dominio de producao. O sandbox se aplica apenas as chamadas de API (troca de token, relatorios).

## Solucao

Alterar `src/pages/Integrations.tsx` para sempre usar `https://business-api.tiktok.com/portal/auth` como URL de autorizacao, independente do modo sandbox.

O dominio sandbox (`sandbox-ads.tiktok.com`) continua sendo usado apenas nas Edge Functions para:
- Troca de token (`tiktok-ads-auth`)
- Busca de relatorios (`sync-tiktok-ads`)

## Mudanca

### `src/pages/Integrations.tsx` (linhas 470-472)

Remover a logica que alterna a URL base para auth. A URL de autorizacao sera sempre:

```
https://business-api.tiktok.com/portal/auth?app_id=...&state=userId:sandbox&redirect_uri=...
```

O flag `:sandbox` no parametro `state` continua sendo enviado para que as Edge Functions saibam qual ambiente usar nas chamadas de API.

## Resumo

| Componente | URL Producao | URL Sandbox |
|---|---|---|
| Auth (portal OAuth) | business-api.tiktok.com/portal/auth | business-api.tiktok.com/portal/auth (mesma) |
| Token exchange | business-api.tiktok.com/open_api/... | sandbox-ads.tiktok.com/open_api/... |
| Reporting API | business-api.tiktok.com/open_api/... | sandbox-ads.tiktok.com/open_api/... |

