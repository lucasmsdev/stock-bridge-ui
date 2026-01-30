import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Phone,
  Mail,
  Globe,
  MapPin,
  FileText,
  Package,
  ShoppingCart,
  TrendingUp,
  Plus,
  MoreHorizontal,
  Link,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useToast } from "@/hooks/use-toast";
import { SupplierForm } from "@/components/suppliers/SupplierForm";
import { PurchaseOrderForm } from "@/components/suppliers/PurchaseOrderForm";
import { PurchaseOrderList, type PurchaseOrderListItem } from "@/components/suppliers/PurchaseOrderList";
import type { Supplier } from "@/pages/Suppliers";
import type { Json } from "@/integrations/supabase/types";
import { useOrgRole } from "@/hooks/useOrgRole";

interface Product {
  id: string;
  name: string;
  sku: string;
  cost_price: number | null;
  selling_price: number | null;
  stock: number;
  image_url: string | null;
}

const parseAddress = (address: Json): Record<string, string> => {
  if (typeof address === 'object' && address !== null && !Array.isArray(address)) {
    return address as Record<string, string>;
  }
  return {};
};

const SupplierDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const { toast } = useToast();
  const { canWrite, canDeleteItems } = useOrgRole();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [isLinkProductOpen, setIsLinkProductOpen] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [linkingProducts, setLinkingProducts] = useState(false);

  useEffect(() => {
    if (user && id) {
      loadSupplierData();
    }
  }, [user, id]);

  const loadSupplierData = async () => {
    if (!user || !id) return;

    setLoading(true);
    try {
      // Carregar fornecedor
      const { data: supplierData, error: supplierError } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (supplierError) throw supplierError;
      setSupplier(supplierData);

      // Carregar produtos vinculados
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, sku, cost_price, selling_price, stock, image_url")
        .eq("supplier_id", id)
        .eq("user_id", user.id);

      if (!productsError) setProducts(productsData || []);

      // Carregar pedidos de compra
      const { data: ordersData, error: ordersError } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("supplier_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!ordersError) setPurchaseOrders(ordersData || []);
    } catch (error) {
      console.error("Error loading supplier:", error);
      toast({
        title: "Erro",
        description: "Fornecedor não encontrado.",
        variant: "destructive",
      });
      navigate("/app/suppliers");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;

      toast({
        title: "Fornecedor excluído",
        description: "O fornecedor foi removido com sucesso.",
      });
      navigate("/app/suppliers");
    } catch (error) {
      console.error("Error deleting supplier:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o fornecedor.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const loadAvailableProducts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, cost_price, selling_price, stock, image_url")
      .eq("user_id", user.id)
      .or(`supplier_id.is.null,supplier_id.neq.${id}`);

    if (!error && data) {
      setAvailableProducts(data);
    }
  };

  const handleOpenLinkDialog = () => {
    setSelectedProducts([]);
    loadAvailableProducts();
    setIsLinkProductOpen(true);
  };

  const handleLinkProducts = async () => {
    if (selectedProducts.length === 0) return;

    setLinkingProducts(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ supplier_id: id })
        .in("id", selectedProducts);

      if (error) throw error;

      toast({
        title: "Produtos vinculados",
        description: `${selectedProducts.length} produto(s) vinculado(s) com sucesso.`,
      });
      setIsLinkProductOpen(false);
      loadSupplierData();
    } catch (error) {
      console.error("Error linking products:", error);
      toast({
        title: "Erro",
        description: "Não foi possível vincular os produtos.",
        variant: "destructive",
      });
    } finally {
      setLinkingProducts(false);
    }
  };

  const handleUnlinkProduct = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from("products")
        .update({ supplier_id: null })
        .eq("id", productId);

      if (error) throw error;

      toast({
        title: "Produto desvinculado",
        description: "O produto foi removido deste fornecedor.",
      });
      loadSupplierData();
    } catch (error) {
      console.error("Error unlinking product:", error);
      toast({
        title: "Erro",
        description: "Não foi possível desvincular o produto.",
        variant: "destructive",
      });
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const totalSpent = purchaseOrders
    .filter((o) => o.status === "received")
    .reduce((sum, o) => sum + Number(o.total_value), 0);

  const pendingOrders = purchaseOrders.filter((o) => o.status === "pending").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!supplier) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/app/suppliers")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{supplier.name}</h1>
              <Badge variant={supplier.is_active ? "default" : "secondary"}>
                {supplier.is_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            {supplier.contact_name && (
              <p className="text-muted-foreground mt-1">{supplier.contact_name}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <Button
              onClick={() => setIsOrderFormOpen(true)}
              className="bg-gradient-primary text-primary-foreground shadow-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Pedido
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border">
              {canWrite && (
                <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
              {canDeleteItems && (
                <DropdownMenuItem
                  onClick={() => setIsDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Produtos</p>
                <p className="text-2xl font-bold text-foreground">{products.length}</p>
              </div>
              <Package className="h-8 w-8 text-accent opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pedidos</p>
                <p className="text-2xl font-bold text-foreground">{purchaseOrders.length}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-foreground">{pendingOrders}</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Gasto</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalSpent)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="products">Produtos ({products.length})</TabsTrigger>
          <TabsTrigger value="orders">Pedidos ({purchaseOrders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <Card className="bg-card border-border shadow-soft">
            <CardHeader>
              <CardTitle className="text-foreground">Dados de Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {supplier.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="text-foreground">{supplier.phone}</p>
                    </div>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="text-foreground">{supplier.email}</p>
                    </div>
                  </div>
                )}
                {supplier.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Website</p>
                      <a
                        href={supplier.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {supplier.website}
                      </a>
                    </div>
                  </div>
                )}
                {supplier.cnpj_cpf && (
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">CNPJ/CPF</p>
                      <p className="text-foreground">{supplier.cnpj_cpf}</p>
                    </div>
                  </div>
                )}
              </div>

              {supplier.address && (() => {
                const addr = parseAddress(supplier.address);
                return Object.values(addr).some((v) => v) && (
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Endereço</p>
                        <p className="text-foreground">
                          {[
                            addr.street,
                            addr.number,
                            addr.complement,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        <p className="text-foreground">
                          {[
                            addr.neighborhood,
                            addr.city,
                            addr.state,
                            addr.zip_code,
                          ]
                            .filter(Boolean)
                            .join(" - ")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {supplier.payment_terms && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-1">Condições de Pagamento</p>
                  <p className="text-foreground">{supplier.payment_terms}</p>
                </div>
              )}

              {supplier.notes && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-1">Observações</p>
                  <p className="text-foreground whitespace-pre-wrap">{supplier.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card className="bg-card border-border shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-foreground">Produtos Vinculados</CardTitle>
                <CardDescription>Produtos fornecidos por este fornecedor</CardDescription>
              </div>
              <Button onClick={handleOpenLinkDialog} variant="outline" size="sm">
                <Link className="h-4 w-4 mr-2" />
                Vincular Produto
              </Button>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nenhum produto vinculado a este fornecedor.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={handleOpenLinkDialog}
                  >
                    <Link className="h-4 w-4 mr-2" />
                    Vincular Produtos
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer group"
                      onClick={() => navigate(`/app/products/${product.id}`)}
                    >
                      <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-foreground font-medium">
                            {product.selling_price
                              ? formatCurrency(product.selling_price)
                              : "-"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Estoque: {product.stock}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleUnlinkProduct(product.id, e)}
                          title="Desvincular produto"
                        >
                          <Unlink className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <PurchaseOrderList
            orders={purchaseOrders}
            onOrderUpdated={loadSupplierData}
            supplierId={id!}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Fornecedor</DialogTitle>
          </DialogHeader>
          <SupplierForm
            supplier={supplier}
            onSaved={() => {
              setIsEditOpen(false);
              loadSupplierData();
            }}
            onCancel={() => setIsEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Purchase Order Form Dialog */}
      <Dialog open={isOrderFormOpen} onOpenChange={setIsOrderFormOpen}>
        <DialogContent className="max-w-3xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Novo Pedido de Compra</DialogTitle>
          </DialogHeader>
          <PurchaseOrderForm
            supplierId={id!}
            onSaved={() => {
              setIsOrderFormOpen(false);
              loadSupplierData();
            }}
            onCancel={() => setIsOrderFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Link Products Dialog */}
      <Dialog open={isLinkProductOpen} onOpenChange={setIsLinkProductOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Vincular Produtos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione os produtos que deseja vincular a este fornecedor:
            </p>
            {availableProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  Todos os produtos já estão vinculados a este fornecedor.
                </p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2">
                {availableProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer"
                    onClick={() => toggleProductSelection(product.id)}
                  >
                    <Checkbox
                      checked={selectedProducts.includes(product.id)}
                      onCheckedChange={() => toggleProductSelection(product.id)}
                    />
                    <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        SKU: {product.sku} • Estoque: {product.stock}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setIsLinkProductOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleLinkProducts}
                disabled={selectedProducts.length === 0 || linkingProducts}
              >
                {linkingProducts ? "Vinculando..." : `Vincular (${selectedProducts.length})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Excluir Fornecedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{supplier.name}"? Esta ação não pode ser
              desfeita e todos os pedidos de compra associados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SupplierDetails;
