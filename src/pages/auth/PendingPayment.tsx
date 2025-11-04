import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CreditCard, LogOut, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function PendingPayment() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);

  // Verificar se usuário já tem assinatura ativa OU se é admin
  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      // Primeiro verificar se é admin
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        // Se for admin, redireciona direto pro dashboard
        if (roleData?.role === 'admin') {
          toast({
            title: "✅ Acesso Admin",
            description: "Bem-vindo de volta!",
          });
          navigate('/dashboard');
          return;
        }
      }

      // Se não for admin, verificar assinatura normal
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Erro ao verificar assinatura:', error);
        setIsCheckingSubscription(false);
        return;
      }

      // Se tem assinatura ativa, redireciona pro dashboard
      if (data?.subscribed) {
        toast({
          title: "✅ Pagamento confirmado!",
          description: "Redirecionando para o dashboard...",
        });
        navigate('/dashboard');
        return;
      }

      setIsCheckingSubscription(false);
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
      setIsCheckingSubscription(false);
    }
  };

  const handleContinueToCheckout = async () => {
    setIsLoading(true);
    
    try {
      // Redireciona para o plano profissional (mais popular)
      navigate('/checkout?plan=profissional');
    } catch (error) {
      console.error('Erro ao redirecionar:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleChoosePlan = () => {
    navigate('/#planos');
  };

  if (isCheckingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando seu status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-lg border-2 shadow-xl">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="mx-auto p-4 rounded-full bg-warning/10 w-fit">
            <AlertCircle className="h-12 w-12 text-warning" />
          </div>
          
          <div>
            <CardTitle className="text-3xl font-bold mb-2">
              Complete seu Pagamento
            </CardTitle>
            <CardDescription className="text-base">
              Você está quase lá! Falta apenas finalizar o pagamento para começar a usar o UniStock.
            </CardDescription>
          </div>

          <Badge variant="outline" className="mx-auto px-4 py-2 text-sm border-warning/30 text-warning bg-warning/5">
            <CreditCard className="w-4 h-4 mr-2" />
            Pagamento pendente
          </Badge>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h3 className="font-semibold text-sm text-foreground">O que você está perdendo:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Rocket className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Dashboard completo com todas suas vendas unificadas</span>
              </li>
              <li className="flex items-start gap-2">
                <Rocket className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Sincronização automática de estoque em tempo real</span>
              </li>
              <li className="flex items-start gap-2">
                <Rocket className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Análise de lucro e relatórios detalhados</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleContinueToCheckout}
              disabled={isLoading}
              className="w-full h-12 text-base font-semibold bg-accent hover:bg-accent/90 group"
              size="lg"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processando...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-5 w-5" />
                  Continuar para o Pagamento
                </>
              )}
            </Button>

            <Button
              onClick={handleChoosePlan}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Ver Todos os Planos
            </Button>

            <div className="text-center pt-4">
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair da conta
              </Button>
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-muted-foreground">
              💳 Pagamento 100% seguro via Stripe
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              🎁 7 dias grátis para testar sem compromisso
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
