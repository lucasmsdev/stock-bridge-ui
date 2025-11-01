import { ArrowLeft, ExternalLink, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";

const integrationGuides = [
  {
    id: "mercadolivre",
    name: "Mercado Livre",
    logo: "🛒",
    difficulty: "Fácil",
    difficultyColor: "bg-green-500",
    steps: [
      "Acesse sua conta do Mercado Livre",
      "Clique em 'Conectar Mercado Livre' na página de Integrações",
      "Autorize o UniStock a acessar sua conta",
      "Aguarde a sincronização automática dos seus produtos"
    ],
    requirements: [
      "Conta ativa no Mercado Livre",
      "Loja configurada com produtos"
    ],
    tips: [
      "A sincronização inicial pode levar alguns minutos",
      "Certifique-se de que seus produtos têm descrições completas"
    ]
  },
  {
    id: "shopee",
    name: "Shopee",
    logo: "🛍️",
    difficulty: "Médio",
    difficultyColor: "bg-yellow-500",
    steps: [
      "Registre-se no Shopee Seller Centre",
      "Acesse 'Configurações' > 'Permissões de Terceiros'",
      "Clique em 'Conectar Shopee' na página de Integrações do UniStock",
      "Autorize as permissões solicitadas",
      "Aguarde a sincronização dos seus produtos"
    ],
    requirements: [
      "Conta vendedor ativa no Shopee",
      "Loja configurada e aprovada",
      "Produtos cadastrados"
    ],
    tips: [
      "Verifique se sua loja está aprovada antes de conectar",
      "A sincronização completa pode levar até 30 minutos"
    ]
  },
  {
    id: "shopify",
    name: "Shopify",
    logo: "🏪",
    difficulty: "Médio",
    difficultyColor: "bg-blue-500",
    steps: [
      "Acesse o Shopify Partners e crie uma aplicação custom",
      "Configure as URLs de redirecionamento fornecidas pelo UniStock",
      "Defina as permissões necessárias (produtos, pedidos, estoque)",
      "Copie o Client ID e Client Secret da aplicação",
      "Entre em contato com o suporte para configurar as credenciais"
    ],
    requirements: [
      "Conta Shopify ativa (qualquer plano)",
      "Acesso ao Shopify Partners",
      "Permissões de administrador na loja"
    ],
    tips: [
      "Guarde as credenciais em local seguro",
      "A configuração inicial requer contato com suporte",
      "Após configurado, você pode conectar múltiplas lojas"
    ]
  },
  {
    id: "amazon",
    name: "Amazon",
    logo: "📦",
    difficulty: "Avançado",
    difficultyColor: "bg-red-500",
    steps: [
      "Registre-se no Amazon Seller Central",
      "Solicite acesso à API do Amazon MWS ou SP-API",
      "Aguarde aprovação da Amazon (pode levar dias)",
      "Clique em 'Conectar Amazon' na página de Integrações",
      "Configure as credenciais e teste a conexão"
    ],
    requirements: [
      "Conta Amazon Seller verificada",
      "Histórico de vendas estável",
      "Aprovação da Amazon para acesso à API",
      "Documentação fiscal completa"
    ],
    tips: [
      "O processo de aprovação pode ser demorado",
      "Mantenha sua documentação fiscal em dia",
      "Utilize o ambiente sandbox para testes iniciais"
    ]
  }
];

export default function Help() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate(-1)}
          className="hover:bg-secondary"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Central de Ajuda</h1>
          <p className="text-muted-foreground">
            Guias completos para conectar suas lojas ao UniStock
          </p>
        </div>
      </div>

      {/* Quick Start Alert */}
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-foreground">
          <strong>Dica:</strong> Recomendamos começar com o Mercado Livre, pois é a integração mais simples de configurar.
        </AlertDescription>
      </Alert>

      {/* Integration Guides */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-foreground">Guias de Integração</h2>
        
        <div className="space-y-6">
          {integrationGuides.map((guide, index) => (
            <Card 
              key={guide.id} 
              className="shadow-soft hover:shadow-medium transition-all duration-200"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{guide.logo}</div>
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2">
                        {guide.name}
                        <Badge 
                          variant="secondary" 
                          className={`${guide.difficultyColor} text-white`}
                        >
                          {guide.difficulty}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Guia completo para conectar sua loja {guide.name}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Requirements */}
                <div>
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    Requisitos
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                    {guide.requirements.map((req, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                {/* Steps */}
                <div>
                  <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Passo a Passo
                  </h4>
                  <div className="space-y-3">
                    {guide.steps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Tips */}
                <div>
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500" />
                    Dicas Importantes
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                    {guide.tips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button 
                    onClick={() => navigate('/app/integrations')}
                    className="bg-gradient-primary hover:bg-primary-hover transition-all duration-200"
                  >
                    Conectar {guide.name}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Support Section */}
      <Card className="shadow-soft border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            Ainda Precisa de Ajuda?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Se você encontrou algum problema durante a integração ou tem dúvidas específicas, 
            nossa equipe de suporte está pronta para ajudar.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a
                href="https://wa.me/5512996872975"
                target="_blank"
                rel="noopener noreferrer"
              >
                Contatar Suporte
              </a>
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate('/app/faq')}
            >
              FAQ Completo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}