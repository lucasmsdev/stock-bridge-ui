import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

export type OrgRole = 'admin' | 'operator' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  stripe_customer_id: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface OrganizationInvite {
  id: string;
  organization_id: string;
  code: string;
  role: OrgRole;
  created_by: string;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

export const useOrganization = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar organização e papel do usuário
  const { data: orgData, isLoading, error } = useQuery({
    queryKey: ['organization', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          role,
          organization_id,
          organizations (
            id,
            name,
            slug,
            plan,
            stripe_customer_id,
            owner_id,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Erro ao buscar organização:', error);
        throw error;
      }

      return {
        organization: data.organizations as Organization,
        role: data.role as OrgRole,
        organizationId: data.organization_id,
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Buscar membros da organização
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['organization-members', orgData?.organizationId],
    queryFn: async () => {
      if (!orgData?.organizationId) return [];

      // Primeiro buscar os membros
      const { data: membersData, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', orgData.organizationId)
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar membros:', error);
        throw error;
      }

      // Depois buscar os perfis correspondentes
      const userIds = membersData.map(m => m.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', userIds);

      // Combinar os dados
      return membersData.map(member => ({
        ...member,
        profiles: profilesData?.find(p => p.id === member.user_id) || null,
      })) as OrganizationMember[];
    },
    enabled: !!orgData?.organizationId && orgData?.role === 'admin',
    staleTime: 30 * 1000,
  });

  // Buscar convites ativos
  const { data: invites = [], isLoading: invitesLoading } = useQuery({
    queryKey: ['organization-invites', orgData?.organizationId],
    queryFn: async () => {
      if (!orgData?.organizationId) return [];

      const { data, error } = await supabase
        .from('organization_invites')
        .select('*')
        .eq('organization_id', orgData.organizationId)
        .is('used_by', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar convites:', error);
        throw error;
      }

      return data as OrganizationInvite[];
    },
    enabled: !!orgData?.organizationId && orgData?.role === 'admin',
    staleTime: 30 * 1000,
  });

  // Atualizar nome da organização
  const updateOrgName = useMutation({
    mutationFn: async (newName: string) => {
      if (!orgData?.organizationId) throw new Error('Organização não encontrada');

      const { error } = await supabase
        .from('organizations')
        .update({ name: newName })
        .eq('id', orgData.organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
  });

  // Remover membro
  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
    },
  });

  // Atualizar papel do membro
  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: OrgRole }) => {
      const { error } = await supabase
        .from('organization_members')
        .update({ role })
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
    },
  });

  // Revogar convite
  const revokeInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('organization_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-invites'] });
    },
  });

  return {
    organization: orgData?.organization || null,
    organizationId: orgData?.organizationId || null,
    role: orgData?.role || null,
    members,
    invites,
    isLoading,
    membersLoading,
    invitesLoading,
    error,
    updateOrgName,
    removeMember,
    updateMemberRole,
    revokeInvite,
  };
};
