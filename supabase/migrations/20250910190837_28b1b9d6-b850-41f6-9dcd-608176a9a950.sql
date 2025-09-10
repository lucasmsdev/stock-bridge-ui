-- Create secure function to delete user account and all associated data
CREATE OR REPLACE FUNCTION public.delete_user_account()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  deleted_products_count integer;
  deleted_orders_count integer;
  deleted_integrations_count integer;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Delete user's products and count them
  DELETE FROM public.products WHERE user_id = current_user_id;
  GET DIAGNOSTICS deleted_products_count = ROW_COUNT;

  -- Delete user's orders and count them
  DELETE FROM public.orders WHERE user_id = current_user_id;
  GET DIAGNOSTICS deleted_orders_count = ROW_COUNT;

  -- Delete user's integrations and count them
  DELETE FROM public.integrations WHERE user_id = current_user_id;
  GET DIAGNOSTICS deleted_integrations_count = ROW_COUNT;

  -- Delete user's profile
  DELETE FROM public.profiles WHERE id = current_user_id;

  -- Delete the auth user (this will cascade and clean up auth-related data)
  DELETE FROM auth.users WHERE id = current_user_id;

  -- Return success with deletion summary
  RETURN json_build_object(
    'success', true,
    'deleted_data', json_build_object(
      'products', deleted_products_count,
      'orders', deleted_orders_count,
      'integrations', deleted_integrations_count,
      'profile', true
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;