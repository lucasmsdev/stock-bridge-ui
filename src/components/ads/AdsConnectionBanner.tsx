import { CheckCircle2, AlertCircle, RefreshCw, Link2, Loader2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetaIntegration, useSyncMetaAds, useSyncTikTokAds, useSyncGoogleAds } from "./useMetaAdsData";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type AdsPlatformType = 'meta_ads' | 'tiktok_ads' | 'google_ads';

const platformConfig: Record<AdsPlatformType, {
  label: string;
  logo: string;
  gradient: string;
  border: string;
  accent: string;
}> = {
  meta_ads: {
    label: 'Meta Ads',
    logo: '/logos/meta-ads.png',
    gradient: 'from-blue-500/10 to-blue-600/5 dark:from-blue-500/15 dark:to-blue-600/5',
    border: 'border-blue-500/20 dark:border-blue-400/20',
    accent: 'text-blue-600 dark:text-blue-400',
  },
  tiktok_ads: {
    label: 'TikTok Ads',
    logo: 'https://sf-tb-sg.ibytedtos.com/obj/eden-sg/uhtyvueh7nulogpoguhm/tiktok-icon2.png',
    gradient: 'from-pink-500/10 to-rose-600/5 dark:from-pink-500/15 dark:to-rose-600/5',
    border: 'border-pink-500/20 dark:border-pink-400/20',
    accent: 'text-pink-600 dark:text-pink-400',
  },
  google_ads: {
    label: 'Google Ads',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Google_Ads_logo.svg',
    gradient: 'from-green-500/10 to-emerald-600/5 dark:from-green-500/15 dark:to-emerald-600/5',
    border: 'border-green-500/20 dark:border-green-400/20',
    accent: 'text-green-600 dark:text-green-400',
  },
};

interface AdsConnectionBannerProps {
  integration: MetaIntegration | null;
  isLoading: boolean;
  hasRealData: boolean;
  lastSyncDate?: string;
  platform?: AdsPlatformType;
}

export function AdsConnectionBanner({
  integration,
  isLoading,
  hasRealData,
  lastSyncDate,
  platform = 'meta_ads',
}: AdsConnectionBannerProps) {
  const metaSync = useSyncMetaAds();
  const tiktokSync = useSyncTikTokAds();
  const googleSync = useSyncGoogleAds();
  const syncMutation = platform === 'tiktok_ads' ? tiktokSync : platform === 'google_ads' ? googleSync : metaSync;
  const config = platformConfig[platform];

  const handleSync = () => {
    syncMutation.mutate(30);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-muted animate-pulse">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Verificando conexão...</span>
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-warning/10 to-warning/5 border border-warning/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10">
            <AlertCircle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-sm font-semibold">Nenhuma plataforma de Ads conectada</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conecte Meta Ads, Google Ads ou TikTok Ads para ver métricas reais
            </p>
          </div>
        </div>
        <Button size="sm" className="bg-gradient-primary shrink-0" asChild>
          <a href="/app/integrations">
            <Link2 className="h-4 w-4 mr-2" />
            Conectar Plataforma
          </a>
        </Button>
      </div>
    );
  }

  const tokenExpiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
  const isTokenExpiringSoon = tokenExpiresAt && tokenExpiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r ${config.gradient} border ${config.border} transition-all duration-200 hover:shadow-sm`}>
      {/* Platform logo */}
      <div className="shrink-0">
        <img
          src={config.logo}
          alt={`${config.label} logo`}
          className="w-8 h-8 object-contain"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${config.accent}`}>
            {config.label}
          </span>
          {integration.account_name && (
            <span className="text-xs text-muted-foreground truncate">
              {integration.account_name}
            </span>
          )}
          {hasRealData ? (
            <Badge variant="success" className="text-[10px] px-1.5 py-0">Dados reais</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Sem dados</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {lastSyncDate ? (
            <>Sync {formatDistanceToNow(new Date(lastSyncDate), { addSuffix: true, locale: ptBR })}</>
          ) : (
            'Nenhum sync realizado'
          )}
          {isTokenExpiringSoon && tokenExpiresAt && (
            <span className="text-warning ml-2">
              • Token expira {formatDistanceToNow(tokenExpiresAt, { addSuffix: true, locale: ptBR })}
            </span>
          )}
        </p>
      </div>

      {/* Sync button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={syncMutation.isPending}
        className="shrink-0"
      >
        {syncMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        <span className="hidden sm:inline ml-2">
          {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
        </span>
      </Button>
    </div>
  );
}
