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
  Calculator
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
      <section className="relative px-4 pt-32 pb-16 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Pare de perder vendas.{" "}
            <span className="text-primary">Automatize</span> seu e-commerce multicanal.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-muted-foreground sm:text-xl">
            Sincronize estoque, preços e pedidos em tempo real entre Mercado Livre, Shopee, Amazon e mais. 
            Foque em vender, não em planilhas.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <a href="#planos">
              <Button size="lg" className="h-12 px-8 text-lg">
                Comece seu teste gratuito de 3 dias
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
            <Link to="/login">
              <Button variant="outline" size="lg" className="h-12 px-8 text-lg">
                Já tenho conta
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-16 relative">
          <div className="mx-auto max-w-6xl px-4">
            <div 
              className="relative rounded-xl overflow-hidden shadow-2xl"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                transform: 'perspective(1500px) rotateX(3deg)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <img
                src="/images/dashboard-preview.png"
                alt="Dashboard do UniStock mostrando métricas de vendas e lucratividade em tempo real"
                className="w-full h-auto"
                style={{
                  display: 'block',
                  borderRadius: '0.75rem'
                }}
              />
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
      <section id="planos" className="py-20 bg-muted/30 dark:bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
              Escolha o plano perfeito para o seu negócio
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comece com 3 dias grátis. Cancele quando quiser.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <Card key={index} className={`relative border-border ${plan.popular ? 'border-primary ring-2 ring-primary/20 dark:ring-primary/30' : ''}`}>
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
                    Escolha Popular
                  </Badge>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl text-foreground">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </div>
                    ))}
                    {plan.limitations.map((limitation, limitIndex) => (
                      <div key={limitIndex} className="flex items-start gap-3 opacity-60">
                        <X className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground line-through">{limitation}</span>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <Link to={`/checkout?plan=${plan.name.toLowerCase()}`} className="block">
                    <Button 
                      className="w-full" 
                      variant={plan.popular ? "default" : "outline"}
                      size="lg"
                    >
                      Começar Agora
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
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
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-6">
            Pronto para automatizar seu e-commerce?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Junte-se a centenas de vendedores que já economizam horas todos os dias com o UniStock.
          </p>
          <a href="#planos">
            <Button size="lg" className="h-12 px-8 text-lg">
              Comece seu teste gratuito agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
        </div>
      </section>
    </div>
  );
};

export default Landing;