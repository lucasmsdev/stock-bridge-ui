import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  cost_price: number | null;
  selling_price: number | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProducts: Product[];
  suppliers: Supplier[];
  onSuccess: () => void;
}

type StockMode = 'none' | 'set' | 'add' | 'subtract';

export function BulkEditDialog({
  open,
  onOpenChange,
  selectedProducts,
  suppliers,
  onSuccess,
}: BulkEditDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [sellingPrice, setSellingPrice] = useState("");
  const [skipSellingPrice, setSkipSellingPrice] = useState(true);
  
  const [costPrice, setCostPrice] = useState("");
  const [skipCostPrice, setSkipCostPrice] = useState(true);
  
  const [stockMode, setStockMode] = useState<StockMode>('none');
  const [stockValue, setStockValue] = useState("");
  
  const [supplierId, setSupplierId] = useState("");
  const [skipSupplier, setSkipSupplier] = useState(true);

  const resetForm = () => {
    setSellingPrice("");
    setSkipSellingPrice(true);
    setCostPrice("");
    setSkipCostPrice(true);
    setStockMode('none');
    setStockValue("");
    setSupplierId("");
    setSkipSupplier(true);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const parseMoneyValue = (value: string): number | null => {
    if (!value || value.trim() === '') return null;
    
    let cleaned = value
      .replace(/R\$\s*/gi, '')
      .replace(/\s/g, '')
      .trim();

    // BR format (comma as decimal): "1.234,56" or "19,90"
    const brPattern = /^[\d.]+,\d{1,2}$/;
    if (brPattern.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }

    const parsed = parseFloat(cleaned);
    if (isNaN(parsed) || parsed < 0) return null;
    
    return Math.round(parsed * 100) / 100;
  };

  const handleSubmit = async () => {
    // Build updates object
    const updates: Record<string, any> = {};
    
    if (!skipSellingPrice && sellingPrice) {
      const parsed = parseMoneyValue(sellingPrice);
      if (parsed !== null) {
        updates.selling_price = parsed;
      }
    }
    
    if (!skipCostPrice && costPrice) {
      const parsed = parseMoneyValue(costPrice);
      if (parsed !== null) {
        updates.cost_price = parsed;
      }
    }
    
    if (stockMode !== 'none' && stockValue) {
      const parsed = parseInt(stockValue);
      if (!isNaN(parsed) && parsed >= 0) {
        updates.stock_mode = stockMode;
        updates.stock_value = parsed;
      }
    }
    
    if (!skipSupplier) {
      updates.supplier_id = supplierId === '__none__' ? null : (supplierId || null);
    }

    // Check if any updates were selected
    if (Object.keys(updates).length === 0) {
      toast({
        title: "⚠️ Nenhuma alteração selecionada",
        description: "Selecione pelo menos um campo para atualizar.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "❌ Erro de autenticação",
          description: "Faça login novamente para continuar.",
          variant: "destructive",
        });
        return;
      }

      const productIds = selectedProducts.map(p => p.id);

      const { data, error } = await supabase.functions.invoke('bulk-update-products', {
        body: { productIds, updates },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Bulk update error:', error);
        toast({
          title: "❌ Erro ao atualizar produtos",
          description: error.message || "Não foi possível atualizar os produtos.",
          variant: "destructive",
        });
        return;
      }

      // Build success message
      let description = `${data.updated} produto${data.updated !== 1 ? 's' : ''} atualizado${data.updated !== 1 ? 's' : ''}.`;
      
      if (data.totalListings > 0) {
        description += ` ${data.synced}/${data.totalListings} listings sincronizados com marketplaces.`;
      }

      if (data.errors && data.errors.length > 0) {
        description += ` ${data.errors.length} erro${data.errors.length !== 1 ? 's' : ''}.`;
      }

      toast({
        title: "✅ Edição em massa concluída!",
        description,
      });

      handleClose();
      onSuccess();
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: "❌ Erro inesperado",
        description: "Ocorreu um erro ao processar a edição em massa.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Editar {selectedProducts.length} Produto{selectedProducts.length !== 1 ? 's' : ''} em Massa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Selling Price */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sellingPrice">Preço de Venda</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="skipSellingPrice"
                  checked={skipSellingPrice}
                  onCheckedChange={(checked) => setSkipSellingPrice(checked as boolean)}
                />
                <Label htmlFor="skipSellingPrice" className="text-sm text-muted-foreground">
                  Não alterar
                </Label>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                id="sellingPrice"
                placeholder="0,00"
                className="pl-10"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                disabled={skipSellingPrice}
              />
            </div>
          </div>

          {/* Cost Price */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="costPrice">Preço de Custo</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="skipCostPrice"
                  checked={skipCostPrice}
                  onCheckedChange={(checked) => setSkipCostPrice(checked as boolean)}
                />
                <Label htmlFor="skipCostPrice" className="text-sm text-muted-foreground">
                  Não alterar
                </Label>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                id="costPrice"
                placeholder="0,00"
                className="pl-10"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                disabled={skipCostPrice}
              />
            </div>
          </div>

          {/* Stock Adjustment */}
          <div className="space-y-3">
            <Label>Estoque</Label>
            <RadioGroup value={stockMode} onValueChange={(v) => setStockMode(v as StockMode)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="none" id="stockNone" />
                <Label htmlFor="stockNone" className="font-normal">Não alterar</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="set" id="stockSet" />
                <Label htmlFor="stockSet" className="font-normal">Definir valor:</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  className="w-24"
                  value={stockMode === 'set' ? stockValue : ''}
                  onChange={(e) => {
                    setStockMode('set');
                    setStockValue(e.target.value);
                  }}
                  disabled={stockMode !== 'set'}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="add" id="stockAdd" />
                <Label htmlFor="stockAdd" className="font-normal">Adicionar:</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  className="w-24"
                  value={stockMode === 'add' ? stockValue : ''}
                  onChange={(e) => {
                    setStockMode('add');
                    setStockValue(e.target.value);
                  }}
                  disabled={stockMode !== 'add'}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="subtract" id="stockSubtract" />
                <Label htmlFor="stockSubtract" className="font-normal">Subtrair:</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  className="w-24"
                  value={stockMode === 'subtract' ? stockValue : ''}
                  onChange={(e) => {
                    setStockMode('subtract');
                    setStockValue(e.target.value);
                  }}
                  disabled={stockMode !== 'subtract'}
                />
              </div>
            </RadioGroup>
          </div>

          {/* Supplier */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="supplier">Fornecedor</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="skipSupplier"
                  checked={skipSupplier}
                  onCheckedChange={(checked) => setSkipSupplier(checked as boolean)}
                />
                <Label htmlFor="skipSupplier" className="text-sm text-muted-foreground">
                  Não alterar
                </Label>
              </div>
            </div>
            <Select
              value={supplierId}
              onValueChange={setSupplierId}
              disabled={skipSupplier}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um fornecedor" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                <SelectItem value="__none__">Nenhum (remover vínculo)</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aplicar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
