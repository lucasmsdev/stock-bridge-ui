
# Adicionar Marketplaces e Plataformas de Ads na Landing Page

## O que sera feito

A secao "Nossos Partners" da Landing Page sera atualizada para mostrar **todos os marketplaces** e **todos os gerenciadores de anuncios** que o UniStock integra, utilizando as mesmas logos da pagina de Integracoes.

## Secao atual

Atualmente, a secao mostra apenas 4 marketplaces (Mercado Livre, Shopee, Amazon, Shopify) com logos inconsistentes e sem nenhuma referencia aos gerenciadores de anuncios.

## Nova estrutura

A secao sera dividida em duas partes:

### 1. Marketplaces (7 plataformas)
| Plataforma | Logo (mesma da Integracoes) |
|---|---|
| Mercado Livre | vectorseek.com (icon oficial) |
| Shopee | wikimedia Shopee logo |
| Amazon | wikimedia icon (com variante dark) |
| Shopify | cdn.freebiesupply.com (transparent) |
| Magalu | /logos/magalu.png |
| TikTok Shop | /logos/tiktok-shop.png (badge "Em breve") |
| Shein | /logos/shein.png (badge "Em breve") |

### 2. Gerenciadores de Anuncios (3 plataformas)
| Plataforma | Logo (mesma da Integracoes) |
|---|---|
| Meta Ads | /logos/meta-ads.png |
| Google Ads | wikimedia Google Ads logo |
| TikTok Ads | ibytedtos.com TikTok icon |

## Layout visual

- Subtitulo "Marketplaces" com grid de logos (3-4 colunas)
- Subtitulo "Gerenciadores de Anuncios" com grid de logos (3 colunas)
- Plataformas "Em breve" (Shein, TikTok Shop) terao um badge discreto
- Todas com hover scale e borda animada (mesmo estilo atual)
- Nome da plataforma exibido abaixo de cada logo para clareza
- Amazon com logo alternativa no modo dark (mesmo comportamento da pagina de Integracoes)

## Detalhes tecnicos

- Arquivo modificado: `src/pages/Landing.tsx`
- Substituicao da secao "Partners" (linhas 375-428) pelo novo layout com duas subsecoes
- Uso das mesmas URLs de logo definidas em `marketplaceIntegrations` e `adsIntegrations` da pagina de Integracoes
- Suporte a dark mode para logo da Amazon (usando `isDark` ja disponivel no componente)
- Sem novas dependencias necessarias
