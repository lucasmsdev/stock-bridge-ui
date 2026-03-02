import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PlatformLogo } from "@/components/ui/platform-logo";
import { useThemeProvider } from "@/components/layout/ThemeProvider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AnimatedSection } from "@/components/ui/animated-section";
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
  HelpCircle,
  Menu,
  X
} from "lucide-react";

const pricingFeatureDescriptions: Record<string, string> = {
  // Plano Iniciante
  "Até 100 produtos": "Perfeito para quem está começando. Se você vende mais de 100 SKUs diferentes, considere o plano Profissional (500 produtos) ou superior.",
  "1 conta por marketplace": "Conecte 1 loja por canal. Se você tem mais de uma conta no Mercado Livre ou Shopee, por exemplo, vai precisar do plano Profissional (2 contas) ou Enterprise (5 contas).",
  "Sincronização de produtos e estoque": "Vendeu no Mercado Livre? O estoque atualiza automaticamente na Shopee, Amazon e Shopify. Nunca mais venda sem estoque! Disponível em todos os planos.",
  "Gestão de pedidos": "Veja todos os pedidos de todos os canais em um único painel. Acompanhe status, valores e detalhes sem precisar entrar em cada marketplace. Disponível em todos os planos.",
  "Dashboard básico": "Visão geral das suas vendas e pedidos. Para relatórios detalhados de lucratividade e análise financeira, você precisa do plano Profissional ou superior.",
  "Suporte por WhatsApp": "Tire dúvidas pelo WhatsApp. Se precisar de atendimento mais rápido e prioritário, considere o plano Profissional ou superior.",

  // Plano Profissional
  "Até 500 produtos": "5x mais produtos que o Iniciante. Ideal para quem está crescendo. Precisa de mais? O Enterprise suporta até 2.000 produtos.",
  "2 contas por marketplace": "Conecte até 2 lojas por canal (ex: 2 contas do Mercado Livre). Tem mais contas? O Enterprise permite 5 e o Unlimited é ilimitado.",
  "Tudo do plano Iniciante": "Você mantém sincronização, gestão de pedidos, dashboard e suporte — e ainda ganha recursos extras como IA, relatórios e cálculo de lucro.",
  "50 consultas IA/mês (modelo padrão)": "Use a Uni, nossa IA, até 50 vezes por mês para otimizar anúncios, tirar dúvidas e receber sugestões estratégicas. No Enterprise são 200 consultas com IA avançada.",
  "Acesso ao Agente Uni (IA) para Otimização de Anúncios": "EXCLUSIVO do Profissional em diante. A Uni analisa seus anúncios e sugere melhorias em títulos, descrições e fotos para vender mais. No Iniciante você não tem acesso a isso.",
  "Relatórios básicos de vendas": "Veja relatórios de vendas por período, produto e canal. Para relatórios personalizados e mais completos, considere o Enterprise.",
  "Cálculo financeiro e de lucro": "EXCLUSIVO do Profissional em diante. Descubra seu lucro real descontando taxas, frete, custos e impostos. No Iniciante você não tem essa visibilidade.",
  "Suporte prioritário": "Sua mensagem entra na frente da fila. Tempo de resposta mais rápido que o plano Iniciante.",

  // Plano Enterprise
  "Até 2.000 produtos": "4x mais que o Profissional. Para catálogos grandes. Se ainda não for suficiente, o Unlimited não tem limite.",
  "5 contas por marketplace": "Conecte até 5 lojas por canal. Ideal para quem tem múltiplas operações ou CNPJs diferentes. O Unlimited não tem limite.",
  "Tudo do plano Profissional": "Mantém IA, relatórios, cálculo de lucro e suporte prioritário — e adiciona análise de concorrência e relatórios personalizados.",
  "200 consultas IA/mês (modelo avançado)": "4x mais consultas que o Profissional! Usa o modelo de IA mais inteligente (sonar-pro) para análises mais profundas e estratégicas.",
  "Análise de Mercado com IA e Monitoramento de Concorrência em Tempo Real": "EXCLUSIVO do Enterprise em diante. Monitore preços dos concorrentes e receba alertas e sugestões de ajuste. Proteja sua margem sem esforço manual.",
  "Relatórios personalizados": "Relatórios sob medida para seu tipo de operação. Mais detalhes e filtros que os relatórios básicos do Profissional.",
  "Suporte prioritário dedicado": "Além de prioritário, você tem acompanhamento mais próximo da equipe de suporte.",

  // Plano Unlimited
  "Produtos ilimitados": "Sem teto. Cadastre quantos produtos precisar. Ideal para operações grandes ou distribuidores.",
  "Contas ilimitadas por marketplace": "Conecte quantas lojas quiser por canal. Sem restrições.",
  "Tudo do plano Enterprise": "Análise de concorrência, relatórios personalizados, IA e tudo mais — com capacidade ilimitada.",
  "Consultas IA ilimitadas (modelo avançado)": "Use a IA quantas vezes quiser, sem limites mensais. Modelo avançado (sonar-pro) para máxima inteligência nas análises.",
  "Análise de mercado ilimitada": "No Enterprise há limites de consultas. No Unlimited, use análises de mercado e concorrência sem restrições.",
  "Automação avançada": "EXCLUSIVO do Unlimited. Automatize tarefas repetitivas: atualização de preços, respostas, e fluxos operacionais.",
  "API de Integração Completa e Gerente de Sucesso Dedicado": "EXCLUSIVO do Unlimited. Integre com seu ERP ou sistemas internos via API. Além disso, você tem um gerente de sucesso dedicado para acompanhar sua conta e ajudar a crescer.",
};

