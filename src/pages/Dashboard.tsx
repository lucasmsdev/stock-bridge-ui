import { TrendingUp, Package, ShoppingCart, Plug2, DollarSign, Loader2, TrendingDown, Users, Receipt, Target, Percent, Store, Calendar, Wallet, AlertTriangle, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePlan } from "@/hooks/usePlan";
import { Link } from "react-router-dom";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Area, AreaChart } from "recharts";

interface Expense {
  id: string;
  amount: number;
  category: 'fixed' | 'variable' | 'operational';
  recurrence: 'monthly' | 'weekly' | 'yearly' | 'one-time';
  is_active: boolean;
  start_date: string;
  end_date: string | null;
}

interface DashboardMetrics {
  todayRevenue: number;
  todayOrders: number;
  totalProducts: number;
  totalStock: number;
  periodRevenue: number;
  salesByDay: Array<{
    date: string;
    revenue: number;
  }>;
}

interface MonthlyProfitData {
  month: string;
  revenue: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

const emptyMetrics: DashboardMetrics = {
  todayRevenue: 0,
  todayOrders: 0,
  totalProducts: 0,
  totalStock: 0,
  periodRevenue: 0,
  salesByDay: []
};

const chartConfig = {
  revenue: {
    label: "Receita",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const profitChartConfig = {
  netProfit: {
    label: "Lucro Líquido",
    color: "hsl(142.1 76.2% 36.3%)",
  },
} satisfies ChartConfig;

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
};

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardMetrics>(emptyMetrics);
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalMonthlyExpenses, setTotalMonthlyExpenses] = useState(0);
  const [monthlyProfitData, setMonthlyProfitData] = useState<MonthlyProfitData[]>([]);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [isDeletingDemo, setIsDeletingDemo] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { currentPlan } = usePlan();

  // Gerar dados demo
  const handleGenerateDemoData = async () => {
    if (!user?.id) return;
    
    setIsGeneratingDemo(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-data');
      
      if (error) throw error;
      
      toast({
        title: "🎉 Dados gerados com sucesso!",
        description: `${data.summary.pedidos} pedidos, ${data.summary.produtos} produtos criados.`,
      });
      
      // Recarregar dados
      loadAllData();
    } catch (error: any) {
      console.error('Erro ao gerar dados demo:', error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar dados",
        description: error.message || "Tente novamente",
      });
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  // Limpar dados demo
  const handleDeleteDemoData = async () => {
    if (!user?.id) return;
    
    if (!confirm('Tem certeza que deseja apagar TODOS os dados? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    setIsDeletingDemo(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-admin-data');
      
      if (error) throw error;
      
      toast({
        title: "✅ Dados apagados!",
        description: "Todos os dados foram removidos.",
      });
      
      // Recarregar dados
      loadAllData();
    } catch (error: any) {
      console.error('Erro ao apagar dados:', error);
      toast({
        variant: "destructive",
        title: "Erro ao apagar dados",
        description: error.message || "Tente novamente",
      });
    } finally {
      setIsDeletingDemo(false);
    }
  };

  // Calcular despesa mensal
  const calculateMonthlyExpense = (expense: Expense): number => {
    if (!expense.is_active) return 0;

    const now = new Date();
    const startDate = new Date(expense.start_date);
    const endDate = expense.end_date ? new Date(expense.end_date) : null;

    if (startDate > new Date(now.getFullYear(), now.getMonth() + 1, 0)) return 0;
    if (endDate && endDate < new Date(now.getFullYear(), now.getMonth(), 1)) return 0;

    switch (expense.recurrence) {
      case 'monthly':
        return expense.amount;
      case 'weekly':
        return expense.amount * 4.33;
      case 'yearly':
        return expense.amount / 12;
      case 'one-time':
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

  // Carregar todos os dados diretamente do banco
  const loadAllData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

      // Queries paralelas - sem Edge Function!
      const [productsRes, todayOrdersRes, periodOrdersRes, allOrdersRes, expensesRes] = await Promise.all([
        // Produtos
        supabase
          .from('products')
          .select('id, stock')
          .eq('user_id', user.id),
        
        // Pedidos de hoje
        supabase
          .from('orders')
          .select('id, total_value')
          .eq('user_id', user.id)
          .gte('order_date', todayStart),
        
        // Pedidos dos últimos 30 dias (para gráfico)
        supabase
          .from('orders')
          .select('order_date, total_value')
          .eq('user_id', user.id)
          .gte('order_date', thirtyDaysAgo)
          .order('order_date', { ascending: true }),
        
        // Pedidos dos últimos 6 meses (para evolução)
        supabase
          .from('orders')
          .select('order_date, total_value')
          .eq('user_id', user.id)
          .gte('order_date', sixMonthsAgo),
        
        // Despesas
        supabase
          .from('expenses')
          .select('id, amount, category, recurrence, is_active, start_date, end_date')
          .eq('user_id', user.id)
          .eq('is_active', true)
      ]);

      // Processar produtos
      const products = productsRes.data || [];
      const totalProducts = products.length;
      const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);

      // Processar pedidos de hoje
      const todayOrders = todayOrdersRes.data || [];
      const todayOrdersCount = todayOrders.length;
      const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total_value || 0), 0);

