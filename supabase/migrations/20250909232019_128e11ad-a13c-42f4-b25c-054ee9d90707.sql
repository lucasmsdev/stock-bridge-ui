-- Enable leaked password protection
UPDATE auth.config 
SET password_requirements = jsonb_set(
  COALESCE(password_requirements, '{}'::jsonb), 
  '{hibp_enabled}', 
  'true'::jsonb
);

-- Add RLS policies for profiles table if missing
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);