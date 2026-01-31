export type AdsPlatform = 'meta_ads' | 'google_ads' | 'all';

export interface Campaign {
  id: string;
  platform: 'meta_ads' | 'google_ads';
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
  platform: 'meta_ads' | 'google_ads';
}

// Campanhas Meta Ads
export const metaCampaigns: Campaign[] = [
  {
    id: 'meta-1',
    platform: 'meta_ads',
    name: 'Black Friday 2025',
    status: 'active',
    spend: 3200,
    impressions: 142000,
    clicks: 2840,
    ctr: 2.0,
    conversions: 284,
    conversionValue: 13440,
    cpc: 1.13,
    costPerConversion: 11.27,
    roas: 4.2,
  },
  {
    id: 'meta-2',
    platform: 'meta_ads',
    name: 'Remarketing Site',
    status: 'active',
    spend: 2100,
    impressions: 89000,
    clicks: 1780,
    ctr: 2.0,
    conversions: 178,
    conversionValue: 7980,
    cpc: 1.18,
    costPerConversion: 11.80,
    roas: 3.8,
  },
  {
    id: 'meta-3',
    platform: 'meta_ads',
    name: 'Stories Verão',
    status: 'active',
    spend: 850,
    impressions: 35380,
    clicks: 248,
    ctr: 0.7,
    conversions: 42,
    conversionValue: 1530,
    cpc: 3.43,
    costPerConversion: 20.24,
    roas: 1.8,
  },
  {
    id: 'meta-4',
    platform: 'meta_ads',
    name: 'Feed Produtos',
    status: 'active',
    spend: 1450,
    impressions: 62000,
    clicks: 930,
    ctr: 1.5,
    conversions: 93,
    conversionValue: 3480,
    cpc: 1.56,
    costPerConversion: 15.59,
    roas: 2.4,
  },
  {
    id: 'meta-5',
    platform: 'meta_ads',
    name: 'Lookalike Clientes',
    status: 'paused',
    spend: 520,
    impressions: 28000,
    clicks: 392,
    ctr: 1.4,
    conversions: 47,
    conversionValue: 1612,
    cpc: 1.33,
    costPerConversion: 11.06,
    roas: 3.1,
  },
];

// Campanhas Google Ads
export const googleCampaigns: Campaign[] = [
  {
    id: 'google-1',
    platform: 'google_ads',
    name: 'Search - Produtos',
    status: 'active',
    spend: 4500,
    impressions: 186000,
    clicks: 2790,
    ctr: 1.5,
    conversions: 223,
    conversionValue: 13050,
    cpc: 1.61,
    costPerConversion: 20.18,
    roas: 2.9,
  },
  {
    id: 'google-2',
    platform: 'google_ads',
    name: 'Display - Marca',
    status: 'active',
    spend: 1800,
    impressions: 72000,
    clicks: 576,
    ctr: 0.8,
    conversions: 46,
    conversionValue: 3780,
    cpc: 3.13,
    costPerConversion: 39.13,
    roas: 2.1,
  },
  {
    id: 'google-3',
    platform: 'google_ads',
    name: 'Shopping Feed',
    status: 'active',
    spend: 980,
    impressions: 45000,
    clicks: 675,
    ctr: 1.5,
    conversions: 68,
    conversionValue: 3430,
    cpc: 1.45,
    costPerConversion: 14.41,
    roas: 3.5,
  },
  {
    id: 'google-4',
    platform: 'google_ads',
    name: 'Performance Max',
    status: 'paused',
    spend: 650,
    impressions: 31000,
    clicks: 372,
    ctr: 1.2,
    conversions: 45,
    conversionValue: 1820,
    cpc: 1.75,
    costPerConversion: 14.44,
    roas: 2.8,
  },
];

// Todas as campanhas
export const allCampaigns: Campaign[] = [...metaCampaigns, ...googleCampaigns];

// Dados diários dos últimos 30 dias
const generateDailyData = (): DailyMetric[] => {
  const data: DailyMetric[] = [];
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Variação realista para Meta Ads
    const metaBaseSpend = 280 + Math.random() * 120;
    const metaBaseConversions = 18 + Math.floor(Math.random() * 12);
    
    data.push({
      date: dateStr,
      platform: 'meta_ads',
      spend: Math.round(metaBaseSpend * 100) / 100,
      impressions: Math.floor(12000 + Math.random() * 8000),
      clicks: Math.floor(200 + Math.random() * 150),
      conversions: metaBaseConversions,
    });
    
    // Variação realista para Google Ads
    const googleBaseSpend = 260 + Math.random() * 100;
    const googleBaseConversions = 12 + Math.floor(Math.random() * 8);
    
    data.push({
      date: dateStr,
      platform: 'google_ads',
      spend: Math.round(googleBaseSpend * 100) / 100,
      impressions: Math.floor(11000 + Math.random() * 6000),
      clicks: Math.floor(140 + Math.random() * 100),
      conversions: googleBaseConversions,
    });
  }
  
  return data;
};

export const dailyMetrics = generateDailyData();

// Helpers para cálculo de totais
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

// Dados agregados por dia para gráfico
export const getAggregatedDailyData = (platform: AdsPlatform) => {
  const filtered = getFilteredDailyMetrics(platform);
  const aggregated: Record<string, { spend: number; conversions: number }> = {};
  
  filtered.forEach(m => {
    if (!aggregated[m.date]) {
      aggregated[m.date] = { spend: 0, conversions: 0 };
    }
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

// Breakdown por plataforma
export const getPlatformBreakdown = () => {
  const metaTotals = calculateTotals(metaCampaigns);
  const googleTotals = calculateTotals(googleCampaigns);
  const total = metaTotals.spend + googleTotals.spend;
  
  return [
    {
      platform: 'Meta Ads',
      spend: metaTotals.spend,
      percentage: total > 0 ? (metaTotals.spend / total) * 100 : 0,
      color: 'hsl(214, 89%, 52%)', // Facebook blue
    },
    {
      platform: 'Google Ads',
      spend: googleTotals.spend,
      percentage: total > 0 ? (googleTotals.spend / total) * 100 : 0,
      color: 'hsl(142, 71%, 45%)', // Google green
    },
  ];
};

// Status das campanhas baseado no ROAS
export const getCampaignStatus = (roas: number): { label: string; variant: 'success' | 'default' | 'warning' | 'destructive' } => {
  if (roas >= 3.0) return { label: 'Excelente', variant: 'success' };
  if (roas >= 2.0) return { label: 'Bom', variant: 'default' };
  if (roas >= 1.0) return { label: 'Atenção', variant: 'warning' };
  return { label: 'Crítico', variant: 'destructive' };
};
