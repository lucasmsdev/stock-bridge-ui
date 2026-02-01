import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useThemeProvider } from "@/components/layout/ThemeProvider";

const PrivacyPolicy = () => {
  const { theme } = useThemeProvider();

  const sections = [
    {
      title: "1. Introdução",
      content: `A UNISTOCK ("nós", "nosso" ou "Plataforma") está comprometida em proteger sua privacidade. Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos suas informações pessoais.

Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) e outras legislações aplicáveis.`
    },
    {
      title: "2. Dados que Coletamos",
      content: `Coletamos os seguintes tipos de informações:

Dados de Cadastro:
• Nome completo
• Endereço de email
• Telefone
• Nome da empresa
• CNPJ/CPF

Dados de Uso:
• Informações sobre como você utiliza a Plataforma
• Logs de acesso e atividades
• Preferências e configurações

Dados de Marketplaces:
• Informações de produtos e estoque
• Dados de pedidos e vendas
• Informações de clientes dos marketplaces
• Métricas de desempenho

Dados de Pagamento:
• Informações de cartão de crédito (processadas pelo Stripe)
• Histórico de transações`
    },
    {
      title: "3. Como Usamos seus Dados",
      content: `Utilizamos suas informações para:

• Fornecer e melhorar nossos serviços
• Sincronizar dados entre marketplaces
• Calcular métricas de lucro e desempenho
• Processar pagamentos de assinatura
• Enviar comunicações importantes sobre sua conta
• Fornecer suporte ao cliente
• Personalizar sua experiência na Plataforma
• Cumprir obrigações legais e regulatórias

Com seu consentimento, podemos também:
• Enviar emails de marketing e novidades
• Compartilhar análises de mercado personalizadas
• Oferecer recursos e promoções especiais`
    },
    {
      title: "4. Compartilhamento de Dados",
      content: `Podemos compartilhar seus dados com:

Provedores de Serviço:
• Processadores de pagamento (Stripe)
• Serviços de hospedagem (Supabase)
• Serviços de email
• Ferramentas de análise

Marketplaces Integrados:
• Mercado Livre
• Shopee
• Amazon
• Shopify

Compartilhamos apenas os dados necessários para a prestação dos serviços e todos os parceiros estão obrigados contratualmente a proteger suas informações.

Também podemos compartilhar dados:
• Quando exigido por lei ou ordem judicial
• Para proteger nossos direitos legais
• Em caso de fusão, aquisição ou venda de ativos (com aviso prévio)`
    },
    {
      title: "5. Cookies e Tecnologias de Rastreamento",
      content: `Utilizamos cookies e tecnologias similares para:

• Manter você conectado à sua conta
• Lembrar suas preferências
• Analisar o uso da Plataforma
• Melhorar a segurança

Tipos de cookies que usamos:
• Cookies essenciais: necessários para o funcionamento básico
• Cookies de funcionalidade: lembram suas preferências
• Cookies de análise: nos ajudam a entender como a Plataforma é usada

Você pode gerenciar cookies através das configurações do seu navegador.`
    },
    {
      title: "6. Segurança dos Dados",
      content: `Implementamos medidas técnicas e organizacionais para proteger seus dados:

• Criptografia de dados em trânsito (HTTPS/TLS)
• Criptografia de dados sensíveis em repouso
• Tokens de integração criptografados
• Controle de acesso baseado em funções
• Monitoramento de segurança contínuo
• Backups regulares
• Políticas de acesso restrito para funcionários

Apesar de nossos esforços, nenhum sistema é 100% seguro. Em caso de violação de dados, notificaremos os afetados conforme exigido pela LGPD.`
    },
    {
      title: "7. Retenção de Dados",
      content: `Mantemos seus dados enquanto:

• Sua conta estiver ativa
• Necessário para fornecer os serviços
• Exigido por obrigações legais ou regulatórias
• Necessário para resolver disputas

Após o encerramento da conta:
• Dados de conta: excluídos em até 30 dias
• Dados de backup: excluídos em até 90 dias
• Logs de auditoria: mantidos por até 5 anos (exigência legal)

Você pode solicitar a exclusão antecipada dos seus dados a qualquer momento.`
    },
    {
      title: "8. Seus Direitos (LGPD)",
      content: `De acordo com a LGPD, você tem direito a:

• Confirmação: saber se tratamos seus dados
• Acesso: obter cópia dos dados que temos sobre você
• Correção: solicitar correção de dados incompletos ou incorretos
• Anonimização/Bloqueio/Eliminação: de dados desnecessários ou excessivos
• Portabilidade: receber seus dados em formato estruturado
• Eliminação: solicitar exclusão de dados pessoais
• Informação: saber com quem compartilhamos seus dados
• Revogação: retirar consentimento a qualquer momento
• Oposição: se opor a determinados tratamentos

Para exercer seus direitos, entre em contato através dos canais indicados ao final desta política.`
    },
    {
      title: "9. Transferência Internacional de Dados",
      content: `Seus dados podem ser processados em servidores localizados fora do Brasil, incluindo Estados Unidos, onde estão alguns de nossos provedores de serviço.

Garantimos que todas as transferências internacionais são realizadas com salvaguardas adequadas, incluindo:
• Cláusulas contratuais padrão
• Certificações de privacidade dos provedores
• Conformidade com regulamentações aplicáveis`
    },
    {
      title: "10. Dados de Menores",
      content: `A UNISTOCK não é destinada a menores de 18 anos. Não coletamos intencionalmente dados de menores. Se você acredita que coletamos dados de um menor, entre em contato imediatamente para que possamos excluí-los.`
    },
    {
      title: "11. Alterações nesta Política",
      content: `Podemos atualizar esta Política de Privacidade periodicamente. Quando fizermos alterações significativas:

• Publicaremos a nova política na Plataforma
• Atualizaremos a data de "última atualização"
• Notificaremos por email sobre alterações materiais

Recomendamos revisar esta política regularmente.`
    },
    {
      title: "12. Contato e Encarregado de Dados (DPO)",
      content: `Para questões sobre esta Política de Privacidade ou para exercer seus direitos:

Email: unistockenterprise@gmail.com
WhatsApp: +55 12 99687-2975
Instagram: @oficialunistock

Respondemos a solicitações de direitos em até 15 dias úteis, conforme exigido pela LGPD.`
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={theme === "dark" ? "/logos/unistock-dark.png" : "/logos/unistock-light.png"}
              alt="UNISTOCK"
              className="h-8"
            />
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao site
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Title Section */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">Política de Privacidade</h1>
            <p className="text-muted-foreground">
              Última atualização: 01 de Fevereiro de 2025
            </p>
          </div>

          {/* Privacy Content */}
          <Card className="border-border/50">
            <CardContent className="p-6 md:p-8">
              <ScrollArea className="h-auto">
                <div className="space-y-8">
                  <p className="text-muted-foreground leading-relaxed">
                    Sua privacidade é importante para nós. Esta Política de Privacidade descreve como a UNISTOCK coleta, usa e protege suas informações pessoais ao utilizar nossa plataforma de gestão de estoque multi-marketplace.
                  </p>

                  {sections.map((section, index) => (
                    <div key={index} className="space-y-3">
                      <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
                      <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
                        {section.content}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Back Button */}
          <div className="mt-8 text-center">
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para a página inicial
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} UNISTOCK. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
