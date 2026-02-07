

## Substituir Placeholder do Magalu Client ID

### O que sera feito

Substituir o placeholder `YOUR_MAGALU_CLIENT_ID` pelo valor real `857769e2-779c-4ebd-a9ac-2e3ee7337a5b` no frontend, e remover o comentario TODO.

### Por que e seguro

O `client_id` e um identificador **publico** do app UniStock no Magalu — ele nao da acesso a nenhuma conta. O segredo (`client_secret`) permanece protegido nos secrets do Supabase, acessivel apenas pelas Edge Functions no backend.

Este e o mesmo padrao usado nas outras integracoes:
- Mercado Livre: app ID `5615590729373432` hardcoded no frontend
- Shopify: client ID `517f48d78655be55a0308aa81730221f` hardcoded no frontend

### Como funciona para cada cliente

Cada cliente da UniStock conecta sua propria conta Magalu atraves do fluxo OAuth:
1. Clica em "Conectar" -> e redirecionado ao login do Magalu
2. Faz login com as credenciais dele e autoriza a UniStock
3. Recebe tokens unicos vinculados ao usuario dele
4. Tokens ficam criptografados no banco, isolados por `user_id` e `organization_id`

### Alteracao

**Arquivo: `src/pages/Integrations.tsx`** (linha 333-335)

De:
```typescript
// Client ID público do Magalu (similar ao appId do Mercado Livre)
// TODO: Substituir pelo client_id real gerado via CLI idm
const magaluClientId = "YOUR_MAGALU_CLIENT_ID";
```

Para:
```typescript
const magaluClientId = "857769e2-779c-4ebd-a9ac-2e3ee7337a5b";
```

