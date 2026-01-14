-- Migrate ALL remaining plaintext tokens to encrypted versions (no filter on migration status)
UPDATE integrations 
SET 
  encrypted_access_token = public.encrypt_token(access_token),
  encrypted_refresh_token = CASE 
    WHEN refresh_token IS NOT NULL THEN public.encrypt_token(refresh_token)
    ELSE encrypted_refresh_token
  END
WHERE encrypted_access_token IS NULL AND access_token IS NOT NULL;