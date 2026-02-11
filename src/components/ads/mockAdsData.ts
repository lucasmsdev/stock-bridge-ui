export type AdsPlatform = 'meta_ads' | 'google_ads' | 'tiktok_ads' | 'mercadolivre_ads' | 'shopee_ads' | 'amazon_ads' | 'all';

export type CampaignPlatform = 'meta_ads' | 'google_ads' | 'tiktok_ads' | 'mercadolivre_ads' | 'shopee_ads' | 'amazon_ads';

export interface Campaign {
  id: string;
  platform: CampaignPlatform;
  name: string;
  status: 'active' | 'paused';
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  conversionValue: number;
  cpc: number;
  costPerConversion: number;
  roas: number;
}

export interface DailyMetric {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  platform: CampaignPlatform;
}

// =============================================
// Dados consistentes com despesas do Centro de Custos:
// Meta Ads: R$500/mês | Google Ads: R$800/mês | TikTok Ads: R$250/mês
// Mercado Livre Ads: R$600/mês | Shopee Ads: R$300/mês | Amazon Ads: R$400/mês
// Total: R$2.850/mês em ads
// =============================================

// Campanhas Meta Ads (R$500/mês total)
export const metaCampaigns: Campaign[] = [
  {
    id: 'meta-1', platform: 'meta_ads', name: 'Remarketing Site', status: 'active',
    spend: 210, impressions: 9200, clicks: 184, ctr: 2.0, conversions: 11,
    conversionValue: 798, cpc: 1.14, costPerConversion: 19.09, roas: 3.8,
  },
  {
    id: 'meta-2', platform: 'meta_ads', name: 'Feed Catálogo', status: 'active',
    spend: 150, impressions: 6700, clicks: 100, ctr: 1.5, conversions: 5,
    conversionValue: 360, cpc: 1.50, costPerConversion: 30.00, roas: 2.4,
  },
  {
    id: 'meta-3', platform: 'meta_ads', name: 'Stories Produtos', status: 'active',
    spend: 90, impressions: 5100, clicks: 36, ctr: 0.7, conversions: 2,
    conversionValue: 162, cpc: 2.50, costPerConversion: 45.00, roas: 1.8,
  },
  {
    id: 'meta-4', platform: 'meta_ads', name: 'Lookalike Clientes', status: 'paused',
    spend: 50, impressions: 2500, clicks: 36, ctr: 1.4, conversions: 2,
    conversionValue: 155, cpc: 1.39, costPerConversion: 25.00, roas: 3.1,
  },
];

// Campanhas Google Ads (R$800/mês total)
export const googleCampaigns: Campaign[] = [
  {
    id: 'google-1', platform: 'google_ads', name: 'Search - Produtos', status: 'active',
    spend: 350, impressions: 14600, clicks: 219, ctr: 1.5, conversions: 14,
    conversionValue: 1015, cpc: 1.60, costPerConversion: 25.00, roas: 2.9,
  },
  {
    id: 'google-2', platform: 'google_ads', name: 'Shopping Feed', status: 'active',
    spend: 240, impressions: 11000, clicks: 166, ctr: 1.5, conversions: 11,
    conversionValue: 840, cpc: 1.45, costPerConversion: 21.82, roas: 3.5,
  },
  {
    id: 'google-3', platform: 'google_ads', name: 'Performance Max', status: 'paused',
    spend: 210, impressions: 8750, clicks: 120, ctr: 1.4, conversions: 8,
    conversionValue: 588, cpc: 1.75, costPerConversion: 26.25, roas: 2.8,
  },
];

// Campanhas TikTok Ads (R$250/mês total)
export const tiktokCampaigns: Campaign[] = [
  {
    id: 'tiktok-1', platform: 'tiktok_ads', name: 'In-Feed Produtos', status: 'active',
    spend: 150, impressions: 11500, clicks: 231, ctr: 2.0, conversions: 6,
    conversionValue: 420, cpc: 0.65, costPerConversion: 25.00, roas: 2.8,
  },
  {
    id: 'tiktok-2', platform: 'tiktok_ads', name: 'Spark Ads', status: 'paused',
    spend: 100, impressions: 8300, clicks: 154, ctr: 1.9, conversions: 4,
    conversionValue: 300, cpc: 0.65, costPerConversion: 25.00, roas: 3.0,
  },
];

