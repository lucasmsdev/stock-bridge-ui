
# Plano: Corrigir Políticas RLS Vulneráveis

## Diagnóstico

Identificamos **7 políticas RLS vulneráveis** em 2 tabelas que usam `USING (true)` ou `WITH CHECK (true)`:

| Tabela | Operação | Política Atual |
|--------|----------|----------------|
| `ad_metrics` | INSERT | `WITH CHECK (true)` |
| `ad_metrics` | UPDATE | `USING (true)` |
| `ad_metrics` | DELETE | `USING (true)` |
| `attributed_conversions` | INSERT | `WITH CHECK (true)` |
| `attributed_conversions` | UPDATE | `USING (true)` |
| `attributed_conversions` | DELETE | `USING (true)` |

### Por que isso é um problema?

Essas políticas permitem que **qualquer usuário autenticado** insira, atualize ou delete dados de **qualquer organização** - não apenas a sua. Isso quebra totalmente o isolamento de dados entre organizações.

### Contexto de uso

Essas tabelas são manipuladas por Edge Functions que usam `SUPABASE_SERVICE_ROLE_KEY`:
- `sync-meta-ads` → insere/atualiza `ad_metrics`
- `attribute-conversions` → insere/deleta `attributed_conversions`

A service role key **ignora RLS**, então as Edge Functions continuarão funcionando normalmente.

## Solução

Remover as políticas permissivas e criar políticas que:
1. **SELECT**: Usuários podem ver dados da sua organização (já está correto)
2. **INSERT/UPDATE/DELETE**: Negar acesso direto do cliente - apenas service role pode modificar

### Abordagem recomendada

Como essas tabelas só devem ser modificadas por Edge Functions (usando service role), a solução mais segura é **não ter políticas de escrita para usuários comuns**.

## Implementação

### 1. Script SQL para remover políticas vulneráveis

```sql
-- Remover políticas vulneráveis da tabela ad_metrics
DROP POLICY IF EXISTS "Service role can insert ad_metrics" ON ad_metrics;
DROP POLICY IF EXISTS "Service role can update ad_metrics" ON ad_metrics;
DROP POLICY IF EXISTS "Service role can delete ad_metrics" ON ad_metrics;

-- Remover políticas vulneráveis da tabela attributed_conversions
DROP POLICY IF EXISTS "Service role can insert attributed conversions" ON attributed_conversions;
DROP POLICY IF EXISTS "Service role can update attributed conversions" ON attributed_conversions;
DROP POLICY IF EXISTS "Service role can delete attributed conversions" ON attributed_conversions;
```

### 2. Resultado esperado

Após remover essas políticas:

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `ad_metrics` | Membros da org | Bloqueado | Bloqueado | Bloqueado |
| `attributed_conversions` | Membros da org | Bloqueado | Bloqueado | Bloqueado |

- Usuários podem apenas **visualizar** dados da sua organização
- **Edge Functions** (com service role) continuam tendo acesso total
- Nenhum usuário consegue modificar dados diretamente

### 3. Criar arquivo de migração

Será criado em: `supabase/migrations/20250204_fix_permissive_rls_policies.sql`

## Por que isso é seguro?

```text
+-------------------+     +------------------+     +---------------+
|   Cliente React   |---->|   RLS (Supabase) |---->|   Tabelas     |
| (anon/user token) |     | Bloqueia INSERT  |     | ad_metrics    |
+-------------------+     | UPDATE, DELETE   |     | attr_conv     |
                          +------------------+     +---------------+
                                  ^
                                  | BYPASS
+-------------------+     +------------------+
|  Edge Functions   |---->| Service Role Key |
| (sync-meta-ads)   |     | (ignora RLS)     |
+-------------------+     +------------------+
```

## Arquivos a serem criados

1. **`supabase/migrations/20250204_fix_permissive_rls_policies.sql`**
   - Remove as 6 políticas vulneráveis
   - Comentários explicando a razão

## Verificação após implementação

Executar o linter novamente deve reduzir de 9 para 3 warnings (restando apenas os não relacionados a RLS).

## Detalhes técnicos adicionais

A service role key (usada nas Edge Functions) tem uma propriedade especial no Supabase: ela **ignora completamente as políticas RLS**. Isso significa que:

- Não precisamos criar políticas especiais para "permitir service role"
- Basta não ter políticas permissivas para usuários comuns
- As Edge Functions continuarão funcionando normalmente
