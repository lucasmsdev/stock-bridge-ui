

# Corrigir fluxo OAuth do TikTok Ads

## Problemas identificados

1. **Edge function sem logs apos troca de token**: Os logs param em "Exchanging auth_code for access token..." sem mostrar sucesso ou erro. Isso indica que a resposta da API do TikTok pode estar falhando silenciosamente ou a funcao esta crashando.

2. **Redirect para landing page**: Apos o callback, o usuario foi redirecionado para a landing page ao inves de `/app/integrations`. Isso pode ocorrer porque:
   - O `APP_URL` pode estar apontando para a URL base sem o path correto
   - A sessao do Supabase se perdeu durante o redirect OAuth (improvavel, mas possivel)

## Solucao

### 1. Melhorar logging na edge function `tiktok-ads-auth`

Adicionar logs detalhados em cada etapa critica para diagnosticar exatamente onde o fluxo falha:
- Log do status HTTP da resposta do TikTok
- Log do body completo da resposta (em caso de erro)
- Log antes e depois de cada operacao no banco
- Wrap individual de try/catch na troca de token

### 2. Corrigir tratamento da resposta do TikTok

Adicionar tratamento mais robusto para cenarios onde:
- A API retorna HTTP 200 mas com `code != 0`
- A resposta nao tem o formato esperado
- O fetch em si falha com timeout

### 3. Verificar e corrigir o redirect

Garantir que o `APP_URL` esta configurado corretamente e que o redirect final envia o usuario para `/app/integrations` com os parametros de status.

## Detalhes tecnicos

### Arquivo: `supabase/functions/tiktok-ads-auth/index.ts`

Alteracoes:
- Adicionar log do `tokenResponse.status` antes de verificar `tokenResponse.ok`
- Adicionar log do body completo da resposta em caso de sucesso e erro
- Adicionar try/catch especifico ao redor do `fetch` para capturar erros de rede
- Logar o `redirectUrl` final para confirmar que aponta para o lugar certo
- Logar se `TIKTOK_ADS_APP_ID` e `TIKTOK_ADS_APP_SECRET` estao definidos (sem expor os valores)

### Arquivo: `src/pages/Integrations.tsx`

Nenhuma alteracao necessaria no frontend — o App ID ja esta correto.

### Secret: `APP_URL`

Verificar se o valor atual do secret `APP_URL` corresponde a URL de preview correta (`https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app`). Se estiver incorreto, sera necessario atualizar.

## Resultado esperado

Apos as alteracoes, ao tentar conectar novamente:
- Os logs mostrarao exatamente onde o fluxo falha
- O redirect levara o usuario de volta para `/app/integrations` com o status correto
- Sera possivel diagnosticar se o problema e na API do TikTok, na criptografia do token, ou no redirect
