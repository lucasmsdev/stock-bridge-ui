-- Remove a constraint única que impede múltiplas contas da mesma plataforma
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_user_id_platform_key;

-- Adiciona campo para dar um apelido/nome personalizado à conta
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS account_nickname text;

-- Adiciona índice para melhorar performance nas consultas
CREATE INDEX IF NOT EXISTS idx_integrations_user_platform ON public.integrations(user_id, platform);

-- Adiciona comentário para documentação
COMMENT ON COLUMN public.integrations.account_nickname IS 'Nome personalizado dado pelo usuário para identificar esta conta (ex: "Loja Principal", "Loja Filial")';