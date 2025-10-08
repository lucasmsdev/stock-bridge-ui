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
      name: "Estrategista",
      price: "R$ 97",
      period: "/mês",
      description: "Tome decisões de preço com base em dados, não em achismos.",
      popular: false,
      features: [
        "Até 100 SKUs monitorados",
        "Integrações completas (ML, Shopee, Amazon)",
        "Análise de concorrência",
        "Análise de preço ideal",
        "Dashboard de performance"
      ],
      limitations: [
        "Sem reprecificação por alerta",
        "Sem relatórios avançados"
      ]
    },
    {
      name: "Competidor",
      price: "R$ 147",
      period: "/mês",
      description: "Reaja à concorrência em tempo real e não perca mais vendas.",
      popular: true,
      features: [
        "Até 500 SKUs monitorados",
        "Integrações completas (ML, Shopee, Amazon)",
        "Análise de concorrência",
        "Análise de preço ideal",
        "Dashboard de performance",
        "Reprecificação por alerta",
        "Suporte prioritário"
      ],
      limitations: [
        "Sem relatórios avançados"
      ]
    },
    {
      name: "Dominador",
      price: "R$ 197",
      period: "/mês",
      description: "Automatize sua competitividade e foque em crescer seu negócio.",
      popular: false,
      features: [
        "SKUs ilimitados",
        "Integrações completas (ML, Shopee, Amazon)",
        "Análise de concorrência",
        "Análise de preço ideal",
        "Dashboard de performance",
        "Reprecificação por alerta",
        "Relatórios avançados",
        "Suporte prioritário"
      ],
      limitations: []
    }
  ];

  const problems = [
    {
      icon: X,
      title: "Estoque dessincronizado causa vendas canceladas",
      description: "Você vende um produto que não tem em estoque e tem que cancelar a venda"
    },
    {
      icon: Clock,
      title: "Atualizar preços manualmente leva horas",
      description: "Tempo perdido atualizando preços em cada canal de venda"
    },
    {
      icon: BarChart3,
      title: "Falta de dados claros para tomar decisões",
      description: "Difícil saber qual produto é mais lucrativo ou se está perdendo dinheiro"
    }
  ];

  const solutions = [
    {
      icon: Zap,
      title: "Sincronização em tempo real",
      description: "Estoque sempre atualizado em todos os canais automaticamente"
    },
    {
      icon: TrendingUp,
      title: "Gestão de preços centralizada",
      description: "Atualize preços uma vez e sincronize em todos os marketplaces"
    },
    {
      icon: BarChart3,
      title: "Dashboard com lucratividade",
      description: "Veja claramente quais produtos dão mais lucro e tome decisões baseadas em dados"
    }
  ];

  const features = [
    {
      icon: Globe,
      title: "Sincronização Multi-canal",
      description: "Conecte Mercado Livre, Shopee, Amazon e outros marketplaces em um só lugar"
    },
    {
      icon: Calculator,
      title: "Calculadora de Lucratividade",
      description: "Calcule custos, margens e lucro real de cada produto automaticamente"
    },
    {
      icon: Smartphone,
      title: "Dashboard Intuitivo",
      description: "Interface simples e poderosa para acompanhar vendas e performance"
    },
    {
      icon: Shield,
      title: "Dados Seguros",
      description: "Seus dados protegidos com criptografia de ponta e backup automático"
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
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-success/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="text-center animate-fade-in">
          {/* Trust badge */}
          <Badge variant="outline" className="mb-6 px-4 py-2 text-sm sm:text-base border-primary/30 text-primary bg-primary/5 hover:bg-primary/10">
            <Sparkles className="w-4 h-4 mr-2" />
            Mais de 500 vendedores já automatizaram seus e-commerces
          </Badge>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight text-foreground leading-tight">
            Pare de perder vendas.{" "}
            <span className="bg-gradient-to-r from-primary via-success to-primary bg-clip-text text-transparent animate-gradient">
              Automatize
            </span>{" "}
            seu e-commerce multicanal.
          </h1>
          
          <p className="mx-auto mt-4 sm:mt-6 max-w-3xl text-base sm:text-lg lg:text-xl leading-7 sm:leading-8 text-muted-foreground px-4">
            Sincronize estoque, preços e pedidos em tempo real entre Mercado Livre, Shopee, Amazon e mais. 
            Foque em vender, não em planilhas.
          </p>
          
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
            <a href="#planos" className="w-full sm:w-auto">
              <Button 
                size="lg" 
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-10 text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary group"
              >
                <Rocket className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                Começar teste grátis de 3 dias
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </a>
            <Link to="/login" className="w-full sm:w-auto">
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-10 text-base sm:text-lg font-semibold border-2 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300"
              >
                Já tenho conta
              </Button>
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-muted-foreground px-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              <span>Sem cartão de crédito</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              <span>Cancele quando quiser</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              <span>Setup em 5 minutos</span>
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
              className="relative rounded-xl overflow-hidden shadow-2xl group cursor-pointer transition-all duration-700 ease-out hover:shadow-[0_35px_60px_-15px_rgba(var(--primary)/0.5)] hover:scale-[1.02] hover:-translate-y-2 border border-border/50"
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
              
              {/* Floating badges */}
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
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              Problemas que todo e-commerce enfrenta
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {problems.map((problem, index) => (
              <Card key={index} className="text-center border-destructive/20 dark:border-destructive/30">
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
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              Como o UniStock resolve isso
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {solutions.map((solution, index) => (
              <Card key={index} className="text-center border-primary/20 dark:border-primary/30">
                <CardContent className="p-6">
                  <solution.icon className="h-12 w-12 mx-auto text-primary mb-4" />
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
            <Badge variant="outline" className="mb-4 px-4 py-2 text-sm border-primary/30 text-primary bg-primary/5">
              <Zap className="w-4 h-4 mr-2" />
              Preços transparentes
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Escolha o plano perfeito para o seu negócio
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Comece com 3 dias grátis. Cancele quando quiser. Sem surpresas.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
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
                    <Badge className="bg-gradient-to-r from-primary to-success text-primary-foreground shadow-lg px-4 py-1 text-sm font-semibold">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Mais Popular
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
                          ? 'bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl' 
                          : ''
                      }`}
                      variant={plan.popular ? "default" : "outline"}
                      size="lg"
                    >
                      Começar Agora
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  {plan.popular && (
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      🔥 Melhor custo-benefício
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Trust badges under pricing */}
          <div className="mt-12 sm:mt-16 flex flex-wrap items-center justify-center gap-6 sm:gap-12 px-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-sm">Pagamento Seguro</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-sm">500+ Clientes</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Zap className="w-5 h-5 text-primary" />
              <span className="text-sm">Setup em 5min</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
              Funcionalidades que fazem a diferença
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center">
                <feature.icon className="h-10 w-10 mx-auto text-primary mb-4" />
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
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
              Perguntas Frequentes
            </h2>
          </div>
          <div className="space-y-6">
            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">Como funciona o teste gratuito?</h3>
                <p className="text-muted-foreground">
                  Você tem 3 dias para testar todas as funcionalidades sem compromisso. 
                  Não cobramos cartão de crédito no cadastro.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">Quais marketplaces são suportados?</h3>
                <p className="text-muted-foreground">
                  Mercado Livre, Shopee, Amazon e outros. Estamos sempre adicionando novas integrações.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">Posso mudar de plano depois?</h3>
                <p className="text-muted-foreground">
                  Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento.
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
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-success/5 to-primary/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-64 bg-primary/10 rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-8 sm:p-12 shadow-xl">
            <Badge variant="outline" className="mb-4 px-4 py-2 text-sm border-success/30 text-success bg-success/5">
              <Rocket className="w-4 h-4 mr-2" />
              Teste grátis por 3 dias
            </Badge>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6">
              Pronto para automatizar seu e-commerce?
            </h2>
            
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto">
              Junte-se a <span className="text-primary font-semibold">500+ vendedores</span> que já economizam horas todos os dias com o UniStock.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
              <a href="#planos" className="w-full sm:w-auto">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary group"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Começar teste gratuito agora
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span>3 dias grátis</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span>Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span>Cancele quando quiser</span>
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