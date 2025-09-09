import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, DollarSign, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  cost_price?: number;
  selling_price?: number;
  ad_spend?: number;
}

interface FinancialDataFormProps {
  product: Product;
  onUpdate: (updatedProduct: Product) => void;
}

export function FinancialDataForm({ product, onUpdate }: FinancialDataFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    cost_price: product.cost_price?.toString() || "",
    selling_price: product.selling_price?.toString() || "",
    ad_spend: product.ad_spend?.toString() || "0",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const updateData = {
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        selling_price: formData.selling_price ? parseFloat(formData.selling_price) : null,
        ad_spend: formData.ad_spend ? parseFloat(formData.ad_spend) : 0,
      };

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', product.id);

      if (error) throw error;

      // Update the product object and notify parent
      const updatedProduct = {
        ...product,
        ...updateData
      };
      onUpdate(updatedProduct);

      toast({
        title: "✅ Dados salvos com sucesso!",
        description: "Os dados financeiros foram atualizados com sucesso.",
      });

    } catch (error) {
      console.error('Error updating financial data:', error);
      toast({
        title: "❌ Erro ao salvar os dados",
        description: "Não foi possível salvar os dados financeiros. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <DollarSign className="h-6 w-6 text-primary" />
          Dados Financeiros
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure os custos e preços para análise de lucratividade
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cost_price">Preço de Custo (R$)</Label>
            <Input
              id="cost_price"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.cost_price}
              onChange={(e) => handleInputChange('cost_price', e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="selling_price">Preço de Venda (R$)</Label>
            <Input
              id="selling_price"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.selling_price}
              onChange={(e) => handleInputChange('selling_price', e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="ad_spend">Gasto com Anúncios (R$)</Label>
            <Input
              id="ad_spend"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.ad_spend}
              onChange={(e) => handleInputChange('ad_spend', e.target.value)}
            />
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={isLoading}
          className="w-full md:w-auto"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isLoading ? "Salvando..." : "Salvar Dados Financeiros"}
        </Button>
      </CardContent>
    </Card>
  );
}