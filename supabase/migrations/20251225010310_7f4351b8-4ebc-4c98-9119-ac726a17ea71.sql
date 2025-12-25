-- Adicionar coluna token_expires_at para rastrear expiração de tokens
ALTER TABLE public.integrations 
ADD COLUMN IF NOT EXISTS token_expires_at timestamp with time zone;

-- Comentário descritivo
COMMENT ON COLUMN public.integrations.token_expires_at IS 'Data/hora de expiração do access token. NULL para tokens permanentes (Shopify).';

-- Criar índice para buscar tokens próximos de expirar
CREATE INDEX IF NOT EXISTS idx_integrations_token_expires 
ON public.integrations (token_expires_at) 
WHERE token_expires_at IS NOT NULL;