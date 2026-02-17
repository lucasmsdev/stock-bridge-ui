
# Configuracao da Integracao Shopee

## O que sera feito

### 1. Adicionar secrets SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY
Solicitar ao usuario que insira os dois valores de forma segura nos secrets do projeto Supabase. Esses valores sao usados pelas Edge Functions `create-shopee-product`, `sync-shopee-ads` e `refresh-integration-tokens`.

### 2. Remover flag `comingSoon` da Shopee
No arquivo `src/pages/Integrations.tsx`, remover `comingSoon: true` do objeto Shopee na lista `marketplaceIntegrations` para que o botao "Conectar" apareca normalmente.

### 3. Implementar fluxo de conexao OAuth da Shopee
Atualizar o `handleConnect` para o case `shopee` (atualmente mostra um toast "em breve"). O novo fluxo:
- Redireciona o usuario para a URL de autorizacao da Shopee Open Platform
- URL: `https://partner.shopeemobile.com/api/v2/shop/auth_partner?partner_id={PARTNER_ID}&redirect={CALLBACK_URL}&sign={SIGN}&timestamp={TIMESTAMP}`
- Como a assinatura (sign) requer a `partner_key` (que e um segredo), o redirecionamento sera feito via uma Edge Function `shopee-auth` que gera a URL assinada e redireciona.

### 4. Criar Edge Function `shopee-auth`
Nova Edge Function que:
- Recebe o `user_id` como parametro
- Le `SHOPEE_PARTNER_ID` e `SHOPEE_PARTNER_KEY` do ambiente
- Gera o `sign` (HMAC-SHA256) necessario para a URL de autorizacao
- Redireciona o usuario para a pagina de autorizacao da Shopee

### 5. Criar Edge Function `shopee-callback`
Nova Edge Function que:
- Recebe o callback da Shopee com `code` e `shop_id`
- Troca o code por `access_token` e `refresh_token` via API da Shopee
- Encripta e salva os tokens na tabela `integrations`
- Redireciona o usuario de volta para `/app/integrations?status=success`

## Detalhes tecnicos

### Secrets necessarios:
| Secret | Descricao |
|--------|-----------|
| `SHOPEE_PARTNER_ID` | Partner ID (App ID) da Shopee Open Platform |
| `SHOPEE_PARTNER_KEY` | Partner Key (Secret Key) da Shopee Open Platform |

### Arquivos novos:
| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/shopee-auth/index.ts` | Gera URL assinada e redireciona para Shopee OAuth |
| `supabase/functions/shopee-callback/index.ts` | Processa callback, troca code por tokens, salva na DB |

### Arquivos modificados:
| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Integrations.tsx` | Remover `comingSoon: true` da Shopee; atualizar `handleConnect` para redirecionar via Edge Function `shopee-auth` |

### Fluxo OAuth da Shopee:

```text
Usuario clica "Conectar Shopee"
       |
       v
Frontend redireciona para Edge Function shopee-auth
       |
       v
shopee-auth gera sign (HMAC-SHA256) com partner_key
       |
       v
Redireciona para partner.shopeemobile.com/api/v2/shop/auth_partner
       |
       v
Usuario autoriza na Shopee
       |
       v
Shopee redireciona para shopee-callback com code + shop_id
       |
       v
shopee-callback troca code por access_token + refresh_token
       |
       v
Tokens encriptados salvos na tabela integrations
       |
       v
Redireciona para /app/integrations?status=success
```
