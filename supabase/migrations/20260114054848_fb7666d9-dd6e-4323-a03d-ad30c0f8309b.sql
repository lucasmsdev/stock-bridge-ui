-- Fix encrypt_token function to remove hardcoded fallback key and fail loudly
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
  
  -- Get encryption key from settings - NO FALLBACK
  encryption_key := current_setting('app.settings.encryption_key', true);
  
  -- Fail loudly if key is not configured
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'SECURITY ERROR: Encryption key not configured. Set app.settings.encryption_key in Supabase dashboard.';
  END IF;
  
  RETURN extensions.encrypt(
    convert_to(token, 'utf8'),
    convert_to(encryption_key, 'utf8'),
    'aes'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise any errors without fallback - do NOT silently use weak key
    RAISE EXCEPTION 'Token encryption failed: %. Ensure app.settings.encryption_key is properly configured.', SQLERRM;
END;
$function$;

-- Fix decrypt_token function to remove hardcoded fallback key and fail loudly
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
  
  -- Get encryption key from settings - NO FALLBACK
  encryption_key := current_setting('app.settings.encryption_key', true);
  
  -- Fail loudly if key is not configured
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'SECURITY ERROR: Encryption key not configured. Set app.settings.encryption_key in Supabase dashboard.';
  END IF;
  
  RETURN convert_from(
    extensions.decrypt(
      encrypted_token,
      convert_to(encryption_key, 'utf8'),
      'aes'
    ),
    'utf8'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise any errors without fallback - do NOT silently fail
    RAISE EXCEPTION 'Token decryption failed: %. Ensure app.settings.encryption_key is properly configured and matches the key used for encryption.', SQLERRM;
END;
$function$;