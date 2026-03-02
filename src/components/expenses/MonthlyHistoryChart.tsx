import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ComposedChart, Line
} from "recharts";
import { TrendingUp, Loader2, RefreshCw, BarChart3, Calendar } from "lucide-react";
import { Expense } from "@/pages/Expenses";
import { useMarketplaceFees } from "@/hooks/useMarketplaceFees";

interface MonthlyHistoryChartProps {
  expenses: Expense[];
  marketplaceFeePercent: number; // kept for backwards compat but ignored
}

interface MonthlyData {
  month: string;
  monthLabel: string;
  revenue: number;
  productCosts: number;
  marketplaceFees: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function MonthlyHistoryChart({ expenses }: MonthlyHistoryChartProps) {
  const { user } = useAuth();
  const { calculateFees } = useMarketplaceFees();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [periodMonths, setPeriodMonths] = useState("6");

  useEffect(() => {
    fetchMonthlyData();
  }, [user, periodMonths, expenses, calculateFees]);

  const calculateMonthlyExpense = (expense: Expense, targetMonth: Date): number => {
    if (!expense.is_active) return 0;
    const startDate = new Date(expense.start_date);
    const endDate = expense.end_date ? new Date(expense.end_date) : null;
    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    if (startDate > monthEnd) return 0;
    if (endDate && endDate < monthStart) return 0;
    switch (expense.recurrence) {
      case 'monthly': return expense.amount;
      case 'weekly': return expense.amount * 4.33;
      case 'yearly': return expense.amount / 12;
      case 'one-time':
        if (startDate >= monthStart && startDate <= monthEnd) return expense.amount;
        return 0;
      default: return expense.amount;
    }
  };

  const fetchMonthlyData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const months = parseInt(periodMonths);

      // Fetch products for cost map
      const { data: products } = await supabase.from('products').select('selling_price, cost_price').eq('user_id', user.id);
      const costMap = new Map<number, number>();
      (products || []).forEach(p => {
        if (p.selling_price && p.cost_price) costMap.set(Number(p.selling_price), Number(p.cost_price));
      });

      const data: MonthlyData[] = [];

      for (let i = months - 1; i >= 0; i--) {
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() - i);
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth();
        const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
        const monthLabel = `${monthNames[month]}/${String(year).slice(2)}`;
        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0);

        const { data: orders, error: ordersError } = await supabase
          .from('orders').select('total_value, items, platform')
          .eq('user_id', user.id)
          .gte('order_date', startOfMonth.toISOString())
          .lte('order_date', endOfMonth.toISOString());

        if (ordersError) throw ordersError;

        let revenue = 0;
        let productCosts = 0;
        let marketplaceFees = 0;

        (orders || []).forEach(order => {
          const orderRevenue = Number(order.total_value) || 0;
          revenue += orderRevenue;

          const platform = (order.platform || '').toLowerCase();
          const fees = calculateFees(platform, orderRevenue);
          marketplaceFees += fees.commissionAmount + fees.paymentFeeAmount + fees.fixedFeeAmount + fees.taxAmount;

          const items = (order.items as any[]) || [];
          items.forEach(item => {
            const cost = costMap.get(Number(item.unit_price));
            if (cost) productCosts += cost * (item.quantity || 1);
          });
        });

        if (productCosts === 0 && revenue > 0) productCosts = revenue * 0.55;

        const grossProfit = revenue - productCosts - marketplaceFees;
        const monthlyExpenses = expenses.reduce((total, expense) => total + calculateMonthlyExpense(expense, targetDate), 0);
        const netProfit = grossProfit - monthlyExpenses;

        data.push({ month: yearMonth, monthLabel, revenue, productCosts, marketplaceFees, grossProfit, expenses: monthlyExpenses, netProfit });

        await supabase.from('monthly_financial_history').upsert({
          user_id: user.id, year_month: yearMonth, total_revenue: revenue,
          total_orders: orders?.length || 0, marketplace_fees: marketplaceFees,
          product_costs: productCosts, gross_profit: grossProfit,
          total_expenses: monthlyExpenses, net_profit: netProfit,
        }, { onConflict: 'user_id,year_month' });
      }

      setMonthlyData(data);
    } catch (error) {
      console.error('Error fetching monthly data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => { setRefreshing(true); fetchMonthlyData(); };

  if (loading && !refreshing) {
    return <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  const hasData = monthlyData.some(d => d.revenue > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Histórico Mensal</CardTitle>
            <CardDescription>Evolução de receitas, despesas e lucro com taxas reais por marketplace.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={periodMonths} onValueChange={setPeriodMonths}>
              <SelectTrigger className="w-[140px]"><Calendar className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 meses</SelectItem>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum dado de vendas encontrado no período.</p>
            <p className="text-sm text-muted-foreground mt-1">Sincronize seus pedidos para ver o histórico.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="monthLabel" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = { revenue: 'Receita', grossProfit: 'Lucro Bruto', expenses: 'Despesas', netProfit: 'Lucro Líquido' };
                    return [formatCurrency(value), labels[name] || name];
                  }} />
                <Legend formatter={(value) => {
                  const labels: Record<string, string> = { revenue: 'Receita', grossProfit: 'Lucro Bruto', expenses: 'Despesas', netProfit: 'Lucro Líquido' };
                  return labels[value] || value;
                }} />
                <Bar dataKey="revenue" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="grossProfit" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="hsl(38, 92%, 55%)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="netProfit" stroke="hsl(270, 60%, 55%)" strokeWidth={3} dot={{ fill: 'hsl(270, 60%, 55%)', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Mês</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Receita</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Lucro Bruto</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Despesas</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Lucro Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((row) => (
                    <tr key={row.month} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium">{row.monthLabel}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(row.revenue)}</td>
                      <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">{formatCurrency(row.grossProfit)}</td>
                      <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400">{formatCurrency(row.expenses)}</td>
                      <td className={`py-2 px-3 text-right font-semibold ${row.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(row.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
