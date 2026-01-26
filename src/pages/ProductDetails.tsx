import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Package, CheckCircle, AlertTriangle, XCircle, Loader2, Calculator, Truck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { FinancialDataForm } from "@/components/financial/FinancialDataForm";
import { ProfitabilityAnalysis } from "@/components/financial/ProfitabilityAnalysis";
import { ProfitabilityCalculator } from "@/components/financial/ProfitabilityCalculator";
import { AmazonStatusCard } from "@/components/amazon/AmazonStatusCard";

interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  cost_price?: number;
  selling_price?: number;
  ad_spend?: number;
  image_url?: string;
  supplier_id?: string;
}

interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
}

interface ChannelStock {
  channel: string;
  channelId: string;
  stock: number;
  status: 'synchronized' | 'divergent' | 'not_published' | 'synced' | 'error' | 'not_found' | 'token_expired' | 'disconnected';
  images?: string[];
  errorMessage?: string;
  requiresRepublish?: boolean;
}

interface ProductListing {
  id: string;
  platform: string;
  integration_id: string;
  platform_product_id: string;
  sync_status?: string;
  sync_error?: string;
}

interface ProductDetailsData {
  product: Product;
  centralStock: number;
  channelStocks: ChannelStock[];
  listings?: ProductListing[];
}

const platformNames: Record<string, string> = {
  mercadolivre: "Mercado Livre",
  shopify: "Shopify",
  shopee: "Shopee",
  amazon: "Amazon",
};

