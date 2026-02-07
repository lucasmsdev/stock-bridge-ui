

# Upgrade Completo da Uni AI - Streaming, Memoria, Markdown e Contexto Expandido

## Resumo

Transformar a Uni AI de um sistema "pergunta-resposta" bloqueante em um chat com streaming token por token, memoria conversacional completa, respostas formatadas com markdown, e contexto de dados expandido para dar respostas mais precisas.

---

## O que muda para o usuario

1. **Respostas em tempo real** - Os tokens aparecem conforme sao gerados, ao inves de esperar 5-10 segundos pela resposta completa
2. **Memoria conversacional** - A Uni lembra do que foi discutido antes na mesma conversa e consegue fazer referencia a respostas anteriores
3. **Respostas formatadas** - Titulos em negrito, listas organizadas, tabelas de dados, tudo renderizado visualmente no chat
4. **Analises mais completas** - A Uni recebe ate 100 produtos e 200 pedidos, alem de dados de despesas e fornecedores para dar conselhos mais precisos

---

## Detalhes tecnicos

### 1. Edge Function `ai-assistant` - Reescrita com streaming e memoria

**Mudancas no body da requisicao:**
- Recebe `messages` (array completo da conversa) ao inves de apenas `question` (string unica)
- A funcao usa TODAS as mensagens anteriores na chamada a API, permitindo contexto conversacional

**Streaming SSE:**
- Habilita `stream: true` na chamada a Perplexity API
- Retorna `text/event-stream` diretamente para o frontend, repassando o stream da Perplexity
- Cada chunk SSE contem um token parcial que o frontend renderiza imediatamente
- Tratamento de erros 429 e 402 antes de iniciar o stream

**Contexto expandido:**
- Produtos: de 50 para 100 (com margem, velocidade de vendas, dias ate esgotar)
- Pedidos: de 30 para 200 na exibicao detalhada
- Novas informacoes adicionadas: despesas fixas (da tabela `expenses`) e fornecedores (da tabela `suppliers`)
- `max_tokens` aumentado de 1000 para 2000 para respostas mais detalhadas

**Mensagens enviadas a API:**
```text
[
  { role: "system", content: "prompt do sistema + dados do usuario expandidos" },
  { role: "user", content: "primeira pergunta" },
  { role: "assistant", content: "primeira resposta" },
  { role: "user", content: "segunda pergunta" },
  ...
]
```

### 2. Frontend `AIAssistant.tsx` - Streaming + Markdown

**Instalacao de dependencia:**
- Instalar `react-markdown` para renderizar respostas formatadas

**Streaming no frontend:**
- Substituir `supabase.functions.invoke` por `fetch` direto ao endpoint da Edge Function
- Implementar parser SSE line-by-line conforme best practices
- Cada token recebido atualiza o conteudo da ultima mensagem `assistant` no state
- Indicador de "digitando" durante o streaming (cursor piscando)

**Memoria conversacional:**
- `handleSend` envia TODAS as mensagens da conversa atual (sem a mensagem inicial da Uni) para o backend
- O backend recebe o historico completo e injeta no contexto da API

**Renderizacao de markdown:**
- Remover a funcao `cleanMarkdown` que stripava toda formatacao
- Usar `ReactMarkdown` com classes de estilo `prose` para renderizar headers, negrito, listas, tabelas, code blocks
- Estilizacao diferente para mensagens do usuario (texto simples) vs assistente (markdown)
- Suporte a dark mode com classes `prose-invert`

**Ajuste visual do loading:**
- Remover o spinner de loading fixo
- Mostrar cursor piscando no final da mensagem que esta sendo gerada

### 3. Arquivos modificados

1. **`supabase/functions/ai-assistant/index.ts`** - Reescrita completa: streaming SSE, historico de mensagens, contexto expandido
2. **`src/pages/AIAssistant.tsx`** - Streaming frontend, ReactMarkdown, envio de historico completo, remocao do cleanMarkdown
3. **`supabase/config.toml`** - Sem mudancas (verify_jwt ja e true)

### 4. Fluxo de dados atualizado

```text
Frontend                        Edge Function                    Perplexity API
   |                                |                                |
   |-- POST { messages: [...] } --> |                                |
   |                                |-- Valida JWT, quota           |
   |                                |-- Busca dados expandidos     |
   |                                |-- POST stream:true ---------> |
   |                                |                                |
   |   <-- SSE data: {"delta"} ---- | <-- SSE data: {"delta"} ----- |
   |   (renderiza token)            |   (repassa stream)             |
   |   <-- SSE data: {"delta"} ---- | <-- SSE data: {"delta"} ----- |
   |   (atualiza msg)               |                                |
   |   <-- SSE data: [DONE] ------- | <-- SSE data: [DONE] -------- |
   |   (finaliza)                   |                                |
```

### 5. Tratamento de erros

- **429 (Rate Limit)**: Retornado antes do stream; frontend exibe dialog de upgrade
- **402 (Quota)**: Retornado antes do stream; frontend exibe dialog de upgrade  
- **Stream interrompido**: Frontend detecta erro na leitura e exibe toast
- **API offline**: Resposta JSON de erro padrao (nao SSE)

### 6. Deploy

- Instalar `react-markdown` como dependencia
- Deploy da Edge Function `ai-assistant` apos reescrita

