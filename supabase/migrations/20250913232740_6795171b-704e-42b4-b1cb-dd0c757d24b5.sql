-- Add role column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN role text NOT NULL DEFAULT 'user';

-- Create index for better performance on role queries
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Add comment to document the column
COMMENT ON COLUMN public.profiles.role IS 'User role: user (default) or admin (full access)';