import { useState, useMemo } from "react";
import { AdsFilters, AdsPeriod } from "./AdsFilters";
import { AdsMetricsCards } from "./AdsMetricsCards";
import { AdsPerformanceChart } from "./AdsPerformanceChart";
import { AdsPlatformBreakdown } from "./AdsPlatformBreakdown";
import { CampaignPerformanceTable } from "./CampaignPerformanceTable";
import { AdsConnectionBanner } from "./AdsConnectionBanner";
import {
  AdsPlatform,
  getFilteredCampaigns,
  calculateTotals,
  getAggregatedDailyData,
  getPlatformBreakdown,
} from "./mockAdsData";
import {
  useMetaAdsIntegration,
  useTikTokAdsIntegration,
  useAdMetrics,
  useAggregatedMetrics,
  groupMetricsByCampaign,
  aggregateDailyData,
} from "./useMetaAdsData";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Megaphone } from "lucide-react";

const platformColors: Record<string, string> = {
  meta_ads: '#1877F2',
  tiktok_ads: '#EE1D52',
  google_ads: '#34A853',
};

const platformLabels: Record<string, string> = {
  meta_ads: 'Meta Ads',
  tiktok_ads: 'TikTok Ads',
  google_ads: 'Google Ads',
};

export function AdsDashboard() {
  const [platform, setPlatform] = useState<AdsPlatform>('all');
  const [period, setPeriod] = useState<AdsPeriod>('30days');

  // Real data hooks
  const { data: metaIntegration, isLoading: metaLoading } = useMetaAdsIntegration();
  const { data: tiktokIntegration, isLoading: tiktokLoading } = useTikTokAdsIntegration();
  const integrationLoading = metaLoading || tiktokLoading;
  const daysMap = { '7days': 7, '30days': 30, '90days': 90 };
  const { data: realMetrics = [], isLoading: metricsLoading } = useAdMetrics(daysMap[period]);

  // Build list of active integrations
  const activeIntegrations = useMemo(() => {
    const list: { platform: 'meta_ads' | 'tiktok_ads'; integration: NonNullable<typeof metaIntegration> }[] = [];
    if (metaIntegration) list.push({ platform: 'meta_ads', integration: metaIntegration });
    if (tiktokIntegration) list.push({ platform: 'tiktok_ads', integration: tiktokIntegration });
    return list;
  }, [metaIntegration, tiktokIntegration]);

  const hasRealData = realMetrics.length > 0;
  const isConnected = activeIntegrations.length > 0;

  // Get last sync date from metrics
  const lastSyncDate = useMemo(() => {
    if (!realMetrics.length) return undefined;
    return realMetrics.reduce((latest, m) => {
      const date = new Date(m.date);
      return date > new Date(latest) ? m.date : latest;
    }, realMetrics[0].date);
  }, [realMetrics]);

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
    for (const m of realMetrics) {
      map[m.platform] = true;
    }
    return map;
  }, [realMetrics]);

  // Filter metrics by platform
  const filteredRealMetrics = useMemo(() => {
    if (platform === 'all') return realMetrics;
    return realMetrics.filter(m => m.platform === platform);
  }, [realMetrics, platform]);

  // Calculate aggregated metrics from real data
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
    platform: c.platform as 'meta_ads' | 'google_ads' | 'tiktok_ads',
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

  // Platform breakdown from real metrics grouped by platform
  const displayPlatformBreakdown = useMemo(() => {
    if (!isConnected) return mockPlatformBreakdown;

    const spendByPlatform: Record<string, number> = {};
    for (const m of filteredRealMetrics) {
      spendByPlatform[m.platform] = (spendByPlatform[m.platform] || 0) + m.spend;
    }

    // If no spend data, show connected platforms with zero
    if (Object.keys(spendByPlatform).length === 0) {
      return activeIntegrations.map(ai => ({
        platform: platformLabels[ai.platform] || ai.platform,
        spend: 0,
        percentage: 100 / activeIntegrations.length,
        color: platformColors[ai.platform] || '#888',
      }));
    }

    const totalSpend = Object.values(spendByPlatform).reduce((s, v) => s + v, 0);
    return Object.entries(spendByPlatform).map(([p, spend]) => ({
      platform: platformLabels[p] || p,
      spend,
      percentage: totalSpend > 0 ? (spend / totalSpend) * 100 : 0,
      color: platformColors[p] || '#888',
    }));
  }, [isConnected, filteredRealMetrics, activeIntegrations, mockPlatformBreakdown]);

  const handleClear = () => {
    setPlatform('all');
    setPeriod('30days');
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Connection banners - one per connected integration */}
      {isConnected ? (
        <div className="space-y-3">
          {activeIntegrations.map(ai => (
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
      ) : (
        <AdsConnectionBanner
          integration={null}
          isLoading={integrationLoading}
          hasRealData={false}
        />
      )}

      {/* Header info banner - only show if using mock data (not connected) */}
      {!isConnected && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
          <Megaphone className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              Dashboard de Anúncios
            </p>
            <p className="text-xs text-muted-foreground">
              Visualização de métricas de campanhas do Meta Ads e Google Ads
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <AlertCircle className="h-3 w-3" />
            Dados de demonstração
          </Badge>
        </div>
      )}

      {/* Filters */}
      <AdsFilters
        platform={platform}
        period={period}
        onPlatformChange={setPlatform}
        onPeriodChange={setPeriod}
        onClear={handleClear}
      />

      {/* Active filters badges */}
      {(platform !== 'all' || period !== '30days') && (
        <div className="flex flex-wrap gap-2">
          {platform !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              <div 
                className={`w-2 h-2 rounded-full ${
                  platform === 'meta_ads' ? 'bg-blue-500' : platform === 'tiktok_ads' ? 'bg-pink-500' : 'bg-green-500'
                }`}
              />
              {platformLabels[platform] || platform}
            </Badge>
          )}
          <Badge variant="secondary">
            {period === '7days' ? 'Últimos 7 dias' : 
             period === '30days' ? 'Últimos 30 dias' : 'Últimos 90 dias'}
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
