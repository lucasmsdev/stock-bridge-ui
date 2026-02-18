

# Diagnostico Definitivo - Shopee error_sign

## Situacao Atual

Dos logs mais recentes:
- `PARTNER_KEY raw length: 64` (chave começa com "shpk" + 60 chars hex)
- `PARTNER_KEY clean length: 60` (apos remover "shpk")
- Base string correta: `1219413/api/v2/shop/auth_partner{timestamp}`
- Host correto: `partner.test-stable.shopeemobile.com`
- Sign gerada COM prefixo: `38a350b5...` -> error_sign
- Sign gerada SEM prefixo: `9c2b021a...` -> error_sign

Ambas as abordagens falham, o que indica que o problema nao esta no prefixo, mas na **propria chave armazenada**.

## Plano de Acao

### Passo 1 - Adicionar logs de diagnostico avancado

Modificar `shopee-auth/index.ts` para logar:
- Preview da chave (primeiros 6 + ultimos 4 caracteres) para validacao visual
- Timestamp em formato UTC legivel para verificar timezone
- Gerar AMBAS as assinaturas (com e sem prefixo) em uma unica chamada para comparacao definitiva
- Logar o char code de cada caractere dos primeiros 8 chars da chave para detectar caracteres invisíveis nao cobertos pelo regex atual

### Passo 2 - Re-inserir o secret SHOPEE_PARTNER_KEY

Solicitar re-insercao do secret com a **Test Partner Key** copiada diretamente do painel Shopee (open.shopee.com > App > App Credentials > Test Partner Key).

### Passo 3 - Redeployar e testar

Deploy da funcao atualizada e teste imediato.

---

## Secao Tecnica

### Alteracoes em `supabase/functions/shopee-auth/index.ts`

Adicionar apos linha 71 (bloco de logs existente):

```typescript
// Preview seguro da chave para validacao visual
console.log("Key preview (raw):", PARTNER_KEY.substring(0, 6) + "..." + PARTNER_KEY.slice(-4));
console.log("Key preview (clean):", PARTNER_KEY_CLEAN.substring(0, 6) + "..." + PARTNER_KEY_CLEAN.slice(-4));

// Verificar timezone do timestamp
console.log("Timestamp UTC:", new Date(timestamp * 1000).toUTCString());

// Char codes dos primeiros 8 chars para detectar caracteres ocultos
const charCodes = Array.from(PARTNER_KEY.substring(0, 8)).map(c => c.charCodeAt(0));
console.log("Key first 8 char codes:", JSON.stringify(charCodes));
```

Apos gerar a sign principal (linha 85), adicionar geracao da sign alternativa para comparacao:

```typescript
// Testar sign com a outra variante da chave
const altKey = PARTNER_KEY_CLEAN === PARTNER_KEY 
  ? PARTNER_KEY  // ja sao iguais, nada a comparar
  : PARTNER_KEY; // usar chave COM prefixo como alternativa
const altCryptoKey = await crypto.subtle.importKey(
  "raw", encoder.encode(altKey),
  { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
);
const altSig = await crypto.subtle.sign("HMAC", altCryptoKey, encoder.encode(baseString));
const altSign = Array.from(new Uint8Array(altSig))
  .map(b => b.toString(16).padStart(2, "0")).join("");
console.log("Sign SEM prefixo (usada):", sign);
console.log("Sign COM prefixo (alternativa):", altSign);
```

### Secret a re-inserir

- `SHOPEE_PARTNER_KEY`: copiar a **Test Partner Key** do painel Shopee, caractere por caractere

### Deploy

Redeployar `shopee-auth` apos alteracoes.

