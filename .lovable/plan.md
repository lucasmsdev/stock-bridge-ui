

# Configurar chave de criptografia no banco de dados

## Problema atual

O OAuth do TikTok Ads agora funciona corretamente (token obtido com sucesso). Porem, ao tentar salvar o token criptografado no banco, a funcao `encrypt_token()` falha porque a configuracao `app.settings.encryption_key` nao existe no banco de dados.

## Solucao

Executar o seguinte comando SQL no Supabase para configurar a chave de criptografia:

```text
ALTER DATABASE postgres SET app.settings.encryption_key = 'UMA_CHAVE_SEGURA_DE_32_CARACTERES';
```

Apos isso, reiniciar as conexoes do banco para que a configuracao seja aplicada.

## Passos

1. Gerar uma chave segura de 32 caracteres para criptografia AES
2. Executar o SQL acima no banco de dados via migration
3. Re-deploy da edge function `tiktok-ads-auth` (ou apenas re-testar o fluxo)
4. Testar a conexao do TikTok Ads novamente

## Detalhe tecnico

| Recurso | Acao |
|---|---|
| Banco de dados (SQL) | Configurar `app.settings.encryption_key` com uma chave segura |
| Edge function `tiktok-ads-auth` | Nenhuma alteracao de codigo necessaria |
| Teste | Re-tentar o fluxo OAuth do TikTok Ads |

## Nota de seguranca

A chave de criptografia deve ser uma string forte e unica. Ela sera usada por todas as integracoes que criptografam tokens (Mercado Livre, Shopee, Amazon, etc). Se outras integracoes ja funcionam com criptografia, essa chave ja deveria estar configurada — o que sugere que pode ter sido removida ou nunca configurada neste ambiente.

