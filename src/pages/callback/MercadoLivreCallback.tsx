import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function MercadoLivreCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      // Check for authorization errors
      if (error) {
        console.error('Mercado Livre authorization error:', error);
        toast({
          title: "Erro na autorização",
          description: "Não foi possível conectar com o Mercado Livre. Tente novamente.",
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
        // Get current session
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

        // Call the mercadolivre-auth edge function
        const { data, error: functionError } = await supabase.functions.invoke('mercadolivre-auth', {
          body: {
            code,
            redirect_uri: `${window.location.origin}/callback/mercadolivre`
          }
        });

        if (functionError) {
          console.error('Edge function error:', functionError);
          toast({
            title: "Erro na integração",
            description: "Não foi possível completar a integração. Tente novamente.",
            variant: "destructive",
          });
        navigate('/app/integrations?status=error');
          return;
        }

        // Success
        toast({
          title: "Integração realizada com sucesso!",
          description: "Mercado Livre conectado ao seu UniStock.",
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
        {/* Loading icon with spin animation */}
        <div className="flex justify-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </div>
        
        {/* Loading text */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Conectando com o Mercado Livre...
          </h1>
          <p className="text-muted-foreground">
            Aguarde enquanto configuramos sua integração
          </p>
        </div>

        {/* Progress indicator dots */}
        <div className="flex justify-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
}