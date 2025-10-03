import { useState, useEffect } from "react";
import { Search, Filter, Download, ShoppingCart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlatformLogo } from "@/components/ui/platform-logo";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Order {
  id: string;
  user_id: string;
  order_id_channel: string;
  platform: string;
  total_value: number;
  order_date: string;
  items: any;
  created_at: string;
  updated_at: string;
}

interface FormattedOrder {
  id: string;
  channel: string;
  date: string;
  customer: string;
  items: number;
  total: string;
  status: string;
  statusColor: string;
}

const channels = ["Todos os Canais", "Mercado Livre", "Shopify"];
const statuses = ["Todos os Status", "Processando", "Enviado", "Entregue", "Cancelado", "Aguardando Pagamento"];

const getRandomStatus = () => {
  const statusOptions = [
    { status: "Processando", color: "bg-primary" },
    { status: "Enviado", color: "bg-success" },
    { status: "Entregue", color: "bg-success" },
    { status: "Cancelado", color: "bg-destructive" },
    { status: "Aguardando Pagamento", color: "bg-warning" }
  ];
  return statusOptions[Math.floor(Math.random() * statusOptions.length)];
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("Todos os Canais");
  const [selectedStatus, setSelectedStatus] = useState("Todos os Status");
  const [orders, setOrders] = useState<FormattedOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadOrders = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setIsEmpty(false);

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('order_date', { ascending: false });

      if (error) {
        console.error('Error loading orders:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        setIsEmpty(true);
        setOrders([]);
        setIsLoading(false);
        return;
      }

      // Format orders for display
      const formattedOrders: FormattedOrder[] = data.map((order, index) => {
        const statusInfo = getRandomStatus();
        const itemsArray = Array.isArray(order.items) ? order.items : (order.items ? [order.items] : []);
        
        return {
          id: `#${order.order_id_channel}`,
          channel: order.platform,
          date: order.order_date,
          customer: `Cliente ${index + 1}`, // Since we don't have customer names in the table yet
          items: itemsArray.length,
          total: formatCurrency(order.total_value),
          status: statusInfo.status,
          statusColor: statusInfo.color
        };
      });

      setOrders(formattedOrders);

    } catch (error) {
      console.error('Error loading orders:', error);
      toast({
        title: "Erro ao carregar pedidos",
        description: "Não foi possível carregar os pedidos. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando pedidos...
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="space-y-6 animate-fade-in">
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

        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <ShoppingCart className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Nenhum pedido encontrado
          </h3>
          <p className="text-muted-foreground max-w-md">
            Assim que as vendas forem sincronizadas, seus pedidos aparecerão aqui.
          </p>
        </div>
      </div>
    );
  }

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
                <TableRow 
                  key={order.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors hover:shadow-soft"
                >
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded font-medium hover:bg-muted/80 transition-colors">
                      {order.id}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PlatformLogo platform={order.channel} size="sm" />
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