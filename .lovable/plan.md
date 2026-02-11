

# Taxas Reais por Marketplace -- Calculo Dinamico de Lucro

## Objetivo

Substituir a taxa unica de marketplace (hoje fixa em 12%) por taxas individuais e reais para cada plataforma, incluindo impostos brasileiros, para que o calculo de lucro reflita exatamente o que cada canal cobra.

## Situacao Atual (Problemas)

- Uma unica taxa de marketplace (12%) aplicada igualmente a todas as plataformas
- Dashboard calcula lucro bruto como `revenue * 0.30` (hardcoded)
- Nao considera impostos brasileiros (Simples Nacional, MEI, etc.)
- Nao diferencia comissoes entre Mercado Livre (~11-16%), Shopee (~14-20%), Amazon (~15%), Shopify (~2-3%), etc.

## Solucao

### 1. Nova tabela `marketplace_fee_profiles`

Criar uma tabela no banco para armazenar as taxas reais de cada marketplace por organizacao:

```text
marketplace_fee_profiles
--------------------------
id                  uuid (PK)
organization_id     uuid (FK)
platform            text (mercadolivre, shopee, amazon, shopify, magalu, shein, tiktok_shop)
commission_percent  numeric (taxa de comissao da plataforma)
payment_fee_percent numeric (taxa de processamento de pagamento)
fixed_fee_amount    numeric (taxa fixa por venda, se houver)
shipping_subsidy    numeric (desconto de frete, se houver)
tax_regime          text (simples_nacional, mei, lucro_presumido, isento)
tax_percent         numeric (aliquota de imposto efetiva)
notes               text (observacoes do usuario)
is_active           boolean
created_at / updated_at
```

Valores padrao pre-populados ao criar a org:

| Plataforma     | Comissao | Pagamento | Taxa fixa | Imposto padrao |
|----------------|----------|-----------|-----------|----------------|
| Mercado Livre  | 13%      | 4.99%     | R$0       | 6% (Simples)   |
| Shopee         | 14%      | 0%        | R$0       | 6%             |
| Amazon         | 15%      | 0%        | R$0       | 6%             |
| Shopify        | 0%       | 2.5%      | R$0       | 6%             |
| Magalu         | 16%      | 0%        | R$0       | 6%             |
| SHEIN          | 12%      | 0%        | R$0       | 6%             |
| TikTok Shop    | 5%       | 0%        | R$0       | 6%             |

### 2. Pagina de Configuracao de Taxas (refatorar `FinancialSettings`)

Substituir o slider unico por uma interface com cards para cada marketplace, onde o usuario pode:

- Ver e editar comissao, taxa de pagamento e taxa fixa de cada plataforma
- Selecionar o regime tributario (Simples Nacional, MEI, Lucro Presumido)
- Aliquota de imposto e ajustada automaticamente pelo regime escolhido
- Botao "Restaurar padrao" por plataforma
- Presets de categoria (ex: Eletronicos no ML cobram 13%, Moda 16%)

### 3. Hook `useMarketplaceFees`

Novo hook centralizado que:

- Carrega as taxas de todos os marketplaces da org
- Expoe funcao `calculateFees(platform, sellingPrice)` que retorna:
  - `commissionAmount` -- valor da comissao
  - `paymentFeeAmount` -- taxa de pagamento
  - `fixedFeeAmount` -- taxa fixa
  - `taxAmount` -- imposto
  - `totalDeductions` -- total descontado
  - `netPerUnit` -- lucro liquido por unidade (preco - custo - deducoes)
- Cache com React Query (staleTime 5 min)

### 4. Dashboard -- Calculo Real de Lucro

Refatorar `loadAllData` no Dashboard para:

- Buscar pedidos COM o campo `platform`
- Para cada pedido, aplicar as taxas especificas daquela plataforma usando `useMarketplaceFees`
- Calcular lucro bruto REAL: `receita - (taxas_marketplace + impostos + custo_produto)`
- Eliminar o hardcoded `revenue * 0.30`

### 5. Centro de Custos -- ProfitBreakdown Dinamico

Refatorar `ProfitBreakdown` para:

- Agrupar pedidos por plataforma
- Mostrar deducoes detalhadas por marketplace (em vez de uma unica linha "Taxas de Marketplace")
- Cada linha mostra: logo da plataforma, nome, quantidade de vendas, receita, taxa cobrada, e valor descontado

### 6. Calculadora de Precificacao -- Selecao de Marketplace

Refatorar `ProfitabilityCalculator` para:

- Adicionar dropdown de selecao de marketplace
- Ao selecionar, preencher automaticamente comissao e taxas daquela plataforma
- Calcular simulacao com os valores reais
- Mostrar comparativo lado a lado entre marketplaces ("Onde voce lucra mais?")

## Detalhes Tecnicos

### Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| **Nova migracao SQL** | Criar tabela `marketplace_fee_profiles` com RLS e seed de valores padrao |
| `src/hooks/useMarketplaceFees.ts` | **Novo** -- hook central para taxas por marketplace |
| `src/components/expenses/FinancialSettings.tsx` | Refatorar para mostrar taxas por marketplace em cards |
| `src/pages/Dashboard.tsx` | Substituir `revenue * 0.30` por calculo real com taxas por plataforma |
| `src/components/expenses/ProfitBreakdown.tsx` | Deducoes por marketplace em vez de taxa unica |
| `src/components/expenses/MonthlyHistoryChart.tsx` | Usar taxas reais no historico mensal |
| `src/components/financial/ProfitabilityCalculator.tsx` | Adicionar selecao de marketplace e comparativo |
| `src/integrations/supabase/types.ts` | Adicionar tipagem da nova tabela |

### Migracao SQL

```text
1. Criar tabela marketplace_fee_profiles
2. Habilitar RLS com policies por organizacao
3. Criar funcao trigger para seed automatico ao criar organizacao
4. Manter tabela user_financial_settings para config global (regime tributario padrao)
```

### Regimes Tributarios Brasileiros (presets)

- **MEI**: 0% (DAS fixo mensal, nao incide por venda)
- **Simples Nacional**: 4-19% (faixa baseada no faturamento)
- **Lucro Presumido**: ~11.33% (IRPJ + CSLL + PIS + COFINS)
- **Isento**: 0%

O usuario seleciona o regime e a aliquota efetiva e sugerida, podendo ajustar manualmente.

