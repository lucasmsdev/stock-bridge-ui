ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_completed_onboarding boolean DEFAULT false;