-- Add account_name column to integrations table
ALTER TABLE public.integrations 
ADD COLUMN account_name text;