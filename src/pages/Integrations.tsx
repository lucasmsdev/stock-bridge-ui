import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Settings, Unlink, ExternalLink, CheckCircle2, Plug, Loader2, Lock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

// Mock data
const availableIntegrations = [
  {
    id: "mercadolivre",
    name: "Mercado Livre",
    description: "Integração completa com o maior marketplace da América Latina",
    popular: true,
    logoUrl: "https://vectorseek.com/wp-content/uploads/2023/08/Mercado-Livre-Icon-Logo-Vector.svg-.png",
  },
  {
    id: "shopee",
    name: "Shopee",
    description: "Conecte-se ao maior marketplace de vendas online do Sudeste Asiático",
    popular: true,
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Shopee_logo.svg/1442px-Shopee_logo.svg.png",
  },
  {
    id: "amazon",
    name: "Amazon",
    description: "Venda seus produtos na maior plataforma de e-commerce do mundo",
    popular: true,
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/de/Amazon_icon.png",
    darkInvert: true,
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "Conecte sua loja Shopify para sincronização de produtos e pedidos",
    popular: false,
    logoUrl: "https://cdn.freebiesupply.com/logos/large/2x/shopify-logo-png-transparent.png",
  },
];

export default function Integrations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [connectedIntegrations, setConnectedIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { canAccess, getUpgradeRequiredMessage } = usePlan();

  useEffect(() => {
    loadConnectedIntegrations();
    
    // Check for success/error status from OAuth callback
    const status = searchParams.get('status');
    if (status === 'success') {
      toast({
        title: "Integração conectada!",
        description: "Sua loja foi conectada com sucesso.",
      });
      // Remove status param from URL
      setSearchParams({});
    } else if (status === 'error') {
      toast({
        title: "Erro na integração",
        description: "Não foi possível conectar. Tente novamente.",
        variant: "destructive",
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

      // Only show integrations that have valid access tokens
      const validIntegrations = (integrations || []).filter(
        (integration) => integration.access_token && integration.access_token.trim() !== "",
      );

      // Update account names for integrations that don't have it
      for (const integration of validIntegrations) {
        if (!integration.account_name || integration.account_name.trim() === "") {
          try {
            if (integration.platform === "mercadolivre") {
              // Fetch Mercado Livre account name
              const response = await fetch("https://api.mercadolibre.com/users/me", {
                headers: {
                  Authorization: `Bearer ${integration.access_token}`,
                },
              });

              if (response.ok) {
                const userData = await response.json();
                const accountName = userData.nickname || userData.first_name || "Conta Mercado Livre";

                // Update in database
                await supabase.from("integrations").update({ account_name: accountName }).eq("id", integration.id);

                integration.account_name = accountName;
              }
            } else if (integration.platform === "amazon") {
              // For Amazon, we'll set a default name for now
              const accountName = "Conta Amazon";
              await supabase.from("integrations").update({ account_name: accountName }).eq("id", integration.id);

              integration.account_name = accountName;
            }
          } catch (err) {
            console.error(`Error fetching account name for ${integration.platform}:`, err);
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
      // Obter user_id atual
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

      console.log("🔐 Iniciando fluxo OAuth Amazon...");

      // Configurar URL de autorização OAuth da Amazon
      const amazonApplicationId = "amzn1.sp.solution.0c710273-638d-46c9-9060-8448f1ceaeea";
      const callbackUrl = `https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/amazon-callback`;

      const authUrl =
        `https://sellercentral.amazon.com/apps/authorize/consent` +
        `?application_id=${amazonApplicationId}` +
        `&state=${user.id}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
        `&version=beta`;

      console.log("🔄 Redirecionando para Amazon Seller Central...");

      // Redirecionar para página de autorização da Amazon
      window.location.href = authUrl;
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
    } else {
      // Mock connection logic for other platforms
      toast({
        title: "Em desenvolvimento",
        description: `A integração com ${platformId} estará disponível em breve.`,
      });
    }
  };

  const handleImportProducts = async (integrationId: string, platform: string) => {
    try {
      toast({
        title: "Importando produtos...",
        description: "Isso pode levar alguns segundos.",
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
        return;
      }

      const { data, error } = await supabase.functions.invoke("import-products", {
        body: { platform },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Error importing products:", error);
        toast({
          title: "Erro ao importar",
          description: error.message || "Não foi possível importar os produtos.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Produtos importados!",
        description: `${data.imported || 0} produtos foram importados com sucesso.`,
      });
    } catch (error) {
      console.error("Unexpected error importing products:", error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao importar os produtos.",
        variant: "destructive",
      });
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

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Integrações de Canais</h1>
        <p className="text-muted-foreground">Conecte e gerencie seus canais de venda em um só lugar</p>
      </div>

      {/* Connected Integrations */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Canais Conectados</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : connectedIntegrations.length > 0 ? (
          <div className="space-y-6">
            {/* Agrupar por plataforma */}
            {Object.entries(
              connectedIntegrations.reduce((acc: Record<string, any[]>, integration: any) => {
                if (!acc[integration.platform]) {
                  acc[integration.platform] = [];
                }
                acc[integration.platform].push(integration);
                return acc;
              }, {})
            ).map(([platform, platformIntegrations]: [string, any[]]) => (
              <div key={platform} className="space-y-3">
                {platformIntegrations.length > 1 && (
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold capitalize">{platform}</h3>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {platformIntegrations.length} {platformIntegrations.length === 1 ? 'conta' : 'contas'}
                    </Badge>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {platformIntegrations.map((integration, idx) => (
                    <Card
                      key={integration.id}
                      className="shadow-soft hover:shadow-medium transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {platformIntegrations.length > 1 && (
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                                {idx + 1}
                              </div>
                            )}
                            <div className="hover:scale-110 transition-transform">
                              {(() => {
                                const platformConfig = availableIntegrations.find((p) => p.id === integration.platform);
                                return platformConfig?.logoUrl ? (
                                  <img
                                    src={platformConfig.logoUrl}
                                    alt={`${integration.platform} logo`}
                                    className={`h-8 w-auto ${platformConfig.darkInvert ? "dark-invert" : ""}`}
                                  />
                                ) : (
                                  <PlatformLogo platform={integration.platform} size="lg" />
                                );
                              })()}
                            </div>
                            <div>
                              <CardTitle className="text-lg capitalize">{integration.platform}</CardTitle>
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
                          <Badge variant="secondary" className="bg-green-500 text-white hover:opacity-90 transition-opacity">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Ativo
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="text-xs text-muted-foreground">
                          Última atualização: {new Date(integration.updated_at).toLocaleDateString("pt-BR")}
                        </div>

                        <Separator />

                        {/* Import Products Button for Shopify */}
                        {integration.platform === "shopify" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              className="w-full bg-gradient-primary"
                              onClick={() => handleImportProducts(integration.id, integration.platform)}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Importar Produtos
                            </Button>
                            <Separator />
                          </>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
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
                                disabled={disconnectingId === integration.id}
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
                  ))}
                </div>
              </div>
            ))}
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

      {/* Available Integrations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Conecte um Novo Canal</h2>
          <Badge variant="outline">{availableIntegrations.length} plataformas disponíveis</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableIntegrations.map((platform, index) => {
            const connectedCount = connectedIntegrations.filter((c) => c.platform === platform.id).length;
            const isConnected = connectedCount > 0;
            
            return (
                <Card
                  key={platform.id}
                  className="shadow-soft hover:shadow-medium transition-all duration-200 group hover:scale-[1.02] hover:-translate-y-1"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="group-hover:scale-110 transition-transform">
                          <img
                            src={platform.logoUrl}
                            alt={`${platform.name} logo`}
                            className={`h-8 w-auto ${platform.darkInvert ? "dark-invert" : ""}`}
                          />
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {platform.name}
                            {platform.popular && (
                              <Badge variant="secondary" className="bg-primary text-primary-foreground animate-glow">
                                Popular
                              </Badge>
                            )}
                            {isConnected && (
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                                {connectedCount} {connectedCount === 1 ? 'conectada' : 'conectadas'}
                              </Badge>
                            )}
                          </CardTitle>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="text-sm">{platform.description}</CardDescription>
                  </CardHeader>

                  <CardContent>
                    <Button
                      onClick={() => handleConnect(platform.id)}
                      className="w-full bg-gradient-primary hover:bg-primary-hover group-hover:shadow-primary transition-all duration-200 hover:scale-[1.02]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {isConnected ? `Conectar Outra Conta ${platform.name}` : `Conectar ${platform.name}`}
                    </Button>
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
    </div>
  );
}
