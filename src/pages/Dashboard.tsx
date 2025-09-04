import { TrendingUp, Package, ShoppingCart, Plug2, DollarSign } from "lucide-react";
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

// Mock data
const metrics = [
  {
    title: "Vendas Totais (Hoje)",
    value: "R$ 1.890,50",
    icon: DollarSign,
    trend: "+12%",
    color: "text-success"
  },
  {
    title: "Pedidos Recebidos (Hoje)",
    value: "32",
    icon: ShoppingCart,
    trend: "+8%", 
    color: "text-primary"
  },
  {
    title: "Itens em Estoque",
    value: "1.456",
    icon: Package,
    trend: "-2%",
    color: "text-warning"
  },
  {
    title: "Canais Ativos",
    value: "3",
    icon: Plug2,
    trend: "0%",
    color: "text-muted-foreground"
  }
];

const recentOrders = [
  {
    id: "#12345",
    channel: "Shopify",
    channelIcon: "🛍️",
    customer: "Maria Silva",
    value: "R$ 89,90",
    status: "Processando",
    statusColor: "bg-primary"
  },
  {
    id: "#12344",
    channel: "Mercado Livre",
    channelIcon: "🛒",
    customer: "João Santos", 
    value: "R$ 156,70",
    status: "Enviado",
    statusColor: "bg-success"
  },
  {
    id: "#12343",
    channel: "Amazon",
    channelIcon: "📦",
    customer: "Ana Costa",
    value: "R$ 234,50",
    status: "Entregue",
    statusColor: "bg-success"
  },
  {
    id: "#12342",
    channel: "Shopify",
    channelIcon: "🛍️",
    customer: "Carlos Lima",
    value: "R$ 67,80",
    status: "Cancelado",
    statusColor: "bg-destructive"
  }
];

const salesData = [
  { channel: "Shopify", sales: 850, color: "bg-primary" },
  { channel: "Mercado Livre", sales: 620, color: "bg-success" },
  { channel: "Amazon", sales: 420, color: "bg-warning" }
];

export default function Dashboard() {
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
        {metrics.map((metric) => (
          <Card key={metric.title} className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
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
              Vendas por Canal (Últimos 7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {salesData.map((item) => (
                <div key={item.channel} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="font-medium">{item.channel}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${item.color}`}
                        style={{ width: `${(item.sales / 850) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium min-w-[80px] text-right">
                      R$ {item.sales.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{order.channelIcon}</span>
                        <span className="text-sm">{order.channel}</span>
                      </div>
                    </TableCell>
                    <TableCell>{order.customer}</TableCell>
                    <TableCell className="font-medium">{order.value}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={`${order.statusColor} text-white`}
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}