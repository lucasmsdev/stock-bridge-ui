import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Package, CheckCircle, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface ChannelStock {
  channel: string;
  channelId: string;
  stock: number;
  status: 'synchronized' | 'divergent' | 'not_published';
}

interface ProductDetailsData {
  product: Product;
  centralStock: number;
  channelStocks: ChannelStock[];
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
};

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [productDetails, setProductDetails] = useState<ProductDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      loadProductDetails();
    }
  }, [user, id]);

  const loadProductDetails = async () => {
    try {
      setIsLoading(true);
      
      // Call the edge function to get product details with channel stocks
      const { data, error } = await supabase.functions.invoke('get-product-details', {
        body: { sku: id }
      });

      if (error) {
        console.error('Error loading product details:', error);
        toast({
          title: "Erro ao carregar detalhes",
          description: "Não foi possível carregar os detalhes do produto.",
          variant: "destructive",
        });
        return;
      }

      if (!data) {
        toast({
          title: "Produto não encontrado",
          description: "Não foi possível encontrar este produto.",
          variant: "destructive",
        });
        return;
      }

      setProductDetails(data);
    } catch (error) {
      console.error('Unexpected error loading product details:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado ao carregar os detalhes do produto.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Link to="/products">
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
          <Link to="/products">
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
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link to="/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
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
                        <Badge 
                          variant="outline" 
                          className={`${statusConfig[channelStock.status].bgColor} ${statusConfig[channelStock.status].color} border-0`}
                        >
                          {statusConfig[channelStock.status].label}
                        </Badge>
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