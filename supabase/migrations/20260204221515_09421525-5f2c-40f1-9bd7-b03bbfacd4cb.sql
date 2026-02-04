-- ========================================
-- Migração: Remover Políticas RLS Permissivas
-- Tabelas afetadas: ad_metrics, attributed_conversions
-- 
-- MOTIVO: Essas políticas usavam USING(true) e WITH CHECK(true),
-- permitindo que qualquer usuário autenticado modificasse dados
-- de QUALQUER organização - uma vulnerabilidade grave de segurança.
--
-- SOLUÇÃO: Remover essas políticas. As Edge Functions que manipulam
-- essas tabelas usam SUPABASE_SERVICE_ROLE_KEY, que ignora RLS.
-- Portanto, não precisamos de políticas de escrita para usuários.
-- ========================================

-- Remover políticas vulneráveis da tabela ad_metrics
DROP POLICY IF EXISTS "Service role can insert ad_metrics" ON ad_metrics;
DROP POLICY IF EXISTS "Service role can update ad_metrics" ON ad_metrics;
DROP POLICY IF EXISTS "Service role can delete ad_metrics" ON ad_metrics;

-- Remover políticas vulneráveis da tabela attributed_conversions
DROP POLICY IF EXISTS "Service role can insert attributed conversions" ON attributed_conversions;
DROP POLICY IF EXISTS "Service role can update attributed conversions" ON attributed_conversions;
DROP POLICY IF EXISTS "Service role can delete attributed conversions" ON attributed_conversions;