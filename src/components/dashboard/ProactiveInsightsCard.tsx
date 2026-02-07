import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { usePlan, FeatureName } from "@/hooks/usePlan";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  PackageX,
  DollarSign,
  Rocket,
  BarChart3,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

interface Insight {
  type: "stock_critical" | "low_margin" | "expansion_opportunity" | "trend_alert" | "cost_optimization";
  severity: "critical" | "warning" | "opportunity";
  title: string;
  description: string;
  action: string;
  metric: string;
  relatedProductId?: string | null;
}

const severityConfig = {
  critical: {
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    badgeVariant: "destructive" as const,
    label: "Crítico",
  },
  warning: {
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    badgeVariant: "secondary" as const,
    label: "Atenção",
  },
  opportunity: {
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    badgeVariant: "outline" as const,
    label: "Oportunidade",
  },
};

const typeIcons: Record<string, typeof PackageX> = {
  stock_critical: PackageX,
  low_margin: DollarSign,
  expansion_opportunity: Rocket,
  trend_alert: TrendingDown,
  cost_optimization: BarChart3,
};

export function ProactiveInsightsCard() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();
  const { hasFeature, isAdmin, organizationId } = usePlan();
  const { toast } = useToast();
  const navigate = useNavigate();

  const hasAccess = hasFeature(FeatureName.AI_ASSISTANT) || isAdmin;

  const fetchInsights = async (forceRefresh = false) => {
    if (!user?.id || !organizationId) return;

    try {
      if (!forceRefresh) {
        // Check for valid cached insights
        const { data: cached } = await supabase
          .from("ai_insights")
          .select("insights, expires_at")
          .eq("organization_id", organizationId)
          .gt("expires_at", new Date().toISOString())
          .order("generated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cached?.insights) {
          setInsights((cached.insights as unknown as Insight[]).slice(0, 3));
          setIsLoading(false);
          return;
        }
      }

      // Generate new insights
      setIsRefreshing(true);
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      if (!token) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const response = await fetch(
        `https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/generate-ai-insights`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjdndvZ2FxYXJrdXF2dW15cXFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjM2MDAsImV4cCI6MjA3MjU5OTYwMH0.NNf4sIZNSwFyNXFPUlNRxAl5mz0TJ0Rd5FR3mtMWxuo",
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Error generating insights:", errorData);
        toast({
          variant: "destructive",
          title: "Erro ao gerar insights",
          description: "Tente novamente mais tarde.",
        });
        setInsights([]);
        return;
      }

      const data = await response.json();
      setInsights((data.insights || []).slice(0, 3));
    } catch (error) {
      console.error("Failed to fetch insights:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (hasAccess && user?.id && organizationId) {
      fetchInsights();
    } else {
      setIsLoading(false);
    }
  }, [hasAccess, user?.id, organizationId]);

  const handleDiscussWithUni = (insight: Insight) => {
    const question = `Sobre o insight: "${insight.title}" - ${insight.description}. ${insight.action}. Pode me explicar mais e dar recomendações detalhadas?`;
    navigate(`/app/ai-assistant?q=${encodeURIComponent(question)}`);
  };

  // Don't render if user doesn't have access
  if (!hasAccess) return null;

  // Loading skeleton
  if (isLoading) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Insights da Uni
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/30">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // No insights available
  if (insights.length === 0 && !isRefreshing) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Insights da Uni
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchInsights(true)}
              disabled={isRefreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Gerar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Cadastre produtos e registre vendas para que a Uni identifique oportunidades e riscos automaticamente.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Insights da Uni
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchInsights(true)}
            disabled={isRefreshing}
            className="gap-1.5 text-muted-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isRefreshing ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/30">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))
        ) : (
          insights.map((insight, index) => {
            const config = severityConfig[insight.severity] || severityConfig.warning;
            const Icon = typeIcons[insight.type] || AlertTriangle;

            return (
              <div
                key={index}
                className={`flex gap-3 p-3 rounded-lg border ${config.border} ${config.bg} transition-all hover:shadow-sm`}
              >
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${config.bg}`}>
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="text-sm font-semibold text-foreground truncate">
                      {insight.title}
                    </h4>
                    <Badge variant={config.badgeVariant} className="text-[10px] px-1.5 py-0">
                      {config.label}
                    </Badge>
                    {insight.metric && (
                      <span className={`text-xs font-bold ${config.color}`}>
                        {insight.metric}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {insight.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-primary hover:text-primary"
                      onClick={() => handleDiscussWithUni(insight)}
                    >
                      <MessageSquare className="h-3 w-3" />
                      Discutir com Uni
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
