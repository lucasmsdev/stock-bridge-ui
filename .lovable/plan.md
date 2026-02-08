
# Insights da Uni direto no chat - Envio automatico da pergunta

## Resumo

Quando o usuario clica em "Discutir com Uni" em um insight do Dashboard, ele e redirecionado para o chat da Uni AI. Porem, a pergunta fica apenas na URL (`?q=...`) e nunca e lida pela pagina. O plano corrige isso para que a pergunta seja automaticamente enviada ao abrir o chat, iniciando a conversa sobre o insight sem nenhum clique adicional.

---

## O que muda para o usuario

Ao clicar em "Discutir com Uni" em qualquer insight do Dashboard, o chat da Uni abre e **ja comeca a responder automaticamente** sobre aquele insight. O usuario nao precisa copiar, colar ou digitar nada -- a conversa ja inicia com o contexto do insight.

---

## Detalhes tecnicos

### Arquivo modificado: `src/pages/AIAssistant.tsx`

1. **Importar `useSearchParams`** do `react-router-dom` para ler parametros da URL
2. **Adicionar `useEffect`** que monitora o parametro `q` na URL:
   - Se `q` existir e nao estiver vazio, cria uma nova conversa e envia a pergunta automaticamente usando a funcao `handleSend` ja existente
   - Limpa o parametro `q` da URL apos processar (para evitar reenvio ao navegar de volta)
   - So dispara se nao estiver em streaming e se tiver acesso
3. **Fluxo**:
   - Usuario clica "Discutir com Uni" no insight do Dashboard
   - Navega para `/app/ai-assistant?q=Sobre o insight: "..."...`
   - `useEffect` detecta o `q`, seta no input e dispara o envio
   - A Uni comeca a responder imediatamente sobre o insight
   - O parametro `q` e removido da URL

### Nenhum outro arquivo precisa ser alterado

O `ProactiveInsightsCard.tsx` ja monta a URL corretamente com o parametro `q` e a navegacao funciona. Apenas o lado receptor (AIAssistant) precisa ser atualizado.
