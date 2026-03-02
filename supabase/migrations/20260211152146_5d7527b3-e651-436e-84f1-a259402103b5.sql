
-- Step 1: Store encryption key in Supabase Vault
SELECT vault.create_secret(
  'k8mP2xQ9vL4nR7wJ3tY6uA1dF5hC0sB',
  'encryption_key',
  'Encryption key for marketplace integration tokens'
);

-- Step 2: Update encrypt_token to read from Vault (keep same signature: text -> bytea)
CREATE OR REPLACE FUNCTION public.encrypt_token(token text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  encryption_key text;
BEGIN
  IF token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO encryption_key
  FROM vault.decrypted_secrets
  WHERE name = 'encryption_key'
  LIMIT 1;

  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found in vault';
  END IF;

  RETURN extensions.encrypt(
    convert_to(token, 'utf8'),
    convert_to(encryption_key, 'utf8'),
    'aes'
  );
END;
$$;

-- Step 3: Update decrypt_token to read from Vault (keep same signature: bytea -> text)
CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  encryption_key text;
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO encryption_key
  FROM vault.decrypted_secrets
  WHERE name = 'encryption_key'
  LIMIT 1;

  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found in vault';
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
$$;

-- Step 4: Remove the plaintext key from app_config
DELETE FROM public.app_config WHERE key = 'encryption_key';

-- Step 5: Maintain existing permission restrictions
REVOKE EXECUTE ON FUNCTION public.encrypt_token(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_token(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encrypt_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_token(bytea) TO service_role;
