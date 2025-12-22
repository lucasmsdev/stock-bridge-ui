import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Star, ArrowLeft, HelpCircle } from "lucide-react";
import { usePlan, PlanType, FeatureName } from "@/hooks/usePlan";
import { useToast } from "@/hooks/use-toast";
import { UpgradeBanner } from "@/components/ui/upgrade-banner";
import { supabase } from "@/integrations/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Descrições dos benefícios para os tooltips
const featureDescriptions: Record<string, string> = {
  products: "Quantidade máxima de produtos que você pode cadastrar e gerenciar na plataforma.",
  integrations: "Número de contas diferentes que você pode conectar em cada marketplace (ex: 2 lojas no Mercado Livre).",
  sync: "Mantenha seu estoque sempre atualizado automaticamente em todos os marketplaces conectados.",
  orders: "Visualize e gerencie todos os seus pedidos de todos os canais em um único lugar.",
  ai_assistant: "Converse com a Uni, nossa IA que te ajuda a tomar decisões, responder dúvidas e automatizar tarefas.",
  reports: "Gere relatórios detalhados de vendas, lucratividade e performance do seu negócio.",
  financial: "Calcule automaticamente seus custos, margens e lucro real por produto e por canal.",
  market_analysis: "Análise de concorrentes, tendências de mercado e sugestões de precificação com IA.",
  priority_support: "Atendimento prioritário com tempo de resposta reduzido e suporte dedicado.",
};

interface LocationState {
  targetPlan?: PlanType;
  feature?: FeatureName;
}

const planIcons = {
  estrategista: Crown,
  competidor: Zap,
  dominador: Star,
  unlimited: Star,
};

const planColors = {
  estrategista: 'border-blue-500',
  competidor: 'border-green-500',
  dominador: 'border-purple-500',
  unlimited: 'border-yellow-500',
};

const planGradients = {
  estrategista: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20',
  competidor: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20',
  dominador: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20',
  unlimited: 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20',
};

