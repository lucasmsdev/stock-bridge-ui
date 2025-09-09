-- Adicionar coluna de plano na tabela profiles
ALTER TABLE public.profiles ADD COLUMN plan TEXT DEFAULT 'estrategista';

-- Criar enum para os planos
CREATE TYPE public.subscription_plan AS ENUM ('estrategista', 'competidor', 'dominador');

-- Alterar a coluna para usar o enum
ALTER TABLE public.profiles ALTER COLUMN plan TYPE subscription_plan USING plan::subscription_plan;