

## Integração Completa com Magalu (Magazine Luiza)

### Contexto
A Magalu utiliza OAuth 2.0 (Authorization Code) com endpoints em `id.magalu.com` para autenticação e `api.magalu.com` para APIs de dados. A estrutura é similar ao Mercado Livre, mas com diferenças importantes nos endpoints, escopos e formato de dados.

### Pre-requisito: Configuração no Portal Magalu

Antes de implementar, voce precisa criar um "Cliente de Aplicação" no sistema ID Magalu usando a ferramenta CLI `idm`. Isso vai gerar seu `client_id` e `client_secret`. Os passos são:

1. Criar conta em id.magalu.com
2. Baixar a CLI `idm` em github.com/luizalabs/id-magalu-cli/releases
3. Executar `./idm login`
4. Criar o client com o comando `./idm client create` incluindo:
   - `--redirect-uris` apontando para a Edge Function de callback
   - `--scopes` com permissões de portfolio (SKUs, precos, estoque), pedidos e conversas
   - `--audience "https://api.magalu.com"`
   - `--terms-of-use` e `--privacy-term` com URLs do UNISTOCK

Ao concluir, voce tera um `client_id` e `client_secret` para configurar como secrets no Supabase.

---

### Etapa 1 - Secrets e Configuração

Adicionar dois novos secrets no Supabase:
- `MAGALU_CLIENT_ID` - o client_id gerado pela CLI
- `MAGALU_CLIENT_SECRET` - o client_secret gerado pela CLI

---

### Etapa 2 - Edge Function: `magalu-auth`

**Novo arquivo: `supabase/functions/magalu-auth/index.ts`**

Responsavel por receber o codigo de autorizacao OAuth e trocar por tokens de acesso.

Fluxo:
1. Receber `code` e `redirect_uri` do callback
2. Autenticar o usuario via JWT
3. Trocar o code por tokens via `POST https://id.magalu.com/oauth/token` (JSON body com `client_id`, `client_secret`, `redirect_uri`, `code`, `grant_type: "authorization_code"`)
4. Verificar duplicidade de conta
5. Criptografar tokens com `encrypt_token`
6. Salvar na tabela `integrations` com `platform: 'magalu'`
7. Token expira em 2 horas (7200s conforme documentacao)

**config.toml**: Adicionar `[functions.magalu-auth]` com `verify_jwt = true`

---

### Etapa 3 - Callback Page: `MagaluCallback.tsx`

**Novo arquivo: `src/pages/callback/MagaluCallback.tsx`**

Pagina de callback OAuth, identica em estrutura ao `MercadoLivreCallback.tsx`:
- Captura o `code` da query string
- Chama a edge function `magalu-auth`
- Redireciona para `/app/integrations?status=success` ou `?status=error`
- Mostra loading com texto "Conectando com o Magalu..."

**Atualizar `src/App.tsx`**: Adicionar rota `/callback/magalu`

---

### Etapa 4 - Atualizar Frontend de Integrações

**Arquivo: `src/pages/Integrations.tsx`**

1. Remover `comingSoon: true` do item `magalu` no array `marketplaceIntegrations`
2. Adicionar logica de conexão no `handleConnect`:
   - Construir URL de consentimento: `https://id.magalu.com/login?client_id=<CLIENT_ID>&redirect_uri=<REDIRECT_URI>&scope=<SCOPES>&response_type=code&choose_tenants=true`
   - O `client_id` sera publico (similar ao Mercado Livre)
   - O `redirect_uri` apontara para `/callback/magalu`
   - Escopos: portfolio (SKUs, precos, estoque read/write) + pedidos (read) + conversas (read/write)
3. Adicionar tratamento de `account_name` para Magalu no `loadConnectedIntegrations`

---

### Etapa 5 - Importação de Produtos (import-products)

**Arquivo: `supabase/functions/import-products/index.ts`**

Adicionar bloco `else if (platform === 'magalu')` para buscar produtos da API Magalu:

