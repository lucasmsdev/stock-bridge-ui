import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Plus, Settings, Unlink, ExternalLink, CheckCircle2, Plug, Loader2, Lock, Download, Key, RefreshCw, Clock, AlertTriangle, ShieldAlert, Megaphone } from "lucide-react";
import { useThemeProvider } from "@/components/layout/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlatformLogo } from "@/components/ui/platform-logo";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlan } from "@/hooks/usePlan";
import { UpgradeBanner } from "@/components/ui/upgrade-banner";
import { AmazonSelfAuthDialog } from "@/components/integrations/AmazonSelfAuthDialog";
import { AmazonSellerIdDialog } from "@/components/integrations/AmazonSellerIdDialog";
import { TokenStatusBadge, getTimeUntilExpiry } from "@/components/integrations/TokenStatusBadge";
import { useOrgRole } from "@/hooks/useOrgRole";
import { TikTokSandboxDialog } from "@/components/integrations/TikTokSandboxDialog";

// Integration type
interface IntegrationPlatform {
  id: string;
  name: string;
  description: string;
  logoUrl: string;
  darkLogoUrl?: string;
  comingSoon?: boolean;
}

// Integration categories
const marketplaceIntegrations: IntegrationPlatform[] = [
  {
    id: "mercadolivre",
    name: "Mercado Livre",
    description: "Integração completa com o maior marketplace da América Latina",
    logoUrl: "https://vectorseek.com/wp-content/uploads/2023/08/Mercado-Livre-Icon-Logo-Vector.svg-.png",
  },
  {
    id: "shopee",
    name: "Shopee",
    description: "Conecte-se ao maior marketplace de vendas online do Sudeste Asiático",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Shopee_logo.svg/1442px-Shopee_logo.svg.png",
  },
  {
    id: "amazon",
    name: "Amazon",
    description: "Venda seus produtos na maior plataforma de e-commerce do mundo",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/de/Amazon_icon.png",
    darkLogoUrl: "https://www.pngmart.com/files/23/Amazon-Logo-White-PNG-Photos.png",
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "Conecte sua loja Shopify para sincronização de produtos e pedidos",
    logoUrl: "https://cdn.freebiesupply.com/logos/large/2x/shopify-logo-png-transparent.png",
  },
  {
    id: "shein",
    name: "Shein",
    description: "Integração com o marketplace de moda mais popular do mundo",
    logoUrl: "/logos/shein.png",
    comingSoon: true,
  },
  {
    id: "tiktokshop",
    name: "TikTok Shop",
    description: "Venda diretamente pelo TikTok com integração de catálogo e pedidos",
    logoUrl: "/logos/tiktok-shop.png",
    comingSoon: true,
  },
  {
    id: "magalu",
    name: "Magalu",
    description: "Conecte-se ao marketplace da Magazine Luiza e expanda suas vendas",
    logoUrl: "/logos/magalu.png",
  },
];

const adsIntegrations: IntegrationPlatform[] = [
  {
    id: "meta_ads",
    name: "Meta Ads",
    description: "Facebook e Instagram Ads - métricas de campanhas publicitárias",
    logoUrl: "/logos/meta-ads.png",
  },
  {
    id: "google_ads",
    name: "Google Ads",
    description: "Métricas de campanhas do Google Ads - pesquisa, display e shopping",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Google_Ads_logo.svg",
  },
  {
    id: "tiktok_ads",
    name: "TikTok Ads",
    description: "Métricas de campanhas do TikTok Ads - vídeos e performance",
    logoUrl: "https://sf-tb-sg.ibytedtos.com/obj/eden-sg/uhtyvueh7nulogpoguhm/tiktok-icon2.png",
  },
];

// Combined for backward compatibility
const availableIntegrations: IntegrationPlatform[] = [...marketplaceIntegrations, ...adsIntegrations];

