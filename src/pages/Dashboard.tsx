import { TrendingUp, Package, ShoppingCart, Plug2, DollarSign, Loader2, TrendingDown, Users, Receipt, Target, Percent, Store, Calendar, Wallet, AlertTriangle, Database, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DashboardFilters, { DashboardFiltersState } from "@/components/dashboard/DashboardFilters";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
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
import { Bar, BarChart, XAxis, YAxis, Line, LineChart, CartesianGrid, Area, AreaChart, ResponsiveContainer } from "recharts";

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
  salesLast7Days: Array<{
    date: string;
    revenue: number;
  }>;
  marketing?: {
    billing: number;
    marketplaceLiquid: number;
    grossProfit: number;
    margin: number;
    salesCount: number;
    unitsSold: number;
    averageTicket: number;
    roi: number;
    adSpend: number;
    tacos: number;
    profitAfterAds: number;
    marginAfterAds: number;
  };
}

interface MetricCard {
  title: string;
  value: string;
  icon: any;
  trend: string;
  color: string;
}

// Estado inicial vazio (sem dados de demonstração)
const emptyMetrics: DashboardMetrics = {
  todayRevenue: 0,
  todayOrders: 0,
  totalProducts: 0,
  totalStock: 0,
  salesLast7Days: []
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
    color: "hsl(142.1 76.2% 36.3%)", // green-600
  },
} satisfies ChartConfig;

