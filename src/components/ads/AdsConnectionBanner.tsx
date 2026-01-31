import { useState } from "react";
import { CheckCircle2, AlertCircle, RefreshCw, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MetaIntegration, useSyncMetaAds } from "./useMetaAdsData";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdsConnectionBannerProps {
  integration: MetaIntegration | null;
  isLoading: boolean;
  hasRealData: boolean;
  lastSyncDate?: string;
}

export function AdsConnectionBanner({
  integration,
  isLoading,
  hasRealData,
  lastSyncDate,
}: AdsConnectionBannerProps) {
  const syncMutation = useSyncMetaAds();

  const handleSync = () => {
    syncMutation.mutate(30);
  };

  if (isLoading) {
    return (
      <Card className="bg-muted/30 border-muted">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Verificando conexão...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!integration) {
    return (
      <Card className="bg-warning/10 border-warning/30">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-warning shrink-0" />
              <div>
                <p className="text-sm font-medium">Meta Ads não conectado</p>
                <p className="text-xs text-muted-foreground">
                  Conecte sua conta para ver métricas reais de campanhas
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/app/integrations">
                <Link2 className="h-4 w-4 mr-2" />
                Conectar
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if token is expiring soon (less than 7 days)
  const tokenExpiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
  const isTokenExpiringSoon = tokenExpiresAt && tokenExpiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <Card className={`${isTokenExpiringSoon ? 'bg-warning/10 border-warning/30' : 'bg-primary/10 border-primary/30'}`}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className={`h-5 w-5 shrink-0 ${isTokenExpiringSoon ? 'text-warning' : 'text-primary'}`} />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {integration.account_name || 'Meta Ads'}
                </p>
                {hasRealData ? (
                  <Badge variant="success" className="text-xs">Dados reais</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Sem dados ainda</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {lastSyncDate ? (
                  <>Última sincronização: {formatDistanceToNow(new Date(lastSyncDate), { addSuffix: true, locale: ptBR })}</>
                ) : (
                  'Nenhuma sincronização realizada'
                )}
                {isTokenExpiringSoon && tokenExpiresAt && (
                  <span className="text-warning ml-2">
                    • Token expira {formatDistanceToNow(tokenExpiresAt, { addSuffix: true, locale: ptBR })}
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
