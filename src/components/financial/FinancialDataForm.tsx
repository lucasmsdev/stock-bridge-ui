import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, DollarSign, Save, Package, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  description?: string;
}

interface FinancialDataFormProps {
  product: Product;
  onUpdate: (updatedProduct: Product) => void;
}

interface AmazonSyncResult {
  platform: string;
  success: boolean;
  message?: string;
  error?: string;
  requiresSellerId?: boolean;
  sentData?: {
    price: number | null;
    name: string | null;
    imageUrl: string | null;
    currency: string;
    marketplace: string;
    productType: string;
  };
  observedAmazonPrice?: number | null;
  observedAmazonTitle?: string | null;
  observedAmazonMainImage?: string | null;
  submissionId?: string | null;
  issues?: any[];
  nameMayNotChange?: boolean;
}

/**
 * Normaliza valor monetário para número
 * Aceita: "1.234,56" (BR), "1234.56" (US), "R$ 19,90", etc.
 */
function normalizeMoneyToNumber(input: string): number | null {
  if (!input || input.trim() === '') {
    return null;
  }

  let cleaned = input
    .replace(/R\$\s*/gi, '')  // Remove "R$"
    .replace(/\s/g, '')       // Remove espaços
    .trim();

  // Detectar formato BR (vírgula como decimal)
  const brPattern = /^[\d.]+,\d{1,2}$/;
  if (brPattern.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function formatMoneyBR(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.toFixed(2);
}

export function FinancialDataForm({ product, onUpdate }: FinancialDataFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<AmazonSyncResult | null>(null);
  const [formData, setFormData] = useState({
    name: product.name || "",
    cost_price: formatMoneyBR(product.cost_price),
    selling_price: formatMoneyBR(product.selling_price),
    ad_spend: formatMoneyBR(product.ad_spend) || "0",
    image_url: product.image_url || "",
    description: product.description || "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    setSyncFeedback(null);
    
    try {
      const costPrice = normalizeMoneyToNumber(formData.cost_price);
      const sellingPrice = normalizeMoneyToNumber(formData.selling_price);
      const adSpend = normalizeMoneyToNumber(formData.ad_spend) || 0;

      console.log('📤 Enviando dados:', {
        cost_price_normalized: costPrice,
        selling_price_normalized: sellingPrice,
        ad_spend_normalized: adSpend,
      });

      const updateData = {
        name: formData.name.trim(),
        cost_price: costPrice,
        selling_price: sellingPrice,
        ad_spend: adSpend,
        image_url: formData.image_url.trim() || null,
        description: formData.description.trim() || null,
      };

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
          description: updateData.description,
        }
      });

      if (error) throw error;

      const updatedProduct = {
        ...product,
        ...updateData
      };
      onUpdate(updatedProduct);

      // Processar resultado da sincronização Amazon
      if (data?.syncResults && data.syncResults.length > 0) {
        const amazonSync = data.syncResults.find((r: AmazonSyncResult) => r.platform === 'amazon');
        if (amazonSync) {
          setSyncFeedback(amazonSync);

          if (amazonSync.success) {
            const priceInfo = amazonSync.sentData?.price 
              ? `R$ ${amazonSync.sentData.price.toFixed(2)}` 
              : '';
            const observedInfo = amazonSync.observedAmazonPrice 
              ? `R$ ${amazonSync.observedAmazonPrice.toFixed(2)}` 
              : 'aguardando...';
            
            toast({
              title: "Dados enviados para Amazon",
              description: `Preço enviado: ${priceInfo} | Lido: ${observedInfo}`,
            });

            // Alertar sobre nome que pode não mudar
            if (amazonSync.nameMayNotChange) {
              toast({
                title: "Título pode não mudar",
                description: "A Amazon mantém o título do catálogo (ASIN). Edite no Seller Central se precisar.",
                variant: "destructive",
              });
            }
          } else if (amazonSync.requiresSellerId) {
            toast({
              title: "Seller ID necessário",
              description: "Configure o Seller ID em Integrações > Amazon.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erro na sincronização",
              description: amazonSync.error || 'Erro desconhecido',
              variant: "destructive",
            });
          }
          return;
        }
      }

      toast({
        title: "Dados salvos",
        description: "Produto atualizado com sucesso.",
      });

    } catch (error: any) {
      console.error('Error updating financial data:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const previewSellingPrice = normalizeMoneyToNumber(formData.selling_price);

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
        {/* Feedback de Sincronização Amazon */}
        {syncFeedback && (
          <Alert variant={syncFeedback.success ? "default" : "destructive"}>
            {syncFeedback.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertTitle>
              {syncFeedback.success ? "Amazon Sincronizado" : "Erro na Amazon"}
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              {syncFeedback.success ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {syncFeedback.sentData?.price && (
                      <div>
                        <span className="font-medium">Preço enviado:</span>{" "}
                        R$ {syncFeedback.sentData.price.toFixed(2)} ({syncFeedback.sentData.currency})
                      </div>
                    )}
                    {syncFeedback.observedAmazonPrice !== null && syncFeedback.observedAmazonPrice !== undefined && (
                      <div>
                        <span className="font-medium">Amazon leu:</span>{" "}
                        R$ {syncFeedback.observedAmazonPrice.toFixed(2)}
                      </div>
                    )}
                    {syncFeedback.observedAmazonTitle && (
                      <div className="col-span-2">
                        <span className="font-medium">Título na Amazon:</span>{" "}
                        {syncFeedback.observedAmazonTitle}
                      </div>
                    )}
                  </div>
                  {syncFeedback.nameMayNotChange && (
                    <Alert className="mt-2 border-yellow-500/50 bg-yellow-500/10">
                      <Info className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-sm text-yellow-700 dark:text-yellow-400">
                        A Amazon está mantendo o título do catálogo (ASIN). Para alterar, você precisa 
                        permissão de contribuição (Brand Registry) ou editar em "Detalhes da página do produto" no Seller Central.
                      </AlertDescription>
                    </Alert>
                  )}
                  {syncFeedback.issues && syncFeedback.issues.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-500/10 rounded text-sm">
                      <span className="font-medium text-yellow-700 dark:text-yellow-400">Avisos da Amazon:</span>
                      <ul className="list-disc list-inside mt-1 text-yellow-600 dark:text-yellow-300">
                        {syncFeedback.issues.slice(0, 3).map((issue: any, i: number) => (
                          <li key={i}>{issue.message || JSON.stringify(issue)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Submission ID: {syncFeedback.submissionId || 'N/A'} • Pode levar até 15 min para refletir no Seller Central.
                  </p>
                </>
              ) : (
                <p>{syncFeedback.error}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

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

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição do Produto</Label>
            <Textarea
              id="description"
              placeholder="Descreva seu produto em detalhes..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              maxLength={4000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {formData.description?.length || 0}/4000 caracteres
            </p>
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
                type="text"
                inputMode="decimal"
                placeholder="0.00 ou 0,00"
                value={formData.cost_price}
                onChange={(e) => handleInputChange('cost_price', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="selling_price">Preço de Venda (R$)</Label>
              <Input
                id="selling_price"
                type="text"
                inputMode="decimal"
                placeholder="0.00 ou 0,00"
                value={formData.selling_price}
                onChange={(e) => handleInputChange('selling_price', e.target.value)}
              />
              {previewSellingPrice !== null && formData.selling_price && (
                <p className="text-xs text-muted-foreground">
                  Será enviado: R$ {previewSellingPrice.toFixed(2)}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ad_spend">Gasto com Anúncios (R$)</Label>
              <Input
                id="ad_spend"
                type="text"
                inputMode="decimal"
                placeholder="0.00 ou 0,00"
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
