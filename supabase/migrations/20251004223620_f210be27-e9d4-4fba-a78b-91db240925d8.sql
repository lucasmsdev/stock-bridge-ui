-- Add unique constraint for user_id and platform combination
ALTER TABLE public.integrations 
ADD CONSTRAINT integrations_user_id_platform_key UNIQUE (user_id, platform);