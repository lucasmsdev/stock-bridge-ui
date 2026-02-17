
# Corrigir erro "Wrong sign" na autenticação Shopee

## Diagnóstico

Pelos logs da Edge Function:
- `baseString`: `1219413/api/v2/shop/auth_partner1771308479` -- formato correto
- `PARTNER_KEY length`: 64 -- parece correto
- `PARTNER_KEY starts with`: `shpk` -- formato Shopee OK
- Algoritmo HMAC-SHA256 esta correto conforme documentacao Shopee v2

O problema mais provavel e que o secret `SHOPEE_PARTNER_KEY` contem **caracteres invissiveis** (espaco, newline, tab) no inicio ou fim da string. Isso e extremamente comum ao copiar/colar secrets e causa falha silenciosa na assinatura.

## Solucao

### 1. Adicionar `.trim()` no PARTNER_KEY e PARTNER_ID

No arquivo `supabase/functions/shopee-auth/index.ts`, aplicar `.trim()` em todas as variaveis de ambiente para remover whitespace:

```typescript
const PARTNER_ID = Deno.env.get("SHOPEE_PARTNER_ID")?.trim();
const PARTNER_KEY = Deno.env.get("SHOPEE_PARTNER_KEY")?.trim();
```

### 2. Adicionar log de verificacao extra

Adicionar log que mostra os ultimos 4 caracteres e os char codes dos primeiros/ultimos bytes para detectar caracteres invissiveis:

```typescript
console.log("PARTNER_KEY ends with:", JSON.stringify(PARTNER_KEY.slice(-4)));
console.log("PARTNER_KEY first char code:", PARTNER_KEY.charCodeAt(0));
console.log("PARTNER_KEY last char code:", PARTNER_KEY.charCodeAt(PARTNER_KEY.length - 1));
```

### 3. Redeployar a Edge Function

Apos as alteracoes, redeployar `shopee-auth` e testar novamente.

## Detalhes Tecnicos

- A funcao `crypto.subtle.sign("HMAC", key, data)` e sensivel a cada byte da chave
- Um unico espaco ou `\n` no final do PARTNER_KEY gera uma assinatura completamente diferente
- O `.trim()` remove `\n`, `\r`, `\t`, e espacos do inicio e fim
- Esta e a causa mais comum de "wrong sign" quando as credenciais parecem corretas visualmente
