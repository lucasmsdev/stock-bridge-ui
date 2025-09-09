import { Lock, Crown, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UpgradeBannerProps {
  title: string;
  description: string;
  requiredPlan: string;
  feature?: string;
  className?: string;
}

const planIcons = {
  estrategista: Crown,
  competidor: Zap,
  dominador: Crown,
};

const planNames = {
  estrategista: 'Estrategista',
  competidor: 'Competidor', 
  dominador: 'Dominador'
};

export function UpgradeBanner({ title, description, requiredPlan, feature, className }: UpgradeBannerProps) {
  const PlanIcon = planIcons[requiredPlan] || Crown;
  const planName = planNames[requiredPlan] || requiredPlan;

  return (
    <Card className={`border-dashed border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 ${className}`}>
      <CardHeader className="text-center pb-3">
        <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <Badge variant="outline" className="border-primary text-primary">
          <PlanIcon className="h-3 w-3 mr-1" />
          Plano {planName} necessário
        </Badge>
        <Button className="w-full bg-gradient-primary hover:bg-primary-hover">
          <Crown className="h-4 w-4 mr-2" />
          Fazer Upgrade
        </Button>
      </CardContent>
    </Card>
  );
}