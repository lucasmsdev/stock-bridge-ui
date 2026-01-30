import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Crown, Loader2 } from "lucide-react";
import { OrganizationMember, OrgRole } from "@/hooks/useOrganization";
import { RoleBadge } from "./RoleBadge";
import { useToast } from "@/hooks/use-toast";

interface TeamMembersListProps {
  members: OrganizationMember[];
  currentUserId: string;
  ownerId: string;
  onRemoveMember: (memberId: string) => Promise<void>;
  onUpdateRole: (memberId: string, role: OrgRole) => Promise<void>;
  isLoading?: boolean;
}

export const TeamMembersList = ({
  members,
  currentUserId,
  ownerId,
  onRemoveMember,
  onUpdateRole,
  isLoading,
}: TeamMembersListProps) => {
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { toast } = useToast();

  const getUserInitials = (email: string, fullName?: string | null) => {
    if (fullName) {
      return fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const handleRoleChange = async (memberId: string, newRole: OrgRole) => {
    setUpdatingRoleId(memberId);
    try {
      await onUpdateRole(memberId, newRole);
      toast({
        title: "Papel atualizado",
        description: "O papel do membro foi atualizado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o papel do membro.",
        variant: "destructive",
      });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      await onRemoveMember(memberId);
      toast({
        title: "Membro removido",
        description: "O membro foi removido da equipe.",
      });
    } catch (error) {
      toast({
        title: "Erro ao remover",
        description: "Não foi possível remover o membro.",
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Membros da Equipe</CardTitle>
        <CardDescription>
          {members.length} {members.length === 1 ? 'membro' : 'membros'} na organização
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {members.map((member) => {
            const isOwner = member.user_id === ownerId;
            const isCurrentUser = member.user_id === currentUserId;
            const canModify = !isOwner && !isCurrentUser;

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getUserInitials(
                        member.profiles?.email || '',
                        member.profiles?.full_name
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {member.profiles?.full_name || member.profiles?.email?.split('@')[0] || 'Usuário'}
                      </span>
                      {isOwner && (
                        <Badge variant="outline" className="text-xs">
                          <Crown className="h-3 w-3 mr-1" />
                          Dono
                        </Badge>
                      )}
                      {isCurrentUser && (
                        <Badge variant="secondary" className="text-xs">
                          Você
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {member.profiles?.email}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canModify ? (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleRoleChange(member.id, value as OrgRole)}
                        disabled={updatingRoleId === member.id}
                      >
                        <SelectTrigger className="w-[140px]">
                          {updatingRoleId === member.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="operator">Operador</SelectItem>
                          <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={removingId === member.id}
                          >
                            {removingId === member.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {member.profiles?.full_name || member.profiles?.email} será removido da equipe e perderá acesso aos dados da organização.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemove(member.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
