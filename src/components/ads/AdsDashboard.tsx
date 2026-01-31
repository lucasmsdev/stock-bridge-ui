import { useState } from "react";
import { AdsFilters, AdsPeriod } from "./AdsFilters";
import { AdsMetricsCards } from "./AdsMetricsCards";
import { AdsPerformanceChart } from "./AdsPerformanceChart";
import { AdsPlatformBreakdown } from "./AdsPlatformBreakdown";
import { CampaignPerformanceTable } from "./CampaignPerformanceTable";
import {
  AdsPlatform,
  getFilteredCampaigns,
  calculateTotals,
  getAggregatedDailyData,
  getPlatformBreakdown,
} from "./mockAdsData";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Megaphone } from "lucide-react";

export function AdsDashboard() {
  const [platform, setPlatform] = useState<AdsPlatform>('all');
  const [period, setPeriod] = useState<AdsPeriod>('30days');

  const campaigns = getFilteredCampaigns(platform);
  const totals = calculateTotals(campaigns);
  const dailyData = getAggregatedDailyData(platform);
  const platformBreakdown = getPlatformBreakdown();

  // Filter daily data based on period
  const filteredDailyData = (() => {
    const days = period === '7days' ? 7 : period === '30days' ? 30 : 90;
    return dailyData.slice(-days);
  })();

  const handleClear = () => {
    setPlatform('all');
    setPeriod('30days');
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header info banner */}
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
                  platform === 'meta_ads' ? 'bg-blue-500' : 'bg-green-500'
                }`}
              />
              {platform === 'meta_ads' ? 'Meta Ads' : 'Google Ads'}
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
        spend={totals.spend}
        impressions={totals.impressions}
        clicks={totals.clicks}
        ctr={totals.ctr}
        conversions={totals.conversions}
        cpc={totals.cpc}
        costPerConversion={totals.costPerConversion}
        roas={totals.roas}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        <AdsPerformanceChart data={filteredDailyData} />
        <AdsPlatformBreakdown data={platformBreakdown} />
      </div>

      {/* Campaigns Table */}
      <CampaignPerformanceTable campaigns={campaigns} />
    </div>
  );
}
