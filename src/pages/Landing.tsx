import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { 
  ArrowRight, 
  CheckCircle, 
  TrendingUp, 
  BarChart3, 
  Zap, 
  Shield, 
  Users, 
  Clock,
  X,
  Smartphone,
  Globe,
  Calculator,
  Sparkles,
  Rocket
} from "lucide-react";

const Landing = () => {
  const plans = [
    {
      name: "Iniciante",
      price: "R$ 97",
      period: "/mês",
      description: "Pra quem tá começando a vender em múltiplas plataformas",
      popular: false,
      features: [
        "Até 100 produtos",
        "2 integrações (ML, Shopee, Amazon ou Shopify)",
        "Sincronização de estoque em tempo real",
        "Dashboard básico",
        "Suporte por WhatsApp"
      ],
      limitations: []
    },
    {
      name: "Profissional",
      price: "R$ 197",
      period: "/mês",
      description: "Mais vendido. Pra quem quer escalar sem perder o controle",
      popular: true,
      features: [
        "Até 500 produtos",
        "Todas as integrações (ML, Shopee, Amazon, Shopify)",
        "Sincronização em tempo real",
        "Dashboard completo + análise de lucro",
        "Alertas de estoque baixo",
        "Relatórios semanais",
        "Suporte prioritário no WhatsApp"
      ],
      limitations: []
    },
    {
      name: "Enterprise",
      price: "R$ 297",
      period: "/mês",
      description: "Pra quem vende muito e precisa de análise avançada",
      popular: false,
      features: [
        "Até 1000 produtos",
        "Todas as integrações",
        "Sincronização em tempo real",
        "Dashboard avançado + IA",
        "Análise de concorrência",
        "Relatórios personalizados",
        "Suporte prioritário"
      ],
      limitations: []
    },
    {
      name: "Unlimited",
      price: "R$ 397",
      period: "/mês",
      description: "Produtos ilimitados + API e automação completa",
      popular: false,
      features: [
        "Produtos ilimitados",
        "Todas as integrações",
        "Sincronização em tempo real",
        "Dashboard avançado + IA",
        "Análise de concorrência",
        "Relatórios personalizados",
        "Acesso à API",
        "Automação completa",
        "Gerente de conta dedicado"
      ],
      limitations: []
    }
  ];

  const problems = [
    {
      icon: X,
      title: "4 abas abertas = erro garantido",
      description: "Vendeu na Shopee mas esqueceu de baixar no ML. Cliente compra produto sem estoque."
    },
    {
      icon: Clock,
      title: "3 horas por dia copiando e colando",
      description: "Atualizou preço no ML. Agora tem que copiar pra Shopee, Amazon, Shopify..."
    },
    {
      icon: BarChart3,
      title: "Tá vendendo mas não sabe se tá lucrando",
      description: "Vende R$ 30k/mês mas não sabe qual produto dá lucro de verdade."
    }
  ];

  const solutions = [
    {
      icon: Zap,
      title: "Uma aba. Todas as vendas.",
      description: "Vendeu em qualquer lugar? Estoque atualiza em todos os canais. Automático."
    },
    {
      icon: TrendingUp,
      title: "Muda preço uma vez só",
      description: "Atualiza em um lugar, sincroniza em todos. 3 minutos vs 3 horas."
    },
    {
      icon: BarChart3,
      title: "Sabe exatamente o que lucra",
      description: "Dashboard mostra lucro real de cada produto. Não faturamento. Lucro mesmo."
    }
  ];

  const features = [
    {
      icon: Globe,
      title: "Mercado Livre + Shopee + Amazon + Shopify",
      description: "Todas as suas vendas num lugar só. Sem pular de aba em aba."
    },
    {
      icon: Zap,
      title: "Estoque sincronizado automático",
      description: "Vendeu? Atualiza em todos os canais na hora. Zero vendas fantasma."
    },
    {
      icon: Calculator,
      title: "Calculadora de lucro real",
      description: "Desconta taxas, frete, custos. Mostra o que sobra no bolso."
    },
    {
      icon: Smartphone,
      title: "Dashboard que não precisa de manual",
      description: "Abriu, já entendeu. Sem complicação, sem treinamento."
    },
    {
      icon: Shield,
      title: "Seus dados protegidos",
      description: "Backup automático. Você não perde nada se o computador pifar."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header with Theme Toggle */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="font-bold text-xl text-foreground">UniStock</div>
            <div className="flex items-center space-x-4">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Entrar
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 pt-24 sm:pt-32 pb-12 sm:pb-16 mx-auto max-w-7xl sm:px-6 lg:px-8 overflow-hidden">
        {/* Background gradient effects */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="text-center animate-fade-in">
          {/* Trust badge */}
          <Badge variant="outline" className="mb-6 px-4 py-2 text-sm sm:text-base border-accent/30 text-accent bg-accent/5 hover:bg-accent/10">
            <Users className="w-4 h-4 mr-2" />
            347 vendedores economizam 3h/dia com UniStock
          </Badge>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight text-foreground leading-tight">
            4 abas abertas pra gerenciar vendas?{" "}
            <span className="bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent animate-gradient">
              Acabou.
            </span>
          </h1>
          
          <p className="mx-auto mt-4 sm:mt-6 max-w-3xl text-base sm:text-lg lg:text-xl leading-7 sm:leading-8 text-muted-foreground px-4">
            Gerencia ML, Shopee, Amazon e Shopify? Para de pular de plataforma em plataforma. 
            <strong className="text-foreground"> Um painel. Todas as vendas. Estoque sincronizado.</strong>
          </p>
          
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
            <a href="#planos" className="w-full sm:w-auto">
              <Button 
                size="lg" 
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-10 text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 bg-accent hover:bg-accent/90 text-accent-foreground group"
              >
                <Rocket className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                Testar grátis por 7 dias
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </a>
            <Link to="/login" className="w-full sm:w-auto">
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-10 text-base sm:text-lg font-semibold border-2 hover:bg-accent/5 hover:border-accent/50 transition-all duration-300"
              >
                Já tenho conta
              </Button>
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-muted-foreground px-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              <span>7 dias grátis</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              <span>Cancela quando quiser</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              <span>Configura em 5 min</span>
            </div>
          </div>
        </div>

        <div className="mt-12 sm:mt-16 relative animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="mx-auto max-w-6xl px-4">
            {/* Glow effect */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent blur-3xl transform translate-y-1/2" />
            </div>
            
            <div 
              className="relative rounded-xl overflow-hidden shadow-2xl group transition-all duration-700 ease-out hover:shadow-[0_35px_60px_-15px_rgba(var(--primary)/0.5)] hover:scale-[1.02] hover:-translate-y-2 border border-border/50"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                transform: 'perspective(1500px) rotateX(3deg)'
              }}
            >
              <img
                src="/images/dashboard-hover-preview.png"
                alt="Dashboard do UniStock mostrando métricas de vendas e lucratividade em tempo real"
                className="w-full h-auto transition-all duration-700 ease-out group-hover:brightness-110"
                style={{
                  display: 'block',
                  borderRadius: '0.75rem'
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              
              {/* Floating badge */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <Badge className="bg-success text-success-foreground shadow-lg">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +47% vendas
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section className="py-16 bg-muted/30 dark:bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 px-4 py-2 text-sm border-destructive/30 text-destructive bg-destructive/5">
              <X className="w-4 h-4 mr-2" />
              Se identifica com isso?
            </Badge>
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              O caos de vender em 4 plataformas ao mesmo tempo
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {problems.map((problem, index) => (
              <Card key={index} className="text-center border-destructive/20 dark:border-destructive/30 hover:border-destructive/40 transition-all">
                <CardContent className="p-6">
                  <problem.icon className="h-12 w-12 mx-auto text-destructive mb-4" />
                  <h3 className="font-semibold text-foreground mb-2">{problem.title}</h3>
                  <p className="text-muted-foreground text-sm">{problem.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 px-4 py-2 text-sm border-success/30 text-success bg-success/5">
              <CheckCircle className="w-4 h-4 mr-2" />
              A solução é simples
            </Badge>
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              UniStock resolve tudo isso em um só lugar
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {solutions.map((solution, index) => (
              <Card key={index} className="text-center border-success/20 dark:border-success/30 hover:border-success/40 transition-all hover:shadow-lg">
                <CardContent className="p-6">
                  <solution.icon className="h-12 w-12 mx-auto text-success mb-4" />
                  <h3 className="font-semibold text-foreground mb-2">{solution.title}</h3>
                  <p className="text-muted-foreground text-sm">{solution.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-16 sm:py-20 bg-gradient-to-b from-muted/30 via-muted/20 to-background dark:from-muted/20 dark:via-muted/10 dark:to-background scroll-mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 animate-fade-in">
            <Badge variant="outline" className="mb-4 px-4 py-2 text-sm border-accent/30 text-accent bg-accent/5">
              <Zap className="w-4 h-4 mr-2" />
              7 dias grátis, cancela quando quiser
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Quanto tempo você economiza por mês?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Nossos clientes economizam em média <strong className="text-foreground">90 horas por mês</strong>. 
              Quanto vale o seu tempo?
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 max-w-7xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative border-border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                  plan.popular 
                    ? 'border-primary ring-2 ring-primary/30 dark:ring-primary/40 shadow-lg scale-105 bg-gradient-to-b from-primary/5 to-background' 
                    : 'hover:border-primary/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <Badge className="bg-accent text-accent-foreground shadow-lg px-4 py-1 text-sm font-semibold">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Mais Vendido
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4 pt-6">
                  <CardTitle className="text-xl sm:text-2xl text-foreground font-bold">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2 min-h-[40px]">{plan.description}</p>
                  <div className="mt-6">
                    <span className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">{plan.price}</span>
                    <span className="text-muted-foreground text-base">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pb-6">
                  <div className="space-y-3 min-h-[280px]">
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </div>
                    ))}
                    {plan.limitations.map((limitation, limitIndex) => (
                      <div key={limitIndex} className="flex items-start gap-3 opacity-50">
                        <X className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground line-through">{limitation}</span>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <Link to={`/checkout?plan=${plan.name.toLowerCase()}`} className="block">
                    <Button 
                      className={`w-full group ${
                        plan.popular 
                          ? 'bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg hover:shadow-xl' 
                          : ''
                      }`}
                      variant={plan.popular ? "default" : "outline"}
                      size="lg"
                    >
                      Testar grátis por 7 dias
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  {plan.popular && (
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      ⚡ Escolha de 73% dos nossos clientes
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Trust badges under pricing */}
          <div className="mt-12 sm:mt-16 flex flex-wrap items-center justify-center gap-6 sm:gap-12 px-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Shield className="w-5 h-5 text-success" />
              <span className="text-sm">Pagamento Seguro (Stripe)</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Users className="w-5 h-5 text-success" />
              <span className="text-sm">347+ vendedores ativos</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Clock className="w-5 h-5 text-success" />
              <span className="text-sm">Configura em 5min</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 px-4 py-2 text-sm border-primary/30 text-primary bg-primary/5">
              <Sparkles className="w-4 h-4 mr-2" />
              Tudo que você precisa
            </Badge>
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
              O que vem no UniStock
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Criado por quem vende online. Pra quem vende online.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 sm:gap-8 max-w-7xl mx-auto">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-4 hover:bg-muted/30 rounded-lg transition-all">
                <feature.icon className="h-10 w-10 mx-auto text-primary mb-4" />
                <h3 className="font-semibold text-foreground mb-2 text-sm sm:text-base">{feature.title}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-muted/30 dark:bg-muted/20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
              Dúvidas? A gente responde
            </h2>
          </div>
          <div className="space-y-6">
            <Card className="border-border hover:border-primary/30 transition-all">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">Como funciona o teste grátis?</h3>
                <p className="text-muted-foreground">
                  Você testa 7 dias sem pagar pelo teste. 
                  Gostou? Escolhe o plano. Não gostou? Só não voltar. Simples assim.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border hover:border-primary/30 transition-all">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">Quais plataformas vocês integram?</h3>
                <p className="text-muted-foreground">
                  Mercado Livre, Shopee, Amazon e Shopify. São as 4 que mais vendem no Brasil. 
                  Tá precisando de outra? Fala no WhatsApp que a gente adiciona.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border hover:border-primary/30 transition-all">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">E se eu quiser cancelar?</h3>
                <p className="text-muted-foreground">
                  Cancela quando quiser. Sem burocracia, sem multa, sem perguntas chatas. 
                  Um clique e pronto.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border hover:border-primary/30 transition-all">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">Demora quanto pra configurar?</h3>
                <p className="text-muted-foreground">
                  5 minutos. Conecta as contas, sincroniza o estoque e pronto. 
                  Já tá funcionando.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-20 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-r from-accent/5 via-primary/5 to-accent/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-64 bg-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-8 sm:p-12 shadow-xl">
            <Badge variant="outline" className="mb-4 px-4 py-2 text-sm border-accent/30 text-accent bg-accent/5">
            </Badge>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6">
              Tá esperando o quê?
            </h2>
            
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto">
              347 vendedores já pararam de perder tempo pulando entre abas. 
              <strong className="text-foreground"> Testa grátis por 7 dias.</strong>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
              <a href="#planos" className="w-full sm:w-auto">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 bg-accent hover:bg-accent/90 text-accent-foreground group"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Quero testar grátis agora
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span>7 dias grátis</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span>Cancela quando quiser</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-muted-foreground">
            <p className="font-semibold text-foreground mb-2">UniStock</p>
            <p>&copy; 2025 UniStock. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;