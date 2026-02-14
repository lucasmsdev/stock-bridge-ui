
# Auditoria Completa: O que falta para ficar 100%

## Dashboard (/app/dashboard)

### Problemas encontrados:
1. **Tendencias hardcoded** - Os cards de metricas mostram "+0%" em todas as tendencias. Nao estao sendo calculadas com base nos dados reais (comparacao com periodo anterior)
2. **Filtro de marketplace incompleto** - So tem ML, Shopee, Amazon, Shopify. Faltam **Magalu** e **TikTok Shop** nas opcoes de filtro
3. **Ads Dashboard - Shopee nao aparece** - Conforme voce ja reportou, Shopee e outros cards so aparecem com integracao ativa

### O que ja funciona:
- 3 abas (Vendas, Ads, ROI)
- Calculo de lucro liquido com taxas reais por marketplace
- Grafico de evolucao mensal
- Estoque critico
- Insights proativos da Uni AI

---

## Produtos (/app/products)

### Problemas encontrados:
1. **Magalu e TikTok Shop ausentes** - `platformNames` e `platformLogos` nao incluem Magalu nem TikTok Shop (linhas 91-103). Produtos importados dessas plataformas aparecem sem logo
2. **Filtro por canal nao funciona** - O codigo tem um comentario explicito: "For now, we don't filter by channel" (linha 506-508). O filtro de canal existe na UI mas nao filtra nada
3. **"Deletar Selecionados" sem funcao** - O botao de deletar em massa (linha 726) nao tem `onClick` - nao faz nada quando clicado
4. **Importacao nao inclui Magalu/TikTok Shop** - A query de integracoes filtra apenas `["mercadolivre", "shopify", "shopee", "amazon"]` (linha 102)

### O que ja funciona:
- Catalogo com busca
- Importacao de produtos (ML, Shopify, Amazon)
- Criacao multi-plataforma
- Edicao inline e em massa
- Previsao de estoque (AI)
- Detalhes do produto com sync bidirecional

---

## Pedidos (/app/orders)

### Problemas encontrados:
1. **Canais incompletos** - So lista ML, Shopify e Amazon no filtro (linha 54). Faltam **Shopee, Magalu e TikTok Shop**
2. **Sem detalhes do pedido** - Clicar em um pedido nao faz nada. Nao existe pagina de detalhes do pedido
3. **Sem paginacao** - Se o usuario tiver centenas de pedidos, todos carregam de uma vez
4. **Logos incompletas** - `platformLogos` nao inclui Magalu e TikTok Shop (linhas 57-63)

### O que ja funciona:
- Listagem com filtros por canal e status
- Sincronizacao de pedidos dos marketplaces
- Exportacao CSV
- Cards de resumo reativos aos filtros

---

## Centro de Custos (/app/expenses)

### Status: Praticamente completo
- Registro de despesas
- Visao geral com graficos
- Historico mensal
- Projecao de lucros
- Configuracoes de taxas por marketplace

### Melhoria possivel:
1. **Falta Magalu e TikTok Shop nos fee profiles** - A funcao `seed_marketplace_fee_profiles` ja inclui esses marketplaces, mas e bom verificar se a UI de configuracoes tambem os mostra

---

## Financeiro (/app/finance)

### Problemas encontrados:
1. **Relatorios Avancados e placeholder** - A aba "Relatorios Avancados" mostra "em desenvolvimento" com dois cards vazios (linhas 378-401). Nao tem funcionalidade real
2. **Sem tabela de margens por produto** - A pagina so tem a calculadora manual. Nao mostra uma visao automatica das margens de todos os produtos cadastrados

### O que ja funciona:
- Calculadora de precificacao com preco ideal
- Simulacao com preco personalizado
- Detalhamento de custos

---

## Integracoes (/app/integrations)

### Problemas encontrados:
1. **Shopee sem fluxo de conexao** - Nao existe handler para `platformId === "shopee"` na funcao `handleConnect`. Clicar em "Conectar" na Shopee nao faz nada
2. **TikTok Shop Sandbox** - A integracao depende de aprovacao do TikTok, o que pode bloquear usuarios reais

### O que ja funciona:
- Mercado Livre (OAuth completo)
- Shopify (OAuth completo)
- Amazon (Self-auth)
- Magalu (OAuth completo)
- TikTok Shop (OAuth)
- Meta Ads, Google Ads, TikTok Ads

---

## Rastreio (/app/tracking)

### Status: Completo
- Tabela de rastreios com timeline expansivel
- Sincronizacao de codigos de rastreio
- Filtros por plataforma e status
- Cards de resumo

---

## Resumo das Correcoes Necessarias

### Prioridade Alta (funcionalidades quebradas):
1. Adicionar Magalu e TikTok Shop em `platformNames`/`platformLogos` de Produtos e Pedidos
2. Fazer o filtro por canal funcionar em Produtos
3. Adicionar Magalu, TikTok Shop e Shopee nos filtros de Pedidos e Dashboard
4. Implementar o handler de conexao da Shopee nas Integracoes
5. Implementar `onClick` no botao "Deletar Selecionados" em massa

### Prioridade Media (melhorias importantes):
6. Calcular tendencias reais nos cards do Dashboard (vs periodo anterior)
7. Adicionar paginacao na tabela de Pedidos
8. Incluir Magalu e TikTok Shop na query de importacao de produtos

### Prioridade Baixa (nice to have):
9. Criar pagina de detalhes do pedido
10. Implementar conteudo real na aba "Relatorios Avancados" do Financeiro
11. Adicionar tabela automatica de margens por produto no Financeiro

---

## Detalhes Tecnicos

### Arquivos que precisam de alteracao:

| Arquivo | Correcao |
|---------|----------|
| `src/pages/Products.tsx` | Adicionar Magalu/TikTok Shop em platformNames e platformLogos; implementar filtro por canal; implementar delete em massa; incluir magalu/tiktokshop na query de integracoes |
| `src/pages/Orders.tsx` | Adicionar Magalu/TikTok Shop/Shopee em channels e platformLogos |
| `src/pages/Dashboard.tsx` | Adicionar Magalu/TikTok Shop no filtro de marketplace; calcular tendencias reais |
| `src/components/dashboard/DashboardFilters.tsx` | Adicionar opcoes de filtro para Magalu e TikTok Shop |
| `src/pages/Integrations.tsx` | Adicionar handler de conexao para Shopee |
| `src/pages/Finance.tsx` | (Opcional) Implementar conteudo na aba Relatorios Avancados |

