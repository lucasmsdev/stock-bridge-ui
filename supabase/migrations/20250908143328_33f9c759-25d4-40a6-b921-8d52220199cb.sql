-- Add shop_domain column to integrations table for Shopify stores
ALTER TABLE public.integrations 
ADD COLUMN shop_domain TEXT;