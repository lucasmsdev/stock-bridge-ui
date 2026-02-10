
# Corrigir Dashboard de Ads: Mostrar dados reais em vez de mock quando conectado

## Problema identificado

O sync do TikTok Ads executou com sucesso, mas o sandbox retornou **0 campanhas** (sem dados de anuncios). Como a tabela `ad_metrics` continua vazia, a logica do dashboard (`hasRealData = realMetrics.length > 0`) faz o fallback para dados mock estaticos. Resultado: mesmo conectado, o usuario ve dados falsos.

## Solucao

Mudar a logica de decisao do dashboard: quando o usuario **tem uma integracao conectada** (`isConnected = true`), o dashboard deve mostrar os **dados reais** (mesmo que sejam zeros), e nao os dados mock. Os dados mock so devem aparecer quando **nenhuma plataforma esta conectada**.

## Alteracoes

### 1. `src/components/ads/AdsDashboard.tsx`

Trocar a variavel de decisao de `hasRealData` para `isConnected` nos blocos de fallback:

- **`displayTotals`**: Se `isConnected`, mostrar os totais reais (que serao zero se nao houver metricas). Se nao conectado, mostrar mock.
- **`displayDailyData`**: Se `isConnected`, mostrar array vazio ou dados reais. Se nao, mostrar mock.
- **`displayCampaigns`**: Se `isConnected`, mostrar lista vazia ou campanhas reais. Se nao, mostrar mock.
- **`displayPlatformBreakdown`**: Mesmo comportamento.
- **Banner "Dados de demonstracao"**: Mostrar apenas quando `!isConnected` (ja nao mostrar quando conectado mas sem dados).

### 2. Adicionar estado vazio amigavel

Quando `isConnected` mas `!hasRealData`:
- Nos cards de metricas, todos aparecerao zerados (comportamento natural)
- Na tabela de campanhas, mostrar mensagem "Nenhuma campanha encontrada. Clique em Sincronizar para buscar dados."
- No grafico, mostrar estado vazio com mensagem orientadora

## Resultado esperado

- Conectado + sem dados = metricas zeradas + mensagem orientadora (sem dados mock)
- Conectado + com dados = metricas reais
- Nao conectado = dados mock com badge "Dados de demonstracao"
