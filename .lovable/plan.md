
# Sistema de Automacoes Configuravel pelo Usuario

## Resumo

Criar uma pagina dedicada de "Automacoes" onde o usuario pode ativar/desativar regras automaticas com toggles simples. Cada automacao tem parametros configurados pelo usuario (ex: limite de estoque, margem minima) e execucao via cron job periodico que verifica as condicoes e gera notificacoes ou executa acoes.

---

## Experiencia do Usuario

O usuario acessa a nova pagina "Automacoes" pelo menu lateral. La encontra cards com 3 automacoes iniciais, cada uma com:

- Um **toggle** para ativar/desativar
- **Campos configurados** pelo usuario (ex: quantidade minima de estoque, margem minima aceitavel)
- **Descricao clara** do que a automacao faz
- **Historico** de quando foi acionada pela ultima vez

### Automacoes disponiveis:

1. **Pausa de anuncio quando estoque zera**
   - Toggle: Ativo/Inativo
   - Quando o estoque de um produto chega a 0, o sistema pausa automaticamente os anuncios nos marketplaces conectados e notifica o usuario
   - Quando o estoque e reposto (acima de 0), o sistema reativa automaticamente

2. **Alerta de reposicao de estoque**
   - Toggle: Ativo/Inativo
   - Campo: "Alertar quando estoque for menor ou igual a ___" (padrao: 10)
   - Gera notificacao quando qualquer produto atinge o limite configurado
   - Diferente do alerta fixo atual (que e sempre <=5), este e personalizado

3. **Alerta de margem baixa**
   - Toggle: Ativo/Inativo
   - Campo: "Alertar quando margem for menor que ___%" (padrao: 15)
   - Calcula margem = ((selling_price - cost_price) / selling_price) * 100
   - Notifica sobre produtos com margem abaixo do limite configurado

---

## Detalhes tecnicos

### 1. Migracao de banco de dados

Criar tabela `automation_rules`:

```sql
CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  rule_type text NOT NULL, -- 'pause_zero_stock', 'low_stock_alert', 'low_margin_alert'
  is_active boolean DEFAULT false,
  config jsonb DEFAULT '{}', -- parametros configurados (ex: {"threshold": 10, "min_margin": 15})
  last_triggered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, rule_type)
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org automation rules"
  ON public.automation_rules FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins and operators can manage automation rules"
  ON public.automation_rules FOR ALL
  USING (organization_id = get_user_org_id(auth.uid()) AND can_write_in_org(auth.uid()));
```

Criar tabela `automation_logs` para historico:

```sql
CREATE TABLE public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_rule_id uuid REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  action_taken text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org automation logs"
  ON public.automation_logs FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "System can insert automation logs"
  ON public.automation_logs FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));
```

### 2. Edge Function: `process-automations/index.ts`

Nova edge function executada periodicamente (a cada 30 minutos via cron job existente ou novo). Para cada organizacao com regras ativas:

**Pausa de estoque zero:**
- Busca produtos com `stock = 0` que tem `product_listings` ativos
- Para cada produto, marca o listing como `sync_status = 'paused'` e gera notificacao
- Busca produtos com `stock > 0` que tem listings pausados pela automacao, e reativa

**Alerta de reposicao:**
- Busca produtos com `stock <= threshold` configurado pelo usuario
- Gera notificacao para cada produto encontrado (com deduplicacao de 24h igual ao sistema existente)

**Alerta de margem baixa:**
- Busca produtos com `cost_price` e `selling_price` preenchidos
- Calcula margem e filtra os que estao abaixo do limite configurado
- Gera notificacao com detalhes do produto e margem atual

A funcao usa `SUPABASE_SERVICE_ROLE_KEY` para acessar dados de todas as organizacoes e reutiliza o padrao `insertNotificationIfNotExists` do `generate-notifications`.

### 3. Nova pagina: `src/pages/Automations.tsx`

Pagina com cards para cada tipo de automacao:

- Busca regras da tabela `automation_rules` para a organizacao do usuario
- Se nao existem regras, cria os registros default (inativos) no primeiro acesso
- Cada card tem Switch para ativar/desativar e campos de configuracao (Input numerico)
- Ao alterar toggle ou config, faz upsert na tabela
- Secao inferior mostra log das ultimas execucoes

Usa os hooks existentes:
- `useOrganization()` para pegar `organization_id`
- `useOrgRole()` para verificar `canWrite` (viewers nao podem alterar)
- `useAuth()` para o `user_id`

### 4. Integracao no sidebar e rotas

- Adicionar item "Automacoes" no `AppSidebar.tsx` com icone `Zap` do lucide-react, posicionado apos "Assistente de IA"
- Adicionar rota `/app/automations` no `App.tsx`

### 5. Config.toml

Adicionar configuracao da nova edge function:

```toml
[functions.process-automations]
verify_jwt = false
```

### Fluxo completo

```text
Usuario acessa /app/automations
    |
    v
Pagina carrega regras da tabela automation_rules
(cria defaults se primeiro acesso)
    |
    v
Usuario ativa "Alerta de estoque baixo" e define limite = 10
    |
    v
Frontend faz UPSERT na automation_rules:
{rule_type: 'low_stock_alert', is_active: true, config: {threshold: 10}}
    |
    v
A cada 30min, cron job chama process-automations
    |
    v
Edge function verifica regras ativas de cada org:
- Busca produtos com stock <= 10
- Gera notificacoes (com deduplicacao de 24h)
- Registra log em automation_logs
    |
    v
Usuario recebe notificacao via Realtime no sino do header
+ email se habilitado nas preferencias
```

### Arquivos modificados/criados

1. **Nova migracao SQL** - Tabelas `automation_rules` e `automation_logs` com RLS
2. **`supabase/functions/process-automations/index.ts`** (novo) - Edge function de processamento
3. **`src/pages/Automations.tsx`** (novo) - Pagina de configuracao das automacoes
4. **`src/components/layout/AppSidebar.tsx`** - Adicionar item no menu
5. **`src/App.tsx`** - Adicionar rota
6. **`supabase/config.toml`** - Config da nova edge function
7. **`src/integrations/supabase/types.ts`** - Tipos atualizados

### Seguranca

- RLS garante isolamento por organizacao
- Apenas admins e operators podem alterar regras (viewers so visualizam)
- Edge function usa service role key para acessar dados cross-org
- Notificacoes respeitam preferencias do usuario (email_enabled, etc.)
- Deduplicacao de 24h evita spam de notificacoes repetidas

### Design visual

- Cards com borda lateral colorida por tipo (verde para estoque, laranja para margem, vermelho para pausa)
- Switch alinhado no canto superior direito do card
- Inputs numericos com labels descritivos e placeholders
- Badge "Ultima execucao: ha X minutos" no rodape de cada card
- Secao de logs com tabela compacta mostrando data, tipo e detalhes
- Responsivo: cards empilhados no mobile, grid 1x3 no desktop
