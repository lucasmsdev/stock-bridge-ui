import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  sku: string;
  cost_price: number | null;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
}

interface PurchaseOrderFormProps {
  supplierId: string;
  onSaved: () => void;
  onCancel: () => void;
}

export const PurchaseOrderForm = ({ supplierId, onSaved, onCancel }: PurchaseOrderFormProps) => {
  const { user } = useAuthSession();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const [orderNumber, setOrderNumber] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    loadProducts();
    generateOrderNumber();
  }, []);

  const loadProducts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, cost_price")
      .eq("user_id", user.id)
      .order("name");

    if (!error && data) {
      setProducts(data);
    }
  };

  const generateOrderNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    setOrderNumber(`PC-${timestamp}`);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      { product_id: "", product_name: "", quantity: 1, unit_cost: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...items];
    
    if (field === "product_id") {
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index] = {
          ...newItems[index],
          product_id: product.id,
          product_name: product.name,
          unit_cost: product.cost_price || 0,
        };
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (items.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um item ao pedido.",
        variant: "destructive",
      });
      return;
    }

    const invalidItems = items.filter((item) => !item.product_id || item.quantity <= 0);
    if (invalidItems.length > 0) {
      toast({
        title: "Erro",
        description: "Preencha todos os itens corretamente.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const orderItems = items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
      }));

      const { error } = await supabase.from("purchase_orders").insert({
        user_id: user.id,
        supplier_id: supplierId,
        order_number: orderNumber,
        status: "pending",
        total_value: calculateTotal(),
        items: orderItems,
        expected_delivery: expectedDelivery || null,
        notes: notes.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "Pedido criado",
        description: `Pedido ${orderNumber} foi registrado com sucesso.`,
      });
      onSaved();
    } catch (error) {
      console.error("Error creating purchase order:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o pedido.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="order_number" className="text-foreground">Número do Pedido</Label>
          <Input
            id="order_number"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className="bg-background border-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expected_delivery" className="text-foreground">Previsão de Entrega</Label>
          <Input
            id="expected_delivery"
            type="date"
            value={expectedDelivery}
            onChange={(e) => setExpectedDelivery(e.target.value)}
            className="bg-background border-input"
          />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Itens do Pedido</Label>
          <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Item
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground">Nenhum item adicionado.</p>
            <Button
              type="button"
              variant="ghost"
              className="mt-2"
              onClick={handleAddItem}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Primeiro Item
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/50 rounded-lg"
              >
                <div className="col-span-5 space-y-1">
                  <Label className="text-xs text-muted-foreground">Produto</Label>
                  <Select
                    value={item.product_id}
                    onValueChange={(value) => handleItemChange(index, "product_id", value)}
                  >
                    <SelectTrigger className="bg-background border-input">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-muted-foreground">Qtd</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      handleItemChange(index, "quantity", parseInt(e.target.value) || 1)
                    }
                    className="bg-background border-input"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-muted-foreground">Custo Unit.</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_cost}
                    onChange={(e) =>
                      handleItemChange(index, "unit_cost", parseFloat(e.target.value) || 0)
                    }
                    className="bg-background border-input"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-muted-foreground">Subtotal</Label>
                  <div className="h-10 flex items-center px-3 bg-background border border-input rounded-md text-foreground">
                    {formatCurrency(item.quantity * item.unit_cost)}
                  </div>
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        {items.length > 0 && (
          <div className="flex justify-end pt-4 border-t border-border">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total do Pedido</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(calculateTotal())}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-foreground">Observações</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anotações sobre o pedido..."
          rows={3}
          className="bg-background border-input resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading || items.length === 0}
          className="bg-gradient-primary text-primary-foreground"
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Criar Pedido
        </Button>
      </div>
    </form>
  );
};
