import { NavLink, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Plug, 
  HelpCircle,
  LogOut,
  Calculator,
  User,
  ChevronDown,
  CreditCard,
  Lock,
  Crown,
  Target,
  FileText,
  Sparkles,
  Receipt,
  Truck,
  TrendingUp,
  Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthSession } from "@/hooks/useAuthSession";
import { usePlan, FeatureName } from "@/hooks/usePlan";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AppSidebarProps {
  isCollapsed: boolean;
}

const navItems = [
  { title: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { title: "Produtos", href: "/app/products", icon: Package },
  { title: "Etiquetas", href: "/app/labels", icon: Tag },
  { title: "Pedidos", href: "/app/orders", icon: ShoppingCart },
  { 
    title: "Financeiro", 
    href: "/app/finance", 
    icon: Calculator, 
    requiresFeature: FeatureName.FINANCIAL_CALCULATOR
  },
  { 
    title: "Centro de Custos", 
    href: "/app/expenses", 
    icon: Receipt, 
    requiresFeature: FeatureName.FINANCIAL_CALCULATOR
  },
  { 
    title: "Fornecedores", 
    href: "/app/suppliers", 
    icon: Truck, 
    requiresFeature: FeatureName.FINANCIAL_CALCULATOR
  },
  { 
    title: "Integrações", 
    href: "/app/integrations", 
    icon: Plug, 
    requiresFeature: FeatureName.MULTI_MARKETPLACE
  },
  { 
    title: "Análise de Mercado", 
    href: "/app/market-analysis", 
    icon: Target, 
    requiresFeature: FeatureName.MARKET_ANALYSIS
  },
  { 
    title: "Relatórios", 
    href: "/app/reports", 
    icon: FileText, 
    requiresFeature: FeatureName.REPORTS
  },
  { 
    title: "Assistente de IA", 
    href: "/app/ai-assistant", 
    icon: Sparkles, 
    requiresFeature: FeatureName.AI_ASSISTANT
  },
  { 
    title: "Previsão de Estoque", 
    href: "/app/stock-forecast", 
    icon: TrendingUp, 
    requiresFeature: FeatureName.AI_ASSISTANT
  },
  { title: "Ajuda", href: "/app/help", icon: HelpCircle },
];

export const AppSidebar = ({ isCollapsed }: AppSidebarProps) => {
  const { user, forceLogout, clearSessionData } = useAuthSession({ requireAuth: false });
  const { hasFeature, currentPlan, isAdmin, isLoading } = usePlan();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Buscar avatar_url do perfil
  const { data: profile } = useQuery({
    queryKey: ['profile-avatar', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const handleLogout = async () => {
    toast({
      title: "Desconectando...",
      description: "Encerrando sua sessão.",
    });
    await forceLogout(false, "manual");
    toast({
      title: "Desconectado",
      description: "Você foi desconectado com sucesso.",
    });
  };

  const getUserInitials = (email: string) => {
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const getUserDisplayName = (email: string) => {
    return email.split('@')[0];
  };

  const renderNavItem = (item: typeof navItems[0]) => {
    // CRÍTICO: Enquanto carrega, trata todas as features como restritas
    // Isso evita o "flash" de conteúdo premium para usuários básicos
    const hasAccess = !isLoading && (!item.requiresFeature || hasFeature(item.requiresFeature));
    const targetHref = hasAccess ? item.href : "/app/billing";

    return (
      <NavLink
        key={item.href}
        to={targetHref}
        state={!hasAccess ? { targetFeature: item.requiresFeature } : undefined}
        className={({ isActive }) =>
          `flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 border border-transparent ${
            isActive
              ? "bg-gradient-primary text-primary-foreground shadow-primary border-primary/20"
              : "hover:bg-muted/70 text-muted-foreground hover:text-foreground hover:shadow-soft hover:border-muted"
          } ${isCollapsed ? "justify-center" : ""} ${!hasAccess ? "opacity-70" : ""}`
        }
      >
        <div className="flex items-center space-x-2">
          <item.icon className="h-5 w-5" />
          {!hasAccess && <Lock className="h-3 w-3" />}
        </div>
        {!isCollapsed && (
          <div className="flex items-center justify-between flex-1">
            <span className="font-medium">{item.title}</span>
            {!hasAccess && (
              <Badge variant="secondary" className="text-xs px-1 py-0 ml-2">
                <Crown className="h-3 w-3" />
              </Badge>
            )}
          </div>
        )}
      </NavLink>
    );
  };

  return (
    <div className="h-screen bg-card border-r border-border flex flex-col shadow-medium">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        {!isCollapsed ? (
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold font-sans text-foreground">UNISTOCK</span>
            {/* CRÍTICO: Só mostra badge do plano após carregar */}
            {!isLoading && (
              <Badge variant="outline" className="text-xs capitalize">
                {isAdmin ? "Unlimited" : currentPlan}
              </Badge>
            )}
          </div>
        ) : (
          <div className="mx-auto text-center">
            <span className="text-lg font-bold font-sans text-foreground">US</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map(renderNavItem)}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-border">
        {!isCollapsed ? (
          <div className="space-y-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-0 h-auto hover:bg-muted/70">
                  <div className="flex items-center space-x-3 w-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user?.email ? getUserInitials(user.email) : 'US'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user?.email ? getUserDisplayName(user.email) : 'Usuário'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user?.email || 'usuario@unistock.com'}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover border border-border shadow-medium">
                <DropdownMenuItem asChild>
                  <NavLink to="/app/profile" className="flex items-center cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Meu Perfil
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to="/app/billing" className="flex items-center cursor-pointer">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Planos & Cobrança
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-8 text-muted-foreground hover:text-foreground"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {user?.email ? getUserInitials(user.email) : 'US'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover border border-border shadow-medium">
              <DropdownMenuItem asChild>
                <NavLink to="/app/profile" className="flex items-center cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Meu Perfil
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NavLink to="/app/billing" className="flex items-center cursor-pointer">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Planos & Cobrança
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};