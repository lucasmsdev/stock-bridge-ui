
# Plano: Correção de Redirecionamento + Ads Dashboard Dinâmico

## Visão Geral

Este plano resolve dois problemas:
1. **Problema de redirecionamento**: Após conectar o Meta Ads, você está sendo redirecionado para a home ao invés de `/app/integrations`
2. **Dashboard dinâmico**: Transformar a aba de Ads para exibir dados reais do Meta Ads conectado

---

## Problema 1: Correção do Redirecionamento

### Diagnóstico
A Edge Function `meta-ads-auth` usa a variável `APP_URL` que pode estar configurada incorretamente. Os logs mostram que a conexão foi bem-sucedida, mas o redirect não está funcionando.

### Solução
Atualizar a Edge Function para usar a URL correta diretamente e de forma mais robusta:

```typescript
// Detectar a URL de origem ou usar fallback
const appUrl = Deno.env.get('APP_URL') || 'https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app';
const redirectUrl = `${appUrl}/app/integrations`;
```

**Arquivo**: `supabase/functions/meta-ads-auth/index.ts`

---

## Problema 2: Dashboard de Ads Dinâmico

### Nova Tabela: `ad_metrics`

Criar tabela para armazenar métricas de campanhas:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | Primary key |
| user_id | uuid | FK para profiles |
| organization_id | uuid | FK para organizations |
| integration_id | uuid | FK para integrations |
| platform | text | 'meta_ads' ou 'google_ads' |
| campaign_id | text | ID da campanha |
| campaign_name | text | Nome da campanha |
| date | date | Data da métrica |
| spend | numeric | Gasto em R$ |
| impressions | integer | Impressões |
| clicks | integer | Cliques |
| conversions | integer | Conversões |
| conversion_value | numeric | Valor das conversões |
| created_at | timestamptz | Data criação |

### Nova Edge Function: `sync-meta-ads`

Buscar dados da Marketing API do Meta:

```typescript
// Endpoint utilizado
GET https://graph.facebook.com/v21.0/act_{ad_account_id}/insights
?fields=campaign_id,campaign_name,spend,impressions,clicks,actions
&time_range={"since":"2025-01-01","until":"2025-01-31"}
&level=campaign
&time_increment=1  // daily breakdown
```

A função irá:
1. Descriptografar o token do Meta salvo na integração
2. Chamar a API do Meta para cada Ad Account
3. Salvar/atualizar métricas na tabela `ad_metrics`

### Modificações no AdsDashboard

1. **Verificar conexão** - Checar se existe integração `meta_ads` ativa
2. **Buscar dados reais** - Consumir da tabela `ad_metrics`
3. **Fallback para mock** - Mostrar dados demo se não houver conexão
4. **Indicador visual** - Badge indicando se são dados reais ou demo

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/meta-ads-auth/index.ts` | Modificar | Corrigir URL de redirect |
| `supabase/functions/sync-meta-ads/index.ts` | Criar | Sincronizar métricas do Meta |
| `supabase/config.toml` | Modificar | Adicionar nova função |
| `src/components/ads/AdsDashboard.tsx` | Modificar | Buscar dados reais |
| `src/components/ads/useMetaAdsData.ts` | Criar | Hook para carregar dados |
| `src/components/ads/AdsConnectionBanner.tsx` | Criar | Banner de status da conexão |
| Nova migration | Criar | Tabela `ad_metrics` |

---

## Estrutura do Dashboard Dinâmico

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ADS DASHBOARD                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ✅ Conectado: Lucas Machado (Meta Ads)          [Sincronizar] [⟳ 2h]   ││
│  │    4 contas de anúncio disponíveis                                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  [Filtros: Meta Ads ▼] [Google Ads ▼] [Período: 30 dias ▼]                 │
│                                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │ Gasto Total  │ │ Impressões   │ │ Cliques      │ │ ROAS         │      │
│  │ R$ 8.120,00  │ │ 356.380      │ │ 6.190        │ │ 3.2x         │      │
│  │ Dados reais  │ │              │ │              │ │              │      │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                                             │
│  ... resto do dashboard com dados reais ...                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API do Meta - Campos Utilizados

```typescript
interface MetaInsight {
  campaign_id: string;
  campaign_name: string;
  spend: string;       // "123.45"
  impressions: string; // "12345"
  clicks: string;      // "234"
  actions: Array<{
    action_type: string; // "purchase", "lead", etc.
    value: string;
  }>;
  date_start: string;
  date_stop: string;
}
```

---

## Fluxo de Sincronização

```text
1. Usuário acessa Dashboard > Ads
2. Sistema verifica integração meta_ads ativa
3. Se conectado:
   a. Busca dados da tabela ad_metrics
   b. Se dados antigos (>1h), oferece "Sincronizar"
4. Se não conectado:
   a. Mostra banner "Conecte sua conta"
   b. Exibe dados de demonstração
5. Botão "Sincronizar" chama sync-meta-ads
6. Função busca últimos 30 dias da API Meta
7. Salva/atualiza tabela ad_metrics
8. Dashboard atualiza automaticamente
```

---

## Permissões e RLS

Para a tabela `ad_metrics`:
- SELECT: Apenas owner pode ver seus próprios dados
- INSERT/UPDATE/DELETE: Apenas via service_role (Edge Functions)

```sql
-- Usuário só vê suas próprias métricas
CREATE POLICY "Users view own ad_metrics"
  ON ad_metrics FOR SELECT
  USING (user_id = auth.uid());
```

---

## Sequência de Implementação

1. **Corrigir redirect** na Edge Function meta-ads-auth
2. **Criar tabela** ad_metrics via migration
3. **Criar Edge Function** sync-meta-ads
4. **Criar hook** useMetaAdsData para carregar dados
5. **Criar banner** AdsConnectionBanner
6. **Modificar AdsDashboard** para usar dados reais
7. **Testar fluxo completo**

---

## Resultado Esperado

Após implementação:
- Redirecionamento correto após conexão OAuth
- Dashboard mostra dados reais da sua conta Meta Ads
- Botão para sincronizar métricas manualmente
- Indicação clara de quando são dados reais vs demo
- Base pronta para adicionar Google Ads no futuro
