

# Atualizar credenciais do TikTok Ads e corrigir redirect

## Problema

O erro `40002` ("app_id does not exist or secret key is incorrect") indica que os secrets armazenados no Supabase nao correspondem aos valores reais do portal TikTok Business Developer.

## Acoes

### 1. Atualizar secrets

| Secret | Valor |
|---|---|
| `TIKTOK_ADS_APP_ID` | `7604695140725751824` |
| `TIKTOK_ADS_APP_SECRET` | `0a1aeb34b966d16e53d75fcbd7c4e6658c3530df` |

### 2. Corrigir barra dupla no redirect

Na edge function `tiktok-ads-auth/index.ts`, sanitizar o `APP_URL` removendo barra final para evitar URLs com `//`:

```text
Antes:  const appUrl = Deno.env.get('APP_URL') || '...';
Depois: const appUrl = (Deno.env.get('APP_URL') || '...').replace(/\/+$/, '');
```

### 3. Re-deploy e teste

- Re-deploy da edge function `tiktok-ads-auth`
- Testar o fluxo OAuth novamente

## Resultado esperado

Com as credenciais corretas, a troca do `auth_code` por `access_token` deve funcionar e o usuario sera redirecionado de volta para `/app/integrations?status=success`.
