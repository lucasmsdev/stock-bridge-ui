
# Integracao TikTok Shop

## Resumo

Implementar a integracao com o TikTok Shop Open Platform para importar produtos, sincronizar estoque/preco e gerenciar pedidos. O fluxo segue o padrao das integracoes de marketplace existentes (Mercado Livre, Shopify, Amazon, Magalu).

---

## Pre-requisitos do usuario

1. Criar conta no TikTok Shop Partner Center (https://partner.tiktokshop.com/)
2. Criar um app com permissoes de Product, Order e Inventory
3. Configurar o Redirect URI: `https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/tiktok-shop-auth`
4. Obter o **App Key** e **App Secret**

---

## Experiencia do usuario

1. Na pagina de Integracoes, o card "TikTok Shop" deixa de mostrar "Em breve" e exibe o botao "Conectar"
2. Ao clicar, o usuario e redirecionado para o TikTok Shop para autorizar acesso
3. Apos autorizar, retorna para `/app/integrations?status=success`
4. Pode importar produtos, sincronizar pedidos, e criar listings - como qualquer outro marketplace
5. O card mostra status de conexao, botoes de importar e sincronizar pedidos

---

## Detalhes tecnicos

### 1. Secrets necessarios

Armazenar via Supabase Secrets:
- `TIKTOK_SHOP_APP_KEY` - App Key do TikTok Shop Partner Center
- `TIKTOK_SHOP_APP_SECRET` - App Secret do TikTok Shop Partner Center

### 2. Edge Function: `tiktok-shop-auth/index.ts` (nova)

Callback OAuth para troca de tokens, seguindo o padrao do `magalu-auth`:

- Recebe `code` via callback redirect do TikTok Shop
- Valida JWT do usuario logado (recebido do frontend via POST)
- Busca `organization_id` do usuario para conformidade com RLS
- Troca o `code` por tokens via `POST https://auth.tiktok-shops.com/api/v2/token/get`
  - Parametros: `app_key`, `app_secret`, `auth_code`, `grant_type: authorized_code`
  - Retorna: `access_token`, `refresh_token`, `access_token_expire_in`, `refresh_token_expire_in`
- Obtem `shop_cipher` e `shop_name` via API de lojas autorizadas
- Encripta ambos os tokens via `encrypt_token()`
- Salva na tabela `integrations` com `platform = 'tiktokshop'`
- Armazena `shop_cipher` no campo `selling_partner_id` (necessario para todas as chamadas de API)
- Verifica duplicata por `account_name` antes de inserir
- Retorna sucesso para o frontend (padrao Magalu: POST com JSON response)

### 3. Edge Function: Atualizacao do `import-products/index.ts`

Adicionar provider TikTok Shop ao import de produtos existente:

- Novo bloco `else if (platform === 'tiktokshop')` no fluxo principal
- Chama `GET https://open-api.tiktokglobalshop.com/api/products/search` (versao 202309)
  - Requer: `access_token`, `app_key`, `shop_cipher`, `sign` (assinatura HMAC-SHA256)
- Para cada produto retornado, busca detalhes completos via API de detalhes do produto
- Mapeia campos para o formato UNISTOCK:
  - `title` -> `name`
  - `skus[0].seller_sku` -> `sku`
  - `skus[0].stock_infos[0].available_stock` -> `stock`
  - `skus[0].price.sale_price` -> `selling_price`
  - `images[0].url` -> `image_url`
  - `images` -> `images`
  - `description` -> `description`
- Inclui `organization_id` em todos os inserts
- Cria registros em `product_listings` para manter vinculo bidirecional

### 4. Edge Function: Atualizacao do `sync-orders/index.ts`

Adicionar TikTok Shop provider ao sync de pedidos:

- Novo `TikTokShopProvider` implementando a interface `MarketplaceOrderProvider`
- `fetchOrders()`:
  - Chama `GET https://open-api.tiktokglobalshop.com/api/orders/search` (versao 202309)
  - Parametros: `create_time_from`, `create_time_to`, `page_size`
  - Para cada pedido, busca detalhes com itens via API de detalhes
- `mapStatus()`:
  - `UNPAID` -> `pending`
  - `ON_HOLD` / `AWAITING_SHIPMENT` -> `paid`
  - `AWAITING_COLLECTION` / `IN_TRANSIT` -> `shipped`
  - `DELIVERED` -> `delivered`
  - `CANCELLED` -> `cancelled`
  - `COMPLETED` -> `delivered`
- Mapeia items: `sku_id`, `sku_name`, `quantity`, `sale_price`
- Registrar no `providers` registry: `'tiktokshop': TikTokShopProvider`

### 5. Edge Function: `create-tiktokshop-product/index.ts` (nova)

Criar produto no TikTok Shop a partir do UNISTOCK:

- Autentica usuario via JWT
- Busca integracao `tiktokshop` e decripta token
- Gera assinatura HMAC-SHA256 para a request (obrigatorio pela API TikTok Shop)
- Chama `POST /api/products` da API TikTok Shop com dados do produto
- Mapeia campos UNISTOCK para o formato TikTok:
  - `name` -> `title`
  - `description` -> `description`
  - `selling_price` -> `skus[0].price.sale_price`
  - `stock` -> `skus[0].stock_infos[0].available_stock`
  - `images` -> `main_images`
- Salva listing em `product_listings` com `platform = 'tiktokshop'`

### 6. Helper: Funcao de assinatura TikTok Shop

A API do TikTok Shop exige assinatura HMAC-SHA256 em todas as requests. Incluir funcao helper nas Edge Functions que precisam:

```text
Algoritmo:
1. Ordenar parametros query alfabeticamente
2. Concatenar: app_secret + path + parametros_ordenados + app_secret
3. Gerar HMAC-SHA256 com app_secret como chave
4. Resultado em hex lowercase = parametro "sign"
```

### 7. Pagina de Integracoes (`src/pages/Integrations.tsx`)

- Remover `comingSoon: true` do objeto `tiktokshop` no array `marketplaceIntegrations`
- Adicionar handler `handleConnect` para `tiktokshop`:
  - Obtem usuario autenticado
  - Monta URL de autorizacao: `https://services.tiktokshop.com/open/authorize?service_id=APP_KEY`
  - Redireciona o usuario
- Na secao de cards conectados, habilitar botoes de "Importar" e "Sincronizar Pedidos" para `tiktokshop`

### 8. Callback Page: `src/pages/callback/TikTokShopCallback.tsx` (nova)

Pagina de callback seguindo o padrao `MagaluCallback.tsx`:

- Recebe `code` e `state` da URL de redirect
- Exibe loading spinner enquanto processa
- Chama a edge function `tiktok-shop-auth` via POST com `code` e `redirect_uri`
- Em caso de sucesso, redireciona para `/app/integrations?status=success`
- Em caso de erro, redireciona para `/app/integrations?status=error`

### 9. Rota no App.tsx

- Adicionar rota `/callback/tiktokshop` apontando para `TikTokShopCallback`

### 10. Config.toml

```text
[functions.tiktok-shop-auth]
verify_jwt = true

[functions.create-tiktokshop-product]
verify_jwt = true
```

### 11. Refresh de tokens

Os tokens do TikTok Shop expiram (access_token em ~24h, refresh_token em meses). Atualizar `refresh-integration-tokens` edge function:

- Adicionar bloco para `tiktokshop`
- Chamar `POST https://auth.tiktok-shops.com/api/v2/token/refresh` com `app_key`, `app_secret`, `refresh_token`, `grant_type: refresh_token`
- Atualizar tokens encriptados e `token_expires_at` no banco

---

## Fluxo completo

```text
Usuario clica "Conectar" no card TikTok Shop
    |
    v
Redirect para TikTok Shop OAuth
(https://services.tiktokshop.com/open/authorize)
    |
    v
Usuario autoriza acesso a loja
    |
    v
TikTok redireciona para /callback/tiktokshop
com code na URL
    |
    v
Frontend chama tiktok-shop-auth Edge Function
com code + redirect_uri via POST
    |
    v
Edge Function troca code por access_token + refresh_token
    |
    v
Obtem shop_cipher e shop_name via API
    |
    v
Tokens encriptados e salvos em integrations (platform = 'tiktokshop')
    |
    v
Redirect para /app/integrations?status=success
    |
    v
Usuario pode: Importar Produtos | Sincronizar Pedidos | Criar Listings
```

---

## Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/tiktok-shop-auth/index.ts` | Criar (OAuth callback) |
| `supabase/functions/create-tiktokshop-product/index.ts` | Criar (criar produto no TikTok) |
| `supabase/functions/import-products/index.ts` | Modificar (adicionar provider TikTok Shop) |
| `supabase/functions/sync-orders/index.ts` | Modificar (adicionar TikTok Shop provider) |
| `supabase/functions/refresh-integration-tokens/index.ts` | Modificar (adicionar refresh TikTok) |
| `supabase/config.toml` | Modificar (2 novas funcoes) |
| `src/pages/callback/TikTokShopCallback.tsx` | Criar (pagina de callback) |
| `src/pages/Integrations.tsx` | Modificar (remover comingSoon, OAuth flow) |
| `src/App.tsx` | Modificar (adicionar rota callback) |

---

## Seguranca

- App Secret armazenado como Supabase Secret, nunca exposto no frontend
- App Key e publico e pode ficar no frontend (mesmo padrao dos outros marketplaces)
- Tokens encriptados em repouso via `encrypt_token()`
- Edge function de auth com `verify_jwt = true` (diferente do Meta Ads, pois o callback e POST do frontend, nao redirect direto)
- Assinatura HMAC-SHA256 em todas as chamadas de API garante integridade
- RLS nas tabelas garante isolamento por organizacao

---

## Proximos passos apos implementacao

1. Configurar secrets (App Key e App Secret) quando o app for aprovado
2. Testar fluxo completo de conexao
3. Futuramente: sincronizacao de imagens bidirecional e tracking de envios (seguindo padrao das outras plataformas)
