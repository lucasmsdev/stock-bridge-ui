
# Usar as mesmas logos das Integracoes nos cards de Ads

## Problema
Os cards de Ads estao usando SVGs locais simplificados (`/logos/mercadolivre.svg`, `/logos/shopee.svg`, `/logos/amazon.svg`) que sao retangulos coloridos com texto. A pagina de Integracoes usa logos reais dos marketplaces via o componente `PlatformLogo`.

## Solucao
Atualizar as URLs de logo no `platformConfig` do `AdsConnectionBanner.tsx` para usar as mesmas imagens do componente `PlatformLogo`:

| Plataforma | Logo atual (SVG local) | Logo nova (mesma das Integracoes) |
|---|---|---|
| Mercado Livre | `/logos/mercadolivre.svg` | URL externa do icone real do ML |
| Shopee | `/logos/shopee.svg` | URL externa do logo oficial Shopee |
| Amazon | `/logos/amazon.svg` | URL externa do icone Amazon |

As demais plataformas (Meta, Google, TikTok, Magalu, TikTok Shop) ja usam logos corretas e nao precisam de alteracao.

## Arquivo modificado
- `src/components/ads/AdsConnectionBanner.tsx` - Atualizar 3 URLs de logo no objeto `platformConfig`
