
-- Create a secure config table for the encryption key
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- No public access - only accessible via SECURITY DEFINER functions
-- (no RLS policies = no direct access from client)

-- Insert the encryption key
INSERT INTO public.app_config (key, value) 
VALUES ('encryption_key', 'k8mP2xQ9vL4nR7wJ3tY6uA1dF5hC0sB')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Update encrypt_token to read from app_config
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
  
  SELECT value INTO encryption_key FROM public.app_config WHERE key = 'encryption_key';
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not configured. Insert it into app_config table.';
  END IF;
  
  RETURN extensions.encrypt(
    convert_to(token, 'utf8'),
    convert_to(encryption_key, 'utf8'),
    'aes'
  );
END;
$function$;

-- Update decrypt_token to read from app_config
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
  
  SELECT value INTO encryption_key FROM public.app_config WHERE key = 'encryption_key';
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not configured. Insert it into app_config table.';
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
