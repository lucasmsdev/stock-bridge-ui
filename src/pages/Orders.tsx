import { useState, useEffect } from "react";
import { Search, Download, ShoppingCart, Loader2, RefreshCw } from "lucide-react";
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
  status: string | null;
  customer_name: string | null;
  customer_email: string | null;
  last_sync_at: string | null;
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

const channels = ["Todos os Canais", "mercadolivre", "shopify", "amazon"];
const statuses = ["Todos os Status", "pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];

const platformLogos: Record<string, { url: string; darkInvert?: boolean }> = {
  'mercadolivre': { url: "https://vectorseek.com/wp-content/uploads/2023/08/Mercado-Livre-Icon-Logo-Vector.svg-.png" },
  'mercado livre': { url: "https://vectorseek.com/wp-content/uploads/2023/08/Mercado-Livre-Icon-Logo-Vector.svg-.png" },
  'shopify': { url: "https://cdn3.iconfinder.com/data/icons/social-media-2068/64/_shopping-512.png" },
  'amazon': { url: "https://upload.wikimedia.org/wikipedia/commons/d/de/Amazon_icon.png", darkInvert: true },
  'shopee': { url: "https://www.freepnglogos.com/uploads/shopee-logo/shopee-bag-logo-free-transparent-icon-17.png" },
};

// Status display configuration
const statusConfig: Record<string, { label: string; color: string }> = {
  'pending': { label: 'Aguardando Pagamento', color: 'bg-primary text-primary-foreground' },
  'paid': { label: 'Pago', color: 'bg-[#10B981] text-white' },
  'processing': { label: 'Processando', color: 'bg-[#F59E0B] text-white' },
  'shipped': { label: 'Enviado', color: 'bg-[#3B82F6] text-white' },
  'delivered': { label: 'Entregue', color: 'bg-[#10B981] text-white' },
  'cancelled': { label: 'Cancelado', color: 'bg-[#EF4444] text-white' },
  'refunded': { label: 'Reembolsado', color: 'bg-[#6B7280] text-white' },
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const exportOrdersToCSV = (orders: FormattedOrder[]) => {
  const headers = ['ID do Pedido', 'Canal', 'Data', 'Cliente', 'Itens', 'Valor Total', 'Status'];
  
  const csvContent = [
    headers.join(';'),
    ...orders.map(order => [
      order.id,
      order.channel,
      new Date(order.date).toLocaleDateString('pt-BR'),
      order.customer,
      order.items,
      order.total,
      order.status
    ].join(';'))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `pedidos_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("Todos os Canais");
  const [selectedStatus, setSelectedStatus] = useState("Todos os Status");
  const [orders, setOrders] = useState<FormattedOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
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

      // Get most recent sync time
      const latestSync = data.reduce((latest, order) => {
        if (order.last_sync_at && (!latest || new Date(order.last_sync_at) > new Date(latest))) {
          return order.last_sync_at;
        }
        return latest;
      }, null as string | null);
      setLastSyncAt(latestSync);

      // Format orders for display
      const formattedOrders: FormattedOrder[] = data.map((order) => {
        const status = order.status || 'pending';
        const statusInfo = statusConfig[status] || statusConfig['pending'];
        const itemsArray = Array.isArray(order.items) ? order.items : (order.items ? [order.items] : []);
        
        return {
          id: `#${order.order_id_channel}`,
          channel: order.platform,
          date: order.order_date,
          customer: order.customer_name || 'Cliente não identificado',
          items: itemsArray.length,
          total: formatCurrency(order.total_value),
          status: statusInfo.label,
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

  const handleSyncOrders = async () => {
    if (!user) return;

    try {
      setIsSyncing(true);
      
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        toast({
          title: "Erro de autenticação",
          description: "Faça login para sincronizar pedidos.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sincronizando pedidos...",
        description: "Buscando pedidos de todos os marketplaces conectados.",
      });

      const { data, error } = await supabase.functions.invoke('sync-orders', {
        body: { days_since: 30 },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (error) {
        console.error('Error syncing orders:', error);
        throw error;
      }

      toast({
        title: "Sincronização concluída!",
        description: `${data.synced} pedidos sincronizados, ${data.new_orders} novos.`,
      });

      // Reload orders
      await loadOrders();

    } catch (error) {
      console.error('Error syncing orders:', error);
      toast({
        title: "Erro ao sincronizar",
        description: "Não foi possível sincronizar os pedidos. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
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
    
    // Map display status back to filter
    const statusKey = Object.entries(statusConfig).find(([, v]) => v.label === order.status)?.[0];
    const matchesStatus = selectedStatus === "Todos os Status" || statusKey === selectedStatus;
    
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
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Todos os Pedidos</h1>
            <p className="text-muted-foreground">
              Visualize e gerencie pedidos de todos os seus canais
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="default" 
              className="gap-2"
              onClick={handleSyncOrders}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar
            </Button>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => exportOrdersToCSV(filteredOrders)}
              disabled={filteredOrders.length === 0}
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <ShoppingCart className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Nenhum pedido encontrado
          </h3>
          <p className="text-muted-foreground max-w-md mb-4">
            Clique em "Sincronizar" para buscar pedidos dos marketplaces conectados.
          </p>
          <Button onClick={handleSyncOrders} disabled={isSyncing}>
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar Pedidos
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Todos os Pedidos</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie pedidos de todos os seus canais
            {lastSyncAt && (
              <span className="ml-2 text-xs">
                • Última sincronização: {new Date(lastSyncAt).toLocaleString('pt-BR')}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="default" 
            className="gap-2"
            onClick={handleSyncOrders}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sincronizar
          </Button>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => exportOrdersToCSV(filteredOrders)}
            disabled={filteredOrders.length === 0}
          >
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
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
            <div className="text-2xl font-bold text-primary">
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
                    {channel === "Todos os Canais" ? channel : channel.charAt(0).toUpperCase() + channel.slice(1)}
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
                    {status === "Todos os Status" ? status : (statusConfig[status]?.label || status)}
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
                <TableHead className="text-center">Canal</TableHead>
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
                    <div className="flex items-center justify-center">
                      {(() => {
                        const platformKey = order.channel.toLowerCase();
                        const logoConfig = platformLogos[platformKey];
                        return logoConfig ? (
                          <img
                            src={logoConfig.url}
                            alt={`${order.channel} logo`}
                            className={`h-6 w-auto object-contain ${logoConfig.darkInvert ? 'dark:invert' : ''}`}
                          />
                        ) : (
                          <span className="text-lg">🛍️</span>
                        );
                      })()}
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
                    <span className="font-medium text-primary">{order.total}</span>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      className={`${order.statusColor} border-0`}
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
