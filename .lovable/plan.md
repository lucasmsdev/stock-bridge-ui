

# Expandir Cards de Taxas para Ocupar Todo o Espaco

## Problema

Os cards de taxas estao comprimidos e nao ocupam a largura total disponivel. O grid `sm:grid-cols-2 xl:grid-cols-3` combinado com o container pai esta limitando o tamanho dos cards.

## Solucao

Ajustar o layout do componente `FinancialSettings.tsx` para que os cards ocupem toda a largura disponivel:

1. Mudar o grid dos cards para `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` com gap maior
2. Garantir que o Card pai (container) nao tenha restricao de largura -- usar `w-full`
3. Dentro de cada `PlatformFeeCard`, ajustar o layout do header para nao truncar texto (o nome "Mercado Livre" esta cortado na screenshot)
4. Melhorar o grid interno das metricas (Comissao, Pgto, Fixa, Imposto) para nao ficarem apertadas -- usar `grid-cols-4` fixo com gap adequado

## Arquivo Modificado

| Arquivo | Mudanca |
|---------|---------|
| `src/components/expenses/FinancialSettings.tsx` | Ajustar grid externo para ocupar largura total, aumentar gap entre cards, corrigir truncamento de nomes, e garantir que metricas internas tenham espaco adequado |

## Detalhes

- Grid dos cards: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` com `gap-5`
- Header do card: layout em coluna para evitar que badge "Automatico" sobreponha o nome
- Metricas internas: `grid-cols-4` com `gap-4` e padding `p-3.5`
- Container pai: sem restricao de max-width

