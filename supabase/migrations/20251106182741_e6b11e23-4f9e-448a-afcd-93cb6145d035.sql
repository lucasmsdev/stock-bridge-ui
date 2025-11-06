-- Adicionar colunas específicas da Amazon na tabela integrations
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS selling_partner_id TEXT,
ADD COLUMN IF NOT EXISTS marketplace_id TEXT DEFAULT 'ATVPDKIKX0DER';

COMMENT ON COLUMN integrations.selling_partner_id IS 'Amazon Seller Partner ID obtido durante OAuth';
COMMENT ON COLUMN integrations.marketplace_id IS 'Amazon Marketplace ID (ex: ATVPDKIKX0DER para US, A2Q3Y263D00KWC para BR)';