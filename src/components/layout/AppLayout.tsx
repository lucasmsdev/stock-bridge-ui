import { useState, useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { Menu, Loader2, Moon, Sun } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useThemeProvider } from "@/components/layout/ThemeProvider";
import { usePlan } from "@/hooks/usePlan";
import { NotificationsPopover } from "@/components/notifications/NotificationsPopover";

export const AppLayout = () => {
  const { user, isLoading } = useAuth();
  const { theme, toggleTheme } = useThemeProvider();
  const { currentPlan, isLoading: planLoading } = usePlan();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  console.log('🏗️ AppLayout: user=', !!user, 'isLoading=', isLoading, 'planLoading=', planLoading, 'location=', location.pathname);

  if (isLoading || planLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Usuários com planos válidos não precisam ser redirecionados para billing
  // Apenas redirecionar para billing se explicitamente solicitado

  return (
    <div className="min-h-screen bg-gradient-subtle flex w-full">
      {/* Sidebar */}
      <div className={`hidden md:block transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'} sticky top-0 h-screen`}>
        <AppSidebar isCollapsed={!sidebarOpen} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full min-w-0">
        {/* Header */}
        <header className="h-14 md:h-16 bg-card border-b border-border flex items-center justify-between px-3 md:px-6 shadow-soft">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hover:bg-muted"
          >
            <Menu className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden lg:block text-sm text-muted-foreground">
              {new Date().toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
            
            <NotificationsPopover />
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="hover:bg-muted"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 md:h-5 md:w-5" /> : <Moon className="h-4 w-4 md:h-5 md:w-5" />}
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};