const Landing = () => {
  const { theme } = useThemeProvider();
  const isDark = theme === 'dark';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const plans = [
    {
      id: "iniciante",
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
      id: "profissional",
      name: "Profissional",
      price: "R$ 197",
      period: "/mês",
      description: "Mais vendido! Para quem quer escalar com inteligência",
      popular: true,
      features: [
        "Até 500 produtos",
        "2 contas por marketplace",
        "Tudo do plano Iniciante",
        "50 consultas IA/mês (modelo padrão)",
        "Relatórios básicos de vendas",
        "Cálculo financeiro e de lucro",
        "Suporte prioritário"
      ]
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "R$ 297",
      period: "/mês",
      description: "Para operações avançadas com análise de mercado",
      popular: false,
      features: [
        "Até 2.000 produtos",
        "5 contas por marketplace",
        "Tudo do plano Profissional",
        "200 consultas IA/mês (modelo avançado)",
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
        "Consultas IA ilimitadas (modelo avançado)",
        "Automação avançada",
        "API de Integração Completa e Gerente de Sucesso Dedicado"
      ]
    }
  ];

  const features = [
    {
      icon: Package,
      title: "Sincronização Automática",
      description: "Nunca mais perca uma venda por estoque desatualizado. Sincronização automática e instantânea em todos os seus marketplaces.",
      featured: true
    },
    {
      icon: TrendingUp,
      title: "Análise de Lucro Real",
      description: "UniStock calcula automaticamente todas as taxas, fretes, devoluções e custos. Você vê o lucro real em tempo real. Nada escondido.",
      featured: true
    },
    {
      icon: Sparkles,
      title: "IA Inteligente",
      description: "O Agente Uni otimiza seus anúncios, monitora preços da concorrência e garante a melhor margem, sem você precisar mexer um dedo.",
      featured: false
    },
    {
      icon: ShoppingBag,
      title: "Análise de Vendas",
      description: "Veja todos os pedidos com detalhes: itens, comissões, frete e mais.",
      featured: false
    },
    {
      icon: BarChart3,
      title: "Dashboards Inteligentes",
      description: "Acompanhe seu lucro diário, semanal e mensal em segundos.",
      featured: false
    },
    {
      icon: LineChart,
      title: "Mais Vendidos",
      description: "Saiba quais produtos estão vendendo mais em poucos cliques.",
      featured: false
    }
  ];

  const beforeAfterItems = [
    { before: "4+ abas abertas ao mesmo tempo", after: "1 painel único e centralizado" },
    { before: "Planilhas manuais e desatualizadas", after: "Sincronização automática em tempo real" },
    { before: "Lucro estimado \"no olho\"", after: "Lucro real calculado automaticamente" },
    { before: "Estoque desatualizado entre canais", after: "Estoque unificado e sempre correto" },
    { before: "Horas perdidas pulando entre plataformas", after: "Economize até 3h por dia" },
  ];

  const mobileNavLinks = [
    { label: "Início", href: "#inicio" },
    { label: "Funções", href: "#funcoes" },
    { label: "Planos", href: "#planos" },
    { label: "FAQ", href: "#faq" },
  ];

  const marketplaces = [
    { name: 'Mercado Livre', logo: 'https://vectorseek.com/wp-content/uploads/2023/08/Mercado-Livre-Icon-Logo-Vector.svg-.png' },
    { name: 'Shopee', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Shopee_logo.svg/1442px-Shopee_logo.svg.png' },
    { name: 'Amazon', logo: isDark ? 'https://www.pngmart.com/files/23/Amazon-Logo-White-PNG-Photos.png' : 'https://upload.wikimedia.org/wikipedia/commons/d/de/Amazon_icon.png' },
    { name: 'Shopify', logo: 'https://cdn.freebiesupply.com/logos/large/2x/shopify-logo-png-transparent.png' },
    { name: 'Magalu', logo: '/logos/magalu.png' },
    { name: 'TikTok Shop', logo: '/logos/tiktok-shop.png', comingSoon: true },
    { name: 'Shein', logo: '/logos/shein.png', comingSoon: true },
  ];

  const adPlatforms = [
    { name: 'Meta Ads', logo: '/logos/meta-ads.png' },
    { name: 'Google Ads', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Google_Ads_logo.svg/1200px-Google_Ads_logo.svg.png' },
    { name: 'TikTok Ads', logo: '/logos/tiktok-shop.png' },
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
            <div className="flex items-center space-x-3">
              <a href="#planos" className="hidden sm:inline-block">
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
                  Comece agora
                </Button>
              </a>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="right" className="w-[280px] p-0">
          <SheetHeader className="p-6 pb-2">
            <SheetTitle>
              <img 
                src={`/logos/unistock-${theme}.png`}
                alt="UniStock Logo"
                className="h-16 w-auto"
              />
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col px-6 py-4 space-y-1">
            {mobileNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center py-3 px-4 rounded-lg text-base font-medium text-foreground hover:bg-accent/10 hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            ))}
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center py-3 px-4 rounded-lg text-base font-medium text-foreground hover:bg-accent/10 hover:text-primary transition-colors"
            >
              Login
            </Link>
            <div className="pt-4">
              <a href="#planos" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
                  Comece agora
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
          </nav>
        </SheetContent>
      </Sheet>

      {/* Hero Section */}
      <section id="inicio" className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 px-4 sm:px-6 lg:px-8 scroll-mt-16 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        
        <div className="container mx-auto max-w-6xl relative z-10 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center text-center min-h-[calc(100vh-200px)] py-12 space-y-12">
            {/* Headline */}
            <div className="space-y-6 animate-fade-in max-w-4xl">
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground leading-tight">
                <span className="text-primary">UniStock</span>: Tudo o que você vende, <span className="animate-highlight-sweep">em um só lugar.</span>
              </h1>
              
              <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
                Chega de alternar entre abas, planilhas, e marketplaces. UniStock sincroniza tudo automaticamente e mostra seu lucro real em tempo real. Trabalhe menos, ganhe mais.
              </p>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <a href="#planos">
                <Button size="lg" className="w-full sm:w-auto px-8 py-6 text-lg bg-accent hover:bg-accent/90 text-accent-foreground group hover:shadow-xl hover:shadow-accent/50 transition-all hover:scale-105 hover-glow">
                  Quero conhecer
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

            {/* Dashboard Image - with float animation */}
            <div className="relative w-full max-w-5xl animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl blur-3xl opacity-50" />
              <div className="relative w-full animate-float">
                <img
                  src="/images/dashboard-hero.png"
                  alt="Dashboard UniStock - Controle Total de Marketplaces"
                  className="relative rounded-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] hover:shadow-[0_30px_80px_-15px_rgba(0,0,0,0.6)] border border-border/50 hover:border-primary/30 w-full h-auto transition-all duration-500 hover:scale-[1.02] cursor-pointer"
                  width={1200}
                  height={675}
                  fetchPriority="high"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Before vs After Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-5xl">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4 px-4 py-2 border-primary/30 text-primary bg-primary/5">
                <Activity className="w-4 h-4 mr-2" />
                Compare e decida
              </Badge>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Antes vs Depois do UniStock
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Veja como sua rotina muda quando você centraliza tudo em um só lugar.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 gap-6">
            {/* ANTES */}
            <AnimatedSection animation="fade-left" delay={100}>
              <Card className="border-destructive/30 bg-destructive/5 hover:shadow-lg transition-all duration-300 h-full">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                      <X className="w-5 h-5 text-destructive" />
                    </div>
                    <h3 className="font-heading text-xl font-bold text-destructive">Sem UniStock</h3>
                  </div>
                  <div className="space-y-4">
                    {beforeAfterItems.map((item, idx) => (
                      <AnimatedSection key={idx} animation="fade-left" delay={200 + idx * 100}>
                        <div className="flex items-start gap-3">
                          <X className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-muted-foreground">{item.before}</span>
                        </div>
                      </AnimatedSection>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* DEPOIS */}
            <AnimatedSection animation="fade-right" delay={200}>
              <Card className="border-accent/30 bg-accent/5 hover:shadow-lg hover:shadow-accent/10 transition-all duration-300 h-full">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="font-heading text-xl font-bold text-accent">Com UniStock</h3>
                  </div>
                  <div className="space-y-4">
                    {beforeAfterItems.map((item, idx) => (
                      <AnimatedSection key={idx} animation="fade-right" delay={300 + idx * 100}>
                        <div className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-foreground font-medium">{item.after}</span>
                        </div>
                      </AnimatedSection>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Potencialize sua Performance
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Você está deixando dinheiro na mesa. Enquanto você alterna entre marketplaces e planilhas, 
                seus concorrentes estão ajustando preços em tempo real e capturando suas vendas. Recupere o controle.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <AnimatedSection animation="fade-left">
              <div className="group">
                <img
                  src="/images/dashboard-products.png"
                  alt="Gestão de produtos UniStock - Sincronização multi-marketplace"
                  className="rounded-xl shadow-lg border border-border group-hover:shadow-2xl group-hover:shadow-primary/10 group-hover:scale-[1.02] transition-all duration-300"
                  loading="lazy"
                  decoding="async"
                  width={600}
                  height={400}
                />
              </div>
            </AnimatedSection>
            <div className="space-y-6">
              {[
                { icon: Zap, title: "Sincronização Automática", desc: "Vendeu em uma plataforma? Estoque atualiza em todas automaticamente.", color: "accent" },
                { icon: BarChart3, title: "Análise de Lucro Real", desc: "Dashboard mostra lucro real descontando todas as taxas e custos.", color: "primary" },
                { icon: Clock, title: "Economize Tempo", desc: "3 horas por dia a menos gerenciando planilhas e plataformas.", color: "accent" },
              ].map((benefit, idx) => (
                <AnimatedSection key={idx} animation="fade-right" delay={idx * 150}>
                  <div className="flex gap-4 group hover:translate-x-2 transition-transform duration-300">
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 rounded-lg bg-${benefit.color}/10 flex items-center justify-center group-hover:bg-${benefit.color}/20 group-hover:scale-110 transition-all duration-300`}>
                        <benefit.icon className={`w-6 h-6 text-${benefit.color}`} />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-foreground mb-2">{benefit.title}</h3>
                      <p className="text-muted-foreground">{benefit.desc}</p>
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features - Bento Grid */}
      <section id="funcoes" className="py-20 bg-muted/30 scroll-mt-16">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Funções do UniStock
              </h2>
              <p className="text-lg text-muted-foreground">
                Diga adeus às planilhas confusas e relatórios incompletos
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <AnimatedSection key={index} animation="scale" delay={index * 100}>
                <Card 
                  className={`border-border hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2 duration-300 group hover-glow h-full ${
                    feature.featured ? 'md:col-span-1 lg:col-span-1 lg:row-span-1 md:first:col-span-2 lg:first:col-span-2' : ''
                  } ${index === 0 ? 'md:col-span-2 lg:col-span-2' : ''}`}
                >
                  <CardContent className={`space-y-4 ${index === 0 ? 'p-8' : 'p-6'}`}>
                    <div className={`rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300 ${
                      index === 0 ? 'w-16 h-16' : 'w-12 h-12'
                    }`}>
                      <feature.icon className={`text-primary ${index === 0 ? 'w-8 h-8' : 'w-6 h-6'}`} />
                    </div>
                    <h3 className={`font-heading font-semibold text-foreground group-hover:text-primary transition-colors ${
                      index === 0 ? 'text-xl' : 'text-lg'
                    }`}>
                      {feature.title}
                    </h3>
                    <p className={`text-muted-foreground ${index === 0 ? 'text-base' : ''}`}>
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Partners - with Marquee */}
      <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4 px-4 py-2 border-primary/30 text-primary bg-primary/5">
                <Sparkles className="w-4 h-4 mr-2" />
                Integrações
              </Badge>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Plataformas que o UniStock conecta
              </h2>
              <p className="text-lg text-muted-foreground">
                Gerencie marketplaces e anúncios em um só lugar
              </p>
            </div>
          </AnimatedSection>

          {/* Marketplaces - Marquee */}
          <div className="mb-16">
            <AnimatedSection animation="fade-up" delay={100}>
              <h3 className="text-center text-xl font-semibold text-foreground mb-8">Marketplaces</h3>
            </AnimatedSection>
            <div className="marquee-container">
              <div className="animate-marquee">
                {[...marketplaces, ...marketplaces, ...marketplaces, ...marketplaces].map((platform, i) => (
                  <div key={`mk-${i}`} className="relative flex flex-col items-center justify-center p-6 rounded-xl bg-card border-2 border-border hover:border-primary/40 hover:shadow-xl transition-all duration-300 group flex-shrink-0 mx-4" style={{ minWidth: '160px' }}>
                    {platform.comingSoon && (
                      <Badge variant="secondary" className="absolute -top-2 -right-2 text-[10px] px-2 py-0.5">
                        Em breve
                      </Badge>
                    )}
                    <img
                      src={platform.logo}
                      alt={`Logo ${platform.name}`}
                      className={`h-12 w-auto object-contain group-hover:scale-110 transition-transform ${platform.comingSoon ? 'opacity-60' : ''}`}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className={`mt-3 text-sm font-medium ${platform.comingSoon ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {platform.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ad Managers */}
          <div>
            <AnimatedSection animation="fade-up" delay={200}>
              <h3 className="text-center text-xl font-semibold text-foreground mb-8">Gerenciadores de Anúncios</h3>
            </AnimatedSection>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {adPlatforms.map((platform, idx) => (
                <AnimatedSection key={platform.name} animation="scale" delay={300 + idx * 100}>
                  <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-card border-2 border-border hover:border-primary/40 hover:shadow-xl transition-all duration-300 group">
                    <img
                      src={platform.logo}
                      alt={`Logo ${platform.name}`}
                      className="h-12 w-auto object-contain group-hover:scale-110 transition-transform"
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="mt-3 text-sm font-medium text-foreground">
                      {platform.name}
                    </span>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>

          <AnimatedSection animation="fade-up" delay={400}>
            <div className="mt-12 text-center">
              <p className="text-sm text-muted-foreground">
                Mais integrações em breve • Precisa de outra plataforma? <Link to="/contato" className="text-primary font-semibold hover:underline">Fale conosco</Link>
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="py-20 scroll-mt-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <AnimatedSection animation="fade-up">
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
          </AnimatedSection>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan, index) => (
              <AnimatedSection key={index} animation="scale" delay={index * 100}>
                <Card 
                  className={`relative border transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 h-full ${
                    plan.popular 
                      ? 'border-primary ring-2 ring-primary/30 shadow-xl hover:shadow-primary/30 scale-105 bg-gradient-to-b from-primary/5 to-background glow-permanent' 
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
                      {plan.features.map((feature, idx) => {
                        const description = pricingFeatureDescriptions[feature];

                        return (
                          <div key={idx} className="flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                            {description ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="text-sm text-foreground text-left underline decoration-dotted underline-offset-2 decoration-muted-foreground/50 hover:decoration-primary hover:text-primary transition-colors cursor-pointer"
                                    aria-label={`Ver explicação: ${feature}`}
                                  >
                                    {feature}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  side="right"
                                  align="start"
                                  className="w-[280px] p-4"
                                >
                                  <div className="space-y-2">
                                    <p className="text-sm font-medium text-foreground">{feature}</p>
                                    <p className="text-sm text-muted-foreground">{description}</p>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <span className="text-sm text-foreground">{feature}</span>
                            )}
                          </div>
                        );
                      })}
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
                          Grátis por 14 dias
                          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>


      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 animate-pulse" style={{ animationDuration: '8s' }} />
        
        <div className="container mx-auto max-w-4xl relative z-10">
          <AnimatedSection animation="scale">
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
                  <Button size="lg" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground font-semibold group hover:shadow-2xl hover:shadow-accent/50 hover:scale-105 transition-all text-sm sm:text-base hover-glow">
                    <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Faça parte agora
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </a>
                
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
          </AnimatedSection>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <AnimatedSection animation="fade-up">
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
          </AnimatedSection>

          <AnimatedSection animation="fade-up" delay={200}>
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
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-muted/20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
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
                <Link to="/termos" className="block text-muted-foreground hover:text-primary transition-colors">
                  Termos de Serviço
                </Link>
                <Link to="/privacidade" className="block text-muted-foreground hover:text-primary transition-colors">
                  Política de Privacidade
                </Link>
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
                &copy; 2026 UniStock. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
