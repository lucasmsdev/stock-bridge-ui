import { useState, useEffect } from "react";
import { Plus, Settings, Unlink, ExternalLink, CheckCircle2, Plug, Loader2, Lock } from "lucide-react";
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
    logoUrl: "https://vectorseek.com/wp-content/uploads/2023/08/Mercado-Livre-Icon-Logo-Vector.svg-.png"
  },
  {
    id: "shopee",
    name: "Shopee",
    description: "Conecte-se ao maior marketplace de vendas online do Sudeste Asiático",
    popular: true,
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Shopee_logo.svg/1442px-Shopee_logo.svg.png"
  },
  {
    id: "amazon",
    name: "Amazon",
    description: "Venda seus produtos na maior plataforma de e-commerce do mundo",
    popular: true,
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/de/Amazon_icon.png",
    darkInvert: true
  }
];

export default function Integrations() {
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [connectedIntegrations, setConnectedIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { canAccess, getUpgradeRequiredMessage } = usePlan();

  useEffect(() => {
    loadConnectedIntegrations();
  }, []);

  const loadConnectedIntegrations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: integrations, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading integrations:', error);
        toast({
          title: "Erro ao carregar integrações",
          description: "Não foi possível carregar suas integrações conectadas.",
          variant: "destructive",
        });
        return;
      }

      // Only show integrations that have valid access tokens
      const validIntegrations = (integrations || []).filter(
        integration => integration.access_token && integration.access_token.trim() !== ''
      );
      
      setConnectedIntegrations(validIntegrations);
    } catch (error) {
      console.error('Unexpected error loading integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platformId: string) => {
    console.log('handleConnect called with platformId:', platformId);
    // All users can access integrations - no restrictions

    if (platformId === 'mercadolivre') {
      const appId = '5615590729373432';
      const redirectUri = `${window.location.origin}/callback/mercadolivre`;
      const authUrl = `https://auth.mercadolibre.com/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      // Redirect to Mercado Livre authorization page
      window.location.href = authUrl;
    } else if (platformId === 'amazon') {
      try {
        toast({
          title: "Conectando com Amazon",
          description: "Aguarde enquanto autenticamos sua conta...",
        });

        // Call the amazon-auth edge function
        const { data, error } = await supabase.functions.invoke('amazon-auth', {
          method: 'POST'
        });

        if (error) {
          console.error('Error connecting to Amazon:', error);
          toast({
            title: "Erro ao conectar",
            description: "Não foi possível conectar com a Amazon. Tente novamente.",
            variant: "destructive",
          });
          return;
        }

        if (!data?.accessToken) {
          toast({
            title: "Erro ao conectar",
            description: "Não foi possível obter token de acesso da Amazon.",
            variant: "destructive",
          });
          return;
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          toast({
            title: "Erro de autenticação",
            description: "Você precisa estar logado para conectar integrações.",
            variant: "destructive",
          });
          return;
        }

        // Save integration to database
        const { error: saveError } = await supabase
          .from('integrations')
          .upsert({
            user_id: user.id,
            platform: 'amazon',
            access_token: data.accessToken,
            shop_domain: 'sandbox', // For sandbox environment
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,platform'
          });

        if (saveError) {
          console.error('Error saving Amazon integration:', saveError);
          toast({
            title: "Erro ao salvar integração",
            description: "Não foi possível salvar a integração. Tente novamente.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Conectado com sucesso!",
          description: "Sua conta Amazon foi conectada ao PriceWise.",
        });

        // Reload integrations
        await loadConnectedIntegrations();
      } catch (error) {
        console.error('Unexpected error connecting to Amazon:', error);
        toast({
          title: "Erro inesperado",
          description: "Ocorreu um erro ao conectar com a Amazon.",
          variant: "destructive",
        });
      }
    } else if (platformId === 'shopify') {
      // Show as coming soon
      toast({
        title: "Em desenvolvimento",
        description: "A integração com Shopify estará disponível em breve.",
      });
    } else {
      // Mock connection logic for other platforms
      toast({
        title: "Em desenvolvimento",
        description: `A integração com ${platformId} estará disponível em breve.`,
      });
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      setDisconnectingId(integrationId);
      
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', integrationId);

      if (error) {
        console.error('Error disconnecting integration:', error);
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
      console.error('Unexpected error disconnecting integration:', error);
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
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Integrações de Canais</h1>
        <p className="text-muted-foreground">
          Conecte e gerencie seus canais de venda em um só lugar
        </p>
      </div>

      {/* Connected Integrations */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Canais Conectados</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : connectedIntegrations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectedIntegrations.map((integration) => (
              <Card 
                key={integration.id} 
                className="shadow-soft hover:shadow-medium transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="hover:scale-110 transition-transform">
                        {(() => {
                          const platformConfig = availableIntegrations.find(p => p.id === integration.platform);
                          return platformConfig?.logoUrl ? (
                            <img
                              src={platformConfig.logoUrl}
                              alt={`${integration.platform} logo`}
                              className={`h-8 w-auto ${platformConfig.darkInvert ? 'dark-invert' : ''}`}
                            />
                          ) : (
                            <PlatformLogo platform={integration.platform} size="lg" />
                          );
                        })()}
                      </div>
                      <div>
                        <CardTitle className="text-lg capitalize">{integration.platform}</CardTitle>
                        <CardDescription>
                          Conectado em {new Date(integration.created_at).toLocaleDateString('pt-BR')}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className="bg-green-500 text-white hover:opacity-90 transition-opacity"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Ativo
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="text-xs text-muted-foreground">
                    Última atualização: {new Date(integration.updated_at).toLocaleDateString('pt-BR')}
                  </div>
                  
                  <Separator />
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        if (integration.platform === 'mercadolivre') {
                          toast({
                            title: "Configurações do Mercado Livre",
                            description: "Redirecionando para as configurações da integração...",
                          });
                          // Navigate to a management page or show configuration modal
                          setTimeout(() => {
                            toast({
                              title: "Funcionalidade em desenvolvimento",
                              description: "As configurações avançadas estarão disponíveis em breve.",
                            });
                          }, 1000);
                        } else {
                          toast({
                            title: "Configurações em desenvolvimento",
                            description: `As configurações para ${integration.platform} estarão disponíveis em breve.`,
                          });
                        }
                      }}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Gerenciar
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
                            Tem certeza que deseja desconectar a integração com {integration.platform}? 
                            Esta ação interromperá a sincronização automática de produtos e pedidos.
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
        ) : (
          <Card className="shadow-soft">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="max-w-md mx-auto">
                <Plug className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Nenhuma integração conectada
                </h3>
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
          <Badge variant="outline">
            {availableIntegrations.length} plataformas disponíveis
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableIntegrations
            .filter(platform => !connectedIntegrations.some(connected => connected.platform === platform.id))
            .map((platform, index) => (
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
                        className={`h-8 w-auto ${platform.darkInvert ? 'dark-invert' : ''}`}
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
                      </CardTitle>
                    </div>
                  </div>
                </div>
                <CardDescription className="text-sm">
                  {platform.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <Button 
                  onClick={() => handleConnect(platform.id)}
                  className="w-full bg-gradient-primary hover:bg-primary-hover group-hover:shadow-primary transition-all duration-200 hover:scale-[1.02]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Conectar {platform.name}
                </Button>
              </CardContent>
            </Card>
          ))}
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
            Não encontrou sua plataforma? Entre em contato conosco para solicitar uma nova integração 
            ou consulte nossa documentação para mais informações.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.href = '/help'}>
              Ver Documentação
            </Button>
            <Button variant="outline">
              Contatar Suporte
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}