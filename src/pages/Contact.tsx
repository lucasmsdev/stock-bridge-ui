import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Phone, Instagram, Send, ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useThemeProvider } from "@/components/layout/ThemeProvider";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  subject: z.string().trim().min(3, "Assunto deve ter pelo menos 3 caracteres").max(200, "Assunto muito longo"),
  message: z.string().trim().min(10, "Mensagem deve ter pelo menos 10 caracteres").max(2000, "Mensagem muito longa"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const Contact = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { theme } = useThemeProvider();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const { data: response, error } = await supabase.functions.invoke("send-contact-email", {
        body: data,
      });

      if (error) throw error;

      toast.success("Mensagem enviada com sucesso! Você receberá uma confirmação por email.");
      reset();
    } catch (error: any) {
      console.error("Error sending contact email:", error);
      toast.error(error.message || "Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <div className="max-w-5xl mx-auto">
            {/* Title Section */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-foreground mb-4">Entre em Contato</h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Tem alguma dúvida ou sugestão? Nossa equipe está pronta para ajudar você a centralizar suas vendas em múltiplos marketplaces.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Contact Form */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    Envie uma Mensagem
                  </CardTitle>
                  <CardDescription>
                    Preencha o formulário abaixo e retornaremos em breve
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome *</Label>
                      <Input
                        id="name"
                        placeholder="Seu nome completo"
                        {...register("name")}
                        className={errors.name ? "border-destructive" : ""}
                      />
                      {errors.name && (
                        <p className="text-sm text-destructive">{errors.name.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        {...register("email")}
                        className={errors.email ? "border-destructive" : ""}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">Assunto *</Label>
                      <Input
                        id="subject"
                        placeholder="Sobre o que você quer falar?"
                        {...register("subject")}
                        className={errors.subject ? "border-destructive" : ""}
                      />
                      {errors.subject && (
                        <p className="text-sm text-destructive">{errors.subject.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Mensagem *</Label>
                      <Textarea
                        id="message"
                        placeholder="Escreva sua mensagem aqui..."
                        rows={5}
                        {...register("message")}
                        className={errors.message ? "border-destructive" : ""}
                      />
                      {errors.message && (
                        <p className="text-sm text-destructive">{errors.message.message}</p>
                      )}
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar Mensagem
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Contact Info */}
              <div className="space-y-6">
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>Outras Formas de Contato</CardTitle>
                    <CardDescription>
                      Prefere falar diretamente? Use um dos canais abaixo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <a
                      href="https://wa.me/5512996872975"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 rounded-lg bg-green-500/10 hover:bg-green-500/20 transition-colors group"
                    >
                      <div className="p-3 rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
                        <MessageCircle className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                          WhatsApp
                        </p>
                        <p className="text-sm text-muted-foreground">+55 12 99687-2975</p>
                      </div>
                    </a>

                    <a
                      href="https://instagram.com/oficialunistock"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 transition-colors group"
                    >
                      <div className="p-3 rounded-full bg-pink-500/20 text-pink-600 dark:text-pink-400">
                        <Instagram className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                          Instagram
                        </p>
                        <p className="text-sm text-muted-foreground">@oficialunistock</p>
                      </div>
                    </a>

                    <a
                      href="mailto:unistockenterprise@gmail.com"
                      className="flex items-center gap-4 p-4 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors group"
                    >
                      <div className="p-3 rounded-full bg-primary/20 text-primary">
                        <Mail className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                          Email
                        </p>
                        <p className="text-sm text-muted-foreground">unistockenterprise@gmail.com</p>
                      </div>
                    </a>

                    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="p-3 rounded-full bg-muted text-muted-foreground">
                        <Phone className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Telefone</p>
                        <p className="text-sm text-muted-foreground">+55 12 99687-2975</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <h3 className="font-semibold text-foreground mb-2">Horário de Atendimento</h3>
                      <p className="text-muted-foreground">
                        Segunda a Sexta: 9h às 18h<br />
                        Sábado: 9h às 13h
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
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

export default Contact;
