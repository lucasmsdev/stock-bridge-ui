

# Expandir o Card Container das Taxas por Marketplace

## Problema

O card externo ("Taxas por Marketplace") que envolve todos os cards individuais de cada plataforma esta com padding e espaco interno insuficiente. Os cards de Amazon, Magalu, Shopee etc. ficam colados uns nos outros e nas bordas do container.

## Solucao

Aumentar o padding e espacamento interno do Card pai no componente `FinancialSettings.tsx`:

1. Aumentar o padding do `CardHeader` e `CardContent` do card container externo
2. Aumentar o `gap` do grid dos platform cards para dar mais respiro entre eles
3. Aumentar o espacamento entre o seletor de regime tributario e os cards

## Arquivo Modificado

| Arquivo | Mudanca |
|---------|---------|
| `src/components/expenses/FinancialSettings.tsx` | Aumentar padding do Card pai (`p-8`), gap do grid (`gap-6`), e espacamento geral (`space-y-8`) |

## Detalhes

- `CardHeader`: adicionar classe `p-8` para mais respiro no cabecalho
- `CardContent`: trocar `p-6` padrao por `p-8 pt-2` para mais espaco nas laterais e embaixo
- `space-y-6` do CardContent interno: aumentar para `space-y-8`
- Grid dos cards: aumentar gap de `gap-5` para `gap-6`
- Seletor de regime tributario: aumentar padding interno de `p-4` para `p-5`

