import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, DollarSign, Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string;
  name: string;
  sku: string;
  image_url?: string;
  cost_price?: number;
  selling_price?: number;
  ad_spend?: number;
}

interface CalculatorData {
  costPrice: string;
  marketplaceFees: string;
  taxes: string;
  shippingCost: string;
  adSpend: string;
  desiredMargin: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const calculateMargin = (costPrice: number, sellingPrice: number) => {
  if (sellingPrice === 0) return 0;
  return ((sellingPrice - costPrice) / sellingPrice) * 100;
};

export default function Finance() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Calculator state
  const [calculatorData, setCalculatorData] = useState<CalculatorData>({
    costPrice: '',
    marketplaceFees: '16',
    taxes: '8',
    shippingCost: '',
    adSpend: '',
    desiredMargin: '20'
  });

  // Additional state for simulation section
  const [simulationPrice, setSimulationPrice] = useState('');

  const loadProducts = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, image_url, cost_price, selling_price, ad_spend')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      toast({
        title: "❌ Erro ao carregar produtos financeiros",
        description: "Não foi possível carregar os dados financeiros. Tente atualizar a página.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [user]);

  const handleCalculatorChange = (field: keyof CalculatorData, value: string) => {
    setCalculatorData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Calculator calculations
  const costPrice = parseFloat(calculatorData.costPrice) || 0;
  const marketplaceFees = parseFloat(calculatorData.marketplaceFees) || 0;
  const taxes = parseFloat(calculatorData.taxes) || 0;
  const shippingCost = parseFloat(calculatorData.shippingCost) || 0;
  const adSpend = parseFloat(calculatorData.adSpend) || 0;
  const desiredMargin = parseFloat(calculatorData.desiredMargin) || 0;

  // Section 1: Calculate Ideal Price
  const totalCosts = costPrice + shippingCost + adSpend;
  const idealSellingPrice = totalCosts / (1 - (desiredMargin + marketplaceFees + taxes) / 100);
  const idealMarketplaceFeeAmount = (idealSellingPrice * marketplaceFees) / 100;
  const idealTaxAmount = (idealSellingPrice * taxes) / 100;
  const idealGrossProfit = idealSellingPrice - totalCosts - idealMarketplaceFeeAmount - idealTaxAmount;

  // Section 2: Simulate with User Price
  const userPrice = parseFloat(simulationPrice) || 0;
  const userMarketplaceFeeAmount = (userPrice * marketplaceFees) / 100;
  const userTaxAmount = (userPrice * taxes) / 100;
  const userGrossProfit = userPrice - totalCosts - userMarketplaceFeeAmount - userTaxAmount;
  const actualMargin = userPrice > 0 ? (userGrossProfit / userPrice) * 100 : 0;
  const roi = adSpend > 0 ? (userGrossProfit / adSpend) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground">
          Gerencie preços, custos e analise a lucratividade dos seus produtos
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="calculator">Calculadora de Precificação</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Análise Financeira dos Produtos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Carregando produtos...</span>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">Nenhum produto encontrado</p>
                  <p className="text-sm text-muted-foreground">
                    Adicione produtos para ver a análise financeira
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Preço de Custo</TableHead>
                        <TableHead>Preço de Venda</TableHead>
                        <TableHead>Gasto com Anúncios</TableHead>
                        <TableHead>Margem de Lucro</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => {
                        const margin = product.cost_price && product.selling_price 
                          ? calculateMargin(product.cost_price, product.selling_price)
                          : 0;
                        
                        return (
                          <TableRow key={product.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {product.image_url && (
                                  <img 
                                    src={product.image_url} 
                                    alt={product.name}
                                    className="w-10 h-10 rounded-md object-cover"
                                  />
                                )}
                                <span className="font-medium">{product.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{product.sku}</Badge>
                            </TableCell>
                            <TableCell>
                              {product.cost_price 
                                ? formatCurrency(product.cost_price)
                                : <span className="text-muted-foreground">-</span>
                              }
                            </TableCell>
                            <TableCell>
                              {product.selling_price 
                                ? formatCurrency(product.selling_price)
                                : <span className="text-muted-foreground">-</span>
                              }
                            </TableCell>
                            <TableCell>
                              {product.ad_spend 
                                ? formatCurrency(product.ad_spend)
                                : <span className="text-muted-foreground">R$ 0,00</span>
                              }
                            </TableCell>
                            <TableCell>
                              {product.cost_price && product.selling_price ? (
                                <Badge 
                                  variant={margin >= 20 ? "default" : margin >= 10 ? "secondary" : "destructive"}
                                >
                                  {margin.toFixed(1)}%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => navigate(`/products/${product.id}`)}
                              >
                                Editar
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calculator Tab */}
        <TabsContent value="calculator" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Calculator Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Dados de Entrada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="costPrice">Preço de Custo do Produto (R$)</Label>
                  <Input
                    id="costPrice"
                    type="number"
                    step="0.01"
                    value={calculatorData.costPrice}
                    onChange={(e) => handleCalculatorChange('costPrice', e.target.value)}
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marketplaceFees">Taxas do Marketplace (%)</Label>
                  <Input
                    id="marketplaceFees"
                    type="number"
                    step="0.1"
                    value={calculatorData.marketplaceFees}
                    onChange={(e) => handleCalculatorChange('marketplaceFees', e.target.value)}
                    placeholder="16"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxes">Impostos (%)</Label>
                  <Input
                    id="taxes"
                    type="number"
                    step="0.1"
                    value={calculatorData.taxes}
                    onChange={(e) => handleCalculatorChange('taxes', e.target.value)}
                    placeholder="8"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shippingCost">Custo de Envio (R$)</Label>
                  <Input
                    id="shippingCost"
                    type="number"
                    step="0.01"
                    value={calculatorData.shippingCost}
                    onChange={(e) => handleCalculatorChange('shippingCost', e.target.value)}
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adSpend">Gasto com Anúncios por Venda (R$)</Label>
                  <Input
                    id="adSpend"
                    type="number"
                    step="0.01"
                    value={calculatorData.adSpend}
                    onChange={(e) => handleCalculatorChange('adSpend', e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section 1: Calculate Ideal Price */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Calcular Preço Ideal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="desiredMargin">Margem de Lucro Desejada (%)</Label>
                  <Input
                    id="desiredMargin"
                    type="number"
                    step="0.1"
                    value={calculatorData.desiredMargin}
                    onChange={(e) => handleCalculatorChange('desiredMargin', e.target.value)}
                    placeholder="20"
                  />
                </div>

                {costPrice > 0 ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg border">
                      <h3 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-2">
                        Preço de Venda Ideal
                      </h3>
                      <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(idealSellingPrice)}
                      </p>
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Lucro Bruto por Venda</p>
                      <p className="text-xl font-semibold text-foreground">
                        {formatCurrency(idealGrossProfit)}
                      </p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <h4 className="font-medium text-foreground">Custos Calculados:</h4>
                      <div className="space-y-1 text-muted-foreground">
                        <p>• Taxa marketplace: {formatCurrency(idealMarketplaceFeeAmount)}</p>
                        <p>• Impostos: {formatCurrency(idealTaxAmount)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Preencha os dados para calcular o preço ideal</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section 2: Simulate with User Price */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                  Simular com Meu Preço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="simulationPrice">Seu Preço de Venda (R$)</Label>
                  <Input
                    id="simulationPrice"
                    type="number"
                    step="0.01"
                    value={simulationPrice}
                    onChange={(e) => setSimulationPrice(e.target.value)}
                    placeholder="0,00"
                  />
                </div>

                {userPrice > 0 && costPrice > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
                        <p className="text-sm text-blue-600 dark:text-blue-500">Margem de Lucro Realizada</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                          {actualMargin.toFixed(1)}%
                        </p>
                      </div>

                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Lucro Bruto por Venda</p>
                        <p className="text-xl font-semibold text-foreground">
                          {formatCurrency(userGrossProfit)}
                        </p>
                      </div>

                      {adSpend > 0 && (
                        <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
                          <p className="text-sm text-purple-600 dark:text-purple-500">ROI do Anúncio</p>
                          <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                            {roi.toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <h4 className="font-medium text-foreground">Detalhamento dos Custos:</h4>
                      <div className="space-y-1 text-muted-foreground">
                        <p>• Custo do produto: {formatCurrency(costPrice)}</p>
                        <p>• Custo de envio: {formatCurrency(shippingCost)}</p>
                        <p>• Gasto com anúncios: {formatCurrency(adSpend)}</p>
                        <p>• Taxa marketplace: {formatCurrency(userMarketplaceFeeAmount)}</p>
                        <p>• Impostos: {formatCurrency(userTaxAmount)}</p>
                        <hr className="border-t my-1" />
                        <p className="font-medium">• Total custos: {formatCurrency(totalCosts + userMarketplaceFeeAmount + userTaxAmount)}</p>
                      </div>
                    </div>

                    {actualMargin < 10 && (
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <p className="text-sm text-destructive font-medium">
                          ⚠️ Margem muito baixa (menos de 10%)
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Insira seu preço para simular o cenário</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}