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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência.`,
    });
  };

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
        description: "Verifique se você configurou corretamente a aplicação Shopify seguindo o tutorial abaixo.",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const currentDomain = window.location.origin;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <ShoppingBag className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Configuração do Shopify</h1>
          </div>
          <p className="text-muted-foreground">
            Siga este guia passo a passo para configurar e conectar sua loja Shopify
          </p>
          <Badge variant="secondary" className="bg-blue-500 text-white">
            Processo único - aproximadamente 10 minutos
          </Badge>
        </div>

        {/* Connection Form */}
        <Card className="shadow-lg border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              Conectar sua Loja Shopify
            </CardTitle>
            <CardDescription>
              Após configurar sua aplicação Shopify, use este formulário para conectar
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

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Importante:</p>
                  <p>Antes de conectar, você deve configurar sua aplicação Shopify seguindo os passos abaixo. O erro "redirect_uri is not whitelisted" significa que você ainda não configurou as URLs corretamente.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 1 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">1</span>
              Criar Aplicação Shopify
            </CardTitle>
            <CardDescription>
              Primeiro, você precisa criar uma aplicação no Shopify Partners
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="font-medium">Passos:</p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
                <li>Acesse <a href="https://partners.shopify.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Shopify Partners</a></li>
                <li>Faça login ou crie uma conta de desenvolvedor</li>
                <li>Clique em "Create app" → "Custom app"</li>
                <li>Escolha "Build for a specific store"</li>
                <li>Digite o nome da sua aplicação: "UniStock Integration"</li>
              </ol>
            </div>
            <Button asChild>
              <a href="https://partners.shopify.com/organizations" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir Shopify Partners
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Step 2 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">2</span>
              Configurar URLs de Redirecionamento
            </CardTitle>
            <CardDescription>
              Configure as URLs necessárias na sua aplicação Shopify
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <p className="font-medium mb-2">App URL:</p>
                <div className="flex items-center gap-2 p-2 bg-muted rounded">
                  <code className="flex-1 text-sm">{currentDomain}</code>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => copyToClipboard(currentDomain, 'App URL')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div>
                <p className="font-medium mb-2">Allowed redirection URL(s):</p>
                <div className="flex items-center gap-2 p-2 bg-muted rounded">
                  <code className="flex-1 text-sm">{currentDomain}/callback/shopify</code>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => copyToClipboard(`${currentDomain}/callback/shopify`, 'Redirect URL')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">CRÍTICO - Cole exatamente essas URLs:</p>
                    <p>O erro "redirect_uri is not whitelisted" acontece quando essas URLs não estão configuradas corretamente na sua aplicação Shopify. Certifique-se de colar exatamente como mostrado acima.</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">3</span>
              Configurar Permissões
            </CardTitle>
            <CardDescription>
              Defina as permissões necessárias para sincronização de produtos e pedidos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-medium">Permissões necessárias:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'read_products',
                'write_products',
                'read_orders',
                'read_inventory',
                'write_inventory'
              ].map((permission) => (
                <div key={permission} className="flex items-center gap-2 p-2 bg-muted rounded">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <code className="text-sm">{permission}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step 4 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">4</span>
              Obter Credenciais da API
            </CardTitle>
            <CardDescription>
              Copie as credenciais da sua aplicação Shopify
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <p>Na página da sua aplicação Shopify, você encontrará:</p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                <li><strong>Client ID</strong> (API Key) - copie este valor</li>
                <li><strong>Client Secret</strong> (API Secret Key) - copie este valor</li>
              </ul>
            </div>
            
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Atenção:</p>
                  <p>Guarde essas credenciais com segurança. Você precisará configurá-las no próximo passo.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 5 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">5</span>
              Configurar no UniStock
            </CardTitle>
            <CardDescription>
              Adicione as credenciais no sistema UniStock
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <p>Com as credenciais da sua aplicação Shopify:</p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
                <li>Entre em contato com o suporte do UniStock</li>
                <li>Forneça o <strong>Client ID</strong> e <strong>Client Secret</strong></li>
                <li>Aguarde a confirmação da configuração (1-2 horas úteis)</li>
                <li>Após a confirmação, use o formulário no topo desta página para conectar</li>
              </ol>
            </div>
            
            <div className="flex gap-3">
              <Button>
                Entrar em Contato com Suporte
              </Button>
              <Button variant="outline" asChild>
                <a href="/integrations">
                  Voltar às Integrações
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle2 className="h-5 w-5" />
              Próximos Passos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-700 text-sm">
              Após a configuração estar completa, você poderá:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-green-700 ml-4">
              <li>Conectar quantas lojas Shopify quiser</li>
              <li>Sincronizar produtos automaticamente</li>
              <li>Receber atualizações de estoque em tempo real</li>
              <li>Gerenciar tudo em um painel único</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}