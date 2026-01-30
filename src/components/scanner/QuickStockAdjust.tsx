import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Minus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/integrations/supabase/types';

interface QuickStockAdjustProps {
  product: Tables<'products'>;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const QuickStockAdjust = ({ 
  product, 
  isOpen, 
  onClose,
  onSuccess 
}: QuickStockAdjustProps) => {
  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: 'Quantidade inválida',
        description: 'Informe uma quantidade válida maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    const newStock = adjustType === 'add' 
      ? product.stock + qty 
      : product.stock - qty;

    if (newStock < 0) {
      toast({
        title: 'Estoque insuficiente',
        description: `O estoque atual é ${product.stock} unidades. Não é possível remover ${qty}.`,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', product.id);

      if (error) throw error;

      toast({
        title: 'Estoque atualizado',
        description: `${product.name}: ${product.stock} → ${newStock} unidades`,
      });

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', product.id] });

      onSuccess?.();
      handleClose();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message || 'Não foi possível atualizar o estoque.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setQuantity('');
    setReason('');
    setAdjustType('add');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar Estoque</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Produto info */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium">{product.name}</p>
            <p className="text-sm text-muted-foreground">
              Estoque atual: <span className="font-medium">{product.stock} unidades</span>
            </p>
          </div>

          {/* Tipo de ajuste */}
          <div className="space-y-2">
            <Label>Tipo de ajuste</Label>
            <RadioGroup
              value={adjustType}
              onValueChange={(v) => setAdjustType(v as 'add' | 'remove')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="add" id="add" />
                <Label htmlFor="add" className="flex items-center gap-1 cursor-pointer">
                  <Plus className="h-4 w-4 text-primary" />
                  Entrada
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="remove" id="remove" />
                <Label htmlFor="remove" className="flex items-center gap-1 cursor-pointer">
                  <Minus className="h-4 w-4 text-destructive" />
                  Saída
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Quantidade */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantidade</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ex: 10"
              autoFocus
            />
            {quantity && !isNaN(parseInt(quantity)) && (
              <p className="text-sm text-muted-foreground">
                Novo estoque: <span className="font-medium">
                  {adjustType === 'add' 
                    ? product.stock + parseInt(quantity) 
                    : product.stock - parseInt(quantity)
                  } unidades
                </span>
              </p>
            )}
          </div>

          {/* Motivo (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Recebimento de mercadoria, venda avulsa..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !quantity}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
