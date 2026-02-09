import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function TikTokShopCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        console.error('TikTok Shop authorization error:', error);
        toast({
          title: "Erro na autorização",
          description: "Não foi possível conectar com o TikTok Shop. Tente novamente.",
          variant: "destructive",
        });
        navigate('/app/integrations?status=error');
        return;
      }

      if (!code) {
        console.error('No authorization code received');
        toast({
          title: "Erro na autorização",
          description: "Código de autorização não recebido. Tente novamente.",
          variant: "destructive",
        });
        navigate('/app/integrations?status=error');
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          toast({
            title: "Erro de autenticação",
            description: "Você precisa estar logado para conectar integrações.",
            variant: "destructive",
          });
          navigate('/auth/login');
          return;
        }

        const { data, error: functionError } = await supabase.functions.invoke('tiktok-shop-auth', {
          body: {
            code,
            redirect_uri: `${window.location.origin}/callback/tiktokshop`
          }
        });

        if (functionError) {
          console.error('Edge function error:', functionError);
          
          // Check for duplicate account
          const contextBody = (functionError as any)?.context?.body;
          if (contextBody) {
            try {
              const parsed = typeof contextBody === 'string' ? JSON.parse(contextBody) : contextBody;
              if (parsed?.error === 'Conta já conectada') {
                navigate('/app/integrations?status=duplicate');
                return;
              }
            } catch {
              // ignore parse errors
            }
          }

          toast({
            title: "Erro na integração",
            description: "Não foi possível completar a integração. Tente novamente.",
            variant: "destructive",
          });
          navigate('/app/integrations?status=error');
          return;
        }

        toast({
          title: "Integração realizada com sucesso!",
          description: "TikTok Shop conectado ao seu UniStock.",
        });
        navigate('/app/integrations?status=success');

      } catch (error) {
        console.error('Unexpected error during callback processing:', error);
        toast({
          title: "Erro inesperado",
          description: "Ocorreu um erro durante a integração. Tente novamente.",
          variant: "destructive",
        });
        navigate('/app/integrations?status=error');
      } finally {
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [navigate, searchParams, toast]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6 animate-fade-in">
        <div className="flex justify-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Conectando com o TikTok Shop...
          </h1>
          <p className="text-muted-foreground">
            Aguarde enquanto configuramos sua integração
          </p>
        </div>
        <div className="flex justify-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
}