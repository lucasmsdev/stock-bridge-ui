
# Separar plataformas de Ads das de Marketplace e melhorar o banner de sync

## Problema

1. Na pagina de Integracoes, as plataformas de Ads (Meta Ads, Google Ads, TikTok Ads) mostram botoes de "Importar Produtos" e "Sincronizar Pedidos" -- funcoes que nao fazem sentido pois elas sincronizam apenas metricas de anuncios.

2. Na pagina de Produtos, o dropdown "Importar" lista TODAS as integracoes conectadas, incluindo as de Ads, o que confunde o usuario.

3. O banner de sincronizacao no Dashboard de Ads esta visualmente simples demais, com cards empilhados sem identidade visual.

## Mudancas

### 1. Pagina de Integracoes (`src/pages/Integrations.tsx`)

**Cards de Ads conectados**: Remover os botoes "Importar Produtos" e "Sincronizar Pedidos" dos cards de integracao quando a plataforma for `meta_ads`, `google_ads` ou `tiktok_ads`. Em vez disso, mostrar um botao "Sincronizar Metricas" que redireciona para a aba Ads do Dashboard (`/app/dashboard?tab=ads`), deixando claro que essas plataformas servem para metricas, nao para produtos.

**Botao "Sincronizar Todos os Pedidos" no header**: Contar apenas integracoes de marketplace (excluir ads) para decidir se mostra o botao.

### 2. Pagina de Produtos (`src/pages/Products.tsx`)

Filtrar a lista de integracoes para mostrar apenas plataformas de marketplace no dropdown de importacao. Adicionar uma lista de plataformas de ads para exclusao:

```text
const adsPlatforms = ['meta_ads', 'google_ads', 'tiktok_ads'];
```

Filtrar tanto no dropdown do header quanto no empty state, exibindo apenas integracoes cujo `platform` nao esta na lista de ads.

### 3. Banner de Ads no Dashboard (`src/components/ads/AdsConnectionBanner.tsx`)

Redesenhar o banner para ficar mais atraente e profissional:

- Quando conectado: layout horizontal com logo da plataforma, nome da conta, badge de status, data do ultimo sync e botao de sincronizar -- tudo em um design mais compacto e estilizado com gradiente sutil
- Quando nao conectado: card com icone de alerta, mensagem clara e botao "Conectar" com visual mais destacado
- Adicionar os logos das plataformas (Meta azul, Google colorido, TikTok rosa) ao lado do nome
- Usar cores de fundo sutis por plataforma (azul para Meta, verde para Google, rosa para TikTok)
- Melhorar espacamento, tipografia e hierarquia visual

### 4. Dashboard de Ads (`src/components/ads/AdsDashboard.tsx`)

Ajustar o layout dos banners para que multiplas integracoes aparecam em grid horizontal (lado a lado em desktop) em vez de empilhadas verticalmente, aproveitando melhor o espaco.

## Resumo das alteracoes

| Arquivo | O que muda |
|---------|-----------|
| `src/pages/Integrations.tsx` | Remove "Importar Produtos" e "Sincronizar Pedidos" de cards de Ads; adiciona "Sincronizar Metricas" com redirect |
| `src/pages/Products.tsx` | Filtra integracoes de ads do dropdown de importacao |
| `src/components/ads/AdsConnectionBanner.tsx` | Redesign visual com logos, cores por plataforma e layout mais profissional |
| `src/components/ads/AdsDashboard.tsx` | Layout grid horizontal para banners de integracoes conectadas |
