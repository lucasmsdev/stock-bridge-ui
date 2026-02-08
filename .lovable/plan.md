
# Fix: Feedback imediato e criacao de conversa nos Insights

## Problemas identificados

1. **Sem feedback visual**: Quando o usuario clica "Discutir com Uni" e a mensagem e enviada, nao ha indicacao de que a Uni esta processando. O usuario fica vendo a tela parada por varios segundos ate o streaming comecar.

2. **Conversa nao e criada no painel lateral**: A funcao `createNewConversation` reseta as mensagens para a mensagem de boas-vindas (apagando a mensagem do usuario), e salva no banco apenas a mensagem inicial -- nunca registra a conversa do insight corretamente.

---

## O que muda para o usuario

- Ao clicar em "Discutir com Uni", a mensagem do usuario aparece instantaneamente no chat com um indicador visual de "Uni esta pensando..." (tres pontinhos animados) logo abaixo.
- A conversa aparece imediatamente no painel lateral esquerdo com o titulo do insight.
- A conversa fica salva e pode ser revisitada depois.

---

## Detalhes tecnicos

### Arquivo modificado: `src/pages/AIAssistant.tsx`

**1. Adicionar indicador "pensando"**

Quando `isStreaming` for `true` e a ultima mensagem for do usuario (ou seja, a Uni ainda nao comecou a responder), exibir um bloco visual com animacao de tres pontinhos e texto "Uni esta analisando...". Isso aparece instantaneamente apos o envio da mensagem.

**2. Corrigir criacao de conversa no `sendMessage`**

O fluxo atual chama `createNewConversation()` que reseta tudo. A correcao:

- Separar a logica de "criar registro no banco" da logica de "resetar UI"
- Criar uma funcao `ensureConversation()` que:
  - Se ja existe `conversationId`, nao faz nada
  - Se nao existe, cria um novo registro no banco SEM resetar as mensagens na UI
  - Seta o `conversationId` e atualiza a lista de conversas no painel lateral
- Usar `ensureConversation()` dentro de `sendMessage` no lugar de `createNewConversation()`

**3. Corrigir o auto-send dos insights**

O `useEffect` de auto-send precisa:
- Aguardar as conversas carregarem primeiro (verificar que `loadConversations` terminou)
- Forcar criacao de uma nova conversa para o insight (nao reutilizar conversa existente)
- Garantir que a mensagem do usuario e a primeira coisa salva na conversa

### Fluxo corrigido

```text
Usuario clica "Discutir com Uni"
    |
    v
Navega para /app/ai-assistant?q=...
    |
    v
useEffect detecta ?q= e aguarda user e conversas carregarem
    |
    v
Cria nova conversa no banco (sem resetar UI)
    |
    v
Envia mensagem automaticamente via sendMessage()
    |
    v
Mensagem do usuario aparece + indicador "pensando..."
    |
    v
Streaming comeca, indicador some, resposta aparece token a token
    |
    v
Conversa aparece no painel lateral com titulo do insight
```

### Nenhum outro arquivo precisa ser alterado

Todas as mudancas sao em `src/pages/AIAssistant.tsx`.
