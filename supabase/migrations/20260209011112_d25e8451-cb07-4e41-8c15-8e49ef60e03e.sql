
-- Remove weak fallback encryption key from encrypt_token function
-- PREREQUISITE: app.settings.encryption_key MUST be configured via:
-- ALTER DATABASE postgres SET app.settings.encryption_key = 'your-secure-key';

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
  
  -- Read configured encryption key (no fallback)
  encryption_key := NULLIF(current_setting('app.settings.encryption_key', true), '');
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.settings.encryption_key in database settings.';
  END IF;
  
  RETURN extensions.encrypt(
    convert_to(token, 'utf8'),
    convert_to(encryption_key, 'utf8'),
    'aes'
  );
END;
$function$;

-- Remove weak fallback encryption key from decrypt_token function
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
  
  -- Read configured encryption key (no fallback)
  encryption_key := NULLIF(current_setting('app.settings.encryption_key', true), '');
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.settings.encryption_key in database settings.';
  END IF;
  
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
