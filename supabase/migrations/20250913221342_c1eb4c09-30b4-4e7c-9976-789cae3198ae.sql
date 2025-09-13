-- Add stripe_customer_id column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN stripe_customer_id TEXT;