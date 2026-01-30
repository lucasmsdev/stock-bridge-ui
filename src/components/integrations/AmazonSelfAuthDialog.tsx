import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ExternalLink, Key, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AmazonSelfAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AmazonSelfAuthDialog({ open, onOpenChange, onSuccess }: AmazonSelfAuthDialogProps) {
  const [refreshToken, setRefreshToken] = useState("");
  const [accountName, setAccountName] = useState("");
  const [sellerId, setSellerId] = useState("");
  const marketplaceId = "A2Q3Y263D00KWC"; // Brasil - app exclusivo para brasileiros
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!refreshToken.trim()) {
      toast({
        title: "Token obrigatório",
        description: "Por favor, insira o Refresh Token da sua conta Amazon.",
        variant: "destructive",
      });
      return;
    }

    if (!sellerId.trim()) {
      toast({
        title: "Seller ID obrigatório",
        description: "Por favor, insira o Seller ID da sua conta Amazon.",
        variant: "destructive",
      });
      return;
    }

    // Validate Seller ID format (starts with A followed by alphanumeric)
    if (!/^A[A-Z0-9]{10,}$/i.test(sellerId.trim())) {
      toast({
        title: "Seller ID inválido",
        description: "O Seller ID deve começar com 'A' seguido de letras e números (ex: A3XXXXXXXXXX).",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Faça login para conectar integrações.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("amazon-self-auth", {
        body: {
          refresh_token: refreshToken.trim(),
          seller_id: sellerId.trim().toUpperCase(),
          account_name: accountName.trim() || undefined,
          marketplace_id: marketplaceId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Erro no self-auth:", error);
        toast({
          title: "Erro na conexão",
          description: error.message || "Não foi possível conectar sua conta Amazon.",
          variant: "destructive",
        });
        return;
      }

      if (data?.error) {
        toast({
          title: "Erro na validação",
          description: data.details || data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Conta conectada!",
        description: `Sua conta Amazon foi conectada com sucesso: ${data.account_name}`,
      });

      setRefreshToken("");
      setSellerId("");
      setAccountName("");
      onOpenChange(false);
      onSuccess();

    } catch (err) {
      console.error("Erro inesperado:", err);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao conectar sua conta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Conectar Amazon (Self-Authorization)
          </DialogTitle>
          <DialogDescription>
            Use Self-Authorization para conectar sua própria conta Amazon enquanto seu app aguarda aprovação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Como obter as informações:</strong>
              <ol className="list-decimal ml-4 mt-2 space-y-1">
                <li>Acesse o <a href="https://sellercentral.amazon.com/apps/manage" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  Amazon Seller Central <ExternalLink className="h-3 w-3" />
                </a></li>
                <li>Encontre seu app e clique em <strong>"Authorize"</strong></li>
                <li>Selecione os marketplaces desejados</li>
                <li>Copie o <strong>Refresh Token</strong> gerado</li>
                <li>Para o Seller ID, vá em <a href="https://sellercentral.amazon.com/sw/AccountInfo/MerchantToken/step/MerchantToken" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  Configurações → Informações da Conta → Informações do Vendedor <ExternalLink className="h-3 w-3" />
                </a></li>
                <li>Copie o <strong>"ID do comerciante"</strong> (começa com A)</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="refresh-token">Refresh Token *</Label>
            <Textarea
              id="refresh-token"
              placeholder="Atzr|IQEBLjAsAhRmHjNgHpi0U-Dme37rR6..."
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              className="min-h-[100px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Cole o Refresh Token completo gerado no Amazon Seller Central
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seller-id">Seller ID (ID do Comerciante) *</Label>
            <Input
              id="seller-id"
              placeholder="A3XXXXXXXXXX"
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value.toUpperCase())}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Encontre em: Seller Central → Configurações → Informações da Conta → "ID do comerciante"
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="marketplace">Marketplace</Label>
            <Input
              id="marketplace"
              value="Brasil (Amazon.com.br)"
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Ao autorizar o app no Seller Central, marque o marketplace do Brasil.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-name">Nome da conta (opcional)</Label>
            <Input
              id="account-name"
              placeholder="Ex: Minha Loja Amazon"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Um nome para identificar esta conta no UniStock
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !refreshToken.trim() || !sellerId.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Conectando...
              </>
            ) : (
              "Conectar Conta"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
