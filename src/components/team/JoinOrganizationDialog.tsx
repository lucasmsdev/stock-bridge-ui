import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface JoinOrganizationDialogProps {
  trigger?: React.ReactNode;
}

export const JoinOrganizationDialog = ({ trigger }: JoinOrganizationDialogProps) => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const joinOrganization = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Chamar edge function para processar o convite
      const { data, error } = await supabase.functions.invoke('manage-organization', {
        body: { action: 'join', code: code.toUpperCase().replace(/\s/g, '') },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao processar convite');

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({
        title: "Bem-vindo à equipe!",
        description: `Você entrou na organização "${data.organization.name}" como ${data.role === 'operator' ? 'Operador' : 'Visualizador'}.`,
      });
      setOpen(false);
      setCode("");
      // Recarregar página para atualizar contexto
      window.location.reload();
    },
    onError: (error: Error) => {
      console.error('Erro ao usar convite:', error);
      toast({
        title: "Código inválido",
        description: error.message || "Verifique o código e tente novamente.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Users className="h-4 w-4 mr-2" />
            Usar Código de Convite
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Entrar em uma Equipe</DialogTitle>
          <DialogDescription>
            Digite o código de convite que você recebeu para entrar em uma organização.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="invite-code">Código de Convite</Label>
            <Input
              id="invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC12345"
              className="font-mono text-lg tracking-widest text-center uppercase"
              maxLength={8}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            ⚠️ Ao usar este código, você irá sair da sua organização atual e entrar na nova equipe.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => joinOrganization.mutate()}
            disabled={code.length !== 8 || joinOrganization.isPending}
          >
            {joinOrganization.isPending ? "Entrando..." : "Entrar na Equipe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
