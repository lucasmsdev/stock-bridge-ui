import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AdMetric {
  id: string;
  platform: string;
  campaign_id: string;
  campaign_name: string;
  ad_account_id: string | null;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  reach: number;
  ctr: number;
  cpc: number;
}

export interface MetaIntegration {
  id: string;
  account_name: string | null;
  marketplace_id: string | null;
  token_expires_at: string | null;
  updated_at: string;
}

export interface AggregatedMetrics {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalConversionValue: number;
  avgCtr: number;
  avgCpc: number;
  roas: number;
}

export function useMetaAdsIntegration() {
  return useQuery({
    queryKey: ['meta-ads-integration'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('integrations')
        .select('id, account_name, marketplace_id, token_expires_at, updated_at')
        .eq('platform', 'meta_ads')
        .maybeSingle();

      if (error) {
        console.error('Error fetching Meta Ads integration:', error);
        return null;
      }

      return data as MetaIntegration | null;
    },
  });
}

export function useAdMetrics(daysFilter: number = 30) {
  return useQuery({
    queryKey: ['ad-metrics', daysFilter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysFilter);

      const { data, error } = await supabase
        .from('ad_metrics')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching ad metrics:', error);
        return [];
      }

      return (data || []) as AdMetric[];
    },
  });
}

export function useAggregatedMetrics(metrics: AdMetric[]): AggregatedMetrics {
  if (!metrics.length) {
    return {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalConversionValue: 0,
      avgCtr: 0,
      avgCpc: 0,
      roas: 0,
    };
  }

  const totalSpend = metrics.reduce((sum, m) => sum + (m.spend || 0), 0);
  const totalImpressions = metrics.reduce((sum, m) => sum + (m.impressions || 0), 0);
  const totalClicks = metrics.reduce((sum, m) => sum + (m.clicks || 0), 0);
  const totalConversions = metrics.reduce((sum, m) => sum + (m.conversions || 0), 0);
  const totalConversionValue = metrics.reduce((sum, m) => sum + (m.conversion_value || 0), 0);

  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const roas = totalSpend > 0 ? totalConversionValue / totalSpend : 0;

  return {
    totalSpend,
    totalImpressions,
    totalClicks,
    totalConversions,
    totalConversionValue,
    avgCtr,
    avgCpc,
    roas,
  };
}

export function useSyncMetaAds() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (days: number = 30) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(
        `https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/sync-meta-ads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ days }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Falha ao sincronizar');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Sincronização concluída',
        description: 'As métricas do Meta Ads foram atualizadas.',
      });
      queryClient.invalidateQueries({ queryKey: ['ad-metrics'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao sincronizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useTikTokAdsIntegration() {
  return useQuery({
    queryKey: ['tiktok-ads-integration'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('integrations')
        .select('id, account_name, marketplace_id, token_expires_at, updated_at')
        .eq('platform', 'tiktok_ads')
        .maybeSingle();

      if (error) {
        console.error('Error fetching TikTok Ads integration:', error);
        return null;
      }

      return data as MetaIntegration | null;
    },
  });
}

export function useSyncTikTokAds() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (days: number = 30) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(
        `https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/sync-tiktok-ads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ days }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Falha ao sincronizar');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Sincronização concluída',
        description: 'As métricas do TikTok Ads foram atualizadas.',
      });
      queryClient.invalidateQueries({ queryKey: ['ad-metrics'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao sincronizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useGoogleAdsIntegration() {
  return useQuery({
    queryKey: ['google-ads-integration'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('integrations')
        .select('id, account_name, marketplace_id, token_expires_at, updated_at')
        .eq('platform', 'google_ads')
        .maybeSingle();

      if (error) {
        console.error('Error fetching Google Ads integration:', error);
        return null;
      }

      return data as MetaIntegration | null;
    },
  });
}

export function useSyncGoogleAds() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (days: number = 30) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(
        `https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/sync-google-ads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ days }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Falha ao sincronizar');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Sincronização concluída',
        description: 'As métricas do Google Ads foram atualizadas.',
      });
      queryClient.invalidateQueries({ queryKey: ['ad-metrics'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao sincronizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Helper to group metrics by campaign
export function groupMetricsByCampaign(metrics: AdMetric[]) {
  const campaignMap = new Map<string, {
    campaign_id: string;
    campaign_name: string;
    platform: string;
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalConversionValue: number;
  }>();

  for (const metric of metrics) {
    const existing = campaignMap.get(metric.campaign_id);
    if (existing) {
      existing.totalSpend += metric.spend || 0;
      existing.totalImpressions += metric.impressions || 0;
      existing.totalClicks += metric.clicks || 0;
      existing.totalConversions += metric.conversions || 0;
      existing.totalConversionValue += metric.conversion_value || 0;
    } else {
      campaignMap.set(metric.campaign_id, {
        campaign_id: metric.campaign_id,
        campaign_name: metric.campaign_name,
        platform: metric.platform,
        totalSpend: metric.spend || 0,
        totalImpressions: metric.impressions || 0,
        totalClicks: metric.clicks || 0,
        totalConversions: metric.conversions || 0,
        totalConversionValue: metric.conversion_value || 0,
      });
    }
  }

  return Array.from(campaignMap.values()).map((c) => ({
    ...c,
    ctr: c.totalImpressions > 0 ? (c.totalClicks / c.totalImpressions) * 100 : 0,
    cpc: c.totalClicks > 0 ? c.totalSpend / c.totalClicks : 0,
    costPerConversion: c.totalConversions > 0 ? c.totalSpend / c.totalConversions : 0,
    roas: c.totalSpend > 0 ? c.totalConversionValue / c.totalSpend : 0,
  }));
}

// Helper to aggregate daily data for charts
export function aggregateDailyData(metrics: AdMetric[]) {
  const dailyMap = new Map<string, {
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
  }>();

  for (const metric of metrics) {
    const existing = dailyMap.get(metric.date);
    if (existing) {
      existing.spend += metric.spend || 0;
      existing.impressions += metric.impressions || 0;
      existing.clicks += metric.clicks || 0;
      existing.conversions += metric.conversions || 0;
    } else {
      dailyMap.set(metric.date, {
        date: metric.date,
        spend: metric.spend || 0,
        impressions: metric.impressions || 0,
        clicks: metric.clicks || 0,
        conversions: metric.conversions || 0,
      });
    }
  }

  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}
