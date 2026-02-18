

# Corrigir erro "Wrong sign" na autenticacao Shopee

## Diagnostico

Apos analise detalhada:
- A formula da assinatura (`partner_id + path + timestamp`, HMAC-SHA256 com partner_key) esta **correta** conforme documentacao oficial da Shopee
- O host de teste (`partner.test-stable.shopeemobile.com`) esta correto para status "Developing"
- O Test Redirect URL Domain (`https://fcvwogaqarkuqvumyqqm.supabase.co`) esta correto

**Causa mais provavel**: O secret `SHOPEE_PARTNER_KEY` armazenado nao corresponde exatamente a chave do painel. Caracteres invisiveis como zero-width spaces nao sao removidos por `.trim()`.

**Bug adicional encontrado**: O arquivo `shopee-callback/index.ts` tem um erro na geracao da assinatura - usa `PARTNER_KEY` em vez de `partnerId` na base string (linha 27). Isso quebrara o token exchange quando a auth funcionar.

## Plano de Acao

### Passo 1 - Atualizar o SHOPEE_PARTNER_KEY

Solicitar que voce re-insira o Partner Key copiando diretamente do painel da Shopee, garantindo que nao haja caracteres extras.

### Passo 2 - Adicionar verificacao inline na Edge Function

Modificar `shopee-auth/index.ts` para:
- Converter o PARTNER_KEY para hex e logar para comparacao visual com o painel
- Fazer uma chamada de teste direta para a Shopee API e logar a resposta completa antes de retornar a URL

### Passo 3 - Corrigir bug no shopee-callback

Na funcao `shopee-callback/index.ts`, corrigir a base string de:
```text
ERRADO: ${PARTNER_KEY}${path}${timestamp}
CORRETO: ${partnerId}${path}${timestamp}
```

### Passo 4 - Redeployar e testar

Redeployar ambas as funcoes e testar a conexao novamente.

## Secao Tecnica

### Arquivo: `supabase/functions/shopee-auth/index.ts`

- Adicionar sanitizacao agressiva do PARTNER_KEY: remover todos os caracteres nao-alfanumericos (exceto os esperados do formato shpk + hex)
- Adicionar log do PARTNER_KEY convertido para hex bytes para comparacao definitiva

```typescript
// Sanitizar removendo qualquer caractere nao hex (exceto prefixo shpk)
const PARTNER_KEY_CLEAN = PARTNER_KEY.replace(/[^a-fA-F0-9shpk]/g, '');
console.log("Key length after sanitize:", PARTNER_KEY_CLEAN.length);
```

### Arquivo: `supabase/functions/shopee-callback/index.ts`

- Linha 27: Corrigir base string para usar `partnerId` em vez de `PARTNER_KEY`
- Adicionar `.trim()` nas variaveis de ambiente
- Usar host de teste (`partner.test-stable.shopeemobile.com`) em vez de producao

