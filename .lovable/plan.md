

# Corrigir sanitizacao do SHOPEE_PARTNER_KEY

## Problema Encontrado

O regex atual `replace(/[^a-f0-9]/gi, '')` remove TODAS as letras que nao sao hexadecimais (a-f, 0-9). Isso inclui as letras **s, h, p, k** do prefixo `shpk` da chave Shopee.

Resultado:
- Chave original: `shpk...` (64 caracteres)
- Apos regex: `5a65...` (60 caracteres) - 4 caracteres removidos (s, h, p, k)
- Assinatura gerada com chave errada = `error_sign`

## Solucao

### Arquivo: `supabase/functions/shopee-auth/index.ts`

Trocar o regex agressivo por um que apenas remove caracteres invisiveis (whitespace, zero-width spaces, newlines) mas preserva TODAS as letras e numeros:

```typescript
// ANTES (bugado - remove s,h,p,k):
const PARTNER_KEY = PARTNER_KEY_RAW.replace(/[^a-f0-9]/gi, '');

// DEPOIS (correto - remove apenas caracteres invisiveis):
const PARTNER_KEY = PARTNER_KEY_RAW.replace(/[\s\u200B\u200C\u200D\uFEFF\u00A0]/g, '');
```

### Arquivo: `supabase/functions/shopee-callback/index.ts`

Aplicar a mesma correcao no callback.

### Redeployar ambas as funcoes e testar

## Secao Tecnica

O regex `[\s\u200B\u200C\u200D\uFEFF\u00A0]` remove:
- `\s` - espacos, tabs, newlines
- `\u200B` - zero-width space
- `\u200C` - zero-width non-joiner
- `\u200D` - zero-width joiner
- `\uFEFF` - BOM (byte order mark)
- `\u00A0` - non-breaking space

Isso preserva o prefixo `shpk` e todos os caracteres validos da chave.
