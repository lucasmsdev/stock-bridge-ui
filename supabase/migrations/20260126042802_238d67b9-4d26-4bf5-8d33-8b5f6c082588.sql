-- Adicionar 'disconnected' como status válido para product_listings
-- Este status indica que o produto foi deletado no marketplace
-- e precisa ser republicado

ALTER TABLE product_listings 
  DROP CONSTRAINT IF EXISTS product_listings_sync_status_check;

ALTER TABLE product_listings 
  ADD CONSTRAINT product_listings_sync_status_check 
  CHECK (sync_status = ANY (ARRAY['active', 'paused', 'error', 'deleted', 'disconnected']));

-- Atualizar produtos que já estão com erro 404 para disconnected
UPDATE product_listings 
SET sync_status = 'disconnected' 
WHERE sync_status = 'error' 
  AND sync_error LIKE '%Not Found%';