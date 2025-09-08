import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, ExternalLink, Copy, AlertCircle, Loader2, ShoppingBag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function ShopifySetup() {
  const [shopDomain, setShopDomain] = useState('');
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    if (!shopDomain.trim()) {
      toast({
        title: "Domínio necessário",
        description: "Por favor, insira o domínio da sua loja Shopify.",
        variant: "destructive",
      });
      return;
    }

    // Clean and validate domain
    let cleanDomain = shopDomain.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, ''); // Remove protocol
    cleanDomain = cleanDomain.replace(/\.myshopify\.com.*$/, ''); // Remove .myshopify.com and anything after
    cleanDomain = cleanDomain.replace(/\/.*$/, ''); // Remove any path

    if (!cleanDomain) {
      toast({
        title: "Domínio inválido",
        description: "Por favor, insira um domínio válido da loja Shopify.",
        variant: "destructive",
      });
      return;
    }

    try {
      setConnecting(true);
      
      // OAuth scopes needed
      const scopes = [
        'read_products',
        'write_products', 
        'read_orders',
        'read_inventory',
        'write_inventory'
      ].join(',');

      // Generate state for security
      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Store state in localStorage for validation
      localStorage.setItem('shopify_oauth_state', state);
      localStorage.setItem('shopify_shop_domain', cleanDomain);

      const currentDomain = window.location.origin;
      const redirectUri = `${currentDomain}/callback/shopify`;
      
      // We need to get the actual API key from our backend
      // For now, we'll call our edge function to get the auth URL
      const { data, error } = await supabase.functions.invoke('shopify-auth-url', {
        body: {
          shop: cleanDomain,
          scopes: scopes,
          redirect_uri: redirectUri,
          state: state
        }
      });

      if (error || !data?.auth_url) {
        throw new Error('Failed to generate auth URL');
      }

      // Redirect to Shopify OAuth
      window.location.href = data.auth_url;
      
    } catch (error) {
      console.error('Error starting Shopify connection:', error);
      toast({
        title: "Erro na conexão",
        description: "Não foi possível iniciar a conexão com o Shopify. Verifique se as credenciais estão configuradas.",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <ShoppingBag className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Conectar Shopify</h1>
          </div>
          <p className="text-muted-foreground">
            Conecte sua loja Shopify para sincronizar produtos e pedidos automaticamente
          </p>
          <Badge variant="secondary" className="bg-green-500 text-white">
            Conexão segura via OAuth
          </Badge>
        </div>

        {/* Main Connection Form */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Conectar sua Loja
            </CardTitle>
            <CardDescription>
              Insira o domínio da sua loja Shopify para iniciar a conexão
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shop-domain">Domínio da Loja Shopify</Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    id="shop-domain"
                    type="text"
                    placeholder="minhaloja"
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    className="pr-32"
                    disabled={connecting}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    .myshopify.com
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Exemplo: se sua loja é "minhaloja.myshopify.com", digite apenas "minhaloja"
              </p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Como funciona:</p>
                  <p>Você será redirecionado para o Shopify para autorizar a conexão com sua loja. Depois disso, seus produtos serão sincronizados automaticamente.</p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleConnect}
              className="w-full bg-gradient-primary hover:bg-primary-hover"
              disabled={connecting || !shopDomain.trim()}
            >
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Conectar com Shopify
                </>
              )}
            </Button>

            <div className="flex justify-center">
              <Button variant="outline" asChild>
                <a href="/integrations">
                  Voltar às Integrações
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Info */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle2 className="h-5 w-5" />
              Segurança Garantida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
              <li>Conexão segura através do protocolo OAuth oficial do Shopify</li>
              <li>Suas credenciais nunca são armazenadas em nossos servidores</li>
              <li>Você pode revogar o acesso a qualquer momento pelo painel do Shopify</li>
              <li>Todas as comunicações são criptografadas</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}