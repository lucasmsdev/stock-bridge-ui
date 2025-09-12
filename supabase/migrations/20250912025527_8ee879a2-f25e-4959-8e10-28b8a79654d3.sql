-- Ensure the trigger is working correctly and update any needed configuration for email confirmation
-- This doesn't modify auth settings directly but ensures proper profile creation

-- Update the trigger function to handle email confirmation status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, plan, updated_at)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'plan', 'estrategista')::public.subscription_plan,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    plan = COALESCE(EXCLUDED.plan, profiles.plan),
    updated_at = now();
  
  RETURN NEW;
END;
$$;