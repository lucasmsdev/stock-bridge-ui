-- ============================================
-- SISTEMA DE NOTIFICAÇÕES AUTOMÁTICAS
-- ============================================

-- 1. Garantir que a função notify_user existe
CREATE OR REPLACE FUNCTION public.notify_user(p_user_id uuid, p_title text, p_message text, p_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (p_user_id, p_title, p_message, p_type);
END;
$$;

-- 2. Trigger para estoque baixo em produtos
CREATE OR REPLACE FUNCTION public.trigger_low_stock_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só notifica se o estoque mudou E ficou baixo (<=5), e antes estava acima
  IF NEW.stock <= 5 AND (OLD.stock IS NULL OR OLD.stock > 5) THEN
    PERFORM public.notify_user(
      NEW.user_id,
      CASE WHEN NEW.stock <= 0 
        THEN '🚨 Estoque esgotado: ' || NEW.name
        ELSE '⚠️ Estoque baixo: ' || NEW.name
      END,
      CASE WHEN NEW.stock <= 0 
        THEN 'O produto "' || NEW.name || '" (SKU: ' || COALESCE(NEW.sku, 'N/A') || ') está sem estoque.'
        ELSE 'O produto "' || NEW.name || '" (SKU: ' || COALESCE(NEW.sku, 'N/A') || ') tem apenas ' || NEW.stock || ' unidades.'
      END,
      'low_stock'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS on_product_low_stock ON public.products;

-- Criar trigger para monitorar estoque baixo
CREATE TRIGGER on_product_low_stock
  AFTER UPDATE OF stock ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_low_stock_notification();

-- 3. Trigger para erros de sincronização
CREATE OR REPLACE FUNCTION public.trigger_sync_error_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product_name TEXT;
  v_user_id UUID;
BEGIN
  -- Só notifica se mudou para 'error'
  IF NEW.sync_status = 'error' AND (OLD.sync_status IS NULL OR OLD.sync_status != 'error') THEN
    SELECT name, user_id INTO v_product_name, v_user_id 
    FROM public.products WHERE id = NEW.product_id;
    
    IF v_user_id IS NOT NULL THEN
      PERFORM public.notify_user(
        v_user_id,
        '❌ Erro de sincronização: ' || COALESCE(v_product_name, 'Produto'),
        'Falha ao sincronizar "' || COALESCE(v_product_name, 'produto') || '" com ' || NEW.platform || ': ' || COALESCE(NEW.sync_error, 'Erro desconhecido'),
        'sync_error'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS on_product_listing_sync_error ON public.product_listings;

-- Criar trigger para monitorar erros de sync
CREATE TRIGGER on_product_listing_sync_error
  AFTER UPDATE OF sync_status ON public.product_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_error_notification();

-- 4. Trigger adicional para INSERT em product_listings com erro
DROP TRIGGER IF EXISTS on_product_listing_insert_error ON public.product_listings;

CREATE TRIGGER on_product_listing_insert_error
  AFTER INSERT ON public.product_listings
  FOR EACH ROW
  WHEN (NEW.sync_status = 'error')
  EXECUTE FUNCTION public.trigger_sync_error_notification();