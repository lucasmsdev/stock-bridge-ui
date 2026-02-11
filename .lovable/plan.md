

# Taxas de Marketplace Automaticas (Sem Configuracao Manual)

## O que muda

O sistema ja aplica taxas diferentes para cada marketplace automaticamente (Mercado Livre 13%, Shopee 14%, Amazon 15%, etc.). A mudanca e tornar isso mais claro na interface: remover a edicao manual das taxas de comissao/pagamento e deixar somente o regime tributario como configuravel (porque esse varia por empresa).

## Como vai funcionar

- Cada marketplace mostra suas taxas automaticamente em cards visuais (somente leitura)
- As taxas sao baseadas nos valores oficiais de cada plataforma (ja definidos no sistema)
- O usuario so precisa escolher o **regime tributario** da empresa (MEI, Simples Nacional, Lucro Presumido) -- isso sim muda de empresa para empresa
- O calculo de lucro no Dashboard e Centro de Custos continua funcionando igual, sem nenhuma acao do usuario

## Interface

Cada card de marketplace vai mostrar:
- Logo e nome da plataforma
- Taxa de comissao (automatica, nao editavel)
- Taxa de pagamento (automatica, nao editavel)
- Taxa total efetiva
- Badge "Automatico" para indicar que nao precisa configurar

No topo da pagina, um seletor unico de **Regime Tributario** que se aplica a todos os marketplaces de uma vez.

## Detalhes Tecnicos

### Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useMarketplaceFees.ts` | Adicionar funcao `updateTaxRegime` que altera o regime em todos os perfis de uma vez. Manter `DEFAULT_FEES` como fonte principal. |
| `src/components/expenses/FinancialSettings.tsx` | Remover modo de edicao dos cards. Mostrar taxas como somente leitura com badge "Automatico". Adicionar seletor global de regime tributario no topo. |

### Logica

1. As taxas de comissao e pagamento vem do `DEFAULT_FEES` (hardcoded com valores reais dos marketplaces) e sao gravadas na tabela `marketplace_fee_profiles` no momento da criacao da org
2. O regime tributario e selecionado uma unica vez e aplicado a todos os marketplaces via mutation em batch
3. O `calculateFees()` continua funcionando exatamente igual -- nada muda nos calculos do Dashboard, ProfitBreakdown ou ProfitabilityCalculator
4. Se no futuro algum marketplace mudar suas taxas, basta atualizar o `DEFAULT_FEES` e rodar um update nos perfis existentes

