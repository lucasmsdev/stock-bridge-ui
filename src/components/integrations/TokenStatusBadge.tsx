import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, Infinity, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TokenStatusBadgeProps {
  platform: string;
  tokenExpiresAt: string | null;
  updatedAt: string;
}

type TokenStatus = "valid" | "expiring" | "expired" | "permanent" | "unknown";

export function TokenStatusBadge({ platform, tokenExpiresAt, updatedAt }: TokenStatusBadgeProps) {
  const getTokenStatus = (): TokenStatus => {
    // Shopify tokens não expiram
    if (platform === "shopify") {
      return "permanent";
    }

    // Se não tem data de expiração, verificar pelo updated_at
    if (!tokenExpiresAt) {
      const lastUpdate = new Date(updatedAt);
      const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      // Se foi atualizado recentemente, provavelmente está válido
      if (hoursSinceUpdate < 1) {
        return "valid";
      }
      return "unknown";
    }

    const expiresAt = new Date(tokenExpiresAt);
    const now = new Date();
    const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60);

    if (minutesUntilExpiry <= 0) {
      return "expired";
    } else if (minutesUntilExpiry <= 15) {
      return "expiring";
    } else {
      return "valid";
    }
  };

  const status = getTokenStatus();

  const statusConfig: Record<TokenStatus, {
    label: string;
    icon: React.ReactNode;
    className: string;
    tooltip: string;
  }> = {
    valid: {
      label: "Token Válido",
      icon: <CheckCircle2 className="w-3 h-3" />,
      className: "bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-500/20 dark:text-green-400",
      tooltip: tokenExpiresAt 
        ? `Expira em ${new Date(tokenExpiresAt).toLocaleString("pt-BR")}`
        : "Token atualizado recentemente"
    },
    expiring: {
      label: "Expirando",
      icon: <Clock className="w-3 h-3 animate-pulse" />,
      className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:bg-yellow-500/20 dark:text-yellow-400",
      tooltip: `Token expira em breve. Será renovado automaticamente.`
    },
    expired: {
      label: "Expirado",
      icon: <AlertCircle className="w-3 h-3" />,
      className: "bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/20 dark:text-red-400",
      tooltip: "Token expirado. A renovação automática tentará corrigir isso em breve."
    },
    permanent: {
      label: "Permanente",
      icon: <Infinity className="w-3 h-3" />,
      className: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400",
      tooltip: "Tokens Shopify não expiram"
    },
    unknown: {
      label: "Verificando",
      icon: <RefreshCw className="w-3 h-3" />,
      className: "bg-muted text-muted-foreground",
      tooltip: "Status do token será verificado na próxima sincronização"
    }
  };

  const config = statusConfig[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`${config.className} cursor-help transition-all hover:scale-105`}
          >
            {config.icon}
            <span className="ml-1">{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function getTimeUntilExpiry(tokenExpiresAt: string | null): string | null {
  if (!tokenExpiresAt) return null;
  
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  
  if (diffMs <= 0) return "Expirado";
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  
  if (diffHours > 0) {
    return `${diffHours}h ${remainingMinutes}min`;
  }
  return `${diffMinutes}min`;
}