interface MonthlyProfitData {
  month: string;
  revenue: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

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
  // Inicializa o estado vazio - dados serão carregados do banco
  const [dashboardData, setDashboardData] = useState<DashboardMetrics>(emptyMetrics);
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [activeFilters, setActiveFilters] = useState<DashboardFiltersState>({
    marketplace: "all",
    period: "7days",
  });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalMonthlyExpenses, setTotalMonthlyExpenses] = useState(0);
  const [monthlyProfitData, setMonthlyProfitData] = useState<MonthlyProfitData[]>([]);
  const [isGeneratingData, setIsGeneratingData] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { currentPlan } = usePlan();

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      setIsAdmin(data?.role === 'admin');
    };
    checkAdmin();
  }, [user]);


  // Calculate monthly expense from a single expense item
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

  // Load expenses and monthly profit data - extracted as useCallback
  const loadExpensesAndProfitHistory = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Load expenses
      const { data: expensesData, error: expError } = await supabase
        .from('expenses')
        .select('id, amount, category, recurrence, is_active, start_date, end_date')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (expError) throw expError;

      const expensesList = (expensesData || []) as Expense[];
      setExpenses(expensesList);
      
      const total = expensesList.reduce((sum, exp) => sum + calculateMonthlyExpense(exp), 0);
      setTotalMonthlyExpenses(total);

      // Load orders for last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const { data: ordersData, error: ordError } = await supabase
        .from('orders')
        .select('total_value, order_date')
        .eq('user_id', user.id)
        .gte('order_date', sixMonthsAgo.toISOString());

      if (ordError) throw ordError;

      // Group orders by month
      const monthlyData: Record<string, { revenue: number }> = {};
      const now = new Date();
      
      // Initialize last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = { revenue: 0 };
      }

      // Sum orders by month
      (ordersData || []).forEach((order: { total_value: number; order_date: string }) => {
        const date = new Date(order.order_date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[key]) {
          monthlyData[key].revenue += Number(order.total_value);
        }
      });

      // Calculate profit for each month
      const profitHistory: MonthlyProfitData[] = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, data]) => {
          const [year, month] = monthKey.split('-');
          const monthDate = new Date(parseInt(year), parseInt(month) - 1);
          const monthName = monthDate.toLocaleDateString('pt-BR', { month: 'short' });
          
          const grossProfit = data.revenue * 0.30; // 30% margin assumption
          const netProfit = grossProfit - total;
          
          return {
            month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
            revenue: data.revenue,
            grossProfit,
            expenses: total,
            netProfit,
          };
        });

      setMonthlyProfitData(profitHistory);
    } catch (error) {
      console.error('Error loading expenses and profit history:', error);
    }
  }, [user]);

  // Initial load and real-time subscriptions for expenses and orders
  useEffect(() => {
    loadExpensesAndProfitHistory();

    // Subscribe to real-time changes on expenses table
    const expensesSubscription = supabase
      .channel('dashboard-expenses')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          console.log('Despesa atualizada, recarregando dados...');
          loadExpensesAndProfitHistory();
        }
      )
      .subscribe();

    // Subscribe to real-time changes on orders table
    const ordersSubscription = supabase
      .channel('dashboard-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          console.log('Pedido atualizado, recarregando dados...');
          loadExpensesAndProfitHistory();
        }
      )
      .subscribe();

    return () => {
      expensesSubscription.unsubscribe();
      ordersSubscription.unsubscribe();
    };
  }, [user, loadExpensesAndProfitHistory]);

  const loadDashboardMetrics = useCallback(async (filters?: DashboardFiltersState) => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const filtersToUse = filters || activeFilters;
      console.log('=== Buscando dados reais em segundo plano ===');
      console.log('Calling edge function to get dashboard metrics with filters:', filtersToUse);
      
      // Try edge function first
      const { data, error: functionError } = await supabase.functions.invoke('get-dashboard-metrics', {
        body: {
          marketplace: filtersToUse.marketplace,
          period: filtersToUse.period,
          startDate: filtersToUse.startDate?.toISOString(),
          endDate: filtersToUse.endDate?.toISOString(),
        }
      });

      if (!functionError && data && !data.error) {
        console.log('Dados recebidos da edge function:', data);
        
        // Verifica se há dados reais significativos - consideramos que há dados se:
        // - Tem produtos cadastrados, OU
        // - Tem vendas de hoje, OU
        // - Tem vendas no período selecionado (marketing.billing), OU
        // - Tem vendas no histórico (salesLast7Days)
        const hasSignificantData = 
          data.totalProducts > 0 ||
          data.totalStock > 0 ||
          data.todayRevenue > 0 || 
          data.todayOrders > 0 || 
          (data.salesLast7Days && data.salesLast7Days.length > 0 && data.salesLast7Days.some((day: {revenue: number}) => day.revenue > 0)) ||
          (data.marketing && data.marketing.billing > 0) ||
          (data.marketing && data.marketing.salesCount > 0);
        
        console.log('Has significant data:', hasSignificantData, {
          totalProducts: data.totalProducts,
          totalStock: data.totalStock,
          todayRevenue: data.todayRevenue,
          salesDays: data.salesLast7Days?.length,
          marketingBilling: data.marketing?.billing
        });
        
        setDashboardData(data);
        setHasData(hasSignificantData);
      } else {
        console.warn('Edge function falhou:', functionError, data?.error);
        setHasData(false);
      }
    } catch (error) {
      console.warn('Erro na busca de dados:', error);
      setHasData(false);
    } finally {
      setIsLoading(false);
    }
  }, [user, toast, activeFilters]);

  // Generate demo data for Dashboard (products and orders only)
  const handleGenerateDemoData = async () => {
    setIsGeneratingData(true);
    try {
      console.log('Chamando seed-dashboard-data...');
      const { data, error } = await supabase.functions.invoke('seed-dashboard-data');
      
      console.log('Resposta da edge function:', { data, error });
      
      if (error) throw error;
      
      toast({
        title: "Dados do Dashboard gerados!",
        description: `Criados: ${data.summary.products} produtos, ${data.summary.orders} pedidos`,
      });
      
      // Reload dashboard data after a small delay to ensure DB is updated
      setTimeout(async () => {
        console.log('Recarregando métricas do dashboard...');
        await loadDashboardMetrics();
        await loadExpensesAndProfitHistory();
      }, 500);
    } catch (error: any) {
      console.error('Erro ao gerar dados:', error);
      toast({
        title: "Erro ao gerar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingData(false);
    }
  };

  // Clear all data
  const handleClearData = async () => {
    setIsClearingData(true);
    try {
      const { error } = await supabase.functions.invoke('reset-admin-data');
      
      if (error) throw error;
      
      toast({
        title: "Dados limpos com sucesso!",
        description: "Todos os dados de demonstração foram removidos.",
      });
      
      // Reset dashboard state
      setDashboardData(emptyMetrics);
      setHasData(false);
      setExpenses([]);
      setTotalMonthlyExpenses(0);
      setMonthlyProfitData([]);
    } catch (error: any) {
      toast({
        title: "Erro ao limpar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsClearingData(false);
    }
  };

  const handleApplyFilters = (filters: DashboardFiltersState) => {
    setActiveFilters(filters);
    setIsLoading(true);
    loadDashboardMetrics(filters);
  };

  const handleClearFilters = () => {
    const defaultFilters: DashboardFiltersState = {
      marketplace: "all",
      period: "7days",
    };
    setActiveFilters(defaultFilters);
    setIsLoading(true);
    loadDashboardMetrics(defaultFilters);
  };

  const getPeriodLabel = () => {
    const labels: Record<string, string> = {
      today: "Hoje",
      "7days": "Últimos 7 dias",
      "30days": "Últimos 30 dias",
      "90days": "Últimos 90 dias",
      "180days": "Últimos 180 dias",
      this_month: "Este mês",
      last_month: "Mês passado",
      custom: "Período personalizado",
    };
    return labels[activeFilters.period] || "Últimos 7 dias";
  };

  const getMarketplaceLabel = () => {
    const labels: Record<string, string> = {
      all: "Todos os Marketplaces",
      mercadolivre: "Mercado Livre",
      shopee: "Shopee",
      amazon: "Amazon",
      shopify: "Shopify",
    };
    return labels[activeFilters.marketplace] || "Todos os Marketplaces";
  };

  useEffect(() => {
    // Simula um pequeno delay para mostrar que está carregando, mas não bloqueia a UI
    const timer = setTimeout(() => {
      loadDashboardMetrics();
    }, 500);

    return () => clearTimeout(timer);
  }, [loadDashboardMetrics]);

  // Loading state - mostra dados demo com indicador de carregamento
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold font-heading text-foreground">Dashboard</h1>
        <p className="text-muted-foreground font-body">
          Visão geral das vendas
        </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              Plano {currentPlan}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Sincronizando dados...
            </div>
          </div>
        </div>
        
        {/* Renderiza dados demo mesmo durante carregamento */}
        {renderDashboardContent()}
      </div>
    );
  }

  // Renderiza dados normalmente (demo ou reais)
  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl md:text-3xl font-bold font-heading">Dashboard</h1>
          <Badge variant="outline" className="capitalize">
            Plano {currentPlan}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground font-body">
            Visão geral das suas vendas e métricas
          </p>
        </div>
      </div>

      {/* Filtros */}
      <DashboardFilters
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        isLoading={isLoading}
      />

      {/* Badges informativos dos filtros ativos */}
      {(activeFilters.marketplace !== "all" || activeFilters.period !== "7days") && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.marketplace !== "all" && (
            <Badge variant="secondary" className="gap-1">
              <Store className="h-3 w-3" />
              {getMarketplaceLabel()}
            </Badge>
          )}
          {activeFilters.period !== "7days" && (
            <Badge variant="secondary" className="gap-1">
              <Calendar className="h-3 w-3" />
              {getPeriodLabel()}
            </Badge>
          )}
        </div>
      )}

      {/* Admin Demo Data Controls */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerateDemoData}
            disabled={isGeneratingData || isClearingData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isGeneratingData ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            Gerar Dados do Dashboard
          </button>
          {hasData && (
            <button
              onClick={handleClearData}
              disabled={isGeneratingData || isClearingData}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
            >
              {isClearingData ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Limpar Dados
            </button>
          )}
        </div>
      )}

      {!hasData && !isLoading && (
        <div className="p-8 text-center border border-dashed border-border rounded-lg bg-muted/20">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum dado encontrado</h3>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Clique em 'Gerar Dados de Demonstração' acima para popular o dashboard." : "Conecte uma integração para ver métricas."}
          </p>
        </div>
      )}

      {renderDashboardContent()}
    </div>
  );

  function renderDashboardContent() {
    // Se não há dados, não renderiza o conteúdo principal
    if (!hasData && !isLoading) return null;
    
    // Usar o faturamento total (billing) do período para calcular lucro bruto
    const periodBilling = dashboardData.marketing?.billing || 0;
    // Lucro bruto assumindo 30% de margem após taxas do marketplace
    const grossProfit = dashboardData.marketing?.grossProfit || (periodBilling * 0.3);
    // Lucro líquido = lucro bruto - despesas mensais
    const netProfit = grossProfit - totalMonthlyExpenses;
    const netMargin = periodBilling > 0 
      ? (netProfit / periodBilling) * 100 
      : 0;

    const metrics: MetricCard[] = [
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
        value: (dashboardData.totalStock || 0).toString(),
        icon: Package,
        trend: "0%",
        color: "text-warning"
      },
      {
        title: "Canais Ativos",
        value: "2",
        icon: Plug2,
        trend: "0%",
        color: "text-muted-foreground"
      }
    ];

    return (
      <>
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
          {metrics.map((metric, index) => (
            <Card 
              key={metric.title} 
              className="shadow-soft hover:shadow-medium transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </CardTitle>
                <metric.icon className={`h-4 w-4 ${metric.color} transition-transform hover:scale-110`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-heading text-foreground break-words">{metric.value}</div>
                <p className="text-xs text-muted-foreground font-body mt-1">
                  <span className={metric.trend.startsWith('+') ? 'text-success' : 'text-destructive'}>
                    {metric.trend}
                  </span>{" "}
                  vs ontem
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Net Profit Card - Highlighted */}
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
                Vendas - {getPeriodLabel()}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-8">
              <div className="h-[300px] w-full">
                {dashboardData.salesLast7Days.length > 0 && dashboardData.salesLast7Days.some(d => d.revenue > 0) ? (
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart
                      data={dashboardData.salesLast7Days.map(item => ({
                        ...item,
                        displayDate: formatDate(item.date)
                      }))}
                      margin={{ top: 20, right: 20, left: 0, bottom: 40 }}
                      barCategoryGap="25%"
                    >
                      <XAxis 
                        dataKey="displayDate" 
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                        height={60}
                      />
                      <YAxis hide />
                      <ChartTooltip 
                        content={<ChartTooltipContent 
                          labelFormatter={(label, payload) => {
                            const originalDate = payload?.[0]?.payload?.date;
                            return originalDate ? formatDate(originalDate) : label;
                          }}
                          formatter={(value) => [formatCurrency(Number(value)), "Receita"]}
                        />} 
                      />
                      <Bar 
                        dataKey="revenue" 
                        fill="var(--color-revenue)" 
                        radius={[6, 6, 0, 0]}
                        maxBarSize={80}
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Nenhuma venda no período selecionado
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Net Profit Evolution Chart */}
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
                        height={60}
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

        {/* Recent Orders */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Últimos Pedidos Recebidos
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="text-center py-8 text-muted-foreground font-body">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum pedido recente</p>
              <p className="text-sm">Os pedidos aparecerão aqui quando houver vendas</p>
            </div>
          </CardContent>
        </Card>

        {/* Marketing Metrics Section */}
        <div className="mt-8">
          <h2 className="text-xl md:text-2xl font-bold font-heading mb-4 flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Marketing
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Row 1 */}
            <Card className="shadow-soft hover:shadow-medium transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Faturamento
                </CardTitle>
                <DollarSign className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(dashboardData.marketing?.billing || 0)}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-medium transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Liq. do Marketplace
                </CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(dashboardData.marketing?.marketplaceLiquid || 0)}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-medium transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Lucro Bruto
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(dashboardData.marketing?.grossProfit || 0)}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-medium transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Margem
                </CardTitle>
                <Percent className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData.marketing?.margin || 0}%
                </div>
              </CardContent>
            </Card>

            {/* Row 2 */}
            <Card className="shadow-soft hover:shadow-medium transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Número de Vendas
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData.marketing?.salesCount || 0}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-medium transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Unidades Vendidas
                </CardTitle>
                <Package className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData.marketing?.unitsSold || 0}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-medium transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ticket Médio
                </CardTitle>
                <Receipt className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(dashboardData.marketing?.averageTicket || 0)}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-medium transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  ROI
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData.marketing?.roi || 0}%
                </div>
              </CardContent>
            </Card>

            {/* Row 3 */}
            <Card className="shadow-soft hover:shadow-medium transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Valor em Ads
                </CardTitle>
                <Target className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(dashboardData.marketing?.adSpend || 0)}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-medium transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  TACOS
                </CardTitle>
                <Percent className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData.marketing?.tacos || 0}%
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-medium transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Lucro após ADS
                </CardTitle>
                <DollarSign className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(dashboardData.marketing?.profitAfterAds || 0)}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-medium transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Margem após ADS
                </CardTitle>
                <Percent className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData.marketing?.marginAfterAds || 0}%
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }
}