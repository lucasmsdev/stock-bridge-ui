import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, MoreHorizontal, Edit, ExternalLink, Package, Download, Loader2, ChevronDown, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePlan } from "@/hooks/usePlan";
import { UpgradeBanner } from "@/components/ui/upgrade-banner";

interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  cost_price: number | null;
  selling_price: number | null;
  image_url: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface ProductListing {
  id: string;
  platform: string;
  platform_url: string | null;
  sync_status: string;
}

interface Integration {
  id: string;
  platform: string;
  access_token: string;
  user_id: string;
}

const platformNames: Record<string, string> = {
  mercadolivre: "Mercado Livre",
  shopify: "Shopify",
  amazon: "Amazon",
  aliexpress: "AliExpress",
};

const platformLogos: Record<string, { url: string; darkInvert?: boolean }> = {
  mercadolivre: { url: "https://vectorseek.com/wp-content/uploads/2023/08/Mercado-Livre-Icon-Logo-Vector.svg-.png" },
  shopify: { url: "https://cdn3.iconfinder.com/data/icons/social-media-2068/64/_shopping-512.png" },
  amazon: { url: "https://upload.wikimedia.org/wikipedia/commons/d/de/Amazon_icon.png", darkInvert: true },
  shopee: { url: "https://www.freepnglogos.com/uploads/shopee-logo/shopee-bag-logo-free-transparent-icon-17.png" },
};

