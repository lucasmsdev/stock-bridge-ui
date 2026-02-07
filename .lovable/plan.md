
# Reorganizar Dados Demo: Centro de Custos + ROI de Produtos

## Resumo

Os dados de demonstracao tem tres problemas principais que vou corrigir:

1. **Despesas com categorias erradas** - As categorias estao como texto livre ("Infraestrutura", "Marketing") em vez dos valores esperados pelo sistema ("fixed", "variable", "operational"). Isso faz o Centro de Custos nao categorizar corretamente as despesas e o grafico de pizza ficar vazio.

2. **ROI de Produtos irrealista** - O gasto atribuido por conversao esta muito baixo (2-8% do orcamento diario), gerando ROAS absurdamente altos (10-40x). Na vida real, um e-commerce pequeno tem ROAS entre 1.5x e 5x.

3. **Falta de variedade no ROI** - Todos os produtos parecem lucrativos. Na realidade, sempre tem produtos que dao prejuizo nos ads, outros neutros e outros excelentes.

---

## O que muda

### 1. Despesas com categorias corretas e mais realistas

**Antes:** Categorias como "Infraestrutura", "Marketing", "Pessoal" (nao reconhecidas pelo sistema)

**Depois:** Cada despesa tera a categoria correta do enum (`fixed`, `variable`, `operational`):

| Despesa | Categoria | Valor |
|---------|-----------|-------|
| Aluguel Escritorio | fixed | R$ 1.800 |
| Contabilidade | fixed | R$ 600 |
| Internet Fibra | fixed | R$ 149 |
| Energia Eletrica | fixed | R$ 280 |
| UniStock Pro | fixed | R$ 197 |
| Funcionario - Operacoes | fixed | R$ 2.200 |
| Funcionario - Atendimento | fixed | R$ 1.800 |
| Google Ads | variable | R$ 1.500 |
| Meta Ads | variable | R$ 800 |
| TikTok Ads | variable | R$ 450 |
| Comissao Indicacao | variable | R$ 300 |
| Embalagens e Materiais | operational | R$ 650 |
| Frete Correios/Transportadora | operational | R$ 1.200 |
| Telefonia/WhatsApp Business | operational | R$ 99 |
| Impressora Etiquetas (manutencao) | operational | R$ 80 |

**Total mensal:** ~R$ 10.105 (realista para e-commerce pequeno/medio faturando R$ 25-35k)

### 2. ROI de Produtos com dados realistas

**Antes:** Gasto atribuido = 2-8% do orcamento diario (muito baixo), ROAS artificialmente alto

**Depois:** Distribuicao realista de performance por produto:

- **~30% dos produtos com campanhas vinculadas terao ROAS excelente** (3x-6x) - sao os "vencedores"
- **~40% terao ROAS bom** (1.5x-3x) - lucrativos mas nao excepcionais
- **~20% terao ROAS neutro** (0.8x-1.2x) - basicamente empatam
- **~10% terao ROAS ruim** (0.3x-0.8x) - dando prejuizo nos ads

O calculo do `attributed_spend` sera proporcional ao `order_value` dividido pelo ROAS-alvo de cada tier, em vez de ser uma fracao minuscula do orcamento diario.

### 3. Mais produtos vinculados a campanhas

**Antes:** Cada campanha vinculada a 2-4 produtos (com sobreposicao), total ~12-15 produtos com dados de ROI

**Depois:** Vincular pelo menos 14-16 dos 20 produtos a campanhas, garantindo que a pagina de ROI mostre uma tabela robusta com variedade de performance.

---

## Detalhes tecnicos

### Arquivo alterado
`supabase/functions/seed-demo-data/index.ts`

### Alteracoes especificas

1. **Array `expenses`** (linhas 80-92): Substituir por novo array com campo `category` usando os valores corretos do enum (`fixed`, `variable`, `operational`) e adicionar mais despesas para cobertura completa dos tres tipos.

2. **Bloco de atribuicao de conversoes** (linhas 509-548): Reescrever a logica para:
   - Atribuir um "tier" de performance a cada produto (excellent, good, neutral, poor)
   - Calcular `attributed_spend` baseado em `order_value / target_roas` do tier
   - Garantir que ~40% dos pedidos tenham atribuicao (vs 35% atual)

3. **Bloco de `campaign_product_links`** (linhas 478-496): Ajustar para distribuir mais produtos entre campanhas, evitando que muitos fiquem de fora.

4. **Deploy automatico** da edge function apos as alteracoes.
