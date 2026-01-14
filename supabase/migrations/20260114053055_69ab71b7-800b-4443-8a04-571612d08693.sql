-- Drop the plaintext token columns to eliminate exposure risk
ALTER TABLE integrations DROP COLUMN IF EXISTS access_token;
ALTER TABLE integrations DROP COLUMN IF EXISTS refresh_token;

-- Drop the migration flag column as it's no longer needed
ALTER TABLE integrations DROP COLUMN IF EXISTS encryption_migrated;

-- Make encrypted_access_token NOT NULL since it's now the primary storage
ALTER TABLE integrations ALTER COLUMN encrypted_access_token SET NOT NULL;