export default function Billing() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const { currentPlan, getAllPlans } = usePlan();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);

  const allPlans = getAllPlans();
  const targetPlan = state?.targetPlan;
  const targetFeature = state?.feature;

  // Check if this is a first-time user (no plan selected)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    
    if (success) {
      toast({
        title: "🎉 Pagamento realizado com sucesso!",
        description: "Seu plano foi ativado. Bem-vindo ao UniStock!",
      });
      // Clean up URL
      navigate('/billing', { replace: true });
    } else if (canceled) {
      toast({
        title: "Pagamento cancelado",
        description: "Você pode tentar novamente quando quiser.",
        variant: "destructive",
      });
      // Clean up URL
      navigate('/billing', { replace: true });
    }

    // Check if user has no plan (first time)
    if (!currentPlan || currentPlan === PlanType.INICIANTE) {
      setIsFirstTime(true);
    }
  }, [location.search, currentPlan, navigate, toast]);

  const handlePlanSelection = async (planKey: PlanType) => {
    if (planKey === currentPlan) return;
    
    if (planKey === PlanType.INICIANTE && currentPlan !== PlanType.INICIANTE) {
      toast({
        title: "⚠️ Downgrade não disponível",
        description: "Entre em contato com o suporte para fazer downgrade do seu plano.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log('🚀 Criando sessão de checkout para o plano:', planKey);
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { planType: planKey }
      });

      if (error) {
        console.error('❌ Erro na função create-checkout:', error);
        throw new Error(error.message || 'Erro ao processar pagamento');
      }

      if (data?.url) {
        console.log('✅ Sessão de checkout criada, redirecionando para:', data.url);
        // Open Stripe checkout in a new tab
        window.open(data.url, '_blank');
        
        toast({
          title: "🔄 Redirecionando para pagamento",
          description: "Você será redirecionado para completar o pagamento no Stripe.",
        });
      } else {
        throw new Error('URL de checkout não recebida');
      }
    } catch (error) {
      console.error('💥 Erro ao processar upgrade:', error);
      toast({
        title: "❌ Erro no pagamento",
        description: error instanceof Error ? error.message : "Erro ao processar upgrade. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isCurrentPlan = (planKey: PlanType) => planKey === currentPlan;
  const isPlanUpgrade = (planKey: PlanType) => {
    const planPrices = { estrategista: 97.00, competidor: 197.00, dominador: 297.00, unlimited: 397.00 };
    return planPrices[planKey] > planPrices[currentPlan];
  };

  return (
    <TooltipProvider delayDuration={100}>
    <div className="container mx-auto py-4 md:py-6 space-y-4 md:space-y-6 px-2 md:px-0">
      <div className="flex items-center space-x-2 md:space-x-4">
        {!isFirstTime && (
          <Button variant="ghost" onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft className="h-3 w-3 md:h-4 md:w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {isFirstTime ? "Bem-vindo ao UniStock!" : "Planos e Assinatura"}
          </h1>
          <p className="text-muted-foreground">
            {isFirstTime 
              ? "Para começar, escolha o plano que melhor se adapta ao seu negócio"
              : "Escolha o plano ideal para escalar seu negócio"
            }
          </p>
        </div>
      </div>

      {targetFeature && (
        <UpgradeBanner
          title={`Desbloqueie: ${targetFeature.replace(/([A-Z])/g, ' $1').trim()}`}
          description="Esta funcionalidade está disponível nos planos superiores"
          requiredPlan={targetPlan || PlanType.PROFISSIONAL}
          feature={targetFeature}
          className="mb-6"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {Object.entries(allPlans).map(([planKey, plan]) => {
          const PlanIcon = planIcons[planKey as PlanType];
          const isCurrent = isCurrentPlan(planKey as PlanType);
          const isUpgrade = isPlanUpgrade(planKey as PlanType);
          const isRecommended = planKey === 'profissional';
          
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
                  <p className="text-sm text-muted-foreground mt-2">
                    {planKey === 'iniciante' && 'Ideal para começar a centralizar suas vendas'}
                    {planKey === 'profissional' && 'Mais vendido! Para escalar com inteligência'}
                    {planKey === 'enterprise' && 'Operações avançadas com análise de mercado'}
                    {planKey === 'unlimited' && 'Sem limites para grandes operações'}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-3xl font-bold">
                    R$ {plan.pricing.monthly}
                  </div>
                  <p className="text-sm text-muted-foreground">/mês</p>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center text-sm cursor-help group">
                          <Check className="h-4 w-4 text-green-600 mr-2" />
                          <span className="flex-1">
                            {plan.maxProducts === Infinity ? 'Produtos Ilimitados' : `Até ${plan.maxProducts} produtos`}
                          </span>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[250px]">
                        <p>{featureDescriptions.products}</p>
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center text-sm cursor-help group">
                          <Check className="h-4 w-4 text-green-600 mr-2" />
                          <span className="flex-1">
                            {plan.maxIntegrationsPerMarketplace === Infinity 
                              ? 'Contas ilimitadas por marketplace' 
                              : `${plan.maxIntegrationsPerMarketplace} conta${plan.maxIntegrationsPerMarketplace > 1 ? 's' : ''} por marketplace`}
                          </span>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[250px]">
                        <p>{featureDescriptions.integrations}</p>
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center text-sm cursor-help group">
                          <Check className="h-4 w-4 text-green-600 mr-2" />
                          <span className="flex-1">Sincronização de produtos e estoque</span>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[250px]">
                        <p>{featureDescriptions.sync}</p>
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center text-sm cursor-help group">
                          <Check className="h-4 w-4 text-green-600 mr-2" />
                          <span className="flex-1">Gestão de pedidos</span>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[250px]">
                        <p>{featureDescriptions.orders}</p>
                      </TooltipContent>
                    </Tooltip>
                    
                    {plan.features.includes(FeatureName.AI_ASSISTANT) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center text-sm cursor-help group">
                            <Check className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                            <span className="flex-1">Agente de IA "Uni"</span>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px]">
                          <p>{featureDescriptions.ai_assistant}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {plan.features.includes(FeatureName.REPORTS) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center text-sm cursor-help group">
                            <Check className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                            <span className="flex-1">Relatórios de vendas</span>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px]">
                          <p>{featureDescriptions.reports}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {plan.features.includes(FeatureName.FINANCIAL_CALCULATOR) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center text-sm cursor-help group">
                            <Check className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                            <span className="flex-1">Cálculo financeiro e lucro</span>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px]">
                          <p>{featureDescriptions.financial}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {plan.features.includes(FeatureName.MARKET_ANALYSIS) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center text-sm cursor-help group">
                            <Check className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                            <span className="flex-1">Análise de mercado com IA</span>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px]">
                          <p>{featureDescriptions.market_analysis}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {plan.features.includes(FeatureName.PRIORITY_SUPPORT) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center text-sm cursor-help group">
                            <Check className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                            <span className="flex-1">Suporte prioritário</span>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px]">
                          <p>{featureDescriptions.priority_support}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
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
    </TooltipProvider>
  );
}