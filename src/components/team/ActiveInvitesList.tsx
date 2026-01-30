import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Trash2, Copy, Clock, Loader2 } from "lucide-react";
import { OrganizationInvite } from "@/hooks/useOrganization";
import { RoleBadge } from "./RoleBadge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActiveInvitesListProps {
  invites: OrganizationInvite[];
  onRevoke: (inviteId: string) => Promise<void>;
  isLoading?: boolean;
}

export const ActiveInvitesList = ({ invites, onRevoke, isLoading }: ActiveInvitesListProps) => {
  const { toast } = useToast();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast({
      title: "Copiado!",
      description: "Código copiado para a área de transferência.",
    });
  };

  const handleRevoke = async (inviteId: string) => {
    setRevokingId(inviteId);
    try {
      await onRevoke(inviteId);
      toast({
        title: "Convite revogado",
        description: "O código de convite foi invalidado.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível revogar o convite.",
        variant: "destructive",
      });
    } finally {
      setRevokingId(null);
    }
  };

  if (invites.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Convites Ativos</CardTitle>
        <CardDescription>
          Códigos de convite pendentes que ainda não foram utilizados
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <code className="text-lg font-mono tracking-widest bg-muted px-3 py-1 rounded">
                      {invite.code}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(invite.code)}
                      className="h-8 w-8"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <RoleBadge role={invite.role} />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      Expira {formatDistanceToNow(new Date(invite.expires_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={revokingId === invite.id}
                      >
                        {revokingId === invite.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revogar convite?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O código {invite.code} será invalidado e não poderá mais ser utilizado.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRevoke(invite.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Revogar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
