import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";

const SESSION_START_KEY = "unistock_session_start";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasValidSession, registerLogin } = useAuthSession({ requireAuth: false });

  // Verificar sessão ativa ao carregar a página
  useEffect(() => {
    const checkExistingSession = async () => {
      setIsCheckingSession(true);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Verificar se a sessão ainda está dentro do limite de 6 horas
          const sessionStart = localStorage.getItem(SESSION_START_KEY);
          if (sessionStart) {
            const elapsed = Date.now() - parseInt(sessionStart, 10);
            const sixHoursMs = 6 * 60 * 60 * 1000;
            
            if (elapsed < sixHoursMs) {
              toast({
                title: "Sessão ativa detectada",
                description: "Redirecionando...",
              });
              
              // Aguardar um momento para mostrar a mensagem
              setTimeout(() => {
                navigate("/app/dashboard", { replace: true });
              }, 1000);
              return;
            } else {
              // Sessão expirou, limpar dados
              localStorage.removeItem(SESSION_START_KEY);
              await supabase.auth.signOut();
            }
          }
        }
      } catch (error) {
        console.error("Erro ao verificar sessão:", error);
      } finally {
        setIsCheckingSession(false);
      }
    };
    
    checkExistingSession();
  }, [navigate, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        // Registrar início da sessão de 6 horas
        registerLogin();
        
        // Primeiro verificar se é admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .maybeSingle();

        // Se for admin, libera acesso direto
        if (roleData?.role === 'admin') {
          toast({
            title: "Login realizado com sucesso!",
            description: "Bem-vindo, Admin! Sessão válida por 6 horas.",
          });
          navigate("/app/dashboard");
          return;
        }

        // Se não for admin, verificar se usuário tem assinatura ativa
        const { data: subscriptionData, error: subError } = await supabase.functions.invoke('check-subscription');
        
        if (subError) {
          console.error('Erro ao verificar assinatura:', subError);
        }

        // Se não tem assinatura ativa, redireciona para página de pagamento pendente
        if (!subscriptionData?.subscribed) {
          toast({
            title: "Complete seu pagamento",
            description: "Finalize seu pagamento para acessar o UniStock",
            variant: "default",
          });
          navigate("/pending-payment");
          return;
        }

        // Se tem assinatura, vai pro dashboard
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo ao UniStock! Sessão válida por 6 horas.",
        });
        navigate("/app/dashboard");
      }
    } catch (error) {
      toast({
        title: "Erro no login",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mostrar loading enquanto verifica sessão
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">Verificando sessão...</p>
        </div>
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
              <CardTitle className="text-2xl font-bold">UniStock</CardTitle>
              <CardDescription className="text-muted-foreground">
                Faça login em sua conta
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              <div className="flex justify-end">
                <Link 
                  to="/forgot-password" 
                  className="text-sm text-primary hover:underline"
                >
                  Esqueceu sua senha?
                </Link>
              </div>

              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-gradient-primary hover:bg-primary-hover"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Ainda não tem uma conta?{" "}
                <Link to="/signup" className="text-primary hover:underline font-medium">
                  Cadastre-se
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}