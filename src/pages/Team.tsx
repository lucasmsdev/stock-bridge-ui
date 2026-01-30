import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgRole } from "@/hooks/useOrgRole";
import { usePlan } from "@/hooks/usePlan";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Users, AlertTriangle } from "lucide-react";
import { TeamMembersList } from "@/components/team/TeamMembersList";
import { ActiveInvitesList } from "@/components/team/ActiveInvitesList";
import { InviteCodeDialog } from "@/components/team/InviteCodeDialog";
import { Navigate } from "react-router-dom";

const Team = () => {
  const { user } = useAuth();
  const { currentPlan } = usePlan();
  const { isAdmin, isLoading: roleLoading } = useOrgRole();
  const {
    organization,
    organizationId,
    members,
    invites,
    isLoading,
    membersLoading,
    invitesLoading,
    removeMember,
    updateMemberRole,
    revokeInvite,
  } = useOrganization();

  // Redireciona se não for admin
  if (!roleLoading && !isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (isLoading || roleLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!organization || !organizationId) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Não foi possível carregar os dados da organização.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Equipe</h1>
          <p className="text-muted-foreground">
            Gerencie os membros da sua organização
          </p>
        </div>
        <InviteCodeDialog organizationId={organizationId} />
      </div>

      {/* Organization Info Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organização</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organization.name}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="capitalize">
                Plano {organization.plan}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {invites.length > 0 && `${invites.length} convite${invites.length > 1 ? 's' : ''} pendente${invites.length > 1 ? 's' : ''}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Members List */}
      <TeamMembersList
        members={members}
        currentUserId={user?.id || ''}
        ownerId={organization.owner_id}
        onRemoveMember={async (memberId) => {
          await removeMember.mutateAsync(memberId);
        }}
        onUpdateRole={async (memberId, role) => {
          await updateMemberRole.mutateAsync({ memberId, role });
        }}
        isLoading={membersLoading}
      />

      {/* Active Invites */}
      <ActiveInvitesList
        invites={invites}
        onRevoke={async (inviteId) => {
          await revokeInvite.mutateAsync(inviteId);
        }}
        isLoading={invitesLoading}
      />
    </div>
  );
};

export default Team;
