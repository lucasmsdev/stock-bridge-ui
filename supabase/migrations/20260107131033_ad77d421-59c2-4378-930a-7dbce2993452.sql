-- Função auxiliar para inserir notificações
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (p_user_id, p_title, p_message, p_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para estoque baixo
CREATE OR REPLACE FUNCTION public.trigger_low_stock_notification()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_stock_low
  AFTER UPDATE OF stock ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_low_stock_notification();

-- Trigger para erros de sincronização
CREATE OR REPLACE FUNCTION public.trigger_sync_error_notification()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;