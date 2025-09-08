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
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [salesData, setSalesData] = useState<Array<{ date: string; revenue: number; }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadDashboardMetrics = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      console.log('Calling get-dashboard-metrics function...');

      const { data, error } = await supabase.functions.invoke('get-dashboard-metrics');

      if (error) {
        console.error('Error calling dashboard metrics function:', error);
        throw error;
      }

      const metricsData: DashboardMetrics = data;
      console.log('Dashboard metrics received:', metricsData);

      // Calculate metrics cards
      const metricsCards: MetricCard[] = [
        {
          title: "Vendas Totais (Hoje)",
          value: formatCurrency(metricsData.todayRevenue),
          icon: DollarSign,
          trend: "+0%", // We'd need previous day data to calculate this
          color: "text-success"
        },
        {
          title: "Pedidos Recebidos (Hoje)",
          value: metricsData.todayOrders.toString(),
          icon: ShoppingCart,
          trend: "+0%", // We'd need previous day data to calculate this
          color: "text-primary"
        },
        {
          title: "Itens em Estoque",
          value: metricsData.totalProducts.toString(),
          icon: Package,
          trend: "0%",
          color: "text-warning"
        },
        {
          title: "Canais Ativos",
          value: "2", // Based on available integrations (ML + future Shopify)
          icon: Plug2,
          trend: "0%",
          color: "text-muted-foreground"
        }
      ];

      setMetrics(metricsCards);
      setSalesData(metricsData.salesLast7Days);

      toast({
        title: "Dashboard atualizado",
        description: "Métricas carregadas com sucesso!",
      });

    } catch (error) {
      console.error('Error loading dashboard metrics:', error);
      toast({
        title: "Erro ao carregar métricas",
        description: "Não foi possível carregar os dados do dashboard. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboardMetrics();
    }
  }, [user]);

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
                  data={salesData.map(item => ({
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