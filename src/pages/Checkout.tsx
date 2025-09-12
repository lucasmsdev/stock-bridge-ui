import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function Checkout() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const selectedPlan = searchParams.get('plan') || 'estrategista';

  // Verificar se o plano é válido
  useEffect(() => {
    if (!['estrategista', 'competidor', 'dominador'].includes(selectedPlan)) {
      navigate('/');
      return;
    }
  }, [selectedPlan, navigate]);

  // Se usuário já está logado, processar checkout imediatamente
  useEffect(() => {
    if (user && !isProcessingCheckout) {
      // Aguardar um pouco para garantir que a autenticação está completa
      const timer = setTimeout(() => {
        handleCheckoutForLoggedUser();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [user]);

  const planDetails = {
    estrategista: { name: 'Estrategista', price: 'R$ 97', description: 'Tome decisões de preço com base em dados' },
    competidor: { name: 'Competidor', price: 'R$ 147', description: 'Reaja à concorrência em tempo real' },
    dominador: { name: 'Dominador', price: 'R$ 197', description: 'Automatize sua competitividade' }
  };

  const currentPlan = planDetails[selectedPlan as keyof typeof planDetails];

  const handleCheckoutForLoggedUser = async () => {
    if (isProcessingCheckout) return; // Prevenir múltiplas execuções
    
    setIsProcessingCheckout(true);
    
    try {
      console.log('Starting checkout for logged user with plan:', selectedPlan);
      console.log('User details:', { id: user?.id, email: user?.email });
      
      // Verificar se o usuário tem sessão ativa
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('Sessão de usuário não encontrada. Faça login novamente.');
      }
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { planType: selectedPlan }
      });

      console.log('Checkout response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Erro na função de checkout');
      }

      if (data?.url) {
        console.log('Redirecting to Stripe URL:', data.url);
        window.open(data.url, '_blank');
        navigate('/billing');
      } else {
        throw new Error('URL de checkout não foi retornada pelo servidor');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      
      let errorMessage = 'Erro desconhecido';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "❌ Erro no checkout",
        description: `Erro: ${errorMessage}. Tente fazer login novamente ou contate o suporte.`,
        variant: "destructive",
      });
      
      // Se for erro de autenticação, redirecionar para login
      if (errorMessage.includes('sessão') || errorMessage.includes('authentication')) {
        setTimeout(() => {
          navigate(`/login?checkout=${selectedPlan}`);
        }, 2000);
      }
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  const handleSignupAndCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.password) {
      toast({
        title: "❌ Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/app`;
      
      const { data: authData, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: formData.name,
            plan: selectedPlan,
          },
        },
      });

      if (error) {
        console.error("Signup error:", error);
        
        if (error.message.includes("User already registered")) {
          toast({
            title: "❌ Usuário já existe",
            description: "Este email já está cadastrado. Redirecionando para login...",
            variant: "destructive",
          });
          setTimeout(() => navigate(`/login?checkout=${selectedPlan}`), 2000);
        } else {
          toast({
            title: "❌ Erro no cadastro",
            description: error.message || "Ocorreu um erro ao criar sua conta.",
            variant: "destructive",
          });
        }
        return;
      }

      if (authData.user) {
        toast({
          title: "✅ Conta criada!",
          description: "Redirecionando para o checkout...",
        });

        // Aguardar um pouco para garantir que a sessão foi criada
        setTimeout(async () => {
          try {
            const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-checkout', {
              body: { planType: selectedPlan }
            });

            if (checkoutError) throw checkoutError;

            if (checkoutData?.url) {
              window.open(checkoutData.url, '_blank');
              navigate('/billing');
            }
          } catch (checkoutError) {
            console.error('Checkout error:', checkoutError);
            toast({
              title: "❌ Erro no checkout",
              description: "Conta criada, mas erro no checkout. Tente novamente no dashboard.",
              variant: "destructive",
            });
            navigate('/app');
          }
        }, 2000);
      }
    } catch (error) {
      console.error("Unexpected signup error:", error);
      toast({
        title: "❌ Erro inesperado",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // Se usuário já está logado, mostrar loading
  if (user) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-medium">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center">
              <Loader2 className="text-primary-foreground h-8 w-8 animate-spin" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Processando upgrade...</CardTitle>
              <CardDescription className="text-muted-foreground">
                Você está fazendo upgrade para o plano <strong>{currentPlan.name}</strong>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-center">
            <Badge variant="secondary" className="text-sm mb-4">
              {currentPlan.name} - {currentPlan.price}/mês
            </Badge>
            <p className="text-sm text-muted-foreground">
              Redirecionando para o checkout...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <Card className="shadow-medium">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-2xl">U</span>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Finalizar Assinatura</CardTitle>
              <CardDescription className="text-muted-foreground">
                Crie sua conta e inicie seu teste de 3 dias grátis
              </CardDescription>
              <div className="flex justify-center mt-4">
                <Badge variant="secondary" className="text-sm">
                  Plano selecionado: {currentPlan.name} - {currentPlan.price}/mês
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSignupAndCheckout} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Seu nome completo"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite uma senha segura"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Teste gratuito de 3 dias</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Sem cobrança nos primeiros 3 dias. Cancele quando quiser.
                </p>
              </div>

              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-gradient-primary hover:bg-primary-hover"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  "Criar Conta e Iniciar Teste"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Já tem uma conta?{" "}
                <a 
                  href={`/login?checkout=${selectedPlan}`} 
                  className="text-primary hover:underline font-medium"
                >
                  Faça login
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}