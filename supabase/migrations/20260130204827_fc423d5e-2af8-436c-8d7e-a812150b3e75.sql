-- =============================================
-- FASE 1: Sistema Multi-Usuário com Organizações
-- =============================================

-- 1. Criar tipo enum para papéis na organização
CREATE TYPE public.org_role AS ENUM ('admin', 'operator', 'viewer');

-- 2. Criar tabela de organizações
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan public.subscription_plan NOT NULL DEFAULT 'iniciante',
  stripe_customer_id text,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Criar tabela de membros da organização
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL DEFAULT 'viewer',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- 4. Criar tabela de convites
CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  code text UNIQUE NOT NULL,
  role public.org_role NOT NULL DEFAULT 'viewer',
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Habilitar RLS nas novas tabelas
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- 6. Criar funções de segurança (Security Definer)

-- Retorna a organização do usuário
CREATE OR REPLACE FUNCTION public.get_user_org_id(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members 
  WHERE user_id = user_uuid LIMIT 1
$$;

-- Retorna o papel do usuário na organização
CREATE OR REPLACE FUNCTION public.get_user_org_role(user_uuid uuid)
RETURNS public.org_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.organization_members 
  WHERE user_id = user_uuid LIMIT 1
$$;

-- Verifica se usuário pode escrever (admin ou operator)
CREATE OR REPLACE FUNCTION public.can_write_in_org(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE user_id = user_uuid 
    AND role IN ('admin', 'operator')
  )
$$;

-- Verifica se usuário é admin da organização
CREATE OR REPLACE FUNCTION public.is_org_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE user_id = user_uuid 
    AND role = 'admin'
  )
$$;

-- 7. Políticas RLS para organizations

CREATE POLICY "Members can view their organization"
  ON public.organizations FOR SELECT
  USING (id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Admins can update their organization"
  ON public.organizations FOR UPDATE
  USING (id = public.get_user_org_id(auth.uid()) AND public.is_org_admin(auth.uid()));

-- 8. Políticas RLS para organization_members

CREATE POLICY "Members can view org members"
  ON public.organization_members FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Admins can insert members"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid()) 
    AND public.is_org_admin(auth.uid())
  );

CREATE POLICY "Admins can update members"
  ON public.organization_members FOR UPDATE
  USING (
    organization_id = public.get_user_org_id(auth.uid()) 
    AND public.is_org_admin(auth.uid())
  );

CREATE POLICY "Admins can delete members"
  ON public.organization_members FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid()) 
    AND public.is_org_admin(auth.uid())
    AND user_id != auth.uid() -- Não pode remover a si mesmo
  );

-- 9. Políticas RLS para organization_invites

CREATE POLICY "Admins can view org invites"
  ON public.organization_invites FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_org_admin(auth.uid()));

CREATE POLICY "Admins can create invites"
  ON public.organization_invites FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid()) 
    AND public.is_org_admin(auth.uid())
  );

CREATE POLICY "Admins can delete invites"
  ON public.organization_invites FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid()) 
    AND public.is_org_admin(auth.uid())
  );

-- 10. Adicionar organization_id nas tabelas existentes

ALTER TABLE public.products ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.orders ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.integrations ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.suppliers ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.expenses ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.product_listings ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.ai_usage ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.ai_conversations ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.notifications ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.scheduled_reports ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.purchase_orders ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.price_monitoring_jobs ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.monthly_financial_history ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.user_financial_settings ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.notification_preferences ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- 11. Migrar dados existentes - criar organizações para cada usuário
DO $$
DECLARE
  user_record RECORD;
  new_org_id uuid;
BEGIN
  FOR user_record IN 
    SELECT id, email, plan, company_name, stripe_customer_id 
    FROM public.profiles
  LOOP
    -- Criar organização
    INSERT INTO public.organizations (name, slug, owner_id, plan, stripe_customer_id)
    VALUES (
      COALESCE(user_record.company_name, split_part(user_record.email, '@', 1)),
      gen_random_uuid()::text,
      user_record.id,
      COALESCE(user_record.plan, 'iniciante'),
      user_record.stripe_customer_id
    )
    RETURNING id INTO new_org_id;
    
    -- Adicionar como admin
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, user_record.id, 'admin');
    
    -- Atualizar dados existentes
    UPDATE public.products SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE public.orders SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE public.integrations SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE public.suppliers SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE public.expenses SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE public.product_listings SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE public.ai_usage SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE public.ai_conversations SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE public.notifications SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE public.scheduled_reports SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE public.purchase_orders SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE public.price_monitoring_jobs SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE public.monthly_financial_history SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE public.user_financial_settings SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE public.notification_preferences SET organization_id = new_org_id WHERE user_id = user_record.id;
  END LOOP;
END $$;

