
# Plano: Dashboard de Ads (Meta + Google) - Aba Estática

## Visão Geral

Criar uma segunda aba no Dashboard existente chamada "Ads" que exibe dados estáticos de campanhas do Meta Ads e Google Ads. Essa aba permitirá visualizar métricas de anúncios com filtros por plataforma, servindo como preview do sistema antes da integração real.

---

## Estrutura Visual

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                                                    │
│  ┌─────────────┬─────────────┐                                               │
│  │   Vendas    │    Ads      │  ← Tabs de navegação                         │
│  └─────────────┴─────────────┘                                               │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  ABA: ADS                                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ FILTROS: [ Meta Ads ▼ ] [ Google Ads ▼ ] [ Todos ● ]  [ Período ▼ ]    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐│
│  │ Gasto Total    │ │ Impressões     │ │ Cliques        │ │ CTR Médio      ││
│  │ R$ 12.450,00   │ │ 524.380        │ │ 8.234          │ │ 1.57%          ││
│  │ +12% vs mês    │ │ +8% vs mês     │ │ +15% vs mês    │ │ +0.2% vs mês   ││
│  └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘│
│                                                                              │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐│
│  │ Conversões     │ │ CPC Médio      │ │ Custo/Conv     │ │ ROAS           ││
│  │ 847            │ │ R$ 1,51        │ │ R$ 14,70       │ │ 3.2x           ││
│  │ +23% vs mês    │ │ -5% vs mês     │ │ -8% vs mês     │ │ +0.4x vs mês   ││
│  └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘│
│                                                                              │
│  ┌───────────────────────────────────┬───────────────────────────────────┐  │
│  │ GRÁFICO: Gasto x Conversões      │ GRÁFICO: Performance por Plataforma│  │
│  │ (Linha - últimos 30 dias)        │ (Pizza - Meta vs Google)          │  │
│  │                                   │                                   │  │
│  │   📈 Gasto ─── Conversões        │     🥧 Meta Ads: 65%              │  │
│  │                                   │        Google Ads: 35%            │  │
│  └───────────────────────────────────┴───────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ TABELA: Performance por Campanha                                        │ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │ Plataforma │ Campanha           │ Gasto   │ Impr.   │ Cliques │ ROAS   │ │
│  │ Meta       │ Black Friday 2025  │ R$3.200 │ 142.000 │ 2.840   │ 4.2x   │ │
│  │ Meta       │ Remarketing Site   │ R$2.100 │ 89.000  │ 1.780   │ 3.8x   │ │
│  │ Google     │ Search - Produtos  │ R$4.500 │ 186.000 │ 2.790   │ 2.9x   │ │
│  │ Google     │ Display - Marca    │ R$1.800 │ 72.000  │ 576     │ 2.1x   │ │
│  │ Meta       │ Stories Verão      │ R$850   │ 35.380  │ 248     │ 1.8x   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Dados Estáticos (Mock Data)

### Campanhas Meta Ads
| Campanha | Gasto | Impressões | Cliques | CTR | Conversões | ROAS |
|----------|-------|------------|---------|-----|------------|------|
| Black Friday 2025 | R$ 3.200 | 142.000 | 2.840 | 2.0% | 284 | 4.2x |
| Remarketing Site | R$ 2.100 | 89.000 | 1.780 | 2.0% | 178 | 3.8x |
| Stories Verão | R$ 850 | 35.380 | 248 | 0.7% | 42 | 1.8x |
| Feed Produtos | R$ 1.450 | 62.000 | 930 | 1.5% | 93 | 2.4x |
| Lookalike Clientes | R$ 520 | 28.000 | 392 | 1.4% | 47 | 3.1x |

### Campanhas Google Ads
| Campanha | Gasto | Impressões | Cliques | CTR | Conversões | ROAS |
|----------|-------|------------|---------|-----|------------|------|
| Search - Produtos | R$ 4.500 | 186.000 | 2.790 | 1.5% | 223 | 2.9x |
| Display - Marca | R$ 1.800 | 72.000 | 576 | 0.8% | 46 | 2.1x |
| Shopping Feed | R$ 980 | 45.000 | 675 | 1.5% | 68 | 3.5x |
| Performance Max | R$ 650 | 31.000 | 372 | 1.2% | 45 | 2.8x |

### Evolução Diária (últimos 30 dias)
Dados simulados com variação realista para gráfico de linha.

---

## Componentes a Criar

### 1. `AdsFilters.tsx`
Filtros para a aba de Ads:
- Toggle entre plataformas (Meta, Google, Todos)
- Seletor de período (7 dias, 30 dias, 90 dias)
- Filtro por campanha específica

