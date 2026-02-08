import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, AlertCircle, Zap } from "lucide-react";

export interface AIAction {
  type: 'update_price' | 'update_stock';
  product_id: string;
  sku: string;
  product_name: string;
  new_value: number;
  label: string;
}

type ActionState = 'idle' | 'loading' | 'success' | 'error';

interface AIActionButtonProps {
  action: AIAction;
}

export function AIActionButton({ action }: AIActionButtonProps) {
  const [state, setState] = useState<ActionState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const { toast } = useToast();

  const executeAction = async () => {
    setState('loading');
    setErrorMessage('');

    try {
      if (action.type === 'update_price') {
        // Use update-product edge function
        const { data, error } = await supabase.functions.invoke('update-product', {
          body: {
            productId: action.product_id,
            selling_price: action.new_value,
            name: action.product_name,
            sku: action.sku,
          },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erro ao atualizar preço');

        const syncCount = data.syncResults?.filter((r: any) => r.success).length || 0;
        const totalSync = data.syncResults?.length || 0;

        setState('success');
        toast({
          title: "✅ Preço atualizado",
          description: totalSync > 0
            ? `${action.product_name}: R$ ${action.new_value.toFixed(2)} — sincronizado com ${syncCount}/${totalSync} marketplace(s)`
            : `${action.product_name}: R$ ${action.new_value.toFixed(2)}`,
        });
      } else if (action.type === 'update_stock') {
        // Use bulk-update-products edge function
        const { data, error } = await supabase.functions.invoke('bulk-update-products', {
          body: {
            productIds: [action.product_id],
            updates: {
              stock_mode: 'set',
              stock_value: action.new_value,
            },
          },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erro ao atualizar estoque');

        const syncCount = data.syncResults?.filter((r: any) => r.success).length || 0;
        const totalSync = data.syncResults?.length || 0;

        setState('success');
        toast({
          title: "✅ Estoque atualizado",
          description: totalSync > 0
            ? `${action.product_name}: ${action.new_value} unidades — sincronizado com ${syncCount}/${totalSync} marketplace(s)`
            : `${action.product_name}: ${action.new_value} unidades`,
        });
      }
    } catch (err: any) {
      console.error('Erro ao executar ação:', err);
      setState('error');
      setErrorMessage(err.message || 'Erro desconhecido');
      toast({
        title: "Erro ao aplicar alteração",
        description: err.message || 'Tente novamente.',
        variant: "destructive",
      });
    }
  };

  if (state === 'success') {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled
        className="gap-2 border-green-500/50 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
      >
        <Check className="h-3.5 w-3.5" />
        Aplicado
      </Button>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={executeAction}
          className="gap-2 border-destructive/50 text-destructive"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Tentar novamente
        </Button>
        {errorMessage && (
          <span className="text-xs text-destructive">{errorMessage}</span>
        )}
      </div>
    );
  }

  return (
    <Button
      size="sm"
      onClick={executeAction}
      disabled={state === 'loading'}
      className="gap-2"
    >
      {state === 'loading' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Zap className="h-3.5 w-3.5" />
      )}
      {action.label}
    </Button>
  );
}

// Parser function to extract action blocks from AI response
export function parseAIActions(content: string): { text: string; actions: AIAction[] } {
  const actionRegex = /:::action\s*\n([\s\S]*?)\n\s*:::/g;
  const actions: AIAction[] = [];
  const text = content.replace(actionRegex, (_, json) => {
    try {
      const parsed = JSON.parse(json.trim());
      if (parsed.type && parsed.product_id && parsed.label) {
        actions.push(parsed);
      }
    } catch {
      // Silently ignore malformed action blocks
    }
    return '';
  });
  return { text: text.trim(), actions };
}
