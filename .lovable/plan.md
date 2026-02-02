
# Plano: Cruzamento de Dados entre Vendas e Anúncios

## Status: Em Implementação ✅

### Fases Concluídas:
- [x] **Fase 1**: Estrutura de Dados (tabelas `campaign_product_links`, `attributed_conversions`, view `product_roi_metrics`)
- [x] **Fase 3 (parcial)**: Edge Function `attribute-conversions` criada e deployada
- [x] **Fase 4 (parcial)**: Página ProductROI.tsx, hooks useProductROI e useCampaignLinks
- [x] **Fase 5 (parcial)**: Modal CampaignLinkDialog para vincular campanhas a produtos
- [x] Componente ProductAdsPerformance adicionado à página de detalhes do produto

---

```text
+------------------+         +------------------+
|   VENDAS (orders)|         |  ADS (ad_metrics)|
+------------------+         +------------------+
| - SKU/items      |    ?    | - campaign_id    |
| - platform       | <-----> | - spend          |
| - total_value    |  NENHUM | - conversions    |
| - order_date     |  LINK   | - date           |
+------------------+         +------------------+
```

Atualmente não há conexão entre os dados de vendas dos marketplaces e os gastos com anúncios. As plataformas de ads reportam "conversões" genéricas, mas não sabemos:
- Quais SKUs venderam por causa dos anúncios
- Qual o custo de aquisição real por produto
- Qual o ROI verdadeiro de cada campanha

---

## Solução Proposta

### Fase 1: Estrutura de Dados

#### 1.1 Nova Tabela: `campaign_product_links`
Vincula campanhas de anúncios a produtos específicos.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | Chave primária |
| campaign_id | text | ID da campanha (Meta/Google) |
| platform | text | meta_ads, google_ads, etc. |
| product_id | uuid | FK para products |
| sku | text | SKU do produto anunciado |
| link_type | text | 'manual', 'auto_detected', 'utm' |
| created_at | timestamp | Data de criação |

#### 1.2 Nova Tabela: `attributed_conversions`
Registra conversões atribuídas a campanhas específicas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | Chave primária |
| order_id | uuid | FK para orders |
| campaign_id | text | ID da campanha atribuída |
| product_id | uuid | FK para products |
| sku | text | SKU do item vendido |
| attributed_spend | decimal | Gasto proporcional atribuído |
| order_value | decimal | Valor do item vendido |
| attributed_at | timestamp | Data da atribuição |
| attribution_method | text | 'time_window', 'manual', 'utm' |

#### 1.3 Extensão da Tabela: `products`
Adicionar campo para rastreamento de campanhas.

| Novo Campo | Tipo | Descrição |
|------------|------|-----------|
| active_campaign_ids | jsonb | Lista de campaign_ids ativos |
| total_attributed_spend | decimal | Soma de gastos atribuídos |
| total_attributed_revenue | decimal | Receita atribuída a ads |

---

### Fase 2: Lógica de Atribuição

#### 2.1 Modelo de Atribuição por Janela de Tempo

```text
    Campanha Ativa (7 dias)
    ┌────────────────────────────────┐
    │  Gasto: R$ 500                 │
    │  Período: 01/02 - 07/02        │
    └────────────────────────────────┘
                 ↓
    Vendas no período (SKUs vinculados)
    ┌────────────────────────────────┐
    │  10 unidades do SKU-123        │
    │  Receita: R$ 2.000             │
    │  Custo por aquisição: R$ 50    │
    │  ROAS: 4.0x                    │
    └────────────────────────────────┘
```

#### 2.2 Regras de Atribuição

1. **Janela de 7 dias**: Vendas até 7 dias após exposição à campanha
2. **Proporcionalidade**: Se múltiplas campanhas ativas, dividir proporcionalmente
3. **Prioridade por plataforma**: Venda no ML = atribuir a campanha ML Ads primeiro
4. **SKU matching**: Vincular campanha → SKU → vendas daquele SKU

---

### Fase 3: Edge Functions

#### 3.1 `attribute-conversions/index.ts`
Processa atribuição de vendas para campanhas.

**Fluxo:**
1. Buscar vendas dos últimos 7 dias
2. Para cada item vendido, verificar campanhas ativas para aquele SKU
3. Calcular gasto proporcional atribuído
4. Inserir em `attributed_conversions`
5. Atualizar métricas agregadas no produto

#### 3.2 `calculate-product-roi/index.ts`
Calcula ROI real por produto considerando todos os custos.

**Fórmula:**
```
ROI Real = (Receita Atribuída - Custo Produto - Gasto Ads Atribuído) / Gasto Ads Atribuído × 100
```

