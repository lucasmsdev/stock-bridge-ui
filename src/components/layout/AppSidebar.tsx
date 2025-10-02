import { NavLink } from "react-router-dom";
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
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";

interface AppSidebarProps {
  isCollapsed: boolean;
}

const navItems = [
  { title: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { title: "Produtos", href: "/app/products", icon: Package },
  { title: "Pedidos", href: "/app/orders", icon: ShoppingCart },
  { 
    title: "Financeiro", 
    href: "/app/finance", 
    icon: Calculator, 
    requiresFeature: 'RelatoriosAvancados' as const 
  },
  { 
    title: "Integrações", 
    href: "/app/integrations", 
    icon: Plug, 
    requiresFeature: 'IntegracoesCompletas' as const 
  },
  { 
    title: "Análise de Mercado", 
    href: "/app/market-analysis", 
    icon: Target, 
    requiresFeature: 'AnaliseDeConcorrencia' as const 
  },
  { 
    title: "Relatórios", 
    href: "/app/reports", 
    icon: FileText, 
    requiresFeature: 'RelatoriosAvancados' as const 
  },
  { title: "Ajuda", href: "/app/help", icon: HelpCircle },
];

export const AppSidebar = ({ isCollapsed }: AppSidebarProps) => {
  const { user, signOut } = useAuth();
  const { hasFeature, currentPlan } = usePlan();

  const handleLogout = async () => {
    await signOut();
  };

  const getUserInitials = (email: string) => {
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const getUserDisplayName = (email: string) => {
    return email.split('@')[0];
  };

  const renderNavItem = (item: typeof navItems[0]) => {
    const hasAccess = !item.requiresFeature || hasFeature(item.requiresFeature);
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
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">U</span>
            </div>
            <div className="flex items-center justify-between flex-1">
              <span className="text-xl font-bold text-foreground">UniStock</span>
              <Badge variant="outline" className="text-xs capitalize">
                {currentPlan}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-lg">U</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
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