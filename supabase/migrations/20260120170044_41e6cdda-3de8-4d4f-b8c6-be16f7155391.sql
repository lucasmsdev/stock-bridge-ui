-- Criar bucket público para avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Política: Usuários podem ver todos os avatars (público)
CREATE POLICY "Avatars são públicos" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- Política: Usuários podem fazer upload do próprio avatar
CREATE POLICY "Usuários podem fazer upload do próprio avatar" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Política: Usuários podem atualizar o próprio avatar
CREATE POLICY "Usuários podem atualizar o próprio avatar" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Política: Usuários podem deletar o próprio avatar
CREATE POLICY "Usuários podem deletar o próprio avatar" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );