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
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TikTokSandboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TikTokSandboxDialog({ open, onOpenChange, onSuccess }: TikTokSandboxDialogProps) {
  const [accessToken, setAccessToken] = useState("");
  const [advertiserId, setAdvertiserId] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    if (!accessToken.trim() || !advertiserId.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o Access Token e o Advertiser ID.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        `https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/tiktok-ads-auth`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjdndvZ2FxYXJrdXF2dW15cXFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjM2MDAsImV4cCI6MjA3MjU5OTYwMH0.NNf4sIZNSwFyNXFPUlNRxAl5mz0TJ0Rd5FR3mtMWxuo",
          },
          body: JSON.stringify({
            access_token: accessToken.trim(),
            advertiser_id: advertiserId.trim(),
            user_id: user.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Falha ao salvar integração");
      }

      toast({
        title: "TikTok Ads conectado!",
        description: "Integração sandbox configurada com sucesso.",
      });

      setAccessToken("");
      setAdvertiserId("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao conectar TikTok Ads sandbox:", error);
      toast({
        title: "Erro ao conectar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar TikTok Ads (Sandbox)</DialogTitle>
          <DialogDescription>
            Cole o Access Token e o Advertiser ID do painel de desenvolvedor do TikTok.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="access-token">Access Token</Label>
            <Input
              id="access-token"
              placeholder="Cole o access token aqui"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="advertiser-id">Advertiser ID</Label>
            <Input
              id="advertiser-id"
              placeholder="Ex: 7604988152943558664"
              value={advertiserId}
              onChange={(e) => setAdvertiserId(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConnect} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Conectar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
