import { CheckCircle2, AlertCircle, RefreshCw, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MetaIntegration,
  useSyncMetaAds, useSyncTikTokAds, useSyncGoogleAds,
  useSyncMercadoLivreAds, useSyncShopeeAds, useSyncAmazonAds,
  useSyncMagaluAds, useSyncTikTokShopAds,
} from "./useMetaAdsData";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export type AdsPlatformType = 'meta_ads' | 'tiktok_ads' | 'google_ads' | 'mercadolivre_ads' | 'shopee_ads' | 'amazon_ads' | 'magalu_ads' | 'tiktokshop_ads';

const platformConfig: Record<AdsPlatformType, {
  label: string;
  logo: string;
  gradient: string;
  border: string;
  accent: string;
  iconBg: string;
}> = {
  meta_ads: {
    label: 'Meta Ads',
    logo: '/logos/meta-ads.png',
    gradient: 'from-blue-500/8 to-blue-600/3 dark:from-blue-500/12 dark:to-blue-600/4',
    border: 'border-blue-200/60 dark:border-blue-500/20',
    accent: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/15',
  },
  tiktok_ads: {
    label: 'TikTok Ads',
    logo: 'https://sf-tb-sg.ibytedtos.com/obj/eden-sg/uhtyvueh7nulogpoguhm/tiktok-icon2.png',
    gradient: 'from-pink-500/8 to-rose-600/3 dark:from-pink-500/12 dark:to-rose-600/4',
    border: 'border-pink-200/60 dark:border-pink-500/20',
    accent: 'text-pink-600 dark:text-pink-400',
    iconBg: 'bg-pink-500/10 dark:bg-pink-500/15',
  },
  google_ads: {
    label: 'Google Ads',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Google_Ads_logo.svg',
    gradient: 'from-green-500/8 to-emerald-600/3 dark:from-green-500/12 dark:to-emerald-600/4',
    border: 'border-green-200/60 dark:border-green-500/20',
    accent: 'text-green-600 dark:text-green-400',
    iconBg: 'bg-green-500/10 dark:bg-green-500/15',
  },
  mercadolivre_ads: {
    label: 'ML Ads',
    logo: 'https://vectorseek.com/wp-content/uploads/2023/08/Mercado-Livre-Icon-Logo-Vector.svg-.png',
    gradient: 'from-yellow-500/8 to-yellow-600/3 dark:from-yellow-500/12 dark:to-yellow-600/4',
    border: 'border-yellow-200/60 dark:border-yellow-500/20',
    accent: 'text-yellow-600 dark:text-yellow-400',
    iconBg: 'bg-yellow-500/10 dark:bg-yellow-500/15',
  },
  shopee_ads: {
    label: 'Shopee Ads',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Shopee_logo.svg/1442px-Shopee_logo.svg.png',
    gradient: 'from-orange-500/8 to-orange-600/3 dark:from-orange-500/12 dark:to-orange-600/4',
    border: 'border-orange-200/60 dark:border-orange-500/20',
    accent: 'text-orange-600 dark:text-orange-400',
    iconBg: 'bg-orange-500/10 dark:bg-orange-500/15',
  },
  amazon_ads: {
    label: 'Amazon Ads',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/d/de/Amazon_icon.png',
    gradient: 'from-amber-500/8 to-amber-600/3 dark:from-amber-500/12 dark:to-amber-600/4',
    border: 'border-amber-200/60 dark:border-amber-500/20',
    accent: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/15',
  },
  magalu_ads: {
    label: 'Magalu Ads',
    logo: '/logos/magalu.png',
    gradient: 'from-sky-500/8 to-sky-600/3 dark:from-sky-500/12 dark:to-sky-600/4',
    border: 'border-sky-200/60 dark:border-sky-500/20',
    accent: 'text-sky-600 dark:text-sky-400',
    iconBg: 'bg-sky-500/10 dark:bg-sky-500/15',
  },
  tiktokshop_ads: {
    label: 'TT Shop Ads',
    logo: '/logos/tiktok-shop.png',
    gradient: 'from-cyan-500/8 to-teal-600/3 dark:from-cyan-500/12 dark:to-teal-600/4',
    border: 'border-cyan-200/60 dark:border-cyan-500/20',
    accent: 'text-cyan-600 dark:text-cyan-400',
    iconBg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
  },
};

interface AdsConnectionBannerProps {
  integration: MetaIntegration | null;
  isLoading: boolean;
  hasRealData: boolean;
  lastSyncDate?: string;
  platform?: AdsPlatformType;
}

const syncHooksMap: Record<AdsPlatformType, () => ReturnType<typeof useSyncMetaAds>> = {
  meta_ads: useSyncMetaAds,
  tiktok_ads: useSyncTikTokAds,
  google_ads: useSyncGoogleAds,
  mercadolivre_ads: useSyncMercadoLivreAds,
  shopee_ads: useSyncShopeeAds,
  amazon_ads: useSyncAmazonAds,
  magalu_ads: useSyncMagaluAds,
  tiktokshop_ads: useSyncTikTokShopAds,
};

export function AdsConnectionBanner({
  integration,
  isLoading,
  hasRealData,
  lastSyncDate,
  platform = 'meta_ads',
}: AdsConnectionBannerProps) {
  const syncMutation = syncHooksMap[platform]();
  const config = platformConfig[platform];

  const handleSync = () => {
    syncMutation.mutate(30);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6 rounded-xl bg-muted/30 border border-muted animate-pulse">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
              Conecte plataformas externas ou marketplaces para ver métricas reais
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
    <div className={`flex flex-col items-center gap-3 p-4 rounded-xl bg-gradient-to-br ${config.gradient} border ${config.border} transition-all duration-200 hover:shadow-md hover:scale-[1.01]`}>
      {/* Logo + Name */}
      <div className="flex items-center gap-3 w-full">
        <div className={`p-2 rounded-lg ${config.iconBg} shrink-0`}>
          <img src={config.logo} alt={`${config.label} logo`} className="w-7 h-7 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-bold ${config.accent}`}>{config.label}</span>
          {integration.account_name && (
            <p className="text-[11px] text-muted-foreground truncate">{integration.account_name}</p>
          )}
        </div>
        {hasRealData ? (
          <Badge variant="success" className="text-[10px] px-1.5 py-0 shrink-0">
            <CheckCircle2 className="h-3 w-3 mr-0.5" />
            Ativo
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">Sem dados</Badge>
        )}
      </div>

      {/* Sync info + Button */}
      <div className="flex items-center justify-between w-full gap-2">
        <p className="text-[11px] text-muted-foreground truncate">
          {lastSyncDate ? (
            <>Sync {formatDistanceToNow(new Date(lastSyncDate), { addSuffix: true, locale: ptBR })}</>
          ) : (
            'Nenhum sync'
          )}
          {isTokenExpiringSoon && tokenExpiresAt && (
            <span className="text-warning ml-1">
              • Token expira {formatDistanceToNow(tokenExpiresAt, { addSuffix: true, locale: ptBR })}
            </span>
          )}
        </p>
        <Button variant="ghost" size="icon" onClick={handleSync} disabled={syncMutation.isPending} className="h-7 w-7 shrink-0">
          {syncMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}
