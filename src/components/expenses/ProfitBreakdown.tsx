import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Expense } from "@/pages/Expenses";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Receipt,
  Loader2,
  AlertTriangle,
  ArrowDown,
  Percent,
  Package,
  Store
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Separator } from "@/components/ui/separator";

interface ProfitBreakdownProps {
  expenses: Expense[];
  marketplaceFeePercent?: number;
  targetMarginPercent?: number;
}

interface RevenueBreakdown {
  totalRevenue: number;
  marketplaceFees: number;
  productCost: number;
  grossProfit: number;
  marketplaceFeePercent: number;
  productCostPercent: number;
  grossMarginPercent: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const categoryColors = {
  fixed: 'hsl(220, 70%, 55%)',
  variable: 'hsl(38, 92%, 55%)',
  operational: 'hsl(270, 60%, 55%)',
};

const categoryLabels = {
  fixed: 'Despesas Fixas',
  variable: 'Despesas Variáveis',
  operational: 'Despesas Operacionais',
};

export function ProfitBreakdown({ 
  expenses, 
  marketplaceFeePercent = 12,
  targetMarginPercent = 30 
}: ProfitBreakdownProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [revenueBreakdown, setRevenueBreakdown] = useState<RevenueBreakdown>({
    totalRevenue: 0,
    marketplaceFees: 0,
    productCost: 0,
    grossProfit: 0,
    marketplaceFeePercent: marketplaceFeePercent,
    productCostPercent: 55,
    grossMarginPercent: targetMarginPercent,
  });

  useEffect(() => {
    const fetchFinancialData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Get this month's date range
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Fetch orders for this month
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('total_value, items')
          .eq('user_id', user.id)
          .gte('order_date', startOfMonth.toISOString())
          .lte('order_date', endOfMonth.toISOString());

        if (ordersError) throw ordersError;

        // Fetch products to get cost prices
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('selling_price, cost_price')
          .eq('user_id', user.id);

        if (productsError) throw productsError;

        // Calculate revenue and cost
        let revenue = 0;
        let cost = 0;
        let hasProductCosts = false;

        orders?.forEach(order => {
          revenue += Number(order.total_value) || 0;
          
          const items = order.items as any[] || [];
          items.forEach(item => {
            const product = products?.find(p => 
              Number(p.selling_price) === Number(item.unit_price)
            );
            if (product?.cost_price) {
              cost += Number(product.cost_price) * (item.quantity || 1);
              hasProductCosts = true;
            }
          });
        });

        // If no real data, use demo values
        if (revenue === 0) {
          const demoRevenue = 150000;
          const demoMarketplaceFees = demoRevenue * (marketplaceFeePercent / 100);
          const demoProductCost = demoRevenue * 0.55;
          const demoGrossProfit = demoRevenue - demoMarketplaceFees - demoProductCost;
          
          setRevenueBreakdown({
            totalRevenue: demoRevenue,
            marketplaceFees: demoMarketplaceFees,
            productCost: demoProductCost,
            grossProfit: demoGrossProfit,
            marketplaceFeePercent: marketplaceFeePercent,
            productCostPercent: 55,
            grossMarginPercent: (demoGrossProfit / demoRevenue) * 100,
          });
        } else {
          // Real data calculation using configurable marketplace fee
          const marketplaceFees = revenue * (marketplaceFeePercent / 100);
          
          let productCost: number;
          let productCostPercent: number;
          
          if (hasProductCosts && cost > 0) {
            productCost = cost;
            productCostPercent = (cost / revenue) * 100;
          } else {
            // Estimate product cost at 55% for healthy margin
            productCostPercent = 55;
            productCost = revenue * 0.55;
          }
          
          const grossProfit = revenue - marketplaceFees - productCost;
          const grossMarginPercent = (grossProfit / revenue) * 100;

          setRevenueBreakdown({
            totalRevenue: revenue,
            marketplaceFees,
            productCost,
            grossProfit,
            marketplaceFeePercent: marketplaceFeePercent,
            productCostPercent,
            grossMarginPercent,
          });
        }
      } catch (error) {
        console.error('Error fetching financial data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFinancialData();
  }, [user, marketplaceFeePercent]);

  // Calculate monthly expenses (proportional to current month)
  const calculateMonthlyExpense = (expense: Expense): number => {
    if (!expense.is_active) return 0;

    const now = new Date();
    const startDate = new Date(expense.start_date);
    const endDate = expense.end_date ? new Date(expense.end_date) : null;

    // Check if expense is within the current month
    if (startDate > new Date(now.getFullYear(), now.getMonth() + 1, 0)) return 0;
    if (endDate && endDate < new Date(now.getFullYear(), now.getMonth(), 1)) return 0;

    switch (expense.recurrence) {
      case 'monthly':
        return expense.amount;
      case 'weekly':
        return expense.amount * 4.33; // Average weeks per month
      case 'yearly':
        return expense.amount / 12;
      case 'one-time':
        // Only count if within current month
        const startMonth = startDate.getMonth();
        const startYear = startDate.getFullYear();
        if (startMonth === now.getMonth() && startYear === now.getFullYear()) {
          return expense.amount;
        }
        return 0;
      default:
        return expense.amount;
    }
  };

  const activeExpenses = expenses.filter(e => e.is_active);
  
  const expensesByCategory = {
    fixed: activeExpenses.filter(e => e.category === 'fixed')
      .reduce((sum, e) => sum + calculateMonthlyExpense(e), 0),
    variable: activeExpenses.filter(e => e.category === 'variable')
      .reduce((sum, e) => sum + calculateMonthlyExpense(e), 0),
    operational: activeExpenses.filter(e => e.category === 'operational')
      .reduce((sum, e) => sum + calculateMonthlyExpense(e), 0),
  };

  const totalExpenses = expensesByCategory.fixed + expensesByCategory.variable + expensesByCategory.operational;
  const netProfit = revenueBreakdown.grossProfit - totalExpenses;
  const netMargin = revenueBreakdown.totalRevenue > 0 ? (netProfit / revenueBreakdown.totalRevenue) * 100 : 0;

  const pieData = [
    { name: categoryLabels.fixed, value: expensesByCategory.fixed, color: categoryColors.fixed },
    { name: categoryLabels.variable, value: expensesByCategory.variable, color: categoryColors.variable },
    { name: categoryLabels.operational, value: expensesByCategory.operational, color: categoryColors.operational },
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Profit Cards */}
      <div className="space-y-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Receita Bruta (Este Mês)</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {formatCurrency(revenueBreakdown.totalRevenue)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Breakdown Card - NEW */}
        <Card className="border-l-4 border-l-muted-foreground/50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <ArrowDown className="h-4 w-4" />
              Deduções da Receita
            </p>
            
            <div className="space-y-3">
              {/* Marketplace Fees */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Store className="h-4 w-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Taxas de Marketplace</p>
                    <p className="text-xs text-muted-foreground">Comissão cobrada pela plataforma</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-500">
                    -{formatCurrency(revenueBreakdown.marketplaceFees)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {revenueBreakdown.marketplaceFeePercent.toFixed(0)}% da receita
                  </p>
                </div>
              </div>

              {/* Product Cost */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <Package className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Custo dos Produtos</p>
                    <p className="text-xs text-muted-foreground">Valor pago aos fornecedores</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-orange-500">
                    -{formatCurrency(revenueBreakdown.productCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {revenueBreakdown.productCostPercent.toFixed(0)}% da receita
                  </p>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Gross Margin Summary */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total descontado</span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {(revenueBreakdown.marketplaceFeePercent + revenueBreakdown.productCostPercent).toFixed(0)}% da receita
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lucro Bruto</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {formatCurrency(revenueBreakdown.grossProfit)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Margem bruta: {revenueBreakdown.grossMarginPercent.toFixed(1)}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Despesas (Este Mês)</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {formatCurrency(totalExpenses)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${netProfit >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  LUCRO LÍQUIDO REAL
                </p>
                <p className={`text-3xl font-bold mt-1 ${
                  netProfit >= 0 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(netProfit)}
                </p>
                <p className={`text-sm mt-1 ${
                  netMargin >= 25 ? 'text-emerald-600' : netMargin >= 15 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  Margem: {netMargin.toFixed(1)}%
                </p>
              </div>
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                netProfit >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
              }`}>
                {netProfit >= 0 ? (
                  <TrendingUp className="h-6 w-6 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-red-500" />
                )}
              </div>
            </div>
            {netMargin < 15 && netMargin >= 0 && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Margem baixa! Considere revisar seus custos ou aumentar preços.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expense Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição de Despesas</CardTitle>
          <CardDescription>
            Proporção de cada categoria no mês atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground text-center">
                Cadastre despesas para ver a distribuição
              </p>
            </div>
          )}

          {/* Category breakdown */}
          <div className="mt-4 space-y-2">
            {Object.entries(expensesByCategory).map(([category, amount]) => (
              <div key={category} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {categoryLabels[category as keyof typeof categoryLabels]}
                </span>
                <span className="font-medium">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}