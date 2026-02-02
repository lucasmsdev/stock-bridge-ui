import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "./useOrganization";
import { useToast } from "./use-toast";

export interface CampaignLink {
  id: string;
  campaign_id: string;
  campaign_name: string | null;
  platform: string;
  product_id: string | null;
  sku: string;
  link_type: string;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface CampaignOption {
  campaign_id: string;
  campaign_name: string;
  platform: string;
}

export function useCampaignLinks(productId?: string) {
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch links for a specific product or all links
  const { data: links, isLoading: linksLoading, refetch } = useQuery({
    queryKey: ['campaign-links', organizationId, productId],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('campaign_product_links')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CampaignLink[];
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch available campaigns from ad_metrics
  const { data: availableCampaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ['available-campaigns', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('ad_metrics')
        .select('campaign_id, campaign_name, platform')
        .eq('organization_id', organizationId);

      if (error) throw error;

      // Deduplicate campaigns
      const uniqueCampaigns = new Map<string, CampaignOption>();
      data?.forEach(metric => {
        if (!uniqueCampaigns.has(metric.campaign_id)) {
          uniqueCampaigns.set(metric.campaign_id, {
            campaign_id: metric.campaign_id,
            campaign_name: metric.campaign_name,
            platform: metric.platform,
          });
        }
      });

      return Array.from(uniqueCampaigns.values());
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Create a new link
  const createLink = useMutation({
    mutationFn: async (linkData: {
      campaign_id: string;
      campaign_name?: string;
      platform: string;
      product_id: string;
      sku: string;
      link_type?: string;
      start_date?: string;
      end_date?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organizationId) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('campaign_product_links')
        .insert({
          ...linkData,
          organization_id: organizationId,
          user_id: user.id,
          link_type: linkData.link_type || 'manual',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-links'] });
      toast({
        title: "Campanha vinculada",
        description: "A campanha foi vinculada ao produto com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao vincular campanha",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update a link
  const updateLink = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CampaignLink> & { id: string }) => {
      const { data, error } = await supabase
        .from('campaign_product_links')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-links'] });
      toast({
        title: "Vínculo atualizado",
        description: "O vínculo foi atualizado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar vínculo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete a link
  const deleteLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from('campaign_product_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-links'] });
      toast({
        title: "Vínculo removido",
        description: "O vínculo foi removido com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover vínculo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    links: links || [],
    availableCampaigns: availableCampaigns || [],
    isLoading: linksLoading || campaignsLoading,
    createLink,
    updateLink,
    deleteLink,
    refetch,
  };
}
