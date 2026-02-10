

# Conexao TikTok Ads Sandbox via Token Manual

## Problema

O fluxo OAuth (`/portal/auth`) nao funciona para apps em modo sandbox no TikTok Business. O sandbox fornece o Access Token e o Advertiser ID diretamente no painel do desenvolvedor, sem redirect OAuth.

## Solucao

Quando o modo sandbox estiver ativo (`VITE_TIKTOK_ADS_SANDBOX=true`), substituir o redirect OAuth por um dialog onde o usuario cola o Access Token e o Advertiser ID gerados no painel do TikTok.

## Mudancas

### 1. Frontend - `src/pages/Integrations.tsx`

- Detectar `VITE_TIKTOK_ADS_SANDBOX === 'true'`
- Em vez de redirecionar para o portal OAuth, abrir um Dialog pedindo:
  - **Access Token** (gerado no painel sandbox do TikTok)
  - **Advertiser ID** (visivel no painel, ex: `7604988152943558664`)
- Ao confirmar, chamar a edge function `tiktok-ads-auth` via POST com esses dados (em vez do fluxo de redirect)

### 2. Edge Function - `supabase/functions/tiktok-ads-auth/index.ts`

- Adicionar suporte a requisicoes POST (alem do GET atual usado pelo redirect OAuth)
- No POST, receber `access_token`, `advertiser_id` e `user_id` no body
- Salvar diretamente na tabela `integrations` sem precisar trocar auth_code por token (o token ja vem pronto)
- Manter o fluxo GET existente para quando o OAuth de producao for usado

### 3. Novo componente - `src/components/integrations/TikTokSandboxDialog.tsx`

- Dialog com dois campos: Access Token e Advertiser ID
- Botao "Conectar" que envia os dados via fetch POST para a edge function
- Feedback de sucesso/erro via toast

## Fluxo

```text
Sandbox:
  Usuario clica "Conectar" -> Dialog abre -> Cola token + advertiser ID -> POST para edge function -> Salva integracao

Producao (futuro):
  Usuario clica "Conectar" -> Redirect OAuth -> Callback GET na edge function -> Troca auth_code -> Salva integracao
```

## Detalhes tecnicos

| Arquivo | Alteracao |
|---|---|
| `src/pages/Integrations.tsx` | Abrir dialog sandbox em vez de redirect OAuth quando sandbox ativo |
| `src/components/integrations/TikTokSandboxDialog.tsx` | Novo componente com formulario para token e advertiser ID |
| `supabase/functions/tiktok-ads-auth/index.ts` | Adicionar handler POST para receber token direto do sandbox |

