
# Mudar TikTok Ads para modo de producao

## O que precisa mudar

O sandbox esta ativo em **3 pontos** independentes. Todos precisam ser atualizados:

### 1. Frontend: `src/pages/Integrations.tsx` (linha 466)
- Remover a checagem `VITE_TIKTOK_ADS_SANDBOX` que abre o dialog de token manual
- Ir direto para o fluxo OAuth padrao (que ja existe nas linhas 475-487)
- O dialog `TikTokSandboxDialog` pode ser mantido no codigo mas nao sera mais acionado

### 2. `.env` (linha 4)
- Remover `VITE_TIKTOK_ADS_SANDBOX="true"` ou mudar para `"false"`

### 3. Edge Function: `supabase/functions/sync-tiktok-ads/index.ts` (linha 122)
- Remover a checagem de `TIKTOK_ADS_SANDBOX` e `shop_domain === 'sandbox'`
- Usar sempre a URL de producao: `https://business-api.tiktok.com`

### 4. Edge Function: `supabase/functions/tiktok-ads-auth/index.ts` (linha 115)
- Remover a logica de sandbox que checa `TIKTOK_ADS_SANDBOX` e `:sandbox` no state
- Usar sempre a URL de producao para troca de token

### 5. Reconectar a integracao
- Como a integracao atual foi criada em modo sandbox (com `shop_domain: 'sandbox'`), sera necessario **reconectar** via OAuth de producao para obter um token valido da API real do TikTok Business

## Secao tecnica

**Arquivos modificados:**
- `src/pages/Integrations.tsx` -- remover condicional de sandbox, ir direto pro OAuth
- `.env` -- remover `VITE_TIKTOK_ADS_SANDBOX`
- `supabase/functions/sync-tiktok-ads/index.ts` -- hardcode URL de producao
- `supabase/functions/tiktok-ads-auth/index.ts` -- hardcode URL de producao, remover logica sandbox

**Secret `TIKTOK_ADS_SANDBOX`** no Supabase: sera ignorada apos as mudancas (nao precisa deletar, mas pode ser removida futuramente)

**Apos implementar:** voce precisara desconectar e reconectar o TikTok Ads na pagina de integracoes para gerar um token OAuth de producao valido.