export default function Integrations() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [connectedIntegrations, setConnectedIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [amazonSelfAuthOpen, setAmazonSelfAuthOpen] = useState(false);
  const [tiktokSandboxOpen, setTiktokSandboxOpen] = useState(false);
  const [amazonSellerIdDialog, setAmazonSellerIdDialog] = useState<{ open: boolean; integrationId: string; currentSellerId?: string | null }>({
    open: false,
    integrationId: "",
    currentSellerId: null,
  });
  const [lastSyncTimes, setLastSyncTimes] = useState<Record<string, string | null>>({});
  const { toast } = useToast();
  const { canAccess, getUpgradeRequiredMessage } = usePlan();
  const { theme } = useThemeProvider();
  const { canManageIntegrations, isLoading: roleLoading } = useOrgRole();

  // Redirect non-admins
  useEffect(() => {
    if (!roleLoading && !canManageIntegrations) {
      toast({
        title: "Acesso restrito",
        description: "Apenas administradores podem gerenciar integrações.",
        variant: "destructive",
      });
      navigate('/app/dashboard');
    }
  }, [roleLoading, canManageIntegrations, navigate, toast]);

  useEffect(() => {
    loadConnectedIntegrations();

    // Check for success/error status from OAuth callback
    const status = searchParams.get("status");
    if (status === "success") {
      toast({
        title: "Integração conectada!",
        description: "Sua loja foi conectada com sucesso.",
      });
      // Remove status param from URL
      setSearchParams({});
    } else if (status === "error") {
      toast({
        title: "Erro na integração",
        description: "Não foi possível conectar. Tente novamente.",
        variant: "destructive",
      });
      setSearchParams({});
    } else if (status === "duplicate") {
      toast({
        title: "Conta já conectada",
        description:
          "Esta conta já está conectada ao seu UniStock. Você pode renomeá-la para diferenciá-la de outras contas.",
        variant: "default",
      });
      setSearchParams({});
    }
  }, []);

  const loadConnectedIntegrations = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: integrations, error } = await supabase.from("integrations").select("*").eq("user_id", user.id);

      if (error) {
        console.error("Error loading integrations:", error);
        toast({
          title: "Erro ao carregar integrações",
          description: "Não foi possível carregar suas integrações conectadas.",
          variant: "destructive",
        });
        return;
      }

      // Only show integrations that have valid encrypted access tokens
      const validIntegrations = (integrations || []).filter(
        (integration) => integration.encrypted_access_token != null,
      );

      // Update account names for integrations that don't have it
      for (const integration of validIntegrations) {
        if (!integration.account_name || integration.account_name.trim() === "") {
          try {
            if (integration.platform === "mercadolivre") {
              // For encrypted tokens, we can't fetch account name from client-side
              // The account name should have been set during OAuth callback
              // Set a default if missing
              if (!integration.account_name) {
                const accountName = "Conta Mercado Livre";
                await supabase.from("integrations").update({ account_name: accountName }).eq("id", integration.id);
                integration.account_name = accountName;
              }
            } else if (integration.platform === "amazon") {
              // For Amazon, we'll set a default name for now
              const accountName = integration.selling_partner_id || "Conta Amazon";
              await supabase.from("integrations").update({ account_name: accountName }).eq("id", integration.id);
              integration.account_name = accountName;
            } else if (integration.platform === "shopify") {
              const accountName = integration.shop_domain || "Loja Shopify";
              await supabase.from("integrations").update({ account_name: accountName }).eq("id", integration.id);
              integration.account_name = accountName;
            } else if (integration.platform === "magalu") {
              const accountName = "Conta Magalu";
              await supabase.from("integrations").update({ account_name: accountName }).eq("id", integration.id);
              integration.account_name = accountName;
            } else if (integration.platform === "tiktokshop") {
              const accountName = "Conta TikTok Shop";
              await supabase.from("integrations").update({ account_name: accountName }).eq("id", integration.id);
              integration.account_name = accountName;
            } else if (integration.platform === "google_ads") {
              const accountName = "Conta Google Ads";
              await supabase.from("integrations").update({ account_name: accountName }).eq("id", integration.id);
              integration.account_name = accountName;
            } else if (integration.platform === "tiktok_ads") {
              const accountName = "Conta TikTok Ads";
              await supabase.from("integrations").update({ account_name: accountName }).eq("id", integration.id);
              integration.account_name = accountName;
            }
          } catch (err) {
            console.error(`Error updating account name for ${integration.platform}:`, err);
          }
        }
      }

      setConnectedIntegrations(validIntegrations);
    } catch (error) {
      console.error("Unexpected error loading integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platformId: string) => {
    console.log("handleConnect called with platformId:", platformId);
    // All users can access integrations - no restrictions

    if (platformId === "mercadolivre") {
      const appId = "5615590729373432";
      const redirectUri = `${window.location.origin}/callback/mercadolivre`;
      const authUrl = `https://auth.mercadolibre.com/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      // Redirect to Mercado Livre authorization page
      window.location.href = authUrl;
    } else if (platformId === "amazon") {
      // Usar Self-Authorization enquanto aguarda aprovação do app
      // OAuth de terceiros requer aprovação da Amazon App Store
      setAmazonSelfAuthOpen(true);
    } else if (platformId === "shopify") {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Faça login para conectar integrações.",
          variant: "destructive",
        });
        return;
      }

      // Prompt for shop domain
      const shopDomain = prompt(
        "Digite o domínio da sua loja Shopify (ex: minhaloja):\n\n" +
          "Se sua loja é https://minhaloja.myshopify.com, digite apenas: minhaloja",
      );

      if (!shopDomain || shopDomain.trim() === "") {
        toast({
          title: "Domínio inválido",
          description: "Você precisa informar o domínio da sua loja Shopify.",
          variant: "destructive",
        });
        return;
      }

      // Clean domain (remove .myshopify.com if user typed it)
      const cleanDomain = shopDomain.trim().replace(".myshopify.com", "");

      console.log("🛍️ Iniciando fluxo OAuth Shopify...");

      // Configure Shopify OAuth URL
      // TODO: Substitua 'YOUR_SHOPIFY_CLIENT_ID' pelo seu Client ID real da app Shopify
      const shopifyClientId = "517f48d78655be55a0308aa81730221f";
      const callbackUrl = `https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/shopify-callback`;
      const scopes = "read_products,write_products,read_orders,write_orders,read_inventory,write_inventory";
      const nonce = user.id; // Use user_id as state for validation

      const authUrl =
        `https://${cleanDomain}.myshopify.com/admin/oauth/authorize` +
        `?client_id=${shopifyClientId}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
        `&state=${nonce}`;

      console.log("🔄 Redirecionando para Shopify Admin...");

      // Redirect to Shopify authorization page
      window.location.href = authUrl;
    } else if (platformId === "magalu") {
      // Magalu OAuth flow
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Faça login para conectar integrações.",
          variant: "destructive",
        });
        return;
      }

      console.log("🟣 Iniciando fluxo OAuth Magalu...");

      const magaluClientId = "857769e2-779c-4ebd-a9ac-2e3ee7337a5b";
      const redirectUri = `${window.location.origin}/callback/magalu`;
      const scopes = "portfolios:read portfolios:write orders:read conversations:read conversations:write";

      const authUrl =
        `https://id.magalu.com/login` +
        `?client_id=${encodeURIComponent(magaluClientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&response_type=code` +
        `&choose_tenants=true`;

      console.log("🔄 Redirecionando para Magalu ID...");
      window.location.href = authUrl;
    } else if (platformId === "meta_ads") {
      // Meta Ads OAuth flow
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Faça login para conectar integrações.",
          variant: "destructive",
        });
        return;
      }

      console.log("🔵 Iniciando fluxo OAuth Meta Ads...");

      // Meta App ID - substitua pelo seu App ID do Meta Developer Portal
      // Como é público (similar ao Mercado Livre), pode ficar no frontend
      const metaAppId = "1414008656796817";
      const callbackUrl = `https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/meta-ads-auth`;
      const scopes = "ads_read,ads_management,business_management";

      const authUrl =
        `https://www.facebook.com/v21.0/dialog/oauth` +
        `?client_id=${metaAppId}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&state=${user.id}`;

      console.log("🔄 Redirecionando para Facebook Login...");
      window.location.href = authUrl;
    } else if (platformId === "google_ads") {
      // Google Ads OAuth flow
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Faça login para conectar integrações.",
          variant: "destructive",
        });
        return;
      }

      console.log("🟢 Iniciando fluxo OAuth Google Ads...");

      const googleClientId = "92454322738-oukciv82rs0h2fg75hhg65hdl87h17rh.apps.googleusercontent.com";
      const callbackUrl = `https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/google-ads-auth`;
      const scopes = "https://www.googleapis.com/auth/adwords";

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${googleClientId}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&response_type=code` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${user.id}`;

      console.log("🔄 Redirecionando para Google OAuth...");
      window.location.href = authUrl;
    } else if (platformId === "tiktokshop") {
      // TikTok Shop OAuth flow
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Faça login para conectar integrações.",
          variant: "destructive",
        });
        return;
      }

      console.log("🎵 Iniciando fluxo OAuth TikTok Shop...");

      // TikTok Shop App Key - chave pública da aplicação UNISTOCK
      const tiktokAppKey = "6j0biv1696bcn";

      const authUrl =
        `https://services.tiktokshop.com/open/authorize` +
        `?service_id=${tiktokAppKey}`;

      console.log("🔄 Redirecionando para TikTok Shop...");
      window.location.href = authUrl;
    } else if (platformId === "tiktok_ads") {
      // TikTok Ads OAuth flow
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Faça login para conectar integrações.",
          variant: "destructive",
        });
        return;
      }

      console.log("🎵 Iniciando fluxo TikTok Ads...");

      // Fluxo OAuth de produção
      const tiktokAdsAppId = "7604695140725751824";
      const callbackUrl = `https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/tiktok-ads-auth`;
      const stateParam = `${user.id}`;

      const authUrl =
        `https://business-api.tiktok.com/portal/auth` +
        `?app_id=${tiktokAdsAppId}` +
        `&state=${stateParam}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}`;

      console.log('🔄 Redirecionando para TikTok Business...');
      window.location.href = authUrl;
    } else if (platformId === "shopee") {
      // Shopee OAuth flow via Edge Function
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Faça login para conectar integrações.",
          variant: "destructive",
        });
        return;
      }

      console.log("🟠 Iniciando fluxo OAuth Shopee...");

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data, error } = await supabase.functions.invoke("shopee-auth", {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });

        if (error || !data?.url) {
          console.error("Shopee auth error:", error || data);
          toast({
            title: "Erro ao conectar Shopee",
            description: "Não foi possível iniciar a autorização. Tente novamente.",
            variant: "destructive",
          });
          return;
        }

        console.log("🔄 Redirecionando para Shopee...");
        window.location.href = data.url;
      } catch (err) {
        console.error("Shopee auth error:", err);
        toast({
          title: "Erro ao conectar Shopee",
          description: "Erro inesperado. Tente novamente.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Em desenvolvimento",
        description: `A integração com ${platformId} estará disponível em breve.`,
      });
    }
  };

  const handleImportProducts = async (integrationId: string, platform: string, accountName?: string) => {
    try {
      setImportingId(integrationId);

      const accountDisplay = accountName || platform;

      toast({
        title: "Iniciando importação...",
        description: `Buscando produtos de ${accountDisplay}`,
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Faça login para importar produtos.",
          variant: "destructive",
        });
        setImportingId(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke("import-products", {
        body: { integration_id: integrationId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Error importing products:", error);

        const contextBody = (error as any)?.context?.body;
        let details: string | null = null;

        if (contextBody) {
          try {
            const parsed = typeof contextBody === 'string' ? JSON.parse(contextBody) : contextBody;
            details = parsed?.error || parsed?.details || parsed?.message || null;
          } catch {
            details = typeof contextBody === 'string' ? contextBody : JSON.stringify(contextBody);
          }
        }

        toast({
          title: "Erro ao importar",
          description: details || error.message || "Não foi possível importar os produtos.",
          variant: "destructive",
        });
        setImportingId(null);
        return;
      }

      toast({
        title: "Importação concluída!",
        description: `${data.imported || 0} produtos importados de ${accountDisplay}.`,
      });

      // Reload products or update UI as needed
      await loadConnectedIntegrations();
    } catch (error) {
      console.error("Unexpected error importing products:", error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao importar os produtos.",
        variant: "destructive",
      });
    } finally {
      setImportingId(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      setDisconnectingId(integrationId);

      const { error } = await supabase.from("integrations").delete().eq("id", integrationId);

      if (error) {
        console.error("Error disconnecting integration:", error);
        toast({
          title: "Erro ao desconectar",
          description: "Não foi possível desconectar a integração. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Integração desconectada",
        description: "A integração foi removida com sucesso.",
      });

      // Reload integrations
      await loadConnectedIntegrations();
    } catch (error) {
      console.error("Unexpected error disconnecting integration:", error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao desconectar a integração.",
        variant: "destructive",
      });
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleSyncOrders = async (integrationId: string, platform: string, accountName?: string) => {
    try {
      setSyncingId(integrationId);
      const accountDisplay = accountName || platform;

      toast({
        title: "Sincronizando pedidos...",
        description: `Buscando pedidos de ${accountDisplay}`,
      });

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Faça login para sincronizar pedidos.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("sync-orders", {
        body: { platform, days_since: 30 },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Error syncing orders:", error);
        toast({
          title: "Erro ao sincronizar",
          description: error.message || "Não foi possível sincronizar os pedidos.",
          variant: "destructive",
        });
        return;
      }

      // Update last sync time
      setLastSyncTimes(prev => ({
        ...prev,
        [integrationId]: new Date().toISOString()
      }));

      const platformResult = data?.results?.find((r: any) => r.platform === platform);
      const syncedCount = platformResult?.orders_synced || data?.total_synced || 0;
      const newCount = platformResult?.new_orders || data?.new_orders || 0;

      toast({
        title: "Sincronização concluída!",
        description: `${syncedCount} pedidos sincronizados${newCount > 0 ? `, ${newCount} novos` : ""} de ${accountDisplay}.`,
      });
    } catch (error) {
      console.error("Unexpected error syncing orders:", error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao sincronizar os pedidos.",
        variant: "destructive",
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAllOrders = async () => {
    try {
      setSyncingAll(true);

      toast({
        title: "Sincronizando todos os pedidos...",
        description: "Buscando pedidos de todas as integrações",
      });

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Faça login para sincronizar pedidos.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("sync-orders", {
        body: { days_since: 30 },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Error syncing all orders:", error);
        toast({
          title: "Erro ao sincronizar",
          description: error.message || "Não foi possível sincronizar os pedidos.",
          variant: "destructive",
        });
        return;
      }

      // Update all last sync times
      const now = new Date().toISOString();
      const newSyncTimes: Record<string, string> = {};
      connectedIntegrations.forEach(int => {
        newSyncTimes[int.id] = now;
      });
      setLastSyncTimes(prev => ({ ...prev, ...newSyncTimes }));

      toast({
        title: "Sincronização concluída!",
        description: `${data?.total_synced || 0} pedidos sincronizados, ${data?.new_orders || 0} novos.`,
      });
    } catch (error) {
      console.error("Unexpected error syncing all orders:", error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao sincronizar os pedidos.",
        variant: "destructive",
      });
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Integrações de Canais</h1>
          <p className="text-muted-foreground">Conecte e gerencie seus canais de venda em um só lugar</p>
        </div>
        {connectedIntegrations.filter((i: any) => !['meta_ads', 'google_ads', 'tiktok_ads'].includes(i.platform)).length > 0 && (
          <Button
            onClick={handleSyncAllOrders}
            disabled={syncingAll || syncingId !== null}
            className="bg-gradient-primary"
          >
            {syncingAll ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sincronizar Todos os Pedidos
              </>
            )}
          </Button>
        )}
      </div>

      {/* Auto Sync Info */}
      {connectedIntegrations.length > 0 && (
        <Card className="shadow-soft border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Sincronização Automática Ativa</p>
                <p className="text-sm text-muted-foreground">
                  Seus pedidos são sincronizados automaticamente a cada 30 minutos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected Integrations */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Canais Conectados</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : connectedIntegrations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {connectedIntegrations.map((integration: any) => {
              const platformConfig = availableIntegrations.find((p) => p.id === integration.platform);
              const logoUrl = theme === 'dark' && platformConfig?.darkLogoUrl 
                ? platformConfig.darkLogoUrl 
                : platformConfig?.logoUrl;
              
              return (
                <Card
                  key={integration.id}
                  className={`shadow-soft hover:shadow-medium transition-all duration-200 ${
                    importingId === integration.id
                      ? "ring-2 ring-primary animate-pulse"
                      : "hover:scale-[1.02] hover:-translate-y-1"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="hover:scale-110 transition-transform">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={`${integration.platform} logo`}
                              className="h-8 w-auto"
                            />
                          ) : (
                            <PlatformLogo platform={integration.platform} size="lg" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg capitalize">{integration.platform.replace('_', ' ')}</CardTitle>
                          {integration.account_name && (
                            <CardDescription className="font-medium">
                              {integration.account_nickname || integration.account_name}
                            </CardDescription>
                          )}
                          <CardDescription className="text-xs">
                            Conectado em {new Date(integration.created_at).toLocaleDateString("pt-BR")}
                          </CardDescription>
                        </div>
                      </div>
                      {importingId === integration.id ? (
                        <Badge variant="secondary" className="bg-primary text-primary-foreground animate-pulse">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Importando
                        </Badge>
                      ) : (
                        <TokenStatusBadge 
                          platform={integration.platform}
                          tokenExpiresAt={integration.token_expires_at}
                          updatedAt={integration.updated_at}
                        />
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Conectado: {new Date(integration.created_at).toLocaleDateString("pt-BR")}</span>
                      <div className="flex items-center gap-2">
                        {integration.token_expires_at && integration.platform !== 'shopify' && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Expira: {getTimeUntilExpiry(integration.token_expires_at)}
                          </span>
                        )}
                        {lastSyncTimes[integration.id] && (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            Sync: {new Date(lastSyncTimes[integration.id]!).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>

                        <Separator />

                        {/* Amazon Seller ID Warning */}
                        {integration.platform === 'amazon' && !integration.selling_partner_id && (
                          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-sm">
                              <span className="font-medium">Seller ID não configurado.</span>
                              <br />
                              <span className="text-muted-foreground">Sincronização de preços/estoque desabilitada.</span>
                            </AlertDescription>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-2 w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                              onClick={() => setAmazonSellerIdDialog({
                                open: true,
                                integrationId: integration.id,
                                currentSellerId: integration.selling_partner_id,
                              })}
                            >
                              <Key className="w-4 h-4 mr-2" />
                              Configurar Seller ID
                            </Button>
                          </Alert>
                        )}

                        {/* Amazon Seller ID Configured */}
                        {integration.platform === 'amazon' && integration.selling_partner_id && (
                          <div className="flex items-center justify-between p-2 rounded-md bg-green-500/10 border border-green-500/20">
                            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Seller ID: {integration.selling_partner_id.slice(0, 4)}***{integration.selling_partner_id.slice(-4)}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setAmazonSellerIdDialog({
                                open: true,
                                integrationId: integration.id,
                                currentSellerId: integration.selling_partner_id,
                              })}
                            >
                              Editar
                            </Button>
                          </div>
                        )}

                        {/* Ads platforms: show "Sincronizar Métricas" instead of import/sync */}
                        {['meta_ads', 'google_ads', 'tiktok_ads'].includes(integration.platform) ? (
                          <>
                            <Separator />
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => navigate('/app/dashboard?tab=ads')}
                            >
                              <Megaphone className="w-4 h-4 mr-2" />
                              Sincronizar Métricas
                            </Button>
                          </>
                        ) : (
                          <>
                            <Separator />
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() =>
                                handleSyncOrders(
                                  integration.id,
                                  integration.platform,
                                  integration.account_nickname || integration.account_name,
                                )
                              }
                              disabled={syncingId === integration.id || syncingAll}
                            >
                              {syncingId === integration.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  <span className="animate-pulse">Sincronizando...</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Sincronizar Pedidos
                                </>
                              )}
                            </Button>

                            {/* Import Products Button - only for marketplaces */}
                            <Button
                              variant="default"
                              size="sm"
                              className="w-full bg-gradient-primary relative overflow-hidden"
                              onClick={() =>
                                handleImportProducts(
                                  integration.id,
                                  integration.platform,
                                  integration.account_nickname || integration.account_name,
                                )
                              }
                              disabled={importingId === integration.id}
                            >
                              {importingId === integration.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  <span className="animate-pulse">Importando...</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-4 h-4 mr-2" />
                                  Importar Produtos
                                </>
                              )}
                            </Button>
                          </>
                        )}

                        <Separator />

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            disabled={importingId === integration.id}
                            onClick={() => {
                              const newNickname = prompt(
                                "Digite um apelido para identificar esta conta:",
                                integration.account_nickname || integration.account_name || integration.platform,
                              );
                              if (newNickname && newNickname.trim()) {
                                supabase
                                  .from("integrations")
                                  .update({ account_nickname: newNickname.trim() })
                                  .eq("id", integration.id)
                                  .then(({ error }) => {
                                    if (error) {
                                      toast({
                                        title: "Erro ao atualizar apelido",
                                        description: "Não foi possível atualizar o apelido da conta.",
                                        variant: "destructive",
                                      });
                                    } else {
                                      toast({
                                        title: "Apelido atualizado",
                                        description: "O apelido da conta foi atualizado com sucesso.",
                                      });
                                      loadConnectedIntegrations();
                                    }
                                  });
                              }
                            }}
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Editar Apelido
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={disconnectingId === integration.id || importingId === integration.id}
                              >
                                {disconnectingId === integration.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Unlink className="w-4 h-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Desconectar Integração</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja desconectar esta conta de {integration.platform}
                                  {integration.account_nickname && ` (${integration.account_nickname})`}? Esta ação
                                  interromperá a sincronização automática de produtos e pedidos desta conta específica.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDisconnect(integration.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Desconectar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="shadow-soft">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="max-w-md mx-auto">
                <Plug className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
                <h3 className="text-xl font-semibold text-foreground mb-2">Nenhuma integração conectada</h3>
                <p className="text-muted-foreground mb-6">
                  Conecte seu primeiro canal de vendas para começar a sincronizar produtos e pedidos automaticamente.
                </p>
                <Button className="bg-gradient-primary hover:bg-primary-hover hover:shadow-primary transition-all duration-200">
                  <Plus className="mr-2 h-4 w-4" />
                  Conectar Primeiro Canal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Available Integrations - Marketplaces */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Marketplaces</h2>
          <Badge variant="outline">{marketplaceIntegrations.length} plataformas</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {marketplaceIntegrations.map((platform, index) => {
            const connectedCount = connectedIntegrations.filter((c) => c.platform === platform.id).length;
            const isConnected = connectedCount > 0;

            return (
              <Card
                key={platform.id}
                className={`shadow-soft hover:shadow-medium transition-all duration-200 group hover:scale-[1.02] hover:-translate-y-1 flex flex-col ${platform.comingSoon ? 'opacity-70' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader className="pb-3 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="group-hover:scale-110 transition-transform">
                        <img
                          src={theme === 'dark' && platform.darkLogoUrl ? platform.darkLogoUrl : platform.logoUrl}
                          alt={`${platform.name} logo`}
                          className="h-8 w-auto"
                        />
                      </div>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {platform.name}
                          {platform.comingSoon && (
                            <Badge variant="outline" className="bg-muted text-muted-foreground">
                              Em breve
                            </Badge>
                          )}
                        </CardTitle>
                      </div>
                    </div>
                  </div>
                  {isConnected && (
                    <Badge variant="outline" className="w-fit bg-green-500/10 text-green-600 border-green-500/20">
                      {connectedCount} {connectedCount === 1 ? "conectada" : "conectadas"}
                    </Badge>
                  )}
                  <CardDescription className="text-sm">{platform.description}</CardDescription>
                </CardHeader>

                <CardContent className="mt-auto">
                  {platform.comingSoon ? (
                    <Button
                      disabled
                      className="w-full"
                      variant="outline"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Em breve
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleConnect(platform.id)}
                      className="w-full bg-gradient-primary hover:bg-primary-hover group-hover:shadow-primary transition-all duration-200 hover:scale-[1.02]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {isConnected ? `Conectar Outra` : `Conectar`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Available Integrations - Ads */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Plataformas de Anúncios</h2>
          <Badge variant="outline">{adsIntegrations.length} plataformas</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {adsIntegrations.map((platform, index) => {
            const connectedCount = connectedIntegrations.filter((c) => c.platform === platform.id).length;
            const isConnected = connectedCount > 0;

            return (
              <Card
                key={platform.id}
                className={`shadow-soft hover:shadow-medium transition-all duration-200 group hover:scale-[1.02] hover:-translate-y-1 flex flex-col ${platform.comingSoon ? 'opacity-70' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader className="pb-3 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="group-hover:scale-110 transition-transform">
                        <img
                          src={theme === 'dark' && platform.darkLogoUrl ? platform.darkLogoUrl : platform.logoUrl}
                          alt={`${platform.name} logo`}
                          className="h-8 w-auto"
                        />
                      </div>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {platform.name}
                          {platform.comingSoon && (
                            <Badge variant="outline" className="bg-muted text-muted-foreground">
                              Em breve
                            </Badge>
                          )}
                        </CardTitle>
                      </div>
                    </div>
                  </div>
                  {isConnected && (
                    <Badge variant="outline" className="w-fit bg-green-500/10 text-green-600 border-green-500/20">
                      {connectedCount} {connectedCount === 1 ? "conectada" : "conectadas"}
                    </Badge>
                  )}
                  <CardDescription className="text-sm">{platform.description}</CardDescription>
                </CardHeader>

                <CardContent className="mt-auto">
                  {platform.comingSoon ? (
                    <Button
                      disabled
                      className="w-full"
                      variant="outline"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Em breve
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleConnect(platform.id)}
                      className="w-full bg-gradient-primary hover:bg-primary-hover group-hover:shadow-primary transition-all duration-200 hover:scale-[1.02]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {isConnected ? `Conectar Outra` : `Conectar`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Help Section */}
      <Card className="shadow-soft border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            Precisa de Ajuda?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Não encontrou sua plataforma? Entre em contato conosco para solicitar uma nova integração ou consulte nossa
            documentação para mais informações.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => (window.location.href = "/help")}>
              Ver Documentação
            </Button>
            <Button variant="outline">Contatar Suporte</Button>
          </div>
        </CardContent>
      </Card>

      {/* Amazon Self-Auth Dialog */}
      <AmazonSelfAuthDialog
        open={amazonSelfAuthOpen}
        onOpenChange={setAmazonSelfAuthOpen}
        onSuccess={loadConnectedIntegrations}
      />

      {/* Amazon Seller ID Dialog */}
      <AmazonSellerIdDialog
        open={amazonSellerIdDialog.open}
        onOpenChange={(open) => setAmazonSellerIdDialog(prev => ({ ...prev, open }))}
        onSuccess={loadConnectedIntegrations}
        integrationId={amazonSellerIdDialog.integrationId}
        currentSellerId={amazonSellerIdDialog.currentSellerId}
      />

      {/* TikTok Ads Sandbox Dialog */}
      <TikTokSandboxDialog
        open={tiktokSandboxOpen}
        onOpenChange={setTiktokSandboxOpen}
        onSuccess={loadConnectedIntegrations}
      />
    </div>
  );
}
