import { useState } from "react";
import { Package, Calendar, Check, X, Clock, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useToast } from "@/hooks/use-toast";

interface OrderItem {
  product_id: string;
  quantity: number;
  unit_cost: number;
}

export interface PurchaseOrderListItem {
  id: string;
  order_number: string;
  status: string;
  total_value: number;
  items: unknown;
  expected_delivery: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
}

interface PurchaseOrderListProps {
  orders: PurchaseOrderListItem[];
  onOrderUpdated: () => void;
  supplierId: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "Pendente", variant: "secondary", icon: Clock },
  confirmed: { label: "Confirmado", variant: "outline", icon: Check },
  received: { label: "Recebido", variant: "default", icon: Package },
  cancelled: { label: "Cancelado", variant: "destructive", icon: X },
};

export const PurchaseOrderList = ({ orders, onOrderUpdated, supplierId }: PurchaseOrderListProps) => {
  const { user } = useAuthSession();
  const { toast } = useToast();
  const [confirmReceiveId, setConfirmReceiveId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      
      if (newStatus === "received") {
        updateData.received_at = new Date().toISOString();
        
        // Atualizar estoque dos produtos
        const order = orders.find((o) => o.id === orderId);
        const orderItems = Array.isArray(order?.items) ? order.items as OrderItem[] : [];
        if (orderItems.length > 0) {
          for (const item of orderItems) {
            // Buscar estoque atual
            const { data: product } = await supabase
              .from("products")
              .select("stock")
              .eq("id", item.product_id)
              .single();

            if (product) {
              await supabase
                .from("products")
                .update({ stock: product.stock + item.quantity })
                .eq("id", item.product_id);
            }
          }
        }
      }

      const { error } = await supabase
        .from("purchase_orders")
        .update(updateData)
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Pedido atualizado",
        description: newStatus === "received" 
          ? "O estoque foi atualizado automaticamente." 
          : "O status do pedido foi alterado.",
      });
      onOrderUpdated();
    } catch (error) {
      console.error("Error updating order:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o pedido.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Pedido excluído",
        description: "O pedido foi removido com sucesso.",
      });
      onOrderUpdated();
    } catch (error) {
      console.error("Error deleting order:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o pedido.",
        variant: "destructive",
      });
    }
  };

  if (orders.length === 0) {
    return (
      <Card className="bg-card border-border shadow-soft">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Nenhum pedido de compra
          </h3>
          <p className="text-muted-foreground text-center">
            Crie um pedido de compra para repor seu estoque.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-foreground">Pedidos de Compra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {orders.map((order) => {
            const config = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = config.icon;

            return (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-medium text-foreground">{order.order_number}</p>
                    <Badge variant={config.variant} className="flex items-center gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      {Array.isArray(order.items) ? order.items.length : 0} itens
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(order.created_at)}
                    </span>
                    {order.expected_delivery && (
                      <span>
                        Prev. entrega: {formatDate(order.expected_delivery)}
                      </span>
                    )}
                    {order.received_at && (
                      <span className="text-green-600 dark:text-green-400">
                        Recebido: {formatDate(order.received_at)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-lg font-bold text-foreground">
                    {formatCurrency(order.total_value)}
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      {order.status === "pending" && (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleUpdateStatus(order.id, "confirmed")}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Confirmar Pedido
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setConfirmReceiveId(order.id)}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            Marcar como Recebido
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setConfirmCancelId(order.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar Pedido
                          </DropdownMenuItem>
                        </>
                      )}
                      {order.status === "confirmed" && (
                        <>
                          <DropdownMenuItem
                            onClick={() => setConfirmReceiveId(order.id)}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            Marcar como Recebido
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setConfirmCancelId(order.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar Pedido
                          </DropdownMenuItem>
                        </>
                      )}
                      {(order.status === "received" || order.status === "cancelled") && (
                        <DropdownMenuItem
                          onClick={() => handleDeleteOrder(order.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Excluir Pedido
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Confirm Receive Dialog */}
      <AlertDialog open={!!confirmReceiveId} onOpenChange={() => setConfirmReceiveId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmar Recebimento</AlertDialogTitle>
            <AlertDialogDescription>
              Ao marcar como recebido, o estoque dos produtos será atualizado automaticamente 
              com as quantidades do pedido. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmReceiveId) {
                  handleUpdateStatus(confirmReceiveId, "received");
                  setConfirmReceiveId(null);
                }
              }}
              className="bg-gradient-primary text-primary-foreground"
            >
              Confirmar Recebimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Cancel Dialog */}
      <AlertDialog open={!!confirmCancelId} onOpenChange={() => setConfirmCancelId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Cancelar Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmCancelId) {
                  handleUpdateStatus(confirmCancelId, "cancelled");
                  setConfirmCancelId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancelar Pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