      // Processar pedidos do período para gráfico
      const periodOrders = periodOrdersRes.data || [];
      const salesByDay: Record<string, number> = {};
      
      // Inicializar últimos 30 dias
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = date.toISOString().split('T')[0];
        salesByDay[key] = 0;
      }
      
      // Somar vendas por dia
      periodOrders.forEach(order => {
        const date = new Date(order.order_date).toISOString().split('T')[0];
        if (salesByDay[date] !== undefined) {
          salesByDay[date] += Number(order.total_value || 0);
        }
      });

      const salesByDayArray = Object.entries(salesByDay)
        .map(([date, revenue]) => ({ date, revenue }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const periodRevenue = periodOrders.reduce((sum, o) => sum + Number(o.total_value || 0), 0);

      // Processar despesas
      const expensesList = (expensesRes.data || []) as Expense[];
      setExpenses(expensesList);
      const totalExpenses = expensesList.reduce((sum, exp) => sum + calculateMonthlyExpense(exp), 0);
      setTotalMonthlyExpenses(totalExpenses);

      // Processar dados mensais para evolução
      const allOrders = allOrdersRes.data || [];
      const monthlyData: Record<string, number> = {};
      
      // Inicializar últimos 6 meses
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = 0;
      }
      
      allOrders.forEach(order => {
        const date = new Date(order.order_date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[key] !== undefined) {
          monthlyData[key] += Number(order.total_value || 0);
        }
      });

      const profitHistory: MonthlyProfitData[] = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, revenue]) => {
          const [year, month] = monthKey.split('-');
          const monthDate = new Date(parseInt(year), parseInt(month) - 1);
          const monthName = monthDate.toLocaleDateString('pt-BR', { month: 'short' });
          
          const grossProfit = revenue * 0.30;
          const netProfit = grossProfit - totalExpenses;
          
          return {
            month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
            revenue,
            grossProfit,
            expenses: totalExpenses,
            netProfit,
          };
        });

      setMonthlyProfitData(profitHistory);

      // Atualizar métricas
      const metrics: DashboardMetrics = {
        todayRevenue,
        todayOrders: todayOrdersCount,
        totalProducts,
        totalStock,
        periodRevenue,
        salesByDay: salesByDayArray
      };

      setDashboardData(metrics);
      
      // Verificar se há dados
      const hasSignificantData = totalProducts > 0 || todayOrdersCount > 0 || periodRevenue > 0;
      setHasData(hasSignificantData);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setHasData(false);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Carregar dados ao montar
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold font-heading text-foreground">Dashboard</h1>
          <p className="text-muted-foreground font-body">Visão geral das vendas</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">Plano {currentPlan}</Badge>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Carregando...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calcular lucro
  const grossProfit = dashboardData.periodRevenue * 0.30;
  const netProfit = grossProfit - totalMonthlyExpenses;
  const netMargin = dashboardData.periodRevenue > 0 
    ? (netProfit / dashboardData.periodRevenue) * 100 
    : 0;

  const metrics = [
    {
      title: "Vendas Totais (Hoje)",
      value: formatCurrency(dashboardData.todayRevenue),
      icon: DollarSign,
      trend: "+0%",
      color: "text-success"
    },
    {
      title: "Pedidos Recebidos (Hoje)",
      value: dashboardData.todayOrders.toString(),
      icon: ShoppingCart,
      trend: "+0%",
      color: "text-primary"
    },
    {
      title: "Itens em Estoque",
      value: dashboardData.totalStock.toString(),
      icon: Package,
      trend: "0%",
      color: "text-warning"
    },
    {
      title: "Produtos Cadastrados",
      value: dashboardData.totalProducts.toString(),
      icon: Plug2,
      trend: "0%",
      color: "text-muted-foreground"
    }
  ];

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-heading">Dashboard</h1>
            <p className="text-muted-foreground font-body">
              Visão geral das suas vendas e métricas
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="capitalize">
              Plano {currentPlan}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateDemoData}
              disabled={isGeneratingDemo || isDeletingDemo}
              className="gap-1.5"
            >
              {isGeneratingDemo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGeneratingDemo ? 'Gerando...' : 'Gerar Demo'}
            </Button>
            {hasData && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteDemoData}
                disabled={isGeneratingDemo || isDeletingDemo}
                className="gap-1.5"
              >
                {isDeletingDemo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {isDeletingDemo ? 'Apagando...' : 'Limpar'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {!hasData && (
        <div className="p-8 text-center border border-dashed border-border rounded-lg bg-muted/20">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum dado encontrado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Clique em "Gerar Demo" para criar dados fictícios para visualização.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
            {metrics.map((metric, index) => (
              <Card 
                key={metric.title} 
                className="shadow-soft hover:shadow-medium transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {metric.title}
                  </CardTitle>
                  <metric.icon className={`h-4 w-4 ${metric.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-heading text-foreground">{metric.value}</div>
                  <p className="text-xs text-muted-foreground font-body mt-1">
                    <span className={metric.trend.startsWith('+') ? 'text-success' : 'text-destructive'}>
                      {metric.trend}
                    </span> vs ontem
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Net Profit Card */}
          <Card className={`shadow-medium border-l-4 ${netProfit >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`h-14 w-14 rounded-full flex items-center justify-center ${
                    netProfit >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
                  }`}>
                    <Wallet className={`h-7 w-7 ${netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">LUCRO LÍQUIDO REAL</p>
                    <p className={`text-3xl font-bold ${
                      netProfit >= 0 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(netProfit)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Lucro Bruto ({formatCurrency(grossProfit)}) - Despesas ({formatCurrency(totalMonthlyExpenses)})
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:items-end gap-2">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Margem Líquida</p>
                      <p className={`text-lg font-bold ${netMargin >= 10 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {netMargin.toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Despesas/Mês</p>
                      <p className="text-lg font-bold text-amber-600">
                        {formatCurrency(totalMonthlyExpenses)}
                      </p>
                    </div>
                  </div>
                  
                  <Link 
                    to="/app/expenses" 
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Receipt className="h-3 w-3" />
                    Gerenciar despesas
                  </Link>
                </div>
              </div>

              {netMargin < 10 && netMargin >= 0 && (
                <div className="mt-4 p-3 rounded-lg bg-amber-500/10 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Margem baixa! Considere revisar seus custos ou aumentar preços.
                  </p>
                </div>
              )}

              {expenses.length === 0 && (
                <div className="mt-4 p-3 rounded-lg bg-muted/50 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Nenhuma despesa cadastrada. <Link to="/app/expenses" className="text-primary hover:underline">Cadastre suas despesas</Link> para ver o lucro líquido real.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
            {/* Sales Chart */}
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Vendas - Últimos 30 dias
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-8">
                <div className="h-[300px] w-full">
                  {dashboardData.salesByDay.some(d => d.revenue > 0) ? (
                    <ChartContainer config={chartConfig} className="h-full w-full">
                      <BarChart
                        data={dashboardData.salesByDay.map(item => ({
                          ...item,
                          displayDate: formatDate(item.date)
                        }))}
                        margin={{ top: 20, right: 20, left: 0, bottom: 40 }}
                        barCategoryGap="25%"
                      >
                        <XAxis 
                          dataKey="displayDate" 
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis hide />
                        <ChartTooltip 
                          content={<ChartTooltipContent 
                            formatter={(value) => [formatCurrency(Number(value)), "Receita"]}
                          />} 
                        />
                        <Bar 
                          dataKey="revenue" 
                          fill="var(--color-revenue)" 
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">Nenhuma venda no período</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Profit Evolution */}
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-emerald-500" />
                  Evolução do Lucro Líquido (6 meses)
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-8">
                <div className="h-[300px] w-full">
                  {monthlyProfitData.length > 0 ? (
                    <ChartContainer config={profitChartConfig} className="h-full w-full">
                      <AreaChart
                        data={monthlyProfitData}
                        margin={{ top: 20, right: 20, left: 0, bottom: 40 }}
                      >
                        <defs>
                          <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(142.1 76.2% 36.3%)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(142.1 76.2% 36.3%)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                          width={50}
                        />
                        <ChartTooltip 
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload as MonthlyProfitData;
                              return (
                                <div className="rounded-lg border bg-background p-3 shadow-md">
                                  <p className="font-medium mb-2">{label}</p>
                                  <div className="space-y-1 text-sm">
                                    <p className="text-muted-foreground">
                                      Faturamento: <span className="font-medium text-foreground">{formatCurrency(data.revenue)}</span>
                                    </p>
                                    <p className="text-muted-foreground">
                                      Lucro Bruto: <span className="font-medium text-foreground">{formatCurrency(data.grossProfit)}</span>
                                    </p>
                                    <p className="text-muted-foreground">
                                      Despesas: <span className="font-medium text-red-500">-{formatCurrency(data.expenses)}</span>
                                    </p>
                                    <hr className="my-1 border-border" />
                                    <p className={`font-medium ${data.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                      Lucro Líquido: {formatCurrency(data.netProfit)}
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area 
                          type="monotone"
                          dataKey="netProfit" 
                          stroke="hsl(142.1 76.2% 36.3%)"
                          strokeWidth={2}
                          fill="url(#profitGradient)"
                        />
                      </AreaChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Sem dados de vendas</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Card */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Resumo do Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Faturamento (30 dias)</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(dashboardData.periodRevenue)}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Lucro Bruto (30%)</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(grossProfit)}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Despesas Mensais</p>
                  <p className="text-xl font-bold text-amber-600">{formatCurrency(totalMonthlyExpenses)}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Lucro Líquido</p>
                  <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {formatCurrency(netProfit)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
