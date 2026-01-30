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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OrgRole } from "@/hooks/useOrganization";

interface InviteCodeDialogProps {
  organizationId: string;
}

export const InviteCodeDialog = ({ organizationId }: InviteCodeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<OrgRole>("operator");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const createInvite = useMutation({
    mutationFn: async () => {
      const code = generateCode();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('organization_invites')
        .insert({
          organization_id: organizationId,
          code,
          role,
          created_by: user.id,
        });

      if (error) throw error;
      return code;
    },
    onSuccess: (code) => {
      setGeneratedCode(code);
      queryClient.invalidateQueries({ queryKey: ['organization-invites'] });
      toast({
        title: "Código gerado!",
        description: "Compartilhe este código com o novo membro.",
      });
    },
    onError: (error) => {
      console.error('Erro ao criar convite:', error);
      toast({
        title: "Erro ao gerar código",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    },
  });

  const handleCopy = async () => {
    if (generatedCode) {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copiado!",
        description: "Código copiado para a área de transferência.",
      });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setGeneratedCode(null);
      setRole("operator");
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Gerar Código de Convite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar Membro</DialogTitle>
          <DialogDescription>
            Gere um código de convite para adicionar um novo membro à sua equipe.
          </DialogDescription>
        </DialogHeader>

        {!generatedCode ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Papel do novo membro</Label>
              <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">
                    <div className="flex flex-col">
                      <span className="font-medium">Operador</span>
                      <span className="text-xs text-muted-foreground">
                        Pode criar e editar produtos, pedidos e fornecedores
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex flex-col">
                      <span className="font-medium">Visualizador</span>
                      <span className="text-xs text-muted-foreground">
                        Acesso somente leitura a todos os dados
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-sm text-muted-foreground">
              O código será válido por 7 dias. O novo membro poderá usá-lo ao fazer cadastro ou no perfil.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Código de Convite</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={generatedCode}
                  readOnly
                  className="font-mono text-lg tracking-widest text-center"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Compartilhe este código com o novo membro. Ele poderá usá-lo para entrar na sua equipe.
            </p>
          </div>
        )}

        <DialogFooter>
          {!generatedCode ? (
            <Button
              onClick={() => createInvite.mutate()}
              disabled={createInvite.isPending}
            >
              {createInvite.isPending ? "Gerando..." : "Gerar Código"}
            </Button>
          ) : (
            <Button onClick={() => handleOpenChange(false)}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
