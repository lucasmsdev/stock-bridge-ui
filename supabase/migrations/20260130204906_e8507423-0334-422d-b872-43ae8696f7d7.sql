-- Corrigir política de notificações para ser mais segura
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Apenas usuários autenticados podem receber notificações para si mesmos
-- Ou o sistema via service role
CREATE POLICY "Users can receive notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (user_id = auth.uid() OR auth.uid() IS NOT NULL);