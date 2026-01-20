import { StockForecastAI } from "@/components/stock/StockForecastAI";
import { usePlan, FeatureName } from "@/hooks/usePlan";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, TrendingUp, Sparkles, BarChart3, AlertTriangle } from "lucide-react";

const StockForecast = () => {
  const { hasFeature, isLoading } = usePlan();
  const navigate = useNavigate();

  // Previsão de estoque requer plano Profissional ou superior (mesma feature do AI_ASSISTANT)
  const hasAccess = hasFeature(FeatureName.AI_ASSISTANT);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="h-4 bg-muted rounded w-96"></div>
          <div className="grid grid-cols-4 gap-4 mt-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
              <Crown className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">Previsão de Estoque com IA</CardTitle>
            <CardDescription className="text-base">
              Recurso exclusivo para planos Profissional e superiores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold">Inteligência Artificial Híbrida</h4>
                  <p className="text-sm text-muted-foreground">
                    Combina seus dados de vendas com tendências de mercado em tempo real
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold">Previsões Ajustadas</h4>
                  <p className="text-sm text-muted-foreground">
                    Considera sazonalidade, eventos e comportamento do mercado
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <AlertTriangle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold">Alertas Proativos</h4>
                  <p className="text-sm text-muted-foreground">
                    Seja avisado antes de ficar sem estoque, não depois
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <BarChart3 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold">Recomendações Acionáveis</h4>
                  <p className="text-sm text-muted-foreground">
                    Saiba exatamente quanto e quando reabastecer cada produto
                  </p>
                </div>
              </div>
            </div>

            <Button 
              className="w-full" 
              size="lg"
              onClick={() => navigate('/app/billing')}
            >
              <Crown className="h-4 w-4 mr-2" />
              Fazer upgrade agora
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <StockForecastAI />
    </div>
  );
};

export default StockForecast;
