import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PlatformLogo } from "@/components/ui/platform-logo";
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
  Activity
} from "lucide-react";

const Landing = () => {
  const plans = [
    {
      id: "estrategista",
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
      ]
    },
    {
      id: "competidor",
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
      ]
    },
    {
      id: "dominador",
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
      ]
    },
    {
      id: "unlimited",
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
      ]
    }
  ];

  const features = [
    {
      icon: ShoppingBag,
      title: "Análise de Vendas",
      description: "Veja todos os pedidos com detalhes: itens, comissões, frete e mais"
    },
    {
      icon: Package,
      title: "Gestão de Produtos",
      description: "Visualize e gerencie seus anúncios em todas as plataformas"
    },
    {
      icon: TrendingUp,
      title: "Lucro em Tempo Real",
      description: "Descubra quanto está lucrando em cada produto após cada venda"
    },
    {
      icon: LineChart,
      title: "Mais Vendidos",
      description: "Saiba quais produtos estão vendendo mais em poucos cliques"
    },
    {
      icon: BarChart3,
      title: "Dashboards Inteligentes",
      description: "Acompanhe seu lucro diário, semanal e mensal em segundos"
    },
    {
      icon: FileText,
      title: "Relatórios Completos",
      description: "Informações que ajudam a melhorar sua lucratividade"
    }
  ];

  const testimonials = [
    {
      name: "Carlos Mendes",
      role: "Vendedor Mercado Livre",
      text: "Antes eu ficava perdido em planilhas. Agora tenho tudo em um só lugar e sei exatamente quanto estou lucrando."
    },
    {
      name: "Ana Paula Silva",
      role: "Vendedora Multi-plataforma",
      text: "Economizo mais de 3 horas por dia. O estoque sincroniza automaticamente em todos os canais. Mudou minha operação!"
    },
    {
      name: "Roberto Santos",
      role: "E-commerce Owner",
      text: "A análise de lucro em tempo real é incrível. Finalmente sei quais produtos realmente dão lucro."
    }
  ];

  return (
    <div className="min-h-screen bg-background font-body">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="font-heading font-bold text-xl text-primary">UniStock</div>
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
              <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Login
              </Link>
            </nav>
            <div className="flex items-center space-x-4">
              <a href="#planos">
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
                  Testar 7 dias GRÁTIS
                </Button>
              </a>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="inicio" className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 scroll-mt-16">
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-fade-in">
              <Badge className="bg-accent/10 text-accent border-accent/30 px-4 py-2">
                <Activity className="w-4 h-4 mr-2" />
                347 vendedores já confiam no UniStock
              </Badge>
              
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Você sabe quanto está lucrando{" "}
                <span className="text-primary">em tempo real?</span>
              </h1>
              
              <p className="text-lg text-muted-foreground leading-relaxed">
                Pare de perder tempo pulando entre 4 plataformas diferentes. 
                Gerencie Mercado Livre, Shopee, Amazon e Shopify em um único painel.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="#planos">
                  <Button size="lg" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground group">
                    Começar agora
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </a>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Já tenho conta
                  </Button>
                </Link>
              </div>

              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-accent" />
                  <span>7 dias grátis</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-accent" />
                  <span>Cancela quando quiser</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-accent" />
                  <span>Suporte via WhatsApp</span>
                </div>
              </div>
            </div>

            <div className="relative animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl blur-3xl" />
              <img
                src="/images/dashboard-hover-preview.png"
                alt="Dashboard UniStock"
                className="relative rounded-2xl shadow-2xl border border-border"
              />
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
            <div>
              <img
                src="/images/dashboard-real-preview.png"
                alt="Visão geral do sistema"
                className="rounded-xl shadow-lg border border-border"
              />
            </div>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-accent" />
                  </div>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground mb-2">Sincronização Automática</h3>
                  <p className="text-muted-foreground">Vendeu em uma plataforma? Estoque atualiza em todas automaticamente.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground mb-2">Análise de Lucro Real</h3>
                  <p className="text-muted-foreground">Dashboard mostra lucro real descontando todas as taxas e custos.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
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
              <Card key={index} className="border-border hover:border-primary/30 transition-all hover:shadow-lg">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-foreground text-lg">
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

      {/* Stats */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Leve seu negócio para outro nível!
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-accent/30 text-center">
              <CardContent className="p-8 space-y-4">
                <div className="text-5xl font-bold text-accent">347+</div>
                <p className="text-muted-foreground">Clientes ativos</p>
              </CardContent>
            </Card>
            <Card className="border-primary/30 text-center">
              <CardContent className="p-8 space-y-4">
                <div className="text-5xl font-bold text-primary">90h</div>
                <p className="text-muted-foreground">Economizadas por mês</p>
              </CardContent>
            </Card>
            <Card className="border-accent/30 text-center">
              <CardContent className="p-8 space-y-4">
                <div className="text-5xl font-bold text-accent">4</div>
                <p className="text-muted-foreground">Plataformas integradas</p>
              </CardContent>
            </Card>
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
              <PlatformLogo platform="mercadolivre" size="lg" className="w-full h-16 object-contain group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-center justify-center p-8 rounded-xl bg-card border-2 border-border hover:border-primary/40 hover:shadow-xl transition-all duration-300 group">
              <PlatformLogo platform="shopee" size="lg" className="w-full h-16 object-contain group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-center justify-center p-8 rounded-xl bg-card border-2 border-border hover:border-primary/40 hover:shadow-xl transition-all duration-300 group">
              <PlatformLogo platform="amazon" size="lg" className="w-full h-16 object-contain group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-center justify-center p-8 rounded-xl bg-card border-2 border-border hover:border-primary/40 hover:shadow-xl transition-all duration-300 group">
              <PlatformLogo platform="shopify" size="lg" className="w-full h-16 object-contain group-hover:scale-110 transition-transform" />
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
              Experimente grátis por 7 dias
            </Badge>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Conheça nossos planos
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Escolha o plano ideal para sua operação. Cancele quando quiser, sem burocracia.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative border transition-all duration-300 hover:shadow-xl ${
                  plan.popular 
                    ? 'border-primary ring-2 ring-primary/30 shadow-lg scale-105 bg-gradient-to-b from-primary/5 to-background' 
                    : 'border-border hover:border-primary/30'
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
                
                <CardContent className="p-6 space-y-6">
                  <div className="text-center space-y-2 pt-2">
                    <h3 className="font-heading text-2xl font-bold text-foreground">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground min-h-[40px]">{plan.description}</p>
                  </div>

                  <div className="text-center">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>

                  <div className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Link to={`/signup?plan=${plan.id}`}>
                    <Button
                      className={`w-full ${
                        plan.popular 
                          ? 'bg-accent hover:bg-accent/90 text-accent-foreground' 
                          : ''
                      }`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      Testar grátis por 7 dias
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>

                  {plan.popular && (
                    <p className="text-xs text-center text-muted-foreground">
                      ⚡ Escolha de 73% dos nossos clientes
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-4">
              O que nossos clientes dizem
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-border hover:border-primary/30 transition-all">
                <CardContent className="p-6 space-y-4">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-accent text-accent" />
                    ))}
                  </div>
                  <p className="text-muted-foreground italic">"{testimonial.text}"</p>
                  <div>
                    <p className="font-heading font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="p-12 text-center space-y-6">
              <div className="inline-block p-3 bg-accent/10 rounded-full mb-4">
                <Users className="w-8 h-8 text-accent" />
              </div>
              
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground">
                Pronto para transformar sua gestão?
              </h2>
              
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Junte-se a centenas de vendedores que já economizam tempo e aumentam seus lucros com o UniStock.
              </p>
              
              <a href="#planos">
                <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold group">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Começar teste grátis agora
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>

              <div className="flex justify-center gap-6 text-sm text-muted-foreground pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent" />
                  <span>Sem cartão de crédito</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent" />
                  <span>7 dias grátis</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent" />
                  <span>Cancele quando quiser</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-muted/20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-heading font-bold text-lg text-primary mb-4">UniStock</h3>
              <p className="text-sm text-muted-foreground">
                Gestão unificada para vendedores de múltiplas plataformas
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Links</h4>
              <div className="space-y-2">
                <a href="#inicio" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Início</a>
                <a href="#funcoes" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Funções</a>
                <a href="#planos" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Planos</a>
                <Link to="/login" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Login</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Suporte</h4>
              <p className="text-sm text-muted-foreground">
                WhatsApp: Disponível para clientes
              </p>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              &copy; 2025 UniStock. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;