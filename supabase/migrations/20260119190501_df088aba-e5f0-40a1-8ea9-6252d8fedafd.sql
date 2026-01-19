-- Adicionar campo EAN na tabela products para código de barras
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS ean TEXT;

-- Comentário para documentação
COMMENT ON COLUMN public.products.ean IS 'Código EAN/GTIN do produto para código de barras. Obrigatório para eletrônicos na Shopee.';