import { TrendingUp, Package, ShoppingCart, Plug2, DollarSign, Loader2, TrendingDown, Users, Receipt, Target, Percent } from "lucide-react";
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

// Dados de demonstração definidos como constantes
const demoMetrics: DashboardMetrics = {
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

const demoMarketingMetrics = {
  billing: 3305.00,
  marketplaceLiquid: 2261.30,
  grossProfit: 373.44,
  margin: 11.3,
  salesCount: 39,
  unitsSold: 39,
  averageTicket: 84.74,
  roi: 23.98,
  adSpend: 208.58,
  tacos: 35.1,
  profitAfterAds: 164.86,
  marginAfterAds: 4.99
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
  // Inicializa o estado com dados demo para carregamento instantâneo
  const [dashboardData, setDashboardData] = useState<DashboardMetrics>(demoMetrics);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { currentPlan } = usePlan();

  const loadDashboardMetrics = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('=== Buscando dados reais em segundo plano ===');
      
      // Try edge function first
      const { data, error: functionError } = await supabase.functions.invoke('get-dashboard-metrics');

      if (!functionError && data && !data.error) {
        console.log('Dados recebidos da edge function:', data);
        
        // Verifica se há dados reais significativos
        const hasSignificantData = data.todayRevenue > 0 || 
                                  data.todayOrders > 0 || 
                                  data.totalProducts > 0 ||
                                  (data.salesLast7Days && data.salesLast7Days.some(day => day.revenue > 0));
        
        if (hasSignificantData) {
          console.log('Substituindo dados demo por dados reais');
          setDashboardData(data);
          setHasRealData(true);
        } else {
          console.log('Dados reais vazios, mantendo dados demo');
        }
      } else {
        console.warn('Edge function falhou, mantendo dados demo');
      }
    } catch (error) {
      console.warn('Erro na busca de dados reais, mantendo dados demo:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

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
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Acompanhe suas vendas e performance em todos os canais
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
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Acompanhe suas vendas e performance em todos os canais
        </p>
        <div className="mt-2">
          <Badge variant="outline" className="capitalize">
            Plano {currentPlan}
          </Badge>
          {!hasRealData && (
            <Badge variant="secondary" className="ml-2 text-xs">
              Modo Demonstração
            </Badge>
          )}
        </div>
      </div>

      {renderDashboardContent()}
    </div>
  );

  function renderDashboardContent() {
    const metrics: MetricCard[] = [
      {
        title: "Vendas Totais (Hoje)",
        value: formatCurrency(dashboardData.todayRevenue),
        icon: DollarSign,
        trend: hasRealData ? "+0%" : "+15%",
        color: "text-success"
      },
      {
        title: "Pedidos Recebidos (Hoje)",
        value: dashboardData.todayOrders.toString(),
        icon: ShoppingCart,
        trend: hasRealData ? "+0%" : "+8%",
        color: "text-primary"
      },
      {
        title: "Itens em Estoque",
        value: dashboardData.totalProducts.toString(),
        icon: Package,
        trend: hasRealData ? "0%" : "-2%",
        color: hasRealData ? "text-warning" : "text-destructive"
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
                <div className="text-2xl font-bold text-foreground break-words">{metric.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className={metric.trend.startsWith('+') ? 'text-success' : 'text-destructive'}>
                    {metric.trend}
                  </span>{" "}
                  em relação à ontem
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
          {/* Sales Chart */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Vendas (Últimos 7 dias)
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-8">
              <div className="h-[300px] w-full">
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
            <CardContent className="overflow-x-auto">
              {!hasRealData ? (
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
                      <TableRow 
                        key={order.id}
                        className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <TableCell className="font-medium">{order.productName}</TableCell>
                        <TableCell className="text-muted-foreground">{order.sku}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              order.status === "Entregue" ? "success" :
                              order.status === "Enviado" ? "default" : 
                              "warning"
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

        {/* Marketing Metrics Section */}
        <div className="mt-8">
          <h2 className="text-xl md:text-2xl font-bold mb-4 flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Métricas de Marketing
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
                <div className="text-2xl font-bold">{formatCurrency(demoMarketingMetrics.billing)}</div>
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
                <div className="text-2xl font-bold">{formatCurrency(demoMarketingMetrics.marketplaceLiquid)}</div>
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
                <div className="text-2xl font-bold">{formatCurrency(demoMarketingMetrics.grossProfit)}</div>
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
                <div className="text-2xl font-bold">{demoMarketingMetrics.margin}%</div>
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
                <div className="text-2xl font-bold">{demoMarketingMetrics.salesCount}</div>
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
                <div className="text-2xl font-bold">{demoMarketingMetrics.unitsSold}</div>
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
                <div className="text-2xl font-bold">{formatCurrency(demoMarketingMetrics.averageTicket)}</div>
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
                <div className="text-2xl font-bold">{demoMarketingMetrics.roi}%</div>
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
                <div className="text-2xl font-bold">{formatCurrency(demoMarketingMetrics.adSpend)}</div>
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
                <div className="text-2xl font-bold">{demoMarketingMetrics.tacos}%</div>
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
                <div className="text-2xl font-bold">{formatCurrency(demoMarketingMetrics.profitAfterAds)}</div>
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
                <div className="text-2xl font-bold">{demoMarketingMetrics.marginAfterAds}%</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }
}