export default function Products() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { canImportProducts, getMaxSkus, getUpgradeRequiredMessage } = usePlan();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [productListings, setProductListings] = useState<Record<string, ProductListing[]>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    sku: "",
    cost_price: "",
    selling_price: "",
    stock: ""
  });

  // Load products and integrations from Supabase
  useEffect(() => {
    if (user) {
      loadProducts();
      loadIntegrations();
      loadProductListings();
    }
  }, [user]);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading products:', error);
        toast({
          title: "❌ Erro ao carregar produtos",
          description: "Não foi possível carregar seus produtos. Tente atualizar a página.",
          variant: "destructive",
        });
        return;
      }

      setProducts(data || []);
    } catch (error) {
      console.error('Unexpected error loading products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      sku: product.sku,
      cost_price: product.cost_price?.toString() || "",
      selling_price: product.selling_price?.toString() || "",
      stock: product.stock.toString()
    });
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    
    try {
      console.log('Updating product:', editingProduct.id);
      const { data, error } = await supabase.functions.invoke('update-product', {
        body: {
          productId: editingProduct.id,
          name: editForm.name,
          sku: editForm.sku,
          cost_price: editForm.cost_price ? parseFloat(editForm.cost_price) : null,
          selling_price: editForm.selling_price ? parseFloat(editForm.selling_price) : null,
          stock: parseInt(editForm.stock) || 0
        }
      });

      console.log('Update response:', { data, error });

      if (error) {
        console.error('Update product error:', error);
        toast({
          title: "❌ Erro ao atualizar produto",
          description: error.message || "Não foi possível atualizar o produto. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✅ Produto atualizado!",
        description: "As alterações foram salvas com sucesso.",
      });

      setEditingProduct(null);
      loadProducts();
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: "❌ Erro inesperado",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    
    try {
      console.log('Deleting product:', deletingProduct.id);
      const { data, error } = await supabase.functions.invoke('delete-product', {
        body: {
          productId: deletingProduct.id
        }
      });

      console.log('Delete response:', { data, error });

      if (error) {
        console.error('Delete product error:', error);
        toast({
          title: "❌ Erro ao excluir produto",
          description: error.message || "Não foi possível excluir o produto. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✅ Produto excluído!",
        description: "O produto foi removido com sucesso.",
      });

      setDeletingProduct(null);
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "❌ Erro inesperado",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const loadIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('id, platform, access_token, user_id')
        .eq('user_id', user?.id)
        .not('access_token', 'is', null);

      if (error) {
        console.error('Error loading integrations:', error);
        return;
      }

      // Filter only integrations with valid access tokens
      const activeIntegrations = (data || []).filter(
        integration => integration.access_token && integration.access_token.trim() !== ''
      );
      
      setIntegrations(activeIntegrations);
    } catch (error) {
      console.error('Unexpected error loading integrations:', error);
    }
  };

  const loadProductListings = async () => {
    try {
      const { data, error } = await supabase
        .from('product_listings')
        .select('id, product_id, platform, platform_url, sync_status')
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error loading product listings:', error);
        return;
      }

      // Group listings by product_id
      const listingsByProduct: Record<string, ProductListing[]> = {};
      (data || []).forEach(listing => {
        if (!listingsByProduct[listing.product_id]) {
          listingsByProduct[listing.product_id] = [];
        }
        listingsByProduct[listing.product_id].push({
          id: listing.id,
          platform: listing.platform,
          platform_url: listing.platform_url,
          sync_status: listing.sync_status
        });
      });

      setProductListings(listingsByProduct);
    } catch (error) {
      console.error('Unexpected error loading product listings:', error);
    }
  };

  const importProducts = async (integration: Integration) => {
    const platform = integration.platform;
    const platformName = platformNames[platform] || platform;

    try {
      setIsImporting(true);

      // Check if user can import more products
      if (!canImportProducts(products.length, 1)) {
        toast({
          title: "❌ Limite de produtos atingido",
          description: getUpgradeRequiredMessage('maxSkus'),
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('import-products', {
        body: { integration_id: integration.id },
      });

      if (error) {
        console.error('Error importing products:', error);

        const contextBody = (error as any)?.context?.body;
        let contextMessage: string | null = null;

        if (contextBody) {
          try {
            const parsed = typeof contextBody === 'string' ? JSON.parse(contextBody) : contextBody;
            contextMessage = parsed?.error || parsed?.details || parsed?.message || null;
          } catch {
            contextMessage = typeof contextBody === 'string' ? contextBody : JSON.stringify(contextBody);
          }
        }

        const details = contextMessage || (data as any)?.error || error.message;

        // Check if it's a 403 error (SKU limit reached)
        if (details && typeof details === 'string' && details.includes('Limite de SKUs atingido')) {
          toast({
            title: "❌ Limite de SKUs atingido",
            description: details,
            variant: "destructive",
            action: (
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/billing'}>
                Fazer Upgrade
              </Button>
            ),
          });
        } else {
          toast({
            title: "❌ Falha ao importar produtos",
            description: details
              ? `${platformName} respondeu: ${details}`
              : `Não foi possível importar os produtos do ${platformName}. Tente novamente.`,
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "✅ Produtos importados com sucesso!",
        description: `${data?.count ?? 0} produtos foram importados do ${platformName}.`,
      });

      // Reload products after import
      await loadProducts();
    } catch (error) {
      console.error('Unexpected error importing products:', error);
      toast({
        title: "❌ Erro inesperado na importação",
        description: "Ocorreu um erro inesperado ao importar os produtos. Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    // For now, we don't filter by channel since we need to add channel info to products table
    // This will be implemented in the next step when the database is updated
    return matchesSearch;
  });

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleAllProducts = () => {
    setSelectedProducts(
      selectedProducts.length === filteredProducts.length 
        ? [] 
        : filteredProducts.map(p => p.id)
    );
  };

  const handleProductClick = (productId: string) => {
    if (productId) {
      navigate(`/app/products/${productId}`);
    } else {
      console.error("Tentativa de navegar para um produto com ID indefinido.");
    }
  };

  // Empty state component
  const EmptyProductsState = () => (
    <Card className="shadow-soft">
      <CardContent className="pt-12 pb-12 text-center">
        <div className="max-w-md mx-auto">
          <Package className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Nenhum produto encontrado
          </h3>
          <p className="text-muted-foreground mb-6">
            Você ainda não tem produtos em seu catálogo. Comece importando do seu primeiro canal conectado!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {integrations.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    className="bg-gradient-primary hover:bg-primary-hover"
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {isImporting ? "Importando..." : "Importar Produtos"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border border-border shadow-medium z-50">
                  {integrations.map((integration) => (
                    <DropdownMenuItem 
                      key={integration.id}
                      className="hover:bg-muted cursor-pointer"
                      onClick={() => importProducts(integration)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Do {platformNames[integration.platform] || integration.platform}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline">
                Ver Integrações
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Meus Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie seu catálogo centralizado de produtos
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => navigate('/app/products/new')}
            className="bg-gradient-primary hover:bg-primary-hover"
          >
            <Plus className="mr-2 h-4 w-4" />
            Criar Produto
          </Button>
          {integrations.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline"
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {isImporting ? "Importando..." : "Importar"}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border border-border shadow-medium z-50">
                {integrations.map((integration) => (
                  <DropdownMenuItem 
                    key={integration.id}
                    className="hover:bg-muted cursor-pointer"
                    onClick={() => importProducts(integration)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Do {platformNames[integration.platform] || integration.platform}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {/* Inventory Summary */}
      {products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de SKUs</p>
                  <p className="text-2xl font-bold text-foreground">{products.length}</p>
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Itens em Estoque</p>
                  <p className="text-2xl font-bold text-foreground">
                    {products.reduce((total, product) => total + product.stock, 0)}
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full bg-success/20 flex items-center justify-center">
                  <span className="text-success font-bold">📦</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Valor Total do Inventário</p>
                  <p className="text-2xl font-bold text-foreground">
                    R$ {products.reduce((total, product) => {
                      const price = product.selling_price || 0;
                      return total + (price * product.stock);
                    }, 0).toFixed(2)}
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold">💰</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Actions Toolbar */}
      {selectedProducts.length > 0 && (
        <Card className="shadow-soft bg-primary/5 border-primary/20 animate-slide-up">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-primary">
                  {selectedProducts.length} produto{selectedProducts.length > 1 ? 's' : ''} selecionado{selectedProducts.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="hover:bg-destructive hover:text-destructive-foreground">
                  Deletar Selecionados
                </Button>
                <Button variant="outline" size="sm">
                  Editar em Massa
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedProducts([])}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar produtos ou SKU..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="min-w-[180px]">
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por canal" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-medium z-50">
                  <SelectItem value="all">Todos os Canais</SelectItem>
                  {integrations.map((integration) => (
                    <SelectItem key={integration.platform} value={integration.platform}>
                      {platformNames[integration.platform] || integration.platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{filteredProducts.length} produtos encontrados</span>
              <span>• Limite: {getMaxSkus() === Infinity ? '∞' : getMaxSkus()} produtos</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table or Empty State */}
      {isLoading ? (
        <Card className="shadow-soft">
          <CardContent className="pt-12 pb-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Carregando produtos...</p>
          </CardContent>
        </Card>
      ) : products.length === 0 ? (
        <EmptyProductsState />
      ) : (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8">
                <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhum produto encontrado para "{searchTerm}"
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                        onCheckedChange={toggleAllProducts}
                      />
                    </TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Canais</TableHead>
                    <TableHead className="w-12">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow 
                      key={product.id}
                      onClick={() => handleProductClick(product.id)}
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                            {product.image_url ? (
                              <img 
                                src={product.image_url.replace('http://', 'https://')} 
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-primary hover:text-primary-hover transition-colors">
                              {product.name}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {product.sku}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={product.stock === 0 ? "destructive" : product.stock < 20 ? "secondary" : "default"}
                          className={product.stock === 0 ? "" : product.stock < 20 ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground"}
                        >
                          {product.stock}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.selling_price ? `R$ ${product.selling_price.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {productListings[product.id] && productListings[product.id].length > 0 ? (
                            productListings[product.id].map((listing) => {
                              const logoConfig = platformLogos[listing.platform];
                              return logoConfig ? (
                                <div key={listing.id} className="relative group">
                                  <img
                                    src={logoConfig.url}
                                    alt={`${listing.platform} logo`}
                                    className={`h-5 w-auto ${logoConfig.darkInvert ? 'dark-invert' : ''} ${listing.sync_status === 'error' ? 'opacity-50' : ''}`}
                                  />
                                  {listing.sync_status === 'error' && (
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
                                  )}
                                </div>
                              ) : (
                                <span key={listing.id} className="text-lg">🛍️</span>
                              );
                            })
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="hover:bg-muted hover:scale-105 transition-all"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border border-border shadow-medium z-50">
                            <DropdownMenuItem 
                              className="hover:bg-muted cursor-pointer"
                              onClick={() => handleEditProduct(product)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="hover:bg-muted cursor-pointer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Ver no Canal
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="hover:bg-destructive hover:text-destructive-foreground cursor-pointer"
                              onClick={() => setDeletingProduct(product)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Product Modal */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome do Produto</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                placeholder="Nome do produto"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-sku">SKU</Label>
              <Input
                id="edit-sku"
                value={editForm.sku}
                onChange={(e) => setEditForm({...editForm, sku: e.target.value})}
                placeholder="SKU do produto"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-cost">Preço de Custo</Label>
                <Input
                  id="edit-cost"
                  type="number"
                  step="0.01"
                  value={editForm.cost_price}
                  onChange={(e) => setEditForm({...editForm, cost_price: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-selling">Preço de Venda</Label>
                <Input
                  id="edit-selling"
                  type="number"
                  step="0.01"
                  value={editForm.selling_price}
                  onChange={(e) => setEditForm({...editForm, selling_price: e.target.value})}
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit-stock">Estoque</Label>
              <Input
                id="edit-stock"
                type="number"
                value={editForm.stock}
                onChange={(e) => setEditForm({...editForm, stock: e.target.value})}
                placeholder="0"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setEditingProduct(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProduct}>
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingProduct} onOpenChange={() => setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto "{deletingProduct?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}