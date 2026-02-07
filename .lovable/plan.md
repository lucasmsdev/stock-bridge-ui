
# Uni AI Proativa - Insights Automaticos no Dashboard

## Resumo

Criar um sistema onde a Uni AI analisa automaticamente os dados do usuario e gera insights proativos que aparecem diretamente no Dashboard, sem o usuario precisar abrir o chat e perguntar. A Uni identifica oportunidades, problemas e recomendacoes acionaveis baseadas nos dados reais do negocio.

---

## O que muda para o usuario

Ao abrir o Dashboard, o usuario vera um card "Insights da Uni" com ate 3 recomendacoes estrategicas geradas automaticamente pela IA. Exemplos:

- "Seu produto **Capa iPhone 15** vai esgotar em 5 dias e a demanda esta em alta. Recomendo repor 200 unidades agora."
- "Margem do **Kit Pelicula + Capa** esta em 8% - abaixo do minimo saudavel. Considere reajustar o preco de R$ 29,90 para R$ 34,90."
- "Voce nao vende na Amazon. Seus 3 produtos mais vendidos no Mercado Livre tem demanda la. Potencial de +R$ 2.400/mes."

Os insights sao renovados automaticamente a cada 12 horas e podem ser atualizados manualmente.

---

## Como funciona

1. **Edge Function `generate-ai-insights`**: Roda sob demanda (quando o Dashboard carrega e o cache esta expirado). Analisa produtos, pedidos, despesas e gera insights via Perplexity API usando tool calling para retornar JSON estruturado.

2. **Tabela `ai_insights`**: Armazena os insights gerados com TTL de 12 horas. Evita chamadas desnecessarias a API.

3. **Componente `ProactiveInsightsCard`**: Card no Dashboard que exibe os insights com icones de urgencia, acoes sugeridas e link para discutir com a Uni no chat.

4. **Integracao com Notificacoes**: Insights criticos (estoque esgotando, margem negativa) tambem criam notificacoes automaticas que aparecem no sino de notificacoes.

---

## Detalhes tecnicos

### 1. Nova tabela `ai_insights`

```text
ai_insights
- id (uuid, PK)
- organization_id (uuid, FK organizations)
- user_id (uuid, FK auth.users)
- insights (jsonb) - array de insights estruturados
- generated_at (timestamptz)
- expires_at (timestamptz) - generated_at + 12h
- created_at (timestamptz)
```

Cada insight no array jsonb tera:
```text
{
  type: "stock_critical" | "low_margin" | "expansion_opportunity" | "trend_alert" | "cost_optimization",
  severity: "critical" | "warning" | "opportunity",
  title: string,
  description: string,
  action: string,
  metric: string (ex: "5 dias", "R$ 2.400/mes", "8%"),
  relatedProductId: string | null
}
```

### 2. Edge Function `generate-ai-insights`

- Busca dados do usuario (produtos com margem, velocidade de vendas, estoque, despesas, pedidos recentes)
- Usa Perplexity API com **tool calling** para retornar um JSON estruturado com ate 5 insights
- Regras de analise no prompt do sistema:
  - Produtos com menos de 7 dias de estoque em demanda alta = critico
  - Margem abaixo de 10% = warning
  - Produtos vendendo bem em 1 plataforma mas ausentes em outras = oportunidade
  - Tendencia de queda de vendas mes a mes = alerta
  - Despesas fixas crescendo mais rapido que receita = otimizacao
- Salva os insights na tabela `ai_insights` com TTL de 12 horas
- Cria notificacoes para insights criticos (apenas 1x por dia por tipo)

### 3. Componente `ProactiveInsightsCard`

- Renderizado no Dashboard abaixo dos cards de metricas
- Ao montar, verifica se ha insights validos (nao expirados) na tabela
- Se nao houver ou estiverem expirados, chama a Edge Function para gerar novos
- Exibe ate 3 insights com:
  - Icone de severidade (vermelho critico, amarelo warning, verde oportunidade)
  - Titulo e descricao curta
  - Metrica em destaque
  - Botao "Discutir com Uni" que abre o chat com a pergunta pre-preenchida
  - Botao "Atualizar insights" para forcar nova geracao
- Loading state com skeleton durante geracao
- Requer feature AI_ASSISTANT para exibir

### 4. Fluxo de dados

```text
Dashboard carrega
    |
    v
Verifica ai_insights (expires_at > now)
    |
   [cache valido?]
    |         |
   SIM       NAO
    |         |
    v         v
  Exibe    Chama generate-ai-insights
           (Edge Function)
              |
              v
           Busca dados do usuario (produtos, pedidos, despesas)
              |
              v
           Envia para Perplexity API com tool calling
              |
              v
           Recebe JSON estruturado com insights
              |
              v
           Salva na tabela ai_insights
           Cria notificacoes para insights criticos
              |
              v
           Retorna para o frontend
              |
              v
           Exibe no card do Dashboard
```

### 5. Arquivos criados/modificados

**Novos:**
- `supabase/functions/generate-ai-insights/index.ts` - Edge Function para gerar insights
- `src/components/dashboard/ProactiveInsightsCard.tsx` - Card de insights no Dashboard

**Modificados:**
- `src/pages/Dashboard.tsx` - Adicionar o ProactiveInsightsCard
- Migration SQL para criar tabela `ai_insights` com RLS

### 6. Controle de custos

- Cache de 12 horas na tabela evita chamadas excessivas a API
- Maximo de 2 geracoes por dia por organizacao (verificado no backend)
- Usa modelo `sonar` (mais barato) ao inves do `sonar-pro`
- Resposta limitada a 5 insights com max_tokens baixo
- Apenas usuarios com feature AI_ASSISTANT veem o card

### 7. Seguranca

- RLS na tabela `ai_insights`: usuarios so veem insights da propria organizacao
- Edge Function valida JWT e verifica plano/quota antes de gerar
- Dados sensiveis nunca expostos nos insights (apenas recomendacoes)
