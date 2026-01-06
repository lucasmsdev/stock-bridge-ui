-- Criar tabela de fornecedores
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  cnpj_cpf TEXT,
  address JSONB DEFAULT '{}'::jsonb,
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para suppliers
CREATE POLICY "Users can view their own suppliers"
ON public.suppliers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own suppliers"
ON public.suppliers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suppliers"
ON public.suppliers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own suppliers"
ON public.suppliers FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar tabela de pedidos de compra
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_value NUMERIC NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_delivery DATE,
  received_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para purchase_orders
CREATE POLICY "Users can view their own purchase orders"
ON public.purchase_orders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own purchase orders"
ON public.purchase_orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own purchase orders"
ON public.purchase_orders FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own purchase orders"
ON public.purchase_orders FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar coluna supplier_id na tabela products
ALTER TABLE public.products
ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;