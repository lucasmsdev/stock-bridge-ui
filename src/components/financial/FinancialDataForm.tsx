import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, DollarSign, Save, Package } from "lucide-react";
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
  image_url?: string;
}

interface FinancialDataFormProps {
  product: Product;
  onUpdate: (updatedProduct: Product) => void;
}

export function FinancialDataForm({ product, onUpdate }: FinancialDataFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: product.name || "",
    cost_price: product.cost_price?.toString() || "",
    selling_price: product.selling_price?.toString() || "",
    ad_spend: product.ad_spend?.toString() || "0",
    image_url: product.image_url || "",
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
        name: formData.name.trim(),
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        selling_price: formData.selling_price ? parseFloat(formData.selling_price) : null,
        ad_spend: formData.ad_spend ? parseFloat(formData.ad_spend) : 0,
        image_url: formData.image_url.trim() || null,
      };

      // Chama a Edge Function update-product para sincronizar com marketplaces
      const { data, error } = await supabase.functions.invoke('update-product', {
        body: {
          productId: product.id,
          name: updateData.name,
          sku: product.sku,
          cost_price: updateData.cost_price,
          selling_price: updateData.selling_price,
          ad_spend: updateData.ad_spend,
          stock: product.stock,
          image_url: updateData.image_url,
        }
      });

      if (error) throw error;

      // Update the product object and notify parent
      const updatedProduct = {
        ...product,
        ...updateData
      };
      onUpdate(updatedProduct);

      // Verifica resultado da sincronização
      if (data?.syncResults && data.syncResults.length > 0) {
        const amazonSync = data.syncResults.find((r: any) => r.platform === 'amazon');
        if (amazonSync) {
          if (amazonSync.success) {
            toast({
              title: "✅ Dados salvos e enviados!",
              description: "Alterações enviadas à Amazon. Podem levar até 15 minutos para refletir.",
            });
          } else if (amazonSync.requiresSellerId) {
            toast({
              title: "⚠️ Dados salvos localmente",
              description: "Configure o Seller ID em Integrações > Amazon para sincronizar.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "⚠️ Dados salvos localmente",
              description: `Erro ao sincronizar com Amazon: ${amazonSync.error || 'Erro desconhecido'}`,
              variant: "destructive",
            });
          }
          return;
        }
      }

      toast({
        title: "✅ Dados salvos com sucesso!",
        description: "Os dados foram atualizados.",
      });

    } catch (error: any) {
      console.error('Error updating financial data:', error);
      toast({
        title: "❌ Erro ao salvar os dados",
        description: error.message || "Não foi possível salvar os dados. Tente novamente.",
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
          <Package className="h-6 w-6 text-primary" />
          Dados do Produto
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Edite nome, imagem e dados financeiros. As alterações serão sincronizadas com os marketplaces.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seção: Informações do Produto */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Package className="h-4 w-4" />
            Informações do Produto
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Produto</Label>
              <Input
                id="name"
                type="text"
                placeholder="Nome do produto"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="image_url">URL da Imagem Principal</Label>
              <Input
                id="image_url"
                type="url"
                placeholder="https://exemplo.com/imagem.jpg"
                value={formData.image_url}
                onChange={(e) => handleInputChange('image_url', e.target.value)}
              />
            </div>
          </div>
          
          {formData.image_url && formData.image_url.startsWith('http') && (
            <div className="mt-2">
              <Label className="text-xs text-muted-foreground">Prévia da imagem:</Label>
              <div className="mt-1 w-24 h-24 rounded-md overflow-hidden border bg-muted">
                <img 
                  src={formData.image_url} 
                  alt="Prévia" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Seção: Dados Financeiros */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Dados Financeiros
          </h3>
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
        </div>

        <Button 
          onClick={handleSave} 
          disabled={isLoading || !formData.name.trim()}
          className="w-full md:w-auto transition-all duration-200 hover:shadow-primary"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando e sincronizando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar e Sincronizar
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
