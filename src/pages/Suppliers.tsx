import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Truck, Phone, Mail, Package, DollarSign, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useToast } from "@/hooks/use-toast";
import { SupplierForm } from "@/components/suppliers/SupplierForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Json } from "@/integrations/supabase/types";
import { useOrgRole } from "@/hooks/useOrgRole";

export interface Supplier {
  id: string;
  user_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  cnpj_cpf: string | null;
  address: Json;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Computed fields
  products_count?: number;
  total_spent?: number;
}

const Suppliers = () => {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const { toast } = useToast();
  const { canWrite, canDeleteItems } = useOrgRole();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    if (user) {
      loadSuppliers();
    }
  }, [user]);

  const loadSuppliers = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Buscar fornecedores
      const { data: suppliersData, error: suppliersError } = await supabase
        .from("suppliers")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (suppliersError) throw suppliersError;

      // Buscar contagem de produtos por fornecedor
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("supplier_id")
        .eq("user_id", user.id)
        .not("supplier_id", "is", null);

      // Buscar total gasto por fornecedor (pedidos recebidos)
      const { data: ordersData, error: ordersError } = await supabase
        .from("purchase_orders")
        .select("supplier_id, total_value, status")
        .eq("user_id", user.id)
        .eq("status", "received");

      // Calcular métricas por fornecedor
      const suppliersWithMetrics = (suppliersData || []).map((supplier) => {
        const productsCount = (productsData || []).filter(
          (p) => p.supplier_id === supplier.id
        ).length;

        const totalSpent = (ordersData || [])
          .filter((o) => o.supplier_id === supplier.id)
          .reduce((sum, o) => sum + Number(o.total_value || 0), 0);

        return {
          ...supplier,
          products_count: productsCount,
          total_spent: totalSpent,
        };
      });

      setSuppliers(suppliersWithMetrics);
    } catch (error) {
      console.error("Error loading suppliers:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os fornecedores.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSupplierSaved = () => {
    setIsFormOpen(false);
    setEditingSupplier(null);
    loadSuppliers();
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleDeleteSupplier = async (id: string) => {
    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;

      toast({
        title: "Fornecedor excluído",
        description: "O fornecedor foi removido com sucesso.",
      });
      loadSuppliers();
    } catch (error) {
      console.error("Error deleting supplier:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o fornecedor.",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (supplier: Supplier) => {
    try {
      const { error } = await supabase
        .from("suppliers")
        .update({ is_active: !supplier.is_active })
        .eq("id", supplier.id);

      if (error) throw error;

      toast({
        title: supplier.is_active ? "Fornecedor desativado" : "Fornecedor ativado",
        description: `${supplier.name} foi ${supplier.is_active ? "desativado" : "ativado"}.`,
      });
      loadSuppliers();
    } catch (error) {
      console.error("Error toggling supplier:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status do fornecedor.",
        variant: "destructive",
      });
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const matchesSearch =
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filter === "all" ||
      (filter === "active" && supplier.is_active) ||
      (filter === "inactive" && !supplier.is_active);

    return matchesSearch && matchesFilter;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fornecedores</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus fornecedores e pedidos de compra
          </p>
        </div>
        {canWrite && (
          <Button
            onClick={() => {
              setEditingSupplier(null);
              setIsFormOpen(true);
            }}
            className="bg-gradient-primary text-primary-foreground shadow-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Fornecedor
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Fornecedores</p>
                <p className="text-2xl font-bold text-foreground">{suppliers.length}</p>
              </div>
              <Truck className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fornecedores Ativos</p>
                <p className="text-2xl font-bold text-foreground">
                  {suppliers.filter((s) => s.is_active).length}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Produtos Vinculados</p>
                <p className="text-2xl font-bold text-foreground">
                  {suppliers.reduce((sum, s) => sum + (s.products_count || 0), 0)}
                </p>
              </div>
              <Package className="h-8 w-8 text-accent opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Gasto</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(suppliers.reduce((sum, s) => sum + (s.total_spent || 0), 0))}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background border-input"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="bg-muted">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="active">Ativos</TabsTrigger>
            <TabsTrigger value="inactive">Inativos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Suppliers List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <Card className="bg-card border-border shadow-soft">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchTerm || filter !== "all"
                ? "Nenhum fornecedor encontrado"
                : "Nenhum fornecedor cadastrado"}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || filter !== "all"
                ? "Tente ajustar os filtros de busca."
                : "Comece cadastrando seu primeiro fornecedor."}
            </p>
            {!searchTerm && filter === "all" && (
              <Button
                onClick={() => setIsFormOpen(true)}
                className="bg-gradient-primary text-primary-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Fornecedor
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <Card
              key={supplier.id}
              className={`bg-card border-border shadow-soft hover:shadow-medium transition-shadow cursor-pointer ${
                !supplier.is_active ? "opacity-60" : ""
              }`}
              onClick={() => navigate(`/app/suppliers/${supplier.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg text-foreground">{supplier.name}</CardTitle>
                  <Badge variant={supplier.is_active ? "default" : "secondary"}>
                    {supplier.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                {supplier.contact_name && (
                  <p className="text-sm text-muted-foreground">{supplier.contact_name}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {supplier.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {supplier.phone}
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {supplier.email}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-1 text-sm">
                    <Package className="h-4 w-4 text-accent" />
                    <span className="text-foreground font-medium">
                      {supplier.products_count || 0}
                    </span>
                    <span className="text-muted-foreground">produtos</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total: </span>
                    <span className="text-foreground font-medium">
                      {formatCurrency(supplier.total_spent || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Supplier Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
          </DialogHeader>
          <SupplierForm
            supplier={editingSupplier}
            onSaved={handleSupplierSaved}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingSupplier(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Suppliers;
