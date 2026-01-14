-- Drop the extension from public and enable it in extensions schema
DROP EXTENSION IF EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Update the encrypt_token function to use extensions schema
CREATE OR REPLACE FUNCTION public.encrypt_token(token text)
 RETURNS bytea
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF token IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN extensions.encrypt(
    convert_to(token, 'utf8'),
    convert_to(COALESCE(current_setting('app.settings.encryption_key', true), 'unistock_default_encryption_key_change_in_production'), 'utf8'),
    'aes'
  );
END;
$function$;

-- Update the decrypt_token function to use extensions schema
CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token bytea)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN convert_from(
    extensions.decrypt(
      encrypted_token,
      convert_to(COALESCE(current_setting('app.settings.encryption_key', true), 'unistock_default_encryption_key_change_in_production'), 'utf8'),
      'aes'
    ),
    'utf8'
  );
END;
$function$;