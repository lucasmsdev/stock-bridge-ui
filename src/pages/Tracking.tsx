import { useState, useEffect } from "react";
import { 
  Search, PackageSearch, Truck, Clock, CheckCircle2, 
  Package, Copy, ExternalLink, Loader2, RefreshCw,
  ChevronDown, ChevronRight, AlertCircle, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { PlatformLogo } from "@/components/ui/platform-logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Shipping status config
const shippingStatusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending_shipment: { label: "Aguardando Envio", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30", icon: Clock },
  shipped: { label: "Postado", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30", icon: Package },
  in_transit: { label: "Em Trânsito", color: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30", icon: Truck },
  out_for_delivery: { label: "Saiu para Entrega", color: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30", icon: Truck },
  delivered: { label: "Entregue", color: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30", icon: CheckCircle2 },
  returned: { label: "Devolvido", color: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30", icon: RotateCcw },
};

const platforms = ["all", "mercadolivre", "shopee", "amazon", "shopify", "magalu"];
const shippingStatuses = ["all", "pending_shipment", "shipped", "in_transit", "out_for_delivery", "delivered", "returned"];

interface TrackingOrder {
  id: string;
  order_id_channel: string;
  platform: string;
  customer_name: string | null;
  items: any;
  tracking_code: string | null;
  tracking_url: string | null;
  carrier: string | null;
  shipping_status: string | null;
  shipping_updated_at: string | null;
  shipping_history: any;
  order_date: string;
  total_value: number;
}

interface ShippingEvent {
  date: string;
  status: string;
  description: string;
  location?: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

export default function Tracking() {
  const [orders, setOrders] = useState<TrackingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadTrackingOrders = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      // Fetch orders with shipping_status OR orders with status shipped/processing/paid (even without shipping_status)
      const { data: withStatus, error: err1 } = await supabase
        .from("orders")
        .select("id, order_id_channel, platform, customer_name, items, tracking_code, tracking_url, carrier, shipping_status, shipping_updated_at, shipping_history, order_date, total_value")
        .eq("user_id", user.id)
        .not("shipping_status", "is", null)
        .order("shipping_updated_at", { ascending: false, nullsFirst: false });

      const { data: withoutStatus, error: err2 } = await supabase
        .from("orders")
        .select("id, order_id_channel, platform, customer_name, items, tracking_code, tracking_url, carrier, shipping_status, shipping_updated_at, shipping_history, order_date, total_value")
        .eq("user_id", user.id)
        .is("shipping_status", null)
        .in("status", ["shipped", "processing", "paid"])
        .order("order_date", { ascending: false });

      const error = err1 || err2;
      const existingIds = new Set((withStatus || []).map((o: any) => o.id));
      const mergedOrders = [
        ...(withStatus || []),
        ...(withoutStatus || []).filter((o: any) => !existingIds.has(o.id)).map((o: any) => ({
          ...o,
          shipping_status: "pending_shipment",
        })),
      ];
      const data = mergedOrders;

      if (error) throw error;
      setOrders((data as TrackingOrder[]) || []);
    } catch (error) {
      console.error("Error loading tracking orders:", error);
      toast({ title: "Erro ao carregar rastreios", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncTracking = async () => {
    if (!user) return;
    try {
      setIsSyncing(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) return;

      const { data, error } = await supabase.functions.invoke("sync-tracking", {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });

      if (error) throw error;
      toast({ title: "Rastreios sincronizados!", description: data?.message || "Dados atualizados." });
      await loadTrackingOrders();
    } catch (error) {
      console.error("Error syncing tracking:", error);
      toast({ title: "Erro ao sincronizar rastreios", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (user) loadTrackingOrders();
  }, [user]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Código copiado!" });
  };

  // Filters
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !searchTerm ||
      order.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.order_id_channel.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlatform = selectedPlatform === "all" || order.platform === selectedPlatform;
    const matchesStatus = selectedStatus === "all" || order.shipping_status === selectedStatus;
    return matchesSearch && matchesPlatform && matchesStatus;
  });

  // Summary counts
  const counts = {
    active: orders.filter((o) => o.shipping_status && !["delivered", "returned"].includes(o.shipping_status)).length,
    pending: orders.filter((o) => o.shipping_status === "pending_shipment").length,
    in_transit: orders.filter((o) => ["shipped", "in_transit", "out_for_delivery"].includes(o.shipping_status || "")).length,
    delivered_7d: orders.filter((o) => {
      if (o.shipping_status !== "delivered" || !o.shipping_updated_at) return false;
      const diff = Date.now() - new Date(o.shipping_updated_at).getTime();
      return diff <= 7 * 24 * 60 * 60 * 1000;
    }).length,
  };

  // Progress steps
  const progressSteps = ["pending_shipment", "shipped", "in_transit", "out_for_delivery", "delivered"];
  const getProgressIndex = (status: string) => progressSteps.indexOf(status);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando rastreios...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <PackageSearch className="h-7 w-7 text-primary" />
            Rastreio de Envios
          </h1>
          <p className="text-muted-foreground">Acompanhe todas as entregas dos seus pedidos</p>
        </div>
        <Button onClick={handleSyncTracking} disabled={isSyncing} className="gap-2">
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sincronizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-soft">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.active}</p>
                <p className="text-xs text-muted-foreground">Envios Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.pending}</p>
                <p className="text-xs text-muted-foreground">Aguardando Envio</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.in_transit}</p>
                <p className="text-xs text-muted-foreground">Em Trânsito</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.delivered_7d}</p>
                <p className="text-xs text-muted-foreground">Entregues (7 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-soft">
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar código de rastreio, cliente ou pedido..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Marketplace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {platforms.slice(1).map((p) => (
                  <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {shippingStatuses.slice(1).map((s) => (
                  <SelectItem key={s} value={s}>{shippingStatusConfig[s]?.label || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <PackageSearch className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-1">Nenhum rastreio encontrado</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            {orders.length === 0
              ? "Gere dados demo ou sincronize pedidos para ver os rastreios aqui."
              : "Nenhum pedido corresponde aos filtros selecionados."}
          </p>
        </div>
      ) : (
        /* Tracking Table */
        <Card className="shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Código de Rastreio</TableHead>
                  <TableHead>Transportadora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atualização</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const isExpanded = expandedRow === order.id;
                  const statusInfo = shippingStatusConfig[order.shipping_status || "pending_shipment"] || shippingStatusConfig.pending_shipment;
                  const StatusIcon = statusInfo.icon;
                  const history: ShippingEvent[] = Array.isArray(order.shipping_history) ? order.shipping_history : [];
                  const currentStep = getProgressIndex(order.shipping_status || "pending_shipment");

                  return (
                    <>
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedRow(isExpanded ? null : order.id)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <PlatformLogo platform={order.platform} size="sm" />
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              #{order.order_id_channel.slice(-8)}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {order.customer_name || "—"}
                        </TableCell>
                        <TableCell>
                          {order.tracking_code ? (
                            <div className="flex items-center gap-1.5">
                              <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                                {order.tracking_code}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(order.tracking_code!);
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{order.carrier || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${statusInfo.color} border text-xs gap-1`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {order.shipping_updated_at
                            ? formatDistanceToNow(new Date(order.shipping_updated_at), { addSuffix: true, locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {order.tracking_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(order.tracking_url!, "_blank");
                              }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <TableRow key={`${order.id}-detail`}>
                          <TableCell colSpan={8} className="bg-muted/30 p-0">
                            <div className="p-5 space-y-4">
                              {/* Progress bar */}
                              {order.shipping_status !== "returned" && (
                                <div className="flex items-center gap-1">
                                  {progressSteps.map((step, i) => {
                                    const isCompleted = i <= currentStep;
                                    const isCurrent = i === currentStep;
                                    const stepInfo = shippingStatusConfig[step];
                                    return (
                                      <div key={step} className="flex-1 flex flex-col items-center gap-1">
                                        <div
                                          className={`h-2 w-full rounded-full transition-all ${
                                            isCompleted
                                              ? "bg-primary"
                                              : "bg-muted-foreground/20"
                                          }`}
                                        />
                                        <span
                                          className={`text-[10px] ${
                                            isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                                          }`}
                                        >
                                          {stepInfo.label}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Timeline */}
                              {history.length > 0 ? (
                                <div className="space-y-0">
                                  <p className="text-sm font-semibold mb-3">Histórico de Rastreio</p>
                                  <div className="relative pl-6 space-y-3">
                                    <div className="absolute left-[9px] top-1 bottom-1 w-[2px] bg-border" />
                                    {history.map((event, i) => (
                                      <div key={i} className="relative flex gap-3">
                                        <div
                                          className={`absolute -left-6 top-1 h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center ${
                                            i === 0
                                              ? "bg-primary border-primary"
                                              : "bg-background border-muted-foreground/30"
                                          }`}
                                        >
                                          {i === 0 && (
                                            <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-sm ${i === 0 ? "font-semibold" : ""}`}>
                                            {event.description}
                                          </p>
                                          <div className="flex gap-2 text-xs text-muted-foreground">
                                            <span>
                                              {format(new Date(event.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                            </span>
                                            {event.location && <span>• {event.location}</span>}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <AlertCircle className="h-4 w-4" />
                                  Nenhum evento de rastreio disponível ainda.
                                </div>
                              )}

                              {/* Order info */}
                              <div className="flex gap-6 text-sm text-muted-foreground pt-2 border-t border-border">
                                <span>Pedido: <strong className="text-foreground">{order.order_id_channel}</strong></span>
                                <span>Valor: <strong className="text-foreground">{formatCurrency(order.total_value)}</strong></span>
                                <span>Data: <strong className="text-foreground">{format(new Date(order.order_date), "dd/MM/yyyy", { locale: ptBR })}</strong></span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
