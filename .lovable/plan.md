

# Corrigir Erro de Integração Shopify

## Problema Identificado

Os logs mostram claramente o erro:
```
Could not find the 'encryption_migrated' column of 'integrations' in the schema cache
```

A coluna `encryption_migrated` foi removida do banco de dados durante a atualização de segurança, mas a Edge Function `shopify-callback` ainda tenta inserir um valor nela.

---

## O que está acontecendo

```text
┌───────────────────────┐
│   Shopify OAuth OK    │
│   Token obtido ✅     │
└──────────┬────────────┘
           │
           v
┌───────────────────────────────────────┐
│ INSERT INTO integrations (            │
│   ...                                 │
│   encryption_migrated: true  ← ERRO!  │
│ )                                     │
└───────────────────────────────────────┘
           │
           v
    ❌ Coluna não existe
```

---

## Solução

Remover o campo `encryption_migrated` do INSERT nas Edge Functions afetadas:
- `shopify-callback`
- `amazon-callback`

---

## Mudanças Necessárias

### Arquivo 1: `supabase/functions/shopify-callback/index.ts`

**Linha 131** - Remover `encryption_migrated: true`:

```typescript
// ANTES
const { error: insertError } = await supabase
  .from('integrations')
  .insert({
    user_id: userId,
    platform: 'shopify',
    encrypted_access_token: encryptedAccessToken,
    encryption_migrated: true,  // ← REMOVER ESTA LINHA
    shop_domain: shopDomain,
    account_name: accountName,
  });

// DEPOIS
const { error: insertError } = await supabase
  .from('integrations')
  .insert({
    user_id: userId,
    platform: 'shopify',
    encrypted_access_token: encryptedAccessToken,
    shop_domain: shopDomain,
    account_name: accountName,
  });
```

### Arquivo 2: `supabase/functions/amazon-callback/index.ts`

**Linha 123** - Remover `encryption_migrated: true`:

```typescript
// ANTES
const { data: integration, error: insertError } = await supabaseClient
  .from('integrations')
  .insert({
    user_id: state,
    platform: 'amazon',
    encrypted_access_token: encryptedAccessToken,
    encrypted_refresh_token: encryptedRefreshToken,
    encryption_migrated: true,  // ← REMOVER ESTA LINHA
    selling_partner_id: sellingPartnerId,
    marketplace_id: 'ATVPDKIKX0DER',
    account_name: sellingPartnerId || 'Amazon Seller',
  })

// DEPOIS
const { data: integration, error: insertError } = await supabaseClient
  .from('integrations')
  .insert({
    user_id: state,
    platform: 'amazon',
    encrypted_access_token: encryptedAccessToken,
    encrypted_refresh_token: encryptedRefreshToken,
    selling_partner_id: sellingPartnerId,
    marketplace_id: 'ATVPDKIKX0DER',
    account_name: sellingPartnerId || 'Amazon Seller',
  })
```

---

## Resultado Esperado

Após a correção:
1. Conectar loja Shopify funcionará normalmente
2. Conectar conta Amazon funcionará normalmente
3. Tokens continuarão sendo salvos criptografados

---

## Próximos Passos

Após implementar, basta tentar conectar a loja Shopify novamente - o OAuth já funcionou corretamente, só falhou ao salvar no banco.