---

### Fase 4: Interface do Usuário

#### 4.1 Nova Página: Análise de ROI por Produto

| Componente | Descrição |
|------------|-----------|
| Tabela de Produtos | SKU, Vendas, Gasto Ads, ROI, ROAS |
| Gráfico de Dispersão | Gasto vs Lucro por produto |
| Filtros | Período, Plataforma, Categoria |
| Cards de Resumo | ROAS médio, Melhor/Pior produto |

#### 4.2 Dashboard de Anúncios Aprimorado

Adicionar ao dashboard existente:
- Card "Vendas Atribuídas" (vendas originadas de ads)
- Card "Custo por Venda Real" (gasto / vendas atribuídas)
- Coluna "Vendas Reais" na tabela de campanhas

#### 4.3 Detalhes do Produto

Adicionar seção no ProductDetails:
- Campanhas vinculadas ao produto
- Histórico de gastos e vendas atribuídas
- Gráfico de performance (ads vs vendas)

---

### Fase 5: Vinculação de Campanhas

#### 5.1 Vinculação Manual
Interface para o usuário conectar campanhas a produtos:
- Dropdown de campanhas ativas
- Seleção múltipla de SKUs
- Período de vigência

#### 5.2 Detecção Automática (Futura)
- Análise de nome de campanha vs nome do produto
- Tracking UTM quando disponível
- Machine learning para correlação temporal

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/xxx_campaign_product_links.sql` | Migração para novas tabelas |
| `supabase/functions/attribute-conversions/index.ts` | Edge function de atribuição |
| `supabase/functions/calculate-product-roi/index.ts` | Edge function de cálculo ROI |
| `src/pages/ProductROI.tsx` | Nova página de análise de ROI |
| `src/components/products/CampaignLinkDialog.tsx` | Modal para vincular campanhas |
| `src/components/products/ProductAdsPerformance.tsx` | Seção de performance nos detalhes |
| `src/hooks/useProductROI.tsx` | Hook para dados de ROI |
| `src/hooks/useCampaignLinks.tsx` | Hook para gerenciar vínculos |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ProductDetails.tsx` | Adicionar seção de performance de ads |
| `src/components/ads/AdsDashboard.tsx` | Adicionar métricas de vendas atribuídas |
| `src/components/ads/CampaignPerformanceTable.tsx` | Coluna de vendas reais |
| `src/integrations/supabase/types.ts` | Novos tipos para tabelas |
| `src/App.tsx` | Rota para página de ROI |
| `src/components/layout/AppSidebar.tsx` | Link para análise de ROI |

---

## Modelo de Dados Completo

```text
+-------------+       +----------------------+       +-------------+
|  products   |<------|campaign_product_links|------>| ad_metrics  |
+-------------+       +----------------------+       +-------------+
| id          |       | product_id           |       | campaign_id |
| sku         |       | sku                  |       | spend       |
| name        |       | campaign_id          |       | conversions |
+-------------+       | platform             |       +-------------+
      |               +----------------------+              |
      |                         |                           |
      v                         v                           v
+-------------+       +----------------------+
|   orders    |<------| attributed_conversions|
+-------------+       +----------------------+
| id          |       | order_id             |
| items (sku) |       | campaign_id          |
| total_value |       | product_id           |
+-------------+       | attributed_spend     |
                      | order_value          |
                      +----------------------+
```

---

## Resultado Esperado

1. **Visão clara do ROI real** por produto e campanha
2. **Identificação de produtos lucrativos** vs não lucrativos em ads
3. **Otimização de investimento** baseada em dados reais
4. **Relatórios unificados** integrando vendas + custos + ads
5. **Tomada de decisão informada** sobre onde investir em marketing

---

## Cronograma Sugerido

| Fase | Estimativa |
|------|------------|
| Fase 1: Estrutura de Dados | 1-2 dias |
| Fase 2: Lógica de Atribuição | 2-3 dias |
| Fase 3: Edge Functions | 2-3 dias |
| Fase 4: Interface do Usuário | 3-4 dias |
| Fase 5: Vinculação de Campanhas | 2-3 dias |
| **Total** | **10-15 dias** |

---

## Considerações Técnicas

- **RLS**: Todas as novas tabelas terão políticas de isolamento por organização
- **Performance**: Índices em campaign_id, product_id, sku e datas
- **Cron Job**: Atribuição pode rodar diariamente via cron
- **Cache**: Métricas agregadas cacheadas para performance
- **Extensibilidade**: Suporte para Google Ads e TikTok Ads quando integrados
