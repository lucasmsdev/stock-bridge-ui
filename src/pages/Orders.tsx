import { useState } from "react";
import { Search, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Mock data
const orders = [
  {
    id: "#12345",
    channel: "Shopify",
    channelIcon: "🛍️",
    date: "2024-01-15",
    customer: "Maria Silva Santos",
    items: 2,
    total: "R$ 189,80",
    status: "Processando",
    statusColor: "bg-primary"
  },
  {
    id: "#12344",
    channel: "Mercado Livre",
    channelIcon: "🛒",
    date: "2024-01-15",
    customer: "João Santos Oliveira",
    items: 1,
    total: "R$ 156,70",
    status: "Enviado",
    statusColor: "bg-success"
  },
  {
    id: "#12343",
    channel: "Amazon",
    channelIcon: "📦",
    date: "2024-01-14",
    customer: "Ana Costa Lima",
    items: 3,
    total: "R$ 234,50",
    status: "Entregue",
    statusColor: "bg-success"
  },
  {
    id: "#12342",
    channel: "Shopify",
    channelIcon: "🛍️",
    date: "2024-01-14",
    customer: "Carlos Lima Silva",
    items: 1,
    total: "R$ 67,80",
    status: "Cancelado",
    statusColor: "bg-destructive"
  },
  {
    id: "#12341",
    channel: "Mercado Livre",
    channelIcon: "🛒",
    date: "2024-01-13",
    customer: "Fernanda Rocha",
    items: 2,
    total: "R$ 298,40",
    status: "Aguardando Pagamento",
    statusColor: "bg-warning"
  },
  {
    id: "#12340",
    channel: "Amazon",
    channelIcon: "📦",
    date: "2024-01-13",
    customer: "Roberto Alves",
    items: 1,
    total: "R$ 89,90",
    status: "Processando",
    statusColor: "bg-primary"
  },
  {
    id: "#12339",
    channel: "Shopify",
    channelIcon: "🛍️",
    date: "2024-01-12",
    customer: "Juliana Mendes",
    items: 4,
    total: "R$ 445,60",
    status: "Enviado",
    statusColor: "bg-success"
  },
  {
    id: "#12338",
    channel: "Mercado Livre",
    channelIcon: "🛒",
    date: "2024-01-12",
    customer: "Pedro Henrique",
    items: 1,
    total: "R$ 129,90",
    status: "Entregue",
    statusColor: "bg-success"
  }
];

const channels = ["Todos os Canais", "Shopify", "Mercado Livre", "Amazon"];
const statuses = ["Todos os Status", "Processando", "Enviado", "Entregue", "Cancelado", "Aguardando Pagamento"];

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("Todos os Canais");
  const [selectedStatus, setSelectedStatus] = useState("Todos os Status");

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesChannel = selectedChannel === "Todos os Canais" || order.channel === selectedChannel;
    const matchesStatus = selectedStatus === "Todos os Status" || order.status === selectedStatus;
    
    return matchesSearch && matchesChannel && matchesStatus;
  });

  const totalValue = filteredOrders.reduce((sum, order) => {
    const value = parseFloat(order.total.replace("R$ ", "").replace(".", "").replace(",", "."));
    return sum + value;
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Todos os Pedidos</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie pedidos de todos os seus canais
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">
              {filteredOrders.length}
            </div>
            <p className="text-sm text-muted-foreground">Pedidos Filtrados</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">
              R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-muted-foreground">Valor Total</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {filteredOrders.reduce((sum, order) => sum + order.items, 0)}
            </div>
            <p className="text-sm text-muted-foreground">Itens Totais</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por ID do pedido ou cliente..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrar por Canal" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((channel) => (
                  <SelectItem key={channel} value={channel}>
                    {channel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrar por Status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID do Pedido</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded font-medium">
                      {order.id}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{order.channelIcon}</span>
                      <span className="font-medium">{order.channel}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {new Date(order.date).toLocaleDateString('pt-BR')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{order.customer}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {order.items} {order.items === 1 ? 'item' : 'itens'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-success">{order.total}</span>
                  </TableCell>
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
  );
}