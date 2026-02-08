import { useState, useEffect } from "react";
import { Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Menu, Loader2, Moon, Sun } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useThemeProvider } from "@/components/layout/ThemeProvider";
import { usePlan } from "@/hooks/usePlan";
import { NotificationsPopover } from "@/components/notifications/NotificationsPopover";
import { PushNotificationPrompt } from "@/components/notifications/PushNotificationPrompt";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

export const AppLayout = () => {
  const { user, isLoading, isSessionExpired, forceLogout } = useAuthSession({ requireAuth: true });
  const { theme, toggleTheme } = useThemeProvider();
  const { currentPlan, isLoading: planLoading } = usePlan();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  console.log('🏗️ AppLayout: user=', !!user, 'isLoading=', isLoading, 'planLoading=', planLoading, 'location=', location.pathname);

  // Verificar se sessão expirou
  useEffect(() => {
    if (!isLoading && user && isSessionExpired()) {
      console.log('🔐 AppLayout: Sessão expirada, forçando logout');
      forceLogout(true, "expired");
    }
  }, [isLoading, user, isSessionExpired, forceLogout]);

  // Verificar assinatura ao carregar
  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) {
        setIsCheckingSubscription(false);
        return;
      }

      try {
        // Primeiro verificar se é admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        // Se for admin, libera acesso total
        if (roleData?.role === 'admin') {
          setHasActiveSubscription(true);
          setIsCheckingSubscription(false);
          return;
        }

        // Se não for admin, verificar assinatura normal
        const { data, error } = await supabase.functions.invoke('check-subscription');
        
        if (error) {
          console.error('Erro ao verificar assinatura:', error);
          setIsCheckingSubscription(false);
          return;
        }

        const hasSubscription = data?.subscribed === true;
        setHasActiveSubscription(hasSubscription);
        
        // Se não tem assinatura e não está na página de billing, redireciona para pending-payment
        if (!hasSubscription && location.pathname !== '/app/billing') {
          navigate('/pending-payment', { replace: true });
        }
        
        setIsCheckingSubscription(false);
      } catch (error) {
        console.error('Erro ao verificar assinatura:', error);
        setIsCheckingSubscription(false);
      }
    };

    if (user && !isLoading) {
      checkSubscription();
    }
  }, [user, isLoading, location.pathname, navigate]);

  if (isLoading || planLoading || isCheckingSubscription) {
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
      {/* Sidebar Desktop */}
      <div className={`hidden md:block transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'} sticky top-0 h-screen`}>
        <AppSidebar isCollapsed={!sidebarOpen} />
      </div>

      {/* Mobile Menu Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <AppSidebar isCollapsed={false} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full min-w-0">
        {/* Header */}
        <header className="h-14 md:h-16 bg-card border-b border-border flex items-center justify-between px-3 md:px-6 shadow-soft">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => isMobile ? setMobileMenuOpen(true) : setSidebarOpen(!sidebarOpen)}
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

      {/* Push Notification Prompt */}
      <PushNotificationPrompt />

      {/* Onboarding Wizard - shows only once for new users */}
      <OnboardingWizard 
        userName={user?.user_metadata?.full_name || user?.user_metadata?.name} 
        userId={user?.id} 
      />
    </div>
  );
};