- Endpoint: `GET https://api.magalu.com/seller/v1/portfolios/skus?_limit=100`
- Header: `Authorization: Bearer <access_token>`
- Buscar precos: `GET https://api.magalu.com/seller/v1/portfolios/prices/<sku>`
- Buscar estoque: `GET https://api.magalu.com/seller/v1/portfolios/stocks/<sku>`
- Mapear campos:
  - `sku` -> SKU do produto
  - `title` -> nome do produto
  - `description` -> descricao
  - `brand` -> marca
  - `images` -> fotos do produto
  - `dimensions` -> peso e dimensoes
  - Preco e estoque vem de endpoints separados
- Criar registros em `products` e `product_listings` com `platform: 'magalu'`

---

### Etapa 6 - Sincronização de Pedidos (sync-orders)

**Arquivo: `supabase/functions/sync-orders/index.ts`**

Adicionar um `MagaluProvider` seguindo o padrao existente:

- Endpoint: `GET https://api.magalu.com/seller/v1/orders`
- Filtros: `purchased_at__gte`, `status`
- Mapeamento de status:
  - `new` -> `pending`
  - `approved` -> `paid`
  - `cancelled` -> `cancelled`
  - `finished` -> `delivered`
- Extrair: order code, items, total, data

---

### Etapa 7 - Sincronização Bidirecional (sync-magalu-listing)

**Novo arquivo: `supabase/functions/sync-magalu-listing/index.ts`**

Para sincronizar alterações de preco, estoque e dados do produto UNISTOCK -> Magalu:

- Atualizar preco: `PUT/POST https://api.magalu.com/seller/v1/portfolios/prices`
- Atualizar estoque: `PUT/POST https://api.magalu.com/seller/v1/portfolios/stocks`
- Atualizar SKU: `PUT https://api.magalu.com/seller/v1/portfolios/skus/<sku>`

**config.toml**: Adicionar `[functions.sync-magalu-listing]` com `verify_jwt = true`

---

### Etapa 8 - Renovação Automática de Tokens

**Arquivo: `supabase/functions/refresh-integration-tokens/index.ts`**

Adicionar bloco para `magalu`:
- Endpoint: `POST https://id.magalu.com/oauth/token`
- Content-Type: `application/x-www-form-urlencoded`
- Body: `grant_type=refresh_token`, `client_id`, `client_secret`, `refresh_token`
- Token expira em 2 horas (7200 segundos)

Atualizar `TOKEN_EXPIRY_HOURS` adicionando: `magalu: 2`

---

### Etapa 9 - Criação de Produto no Magalu

**Novo arquivo: `supabase/functions/create-magalu-product/index.ts`**

Para publicar produtos do UNISTOCK na Magalu:
- Criar SKU: `POST https://api.magalu.com/seller/v1/portfolios/skus`
- Definir preco: `POST https://api.magalu.com/seller/v1/portfolios/prices`
- Definir estoque: `POST https://api.magalu.com/seller/v1/portfolios/stocks`
- Registrar na tabela `product_listings`

**config.toml**: Adicionar `[functions.create-magalu-product]`

---

### Resumo dos Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/functions/magalu-auth/index.ts` |
| Criar | `src/pages/callback/MagaluCallback.tsx` |
| Criar | `supabase/functions/sync-magalu-listing/index.ts` |
| Criar | `supabase/functions/create-magalu-product/index.ts` |
| Editar | `src/App.tsx` (nova rota callback) |
| Editar | `src/pages/Integrations.tsx` (remover comingSoon, adicionar OAuth) |
| Editar | `supabase/functions/import-products/index.ts` (bloco Magalu) |
| Editar | `supabase/functions/sync-orders/index.ts` (MagaluProvider) |
| Editar | `supabase/functions/refresh-integration-tokens/index.ts` (refresh Magalu) |
| Editar | `supabase/config.toml` (novas functions) |
| Editar | `src/components/ui/platform-logo.tsx` (ja feito) |

### Ordem de Implementação

A implementação sera feita na seguinte ordem para que cada etapa possa ser testada:

1. Secrets (MAGALU_CLIENT_ID, MAGALU_CLIENT_SECRET)
2. Edge Function `magalu-auth` + Callback page + Rota
3. Frontend de conexão (remover comingSoon, OAuth flow)
4. Renovação de tokens
5. Importação de produtos
6. Sincronização de pedidos
7. Criação de produto
8. Sincronização bidirecional