-- 12. Trigger para criar organização quando novo usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  company text;
BEGIN
  -- Usa company_name do metadata ou nome do email
  company := COALESCE(
    NEW.raw_user_meta_data->>'company_name', 
    split_part(NEW.email, '@', 1)
  );
  
  -- Cria organização
  INSERT INTO public.organizations (name, slug, owner_id)
  VALUES (company, gen_random_uuid()::text, NEW.id)
  RETURNING id INTO new_org_id;
  
  -- Adiciona como admin
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'admin');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_org
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_org();

-- 13. Trigger para atualizar updated_at em organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 14. Criar índices para performance
CREATE INDEX idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_organization_members_org_id ON public.organization_members(organization_id);
CREATE INDEX idx_organization_invites_code ON public.organization_invites(code);
CREATE INDEX idx_organization_invites_org_id ON public.organization_invites(organization_id);
CREATE INDEX idx_products_org_id ON public.products(organization_id);
CREATE INDEX idx_orders_org_id ON public.orders(organization_id);
CREATE INDEX idx_integrations_org_id ON public.integrations(organization_id);

-- 15. Atualizar políticas RLS das tabelas existentes para usar organization_id

-- PRODUCTS
DROP POLICY IF EXISTS "Users can view their own products" ON public.products;
DROP POLICY IF EXISTS "Users can insert their own products" ON public.products;
DROP POLICY IF EXISTS "Users can update their own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete their own products" ON public.products;

CREATE POLICY "Members can view org products"
  ON public.products FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Writers can insert org products"
  ON public.products FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.can_write_in_org(auth.uid())
  );

CREATE POLICY "Writers can update org products"
  ON public.products FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (public.can_write_in_org(auth.uid()));

CREATE POLICY "Admins can delete org products"
  ON public.products FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.is_org_admin(auth.uid())
  );

-- ORDERS
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can delete their own orders" ON public.orders;

CREATE POLICY "Members can view org orders"
  ON public.orders FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Writers can insert org orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.can_write_in_org(auth.uid())
  );

CREATE POLICY "Writers can update org orders"
  ON public.orders FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (public.can_write_in_org(auth.uid()));

CREATE POLICY "Admins can delete org orders"
  ON public.orders FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.is_org_admin(auth.uid())
  );

-- INTEGRATIONS
DROP POLICY IF EXISTS "Users can view their own integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can insert their own integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can update their own integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can delete their own integrations" ON public.integrations;

CREATE POLICY "Members can view org integrations"
  ON public.integrations FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Admins can insert org integrations"
  ON public.integrations FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.is_org_admin(auth.uid())
  );

CREATE POLICY "Admins can update org integrations"
  ON public.integrations FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (public.is_org_admin(auth.uid()));

CREATE POLICY "Admins can delete org integrations"
  ON public.integrations FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.is_org_admin(auth.uid())
  );

-- SUPPLIERS
DROP POLICY IF EXISTS "Users can view their own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can create their own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update their own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete their own suppliers" ON public.suppliers;

CREATE POLICY "Members can view org suppliers"
  ON public.suppliers FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Writers can insert org suppliers"
  ON public.suppliers FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.can_write_in_org(auth.uid())
  );

CREATE POLICY "Writers can update org suppliers"
  ON public.suppliers FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (public.can_write_in_org(auth.uid()));

CREATE POLICY "Admins can delete org suppliers"
  ON public.suppliers FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.is_org_admin(auth.uid())
  );

-- EXPENSES
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can create their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.expenses;

CREATE POLICY "Members can view org expenses"
  ON public.expenses FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Writers can insert org expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.can_write_in_org(auth.uid())
  );

CREATE POLICY "Writers can update org expenses"
  ON public.expenses FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (public.can_write_in_org(auth.uid()));

CREATE POLICY "Admins can delete org expenses"
  ON public.expenses FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.is_org_admin(auth.uid())
  );

-- AI_USAGE (quota compartilhada por organização)
DROP POLICY IF EXISTS "Users can view their own usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Users can update their own usage" ON public.ai_usage;

CREATE POLICY "Members can view org ai usage"
  ON public.ai_usage FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Members can insert org ai usage"
  ON public.ai_usage FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Members can update org ai usage"
  ON public.ai_usage FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()));

-- AI_CONVERSATIONS
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can create their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.ai_conversations;

CREATE POLICY "Members can view org conversations"
  ON public.ai_conversations FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Members can insert org conversations"
  ON public.ai_conversations FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Members can update org conversations"
  ON public.ai_conversations FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Admins can delete org conversations"
  ON public.ai_conversations FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.is_org_admin(auth.uid())
  );

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can create their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- SCHEDULED_REPORTS
DROP POLICY IF EXISTS "Users can view their own scheduled reports" ON public.scheduled_reports;
DROP POLICY IF EXISTS "Users can create their own scheduled reports" ON public.scheduled_reports;
DROP POLICY IF EXISTS "Users can update their own scheduled reports" ON public.scheduled_reports;
DROP POLICY IF EXISTS "Users can delete their own scheduled reports" ON public.scheduled_reports;

