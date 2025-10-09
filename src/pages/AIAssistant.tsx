import { Badge } from "@/components/ui/badge";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const AIAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! 👋 Sou o Luca, seu Estrategista de Crescimento Autônomo.\n\nComo seu consultor estratégico, posso ajudar você a:\n\n✓ Expandir para Novos Mercados: Identificar oportunidades de produtos em outras plataformas\n✓ Criar Kits e Bundles: Aumentar ticket médio com combinações inteligentes\n✓ Análise de Concorrência: Monitorar tendências e ações dos concorrentes\n✓ Otimização Avançada: Precificação dinâmica e gestão de estoque estratégica\n✓ Insights Proativos: Identificar oportunidades que você ainda não viu\n\nQual área do seu negócio você gostaria de crescer hoje?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load conversation on mount
  useEffect(() => {
    if (user?.id) {
      loadConversation();
    }
  }, [user?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Save conversation whenever messages change (debounced)
  useEffect(() => {
    if (conversationId && messages.length > 1) {
      const timer = setTimeout(() => {
        saveConversation();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [messages, conversationId]);

  const loadConversation = async () => {
    try {
      // Get the most recent conversation
      const { data: conversations, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (conversations && conversations.length > 0) {
        const conv = conversations[0];
        setConversationId(conv.id);
        const loadedMessages = Array.isArray(conv.messages) ? conv.messages : [];
        if (loadedMessages.length > 0) {
          // Convert timestamps to Date objects
          const parsedMessages = loadedMessages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(parsedMessages);
        }
      } else {
        // Create new conversation
        await createNewConversation();
      }
    } catch (error) {
      console.error('Erro ao carregar conversa:', error);
    }
  };

  const createNewConversation = async () => {
    try {
      // Convert messages to plain objects for storage
      const messagesToStore = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString()
      }));

      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user!.id,
          messages: messagesToStore as any
        })
        .select()
        .single();

      if (error) throw error;
      setConversationId(data.id);

      // Limit to 10 conversations
      await cleanupOldConversations();
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
    }
  };

  const saveConversation = async () => {
    if (!conversationId) return;

    try {
      // Convert messages to plain objects for storage
      const messagesToStore = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString()
      }));

      const { error } = await supabase
        .from('ai_conversations')
        .update({
          messages: messagesToStore as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao salvar conversa:', error);
    }
  };

  const cleanupOldConversations = async () => {
    try {
      // Get all conversations
      const { data: conversations, error: fetchError } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;

      // If more than 10, delete the oldest ones
      if (conversations && conversations.length > 10) {
        const idsToDelete = conversations.slice(10).map(c => c.id);
        const { error: deleteError } = await supabase
          .from('ai_conversations')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) throw deleteError;
      }
    } catch (error) {
      console.error('Erro ao limpar conversas antigas:', error);
    }
  };

  // Função para limpar markdown e manter formatação
  const cleanMarkdown = (text: string) => {
    // Remove markdown progressivamente
    let cleaned = text
      // Remove check marks unicode
      .replace(/✅/g, '✓')
      // Remove bold/italic combinations
      .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      // Remove inline code
      .replace(/`(.*?)`/g, '$1')
      // Remove headers
      .replace(/#{1,6}\s+/g, '')
      // Remove remaining asterisks
      .replace(/\*/g, '');
    
    return cleaned.trim();
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Create conversation if doesn't exist
    if (!conversationId) {
      await createNewConversation();
    }

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { question: userMessage.content }
      });

      if (error) throw error;

      if (data?.answer) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: cleanMarkdown(data.answer),
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('Resposta inválida da IA');
      }
    } catch (error) {
      console.error('Erro ao consultar assistente:', error);
      toast({
        title: "Erro",
        description: "Não foi possível obter resposta do assistente. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "Identifique oportunidades de expansão para outras plataformas",
    "Sugira kits e bundles para aumentar meu ticket médio",
    "Analise tendências do mercado e ações dos concorrentes",
    "Quais produtos devo destacar em minhas campanhas?",
    "Como posso criar combos lucrativos com meus produtos?",
    "Identifique produtos com potencial em outras plataformas"
  ];

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Luca - Estrategista de IA</h1>
          <Badge variant="secondary" className="ml-2">Beta</Badge>
        </div>
        <p className="text-sm md:text-base text-muted-foreground">
          Seu estrategista autônomo que identifica oportunidades de crescimento que você ainda não viu
        </p>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Chat com Luca
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px] md:h-[500px] p-3 md:p-6" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="hidden md:flex flex-shrink-0 w-8 h-8 rounded-full bg-primary items-center justify-center">
                      <Bot className="h-5 w-5 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] md:max-w-[80%] rounded-lg p-3 md:p-4 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-xs md:text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                    <span className="text-xs opacity-70 mt-2 block">
                      {message.timestamp.toLocaleTimeString('pt-BR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  {message.role === 'user' && (
                    <div className="hidden md:flex flex-shrink-0 w-8 h-8 rounded-full bg-secondary items-center justify-center">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <Bot className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="bg-muted rounded-lg p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-4 space-y-4">
              {messages.length === 1 && (
              <div className="space-y-2">
                <p className="text-xs md:text-sm text-muted-foreground">Perguntas sugeridas:</p>
                <div className="grid grid-cols-1 gap-2">
                  {suggestedQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => setInput(question)}
                      className="justify-start text-left h-auto py-2 px-2 md:px-3 text-xs md:text-sm"
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua pergunta..."
                disabled={isLoading}
                className="flex-1 text-sm md:text-base"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="px-3 md:px-6"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIAssistant;
