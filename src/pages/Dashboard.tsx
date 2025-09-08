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
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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

  const loadDashboardMetrics = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('=== Starting dashboard metrics load ===');
      setIsLoading(true);
      setError(null);
      setDashboardData(null);

      console.log('Calling get-dashboard-metrics function...');
      const { data, error: functionError } = await supabase.functions.invoke('get-dashboard-metrics');

      if (functionError) {
        console.error('Function returned error:', functionError);
        throw new Error(functionError.message || 'Falha na chamada da função');
      }

      if (!data) {
        console.error('Function returned no data');
        throw new Error('Nenhum dado retornado pela função');
      }

      // Check if the response contains an error
      if (data.error) {
        console.error('Function returned error in data:', data.error);
        throw new Error(data.error);
      }

      console.log('Dashboard metrics received:', data);

      // Check if we have meaningful data (not just zeros)
      const hasData = data && (
        data.todayRevenue > 0 || 
        data.todayOrders > 0 || 
        data.totalProducts > 0 ||
        (data.salesLast7Days && data.salesLast7Days.some((day: { revenue: number }) => day.revenue > 0))
      );

      console.log('Has meaningful data:', hasData);

      if (hasData) {
        setDashboardData(data);
        toast({
          title: "Dashboard atualizado",
          description: "Métricas carregadas com sucesso!",
        });
      } else {
        // Even if no meaningful data, we still set the data so we can show empty state properly
        setDashboardData(data);
        console.log('No meaningful data found, showing empty state');
      }

    } catch (error) {
      console.error('=== ERROR loading dashboard metrics ===');
      console.error('Error details:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(`Não foi possível carregar os dados do dashboard: ${errorMessage}`);
      
      toast({
        title: "Erro ao carregar dashboard",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      console.log('=== Dashboard metrics load completed ===');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardMetrics();
  }, [user]);

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
            onClick={() => loadDashboardMetrics()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Empty state (no meaningful data)
  if (!dashboardData || (
    dashboardData.todayRevenue === 0 && 
    dashboardData.todayOrders === 0 && 
    dashboardData.totalProducts === 0 &&
    (!dashboardData.salesLast7Days || dashboardData.salesLast7Days.every(day => day.revenue === 0))
  )) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Acompanhe suas vendas e performance em todos os canais
          </p>
        </div>
        
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Ainda não há dados suficientes para exibir o dashboard
          </h3>
          <p className="text-muted-foreground max-w-md">
            Comece importando seus produtos e sincronizando seus pedidos para ver suas métricas aqui.
          </p>
        </div>
      </div>
    );
  }

  // Success state - render dashboard with data
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
      value: dashboardData.totalProducts.toString(),
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
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Acompanhe suas vendas e performance em todos os canais
        </p>
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
                  data={dashboardData.salesLast7Days.map(item => ({
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

        {/* Recent Orders Placeholder */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Últimos Pedidos Recebidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum pedido encontrado</p>
              <p className="text-sm">Os pedidos aparecerão aqui quando você conectar seus canais de venda</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}