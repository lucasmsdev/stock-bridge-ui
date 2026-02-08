-- Allow conversation owner to delete their own conversations (not just org admins)
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.ai_conversations;

CREATE POLICY "Users can delete own conversations"
ON public.ai_conversations
FOR DELETE
USING (
  user_id = auth.uid()
  AND organization_id = get_user_org_id(auth.uid())
);