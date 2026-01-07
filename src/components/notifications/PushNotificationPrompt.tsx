import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, BellOff, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export const PushNotificationPrompt = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    // Check if browser supports notifications
    if (!("Notification" in window)) {
      return;
    }

    setPermission(Notification.permission);

    // Show prompt only if permission is default and user hasn't dismissed it
    if (Notification.permission === "default") {
      const dismissed = localStorage.getItem("push-notification-dismissed");
      if (!dismissed && user?.id) {
        // Delay showing the prompt for a better UX
        const timer = setTimeout(() => setShowPrompt(true), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [user?.id]);

  const requestPermission = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        // Create a simple subscription record
        // In a production app, you would use a service worker and Web Push API
        const { error } = await supabase
          .from("push_subscriptions")
          .upsert({
            user_id: user.id,
            endpoint: `browser-${navigator.userAgent.slice(0, 50)}`,
            p256dh: "browser-notification",
            auth: "browser-notification",
          }, { onConflict: "user_id,endpoint" });

        if (error) {
          console.error("Error saving push subscription:", error);
        }

        // Update notification preferences
        await supabase
          .from("notification_preferences")
          .upsert({
            user_id: user.id,
            push_enabled: true,
          }, { onConflict: "user_id" });

        toast({
          title: "Notificações ativadas!",
          description: "Você receberá alertas importantes no navegador.",
        });

        // Show a test notification
        new Notification("UNISTOCK", {
          body: "Notificações push ativadas com sucesso!",
          icon: "/favicon.ico",
        });

        setShowPrompt(false);
      } else if (result === "denied") {
        toast({
          title: "Permissão negada",
          description: "Você pode ativar as notificações nas configurações do navegador.",
          variant: "destructive",
        });
        setShowPrompt(false);
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast({
        title: "Erro",
        description: "Não foi possível ativar as notificações.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const dismissPrompt = () => {
    localStorage.setItem("push-notification-dismissed", "true");
    setShowPrompt(false);
  };

  if (!showPrompt || !("Notification" in window)) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 shadow-lg z-50 border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Ativar notificações</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={dismissPrompt}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="text-sm">
          Receba alertas de estoque baixo, erros de sincronização e mais diretamente no navegador.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={requestPermission}
            disabled={isLoading}
          >
            {isLoading ? "Ativando..." : "Ativar"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={dismissPrompt}
          >
            <BellOff className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
