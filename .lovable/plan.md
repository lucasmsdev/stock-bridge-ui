

# Correcoes na secao de Integracao da Landing Page

## Problemas identificados

1. **Marketplaces nao centralizados**: O grid de 4 colunas com 7 itens deixa a ultima linha (3 itens) alinhada a esquerda em vez de centralizada.
2. **TikTok Ads sem logo**: A URL externa usada para o TikTok Ads provavelmente esta quebrada (dominio ttwstatic.com bloqueia hotlinking).

## Solucao

### 1. Centralizar Marketplaces
Trocar o layout de `grid` para `flex flex-wrap justify-center` para que os itens da ultima linha fiquem centralizados automaticamente. Cada card tera largura fixa para manter o alinhamento visual.

### 2. Corrigir logo do TikTok Ads
Usar o mesmo asset local `/logos/tiktok-shop.png` que ja existe no projeto (icone do TikTok), garantindo que a logo carregue corretamente.

## Detalhes tecnicos

- **Arquivo**: `src/pages/Landing.tsx`
- **Marketplaces (linha 394)**: Substituir `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` por `flex flex-wrap justify-center` com largura fixa nos cards
- **TikTok Ads (linha 430)**: Trocar URL externa quebrada por `/logos/tiktok-shop.png`

