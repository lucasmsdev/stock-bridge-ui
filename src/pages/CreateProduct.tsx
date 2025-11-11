import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, ShoppingCart } from "lucide-react";
import { PlatformLogo } from "@/components/ui/platform-logo";

interface Integration {
  id: string;
  platform: string;
  account_name: string | null;
}

export default function CreateProduct() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);

  // Product data
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [imageUrls, setImageUrls] = useState("");

  // Platform selection
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, boolean>>({});
  const [platformIntegrations, setPlatformIntegrations] = useState<Record<string, string>>({});
  const [platformData, setPlatformData] = useState<Record<string, any>>({});

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .in("platform", ["mercadolivre", "shopify", "shopee", "amazon"]);

      if (error) throw error;

      setIntegrations(data || []);
    } catch (error) {
      console.error("Error loading integrations:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as integrações",
        variant: "destructive",
      });
    } finally {
      setLoadingIntegrations(false);
    }
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !sku || !sellingPrice) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, SKU e preço de venda",
        variant: "destructive",
      });
      return;
    }

    const selectedPlatformsList = Object.keys(selectedPlatforms).filter(p => selectedPlatforms[p]);
    
    if (selectedPlatformsList.length === 0) {
      toast({
        title: "Selecione uma plataforma",
        description: "Escolha pelo menos uma plataforma para publicar",
        variant: "destructive",
      });
      return;
    }

    // Check if integrations are selected for each platform
    for (const platform of selectedPlatformsList) {
      if (!platformIntegrations[platform]) {
        toast({
          title: "Integração não selecionada",
          description: `Selecione uma conta para ${platform}`,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);

    try {
      const productData = {
        name,
        sku,
        cost_price: costPrice ? parseFloat(costPrice) : null,
        selling_price: parseFloat(sellingPrice),
        stock: stock ? parseInt(stock) : 0,
        description: description || null,
        category: category || null,
        brand: brand || null,
        weight: weight ? parseFloat(weight) : null,
        dimensions: {
          length: length ? parseFloat(length) : 0,
          width: width ? parseFloat(width) : 0,
          height: height ? parseFloat(height) : 0,
        },
        images: imageUrls ? imageUrls.split('\n').filter(url => url.trim()) : [],
        condition: 'new',
      };

      const platforms = selectedPlatformsList.map(platform => ({
        platform,
        integration_id: platformIntegrations[platform],
        platformData: platformData[platform] || {}
      }));

      const { data, error } = await supabase.functions.invoke('create-product-listing', {
        body: {
          productData,
          platforms
        }
      });

      if (error) throw error;

      // Check results
      const results = data.results;
      const successfulPlatforms = Object.keys(results).filter(p => results[p].success);
      const failedPlatforms = Object.keys(results).filter(p => !results[p].success);

      if (successfulPlatforms.length > 0) {
        toast({
          title: "Produto criado!",
          description: `Publicado com sucesso em: ${successfulPlatforms.join(', ')}`,
        });
      }

      if (failedPlatforms.length > 0) {
        toast({
          title: "Falha parcial",
          description: `Erro ao publicar em: ${failedPlatforms.join(', ')}`,
          variant: "destructive",
        });
      }

      navigate('/app/products');
    } catch (error) {
      console.error("Error creating product:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o produto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIntegrations = (platform: string) => {
    return integrations.filter(i => i.platform === platform);
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/app/products')}
          className="mb-4"
        >
          ← Voltar
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Package className="h-8 w-8" />
          Criar Novo Produto
        </h1>
        <p className="text-muted-foreground mt-2">
          Crie um produto e publique em múltiplas plataformas de uma vez
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>Dados essenciais do produto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nome do Produto *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Mouse Gamer RGB 7 Botões"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="MOUSE-001"
                  required
                />
              </div>
              <div>
                <Label htmlFor="costPrice">Preço de Custo</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="45.00"
                />
              </div>
              <div>
                <Label htmlFor="sellingPrice">Preço de Venda *</Label>
                <Input
                  id="sellingPrice"
                  type="number"
                  step="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="89.90"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="stock">Estoque Central</Label>
              <Input
                id="stock"
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="50"
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição detalhada do produto..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Eletrônicos"
                />
              </div>
              <div>
                <Label htmlFor="brand">Marca</Label>
                <Input
                  id="brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="TechGaming"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="images">URLs das Imagens (uma por linha)</Label>
              <Textarea
                id="images"
                value={imageUrls}
                onChange={(e) => setImageUrls(e.target.value)}
                placeholder="https://exemplo.com/imagem1.jpg&#10;https://exemplo.com/imagem2.jpg"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Shipping Information */}
        <Card>
          <CardHeader>
            <CardTitle>Informações de Envio</CardTitle>
            <CardDescription>Dados para cálculo de frete (opcional)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="weight">Peso (g)</Label>
                <Input
                  id="weight"
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="200"
                />
              </div>
              <div>
                <Label htmlFor="length">Comprimento (cm)</Label>
                <Input
                  id="length"
                  type="number"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  placeholder="20"
                />
              </div>
              <div>
                <Label htmlFor="width">Largura (cm)</Label>
                <Input
                  id="width"
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="15"
                />
              </div>
              <div>
                <Label htmlFor="height">Altura (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="8"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Platform Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Publicar em</CardTitle>
            <CardDescription>Selecione as plataformas onde deseja publicar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingIntegrations ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                {['mercadolivre', 'shopify', 'shopee', 'amazon'].map(platform => {
                  const platformIntegrationsList = getPlatformIntegrations(platform);
                  const hasIntegration = platformIntegrationsList.length > 0;

                  return (
                    <div key={platform} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={platform}
                          checked={selectedPlatforms[platform] || false}
                          onCheckedChange={() => handlePlatformToggle(platform)}
                          disabled={!hasIntegration}
                        />
                        <label
                          htmlFor={platform}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <PlatformLogo platform={platform} size="sm" />
                          <span className="font-medium capitalize">{platform}</span>
                        </label>
                      </div>

                      {selectedPlatforms[platform] && hasIntegration && (
                        <div className="ml-6 space-y-2">
                          <Label>Selecione a conta</Label>
                          <Select
                            value={platformIntegrations[platform] || ""}
                            onValueChange={(value) => setPlatformIntegrations(prev => ({
                              ...prev,
                              [platform]: value
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Escolha uma conta" />
                            </SelectTrigger>
                            <SelectContent>
                              {platformIntegrationsList.map(integration => (
                                <SelectItem key={integration.id} value={integration.id}>
                                  {integration.account_name || integration.platform}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {!hasIntegration && (
                        <p className="ml-6 text-sm text-muted-foreground">
                          Nenhuma conta conectada.{' '}
                          <Button
                            variant="link"
                            className="p-0 h-auto"
                            onClick={() => navigate('/app/integrations')}
                          >
                            Conectar agora
                          </Button>
                        </p>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/app/products')}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando produto...
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Publicar Produto
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
