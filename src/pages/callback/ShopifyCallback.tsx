import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function ShopifyCallback() {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    handleShopifyCallback();
  }, []);

  const handleShopifyCallback = async () => {
    try {
      const code = searchParams.get('code');
      const shop = searchParams.get('shop');
      const state = searchParams.get('state');

      if (!code || !shop) {
        setError('Parâmetros de autorização inválidos');
        setLoading(false);
        return;
      }

      console.log('Processing Shopify callback with code:', code, 'and shop:', shop);

      // Get the current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('No active session:', sessionError);
        setError('Sessão expirada. Por favor, faça login novamente.');
        setLoading(false);
        return;
      }

      // Call the Shopify auth edge function
      const { data: result, error: authError } = await supabase.functions.invoke('shopify-auth', {
        body: { code, shop, state },
      });

      if (authError) {
        console.error('Error calling shopify-auth function:', authError);
        setError('Erro ao processar autorização do Shopify');   
        setLoading(false);
        return;
      }

      if (result?.error) {
        console.error('Error from shopify-auth function:', result.error);
        setError(result.error);
        setLoading(false);
        return;
      }

      console.log('Shopify integration successful:', result);
      setSuccess(true);
      
      toast({
        title: "Integração realizada com sucesso!",
        description: `Sua loja Shopify ${shop} foi conectada ao UniStock.`,
      });

      // Redirect to integrations page after a short delay
      setTimeout(() => {
        navigate('/app/integrations');
      }, 2000);

    } catch (error) {
      console.error('Unexpected error during Shopify callback:', error);
      setError('Erro inesperado durante a autorização');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    navigate('/app/integrations');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <h3 className="text-lg font-semibold">Conectando ao Shopify</h3>
                <p className="text-sm text-muted-foreground">
                  Processando sua autorização...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-green-700">
                  Shopify Conectado!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Sua loja foi integrada com sucesso. Redirecionando...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle className="text-destructive">Erro na Integração</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <CardDescription className="text-center">
              {error}
            </CardDescription>
            <Button onClick={handleRetry} className="w-full">
              Voltar às Integrações
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}