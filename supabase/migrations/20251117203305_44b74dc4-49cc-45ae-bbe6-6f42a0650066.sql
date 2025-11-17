-- Atualizar enum de planos para os novos valores
-- Passo 1: Converter coluna para text temporariamente
ALTER TABLE profiles 
  ALTER COLUMN plan DROP DEFAULT,
  ALTER COLUMN plan TYPE text USING plan::text;

-- Passo 2: Atualizar os valores existentes para os novos nomes
UPDATE profiles 
SET plan = CASE 
  WHEN plan = 'estrategista' THEN 'iniciante'
  WHEN plan = 'competidor' THEN 'profissional'
  WHEN plan = 'dominador' THEN 'enterprise'
  ELSE 'iniciante'
END
WHERE plan IS NOT NULL;

-- Passo 3: Remover o enum antigo
DROP TYPE subscription_plan;

-- Passo 4: Criar o novo enum
CREATE TYPE subscription_plan AS ENUM ('iniciante', 'profissional', 'enterprise', 'unlimited');

-- Passo 5: Converter a coluna de volta para o novo enum
ALTER TABLE profiles 
  ALTER COLUMN plan TYPE subscription_plan USING plan::subscription_plan,
  ALTER COLUMN plan SET DEFAULT 'iniciante'::subscription_plan;

-- Passo 6: Atualizar a função handle_new_user para usar o novo plano padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, plan, updated_at)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'plan')::subscription_plan, 'iniciante'::subscription_plan),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    plan = COALESCE(EXCLUDED.plan, profiles.plan),
    updated_at = now();
  
  RETURN NEW;
END;
$function$;