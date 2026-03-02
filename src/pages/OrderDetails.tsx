import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Package, User, MapPin, Truck, Calendar, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { PlatformLogo } from "@/components/ui/platform-logo";

const statusConfig: Record<string, { label: string; color: string }> = {
  'pending': { label: 'Aguardando Pagamento', color: 'bg-primary text-primary-foreground' },
  'paid': { label: 'Pago', color: 'bg-[#10B981] text-white' },
  'processing': { label: 'Processando', color: 'bg-[#F59E0B] text-white' },
  'shipped': { label: 'Enviado', color: 'bg-[#3B82F6] text-white' },
  'delivered': { label: 'Entregue', color: 'bg-[#10B981] text-white' },
  'cancelled': { label: 'Cancelado', color: 'bg-[#EF4444] text-white' },
  'refunded': { label: 'Reembolsado', color: 'bg-[#6B7280] text-white' },
};

const shippingStatusConfig: Record<string, { label: string; color: string }> = {
  'pending_shipment': { label: 'Aguardando Envio', color: 'bg-muted text-muted-foreground' },
  'shipped': { label: 'Enviado', color: 'bg-[#3B82F6] text-white' },
  'in_transit': { label: 'Em Trânsito', color: 'bg-[#F59E0B] text-white' },
  'delivered': { label: 'Entregue', color: 'bg-[#10B981] text-white' },
  'returned': { label: 'Devolvido', color: 'bg-[#EF4444] text-white' },
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      loadOrder();
    }
  }, [user, id]);

  const loadOrder = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error('Error loading order:', error);
      toast({
        title: "Erro ao carregar pedido",
        description: "Pedido não encontrado.",
        variant: "destructive",
      });
      navigate('/app/orders');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando pedido...
        </div>
      </div>
    );
  }

  if (!order) return null;

  const statusInfo = statusConfig[order.status || 'pending'] || statusConfig['pending'];
  const shippingInfo = shippingStatusConfig[order.shipping_status || 'pending_shipment'] || shippingStatusConfig['pending_shipment'];
  const items = Array.isArray(order.items) ? order.items : (order.items ? [order.items] : []);
  const shippingHistory = Array.isArray(order.shipping_history) ? order.shipping_history : [];
  const shippingAddress = order.shipping_address as Record<string, any> | null;

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">Pedido #{order.order_id_channel}</h1>
          <p className="text-muted-foreground text-sm">
            Criado em {new Date(order.order_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <Badge className={`${statusInfo.color} border-0`}>{statusInfo.label}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-primary" />
                Itens do Pedido ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.title || item.name || 'Produto'}</p>
                            {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.quantity || 1}</TableCell>
                        <TableCell className="text-right font-medium">
                          {item.unit_price ? formatCurrency(item.unit_price * (item.quantity || 1)) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">Nenhum item detalhado disponível</p>
              )}

              <Separator className="my-4" />
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(order.total_value)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Shipping History */}
          {shippingHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5 text-primary" />
                  Histórico de Envio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {shippingHistory.map((event: any, index: number) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                        {index < shippingHistory.length - 1 && <div className="w-px h-full bg-border" />}
                      </div>
                      <div className="pb-4">
                        <p className="font-medium text-sm">{event.status || event.description || 'Atualização'}</p>
                        {event.date && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.date).toLocaleString('pt-BR')}
                          </p>
                        )}
                        {event.location && <p className="text-xs text-muted-foreground">{event.location}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Hash className="h-5 w-5 text-primary" />
                Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Plataforma</span>
                <PlatformLogo platform={order.platform} size="sm" />
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Data do Pedido</span>
                <p className="font-medium">{new Date(order.order_date).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Status de Envio</span>
                <div className="mt-1">
                  <Badge className={`${shippingInfo.color} border-0`}>{shippingInfo.label}</Badge>
                </div>
              </div>
              {order.tracking_code && (
                <div>
                  <span className="text-sm text-muted-foreground">Código de Rastreio</span>
                  <p className="font-mono text-sm font-medium">{order.tracking_code}</p>
                </div>
              )}
              {order.carrier && (
                <div>
                  <span className="text-sm text-muted-foreground">Transportadora</span>
                  <p className="font-medium">{order.carrier}</p>
                </div>
              )}
              {order.tracking_url && (
                <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    Rastrear Envio
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>

          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{order.customer_name || 'Não identificado'}</p>
              {order.customer_email && (
                <p className="text-sm text-muted-foreground">{order.customer_email}</p>
              )}
            </CardContent>
          </Card>

          {/* Shipping Address */}
          {shippingAddress && Object.keys(shippingAddress).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-primary" />
                  Endereço de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  {shippingAddress.street && <p>{shippingAddress.street}{shippingAddress.number ? `, ${shippingAddress.number}` : ''}</p>}
                  {shippingAddress.complement && <p>{shippingAddress.complement}</p>}
                  {shippingAddress.neighborhood && <p>{shippingAddress.neighborhood}</p>}
                  {(shippingAddress.city || shippingAddress.state) && (
                    <p>{[shippingAddress.city, shippingAddress.state].filter(Boolean).join(' - ')}</p>
                  )}
                  {shippingAddress.zip_code && <p>CEP: {shippingAddress.zip_code}</p>}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
