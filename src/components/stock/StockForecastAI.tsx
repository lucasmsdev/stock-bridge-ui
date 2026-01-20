import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  RefreshCw, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle,
  Package,
  Clock,
  Sparkles,
  Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ForecastCard } from "./ForecastCard";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductForecast {
  productId: string;
  name: string;
  sku: string | null;
  category: string | null;
  currentStock: number;
  dailyVelocity: number;
  velocity30d: number;
  velocity60d: number;
  velocity90d: number;
  daysToStockout: number;
  adjustedDaysToStockout: number;
  marketTrend: 'alta' | 'estavel' | 'baixa';
  adjustmentFactor: number;
  urgency: 'CRITICO' | 'ATENCAO' | 'OK';
  confidence: number;
  reason: string;
  recommendation: string;
  risks: string[];
}

interface ForecastSummary {
  critical: number;
  attention: number;
  ok: number;
  totalProducts: number;
  potentialLossValue: number;
}

interface ForecastResponse {
  forecasts: ProductForecast[];
  summary: ForecastSummary;
  lastUpdated: string;
  cachedUntil: string;
}

export const StockForecastAI = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');

  const { data, isLoading, error, refetch } = useQuery<ForecastResponse>({
    queryKey: ['stock-forecast'],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('stock-forecast', {
        body: { maxProducts: 20 }
      });

      if (response.error) throw response.error;
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('stock-forecast', {
        body: { forceRefresh: true, maxProducts: 20 }
      });

      if (response.error) throw response.error;
      
      await refetch();
      toast({
        title: "Previsões atualizadas",
        description: "Os dados de mercado foram reprocessados com sucesso.",
      });
    } catch (err) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar as previsões. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateOrder = (productId: string) => {
    // Navegar para página de fornecedores com o produto selecionado
    navigate(`/app/suppliers?productId=${productId}`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredForecasts = data?.forecasts.filter(f => {
    if (urgencyFilter === 'all') return true;
    return f.urgency === urgencyFilter;
  }) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar previsões</h3>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Erro desconhecido'}
          </p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.forecasts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Nenhum produto cadastrado</h3>
          <p className="text-muted-foreground mb-4">
            Adicione produtos para começar a receber previsões de estoque inteligentes.
          </p>
          <Button onClick={() => navigate('/app/products/new')}>
            Adicionar produto
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com ações */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Previsão Inteligente de Estoque</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Análise híbrida combinando seus dados de vendas com tendências de mercado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Atualizado: {formatDate(data.lastUpdated)}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{data.summary.critical}</p>
                <p className="text-xs text-muted-foreground">Críticos (&lt;7 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">{data.summary.attention}</p>
                <p className="text-xs text-muted-foreground">Atenção (7-21 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-500">{data.summary.ok}</p>
                <p className="text-xs text-muted-foreground">OK (&gt;21 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold">{formatCurrency(data.summary.potentialLossValue)}</p>
                <p className="text-xs text-muted-foreground">Valor em risco</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por urgência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            <SelectItem value="CRITICO">🔴 Críticos</SelectItem>
            <SelectItem value="ATENCAO">🟡 Atenção</SelectItem>
            <SelectItem value="OK">🟢 OK</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="ml-2">
          {filteredForecasts.length} de {data.summary.totalProducts} produtos
        </Badge>
      </div>

      {/* Grid de previsões */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredForecasts.map(forecast => (
          <ForecastCard 
            key={forecast.productId} 
            forecast={forecast}
            onCreateOrder={handleCreateOrder}
          />
        ))}
      </div>

      {filteredForecasts.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold mb-2">Nenhum produto nesta categoria</h3>
            <p className="text-muted-foreground">
              Altere o filtro para ver outros produtos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
