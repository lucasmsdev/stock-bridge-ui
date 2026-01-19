import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Printer, Download, Tag, Search, Package } from "lucide-react";
import { LabelPreview } from "./LabelPreview";
import { useLabelGenerator } from "./useLabelGenerator";
import { TEMPLATES, DEFAULT_LABEL_OPTIONS, type LabelOptions, type LabelTemplate } from "./LabelTemplates";

interface Product {
  id: string;
  name: string;
  sku: string;
  ean?: string | null;
  selling_price?: number | null;
  image_url?: string | null;
}

interface LabelGeneratorProps {
  preSelectedProducts?: Product[];
  onClose?: () => void;
}

export const LabelGenerator = ({ preSelectedProducts, onClose }: LabelGeneratorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { downloadPdf, printPdf } = useLabelGenerator();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>(preSelectedProducts || []);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<LabelTemplate>(TEMPLATES[0]);
  const [options, setOptions] = useState<LabelOptions>(DEFAULT_LABEL_OPTIONS);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Load products
  useEffect(() => {
    if (user && !preSelectedProducts) {
      loadProducts();
    }
    loadProfile();
  }, [user, preSelectedProducts]);

  const loadProducts = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, ean, selling_price, image_url")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error loading products:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os produtos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .single();

      if (data?.avatar_url) {
        setLogoUrl(data.avatar_url);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.ean && p.ean.includes(searchTerm))
  );

  const toggleProduct = (product: Product) => {
    setSelectedProducts((prev) => {
      const isSelected = prev.some((p) => p.id === product.id);
      if (isSelected) {
        return prev.filter((p) => p.id !== product.id);
      }
      return [...prev, product];
    });
  };

  const selectAll = () => {
    setSelectedProducts(filteredProducts);
  };

  const clearSelection = () => {
    setSelectedProducts([]);
  };

  const handleDownload = async () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "Nenhum produto selecionado",
        description: "Selecione pelo menos um produto para gerar etiquetas",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      await downloadPdf({
        products: selectedProducts,
        template: selectedTemplate,
        options,
        logoUrl: options.showLogo ? logoUrl : null,
      });

      toast({
        title: "PDF gerado!",
        description: `${selectedProducts.length * options.copies} etiquetas geradas com sucesso`,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o PDF",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = async () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "Nenhum produto selecionado",
        description: "Selecione pelo menos um produto para imprimir",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      await printPdf({
        products: selectedProducts,
        template: selectedTemplate,
        options,
        logoUrl: options.showLogo ? logoUrl : null,
      });

      toast({
        title: "Enviando para impressão...",
        description: "O PDF foi aberto em uma nova aba",
      });
    } catch (error) {
      console.error("Error printing:", error);
      toast({
        title: "Erro",
        description: "Não foi possível preparar a impressão",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const previewProduct = selectedProducts[0] || products[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Product Selection */}
      {!preSelectedProducts && (
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Produtos
            </CardTitle>
            <CardDescription>
              Selecione os produtos para gerar etiquetas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, SKU ou EAN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Selection controls */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Selecionar todos
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Limpar
              </Button>
            </div>

            {/* Products list */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredProducts.map((product) => {
                    const isSelected = selectedProducts.some((p) => p.id === product.id);
                    return (
                      <div
                        key={product.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleProduct(product)}
                      >
                        <Checkbox checked={isSelected} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            SKU: {product.sku}
                            {product.ean && ` • EAN: ${product.ean}`}
                          </p>
                        </div>
                        {product.selling_price && (
                          <Badge variant="secondary" className="text-xs">
                            R$ {product.selling_price.toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    );
                  })}

                  {filteredProducts.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum produto encontrado
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}

            <Separator />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Selecionados:</span>
              <Badge>{selectedProducts.length}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Options */}
      <Card className={preSelectedProducts ? "lg:col-span-2" : "lg:col-span-1"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Configurações
          </CardTitle>
          <CardDescription>
            Personalize suas etiquetas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Template selection */}
          <div className="space-y-2">
            <Label>Formato da Etiqueta</Label>
            <Select
              value={selectedTemplate.name}
              onValueChange={(value) => {
                const template = TEMPLATES.find((t) => t.name === value);
                if (template) setSelectedTemplate(template);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((template) => (
                  <SelectItem key={template.name} value={template.name}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedTemplate.format === "thermal"
                ? "Para impressoras térmicas de etiquetas"
                : `${selectedTemplate.labelsPerPage} etiquetas por folha`}
            </p>
          </div>

          <Separator />

          {/* Display options */}
          <div className="space-y-4">
            <Label className="text-base">Conteúdo da Etiqueta</Label>

            <div className="flex items-center justify-between">
              <Label htmlFor="showLogo" className="cursor-pointer">
                Mostrar logo da loja
              </Label>
              <Switch
                id="showLogo"
                checked={options.showLogo}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, showLogo: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="showPrice" className="cursor-pointer">
                Mostrar preço
              </Label>
              <Switch
                id="showPrice"
                checked={options.showPrice}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, showPrice: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="showSku" className="cursor-pointer">
                Mostrar SKU
              </Label>
              <Switch
                id="showSku"
                checked={options.showSku}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, showSku: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="showEan" className="cursor-pointer">
                Mostrar EAN
              </Label>
              <Switch
                id="showEan"
                checked={options.showEan}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, showEan: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="showBarcode" className="cursor-pointer">
                Código de barras
              </Label>
              <Switch
                id="showBarcode"
                checked={options.showBarcode}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, showBarcode: checked }))
                }
              />
            </div>
          </div>

          {options.showBarcode && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Tipo de Código de Barras</Label>
                <Select
                  value={options.barcodeType}
                  onValueChange={(value: "CODE128" | "EAN13") =>
                    setOptions((prev) => ({ ...prev, barcodeType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CODE128">CODE128 (SKU)</SelectItem>
                    <SelectItem value="EAN13">EAN-13 (requer EAN válido)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <Separator />

          {/* Copies */}
          <div className="space-y-2">
            <Label htmlFor="copies">Cópias por produto</Label>
            <Input
              id="copies"
              type="number"
              min={1}
              max={100}
              value={options.copies}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  copies: Math.max(1, parseInt(e.target.value) || 1),
                }))
              }
            />
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleDownload}
              disabled={selectedProducts.length === 0 || isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Baixar PDF
            </Button>
            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={selectedProducts.length === 0 || isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              Imprimir
            </Button>

            {onClose && (
              <Button variant="ghost" onClick={onClose} className="w-full">
                Fechar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Visualize como ficará a etiqueta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4 bg-muted/30 rounded-lg min-h-[300px]">
            {previewProduct ? (
              <LabelPreview
                product={previewProduct}
                template={selectedTemplate}
                options={options}
                logoUrl={options.showLogo ? logoUrl : null}
                scale={selectedTemplate.format === "thermal" ? 2 : 3}
              />
            ) : (
              <p className="text-muted-foreground text-center">
                Selecione um produto para ver o preview
              </p>
            )}
          </div>

          {preSelectedProducts && preSelectedProducts.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {preSelectedProducts.length} produto(s) selecionado(s) × {options.copies} cópia(s) ={" "}
                <span className="font-medium text-foreground">
                  {preSelectedProducts.length * options.copies} etiquetas
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
