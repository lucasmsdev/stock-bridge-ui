
# Anuncios de Marketplaces no Dashboard de Ads

## Objetivo

Integrar os anuncios nativos dos marketplaces (Mercado Livre Ads, Shopee Ads, Amazon Ads) ao Dashboard de Ads existente, unificando todas as metricas de publicidade em um so lugar -- tanto plataformas externas (Meta, Google, TikTok) quanto anuncios internos dos marketplaces.

## Situacao Atual

- O Dashboard de Ads so mostra Meta Ads, Google Ads e TikTok Ads
- A tabela `ad_metrics` ja suporta qualquer plataforma (campo `platform` e texto livre)
- Os marketplaces (Mercado Livre, Shopee, Amazon) ja possuem integracao OAuth ativa
- Nao existem Edge Functions para sincronizar metricas de ads dos marketplaces
- O filtro de plataforma no dashboard so tem 3 opcoes

## O que muda

### 1. Novas Edge Functions para Sincronizar Ads dos Marketplaces

Criar 3 novas Edge Functions que buscam dados de anuncios nas APIs nativas:

**`sync-mercadolivre-ads`**
- Usa a API `/users/{user_id}/items/search` + `/items/{id}/product_ads` do Mercado Livre
- Captura: gasto diario, impressoes, cliques, vendas atribuidas
- Salva na tabela `ad_metrics` com `platform = 'mercadolivre_ads'`

**`sync-shopee-ads`**
- Usa a Shopee Ads API (`/api/v2/ads/get_performance`)
- Captura: gasto, impressoes, cliques, conversoes
- Salva com `platform = 'shopee_ads'`

**`sync-amazon-ads`**
- Usa a Amazon Advertising API (Sponsored Products Report)
- Captura: gasto, impressoes, cliques, vendas
- Salva com `platform = 'amazon_ads'`

### 2. Atualizar o Dashboard de Ads

**Filtros (`AdsFilters.tsx`)**
- Adicionar opcoes: Mercado Livre Ads, Shopee Ads, Amazon Ads
- Atualizar o tipo `AdsPlatform` para incluir as novas plataformas

**Banners de conexao (`AdsConnectionBanner.tsx`)**
- Adicionar config visual para cada marketplace (cores, logos)
- Detectar integracao de marketplace como fonte de ads

**Tabela de campanhas (`CampaignPerformanceTable.tsx`)**
- Adicionar cores e labels para as novas plataformas

**Mock data (`mockAdsData.ts`)**
- Adicionar campanhas demo dos marketplaces para visualizacao sem conexao

**Hook de dados (`useMetaAdsData.ts`)**
- Adicionar hooks para detectar integracao de marketplace como ads
- Adicionar funcoes de sync para cada marketplace

### 3. Banners e Cores dos Marketplaces

| Plataforma        | Cor Primaria | Logo                        |
|--------------------|--------------|------------------------------|
| Mercado Livre Ads  | Amarelo (#FFE600) | `/logos/mercadolivre.svg`    |
| Shopee Ads         | Laranja (#EE4D2D)  | `/logos/shopee.svg`          |
| Amazon Ads         | Laranja (#FF9900)  | `/logos/amazon.svg`          |

### 4. Breakdown e Metricas Unificados

- O dashboard ja agrega automaticamente por plataforma via `ad_metrics`
- Ao adicionar os dados dos marketplaces na mesma tabela, o breakdown, graficos e totais vao incluir tudo automaticamente
- O usuario podera filtrar por qualquer plataforma individualmente ou ver tudo junto

## Detalhes Tecnicos

### Arquivos Novos

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/sync-mercadolivre-ads/index.ts` | Sync de ads do Mercado Livre |
| `supabase/functions/sync-shopee-ads/index.ts` | Sync de ads da Shopee |
| `supabase/functions/sync-amazon-ads/index.ts` | Sync de ads da Amazon |

### Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/ads/mockAdsData.ts` | Adicionar tipo e dados demo para marketplace ads |
| `src/components/ads/AdsFilters.tsx` | Adicionar 3 novas opcoes de filtro |
| `src/components/ads/useMetaAdsData.ts` | Hooks de integracao e sync para marketplace ads |
| `src/components/ads/AdsConnectionBanner.tsx` | Config visual para marketplace ads |
| `src/components/ads/AdsDashboard.tsx` | Incluir marketplace ads nas integracoes ativas |
| `src/components/ads/CampaignPerformanceTable.tsx` | Cores e labels das novas plataformas |
| `src/components/ads/AdsPlatformBreakdown.tsx` | Cores para novas plataformas no grafico |

### APIs dos Marketplaces Utilizadas

**Mercado Livre:**
- `GET /users/{seller_id}/advertising/campaigns` -- listar campanhas
- `GET /advertising/campaigns/{campaign_id}` -- metricas por campanha
- Alternativa: `GET /items/{item_id}/product_ads` para Product Ads

**Shopee:**
- `POST /api/v2/ads/get_campaign_list` -- listar campanhas
- `POST /api/v2/ads/get_performance` -- metricas de performance

**Amazon:**
- Sponsored Products API: `POST /v2/sp/campaigns` + Reports API
- Relatório de performance de campanhas patrocinadas

### Fluxo de Dados

```text
Mercado Livre API ─┐
Shopee API ────────┤─> Edge Functions ─> ad_metrics (tabela existente)
Amazon API ────────┘                           │
                                               ▼
Meta Ads ──────────┐                   Dashboard de Ads
Google Ads ────────┤─> ja funciona ─>  (metricas unificadas)
TikTok Ads ────────┘
```

Todas as plataformas salvam na mesma tabela `ad_metrics`, permitindo que o dashboard mostre tudo junto automaticamente.
