import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useThemeProvider } from "@/components/layout/ThemeProvider";

const TermsOfService = () => {
  const { theme } = useThemeProvider();

  const sections = [
    {
      title: "1. Aceitação dos Termos",
      content: `Ao acessar e utilizar a plataforma UNISTOCK ("Plataforma"), você concorda em cumprir e estar vinculado aos presentes Termos de Serviço. Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.

A utilização da Plataforma implica na aceitação integral e irrestrita de todos os itens destes Termos de Serviço, bem como da nossa Política de Privacidade.`
    },
    {
      title: "2. Descrição do Serviço",
      content: `A UNISTOCK é uma plataforma de gestão de estoque e vendas multi-marketplace que permite aos usuários:

• Sincronizar produtos e estoques entre diferentes marketplaces (Mercado Livre, Shopee, Amazon, Shopify)
• Gerenciar pedidos de múltiplas plataformas em um único painel
• Analisar lucro real com cálculo automático de taxas e custos
• Utilizar inteligência artificial para otimização de anúncios e análise de mercado
• Gerar relatórios de vendas e desempenho

Os recursos disponíveis variam de acordo com o plano contratado pelo usuário.`
    },
    {
      title: "3. Cadastro e Conta do Usuário",
      content: `Para utilizar a Plataforma, você deve:

• Ter pelo menos 18 anos de idade ou capacidade legal para celebrar contratos
• Fornecer informações verdadeiras, precisas e completas durante o cadastro
• Manter suas informações de cadastro atualizadas
• Manter a confidencialidade de sua senha e credenciais de acesso
• Ser responsável por todas as atividades realizadas em sua conta

Você é o único responsável por qualquer atividade que ocorra em sua conta. A UNISTOCK não se responsabiliza por danos decorrentes do uso não autorizado de sua conta.`
    },
    {
      title: "4. Planos e Pagamentos",
      content: `A UNISTOCK oferece diferentes planos de assinatura com recursos e limites específicos. Ao contratar um plano:

• O pagamento é realizado de forma recorrente (mensal)
• Você autoriza a cobrança automática no cartão de crédito cadastrado
• Os preços podem ser alterados mediante aviso prévio de 30 dias
• O período de teste gratuito de 14 dias está disponível para novos usuários
• A cobrança será iniciada automaticamente após o término do período de teste

Para cancelar sua assinatura, acesse as configurações de sua conta. O cancelamento será efetivado ao final do período já pago.`
    },
    {
      title: "5. Uso Aceitável",
      content: `Ao utilizar a Plataforma, você concorda em:

• Não violar leis, regulamentos ou direitos de terceiros
• Não utilizar a Plataforma para fins ilegais ou não autorizados
• Não interferir ou interromper a integridade ou o desempenho da Plataforma
• Não tentar acessar áreas restritas do sistema sem autorização
• Não reproduzir, duplicar, copiar, vender ou revender qualquer parte da Plataforma
• Não utilizar bots, scripts ou outros meios automatizados não autorizados
• Não transmitir vírus, malware ou código malicioso

O descumprimento destas regras pode resultar em suspensão ou cancelamento da conta.`
    },
    {
      title: "6. Integrações com Marketplaces",
      content: `A UNISTOCK oferece integrações com marketplaces terceiros. Ao conectar suas contas:

• Você autoriza a UNISTOCK a acessar e gerenciar dados de suas contas nos marketplaces
• As integrações dependem das APIs fornecidas pelos marketplaces
• A UNISTOCK não se responsabiliza por alterações, indisponibilidades ou limitações impostas pelos marketplaces
• Você deve cumprir os termos de serviço de cada marketplace conectado
• A UNISTOCK não garante funcionamento ininterrupto das integrações`
    },
    {
      title: "7. Propriedade Intelectual",
      content: `Todo o conteúdo da Plataforma, incluindo mas não se limitando a textos, gráficos, logos, ícones, imagens, clipes de áudio, downloads digitais e compilações de dados, é propriedade da UNISTOCK ou de seus fornecedores de conteúdo e está protegido por leis de direitos autorais.

A marca UNISTOCK e todos os logos relacionados são marcas registradas. Você não pode usar essas marcas sem autorização prévia por escrito.`
    },
    {
      title: "8. Limitação de Responsabilidade",
      content: `A UNISTOCK fornece a Plataforma "como está" e "conforme disponível". Não garantimos que:

• A Plataforma atenderá a todos os seus requisitos específicos
• A Plataforma será ininterrupta, pontual, segura ou livre de erros
• Os resultados obtidos serão precisos ou confiáveis
• Quaisquer erros na Plataforma serão corrigidos

Em nenhuma circunstância a UNISTOCK será responsável por danos indiretos, incidentais, especiais, consequenciais ou punitivos, incluindo perda de lucros, dados ou outras perdas intangíveis.

A responsabilidade total da UNISTOCK não excederá o valor pago pelo usuário nos últimos 12 meses.`
    },
    {
      title: "9. Modificações nos Termos",
      content: `A UNISTOCK reserva-se o direito de modificar estes Termos de Serviço a qualquer momento. As alterações entrarão em vigor imediatamente após a publicação na Plataforma.

Notificaremos os usuários sobre alterações significativas por email ou através da Plataforma. O uso continuado da Plataforma após as alterações constitui aceitação dos novos termos.`
    },
    {
      title: "10. Rescisão",
      content: `A UNISTOCK pode suspender ou encerrar seu acesso à Plataforma, a qualquer momento e por qualquer motivo, incluindo:

• Violação destes Termos de Serviço
• Solicitação de autoridades legais ou governamentais
• Descontinuação ou modificação material da Plataforma
• Problemas técnicos ou de segurança inesperados
• Não pagamento das taxas de assinatura

Após o encerramento, você perderá acesso aos dados armazenados na Plataforma. Recomendamos exportar seus dados antes de cancelar sua conta.`
    },
    {
      title: "11. Lei Aplicável e Foro",
      content: `Estes Termos de Serviço são regidos pelas leis da República Federativa do Brasil.

Qualquer disputa decorrente destes Termos será submetida ao foro da Comarca de São José dos Campos, Estado de São Paulo, com exclusão de qualquer outro, por mais privilegiado que seja.`
    },
    {
      title: "12. Contato",
      content: `Para dúvidas sobre estes Termos de Serviço, entre em contato:

• Email: unistockenterprise@gmail.com
• WhatsApp: +55 12 99687-2975
• Instagram: @oficialunistock`
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
                <FileText className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">Termos de Serviço</h1>
            <p className="text-muted-foreground">
              Última atualização: 01 de Fevereiro de 2025
            </p>
          </div>

          {/* Terms Content */}
          <Card className="border-border/50">
            <CardContent className="p-6 md:p-8">
              <ScrollArea className="h-auto">
                <div className="space-y-8">
                  <p className="text-muted-foreground leading-relaxed">
                    Bem-vindo à UNISTOCK. Estes Termos de Serviço regulam o uso da nossa plataforma de gestão de estoque e vendas multi-marketplace. Por favor, leia atentamente antes de utilizar nossos serviços.
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

export default TermsOfService;
