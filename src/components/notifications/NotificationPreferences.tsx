import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Bell, Mail, Smartphone, Package, RefreshCcw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface NotificationPreferencesData {
  email_enabled: boolean;
  push_enabled: boolean;
  low_stock_alerts: boolean;
  token_expiring_alerts: boolean;
  sync_error_alerts: boolean;
}

export const NotificationPreferences = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferencesData>({
    email_enabled: true,
    push_enabled: true,
    low_stock_alerts: true,
    token_expiring_alerts: true,
    sync_error_alerts: true,
  });

  useEffect(() => {
    if (user?.id) {
      fetchPreferences();
    }
  }, [user?.id]);

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setPreferences({
          email_enabled: data.email_enabled,
          push_enabled: data.push_enabled,
          low_stock_alerts: data.low_stock_alerts,
          token_expiring_alerts: data.token_expiring_alerts,
          sync_error_alerts: data.sync_error_alerts,
        });
      }
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferencesData, value: boolean) => {
    if (!user?.id) return;

    setIsSaving(true);
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          ...newPreferences,
        }, { onConflict: "user_id" });

      if (error) throw error;

      toast({
        title: "Preferências salvas",
        description: "Suas preferências de notificação foram atualizadas.",
      });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      setPreferences(preferences); // Revert on error
      toast({
        title: "Erro",
        description: "Não foi possível salvar as preferências.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Preferências de Notificação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Preferências de Notificação
        </CardTitle>
        <CardDescription>
          Configure como você deseja receber alertas e notificações.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Canais de Notificação */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Canais de Notificação</h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="email_enabled" className="flex flex-col gap-1">
                <span>Notificações por Email</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Receba alertas importantes no seu email
                </span>
              </Label>
            </div>
            <Switch
              id="email_enabled"
              checked={preferences.email_enabled}
              onCheckedChange={(value) => updatePreference("email_enabled", value)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="push_enabled" className="flex flex-col gap-1">
                <span>Notificações Push</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Receba alertas no navegador em tempo real
                </span>
              </Label>
            </div>
            <Switch
              id="push_enabled"
              checked={preferences.push_enabled}
              onCheckedChange={(value) => updatePreference("push_enabled", value)}
              disabled={isSaving}
            />
          </div>
        </div>

        <Separator />

        {/* Tipos de Alerta */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Tipos de Alerta</h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="low_stock_alerts" className="flex flex-col gap-1">
                <span>Estoque Baixo</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Alerta quando produtos atingem estoque crítico
                </span>
              </Label>
            </div>
            <Switch
              id="low_stock_alerts"
              checked={preferences.low_stock_alerts}
              onCheckedChange={(value) => updatePreference("low_stock_alerts", value)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCcw className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="token_expiring_alerts" className="flex flex-col gap-1">
                <span>Token Expirando</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Alerta quando tokens de integração vão expirar
                </span>
              </Label>
            </div>
            <Switch
              id="token_expiring_alerts"
              checked={preferences.token_expiring_alerts}
              onCheckedChange={(value) => updatePreference("token_expiring_alerts", value)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="sync_error_alerts" className="flex flex-col gap-1">
                <span>Erros de Sincronização</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Alerta quando há falhas na sincronização com marketplaces
                </span>
              </Label>
            </div>
            <Switch
              id="sync_error_alerts"
              checked={preferences.sync_error_alerts}
              onCheckedChange={(value) => updatePreference("sync_error_alerts", value)}
              disabled={isSaving}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
