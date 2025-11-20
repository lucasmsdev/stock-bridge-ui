-- Etapa 1: Habilitar extensões de criptografia
CREATE EXTENSION IF NOT EXISTS pgsodium;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Etapa 2: Criar chave de criptografia no Vault (se não existir)
-- Nota: A chave será gerenciada automaticamente pelo Supabase Vault

-- Etapa 3: Função para criptografar tokens
CREATE OR REPLACE FUNCTION public.encrypt_token(token text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o token for NULL, retorna NULL
  IF token IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Usa pgcrypto para criptografar com chave derivada do segredo do projeto
  RETURN pgcrypto.encrypt(
    convert_to(token, 'utf8'),
    convert_to(current_setting('app.settings.encryption_key', true), 'utf8'),
    'aes'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback: usa uma chave fixa se não houver configuração (menos seguro, mas funcional)
    RETURN pgcrypto.encrypt(
      convert_to(token, 'utf8'),
      convert_to('unistock_default_encryption_key_change_in_production', 'utf8'),
      'aes'
    );
END;
$$;

-- Etapa 4: Função para descriptografar tokens
CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o token criptografado for NULL, retorna NULL
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Descriptografa usando a mesma chave
  RETURN convert_from(
    pgcrypto.decrypt(
      encrypted_token,
      convert_to(current_setting('app.settings.encryption_key', true), 'utf8'),
      'aes'
    ),
    'utf8'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback: usa a mesma chave fixa
    RETURN convert_from(
      pgcrypto.decrypt(
        encrypted_token,
        convert_to('unistock_default_encryption_key_change_in_production', 'utf8'),
        'aes'
      ),
      'utf8'
    );
END;
$$;

-- Etapa 5: Adicionar novas colunas criptografadas à tabela integrations
ALTER TABLE public.integrations 
ADD COLUMN IF NOT EXISTS encrypted_access_token bytea,
ADD COLUMN IF NOT EXISTS encrypted_refresh_token bytea,
ADD COLUMN IF NOT EXISTS encryption_migrated boolean DEFAULT false;

-- Etapa 6: Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_integrations_encryption_migrated 
ON public.integrations(encryption_migrated) 
WHERE encryption_migrated = false;

-- Etapa 7: Criar função para migrar tokens existentes
CREATE OR REPLACE FUNCTION public.migrate_integration_tokens()
RETURNS TABLE(migrated_count integer, failed_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  integration_record RECORD;
  success_count integer := 0;
  error_count integer := 0;
BEGIN
  FOR integration_record IN 
    SELECT id, access_token, refresh_token 
    FROM public.integrations 
    WHERE encryption_migrated = false
    AND access_token IS NOT NULL
  LOOP
    BEGIN
      UPDATE public.integrations
      SET 
        encrypted_access_token = public.encrypt_token(integration_record.access_token),
        encrypted_refresh_token = CASE 
          WHEN integration_record.refresh_token IS NOT NULL 
          THEN public.encrypt_token(integration_record.refresh_token)
          ELSE NULL
        END,
        encryption_migrated = true
      WHERE id = integration_record.id;
      
      success_count := success_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        RAISE NOTICE 'Erro ao migrar integração %: %', integration_record.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT success_count, error_count;
END;
$$;

-- Etapa 8: Executar migração de tokens existentes
SELECT * FROM public.migrate_integration_tokens();

-- Etapa 9: Verificar se há tokens não migrados
DO $$
DECLARE
  unmigrated_count integer;
BEGIN
  SELECT COUNT(*) INTO unmigrated_count
  FROM public.integrations
  WHERE encryption_migrated = false AND access_token IS NOT NULL;
  
  IF unmigrated_count > 0 THEN
    RAISE NOTICE 'ATENÇÃO: % tokens não foram migrados. Execute migrate_integration_tokens() novamente.', unmigrated_count;
  ELSE
    RAISE NOTICE '✅ Todos os tokens foram migrados com sucesso!';
  END IF;
END;
$$;