import { Badge } from "@/components/ui/badge";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Send, Bot, User, Loader2, Sparkles, Plus, MessageSquare, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const AIAssistant = () => {
  const initialMessage: Message = {
    role: 'assistant',
    content: 'Olá! 👋 Sou o Luca, seu Estrategista de Crescimento Autônomo.\n\nComo seu consultor estratégico, posso ajudar você a:\n\n✓ Expandir para Novos Mercados: Identificar oportunidades de produtos em outras plataformas\n✓ Criar Kits e Bundles: Aumentar ticket médio com combinações inteligentes\n✓ Análise de Concorrência: Monitorar tendências e ações dos concorrentes\n✓ Otimização Avançada: Precificação dinâmica e gestão de estoque estratégica\n✓ Insights Proativos: Identificar oportunidades que você ainda não viu\n\nQual área do seu negócio você gostaria de crescer hoje?',
    timestamp: new Date()
  };

  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load conversations on mount
  useEffect(() => {
    if (user?.id) {
      loadConversations();
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

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('id, created_at, updated_at, messages')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (data && data.length > 0) {
        const conversationsList: Conversation[] = data.map(conv => ({
          id: conv.id,
          title: getConversationTitle(Array.isArray(conv.messages) ? conv.messages : []),
          created_at: conv.created_at,
          updated_at: conv.updated_at
        }));
        setConversations(conversationsList);
        
        // Load the most recent conversation
        loadConversationById(data[0].id);
      } else {
        // Create first conversation
        await createNewConversation();
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    }
  };

  const getConversationTitle = (messages: any[]): string => {
    if (!Array.isArray(messages) || messages.length <= 1) {
      return 'Nova Conversa';
    }
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg?.content) {
      return firstUserMsg.content.substring(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '');
    }
    return 'Nova Conversa';
  };

  const loadConversationById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setConversationId(data.id);
      const loadedMessages = Array.isArray(data.messages) ? data.messages : [];
      if (loadedMessages.length > 0) {
        const parsedMessages = loadedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(parsedMessages);
      } else {
        setMessages([initialMessage]);
      }
    } catch (error) {
      console.error('Erro ao carregar conversa:', error);
    }
  };

  const createNewConversation = async () => {
    try {
      setMessages([initialMessage]);
      setConversationId(null);

      const messagesToStore = [{
        role: initialMessage.role,
        content: initialMessage.content,
        timestamp: initialMessage.timestamp.toISOString()
      }];

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
      await cleanupOldConversations();
      await loadConversations();
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      console.log('🗑️ Tentando deletar conversa:', id);
      console.log('🗑️ User ID:', user?.id);
      console.log('🗑️ Conversas antes de deletar:', conversations.length);
      
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);

      if (error) {
        console.error('❌ Erro RLS ao deletar:', error);
        throw error;
      }

      console.log('✅ Conversa deletada no banco');

      // Atualizar lista de conversas removendo a deletada
      setConversations(prevConversations => {
        const updated = prevConversations.filter(c => c.id !== id);
        console.log('📋 Conversas após deletar:', updated.length);
        return updated;
      });

      // Se deletou a conversa atual, carregar outra ou criar nova
      if (conversationId === id) {
        console.log('🔄 Conversa deletada era a ativa, buscando outra...');
        
        // Buscar conversas atualizadas do banco
        const { data: remainingConvs } = await supabase
          .from('ai_conversations')
          .select('id')
          .eq('user_id', user!.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (remainingConvs && remainingConvs.length > 0) {
          console.log('📝 Carregando conversa:', remainingConvs[0].id);
          await loadConversationById(remainingConvs[0].id);
        } else {
          console.log('➕ Criando nova conversa');
          await createNewConversation();
        }
      }

      toast({
        title: "Conversa excluída",
        description: "A conversa foi removida com sucesso.",
      });
    } catch (error) {
      console.error('❌ Erro ao excluir conversa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a conversa.",
        variant: "destructive",
      });
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
    "Analise tendências do mercado e ações dos concorrentes"
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar with conversations */}
        <Card className="lg:col-span-1 shadow-lg">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Conversas
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={createNewConversation}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] md:h-[600px]">
              <div className="space-y-1 p-2">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 p-3 rounded-lg transition-colors ${
                      conversationId === conv.id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <button
                      onClick={() => loadConversationById(conv.id)}
                      className="flex-1 text-left text-sm truncate cursor-pointer"
                    >
                      {conv.title}
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="h-7 w-7 p-0 flex-shrink-0 hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat area */}
        <Card className="lg:col-span-3 shadow-lg">
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
    </div>
  );
};

export default AIAssistant;
