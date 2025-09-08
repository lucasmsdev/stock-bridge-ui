-- Add financial data columns to products table
ALTER TABLE public.products 
ADD COLUMN cost_price NUMERIC DEFAULT NULL,
ADD COLUMN selling_price NUMERIC DEFAULT NULL,
ADD COLUMN ad_spend NUMERIC DEFAULT 0;