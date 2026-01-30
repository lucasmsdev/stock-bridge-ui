import { useOrganization, OrgRole } from "./useOrganization";

export const useOrgRole = () => {
  const { role, isLoading } = useOrganization();

  return {
    role: role as OrgRole | null,
    isLoading,
    isAdmin: role === 'admin',
    isOperator: role === 'operator',
    isViewer: role === 'viewer',
    canWrite: role === 'admin' || role === 'operator',
    canManageTeam: role === 'admin',
    canManageIntegrations: role === 'admin',
    canDeleteItems: role === 'admin',
  };
};