// Campanhas Mercado Livre Ads (R$600/mês total)
export const mercadolivreCampaigns: Campaign[] = [
  {
    id: 'ml-1', platform: 'mercadolivre_ads', name: 'Product Ads - Eletrônicos', status: 'active',
    spend: 350, impressions: 28000, clicks: 560, ctr: 2.0, conversions: 28,
    conversionValue: 2800, cpc: 0.63, costPerConversion: 12.50, roas: 8.0,
  },
  {
    id: 'ml-2', platform: 'mercadolivre_ads', name: 'Product Ads - Acessórios', status: 'active',
    spend: 250, impressions: 22000, clicks: 440, ctr: 2.0, conversions: 18,
    conversionValue: 1260, cpc: 0.57, costPerConversion: 13.89, roas: 5.0,
  },
];

// Campanhas Shopee Ads (R$300/mês total)
export const shopeeCampaigns: Campaign[] = [
  {
    id: 'shopee-1', platform: 'shopee_ads', name: 'Discovery Ads', status: 'active',
    spend: 180, impressions: 15000, clicks: 450, ctr: 3.0, conversions: 15,
    conversionValue: 1050, cpc: 0.40, costPerConversion: 12.00, roas: 5.8,
  },
  {
    id: 'shopee-2', platform: 'shopee_ads', name: 'Search Ads', status: 'active',
    spend: 120, impressions: 10000, clicks: 300, ctr: 3.0, conversions: 10,
    conversionValue: 700, cpc: 0.40, costPerConversion: 12.00, roas: 5.8,
  },
];

// Campanhas Amazon Ads (R$400/mês total)
export const amazonCampaigns: Campaign[] = [
  {
    id: 'amazon-1', platform: 'amazon_ads', name: 'Sponsored Products - Top', status: 'active',
    spend: 250, impressions: 18000, clicks: 360, ctr: 2.0, conversions: 20,
    conversionValue: 2000, cpc: 0.69, costPerConversion: 12.50, roas: 8.0,
  },
  {
    id: 'amazon-2', platform: 'amazon_ads', name: 'Sponsored Brands', status: 'paused',
    spend: 150, impressions: 12000, clicks: 180, ctr: 1.5, conversions: 8,
    conversionValue: 640, cpc: 0.83, costPerConversion: 18.75, roas: 4.3,
  },
];

// Todas as campanhas
export const allCampaigns: Campaign[] = [
  ...metaCampaigns, ...googleCampaigns, ...tiktokCampaigns,
  ...mercadolivreCampaigns, ...shopeeCampaigns, ...amazonCampaigns,
];

// Dados diários dos últimos 30 dias
const generateDailyData = (): DailyMetric[] => {
  const data: DailyMetric[] = [];
  const now = new Date();
  
  const platformConfigs: { platform: CampaignPlatform; avgSpend: number; avgImpressions: number; avgClicks: number; conversionRate: number }[] = [
    { platform: 'meta_ads', avgSpend: 17, avgImpressions: 800, avgClicks: 12, conversionRate: 0.6 },
    { platform: 'google_ads', avgSpend: 27, avgImpressions: 1100, avgClicks: 17, conversionRate: 0.65 },
    { platform: 'tiktok_ads', avgSpend: 8, avgImpressions: 700, avgClicks: 13, conversionRate: 0.4 },
    { platform: 'mercadolivre_ads', avgSpend: 20, avgImpressions: 1700, avgClicks: 34, conversionRate: 0.7 },
    { platform: 'shopee_ads', avgSpend: 10, avgImpressions: 830, avgClicks: 25, conversionRate: 0.65 },
    { platform: 'amazon_ads', avgSpend: 13, avgImpressions: 1000, avgClicks: 18, conversionRate: 0.6 },
  ];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    for (const cfg of platformConfigs) {
      const variance = 0.3;
      const spend = cfg.avgSpend * (1 + (Math.random() - 0.5) * variance);
      data.push({
        date: dateStr,
        platform: cfg.platform,
        spend: Math.round(spend * 100) / 100,
        impressions: Math.floor(cfg.avgImpressions * (1 + (Math.random() - 0.5) * variance)),
        clicks: Math.floor(cfg.avgClicks * (1 + (Math.random() - 0.5) * variance)),
        conversions: Math.random() > (1 - cfg.conversionRate) ? 1 : 0,
      });
    }
  }
  
  return data;
};

