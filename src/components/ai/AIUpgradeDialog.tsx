import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Zap, Check, Clock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlan, planFeatures, PlanType } from "@/hooks/usePlan";

interface AIUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: 'no_access' | 'quota_exceeded';
  currentUsage?: number;
  limit?: number;
  daysUntilReset?: number;
}

export const AIUpgradeDialog = ({
  open,
  onOpenChange,
  reason,
  currentUsage = 0,
  limit = 0,
  daysUntilReset = 0
}: AIUpgradeDialogProps) => {
  const navigate = useNavigate();
  const { currentPlan } = usePlan();

  // Determinar próximo plano recomendado
  const getRecommendedPlan = (): { type: PlanType; data: typeof planFeatures[PlanType] } => {
    if (currentPlan === PlanType.INICIANTE) {
      return { type: PlanType.PROFISSIONAL, data: planFeatures[PlanType.PROFISSIONAL] };
    }
    if (currentPlan === PlanType.PROFISSIONAL) {
      return { type: PlanType.ENTERPRISE, data: planFeatures[PlanType.ENTERPRISE] };
    }
    return { type: PlanType.UNLIMITED, data: planFeatures[PlanType.UNLIMITED] };
  };

  const recommendedPlan = getRecommendedPlan();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/billing');
  };

  const handleWait = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">
            {reason === 'no_access' 
              ? 'Acesso à IA Requerido' 
              : 'Limite de Consultas Atingido'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {reason === 'no_access' ? (
              <>
                O assistente de IA está disponível a partir do plano Profissional.
                Faça upgrade para desbloquear análises estratégicas do seu negócio.
              </>
            ) : (
              <>
                Você usou suas {limit} consultas mensais.
                {daysUntilReset > 0 && ` Seu limite renova em ${daysUntilReset} dias.`}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{recommendedPlan.data.name}</span>
              <span className="text-lg font-bold text-primary">
                R$ {recommendedPlan.data.pricing.monthly}/mês
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>
                  {recommendedPlan.data.aiQueryLimit === -1 
                    ? 'Consultas ilimitadas' 
                    : `${recommendedPlan.data.aiQueryLimit} consultas/mês`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>
                  Modelo {recommendedPlan.data.aiModel === 'sonar-pro' 
                    ? 'avançado (mais inteligente)' 
                    : 'padrão'}
                </span>
              </div>
              {recommendedPlan.data.aiQueryLimit === -1 && (
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Prioridade no processamento</span>
                </div>
              )}
            </div>
          </div>

          {reason === 'quota_exceeded' && currentUsage > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <Sparkles className="h-4 w-4" />
              <span>Você usou {currentUsage} consultas este mês</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleUpgrade} className="w-full">
            <Zap className="mr-2 h-4 w-4" />
            Fazer Upgrade
          </Button>
          {reason === 'quota_exceeded' && daysUntilReset > 0 && (
            <Button variant="ghost" onClick={handleWait} className="w-full">
              <Clock className="mr-2 h-4 w-4" />
              Aguardar Renovação ({daysUntilReset} dias)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};