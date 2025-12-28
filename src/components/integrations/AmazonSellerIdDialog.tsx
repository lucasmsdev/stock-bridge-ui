import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, Loader2, Info, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AmazonSellerIdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  integrationId: string;
  currentSellerId?: string | null;
}

export function AmazonSellerIdDialog({
  open,
  onOpenChange,
  onSuccess,
  integrationId,
  currentSellerId,
}: AmazonSellerIdDialogProps) {
  const [sellerId, setSellerId] = useState(currentSellerId || "");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const validateSellerId = (id: string): boolean => {
    // Seller ID starts with 'A' and has 10-14 alphanumeric characters
    const pattern = /^A[A-Z0-9]{9,13}$/;
    return pattern.test(id.trim().toUpperCase());
  };

  const handleSubmit = async () => {
    const trimmedId = sellerId.trim().toUpperCase();

    if (!trimmedId) {
      toast({
        title: "Seller ID obrigatório",
        description: "Digite o Seller ID da sua conta Amazon.",
        variant: "destructive",
      });
      return;
    }

    if (!validateSellerId(trimmedId)) {
      toast({
        title: "Seller ID inválido",
        description: "O Seller ID deve começar com 'A' seguido de 10-13 caracteres alfanuméricos.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from("integrations")
        .update({ selling_partner_id: trimmedId })
        .eq("id", integrationId);

      if (error) {
        throw error;
      }

      toast({
        title: "Seller ID salvo!",
        description: "Agora você pode sincronizar preços e estoque com a Amazon.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving Seller ID:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar o Seller ID.",
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
            Configurar Seller ID Amazon
          </DialogTitle>
          <DialogDescription>
            O Seller ID é necessário para sincronizar preços e estoque com a Amazon.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="border-primary/20 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <strong>Onde encontrar o Seller ID:</strong>
              <ol className="mt-2 space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Acesse o <a 
                  href="https://sellercentral.amazon.com.br/hz/sc/account-information" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Amazon Seller Central <ExternalLink className="w-3 h-3" />
                </a></li>
                <li>Vá em <strong>Configurações</strong> → <strong>Informações da conta</strong></li>
                <li>Copie o <strong>"Merchant Token"</strong> ou <strong>"Seller ID"</strong></li>
              </ol>
              <p className="mt-2 text-xs">
                O ID começa com "A" e tem aproximadamente 14 caracteres (ex: A251067YXRBAPB)
              </p>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="sellerId">Seller ID (Merchant Token)</Label>
            <Input
              id="sellerId"
              placeholder="Ex: A251067YXRBAPB"
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value.toUpperCase())}
              className="font-mono"
              maxLength={20}
            />
            {sellerId && validateSellerId(sellerId) && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Formato válido
              </p>
            )}
            {sellerId && !validateSellerId(sellerId) && sellerId.length >= 3 && (
              <p className="text-sm text-destructive">
                Formato inválido. O ID deve começar com "A" seguido de 10-13 caracteres.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !sellerId.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Seller ID"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
