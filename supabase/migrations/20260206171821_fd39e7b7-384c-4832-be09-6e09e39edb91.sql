-- ========================================
-- Security Fix Migration
-- Issues addressed:
-- 1. DEFINER_OR_RPC_BYPASS: Revoke direct access to encryption functions
-- 2. CLIENT_SIDE_AUTH: Prevent role modification in profiles table
-- ========================================

-- 1. Revoke public access to encryption functions
-- These functions should only be callable by service_role (Edge Functions)
REVOKE EXECUTE ON FUNCTION public.encrypt_token(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_token(bytea) FROM PUBLIC, anon, authenticated;

-- Grant to service_role only (used by Edge Functions)
GRANT EXECUTE ON FUNCTION public.encrypt_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_token(bytea) TO service_role;

-- 2. Create trigger to prevent role column modification in profiles table
-- This protects against privilege escalation attempts
CREATE OR REPLACE FUNCTION public.prevent_profile_role_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If the role column is being changed, reject the update
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Cannot modify role column directly. Role management is handled via user_roles table.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS prevent_profile_role_update_trigger ON public.profiles;

-- Create the trigger
CREATE TRIGGER prevent_profile_role_update_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW 
  EXECUTE FUNCTION public.prevent_profile_role_update();