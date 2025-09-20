import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const faqData = [
  {
    id: "repricing-alerts",
    question: "Como funciona a Reprecificação por Alerta?",
    answer: "Nosso sistema monitora o preço do seu concorrente automaticamente. Quando o preço dele mudar (subir ou descer, dependendo da sua configuração), nós te enviamos uma notificação por email e através do painel para que você possa decidir se quer ajustar o seu preço. Você mantém o controle total sobre as mudanças de preço."
  },
  {
    id: "data-security",
    question: "Meus dados estão seguros?",
    answer: "Sim, a segurança dos seus dados é nossa prioridade máxima. Todas as suas chaves de API e tokens são criptografados usando algoritmos de criptografia de nível empresarial e armazenados de forma segura em nosso banco de dados. Nunca compartilhamos seus dados com terceiros e seguimos as melhores práticas de segurança da indústria."
  },
  {
    id: "cancel-subscription",
    question: "Como cancelo minha assinatura?",
    answer: "Você pode gerenciar, alterar ou cancelar sua assinatura a qualquer momento. Vá para a página de 'Perfil' no menu lateral e clique em 'Gerenciar Assinatura'. Lá você encontrará todas as opções disponíveis para sua conta. O cancelamento é efetivo imediatamente, mas você ainda terá acesso até o final do período já pago."
  },
  {
    id: "integration-time",
    question: "Quanto tempo demora para sincronizar meus produtos?",
    answer: "A sincronização inicial dos produtos pode levar de alguns minutos até algumas horas, dependendo da quantidade de produtos na sua loja e da plataforma utilizada. Mercado Livre geralmente é mais rápido (5-15 minutos), enquanto Shopify e Amazon podem demorar mais. Você será notificado quando a sincronização estiver completa."
  },
  {
    id: "supported-platforms",
    question: "Quais plataformas vocês suportam?",
    answer: "Atualmente suportamos Mercado Livre (totalmente funcional), Shopify (em desenvolvimento) e Amazon (em desenvolvimento). O Mercado Livre é nossa integração mais robusta e recomendada para novos usuários. Estamos trabalhando para expandir o suporte completo para outras plataformas."
  },
  {
    id: "pricing-frequency",
    question: "Com que frequência os preços são verificados?",
    answer: "Por padrão, verificamos os preços dos concorrentes a cada 6 horas. Usuários dos planos superiores podem ter frequências maiores de verificação. Você também pode forçar uma verificação manual a qualquer momento através do botão 'Verificar Preços Agora' na página de Reprecificação."
  },
  {
    id: "competitor-not-found",
    question: "E se o sistema não encontrar o concorrente?",
    answer: "Se não conseguirmos encontrar o produto do concorrente através da URL fornecida, você receberá uma notificação. Verifique se a URL está correta e se o produto ainda está disponível na loja do concorrente. Você pode atualizar a URL a qualquer momento na página de alertas."
  },
  {
    id: "multiple-competitors",
    question: "Posso monitorar vários concorrentes para o mesmo produto?",
    answer: "Sim! Você pode criar múltiplos alertas para o mesmo produto, cada um monitorando um concorrente diferente. Isso é muito útil para ter uma visão completa do mercado e tomar decisões de precificação mais informadas."
  }
];

export default function FAQ() {
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
          <h1 className="text-3xl font-bold text-foreground">Perguntas Frequentes (FAQ)</h1>
          <p className="text-muted-foreground">
            Encontre respostas para as dúvidas mais comuns sobre o UniStock
          </p>
        </div>
      </div>

      {/* FAQ Content */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Dúvidas Frequentes</CardTitle>
          <CardDescription>
            Clique em qualquer pergunta abaixo para ver a resposta completa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full space-y-2">
            {faqData.map((faq) => (
              <AccordionItem key={faq.id} value={faq.id} className="border border-border rounded-lg px-4">
                <AccordionTrigger className="text-left hover:no-underline hover:text-primary transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Still Need Help Section */}
      <Card className="shadow-soft border-primary/20">
        <CardHeader>
          <CardTitle>Ainda tem dúvidas?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Não encontrou a resposta que procurava? Nossa equipe de suporte está pronta para ajudar você!
          </p>
          <Button variant="default" asChild>
            <a
              href="https://wa.me/5512996872975"
              target="_blank"
              rel="noopener noreferrer"
            >
              Falar com Suporte via WhatsApp
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}