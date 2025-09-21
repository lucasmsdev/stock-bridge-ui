import { TrendingUp, Package, ShoppingCart, Plug2, DollarSign, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis } from "recharts";

interface DashboardMetrics {
  todayRevenue: number;
  todayOrders: number;
  totalProducts: number;
  salesLast7Days: Array<{
    date: string;
    revenue: number;
  }>;
}

interface MetricCard {
  title: string;
  value: string;
  icon: any;
  trend: string;
  color: string;
}

const chartConfig = {
  revenue: {
    label: "Receita",
    color: "hsl(var(--primary))",
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardMetrics | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { currentPlan, canAccess } = usePlan();

  const loadDashboardMetrics = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('=== Starting dashboard metrics load ===');
      setIsLoading(true);
      setError(null);
      
      // Try edge function first
      try {
        console.log('Calling get-dashboard-metrics function...');
        const { data, error: functionError } = await supabase.functions.invoke('get-dashboard-metrics');

        if (!functionError && data && !data.error) {
          console.log('Dashboard metrics received from edge function:', data);
          setDashboardData(data);
          return;
        } else {
          console.warn('Edge function failed, falling back to direct database query');
        }
      } catch (functionError) {
        console.warn('Edge function error, using fallback:', functionError);
      }

      // Fallback: Get data directly from database
      console.log('Loading data directly from database...');
      
      // Get today's boundaries
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      // Get products count - this will always return a number (0 if none)
      const { count: totalProducts, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (productsError) {
        console.error('Error loading products count:', productsError);
      }

      // Try to get orders for today (optional)
      let todayRevenue = 0;
      let todayOrders = 0;
      
      try {
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('total_value')
          .eq('user_id', user.id)
          .gte('order_date', todayStart.toISOString())
          .lt('order_date', todayEnd.toISOString());

        if (!ordersError && ordersData) {
          todayRevenue = ordersData.reduce((sum, order) => sum + Number(order.total_value), 0);
          todayOrders = ordersData.length;
        }
      } catch (ordersError) {
        console.warn('Could not load orders data:', ordersError);
      }

      // Always create data object - this ensures we never have null/undefined
      const dashboardData = {
        todayRevenue,
        todayOrders,
        totalProducts: totalProducts || 0,
        salesLast7Days: Array.from({ length: 7 }, (_, i) => {
          const date = new Date(todayStart);
          date.setDate(date.getDate() - (6 - i));
          return {
            date: date.toISOString().split('T')[0],
            revenue: 0
          };
        })
      };

      // Always set data, even if everything is zero
      setDashboardData(dashboardData);
      console.log('Dashboard data loaded:', dashboardData);

    } catch (error) {
      console.error('=== ERROR loading dashboard metrics ===');
      console.error('Error details:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(`Falha ao carregar dashboard: ${errorMessage}`);
      
      toast({
        title: "Erro no dashboard",
        description: "Não foi possível carregar os dados. Tente recarregar a página.",
        variant: "destructive",
      });
    } finally {
      // ALWAYS set loading to false, regardless of success or error
      console.log('=== Dashboard metrics load completed ===');
      setIsLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    loadDashboardMetrics();
  }, [loadDashboardMetrics]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando métricas do dashboard...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Acompanhe suas vendas e performance em todos os canais
          </p>
        </div>
        
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <TrendingUp className="h-16 w-16 text-destructive/50 mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Erro ao carregar o dashboard
          </h3>
          <p className="text-muted-foreground max-w-md mb-4">
            {error}
          </p>
          <button 
            onClick={loadDashboardMetrics}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Check if we have meaningful data to show
  const hasData = dashboardData && (
    dashboardData.todayRevenue > 0 || 
    dashboardData.todayOrders > 0 || 
    dashboardData.totalProducts > 0 ||
    (dashboardData.salesLast7Days && dashboardData.salesLast7Days.some(day => day.revenue > 0))
  );

  // Demo data for when dashboard is empty
  const demoData = {
    todayRevenue: 1874.50,
    todayOrders: 12,
    totalProducts: 842,
    salesLast7Days: [
      { date: "2024-09-13", revenue: 1200 },
      { date: "2024-09-14", revenue: 1500 },
      { date: "2024-09-15", revenue: 1400 },
      { date: "2024-09-16", revenue: 1800 },
      { date: "2024-09-17", revenue: 2100 },
      { date: "2024-09-18", revenue: 2500 },
      { date: "2024-09-19", revenue: 2850 }
    ]
  };

  const demoOrders = [
    {
      id: "1",
      productName: "Monitor Gamer UltraWide 34\"",
      sku: "UG34-01",
      status: "Entregue",
      value: 2899.90
    },
    {
      id: "2", 
      productName: "Teclado Mecânico RGB TKL",
      sku: "TM-RGB-TKL",
      status: "Enviado",
      value: 349.90
    },
    {
      id: "3",
      productName: "Mouse Gamer Sem Fio 16k DPI", 
      sku: "MG-SF-16K",
      status: "Processando",
      value: 499.00
    }
  ];

  // Use demo data if no real data exists
  const displayData = hasData ? dashboardData : demoData;

  // Success state - render dashboard with data (real or demo)
  const metrics: MetricCard[] = [
    {
      title: "Vendas Totais (Hoje)",
      value: formatCurrency(displayData.todayRevenue),
      icon: DollarSign,
      trend: hasData ? "+0%" : "+15%",
      color: "text-success"
    },
    {
      title: "Pedidos Recebidos (Hoje)",
      value: displayData.todayOrders.toString(),
      icon: ShoppingCart,
      trend: hasData ? "+0%" : "+8%",
      color: "text-primary"
    },
    {
      title: "Itens em Estoque",
      value: displayData.totalProducts.toString(),
      icon: Package,
      trend: hasData ? "0%" : "-2%",
      color: hasData ? "text-warning" : "text-destructive"
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
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Acompanhe suas vendas e performance em todos os canais
          </p>
          <div className="mt-2">
            <Badge variant="outline" className="capitalize">
              Plano {currentPlan}
            </Badge>
          </div>
        </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <div className="text-2xl font-bold text-foreground">{metric.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className={metric.trend.startsWith('+') ? 'text-success' : 'text-destructive'}>
                  {metric.trend}
                </span>{" "}
                em relação à ontem
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Vendas (Últimos 7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ChartContainer config={chartConfig}>
                <BarChart
                  data={displayData.salesLast7Days.map(item => ({
                    ...item,
                    displayDate: formatDate(item.date)
                  }))}
                >
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
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
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Últimos Pedidos Recebidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData && demoOrders ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.productName}</TableCell>
                      <TableCell className="text-muted-foreground">{order.sku}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            order.status === "Entregue" ? "default" :
                            order.status === "Enviado" ? "secondary" : 
                            "outline"
                          }
                          className="text-xs"
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(order.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum pedido encontrado</p>
                <p className="text-sm">Os pedidos aparecerão aqui quando você conectar seus canais de venda</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}