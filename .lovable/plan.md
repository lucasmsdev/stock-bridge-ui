

# Verificar integração TikTok Ads no Dashboard

## Situação atual

A tabela `ad_metrics` está vazia. Os gráficos do dashboard mostram **dados mock hardcoded** do arquivo `mockAdsData.ts`, não dados do banco. Por isso, mesmo conectando o TikTok, o dashboard continua mostrando os mesmos valores.

## O que precisa ser feito

### 1. Executar o sync do TikTok Ads

Chamar a edge function `sync-tiktok-ads` para buscar dados do sandbox e popular a tabela `ad_metrics`. Isso fará o dashboard detectar dados reais e parar de usar os mock.

### 2. Verificar o resultado

Após o sync:
- Se dados forem inseridos em `ad_metrics`, o dashboard mostrará os dados reais do TikTok
- Se o sync falhar (sandbox pode ter limitações de dados), verificamos os logs para entender o problema

## Detalhes técnicos

| Etapa | Ação |
|---|---|
| Executar sync | Chamar `sync-tiktok-ads` via POST |
| Verificar banco | Consultar `ad_metrics` para confirmar inserção |
| Verificar logs | Ler logs da edge function em caso de erro |
| Dashboard | Confirmar que os dados reais aparecem em vez dos mock |

Nenhum arquivo será alterado. Apenas execução e diagnóstico.