CREATE POLICY "Members can view org scheduled reports"
  ON public.scheduled_reports FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Writers can insert org scheduled reports"
  ON public.scheduled_reports FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.can_write_in_org(auth.uid())
  );

CREATE POLICY "Writers can update org scheduled reports"
  ON public.scheduled_reports FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (public.can_write_in_org(auth.uid()));

CREATE POLICY "Admins can delete org scheduled reports"
  ON public.scheduled_reports FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.is_org_admin(auth.uid())
  );

-- PRODUCT_LISTINGS
DROP POLICY IF EXISTS "Users can view their own listings" ON public.product_listings;
DROP POLICY IF EXISTS "Users can insert their own listings" ON public.product_listings;
DROP POLICY IF EXISTS "Users can update their own listings" ON public.product_listings;
DROP POLICY IF EXISTS "Users can delete their own listings" ON public.product_listings;

CREATE POLICY "Members can view org listings"
  ON public.product_listings FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Writers can insert org listings"
  ON public.product_listings FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.can_write_in_org(auth.uid())
  );

CREATE POLICY "Writers can update org listings"
  ON public.product_listings FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (public.can_write_in_org(auth.uid()));

CREATE POLICY "Admins can delete org listings"
  ON public.product_listings FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.is_org_admin(auth.uid())
  );

-- PURCHASE_ORDERS
DROP POLICY IF EXISTS "Users can view their own purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can create their own purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can update their own purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can delete their own purchase orders" ON public.purchase_orders;

CREATE POLICY "Members can view org purchase orders"
  ON public.purchase_orders FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Writers can insert org purchase orders"
  ON public.purchase_orders FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.can_write_in_org(auth.uid())
  );

CREATE POLICY "Writers can update org purchase orders"
  ON public.purchase_orders FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (public.can_write_in_org(auth.uid()));

CREATE POLICY "Admins can delete org purchase orders"
  ON public.purchase_orders FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.is_org_admin(auth.uid())
  );

-- PRICE_MONITORING_JOBS
DROP POLICY IF EXISTS "Users can view their own monitoring jobs" ON public.price_monitoring_jobs;
DROP POLICY IF EXISTS "Users can create their own monitoring jobs" ON public.price_monitoring_jobs;
DROP POLICY IF EXISTS "Users can update their own monitoring jobs" ON public.price_monitoring_jobs;
DROP POLICY IF EXISTS "Users can delete their own monitoring jobs" ON public.price_monitoring_jobs;

CREATE POLICY "Members can view org monitoring jobs"
  ON public.price_monitoring_jobs FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Writers can insert org monitoring jobs"
  ON public.price_monitoring_jobs FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.can_write_in_org(auth.uid())
  );

CREATE POLICY "Writers can update org monitoring jobs"
  ON public.price_monitoring_jobs FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (public.can_write_in_org(auth.uid()));

CREATE POLICY "Admins can delete org monitoring jobs"
  ON public.price_monitoring_jobs FOR DELETE
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.is_org_admin(auth.uid())
  );

-- MONTHLY_FINANCIAL_HISTORY
DROP POLICY IF EXISTS "Users can view their own history" ON public.monthly_financial_history;
DROP POLICY IF EXISTS "Users can insert their own history" ON public.monthly_financial_history;
DROP POLICY IF EXISTS "Users can update their own history" ON public.monthly_financial_history;

CREATE POLICY "Members can view org financial history"
  ON public.monthly_financial_history FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Writers can insert org financial history"
  ON public.monthly_financial_history FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.can_write_in_org(auth.uid())
  );

CREATE POLICY "Writers can update org financial history"
  ON public.monthly_financial_history FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (public.can_write_in_org(auth.uid()));

-- USER_FINANCIAL_SETTINGS
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_financial_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_financial_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_financial_settings;

CREATE POLICY "Members can view org financial settings"
  ON public.user_financial_settings FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Admins can insert org financial settings"
  ON public.user_financial_settings FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.is_org_admin(auth.uid())
  );

CREATE POLICY "Admins can update org financial settings"
  ON public.user_financial_settings FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (public.is_org_admin(auth.uid()));

-- NOTIFICATION_PREFERENCES (pessoal por usuário)
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can create their own preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.notification_preferences;

CREATE POLICY "Users can view their own preferences"
  ON public.notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
  ON public.notification_preferences FOR UPDATE
  USING (user_id = auth.uid());