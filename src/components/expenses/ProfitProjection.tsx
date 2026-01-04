import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  Calculator,
  Target,
  AlertTriangle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Expense } from "@/pages/Expenses";
import { cn } from "@/lib/utils";

interface ProfitProjectionProps {
  expenses: Expense[];
  targetMarginPercent?: number;
}

interface SalesMetrics {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  avgDailyRevenue: number;
  avgDailyOrders: number;
}

export function ProfitProjection({ expenses, targetMarginPercent = 30 }: ProfitProjectionProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salesMetrics, setSalesMetrics] = useState<SalesMetrics>({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    avgDailyRevenue: 0,
    avgDailyOrders: 0,
  });
  
  // Simulation controls
  const [salesMultiplier, setSalesMultiplier] = useState(100); // percentage
  const [customMonthlyRevenue, setCustomMonthlyRevenue] = useState<string>("");
  const [useCustomRevenue, setUseCustomRevenue] = useState(false);

  // Calculate monthly expenses
  const totalMonthlyExpenses = useMemo(() => {
    return expenses
      .filter(e => e.is_active)
      .reduce((total, expense) => {
        let monthlyAmount = expense.amount;
        switch (expense.recurrence) {
          case 'weekly':
            monthlyAmount = expense.amount * 4.33;
            break;
          case 'yearly':
            monthlyAmount = expense.amount / 12;
            break;
          case 'one-time':
            monthlyAmount = 0; // One-time expenses don't count monthly
            break;
        }
        return total + monthlyAmount;
      }, 0);
  }, [expenses]);

  // Fetch sales data from last 30 days
  useEffect(() => {
    const fetchSalesData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: orders, error } = await supabase
          .from('orders')
          .select('total_value, order_date')
          .eq('user_id', user.id)
          .gte('order_date', thirtyDaysAgo.toISOString());

        if (error) throw error;

        const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_value), 0) || 0;
        const totalOrders = orders?.length || 0;
        
        setSalesMetrics({
          totalRevenue,
          totalOrders,
          avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
          avgDailyRevenue: totalRevenue / 30,
          avgDailyOrders: totalOrders / 30,
        });
      } catch (error) {
        console.error('Error fetching sales data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSalesData();
  }, [user]);

  // Calculate projections
  const projections = useMemo(() => {
    // Use a base revenue that results in ~40k gross profit at 30% margin (133,333 * 0.30 = 40,000)
    const defaultBaseRevenue = 133333;
    const hasRealSalesData = salesMetrics.totalRevenue > 0;
    const baseMonthlyRevenue = hasRealSalesData 
      ? salesMetrics.avgDailyRevenue * 30 
      : defaultBaseRevenue;
    
    const simulatedRevenue = useCustomRevenue && customMonthlyRevenue 
      ? parseFloat(customMonthlyRevenue) || 0
      : baseMonthlyRevenue * (salesMultiplier / 100);
    
    // Use configurable target margin
    const marginDecimal = targetMarginPercent / 100;
    const estimatedGrossProfit = simulatedRevenue * marginDecimal;
    const netProfit = estimatedGrossProfit - totalMonthlyExpenses;
    const netMargin = simulatedRevenue > 0 ? (netProfit / simulatedRevenue) * 100 : 0;
    
    // Break-even calculation
    const breakEvenRevenue = totalMonthlyExpenses / marginDecimal;
    const avgOrderValue = hasRealSalesData ? salesMetrics.avgOrderValue : 250;
    const breakEvenOrders = avgOrderValue > 0 
      ? Math.ceil(breakEvenRevenue / avgOrderValue)
      : 0;

    return {
      baseMonthlyRevenue,
      simulatedRevenue,
      estimatedGrossProfit,
      netProfit,
      netMargin,
      breakEvenRevenue,
      breakEvenOrders,
      percentageChange: baseMonthlyRevenue > 0 
        ? ((simulatedRevenue - baseMonthlyRevenue) / baseMonthlyRevenue) * 100 
        : 0,
    };
  }, [salesMetrics, salesMultiplier, customMonthlyRevenue, useCustomRevenue, totalMonthlyExpenses]);

  // Scenarios
  const scenarios = [
    { label: 'Pessimista (-30%)', value: 70 },
    { label: 'Atual (100%)', value: 100 },
    { label: 'Otimista (+30%)', value: 130 },
    { label: 'Dobro (200%)', value: 200 },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vendas (30 dias)</p>
                <p className="text-2xl font-bold">{formatCurrency(salesMetrics.totalRevenue)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-primary opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pedidos (30 dias)</p>
                <p className="text-2xl font-bold">{salesMetrics.totalOrders}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">{formatCurrency(salesMetrics.avgOrderValue)}</p>
              </div>
              <Calculator className="h-8 w-8 text-purple-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Custos Mensais</p>
                <p className="text-2xl font-bold">{formatCurrency(totalMonthlyExpenses)}</p>
              </div>
              <Target className="h-8 w-8 text-red-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simulation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Simulador de Cenários
          </CardTitle>
          <CardDescription>
            Ajuste o faturamento para simular diferentes cenários de vendas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick Scenarios */}
          <div className="flex flex-wrap gap-2">
            {scenarios.map((scenario) => (
              <Badge
                key={scenario.value}
                variant={salesMultiplier === scenario.value ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-all",
                  salesMultiplier === scenario.value && "bg-primary"
                )}
                onClick={() => {
                  setSalesMultiplier(scenario.value);
                  setUseCustomRevenue(false);
                }}
              >
                {scenario.label}
              </Badge>
            ))}
          </div>

          {/* Slider Control */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <Label>Ajuste de Faturamento</Label>
              <span className="font-medium text-primary">{salesMultiplier}%</span>
            </div>
            <Slider
              value={[salesMultiplier]}
              onValueChange={([value]) => {
                setSalesMultiplier(value);
                setUseCustomRevenue(false);
              }}
              min={10}
              max={300}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>-90%</span>
              <span>Base</span>
              <span>+200%</span>
            </div>
          </div>

          <Separator />

          {/* Custom Revenue Input */}
          <div className="space-y-3">
            <Label htmlFor="customRevenue">Ou insira um faturamento personalizado</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                <Input
                  id="customRevenue"
                  type="number"
                  placeholder="0,00"
                  className="pl-10"
                  value={customMonthlyRevenue}
                  onChange={(e) => {
                    setCustomMonthlyRevenue(e.target.value);
                    setUseCustomRevenue(e.target.value !== "");
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projection Results */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Projected Profit */}
        <Card className={cn(
          "border-2",
          projections.netProfit >= 0 ? "border-green-500/30" : "border-red-500/30"
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {projections.netProfit >= 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              Lucro Líquido Projetado
            </CardTitle>
            <CardDescription>
              Resultado após despesas operacionais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={cn(
              "text-4xl font-bold",
              projections.netProfit >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {formatCurrency(projections.netProfit)}
              <span className="text-sm font-normal text-muted-foreground ml-2">/mês</span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Faturamento Projetado</span>
                <span className="font-medium">{formatCurrency(projections.simulatedRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lucro Bruto (30%)</span>
                <span className="font-medium">{formatCurrency(projections.estimatedGrossProfit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">(-) Despesas</span>
                <span className="font-medium text-red-500">-{formatCurrency(totalMonthlyExpenses)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Margem Líquida</span>
                <span className={cn(
                  projections.netMargin >= 10 ? "text-green-500" : 
                  projections.netMargin >= 0 ? "text-yellow-500" : "text-red-500"
                )}>
                  {projections.netMargin.toFixed(1)}%
                </span>
              </div>
            </div>

            {projections.percentageChange !== 0 && !useCustomRevenue && (
              <div className={cn(
                "flex items-center gap-1 text-sm",
                projections.percentageChange > 0 ? "text-green-500" : "text-red-500"
              )}>
                {projections.percentageChange > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {projections.percentageChange > 0 ? '+' : ''}
                {projections.percentageChange.toFixed(0)}% vs. período atual
              </div>
            )}
          </CardContent>
        </Card>

        {/* Break-even Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Ponto de Equilíbrio
            </CardTitle>
            <CardDescription>
              Meta mínima para cobrir todas as despesas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Faturamento Mínimo Necessário</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(projections.breakEvenRevenue)}
                  <span className="text-sm font-normal text-muted-foreground ml-2">/mês</span>
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Pedidos Necessários</p>
                <p className="text-2xl font-bold text-blue-500">
                  {projections.breakEvenOrders}
                  <span className="text-sm font-normal text-muted-foreground ml-2">pedidos/mês</span>
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Meta Diária</p>
                <p className="text-2xl font-bold text-purple-500">
                  {formatCurrency(projections.breakEvenRevenue / 30)}
                  <span className="text-sm font-normal text-muted-foreground ml-2">/dia</span>
                </p>
              </div>
            </div>

            {/* Status Indicator */}
            <div className={cn(
              "p-4 rounded-lg border",
              projections.simulatedRevenue >= projections.breakEvenRevenue 
                ? "bg-green-500/10 border-green-500/30" 
                : "bg-red-500/10 border-red-500/30"
            )}>
              {projections.simulatedRevenue >= projections.breakEvenRevenue ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Acima do ponto de equilíbrio!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">
                    Faltam {formatCurrency(projections.breakEvenRevenue - projections.simulatedRevenue)} para o break-even
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tips */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-1">Dica de Lucratividade</h4>
              <p className="text-sm text-muted-foreground">
                {projections.netMargin < 5 
                  ? "Sua margem está baixa. Considere revisar seus preços ou reduzir despesas operacionais."
                  : projections.netMargin < 15
                  ? "Margem moderada. Busque otimizar custos ou aumentar o ticket médio para melhorar resultados."
                  : "Excelente margem! Continue monitorando para manter a lucratividade."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
