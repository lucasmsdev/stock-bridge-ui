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
import { usePlan } from "@/hooks/usePlan";
import { UpgradeBanner } from "@/components/ui/upgrade-banner";

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
  const { canAccess, getUpgradeRequiredMessage } = usePlan();

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
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Financeiro</h1>
        <p className="text-muted-foreground">
          Gerencie preços, custos e analise a lucratividade dos seus produtos
        </p>
      </div>

      <Tabs defaultValue="calculator" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calculator">Calculadora de Precificação</TabsTrigger>
          <TabsTrigger value="advanced" disabled={!canAccess('RelatoriosAvancados')}>
            Relatórios Avançados
          </TabsTrigger>
        </TabsList>

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

        {/* Advanced Reports Tab */}
        <TabsContent value="advanced" className="space-y-6">
          {canAccess('RelatoriosAvancados') ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Análise de ROI por Produto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Relatório de ROI em desenvolvimento</p>
                    <p className="text-sm">Análise detalhada de retorno sobre investimento por produto</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Projeção de Lucros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Projeções de lucro em desenvolvimento</p>
                    <p className="text-sm">Previsões baseadas em histórico de vendas</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <UpgradeBanner
              title="Relatórios Avançados"
              description="Acesse análises detalhadas de ROI, projeções de lucro e relatórios personalizados"
              requiredPlan="competidor"
              feature="RelatoriosAvancados"
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}