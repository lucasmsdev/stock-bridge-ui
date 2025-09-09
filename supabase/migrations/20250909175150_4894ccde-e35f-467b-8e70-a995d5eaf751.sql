-- Criar enum para os planos primeiro
CREATE TYPE public.subscription_plan AS ENUM ('estrategista', 'competidor', 'dominador');

-- Adicionar coluna de plano na tabela profiles usando o enum diretamente
ALTER TABLE public.profiles ADD COLUMN plan public.subscription_plan DEFAULT 'estrategista';