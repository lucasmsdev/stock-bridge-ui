import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PlatformLogo } from "@/components/ui/platform-logo";
import { useThemeProvider } from "@/components/layout/ThemeProvider";
import { 
  ArrowRight, 
  CheckCircle, 
  TrendingUp, 
  BarChart3, 
  Zap, 
  Clock,
  ShoppingBag,
  LineChart,
  Package,
  Bell,
  FileText,
  Sparkles,
  Star,
  Users,
  Activity,
  Instagram,
  MessageCircle,
  HelpCircle
} from "lucide-react";

const Landing = () => {
  const { theme } = useThemeProvider();
  const isDark = theme === 'dark';
  const plans = [
    {
      id: "estrategista",
      name: "Iniciante",
      price: "R$ 97",
      period: "/mês",
      description: "Ideal para começar a centralizar suas vendas",
      popular: false,
      features: [
        "Até 100 produtos",
        "1 conta por marketplace",
        "Sincronização de produtos e estoque",
        "Gestão de pedidos",
        "Dashboard básico",
        "Suporte por WhatsApp"
      ]
    },
    {
      id: "competidor",
      name: "Profissional",
      price: "R$ 197",
      period: "/mês",
      description: "Mais vendido! Para quem quer escalar com inteligência",
      popular: true,
      features: [
        "Até 500 produtos",
        "2 contas por marketplace",
        "Tudo do plano Iniciante",
        "Acesso ao Agente Uni (IA) para Otimização de Anúncios",
        "Relatórios básicos de vendas",
        "Cálculo financeiro e de lucro",
        "Suporte prioritário"
      ]
    },
    {
      id: "dominador",
      name: "Enterprise",
      price: "R$ 297",
      period: "/mês",
      description: "Para operações avançadas com análise de mercado",
      popular: false,
      features: [
        "Até 2.000 produtos",
        "5 contas por marketplace",
        "Tudo do plano Profissional",
        "Análise de Mercado com IA e Monitoramento de Concorrência em Tempo Real",
        "Relatórios personalizados",
        "Suporte prioritário dedicado"
      ]
    },
    {
      id: "unlimited",
      name: "Unlimited",
      price: "R$ 397",
      period: "/mês",
      description: "Sem limites! Para grandes operações multi-canal",
      popular: false,
      features: [
        "Produtos ilimitados",
        "Contas ilimitadas por marketplace",
        "Tudo do plano Enterprise",
        "Análise de mercado ilimitada",
        "Automação avançada",
        "API de Integração Completa e Gerente de Sucesso Dedicado"
      ]
    }
  ];

  const features = [
    {
      icon: Package,
      title: "Sincronização Automática",
      description: "Nunca mais perca uma venda por estoque desatualizado. Sincronização automática e instantânea em todos os seus marketplaces."
    },
    {
      icon: TrendingUp,
      title: "Análise de Lucro Real",
      description: "Saiba o Lucro Líquido de Cada Venda, na Hora. O UniStock calcula taxas, fretes e custos para você."
    },
    {
      icon: Sparkles,
      title: "IA Inteligente",
      description: "Inteligência Artificial que Vende Mais por Você. Use o Agente Uni para otimizar anúncios, identificar preços da concorrência e maximizar sua margem."
    },
    {
      icon: ShoppingBag,
      title: "Análise de Vendas",
      description: "Veja todos os pedidos com detalhes: itens, comissões, frete e mais"
    },
    {
      icon: BarChart3,
      title: "Dashboards Inteligentes",
      description: "Acompanhe seu lucro diário, semanal e mensal em segundos"
    },
    {
      icon: LineChart,
      title: "Mais Vendidos",
      description: "Saiba quais produtos estão vendendo mais em poucos cliques"
    }
  ];


  return (
    <div className="min-h-screen bg-background font-body">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <img 
              key={`logo-${theme}`}
              src={`/logos/unistock-${theme}.png?v=${Date.now()}`}
              alt="UniStock Logo"
              className="h-24 md:h-28 lg:h-36 w-auto transition-opacity duration-200"
            />
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#inicio" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Início
              </a>
              <a href="#funcoes" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Funções
              </a>
              <a href="#planos" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Planos
              </a>
              <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                FAQ
              </a>
              <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Login
              </Link>
            </nav>
            <div className="flex items-center space-x-4">
              <a href="#planos">
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
                  Testar 14 dias GRÁTIS
                </Button>
              </a>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="inicio" className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 px-4 sm:px-6 lg:px-8 scroll-mt-16 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        
        <div className="container mx-auto max-w-6xl relative z-10 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center text-center min-h-[calc(100vh-200px)] py-12 space-y-12">
            {/* Headline */}
            <div className="space-y-6 animate-fade-in max-w-4xl">
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground leading-tight">
                <span className="text-primary">UniStock</span>: Tudo o que você vende, <span className="text-primary">em um só lugar.</span>
              </h1>
              
              <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
                Descubra o Lucro Real em Tempo Recorde. Sincronize Estoque, Vendas e Finanças de Mercado Livre, Shopee, Amazon e mais, tudo em um só lugar.
              </p>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <a href="#planos">
                <Button size="lg" className="w-full sm:w-auto px-8 py-6 text-lg bg-accent hover:bg-accent/90 text-accent-foreground group hover:shadow-xl hover:shadow-accent/50 transition-all hover:scale-105">
                  Começar meu Teste Grátis de 14 Dias
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
              <Link to="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 py-6 text-lg hover:bg-accent/10 hover:border-accent transition-all">
                  Já tenho conta
                </Button>
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-accent" />
                <span className="font-medium">14 dias grátis</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-accent" />
                <span className="font-medium">Suporte via WhatsApp</span>
              </div>
            </div>

            {/* Dashboard Image */}
            <div className="relative w-full max-w-5xl animate-fade-in" style={{ animationDelay: '0.3s' }}>
              {/* Subtle glow effect behind image */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl blur-3xl opacity-50" />
              
              {/* Image Container */}
              <div className="relative w-full group">
                <img
                  src="/images/dashboard-hero.png"
                  alt="Dashboard UniStock - Controle Total de Marketplaces"
                  className="relative rounded-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] hover:shadow-[0_30px_80px_-15px_rgba(0,0,0,0.6)] border border-border/50 hover:border-primary/30 w-full h-auto transition-all duration-500 hover:scale-[1.02] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What is UniStock */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-6">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground">
              O que é o UniStock?
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              UniStock é uma poderosa ferramenta de gestão unificada para vendedores que operam 
              em múltiplos marketplaces. Sincronize estoque, acompanhe vendas e lucro em tempo real, 
              e tome decisões mais rápidas e assertivas. Chega de planilhas complexas e abas abertas 
              sem parar. Tudo que você precisa em um único lugar.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Potencialize sua Performance
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Você fica exausto trabalhando em planilhas para saber seu lucro real? 
              Tenha acesso a essas informações na palma da mão e em tempo real.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div className="group">
              <img
                src="/images/dashboard-products.png"
                alt="Visão geral do sistema"
                className="rounded-xl shadow-lg border border-border group-hover:shadow-2xl group-hover:shadow-primary/10 group-hover:scale-[1.02] transition-all duration-300"
              />
            </div>
            <div className="space-y-6">
              <div className="flex gap-4 group hover:translate-x-2 transition-transform duration-300">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 group-hover:scale-110 transition-all duration-300">
                    <Zap className="w-6 h-6 text-accent" />
                  </div>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground mb-2">Sincronização Automática</h3>
                  <p className="text-muted-foreground">Vendeu em uma plataforma? Estoque atualiza em todas automaticamente.</p>
                </div>
              </div>

              <div className="flex gap-4 group hover:translate-x-2 transition-transform duration-300">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                    <BarChart3 className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground mb-2">Análise de Lucro Real</h3>
                  <p className="text-muted-foreground">Dashboard mostra lucro real descontando todas as taxas e custos.</p>
                </div>
              </div>

              <div className="flex gap-4 group hover:translate-x-2 transition-transform duration-300">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 group-hover:scale-110 transition-all duration-300">
                    <Clock className="w-6 h-6 text-accent" />
                  </div>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground mb-2">Economize Tempo</h3>
                  <p className="text-muted-foreground">3 horas por dia a menos gerenciando planilhas e plataformas.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funcoes" className="py-20 bg-muted/30 scroll-mt-16">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Funções do UniStock
            </h2>
            <p className="text-lg text-muted-foreground">
              Diga adeus às planilhas de Excel e relatórios incompletos
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-border hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2 duration-300 group">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-foreground text-lg group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-2 border-primary/30 text-primary bg-primary/5">
              <Sparkles className="w-4 h-4 mr-2" />
              Nossos Partners
            </Badge>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Marketplaces que o UniStock integra
            </h2>
            <p className="text-lg text-muted-foreground">
              Conecte-se com as maiores plataformas de venda do Brasil
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-center p-8 rounded-xl bg-card border-2 border-border hover:border-primary/40 hover:shadow-xl transition-all duration-300 group">
              <img 
                src="https://vectorseek.com/wp-content/uploads/2023/08/Mercado-Livre-Icon-Logo-Vector.svg-.png"
                alt="Mercado Livre"
                className="w-full h-16 object-contain group-hover:scale-110 transition-transform"
              />
            </div>
            <div className="flex items-center justify-center p-8 rounded-xl bg-card border-2 border-border hover:border-primary/40 hover:shadow-xl transition-all duration-300 group">
              <img 
                src="https://www.freepnglogos.com/uploads/shopee-logo/shopee-bag-logo-free-transparent-icon-17.png"
                alt="Shopee"
                className="w-full h-16 object-contain group-hover:scale-110 transition-transform"
              />
            </div>
            <div className="flex items-center justify-center p-8 rounded-xl bg-card border-2 border-border hover:border-primary/40 hover:shadow-xl transition-all duration-300 group">
              <img 
                src={isDark ? "https://www.pngmart.com/files/23/Amazon-Logo-White-PNG-Photos.png" : "https://upload.wikimedia.org/wikipedia/commons/d/de/Amazon_icon.png"}
                alt="Amazon"
                className={`w-full object-contain group-hover:scale-110 transition-transform ${isDark ? 'h-16' : 'h-20'}`}
              />
            </div>
            <div className="flex items-center justify-center p-8 rounded-xl bg-card border-2 border-border hover:border-primary/40 hover:shadow-xl transition-all duration-300 group">
              <img 
                src="https://cdn3.iconfinder.com/data/icons/social-media-2068/64/_shopping-512.png"
                alt="Shopify"
                className="w-full h-16 object-contain group-hover:scale-110 transition-transform"
              />
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              Mais integrações em breve • Precisa de outra plataforma? <span className="text-primary font-semibold">Fale conosco</span>
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="py-20 scroll-mt-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-2 border-accent/30 text-accent bg-accent/5">
              <Zap className="w-4 h-4 mr-2" />
              Experimente grátis por 14 dias
            </Badge>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Conheça nossos planos
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Escolha o plano ideal para sua operação.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative border transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${
                  plan.popular 
                    ? 'border-primary ring-2 ring-primary/30 shadow-xl hover:shadow-primary/30 scale-105 bg-gradient-to-b from-primary/5 to-background' 
                    : 'border-border hover:border-primary/40 hover:shadow-primary/20'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <Badge className="bg-accent text-accent-foreground shadow-lg px-4 py-1 whitespace-nowrap font-semibold">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Mais Vendido
                    </Badge>
                  </div>
                )}
                
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="text-center space-y-2 pt-2">
                    <h3 className="font-heading text-2xl font-bold text-foreground">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground min-h-[40px]">{plan.description}</p>
                  </div>

                  <div className="text-center my-6">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>

                  <div className="space-y-3 flex-grow mb-8">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto space-y-3">
                    <Link to={`/signup?plan=${plan.id}`}>
                      <Button
                        className={`w-full transition-all group ${
                          plan.popular 
                            ? 'bg-accent hover:bg-accent/90 text-accent-foreground hover:shadow-lg hover:shadow-accent/50 hover:scale-105' 
                            : 'hover:bg-accent/10 hover:border-accent'
                        }`}
                        variant={plan.popular ? "default" : "outline"}
                      >
                        Testar grátis por 14 dias
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>

                    {plan.popular && (
                      <p className="text-xs text-center text-muted-foreground">
                        ⚡ Escolha de 73% dos nossos clientes
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>


      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 animate-pulse" style={{ animationDuration: '8s' }} />
        
        <div className="container mx-auto max-w-4xl relative z-10">
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/20 hover:scale-[1.02] transition-all duration-300">
            <CardContent className="p-6 sm:p-8 md:p-12 text-center space-y-6">
              <div className="inline-block p-3 bg-accent/10 rounded-full mb-2 animate-pulse" style={{ animationDuration: '3s' }}>
                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-accent" />
              </div>
              
              <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold text-foreground px-2">
                Pronto para transformar sua gestão?
              </h2>
              
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 px-2">
                Junte-se a centenas de vendedores que já economizam tempo e aumentam seus lucros com o UniStock.
              </p>
              
              <a href="#planos" className="inline-block w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground font-semibold group hover:shadow-2xl hover:shadow-accent/50 hover:scale-105 transition-all text-sm sm:text-base">
                  <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Começar teste grátis de 14 dias
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
              
              {/* Security Badges */}
              <div className="flex flex-wrap justify-center items-center gap-4 mt-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 bg-background/50 px-4 py-2 rounded-full border border-border/50">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Dados Protegidos</span>
                </div>
                <div className="flex items-center gap-2 bg-background/50 px-4 py-2 rounded-full border border-border/50">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Criptografia SSL</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 px-4 py-2 border-primary/30 text-primary bg-primary/5">
              <HelpCircle className="w-4 h-4 mr-2" />
              FAQ
            </Badge>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Perguntas Frequentes
            </h2>
            <p className="text-lg text-muted-foreground">
              Tire suas dúvidas sobre o UniStock
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem value="item-1" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold text-foreground">Como funciona a integração com os marketplaces?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                É simples! Você conecta suas contas do Mercado Livre, Shopee, Amazon e Shopify direto no UniStock. 
                A sincronização é automática e em tempo real - qualquer alteração de estoque, preço ou nova venda 
                aparece instantaneamente no painel.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold text-foreground">Posso testar antes de assinar?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Sim! Todos os planos têm 14 dias de teste grátis. Você pode explorar todas as funcionalidades 
                durante o período de teste. Comece agora mesmo!
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold text-foreground">Posso mudar de plano depois?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Com certeza! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. 
                A mudança é imediata e o valor é ajustado proporcionalmente.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold text-foreground">Meus dados estão seguros?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Totalmente! Usamos criptografia de ponta e seguimos todas as normas de segurança dos marketplaces. 
                Seus tokens de acesso são armazenados com segurança e nunca compartilhamos seus dados com terceiros.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold text-foreground">Como funciona o cálculo de lucro?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Você informa o custo de cada produto, e o UniStock calcula automaticamente seu lucro real 
                considerando o preço de venda, comissões dos marketplaces e frete. Tudo em tempo real, 
                a cada venda realizada.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold text-foreground">Preciso instalar algo no meu computador?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Não! O UniStock funciona 100% na nuvem. Você acessa pelo navegador de qualquer computador, 
                tablet ou celular. Basta ter internet.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold text-foreground">Como funciona o suporte?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Nosso suporte é direto pelo WhatsApp. Nos planos Profissional e superiores, você tem atendimento 
                prioritário. Estamos aqui pra te ajudar a vender mais!
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold text-foreground">O que acontece se eu cancelar?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Você pode cancelar a qualquer momento, sem multas ou taxas. Seu acesso continua até o fim do período 
                pago. Se voltar depois, todos os seus dados estarão lá te esperando.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-muted/20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* Logo e Descrição */}
            <div className="space-y-4">
              <img 
                key={`footer-logo-${theme}`}
                src={`/logos/unistock-${theme}.png`}
                alt="UniStock Logo"
                className="h-16 w-auto"
              />
              <p className="text-sm text-muted-foreground">
                Centralize suas vendas em múltiplos marketplaces e descubra seu lucro real em tempo recorde.
              </p>
            </div>

            {/* Contato */}
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Contato</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-primary" />
                  <a href="https://wa.me/5512996872975" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    +55 12 99687-2975
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <Instagram className="w-4 h-4 text-primary" />
                  <a href="https://www.instagram.com/oficialunistock/" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    @oficialunistock
                  </a>
                </p>
              </div>
            </div>

            {/* Links */}
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Links</h4>
              <div className="space-y-2 text-sm">
                <Link to="/contato" className="block text-muted-foreground hover:text-primary transition-colors">
                  Fale Conosco
                </Link>
                <a href="#planos" className="block text-muted-foreground hover:text-primary transition-colors">
                  Planos
                </a>
                <a href="#faq" className="block text-muted-foreground hover:text-primary transition-colors">
                  FAQ
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <a 
                  href="https://www.instagram.com/oficialunistock/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="w-6 h-6" />
                </a>
                <a 
                  href="https://wa.me/5512996872975" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="w-6 h-6" />
                </a>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                &copy; 2025 UniStock. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;