### 2. `AdsMetricsCards.tsx`
Grid de 8 cards com métricas consolidadas:
- Gasto Total
- Impressões
- Cliques
- CTR Médio
- Conversões
- CPC Médio
- Custo por Conversão
- ROAS

### 3. `AdsPerformanceChart.tsx`
Gráfico de linha dupla:
- Eixo Y1: Gasto (R$)
- Eixo Y2: Conversões
- Eixo X: Dias

### 4. `AdsPlatformBreakdown.tsx`
Gráfico de rosca (donut):
- Distribuição de gasto por plataforma
- Cores: Meta (azul Facebook), Google (verde/vermelho/amarelo)

### 5. `CampaignPerformanceTable.tsx`
Tabela com todas as campanhas:
- Colunas: Plataforma, Campanha, Gasto, Impressões, Cliques, CTR, Conversões, ROAS
- Ordenação por qualquer coluna
- Badge de performance (bom/médio/ruim)

### 6. `mockAdsData.ts`
Arquivo com todos os dados estáticos mockados.

---

## Modificações em Arquivos Existentes

### `src/pages/Dashboard.tsx`
Transformar em estrutura com Tabs:
- Tab "Vendas" → conteúdo atual
- Tab "Ads" → novo conteúdo de métricas de anúncios

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/ads/mockAdsData.ts` | Criar | Dados estáticos de campanhas |
| `src/components/ads/AdsFilters.tsx` | Criar | Filtros de plataforma e período |
| `src/components/ads/AdsMetricsCards.tsx` | Criar | Cards de métricas consolidadas |
| `src/components/ads/AdsPerformanceChart.tsx` | Criar | Gráfico gasto x conversões |
| `src/components/ads/AdsPlatformBreakdown.tsx` | Criar | Gráfico distribuição por plataforma |
| `src/components/ads/CampaignPerformanceTable.tsx` | Criar | Tabela de campanhas |
| `src/components/ads/AdsDashboard.tsx` | Criar | Componente principal da aba Ads |
| `src/pages/Dashboard.tsx` | Modificar | Adicionar sistema de Tabs |

---

## Detalhes Técnicos

### Estrutura do Dashboard com Tabs

```typescript
<Tabs defaultValue="vendas">
  <TabsList>
    <TabsTrigger value="vendas">
      <DollarSign className="h-4 w-4 mr-2" />
      Vendas
    </TabsTrigger>
    <TabsTrigger value="ads">
      <Megaphone className="h-4 w-4 mr-2" />
      Ads
    </TabsTrigger>
  </TabsList>
  
  <TabsContent value="vendas">
    {/* Conteúdo atual do Dashboard */}
  </TabsContent>
  
  <TabsContent value="ads">
    <AdsDashboard />
  </TabsContent>
</Tabs>
```

### Ícones e Logos
- Meta Ads: Logo do Facebook/Meta
- Google Ads: Logo do Google
- Usar cores oficiais das plataformas

### Responsividade
- Cards em grid 4 colunas (desktop) → 2 colunas (tablet) → 1 coluna (mobile)
- Tabela com scroll horizontal em telas pequenas
- Gráficos adaptáveis

---

## Indicadores de Status das Campanhas

| ROAS | Status | Cor |
|------|--------|-----|
| ≥ 3.0x | Excelente | Verde |
| 2.0x - 2.9x | Bom | Azul |
| 1.0x - 1.9x | Atenção | Amarelo |
| < 1.0x | Crítico | Vermelho |

---

## Sequência de Implementação

1. **Criar dados mockados** (`mockAdsData.ts`)
2. **Criar componente de filtros** (`AdsFilters.tsx`)
3. **Criar cards de métricas** (`AdsMetricsCards.tsx`)
4. **Criar gráficos** (`AdsPerformanceChart.tsx`, `AdsPlatformBreakdown.tsx`)
5. **Criar tabela de campanhas** (`CampaignPerformanceTable.tsx`)
6. **Criar componente principal** (`AdsDashboard.tsx`)
7. **Modificar Dashboard.tsx** para adicionar Tabs
8. **Testar filtros e responsividade**

---

## Resultado Esperado

Após implementação:
- Dashboard terá duas abas: "Vendas" e "Ads"
- Aba Ads exibirá métricas estáticas de Meta e Google Ads
- Filtros funcionais para alternar entre plataformas
- Visualização clara de performance por campanha
- Base pronta para integração real futura