export const dailyMetrics = generateDailyData();

// Helpers
export const getFilteredCampaigns = (platform: AdsPlatform): Campaign[] => {
  if (platform === 'all') return allCampaigns;
  return allCampaigns.filter(c => c.platform === platform);
};

export const getFilteredDailyMetrics = (platform: AdsPlatform): DailyMetric[] => {
  if (platform === 'all') return dailyMetrics;
  return dailyMetrics.filter(m => m.platform === platform);
};

export const calculateTotals = (campaigns: Campaign[]) => {
  const totals = campaigns.reduce(
    (acc, campaign) => ({
      spend: acc.spend + campaign.spend,
      impressions: acc.impressions + campaign.impressions,
      clicks: acc.clicks + campaign.clicks,
      conversions: acc.conversions + campaign.conversions,
      conversionValue: acc.conversionValue + campaign.conversionValue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0 }
  );

  return {
    ...totals,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    costPerConversion: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
    roas: totals.spend > 0 ? totals.conversionValue / totals.spend : 0,
  };
};

export const getAggregatedDailyData = (platform: AdsPlatform) => {
  const filtered = getFilteredDailyMetrics(platform);
  const aggregated: Record<string, { spend: number; conversions: number }> = {};
  
  filtered.forEach(m => {
    if (!aggregated[m.date]) aggregated[m.date] = { spend: 0, conversions: 0 };
    aggregated[m.date].spend += m.spend;
    aggregated[m.date].conversions += m.conversions;
  });
  
  return Object.entries(aggregated)
    .map(([date, data]) => ({
      date,
      displayDate: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      spend: Math.round(data.spend * 100) / 100,
      conversions: data.conversions,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

// Platform colors and labels
export const PLATFORM_COLORS: Record<string, string> = {
  meta_ads: '#1877F2',
  google_ads: '#34A853',
  tiktok_ads: '#EE1D52',
  mercadolivre_ads: '#FFE600',
  shopee_ads: '#EE4D2D',
  amazon_ads: '#FF9900',
};

export const PLATFORM_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  tiktok_ads: 'TikTok Ads',
  mercadolivre_ads: 'Mercado Livre Ads',
  shopee_ads: 'Shopee Ads',
  amazon_ads: 'Amazon Ads',
};

export const getPlatformBreakdown = () => {
  const platformGroups: Record<string, Campaign[]> = {};
  for (const c of allCampaigns) {
    if (!platformGroups[c.platform]) platformGroups[c.platform] = [];
    platformGroups[c.platform].push(c);
  }
  
  const total = allCampaigns.reduce((s, c) => s + c.spend, 0);
  
  return Object.entries(platformGroups).map(([platform, campaigns]) => {
    const spend = campaigns.reduce((s, c) => s + c.spend, 0);
    return {
      platform: PLATFORM_LABELS[platform] || platform,
      spend,
      percentage: total > 0 ? (spend / total) * 100 : 0,
      color: PLATFORM_COLORS[platform] || '#888',
    };
  });
};

export const getCampaignStatus = (roas: number): { label: string; variant: 'success' | 'default' | 'warning' | 'destructive' } => {
  if (roas >= 3.0) return { label: 'Excelente', variant: 'success' };
  if (roas >= 2.0) return { label: 'Bom', variant: 'default' };
  if (roas >= 1.0) return { label: 'Atenção', variant: 'warning' };
  return { label: 'Crítico', variant: 'destructive' };
};
