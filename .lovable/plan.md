
# ROI no Dashboard + Novas Automacoes

## Parte 1: Mover ROI de Produtos para dentro do Dashboard

### O que muda

O conteudo da pagina "ROI de Produtos" sera integrado como uma terceira aba no Dashboard, ao lado de "Vendas" e "Ads". A pagina separada `/app/product-roi` sera removida, assim como o item no menu lateral.

### Resultado visual

O Dashboard tera 3 abas:
```text
[Vendas] [Ads] [ROI]
```

Ao clicar em "ROI", o usuario ve os cards de resumo (Receita Atribuida, Gasto Ads, ROAS Medio, Produtos Lucrativos) e a tabela completa de ROI por produto - tudo sem sair do Dashboard.

### Detalhes tecnicos

**Arquivos modificados:**

1. **`src/pages/Dashboard.tsx`**
   - Importar o hook `useProductROI` e os componentes necessarios (Table, Search, etc.)
   - Adicionar terceira aba "ROI" no TabsList: `grid-cols-3` ao inves de `grid-cols-2`
   - Dentro de `TabsContent value="roi"`, renderizar o conteudo do ProductROI (cards de resumo + tabela com busca e ordenacao)
   - Mover a logica de sorting/filtering/rendering para dentro do Dashboard ou extrair para um componente `ProductROITab`

2. **`src/components/dashboard/ProductROITab.tsx`** (novo)
   - Componente extraido com todo o conteudo da pagina ProductROI (summary cards, tabela, busca, sorting)
   - Reutiliza o hook `useProductROI` existente
   - Remove o header proprio (titulo e descricao) ja que esta dentro do Dashboard
   - Mantem funcionalidade completa: busca por nome/SKU, ordenacao interativa, badges de status

3. **`src/pages/ProductROI.tsx`** - Removido
4. **`src/components/layout/AppSidebar.tsx`** - Remover item "ROI de Produtos" do `navItems`
5. **`src/App.tsx`** - Remover rota `/app/product-roi` e redirecionar para `/app/dashboard` para compatibilidade

---

## Parte 2: Novas Automacoes

### Automacoes adicionadas

Duas novas automacoes que utilizam dados ja existentes no banco:

**4. Pedido sem rastreio (48h+)**
- Toggle: Ativo/Inativo
- Campo: "Alertar apos quantas horas sem rastreio" (padrao: 48)
- Verifica pedidos com status de envio mas sem `tracking_code` preenchido apos X horas
- Gera notificacao com nome do pedido e marketplace
- Ajuda a evitar penalizacoes nos marketplaces por atraso de envio

**5. Produto sem venda (X dias)**
- Toggle: Ativo/Inativo
- Campo: "Alertar quando produto ficar sem venda por ___ dias" (padrao: 30)
- Verifica a ultima venda de cada produto na tabela `orders`/`order_items`
- Se um produto com estoque > 0 nao vende ha X dias, gera notificacao
- Ajuda a identificar produtos encalhados que ocupam espaco e capital

### Detalhes tecnicos

**Arquivos modificados:**

1. **`src/pages/Automations.tsx`**
   - Adicionar 2 novos items ao array `RULE_TYPES`:
     - `stale_tracking`: icone `PackageSearch`, cor `border-l-blue-500`, config `{ hours: 48 }`
     - `no_sales_alert`: icone `ShoppingCart`, cor `border-l-purple-500`, config `{ days: 30 }`
   - Ajustar grid para `lg:grid-cols-3` (ja comporta 5 cards em 2 linhas)
   - Adicionar labels no `ACTION_LABELS`

2. **`supabase/functions/process-automations/index.ts`**
   - Adicionar processamento para `stale_tracking`:
     - Query: pedidos com `status = 'shipped'` ou `'processing'` onde `tracking_code` e null/vazio e `order_date` e mais antigo que X horas
     - Gerar notificacao por pedido encontrado
   - Adicionar processamento para `no_sales_alert`:
     - Query: para cada produto com `stock > 0`, verificar se ha pedidos nos ultimos X dias
     - Produtos sem vendas recentes geram notificacao
     - Deduplicacao de 7 dias (ao inves de 24h) para evitar spam

3. **Migracao de banco**
   - Nao e necessaria: a tabela `automation_rules` ja suporta novos `rule_type` via texto livre e `config` via JSONB. Os defaults serao criados automaticamente pelo `useEffect` no frontend quando os novos tipos forem adicionados ao array.

### Fluxo de criacao dos defaults

Quando o usuario acessa a pagina de Automacoes, o `useEffect` existente verifica se ha regras para cada tipo no array `RULE_TYPES`. Se faltam regras (ex: os 2 novos tipos), insere automaticamente como inativas com configuracao padrao. Isso garante que usuarios existentes vejam os novos cards sem precisar de migracao.

### Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/dashboard/ProductROITab.tsx` | Criar (componente extraido) |
| `src/pages/Dashboard.tsx` | Modificar (adicionar aba ROI) |
| `src/pages/ProductROI.tsx` | Remover |
| `src/components/layout/AppSidebar.tsx` | Modificar (remover item ROI) |
| `src/App.tsx` | Modificar (remover rota, adicionar redirect) |
| `src/pages/Automations.tsx` | Modificar (2 novas automacoes) |
| `supabase/functions/process-automations/index.ts` | Modificar (processar novas regras) |
