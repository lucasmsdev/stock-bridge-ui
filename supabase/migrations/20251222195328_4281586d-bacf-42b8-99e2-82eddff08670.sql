-- Criar tabela para controle de uso de IA por mês
CREATE TABLE public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month_year TEXT NOT NULL, -- formato: '2025-01'
  query_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month_year)
);

-- Adicionar comentários
COMMENT ON TABLE public.ai_usage IS 'Controle de uso mensal de consultas de IA por usuário';
COMMENT ON COLUMN public.ai_usage.month_year IS 'Formato: YYYY-MM para identificar o mês';
COMMENT ON COLUMN public.ai_usage.query_count IS 'Número de consultas realizadas no mês';

-- Habilitar RLS
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own usage" 
ON public.ai_usage 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage" 
ON public.ai_usage 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage" 
ON public.ai_usage 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ai_usage_updated_at
BEFORE UPDATE ON public.ai_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();