

# Atualizar APP_URL e testar TikTok Ads

## Alteracao

Atualizar o secret `APP_URL` para `https://unistock-eight.vercel.app` (sem barra final, para evitar URLs com barra dupla como `https://unistock-eight.vercel.app//app/integrations`).

## Teste

Apos atualizar o secret:
1. Fazer deploy da edge function `tiktok-ads-auth`
2. Verificar os logs da edge function para confirmar que o redirect aponta para o dominio correto
3. Testar o fluxo OAuth do TikTok Ads

## Detalhe tecnico

| Recurso | Acao |
|---|---|
| Secret `APP_URL` | Atualizar para `https://unistock-eight.vercel.app` |
| Edge function `tiktok-ads-auth` | Re-deploy para pegar o novo secret |

