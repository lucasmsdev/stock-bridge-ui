import { Lock, Crown, Zap, ArrowRight, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { FeatureName, PlanType } from "@/hooks/usePlan";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface UpgradeBannerProps {
  title: string;
  description: string;
  requiredPlan: PlanType;
  feature?: FeatureName;
  className?: string;
  variant?: 'card' | 'inline' | 'modal';
}

const planIcons = {
  estrategista: Crown,
  competidor: Zap,
  dominador: Star,
};

const planNames = {
  estrategista: 'Estrategista',
  competidor: 'Competidor', 
  dominador: 'Dominador'
};

const planColors = {
  estrategista: 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 dark:border-blue-600 dark:from-blue-900/20 dark:to-blue-800/20',
  competidor: 'border-green-200 bg-gradient-to-br from-green-50 to-green-100 dark:border-green-600 dark:from-green-900/20 dark:to-green-800/20',
  dominador: 'border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 dark:border-purple-600 dark:from-purple-900/20 dark:to-purple-800/20',
};

const buttonColors = {
  estrategista: 'bg-blue-600 hover:bg-blue-700',
  competidor: 'bg-green-600 hover:bg-green-700',
  dominador: 'bg-purple-600 hover:bg-purple-700',
};

export function UpgradeBanner({ 
  title, 
  description, 
  requiredPlan, 
  feature, 
  className = "", 
  variant = 'card'
}: UpgradeBannerProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isNavigating, setIsNavigating] = useState(false);
  const PlanIcon = planIcons[requiredPlan] || Crown;
  const planName = planNames[requiredPlan] || requiredPlan;

  const handleUpgradeClick = async () => {
    if (isNavigating) return; // Prevent double clicks
    
    try {
      setIsNavigating(true);
      toast({
        title: "Redirecionando...",
        description: "Você será levado para a página de planos.",
      });
      
      // Small delay to show the toast
      await new Promise(resolve => setTimeout(resolve, 500));
      
      navigate('/app/billing', { 
        state: { 
          targetPlan: requiredPlan, 
          feature,
          fromUpgradeBanner: true 
        } 
      });
    } catch (error) {
      console.error('Erro na navegação:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao redirecionar. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsNavigating(false);
    }
  };

  if (variant === 'inline') {
    return (
      <div className={`flex items-center justify-between p-4 border-l-4 border-primary bg-primary/5 rounded-r-md ${className}`}>
        <div className="flex items-center space-x-3">
          <Lock className="h-5 w-5 text-primary" />
          <div>
            <h4 className="font-medium text-sm">{title}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button size="sm" onClick={handleUpgradeClick} disabled={isNavigating} className={buttonColors[requiredPlan]}>
          {isNavigating ? "Redirecionando..." : "Upgrade"}
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <Card className={`border-dashed border-2 ${planColors[requiredPlan]} ${className}`}>
      <CardHeader className="text-center pb-3">
        <div className="mx-auto mb-2 p-3 rounded-full bg-background/60 border">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <Badge variant="outline" className="border-border text-foreground bg-background/60">
          <PlanIcon className="h-3 w-3 mr-1" />
          Plano {planName} necessário
        </Badge>
        
        <Button 
          className={`w-full ${buttonColors[requiredPlan]} text-white`} 
          onClick={handleUpgradeClick}
          disabled={isNavigating}
        >
          <PlanIcon className="h-4 w-4 mr-2" />
          {isNavigating ? "Redirecionando..." : "Fazer Upgrade Agora"}
        </Button>
      </CardContent>
    </Card>
  );
}