import { Badge } from "@/components/ui/badge";
import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAIQuota } from "@/hooks/useAIQuota";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Send, Bot, User, Sparkles, Plus, MessageSquare, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AIQuotaBar } from "@/components/ai/AIQuotaBar";
import { AIUpgradeDialog } from "@/components/ai/AIUpgradeDialog";
import ReactMarkdown from "react-markdown";
import { useSearchParams } from "react-router-dom";

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

const STREAM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

const AIAssistant = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const autoSendProcessedRef = useRef(false);

  const initialMessage: Message = {
    role: 'assistant',
    content: 'Olá! 👋 Sou a Uni, sua Estrategista de Crescimento Autônomo.\n\nComo sua consultora estratégica, posso ajudar você a:\n\n✓ Expandir para Novos Mercados: Identificar oportunidades de produtos em outras plataformas\n✓ Criar Kits e Bundles: Aumentar ticket médio com combinações inteligentes\n✓ Análise de Concorrência: Monitorar tendências e ações dos concorrentes\n✓ Otimização Avançada: Precificação dinâmica e gestão de estoque estratégica\n✓ Insights Proativos: Identificar oportunidades que você ainda não viu\n\nQual área do seu negócio você gostaria de crescer hoje?',
    timestamp: new Date()
  };

  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'no_access' | 'quota_exceeded'>('no_access');
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  
  const {
    hasAccess,
    isAtLimit,
    isNearLimit,
    isUnlimited,
    currentUsage,
    limit,
    percentUsed,
    daysUntilReset,
    isLoading: quotaLoading,
    incrementUsage
  } = useAIQuota();

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
        loadConversationById(data[0].id);
      } else {
        await createNewConversation();
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setConversationsLoaded(true);
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

      if (!organizationId) {
        console.error('organization_id não disponível');
        return;
      }

      const messagesToStore = [{
        role: initialMessage.role,
        content: initialMessage.content,
        timestamp: initialMessage.timestamp.toISOString()
      }];

      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user!.id,
          organization_id: organizationId,
          messages: messagesToStore as any
        })
        .select()
        .single();

      if (error) throw error;
      
      setConversationId(data.id);
      
      // Update sidebar immediately
      setConversations(prev => [{
        id: data.id,
        title: 'Nova Conversa',
        created_at: data.created_at,
        updated_at: data.updated_at
      }, ...prev.slice(0, 9)]);

      await cleanupOldConversations();
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);

      if (error) throw error;

      setConversations(prevConversations => prevConversations.filter(c => c.id !== id));

      if (conversationId === id) {
        const { data: remainingConvs } = await supabase
          .from('ai_conversations')
          .select('id')
          .eq('user_id', user!.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (remainingConvs && remainingConvs.length > 0) {
          await loadConversationById(remainingConvs[0].id);
        } else {
          await createNewConversation();
        }
      }

      toast({
        title: "Conversa excluída",
        description: "A conversa foi removida com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao excluir conversa:', error);
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

      // Update the conversation title in sidebar based on first user message
      const title = getConversationTitle(messagesToStore);
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, title, updated_at: new Date().toISOString() } : c
      ));
    } catch (error) {
      console.error('Erro ao salvar conversa:', error);
    }
  };

  // Create a conversation in the DB without resetting the UI messages
  const ensureConversation = useCallback(async (currentMessages: Message[]): Promise<string | null> => {
    if (conversationId) return conversationId;

    if (!organizationId) {
      console.error('organization_id não disponível para ensureConversation');
      return null;
    }

    try {
      const messagesToStore = currentMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString()
      }));

      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user!.id,
          organization_id: organizationId,
          messages: messagesToStore as any
        })
        .select()
        .single();

      if (error) throw error;

      const newId = data.id;
      setConversationId(newId);

      // Update sidebar with the new conversation
      const title = getConversationTitle(currentMessages as any[]);
      setConversations(prev => [{
        id: newId,
        title,
        created_at: data.created_at,
        updated_at: data.updated_at
      }, ...prev.slice(0, 9)]);

      await cleanupOldConversations();
      return newId;
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      return null;
    }
  }, [conversationId, user, organizationId]);

  const cleanupOldConversations = async () => {
    try {
      const { data: conversations, error: fetchError } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;

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

  // SSE streaming function
  const streamResponse = useCallback(async (allMessages: Message[]) => {
    // Prepare messages for the API (skip initial welcome message)
    const apiMessages = allMessages
      .filter((_, i) => i > 0) // skip the initial assistant welcome message
      .map(m => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      throw new Error('Sessão expirada');
    }

    const resp = await fetch(STREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ messages: apiMessages }),
      signal: controller.signal,
    });

    // Handle error responses (non-stream)
    if (!resp.ok) {
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorData = await resp.json();
        if (resp.status === 429 || errorData.code === 'QUOTA_EXCEEDED') {
          setUpgradeReason('quota_exceeded');
          setShowUpgradeDialog(true);
          return;
        }
        if (resp.status === 403 || errorData.code === 'NO_ACCESS') {
          setUpgradeReason('no_access');
          setShowUpgradeDialog(true);
          return;
        }
        throw new Error(errorData.error || 'Erro ao consultar IA');
      }
      throw new Error(`Erro ${resp.status}`);
    }

    if (!resp.body) throw new Error('Stream vazio');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let assistantSoFar = '';
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantSoFar += content;
            const currentContent = assistantSoFar;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant' && last === prev[prev.length - 1] && prev.length > 1) {
                // Check if this is the streaming message (not the welcome)
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, content: currentContent };
                return updated;
              }
              return [...prev, { role: 'assistant', content: currentContent, timestamp: new Date() }];
            });
          }
        } catch {
          // Incomplete JSON: put back and wait
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        if (raw.startsWith(':') || raw.trim() === '') continue;
        if (!raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantSoFar += content;
            const currentContent = assistantSoFar;
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { ...updated[updated.length - 1], content: currentContent };
              return updated;
            });
          }
        } catch { /* ignore partial leftovers */ }
      }
    }
  }, []);

  const sendMessage = useCallback(async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed || isStreaming) return;

    if (!hasAccess) {
      setUpgradeReason('no_access');
      setShowUpgradeDialog(true);
      return;
    }

    if (isAtLimit) {
      setUpgradeReason('quota_exceeded');
      setShowUpgradeDialog(true);
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: trimmed,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);

    // Ensure a conversation exists in DB without resetting UI
    await ensureConversation(updatedMessages);

    try {
      await streamResponse(updatedMessages);
      await incrementUsage();
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      
      console.error('Erro ao consultar assistente:', error);

      if (error?.message?.includes('QUOTA_EXCEEDED')) {
        setUpgradeReason('quota_exceeded');
        setShowUpgradeDialog(true);
        return;
      }

      if (error?.message?.includes('NO_ACCESS')) {
        setUpgradeReason('no_access');
        setShowUpgradeDialog(true);
        return;
      }

      toast({
        title: "Erro",
        description: "Não foi possível obter resposta do assistente. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [isStreaming, hasAccess, isAtLimit, messages, conversationId, streamResponse, incrementUsage, toast, ensureConversation]);

  const handleSend = async () => {
    await sendMessage(input);
  };

  // Auto-send from URL query param (insight discussions)
  useEffect(() => {
    const query = searchParams.get('q');
    if (query && query.trim() && !autoSendProcessedRef.current && !isStreaming && hasAccess && user?.id && conversationsLoaded) {
      autoSendProcessedRef.current = true;
      // Clear the param from URL immediately
      setSearchParams({}, { replace: true });
      // Force a new conversation for the insight (don't reuse existing)
      setConversationId(null);
      // Send the message — ensureConversation will create a fresh one
      sendMessage(query);
    }
  }, [searchParams, isStreaming, hasAccess, user?.id, conversationsLoaded, sendMessage, setSearchParams]);

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

  // Mostrar aviso se está perto do limite
  useEffect(() => {
    if (isNearLimit && !isAtLimit && currentUsage > 0) {
      toast({
        title: "Atenção: Limite Próximo",
        description: `Você usou ${percentUsed}% das suas consultas de IA este mês.`,
      });
    }
  }, [isNearLimit]);

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold font-heading">Uni - Estrategista de IA</h1>
          <Badge variant="secondary" className="ml-2">Beta</Badge>
        </div>
        <p className="text-sm md:text-base text-muted-foreground font-body">
          Estratégia e crescimento com IA
        </p>
      </div>

      {/* Barra de quota */}
      {hasAccess && !quotaLoading && (
        <AIQuotaBar
          currentUsage={currentUsage}
          limit={limit}
          percentUsed={percentUsed}
          daysUntilReset={daysUntilReset}
          isUnlimited={isUnlimited}
          isNearLimit={isNearLimit}
          isAtLimit={isAtLimit}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,1fr)_2fr] gap-4">
        {/* Sidebar with conversations */}
        <Card className="shadow-lg">
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
            <ScrollArea className="h-[500px] md:h-[600px] w-full">
              <div className="space-y-1 p-2 w-full">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`flex items-center gap-2 p-2 rounded-lg transition-all duration-200 w-full max-w-full ${
                      conversationId === conv.id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <button
                      onClick={() => loadConversationById(conv.id)}
                      className="text-left text-sm truncate overflow-hidden flex-1 min-w-0"
                    >
                      {conv.title}
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Excluir conversa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat area */}
        <Card className="shadow-lg">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Chat com Uni
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
                    {message.role === 'assistant' ? (
                      <div className="text-xs md:text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                        {isStreaming && index === messages.length - 1 && (
                          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
                        )}
                      </div>
                    ) : (
                      <p className="text-xs md:text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                    )}
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
              {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex gap-3 justify-start">
                  <div className="hidden md:flex flex-shrink-0 w-8 h-8 rounded-full bg-primary items-center justify-center">
                    <Bot className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                      <span className="text-xs text-muted-foreground">Uni está analisando...</span>
                    </div>
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
                      disabled={!hasAccess || isAtLimit}
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
                placeholder={
                  !hasAccess 
                    ? "Faça upgrade para usar a IA..." 
                    : isAtLimit 
                      ? "Limite atingido. Faça upgrade ou aguarde renovação..." 
                      : "Digite sua pergunta..."
                }
                disabled={isStreaming || !hasAccess || isAtLimit}
                className="flex-1 text-sm md:text-base"
              />
              <Button
                onClick={handleSend}
                disabled={isStreaming || !input.trim() || !hasAccess || isAtLimit}
                className="px-3 md:px-6"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
        </Card>
      </div>

      {/* Dialog de upgrade */}
      <AIUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        reason={upgradeReason}
        currentUsage={currentUsage}
        limit={limit}
        daysUntilReset={daysUntilReset}
      />
    </div>
  );
};

export default AIAssistant;
