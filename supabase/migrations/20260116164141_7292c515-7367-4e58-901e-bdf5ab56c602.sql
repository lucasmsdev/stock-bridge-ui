-- Restaurar fallback de criptografia para compatibilidade com tokens existentes
-- Esta migração reverte a remoção do fallback que quebrou as integrações

CREATE OR REPLACE FUNCTION public.encrypt_token(token text)
 RETURNS bytea
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  encryption_key text;
BEGIN
  IF token IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Usa chave configurada ou fallback para desenvolvimento
  encryption_key := COALESCE(
    NULLIF(current_setting('app.settings.encryption_key', true), ''),
    'unistock_default_encryption_key_change_in_production'
  );
  
  RETURN extensions.encrypt(
    convert_to(token, 'utf8'),
    convert_to(encryption_key, 'utf8'),
    'aes'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token bytea)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  encryption_key text;
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Usa chave configurada ou fallback para desenvolvimento
  encryption_key := COALESCE(
    NULLIF(current_setting('app.settings.encryption_key', true), ''),
    'unistock_default_encryption_key_change_in_production'
  );
  
  RETURN convert_from(
    extensions.decrypt(
      encrypted_token,
      convert_to(encryption_key, 'utf8'),
      'aes'
    ),
    'utf8'
  );
END;
$function$;