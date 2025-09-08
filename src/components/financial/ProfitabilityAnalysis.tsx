import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Target, DollarSign, Percent } from "lucide-react";

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

interface ProfitabilityAnalysisProps {
  product: Product;
  centralStock: number;
}

export function ProfitabilityAnalysis({ product, centralStock }: ProfitabilityAnalysisProps) {
  const { cost_price, selling_price, ad_spend } = product;

  // Don't show if no financial data
  if (!cost_price || !selling_price) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            Análise de Lucratividade
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            Configure os dados financeiros para ver a análise de lucratividade
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculations
  const grossProfit = selling_price - cost_price;
  const grossMargin = (grossProfit / selling_price) * 100;
  const totalRevenue = selling_price * centralStock;
  const totalStockCost = cost_price * centralStock;

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          Análise de Lucratividade
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Baseado nos dados financeiros configurados
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Gross Margin */}
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
            <div className="flex items-center justify-center mb-2">
              <Percent className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {grossMargin.toFixed(1)}%
            </div>
            <p className="text-sm text-green-600 dark:text-green-500 font-medium">
              Margem de Lucro Bruta
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              R$ {grossProfit.toFixed(2)} por unidade
            </p>
          </div>

          {/* Total Revenue */}
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
            <div className="flex items-center justify-center mb-2">
              <Target className="h-8 w-8 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-500 font-medium">
              Faturamento Estimado
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {centralStock} unidades em estoque
            </p>
          </div>

          {/* Total Stock Cost */}
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="h-8 w-8 text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              R$ {totalStockCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-orange-600 dark:text-orange-500 font-medium">
              Custo Total do Estoque
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Investimento atual
            </p>
          </div>
        </div>

        {/* Ad Spend Info */}
        {ad_spend && ad_spend > 0 && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-medium">Gasto com Anúncios</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total investido:</span>
                <div className="font-medium">R$ {ad_spend.toFixed(2)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">ROI potencial:</span>
                <div className="font-medium">
                  {((grossProfit / ad_spend) * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}