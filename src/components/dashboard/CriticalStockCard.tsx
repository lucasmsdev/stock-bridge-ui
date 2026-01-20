import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, 
  TrendingUp, 
  Package,
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface CriticalProduct {
  productId: string;
  name: string;
  sku: string | null;
  currentStock: number;
  adjustedDaysToStockout: number;
  urgency: 'CRITICO' | 'ATENCAO' | 'OK';
  marketTrend: 'alta' | 'estavel' | 'baixa';
  recommendation: string;
}

interface ForecastSummary {
  critical: number;
  attention: number;
  ok: number;
}

export const CriticalStockCard = () => {
  const [products, setProducts] = useState<CriticalProduct[]>([]);
  const [summary, setSummary] = useState<ForecastSummary>({ critical: 0, attention: 0, ok: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchCriticalProducts = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await supabase.functions.invoke('stock-forecast', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: { limit: 20 }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const forecastData = response.data;
      
      // Pegar os 3 produtos mais críticos
      const criticalProducts: CriticalProduct[] = (forecastData.forecasts || [])
        .filter((p: any) => p.urgency !== 'OK')
        .slice(0, 3)
        .map((p: any) => ({
          productId: p.productId,
          name: p.name,
          sku: p.sku,
          currentStock: p.currentStock,
          adjustedDaysToStockout: p.adjustedDaysToStockout,
          urgency: p.urgency,
          marketTrend: p.marketTrend,
          recommendation: p.recommendation
        }));

      setProducts(criticalProducts);
      setSummary(forecastData.summary || { critical: 0, attention: 0, ok: 0 });
    } catch (err: any) {
      console.error('Erro ao buscar previsão de estoque:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCriticalProducts();
  }, [user?.id]);

  const getUrgencyStyle = (urgency: string) => {
    switch (urgency) {
      case 'CRITICO':
        return {
          bg: 'bg-destructive/10',
          text: 'text-destructive',
          badge: 'destructive' as const
        };
      case 'ATENCAO':
        return {
          bg: 'bg-yellow-500/10',
          text: 'text-yellow-600 dark:text-yellow-500',
          badge: 'secondary' as const
        };
      default:
        return {
          bg: 'bg-green-500/10',
          text: 'text-green-600 dark:text-green-500',
          badge: 'outline' as const
        };
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" />
            Previsão de Estoque
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" />
            Previsão de Estoque
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchCriticalProducts}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" />
            Previsão de Estoque
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {summary.critical > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5">
                {summary.critical} crítico{summary.critical > 1 ? 's' : ''}
              </Badge>
            )}
            {summary.attention > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5">
                {summary.attention} atenção
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {products.length === 0 ? (
          <div className="text-center py-6">
            <Package className="h-10 w-10 mx-auto text-success mb-2" />
            <p className="text-sm font-medium text-success">
              Estoque saudável! 🎉
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Nenhum produto crítico no momento
            </p>
          </div>
        ) : (
          <>
            {products.map((product) => {
              const style = getUrgencyStyle(product.urgency);
              return (
                <div 
                  key={product.productId}
                  className={cn(
                    "p-3 rounded-lg border transition-colors",
                    style.bg
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      {product.sku && (
                        <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                      )}
                    </div>
                    <Badge variant={style.badge} className="text-xs shrink-0">
                      {product.adjustedDaysToStockout}d
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {product.currentStock} un
                      </span>
                      {product.marketTrend === 'alta' && (
                        <span className="flex items-center gap-1 text-success">
                          <TrendingUp className="h-3 w-3" />
                          Demanda alta
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <Link to="/app/products?tab=forecast" className="block pt-2">
              <Button variant="ghost" size="sm" className="w-full text-primary hover:text-primary/80">
                Ver previsão completa
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
};
