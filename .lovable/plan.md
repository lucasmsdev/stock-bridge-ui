

# Corrigir assinatura Shopee - Remover prefixo "shpk"

## Diagnostico

Dos logs atuais:
- PARTNER_KEY length: 64 (inclui prefixo "shpk" = 4 chars + 60 chars hex)
- Base string esta correta: `1219413/api/v2/shop/auth_partner1771449671`
- Host de teste esta correto: `partner.test-stable.shopeemobile.com`
- A sanitizacao de caracteres invisiveis esta OK

O problema: a Shopee exige que o HMAC-SHA256 use apenas a parte hex da chave, **sem o prefixo "shpk"**. O codigo atual passa a chave completa (com "shpk") como secret do HMAC, gerando uma assinatura diferente da esperada pela API.

## Solucao

### Arquivo: `supabase/functions/shopee-auth/index.ts`

1. Apos sanitizar a PARTNER_KEY, remover o prefixo "shpk" se presente:

```typescript
const PARTNER_KEY_CLEAN = PARTNER_KEY.startsWith('shpk') 
  ? PARTNER_KEY.slice(4) 
  : PARTNER_KEY;
```

2. Usar `PARTNER_KEY_CLEAN` no `crypto.subtle.importKey` em vez de `PARTNER_KEY`

3. Adicionar logs mais claros:
   - Log da chave com e sem prefixo (length apenas, nao o valor)
   - Log da URL final completa para debug

### Arquivo: `supabase/functions/shopee-callback/index.ts`

Aplicar a mesma logica de remocao de prefixo para manter consistencia no token exchange.

### Deploy

Redeployar ambas as funcoes apos as alteracoes.

## Secao Tecnica

### Alteracoes em `shopee-auth/index.ts`

Linha 18 - Adicionar apos sanitizacao:
```typescript
const PARTNER_KEY_CLEAN = PARTNER_KEY.startsWith('shpk') 
  ? PARTNER_KEY.slice(4) 
  : PARTNER_KEY;
```

Linha 71-77 - Usar PARTNER_KEY_CLEAN no importKey:
```typescript
const key = await crypto.subtle.importKey(
  "raw",
  encoder.encode(PARTNER_KEY_CLEAN),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"]
);
```

Logs adicionais:
```typescript
console.log("PARTNER_KEY raw length:", PARTNER_KEY.length);
console.log("PARTNER_KEY clean (sem prefixo) length:", PARTNER_KEY_CLEAN.length);
console.log("Auth URL final:", authUrl);
```

### Alteracoes em `shopee-callback/index.ts`

Mesma logica na linha 18 e linhas 29-35 para o token exchange.

