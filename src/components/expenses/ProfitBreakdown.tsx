import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Expense } from "@/pages/Expenses";
import { useMarketplaceFees, PLATFORM_LABELS, PLATFORM_LOGOS } from "@/hooks/useMarketplaceFees";
import { 
  TrendingUp, TrendingDown, DollarSign, Receipt, Loader2, AlertTriangle,
  ArrowDown, Percent, Package, Store
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Separator } from "@/components/ui/separator";

interface ProfitBreakdownProps {
  expenses: Expense[];
  marketplaceFeePercent?: number;
  targetMarginPercent?: number;
}

interface PlatformBreakdown {
  platform: string;
  label: string;
  logo: string;
  orderCount: number;
  revenue: number;
  fees: number;
  taxes: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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

export function ProfitBreakdown({ expenses }: ProfitBreakdownProps) {
  const { user } = useAuth();
  const { calculateFees } = useMarketplaceFees();
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalProductCost, setTotalProductCost] = useState(0);
  const [totalMarketplaceFees, setTotalMarketplaceFees] = useState(0);
  const [totalTaxes, setTotalTaxes] = useState(0);
  const [platformBreakdowns, setPlatformBreakdowns] = useState<PlatformBreakdown[]>([]);

  useEffect(() => {
    const fetchFinancialData = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const [ordersRes, productsRes] = await Promise.all([
          supabase.from('orders').select('total_value, items, platform')
            .eq('user_id', user.id)
            .gte('order_date', startOfMonth.toISOString())
            .lte('order_date', endOfMonth.toISOString()),
          supabase.from('products').select('selling_price, cost_price').eq('user_id', user.id),
        ]);

        const orders = ordersRes.data || [];
        const products = productsRes.data || [];

        // Build cost map
        const costMap = new Map<number, number>();
        products.forEach(p => {
          if (p.selling_price && p.cost_price) costMap.set(Number(p.selling_price), Number(p.cost_price));
        });

        let revenue = 0;
        let productCost = 0;
        let mktFees = 0;
        let taxes = 0;
        const platformMap = new Map<string, PlatformBreakdown>();

        orders.forEach(order => {
          const orderRevenue = Number(order.total_value) || 0;
          const platform = (order.platform || 'other').toLowerCase();
          revenue += orderRevenue;

          const fees = calculateFees(platform, orderRevenue);
          const orderFees = fees.commissionAmount + fees.paymentFeeAmount + fees.fixedFeeAmount;
          mktFees += orderFees;
          taxes += fees.taxAmount;

          // Product cost
          let orderProductCost = 0;
          const items = (order.items as any[]) || [];
          items.forEach(item => {
            const cost = costMap.get(Number(item.unit_price));
            if (cost) orderProductCost += cost * (item.quantity || 1);
          });
          if (orderProductCost === 0 && orderRevenue > 0) orderProductCost = orderRevenue * 0.55;
          productCost += orderProductCost;

          // Platform grouping
          if (!platformMap.has(platform)) {
            platformMap.set(platform, {
              platform,
              label: PLATFORM_LABELS[platform] || platform,
              logo: PLATFORM_LOGOS[platform] || '',
              orderCount: 0,
              revenue: 0,
              fees: 0,
              taxes: 0,
            });
          }
          const pb = platformMap.get(platform)!;
          pb.orderCount++;
          pb.revenue += orderRevenue;
          pb.fees += orderFees;
          pb.taxes += fees.taxAmount;
        });

        // If no real data, use demo
        if (revenue === 0) {
          revenue = 150000;
          const demoFees = calculateFees('mercadolivre', revenue);
          mktFees = demoFees.commissionAmount + demoFees.paymentFeeAmount;
          taxes = demoFees.taxAmount;
          productCost = revenue * 0.55;
          platformMap.set('mercadolivre', {
            platform: 'mercadolivre', label: 'Mercado Livre', logo: PLATFORM_LOGOS.mercadolivre,
            orderCount: 120, revenue, fees: mktFees, taxes,
          });
        }

        setTotalRevenue(revenue);
        setTotalProductCost(productCost);
        setTotalMarketplaceFees(mktFees);
        setTotalTaxes(taxes);
        setPlatformBreakdowns(Array.from(platformMap.values()).sort((a, b) => b.revenue - a.revenue));
      } catch (error) {
        console.error('Error fetching financial data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFinancialData();
  }, [user, calculateFees]);

  const calculateMonthlyExpense = (expense: Expense): number => {
    if (!expense.is_active) return 0;
    const now = new Date();
    const startDate = new Date(expense.start_date);
    const endDate = expense.end_date ? new Date(expense.end_date) : null;
    if (startDate > new Date(now.getFullYear(), now.getMonth() + 1, 0)) return 0;
    if (endDate && endDate < new Date(now.getFullYear(), now.getMonth(), 1)) return 0;
    switch (expense.recurrence) {
      case 'monthly': return expense.amount;
      case 'weekly': return expense.amount * 4.33;
      case 'yearly': return expense.amount / 12;
      case 'one-time':
        if (startDate.getMonth() === now.getMonth() && startDate.getFullYear() === now.getFullYear()) return expense.amount;
        return 0;
      default: return expense.amount;
    }
  };

  const activeExpenses = expenses.filter(e => e.is_active);
  const expensesByCategory = {
    fixed: activeExpenses.filter(e => e.category === 'fixed').reduce((sum, e) => sum + calculateMonthlyExpense(e), 0),
    variable: activeExpenses.filter(e => e.category === 'variable').reduce((sum, e) => sum + calculateMonthlyExpense(e), 0),
    operational: activeExpenses.filter(e => e.category === 'operational').reduce((sum, e) => sum + calculateMonthlyExpense(e), 0),
  };

  const totalExpenses = expensesByCategory.fixed + expensesByCategory.variable + expensesByCategory.operational;
  const grossProfit = totalRevenue - totalMarketplaceFees - totalTaxes - totalProductCost;
  const netProfit = grossProfit - totalExpenses;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

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
      <div className="space-y-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Receita Bruta (Este Mês)</p>
                <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deductions by Platform */}
        <Card className="border-l-4 border-l-muted-foreground/50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <ArrowDown className="h-4 w-4" />
              Deduções por Marketplace
            </p>
            
