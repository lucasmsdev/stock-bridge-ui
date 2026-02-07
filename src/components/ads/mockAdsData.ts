export type AdsPlatform = 'meta_ads' | 'google_ads' | 'tiktok_ads' | 'all';

export interface Campaign {
  id: string;
  platform: 'meta_ads' | 'google_ads' | 'tiktok_ads';
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
  platform: 'meta_ads' | 'google_ads' | 'tiktok_ads';
}

// =============================================
// Dados consistentes com despesas do Centro de Custos:
// Meta Ads: R$500/mês | Google Ads: R$800/mês | TikTok Ads: R$250/mês
// Total: R$1.550/mês em ads
// Revenue ~R$30k/mês → ads = ~5% da receita (realista para e-commerce pequeno)
// =============================================

// Campanhas Meta Ads (R$500/mês total)
export const metaCampaigns: Campaign[] = [
  {
    id: 'meta-1',
    platform: 'meta_ads',
    name: 'Remarketing Site',
    status: 'active',
    spend: 210,
    impressions: 9200,
    clicks: 184,
    ctr: 2.0,
    conversions: 11,
    conversionValue: 798,
    cpc: 1.14,
    costPerConversion: 19.09,
    roas: 3.8,
  },
  {
    id: 'meta-2',
    platform: 'meta_ads',
    name: 'Feed Catálogo',
    status: 'active',
    spend: 150,
    impressions: 6700,
    clicks: 100,
    ctr: 1.5,
    conversions: 5,
    conversionValue: 360,
    cpc: 1.50,
    costPerConversion: 30.00,
    roas: 2.4,
  },
  {
    id: 'meta-3',
    platform: 'meta_ads',
    name: 'Stories Produtos',
    status: 'active',
    spend: 90,
    impressions: 5100,
    clicks: 36,
    ctr: 0.7,
    conversions: 2,
    conversionValue: 162,
    cpc: 2.50,
    costPerConversion: 45.00,
    roas: 1.8,
  },
  {
    id: 'meta-4',
    platform: 'meta_ads',
    name: 'Lookalike Clientes',
    status: 'paused',
    spend: 50,
    impressions: 2500,
    clicks: 36,
    ctr: 1.4,
    conversions: 2,
    conversionValue: 155,
    cpc: 1.39,
    costPerConversion: 25.00,
    roas: 3.1,
  },
];

// Campanhas Google Ads (R$800/mês total)
export const googleCampaigns: Campaign[] = [
  {
    id: 'google-1',
    platform: 'google_ads',
    name: 'Search - Produtos',
    status: 'active',
    spend: 350,
    impressions: 14600,
    clicks: 219,
    ctr: 1.5,
    conversions: 14,
    conversionValue: 1015,
    cpc: 1.60,
    costPerConversion: 25.00,
    roas: 2.9,
  },
  {
    id: 'google-2',
    platform: 'google_ads',
    name: 'Shopping Feed',
    status: 'active',
    spend: 240,
    impressions: 11000,
    clicks: 166,
    ctr: 1.5,
    conversions: 11,
    conversionValue: 840,
    cpc: 1.45,
    costPerConversion: 21.82,
    roas: 3.5,
  },
  {
    id: 'google-3',
    platform: 'google_ads',
    name: 'Performance Max',
    status: 'paused',
    spend: 210,
    impressions: 8750,
    clicks: 120,
    ctr: 1.4,
    conversions: 8,
    conversionValue: 588,
    cpc: 1.75,
    costPerConversion: 26.25,
    roas: 2.8,
  },
];

// Campanhas TikTok Ads (R$250/mês total)
export const tiktokCampaigns: Campaign[] = [
  {
    id: 'tiktok-1',
    platform: 'tiktok_ads',
    name: 'In-Feed Produtos',
    status: 'active',
    spend: 150,
    impressions: 11500,
    clicks: 231,
    ctr: 2.0,
    conversions: 6,
    conversionValue: 420,
    cpc: 0.65,
    costPerConversion: 25.00,
    roas: 2.8,
  },
  {
    id: 'tiktok-2',
    platform: 'tiktok_ads',
    name: 'Spark Ads',
    status: 'paused',
    spend: 100,
    impressions: 8300,
    clicks: 154,
    ctr: 1.9,
    conversions: 4,
    conversionValue: 300,
    cpc: 0.65,
    costPerConversion: 25.00,
    roas: 3.0,
  },
];

// Todas as campanhas
export const allCampaigns: Campaign[] = [...metaCampaigns, ...googleCampaigns, ...tiktokCampaigns];

// Dados diários dos últimos 30 dias (alinhados com budgets reais)
const generateDailyData = (): DailyMetric[] => {
  const data: DailyMetric[] = [];
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Meta Ads: ~R$17/day (R$500/month)
    const metaSpend = 14 + Math.random() * 6;
    data.push({
      date: dateStr,
      platform: 'meta_ads',
      spend: Math.round(metaSpend * 100) / 100,
      impressions: Math.floor(700 + Math.random() * 300),
      clicks: Math.floor(10 + Math.random() * 8),
      conversions: Math.random() > 0.4 ? 1 : 0,
    });
    
    // Google Ads: ~R$27/day (R$800/month)
    const googleSpend = 22 + Math.random() * 10;
    data.push({
      date: dateStr,
      platform: 'google_ads',
      spend: Math.round(googleSpend * 100) / 100,
      impressions: Math.floor(1000 + Math.random() * 500),
      clicks: Math.floor(14 + Math.random() * 8),
      conversions: Math.random() > 0.35 ? 1 : 0,
    });
    
    // TikTok Ads: ~R$8/day (R$250/month)
    const tiktokSpend = 6 + Math.random() * 5;
    data.push({
      date: dateStr,
      platform: 'tiktok_ads',
      spend: Math.round(tiktokSpend * 100) / 100,
      impressions: Math.floor(600 + Math.random() * 400),
      clicks: Math.floor(8 + Math.random() * 6),
      conversions: Math.random() > 0.6 ? 1 : 0,
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
  const tiktokTotals = calculateTotals(tiktokCampaigns);
  const total = metaTotals.spend + googleTotals.spend + tiktokTotals.spend;
  
  return [
    {
      platform: 'Meta Ads',
      spend: metaTotals.spend,
      percentage: total > 0 ? (metaTotals.spend / total) * 100 : 0,
      color: 'hsl(214, 89%, 52%)',
    },
    {
      platform: 'Google Ads',
      spend: googleTotals.spend,
      percentage: total > 0 ? (googleTotals.spend / total) * 100 : 0,
      color: 'hsl(142, 71%, 45%)',
    },
    {
      platform: 'TikTok Ads',
      spend: tiktokTotals.spend,
      percentage: total > 0 ? (tiktokTotals.spend / total) * 100 : 0,
      color: 'hsl(349, 100%, 50%)',
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
