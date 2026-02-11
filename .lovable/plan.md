

# Ads Dashboard: Novos Marketplaces + Redesign dos Cards

## Resumo

Adicionar **Magalu Ads** e **TikTok Shop Ads** ao Dashboard de Ads (ambos permitem patrocinar produtos), e redesenhar os cards/banners de conexao das plataformas para ficarem mais bonitos e organizados.

---

## O que muda

### 1. Duas novas plataformas de Ads

- **Magalu Ads** - Magazine Luiza permite patrocinar produtos dentro do marketplace
- **TikTok Shop Ads** - TikTok Shop tem sistema de anuncios internos para promover produtos

Total de plataformas no Dashboard: **8** (era 6)
- Externas: Meta Ads, Google Ads, TikTok Ads
- Marketplaces: Mercado Livre, Shopee, Amazon, **Magalu**, **TikTok Shop**

### 2. Redesign visual dos cards de conexao

Os banners atuais sao retangulares simples empilhados em grid. O novo design vai trazer:
- Cards compactos com logo maior e mais destaque visual
- Separacao visual entre **Plataformas Externas** (Meta/Google/TikTok) e **Marketplaces** (ML/Shopee/Amazon/Magalu/TikTok Shop)
- Gradientes mais suaves e bordas arredondadas
- Layout em grid responsivo melhorado (ate 4 colunas em telas grandes)
- Badge de status mais visivel
- Botao de sync integrado de forma mais elegante

---

## Detalhes Tecnicos

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/ads/mockAdsData.ts` | Adicionar tipos, campanhas mock e dados diarios para `magalu_ads` e `tiktokshop_ads` |
| `src/components/ads/AdsConnectionBanner.tsx` | Adicionar configs para as 2 novas plataformas + redesign visual completo dos cards |
| `src/components/ads/AdsFilters.tsx` | Adicionar opcoes de filtro para Magalu Ads e TikTok Shop Ads |
| `src/components/ads/AdsDashboard.tsx` | Integrar hooks para Magalu e TikTok Shop + separar banners em secoes (Externas vs Marketplaces) |
| `src/components/ads/useMetaAdsData.ts` | Adicionar hooks `useMagaluAdsIntegration`, `useTikTokShopAdsIntegration`, `useSyncMagaluAds`, `useSyncTikTokShopAds` |
| `src/components/ads/AdsPlatformBreakdown.tsx` | Adicionar cores e labels para as 2 novas plataformas |
| `src/components/ads/CampaignPerformanceTable.tsx` | Adicionar short labels para Magalu e TikTok Shop |

### Novos Edge Functions

| Function | Descricao |
|----------|-----------|
| `supabase/functions/sync-magalu-ads/index.ts` | Sincroniza metricas de Ads da Magalu via API |
| `supabase/functions/sync-tiktokshop-ads/index.ts` | Sincroniza metricas de Ads do TikTok Shop via API |

Ambas seguem o mesmo padrao das existentes (sync-shopee-ads, sync-mercadolivre-ads): autenticacao via JWT, decrypt de token, chamada a API do marketplace, upsert na tabela `ad_metrics`.

### Redesign dos Cards

O componente `AdsConnectionBanner` sera redesenhado para:
- Usar cards com altura fixa e layout vertical (logo no topo, info abaixo)
- Gradiente de fundo mais sutil por plataforma
- Logo centralizada e maior (40x40)
- Nome da plataforma em destaque
- Badge de status (Conectado/Dados reais/Sem dados) mais proeminente
- Botao de sync compacto (apenas icone em telas pequenas)
- Agrupamento com subtitulos: "Plataformas Externas" e "Marketplaces"
- Grid responsivo: 2 cols mobile, 3 cols tablet, 4 cols desktop

### Cores das novas plataformas

- **Magalu Ads**: Azul Magalu (#0086FF) com gradiente azul
- **TikTok Shop Ads**: Preto/Cyan (#25F4EE) com gradiente escuro

