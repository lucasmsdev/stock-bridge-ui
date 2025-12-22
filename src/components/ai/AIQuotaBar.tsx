import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Clock, AlertTriangle, Infinity } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIQuotaBarProps {
  currentUsage: number;
  limit: number;
  percentUsed: number;
  daysUntilReset: number;
  isUnlimited: boolean;
  isNearLimit: boolean;
  isAtLimit: boolean;
}

export const AIQuotaBar = ({
  currentUsage,
  limit,
  percentUsed,
  daysUntilReset,
  isUnlimited,
  isNearLimit,
  isAtLimit
}: AIQuotaBarProps) => {
  // Determinar cor baseada no uso
  const getStatusColor = () => {
    if (isUnlimited) return "text-primary";
    if (isAtLimit) return "text-destructive";
    if (isNearLimit) return "text-yellow-500";
    return "text-primary";
  };

  const getProgressColor = () => {
    if (isAtLimit) return "bg-destructive";
    if (isNearLimit) return "bg-yellow-500";
    return "bg-primary";
  };

  if (isUnlimited) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
        <Infinity className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-primary">Consultas ilimitadas</span>
        <Badge variant="secondary" className="ml-auto text-xs">Unlimited</Badge>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3 rounded-lg bg-muted/50 border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className={cn("h-4 w-4", getStatusColor())} />
          <span className="text-sm font-medium">
            Consultas IA: {currentUsage}/{limit}
          </span>
          {isAtLimit && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Limite atingido
            </Badge>
          )}
          {isNearLimit && !isAtLimit && (
            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Quase no limite
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Renova em {daysUntilReset} dias</span>
        </div>
      </div>
      
      <div className="relative">
        <Progress value={Math.min(percentUsed, 100)} className="h-2" />
        <div 
          className={cn(
            "absolute inset-0 h-2 rounded-full transition-all",
            getProgressColor()
          )}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>
      
      <p className="text-xs text-muted-foreground">
        {percentUsed}% usado este mês
      </p>
    </div>
  );
};