            <div className="space-y-2">
              {platformBreakdowns.map(pb => (
                <div key={pb.platform} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                  <div className="flex items-center gap-3">
                    {pb.logo ? (
                      <img src={pb.logo} alt={pb.label} className="h-7 w-7 object-contain rounded" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-red-500/20 flex items-center justify-center">
                        <Store className="h-4 w-4 text-red-500" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{pb.label}</p>
                      <p className="text-xs text-muted-foreground">{pb.orderCount} vendas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-500">-{formatCurrency(pb.fees + pb.taxes)}</p>
                    <p className="text-xs text-muted-foreground">
                      Taxas: {formatCurrency(pb.fees)} | Imp: {formatCurrency(pb.taxes)}
                    </p>
                  </div>
                </div>
              ))}

              {/* Product Cost */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <Package className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Custo dos Produtos</p>
                    <p className="text-xs text-muted-foreground">Valor pago aos fornecedores</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-orange-500">-{formatCurrency(totalProductCost)}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalRevenue > 0 ? ((totalProductCost / totalRevenue) * 100).toFixed(0) : 0}% da receita
                  </p>
                </div>
              </div>
            </div>

            <Separator className="my-4" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total descontado</span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {totalRevenue > 0 ? (((totalMarketplaceFees + totalTaxes + totalProductCost) / totalRevenue) * 100).toFixed(0) : 0}% da receita
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lucro Bruto</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(grossProfit)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Margem bruta: {totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0}%
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
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{formatCurrency(totalExpenses)}</p>
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
                <p className="text-sm text-muted-foreground font-medium">LUCRO LÍQUIDO REAL</p>
                <p className={`text-3xl font-bold mt-1 ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(netProfit)}
                </p>
                <p className={`text-sm mt-1 ${netMargin >= 25 ? 'text-emerald-600' : netMargin >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                  Margem: {netMargin.toFixed(1)}%
                </p>
              </div>
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${netProfit >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                {netProfit >= 0 ? <TrendingUp className="h-6 w-6 text-emerald-500" /> : <TrendingDown className="h-6 w-6 text-red-500" />}
              </div>
            </div>
            {netMargin < 15 && netMargin >= 0 && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">Margem baixa! Considere revisar seus custos ou aumentar preços.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição de Despesas</CardTitle>
          <CardDescription>Proporção de cada categoria no mês atual</CardDescription>
        </CardHeader>
        <CardContent>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value"
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground text-center">Cadastre despesas para ver a distribuição</p>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {Object.entries(expensesByCategory).map(([category, amount]) => (
              <div key={category} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{categoryLabels[category as keyof typeof categoryLabels]}</span>
                <span className="font-medium">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
