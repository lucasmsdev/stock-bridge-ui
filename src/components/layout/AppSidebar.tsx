import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Plug, 
  HelpCircle,
  LogOut,
  Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

interface AppSidebarProps {
  isCollapsed: boolean;
}

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Produtos", href: "/products", icon: Package },
  { title: "Pedidos", href: "/orders", icon: ShoppingCart },
  { title: "Financeiro", href: "/finance", icon: Calculator },
  { title: "Integrações", href: "/integrations", icon: Plug },
  { title: "Ajuda", href: "/help", icon: HelpCircle },
];

export const AppSidebar = ({ isCollapsed }: AppSidebarProps) => {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  const getUserInitials = (email: string) => {
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const getUserDisplayName = (email: string) => {
    return email.split('@')[0];
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
            <span className="text-xl font-bold text-foreground">UniStock</span>
          </div>
        ) : (
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-lg">U</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 border border-transparent ${
                isActive
                  ? "bg-gradient-primary text-primary-foreground shadow-primary border-primary/20"
                  : "hover:bg-muted/70 text-muted-foreground hover:text-foreground hover:shadow-soft hover:border-muted"
              } ${isCollapsed ? "justify-center" : ""}`
            }
          >
            <item.icon className="h-5 w-5" />
            {!isCollapsed && <span className="font-medium">{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-border">
        {!isCollapsed ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user?.email ? getUserInitials(user.email) : 'US'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.email ? getUserDisplayName(user.email) : 'Usuário'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email || 'usuario@unistock.com'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start text-muted-foreground hover:text-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="w-full h-8 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};