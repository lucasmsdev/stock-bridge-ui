import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Star, ArrowLeft } from "lucide-react";
import { usePlan, PlanType, FeatureName } from "@/hooks/usePlan";
import { useToast } from "@/hooks/use-toast";
import { UpgradeBanner } from "@/components/ui/upgrade-banner";

interface LocationState {
  targetPlan?: PlanType;
  feature?: FeatureName;
}

const planIcons = {
  estrategista: Crown,
  competidor: Zap,
  dominador: Star,
};

const planColors = {
  estrategista: 'border-blue-500',
  competidor: 'border-green-500',
  dominador: 'border-purple-500',
};

const planGradients = {
  estrategista: 'bg-gradient-to-br from-blue-50 to-blue-100',
  competidor: 'bg-gradient-to-br from-green-50 to-green-100',
  dominador: 'bg-gradient-to-br from-purple-50 to-purple-100',
};

export default function Billing() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const { currentPlan, getAllPlans } = usePlan();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const allPlans = getAllPlans();
  const targetPlan = state?.targetPlan;
  const targetFeature = state?.feature;

  const handlePlanSelection = async (planKey: PlanType) => {
    if (planKey === currentPlan) return;
    
    if (planKey === 'estrategista' && currentPlan !== 'estrategista') {
      toast({
        title: "⚠️ Downgrade não disponível",
        description: "Entre em contato com o suporte para fazer downgrade do seu plano.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Simular processamento de upgrade
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "🚧 Em breve!",
        description: "O sistema de pagamento será implementado em breve. Sua solicitação foi registrada!",
      });
    } catch (error) {
      toast({
        title: "❌ Erro",
        description: "Erro ao processar upgrade. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isCurrentPlan = (planKey: PlanType) => planKey === currentPlan;
  const isPlanUpgrade = (planKey: PlanType) => {
    const planPrices = { estrategista: 49.90, competidor: 149.90, dominador: 299.90 };
    return planPrices[planKey] > planPrices[currentPlan];
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Planos e Assinatura</h1>
          <p className="text-muted-foreground">
            Escolha o plano ideal para escalar seu negócio
          </p>
        </div>
      </div>

      {targetFeature && (
        <UpgradeBanner
          title={`Desbloqueie: ${targetFeature.replace(/([A-Z])/g, ' $1').trim()}`}
          description="Esta funcionalidade está disponível nos planos superiores"
          requiredPlan={targetPlan || 'competidor'}
          feature={targetFeature}
          className="mb-6"
        />
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {Object.entries(allPlans).map(([planKey, plan]) => {
          const PlanIcon = planIcons[planKey as PlanType];
          const isCurrent = isCurrentPlan(planKey as PlanType);
          const isUpgrade = isPlanUpgrade(planKey as PlanType);
          const isRecommended = planKey === 'competidor';
          
          return (
            <Card 
              key={planKey} 
              className={`relative transition-all duration-300 hover:shadow-lg ${
                isCurrent 
                  ? `${planColors[planKey as PlanType]} shadow-md ${planGradients[planKey as PlanType]}` 
                  : 'hover:border-primary'
              } ${targetPlan === planKey ? 'ring-2 ring-primary' : ''}`}
            >
              {isRecommended && !isCurrent && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
                  Mais Popular
                </Badge>
              )}
              {isCurrent && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-green-600 text-white">
                  Plano Atual
                </Badge>
              )}
              
              <CardHeader className="text-center space-y-4">
                <div className="mx-auto p-3 rounded-full bg-background shadow-sm">
                  <PlanIcon className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>
                <div className="space-y-2">
                  <div className="text-3xl font-bold">
                    R$ {plan.price.toFixed(2).replace('.', ',')}
                  </div>
                  <p className="text-sm text-muted-foreground">/mês</p>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center text-sm">
                    <Check className="h-4 w-4 text-green-600 mr-2" />
                    <span>
                      {plan.maxSkus === Infinity ? 'SKUs Ilimitados' : `Até ${plan.maxSkus} SKUs`}
                    </span>
                  </div>
                  
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center text-sm">
                      <Check className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                      <span>
                        {feature.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full"
                  variant={isCurrent ? "secondary" : "default"}
                  onClick={() => handlePlanSelection(planKey as PlanType)}
                  disabled={isCurrent || isProcessing}
                >
                  {isProcessing ? (
                    "Processando..."
                  ) : isCurrent ? (
                    "Plano Atual"
                  ) : isUpgrade ? (
                    "Fazer Upgrade"
                  ) : (
                    "Selecionar Plano"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6 text-center space-y-4">
          <h3 className="text-lg font-semibold">Precisa de algo personalizado?</h3>
          <p className="text-muted-foreground">
            Entre em contato conosco para planos empresariais e soluções customizadas.
          </p>
          <Button variant="outline">
            Falar com Vendas
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}