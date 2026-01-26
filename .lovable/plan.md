
# Corrigir URL da API Shopify na Sincronização

## Problema Identificado

O domínio da loja Shopify é salvo no banco sem o sufixo `.myshopify.com`:
```
shop_domain: "unistockenterprise"
```

Mas ao fazer requisições para a API Shopify, a URL está sendo construída incorretamente:
```typescript
const baseUrl = `https://${shopDomain}/admin/api/...`;
// Resultado: https://unistockenterprise/admin/api/...  ❌
```

Isso causa erro de DNS:
```
dns error: failed to lookup address information: Name or service not known
```

---

## Solução

Adicionar o sufixo `.myshopify.com` ao construir a URL da API, garantindo que a URL completa seja válida.

---

## Mudança Técnica

### Arquivo: `supabase/functions/sync-shopify-listing/index.ts`

**Linha 130** - Adicionar `.myshopify.com`:

```typescript
// ANTES
const shopDomain = integration.shop_domain;
const baseUrl = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}`;

// DEPOIS
const shopDomain = integration.shop_domain;
const shopUrl = shopDomain.includes('.myshopify.com') 
  ? shopDomain 
  : `${shopDomain}.myshopify.com`;
const baseUrl = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}`;
```

**Por que verificar se já contém `.myshopify.com`?**
- Garante compatibilidade caso no futuro o domínio seja salvo completo
- Evita duplicação (como `unistockenterprise.myshopify.com.myshopify.com`)

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| `https://unistockenterprise/admin/api/2024-01/products/...` ❌ | `https://unistockenterprise.myshopify.com/admin/api/2024-01/products/...` ✅ |
| Erro DNS | Sincronização funciona |

---

## Teste

Após a correção:
1. Editar preço/estoque/nome de um produto na UNISTOCK
2. Verificar nos logs que a URL está correta
3. Confirmar que a alteração aparece na loja Shopify
