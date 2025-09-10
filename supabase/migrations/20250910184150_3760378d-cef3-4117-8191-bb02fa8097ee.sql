-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow users to insert their own profile (for upsert operations)
CREATE POLICY "Users can insert their own profile" ON public.profiles  
  FOR INSERT WITH CHECK (auth.uid() = id);