const statusConfig = {
  synchronized: {
    icon: CheckCircle,
    label: "Sincronizado",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  synced: {
    icon: CheckCircle,
    label: "Sincronizado",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  divergent: {
    icon: AlertTriangle,
    label: "Divergente",
    color: "text-yellow-600",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  not_published: {
    icon: XCircle,
    label: "Não Publicado",
    color: "text-gray-600",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
  },
  not_found: {
    icon: XCircle,
    label: "Não Encontrado",
    color: "text-gray-600",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
  },
  token_expired: {
    icon: AlertTriangle,
    label: "Token Expirado",
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  error: {
    icon: XCircle,
    label: "Erro de Conexão",
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  disconnected: {
    icon: AlertTriangle,
    label: "Desconectado",
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
};

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [productDetails, setProductDetails] = useState<ProductDetailsData | null>(null);
  const [listings, setListings] = useState<ProductListing[]>([]);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRepublishing, setIsRepublishing] = useState<string | null>(null);

  // Check for disconnected listings that need republishing
  const disconnectedListings = listings.filter(l => l.sync_status === 'disconnected');

  const handleRepublish = async (listing: ProductListing) => {
    if (!productDetails || !user) return;
    
    const platformName = listing.platform === 'shopify' ? 'Shopify' : listing.platform;
    
    try {
      setIsRepublishing(listing.id);
      
      // 1. Delete the broken listing
      const { error: deleteError } = await supabase
        .from('product_listings')
        .delete()
        .eq('id', listing.id);
      
      if (deleteError) {
        throw new Error('Erro ao remover vínculo antigo');
      }
      
      // 2. Republish to the platform
      const { data, error } = await supabase.functions.invoke(`create-${listing.platform}-product`, {
        body: {
          product_id: productDetails.product.id,
          integration_id: listing.integration_id,
          productData: {
            name: productDetails.product.name,
            sku: productDetails.product.sku,
            selling_price: productDetails.product.selling_price,
            stock: productDetails.product.stock,
            image_url: productDetails.product.image_url,
          }
        }
      });
      
      if (error) {
        console.error('Republish error:', error);
        throw new Error(error.message || 'Erro ao republicar produto');
      }
      
      toast({
        title: "✅ Produto republicado!",
        description: `O produto foi recriado na ${platformName} com sucesso.`,
      });
      
      // Reload data
      loadProductDetails();
      
    } catch (error: any) {
      console.error('Error republishing:', error);
      toast({
        title: "❌ Erro ao republicar",
        description: error.message || `Não foi possível republicar na ${platformName}.`,
        variant: "destructive",
      });
    } finally {
      setIsRepublishing(null);
    }
  };

  const handleProductUpdate = async (updatedProduct: Product) => {
    if (productDetails) {
      setProductDetails({
        ...productDetails,
        product: updatedProduct
      });
      
      // Recarregar listings para capturar mudanças de sync_status (ex: disconnected)
      await loadProductDetails();
    }
  };

  useEffect(() => {
    if (user && id) {
      loadProductDetails();
    }
  }, [user, id]);

  const loadProductDetails = async () => {
    if (!user || !id) return;

    try {
      setIsLoading(true);
      
      // Check if id is a UUID or SKU
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
      
      // Get the product data using appropriate field
      const query = supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id);
      
      if (isUUID) {
        query.eq('id', id);
      } else {
        query.eq('sku', id);
      }
      
      const { data: productData, error: productError } = await query.single();

      if (productError || !productData) {
        console.error('Product not found:', productError);
        setProductDetails(null);
        return;
      }

      console.log('Calling get-product-details function for product SKU:', productData.sku);

      const { data, error } = await supabase.functions.invoke('get-product-details', {
        body: { 
          sku: productData.sku,
          id: productData.id 
        }
      });

      if (error) {
        console.error('Error calling product details function:', error);
        throw error;
      }

      console.log('Product details received:', data);
      setProductDetails(data);

      // Buscar listings para o card de status Amazon e Shopify
      const { data: listingsData } = await supabase
        .from('product_listings')
        .select('id, platform, integration_id, platform_product_id, sync_status, sync_error')
        .eq('product_id', productData.id)
        .eq('user_id', user.id);
      
      if (listingsData) {
        setListings(listingsData);
      }

      // Buscar fornecedor vinculado
      if (productData.supplier_id) {
        const { data: supplierData } = await supabase
          .from('suppliers')
          .select('id, name, contact_name, email, phone')
          .eq('id', productData.supplier_id)
          .single();
        
        if (supplierData) {
          setSupplier(supplierData);
        }
      } else {
        setSupplier(null);
      }

      toast({
        title: "Detalhes carregados",
        description: `Produto ${data.product.name} carregado com ${data.channelStocks.length} canais verificados`,
      });

    } catch (error) {
      console.error('Error loading product details:', error);
      toast({
        title: "Erro ao carregar detalhes",
        description: "Não foi possível carregar os detalhes do produto. Tente novamente.",
        variant: "destructive",
      });
      // Set empty state to show product not found
      setProductDetails(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Link to="/app/products">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
        </div>
        
        <Card className="shadow-soft">
          <CardContent className="pt-12 pb-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Carregando detalhes do produto...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!productDetails) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Link to="/app/products">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
        </div>
        
        <Card className="shadow-soft">
          <CardContent className="pt-12 pb-12 text-center">
            <Package className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Produto não encontrado
            </h3>
            <p className="text-muted-foreground">
              O produto solicitado não foi encontrado ou você não tem permissão para visualizá-lo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { product, centralStock, channelStocks } = productDetails;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Back Button and Calculator */}
      <div className="flex items-center justify-between">
        <Link to="/app/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Calculator className="h-4 w-4 mr-2" />
              Calculadora de Lucro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Calculadora de Precificação e Lucro</DialogTitle>
            </DialogHeader>
            <ProfitabilityCalculator />
          </DialogContent>
        </Dialog>
      </div>

      {/* Product Title and SKU */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">{product.name}</h1>
        <p className="text-muted-foreground">
          SKU: <code className="text-sm bg-muted px-2 py-1 rounded">{product.sku}</code>
        </p>
      </div>

      {/* Central Stock Card */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Package className="h-6 w-6 text-primary" />
            Estoque Central (UniStock)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-primary mb-2">
            {centralStock}
          </div>
          <p className="text-muted-foreground">
            Esta é a quantidade total registrada no seu sistema centralizado
          </p>
        </CardContent>
      </Card>

      {/* Supplier Card */}
      {supplier && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Truck className="h-6 w-6 text-primary" />
              Fornecedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-semibold text-lg">{supplier.name}</p>
                {supplier.contact_name && (
                  <p className="text-sm text-muted-foreground">Contato: {supplier.contact_name}</p>
                )}
                {supplier.email && (
                  <p className="text-sm text-muted-foreground">{supplier.email}</p>
                )}
                {supplier.phone && (
                  <p className="text-sm text-muted-foreground">{supplier.phone}</p>
                )}
              </div>
              <Link to={`/app/suppliers/${supplier.id}`}>
                <Button variant="outline" size="sm">
                  Ver Detalhes
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Images Card */}
      {channelStocks.some(cs => cs.images && cs.images.length > 0) && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Imagens do Produto</CardTitle>
            <p className="text-sm text-muted-foreground">
              Imagens puxadas dos canais de venda (ex: Mercado Livre)
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {channelStocks.map(channelStock => (
              channelStock.images && channelStock.images.map((image, imgIndex) => (
                <div key={`${channelStock.channel}-${imgIndex}`} className="relative group">
                  <img
                    src={image}
                    alt={`${channelStock.channel} Product Image ${imgIndex + 1}`}
                    className="w-full h-32 object-cover rounded-lg shadow-md transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white text-xs rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {platformNames[channelStock.channel] || channelStock.channel}
                  </div>
                </div>
              ))
            ))}
          </CardContent>
        </Card>
      )}

      {/* Alert for disconnected products */}
      {disconnectedListings.length > 0 && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-destructive">
            Produto desconectado
          </AlertTitle>
          <AlertDescription className="text-destructive/80">
            <div className="space-y-3">
              <p>
                Este produto foi deletado ou não existe mais em algumas plataformas. 
                Clique em "Republicar" para criar novamente.
              </p>
              <div className="flex flex-wrap gap-2">
                {disconnectedListings.map((listing) => {
                  const platformName = listing.platform === 'shopify' ? 'Shopify' : 
                                       listing.platform === 'mercadolivre' ? 'Mercado Livre' : 
                                       listing.platform;
                  return (
                    <Button
                      key={listing.id}
                      variant="outline"
                      size="sm"
                      disabled={isRepublishing === listing.id}
                      onClick={() => handleRepublish(listing)}
                      className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    >
                      {isRepublishing === listing.id ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Republicando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Republicar na {platformName}
                        </>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Financial Data Form */}
      <FinancialDataForm 
        product={product} 
        onUpdate={handleProductUpdate}
      />

      {/* Amazon Status Card - se tiver listing Amazon */}
      {listings.filter(l => l.platform === 'amazon').map((listing) => (
        <AmazonStatusCard
          key={listing.id}
          productId={product.id}
          sku={product.sku}
          integrationId={listing.integration_id}
        />
      ))}

      {/* Profitability Analysis */}
      <ProfitabilityAnalysis 
        product={product} 
        centralStock={centralStock}
      />

      {/* Stock by Channel Table */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Estoque por Canal</CardTitle>
          <p className="text-sm text-muted-foreground">
            Veja como seu estoque está distribuído entre os canais de venda
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead>ID no Canal</TableHead>
                <TableHead>Estoque no Canal</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channelStocks.map((channelStock, index) => {
                const StatusIcon = statusConfig[channelStock.status].icon;
                return (
                  <TableRow key={index} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="text-lg">
                          {channelStock.channel === 'mercadolivre' && '🛒'}
                          {channelStock.channel === 'shopify' && '🛍️'}
                          {channelStock.channel === 'shopee' && '🛒'}
                        </div>
                        <span className="font-medium">
                          {platformNames[channelStock.channel] || channelStock.channel}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {channelStock.channelId === '-' ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {channelStock.channelId}
                        </code>
                      )}
                    </TableCell>
                    <TableCell>
                      {channelStock.channelId === '-' ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        <Badge 
                          variant={channelStock.stock === 0 ? "destructive" : "default"}
                          className={channelStock.stock === 0 ? "" : "bg-success text-success-foreground"}
                        >
                          {channelStock.stock}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`h-4 w-4 ${statusConfig[channelStock.status].color}`} />
                        <div className="flex flex-col gap-1">
                          <Badge 
                            variant="outline" 
                            className={`${statusConfig[channelStock.status].bgColor} ${statusConfig[channelStock.status].color} border-0`}
                          >
                            {statusConfig[channelStock.status].label}
                          </Badge>
                          {channelStock.status === 'token_expired' && (
                            <span className="text-xs text-muted-foreground">
                              Reconecte nas Integrações
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}