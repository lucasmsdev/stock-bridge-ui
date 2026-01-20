import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle,
  Package,
  ShoppingCart,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

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

interface ForecastCardProps {
  forecast: ProductForecast;
  onCreateOrder?: (productId: string) => void;
}

export const ForecastCard = ({ forecast, onCreateOrder }: ForecastCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getUrgencyConfig = (urgency: string) => {
    switch (urgency) {
      case 'CRITICO':
        return {
          icon: AlertCircle,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          borderColor: 'border-destructive/30',
          label: 'Crítico',
          badgeVariant: 'destructive' as const
        };
      case 'ATENCAO':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-600 dark:text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          label: 'Atenção',
          badgeVariant: 'secondary' as const
        };
      default:
        return {
          icon: CheckCircle,
          color: 'text-green-600 dark:text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          label: 'OK',
          badgeVariant: 'outline' as const
        };
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'alta':
        return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-500" />;
      case 'baixa':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case 'alta': return 'Demanda em alta';
      case 'baixa': return 'Demanda em baixa';
      default: return 'Demanda estável';
    }
  };

  const urgencyConfig = getUrgencyConfig(forecast.urgency);
  const UrgencyIcon = urgencyConfig.icon;
  
  // Calcular progresso (invertido - menos dias = mais urgente = mais preenchido)
  const maxDays = 60;
  const progressValue = Math.max(0, Math.min(100, ((maxDays - forecast.adjustedDaysToStockout) / maxDays) * 100));

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-medium",
      urgencyConfig.borderColor,
      "border"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg", urgencyConfig.bgColor)}>
              <UrgencyIcon className={cn("h-5 w-5", urgencyConfig.color)} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold line-clamp-1">
                {forecast.name}
              </CardTitle>
              {forecast.sku && (
                <p className="text-xs text-muted-foreground">SKU: {forecast.sku}</p>
              )}
            </div>
          </div>
          <Badge variant={urgencyConfig.badgeVariant}>
            {urgencyConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Métricas principais */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Package className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{forecast.currentStock}</p>
            <p className="text-xs text-muted-foreground">Em estoque</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <ShoppingCart className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{forecast.dailyVelocity.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Vendas/dia</p>
          </div>
          <div className={cn("text-center p-2 rounded-lg", urgencyConfig.bgColor)}>
            <UrgencyIcon className={cn("h-4 w-4 mx-auto mb-1", urgencyConfig.color)} />
            <p className={cn("text-lg font-bold", urgencyConfig.color)}>
              {forecast.adjustedDaysToStockout}
            </p>
            <p className="text-xs text-muted-foreground">Dias restantes</p>
          </div>
        </div>

        {/* Barra de progresso de urgência */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Urgência de reposição</span>
            <span>{forecast.confidence}% confiança</span>
          </div>
          <Progress 
            value={progressValue} 
            className={cn(
              "h-2",
              forecast.urgency === 'CRITICO' && "[&>div]:bg-destructive",
              forecast.urgency === 'ATENCAO' && "[&>div]:bg-yellow-500",
              forecast.urgency === 'OK' && "[&>div]:bg-green-500"
            )}
          />
        </div>

        {/* Tendência de mercado */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            {getTrendIcon(forecast.marketTrend)}
            <span className="text-sm">{getTrendLabel(forecast.marketTrend)}</span>
          </div>
          {forecast.adjustmentFactor !== 1.0 && (
            <Badge variant="outline" className="text-xs">
              {forecast.adjustmentFactor > 1 ? '+' : ''}{((forecast.adjustmentFactor - 1) * 100).toFixed(0)}%
            </Badge>
          )}
        </div>

        {/* Expandível com detalhes */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span>Ver detalhes</span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {isExpanded && (
            <div className="mt-3 space-y-3 pt-3 border-t border-border">
              {/* Velocidades detalhadas */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <p className="font-medium">{forecast.velocity30d.toFixed(2)}</p>
                  <p className="text-muted-foreground">Últ. 30 dias</p>
                </div>
                <div className="text-center">
                  <p className="font-medium">{forecast.velocity60d.toFixed(2)}</p>
                  <p className="text-muted-foreground">Últ. 60 dias</p>
                </div>
                <div className="text-center">
                  <p className="font-medium">{forecast.velocity90d.toFixed(2)}</p>
                  <p className="text-muted-foreground">Últ. 90 dias</p>
                </div>
              </div>

              {/* Motivo da previsão */}
              <div className="text-sm">
                <p className="font-medium mb-1">Análise:</p>
                <p className="text-muted-foreground">{forecast.reason}</p>
              </div>

              {/* Recomendação */}
              <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm font-medium text-primary">💡 {forecast.recommendation}</p>
              </div>

              {/* Riscos */}
              {forecast.risks.length > 0 && (
                <div className="text-sm">
                  <p className="font-medium mb-1">⚠️ Riscos identificados:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    {forecast.risks.map((risk, idx) => (
                      <li key={idx}>{risk}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ação rápida */}
              {onCreateOrder && forecast.urgency !== 'OK' && (
                <Button 
                  className="w-full"
                  variant={forecast.urgency === 'CRITICO' ? 'destructive' : 'default'}
                  onClick={() => onCreateOrder(forecast.productId)}
                >
                  Criar pedido de compra
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
