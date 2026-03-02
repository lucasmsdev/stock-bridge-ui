import { useState, useMemo } from "react";
import { AdsFilters, AdsPeriod } from "./AdsFilters";
import { AdsMetricsCards } from "./AdsMetricsCards";
import { AdsPerformanceChart } from "./AdsPerformanceChart";
import { AdsPlatformBreakdown } from "./AdsPlatformBreakdown";
import { CampaignPerformanceTable } from "./CampaignPerformanceTable";
import { AdsConnectionBanner, AdsPlatformType } from "./AdsConnectionBanner";
import {
  AdsPlatform,
  getFilteredCampaigns,
  calculateTotals,
  getAggregatedDailyData,
  getPlatformBreakdown,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
} from "./mockAdsData";
import {
  useMetaAdsIntegration,
  useTikTokAdsIntegration,
  useGoogleAdsIntegration,
  useMercadoLivreAdsIntegration,
  useShopeeAdsIntegration,
  useAmazonAdsIntegration,
  useMagaluAdsIntegration,
  useTikTokShopAdsIntegration,
  useAdMetrics,
  useAggregatedMetrics,
  groupMetricsByCampaign,
  aggregateDailyData,
} from "./useMetaAdsData";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Megaphone, Globe, Store } from "lucide-react";

export function AdsDashboard() {
  const [platform, setPlatform] = useState<AdsPlatform>('all');
  const [period, setPeriod] = useState<AdsPeriod>('30days');

  // External ad platform integrations
  const { data: metaIntegration, isLoading: metaLoading } = useMetaAdsIntegration();
  const { data: tiktokIntegration, isLoading: tiktokLoading } = useTikTokAdsIntegration();
  const { data: googleIntegration, isLoading: googleLoading } = useGoogleAdsIntegration();

  // Marketplace ad integrations
  const { data: mlIntegration, isLoading: mlLoading } = useMercadoLivreAdsIntegration();
  const { data: shopeeIntegration, isLoading: shopeeLoading } = useShopeeAdsIntegration();
  const { data: amazonIntegration, isLoading: amazonLoading } = useAmazonAdsIntegration();
  const { data: magaluIntegration, isLoading: magaluLoading } = useMagaluAdsIntegration();
  const { data: tiktokshopIntegration, isLoading: tiktokshopLoading } = useTikTokShopAdsIntegration();

  const integrationLoading = metaLoading || tiktokLoading || googleLoading || mlLoading || shopeeLoading || amazonLoading || magaluLoading || tiktokshopLoading;
  const daysMap = { '7days': 7, '30days': 30, '90days': 90 };
  const { data: realMetrics = [], isLoading: metricsLoading } = useAdMetrics(daysMap[period]);

  // Build lists of active integrations by group
  const externalIntegrations = useMemo(() => {
    const list: { platform: AdsPlatformType; integration: NonNullable<typeof metaIntegration> }[] = [];
    if (metaIntegration) list.push({ platform: 'meta_ads', integration: metaIntegration });
    if (googleIntegration) list.push({ platform: 'google_ads', integration: googleIntegration });
    if (tiktokIntegration) list.push({ platform: 'tiktok_ads', integration: tiktokIntegration });
    return list;
  }, [metaIntegration, googleIntegration, tiktokIntegration]);

  const marketplaceIntegrations = useMemo(() => {
    const list: { platform: AdsPlatformType; integration: NonNullable<typeof metaIntegration> }[] = [];
    if (mlIntegration) list.push({ platform: 'mercadolivre_ads', integration: mlIntegration });
    if (shopeeIntegration) list.push({ platform: 'shopee_ads', integration: shopeeIntegration });
    if (amazonIntegration) list.push({ platform: 'amazon_ads', integration: amazonIntegration });
    if (magaluIntegration) list.push({ platform: 'magalu_ads', integration: magaluIntegration });
    if (tiktokshopIntegration) list.push({ platform: 'tiktokshop_ads', integration: tiktokshopIntegration });
    return list;
  }, [mlIntegration, shopeeIntegration, amazonIntegration, magaluIntegration, tiktokshopIntegration]);

  const activeIntegrations = useMemo(() => [...externalIntegrations, ...marketplaceIntegrations], [externalIntegrations, marketplaceIntegrations]);

  const hasRealData = realMetrics.length > 0;
  const isConnected = activeIntegrations.length > 0;

  // Per-platform last sync dates
  const lastSyncByPlatform = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const m of realMetrics) {
      const current = map[m.platform];
      if (!current || new Date(m.date) > new Date(current)) {
        map[m.platform] = m.date;
      }
    }
    return map;
  }, [realMetrics]);

  // Per-platform hasData
  const hasDataByPlatform = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const m of realMetrics) map[m.platform] = true;
    return map;
  }, [realMetrics]);

  // Filter metrics by platform
  const filteredRealMetrics = useMemo(() => {
    if (platform === 'all') return realMetrics;
    return realMetrics.filter(m => m.platform === platform);
  }, [realMetrics, platform]);

  // Aggregated metrics
  const realTotals = useAggregatedMetrics(filteredRealMetrics);
  const realCampaigns = useMemo(() => groupMetricsByCampaign(filteredRealMetrics), [filteredRealMetrics]);
  const realDailyData = useMemo(() => aggregateDailyData(filteredRealMetrics), [filteredRealMetrics]);

  // Mock data fallback
  const mockCampaigns = getFilteredCampaigns(platform);
  const mockTotals = calculateTotals(mockCampaigns);
  const mockDailyData = getAggregatedDailyData(platform);
  const mockPlatformBreakdown = getPlatformBreakdown();

  // Use real data when connected, mock only when disconnected
  const displayTotals = isConnected ? {
    spend: realTotals.totalSpend,
    impressions: realTotals.totalImpressions,
    clicks: realTotals.totalClicks,
    ctr: realTotals.avgCtr,
    conversions: realTotals.totalConversions,
    cpc: realTotals.avgCpc,
    costPerConversion: realTotals.totalConversions > 0 ? realTotals.totalSpend / realTotals.totalConversions : 0,
    roas: realTotals.roas,
  } : mockTotals;

  const displayDailyData = isConnected ? realDailyData.map(d => ({
    date: d.date,
    displayDate: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    spend: d.spend,
    conversions: d.conversions,
  })) : (() => {
    const days = period === '7days' ? 7 : period === '30days' ? 30 : 90;
    return mockDailyData.slice(-days);
  })();

  const displayCampaigns = isConnected ? realCampaigns.map(c => ({
    id: c.campaign_id,
    name: c.campaign_name,
    platform: c.platform as AdsPlatformType,
    status: 'active' as const,
    spend: c.totalSpend,
    impressions: c.totalImpressions,
    clicks: c.totalClicks,
    ctr: c.ctr,
    conversions: c.totalConversions,
    conversionValue: c.totalConversionValue,
    cpc: c.cpc,
    costPerConversion: c.costPerConversion,
    roas: c.roas,
  })) : mockCampaigns;

  // Platform breakdown
  const displayPlatformBreakdown = useMemo(() => {
    if (!isConnected) return mockPlatformBreakdown;

    const spendByPlatform: Record<string, number> = {};
    for (const m of filteredRealMetrics) {
      spendByPlatform[m.platform] = (spendByPlatform[m.platform] || 0) + m.spend;
    }

    if (Object.keys(spendByPlatform).length === 0) {
      return activeIntegrations.map(ai => ({
        platform: PLATFORM_LABELS[ai.platform] || ai.platform,
        spend: 0,
        percentage: 100 / activeIntegrations.length,
        color: PLATFORM_COLORS[ai.platform] || '#888',
      }));
    }

    const totalSpend = Object.values(spendByPlatform).reduce((s, v) => s + v, 0);
    return Object.entries(spendByPlatform).map(([p, spend]) => ({
      platform: PLATFORM_LABELS[p] || p,
      spend,
      percentage: totalSpend > 0 ? (spend / totalSpend) * 100 : 0,
      color: PLATFORM_COLORS[p] || '#888',
    }));
  }, [isConnected, filteredRealMetrics, activeIntegrations, mockPlatformBreakdown]);

  const handleClear = () => {
    setPlatform('all');
    setPeriod('30days');
  };

  const renderBannerGroup = (
    title: string,
    icon: React.ReactNode,
    integrations: typeof activeIntegrations,
  ) => {
    if (integrations.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {integrations.map(ai => (
            <AdsConnectionBanner
              key={ai.platform}
              integration={ai.integration}
              isLoading={integrationLoading}
              hasRealData={!!hasDataByPlatform[ai.platform]}
              lastSyncDate={lastSyncByPlatform[ai.platform]}
              platform={ai.platform}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Connection banners grouped */}
      {isConnected ? (
        <div className="space-y-4">
          {renderBannerGroup(
            'Plataformas Externas',
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />,
            externalIntegrations,
          )}
          {renderBannerGroup(
            'Marketplaces',
            <Store className="h-3.5 w-3.5 text-muted-foreground" />,
            marketplaceIntegrations,
          )}
        </div>
      ) : (
        <AdsConnectionBanner integration={null} isLoading={integrationLoading} hasRealData={false} />
      )}

      {/* Demo banner */}
      {!isConnected && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
          <Megaphone className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Dashboard de Anúncios Unificado</p>
            <p className="text-xs text-muted-foreground">
              Meta, Google, TikTok Ads + ML, Shopee, Amazon, Magalu e TikTok Shop Ads
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <AlertCircle className="h-3 w-3" />
            Dados de demonstração
          </Badge>
        </div>
      )}

      {/* Filters */}
      <AdsFilters platform={platform} period={period} onPlatformChange={setPlatform} onPeriodChange={setPeriod} onClear={handleClear} />

      {/* Active filters badges */}
      {(platform !== 'all' || period !== '30days') && (
        <div className="flex flex-wrap gap-2">
          {platform !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[platform] || '#888' }} />
              {PLATFORM_LABELS[platform] || platform}
            </Badge>
          )}
          <Badge variant="secondary">
            {period === '7days' ? 'Últimos 7 dias' : period === '30days' ? 'Últimos 30 dias' : 'Últimos 90 dias'}
          </Badge>
        </div>
      )}

      {/* Metrics Cards */}
      <AdsMetricsCards
        spend={displayTotals.spend}
        impressions={displayTotals.impressions}
        clicks={displayTotals.clicks}
        ctr={displayTotals.ctr}
        conversions={displayTotals.conversions}
        cpc={displayTotals.cpc}
        costPerConversion={displayTotals.costPerConversion}
        roas={displayTotals.roas}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        <AdsPerformanceChart data={displayDailyData} />
        <AdsPlatformBreakdown data={displayPlatformBreakdown} />
      </div>

      {/* Campaigns Table */}
      <CampaignPerformanceTable campaigns={displayCampaigns} />
    </div>
  );
}
