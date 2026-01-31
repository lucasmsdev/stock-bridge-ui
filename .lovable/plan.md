
# Plano: Integração Meta Ads - Conexão OAuth

## Visão Geral

Implementar a integração real do Meta Ads no UNISTOCK, permitindo que cada usuário conecte sua própria conta de anúncios do Facebook/Instagram via OAuth 2.0 e sincronize métricas de performance.

---

## Pré-requisitos no Meta for Developers

Antes da implementação no código, você precisa configurar seu App no Meta:

### 1. Configurar Produtos no App
No painel do seu App Meta, adicione:
- **Facebook Login** (para o fluxo OAuth)
- **Marketing API** (para acessar dados de anúncios)

### 2. Configurar URLs de Redirecionamento
Em **Facebook Login > Configurações**, adicione:
```
https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/meta-ads-auth
```

### 3. Obter Credenciais
Você precisará fornecer como Secrets:
- **App ID**: Encontrado no painel principal do App
- **App Secret**: Em Configurações > Básico

---

## Arquitetura da Integração

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          FLUXO OAuth META ADS                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   1. USUÁRIO CLICA "CONECTAR META ADS"                                         │
│   ┌──────────────┐                                                              │
│   │  Integrations │ → Redireciona para Facebook Login Dialog                   │
│   │  Page         │                                                             │
│   └──────────────┘                                                              │
│          │                                                                      │
│          ▼                                                                      │
│   2. AUTORIZAÇÃO NO FACEBOOK                                                    │
│   ┌──────────────────────────────────────────────────────────────────┐         │
│   │  https://www.facebook.com/v21.0/dialog/oauth                     │         │
│   │  ?client_id={META_APP_ID}                                        │         │
│   │  &redirect_uri=.../meta-ads-auth                                 │         │
│   │  &scope=ads_read,ads_management,business_management              │         │
│   │  &state={user_id}                                                │         │
│   └──────────────────────────────────────────────────────────────────┘         │
│          │                                                                      │
│          ▼                                                                      │
│   3. CALLBACK (Edge Function)                                                   │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                   │
│   │ meta-ads-auth│────▶│ Troca code   │────▶│ Converte p/  │                   │
│   │              │     │ por token    │     │ Long-Lived   │                   │
│   └──────────────┘     └──────────────┘     └──────────────┘                   │
│          │                                                                      │
│          ▼                                                                      │
│   4. BUSCA AD ACCOUNTS                                                          │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                   │
│   │ GET /me/     │────▶│ Lista contas │────▶│ Salva na     │                   │
│   │ adaccounts   │     │ disponíveis  │     │ integrations │                   │
│   └──────────────┘     └──────────────┘     └──────────────┘                   │
│          │                                                                      │
│          ▼                                                                      │
│   5. REDIRECIONA PARA INTEGRATIONS                                              │
│   ┌──────────────┐                                                              │
│   │ /app/        │ → Meta Ads aparece como conectado                           │
│   │ integrations │                                                              │
│   └──────────────┘                                                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Parte 1: Secrets a Configurar

| Secret | Descrição |
|--------|-----------|
| `META_APP_ID` | ID do seu App no Meta for Developers |
| `META_APP_SECRET` | Secret do App (em Configurações > Básico) |

---

## Parte 2: Nova Edge Function

### `supabase/functions/meta-ads-auth/index.ts`

Responsabilidades:
1. Receber o `code` do OAuth do Facebook
2. Trocar por access_token usando Graph API
3. Converter para Long-Lived Token (60 dias)
4. Buscar Ad Accounts disponíveis
5. Criptografar e salvar na tabela `integrations`
6. Redirecionar para página de integrações

Endpoints Meta utilizados:

| Endpoint | Função |
|----------|--------|
| `POST /oauth/access_token` | Troca code por token |
| `GET /oauth/access_token?grant_type=fb_exchange_token` | Converte para long-lived |
| `GET /me/adaccounts` | Lista contas de anúncio |

---

## Parte 3: Atualizar Página de Integrações

### Modificações em `src/pages/Integrations.tsx`

1. Adicionar Meta Ads na lista `availableIntegrations`:

```typescript
{
  id: "meta_ads",
  name: "Meta Ads",
  description: "Facebook e Instagram Ads - métricas de campanhas publicitárias",
  popular: true,
  logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/05/Meta_logo.svg",
}
```

2. Adicionar handler no `handleConnect`:

```typescript
} else if (platformId === "meta_ads") {
  const metaAppId = "SEU_APP_ID"; // Será substituído pelo real
  const redirectUri = `https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/meta-ads-auth`;
  const scopes = "ads_read,ads_management,business_management";
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth` +
    `?client_id=${metaAppId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${user.id}`;
  
  window.location.href = authUrl;
}
```

---

## Parte 4: Atualização do Token Rotation

### Modificar `supabase/functions/refresh-integration-tokens/index.ts`

Adicionar suporte para renovar tokens Meta Ads que estão próximos de expirar:

```typescript
if (integration.platform === 'meta_ads') {
  // Long-lived tokens duram 60 dias
  // Renovar quando faltar menos de 7 dias
  const response = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${META_APP_ID}` +
    `&client_secret=${META_APP_SECRET}` +
    `&fb_exchange_token=${currentToken}`
  );
}
```

---

## Parte 5: Configuração no config.toml

```toml
[functions.meta-ads-auth]
verify_jwt = false
```

A função recebe redirect do Facebook (sem JWT), então validamos manualmente via `state` parameter.

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/meta-ads-auth/index.ts` | Criar | Edge Function para OAuth callback |
| `supabase/config.toml` | Modificar | Adicionar config da nova função |
| `src/pages/Integrations.tsx` | Modificar | Adicionar Meta Ads na lista e handler |
| `supabase/functions/refresh-integration-tokens/index.ts` | Modificar | Adicionar renovação de tokens Meta |

---

## Sequência de Implementação

1. **Configurar Secrets**
   - Adicionar `META_APP_ID` e `META_APP_SECRET` nos Supabase Secrets

2. **Criar Edge Function `meta-ads-auth`**
   - OAuth token exchange
   - Long-lived token conversion
   - Busca de ad accounts
   - Salvamento criptografado

3. **Atualizar config.toml**
   - Adicionar configuração da nova função

4. **Atualizar Integrations.tsx**
   - Adicionar Meta Ads na lista de plataformas
   - Implementar handleConnect para meta_ads

5. **Atualizar Token Rotation**
   - Adicionar suporte para renovação de tokens Meta

6. **Testar fluxo completo**

---

## Permissões OAuth Necessárias

| Permissão | Descrição | Nível |
|-----------|-----------|-------|
| `ads_read` | Leitura de dados de anúncios e métricas | Standard |
| `ads_management` | Gerenciamento de campanhas | Advanced |
| `business_management` | Acesso a contas de negócios | Standard |

---

## Tokens e Expiração

| Tipo | Duração | Renovação |
|------|---------|-----------|
| Short-lived | 1-2 horas | Não usado (convertido imediatamente) |
| Long-lived | 60 dias | Via `fb_exchange_token` antes de expirar |

O sistema irá:
1. Sempre converter para long-lived token na conexão
2. Incluir no sistema de token rotation para renovar automaticamente

---

## Resultado Esperado

Após implementação:
- Meta Ads aparece na lista de integrações disponíveis
- Usuário clica "Conectar" e é redirecionado para Facebook Login
- Após autorizar, volta para página de integrações com status "Conectado"
- Token é armazenado de forma segura e renovado automaticamente
- Base pronta para sincronizar métricas reais (próxima etapa)
