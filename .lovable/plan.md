
# Fix: Conversas da Uni AI nao sendo salvas no menu lateral

## Problema raiz

A tabela `ai_conversations` possui uma coluna `organization_id` que e obrigatoria nas politicas de seguranca (RLS). Todas as operacoes exigem que `organization_id = get_user_org_id(auth.uid())`:

- **INSERT**: `with_check` exige `organization_id` correto
- **SELECT**: filtra por `organization_id` da organizacao do usuario
- **UPDATE**: filtra por `organization_id`
- **DELETE**: exige `organization_id` + ser admin

O codigo atual **nunca envia** `organization_id` ao criar conversas (tanto em `createNewConversation` quanto em `ensureConversation`). Resultado: o insert e rejeitado silenciosamente pelo RLS, e a conversa nunca e persistida no banco.

Alem disso, o `loadConversations` filtra por `user_id` mas o RLS filtra por `organization_id` -- sem o campo preenchido, as queries SELECT tambem retornam vazio.

---

## O que muda para o usuario

- Ao clicar no botao "+" ou enviar qualquer mensagem, a conversa sera criada e aparecera imediatamente no painel lateral.
- As conversas ficam salvas e podem ser revisitadas.
- O fluxo "Discutir com Uni" dos insights tambem cria e salva a conversa corretamente.

---

## Detalhes tecnicos

### Arquivo modificado: `src/pages/AIAssistant.tsx`

**1. Obter `organization_id` do usuario**

Importar e usar o hook `useOrganization` (ja existente no projeto) para obter o `organizationId` do usuario logado. Caso o hook nao forneca diretamente, fazer uma query unica ao `organization_members` para buscar o `organization_id` do usuario.

**2. Corrigir `createNewConversation`**

Adicionar `organization_id` ao insert:

```
const { data, error } = await supabase
  .from('ai_conversations')
  .insert({
    user_id: user.id,
    organization_id: orgId,    // <-- ADICIONAR
    messages: messagesToStore
  })
  .select()
  .single();
```

**3. Corrigir `ensureConversation`**

Mesmo ajuste -- adicionar `organization_id` ao insert:

```
const { data, error } = await supabase
  .from('ai_conversations')
  .insert({
    user_id: user.id,
    organization_id: orgId,    // <-- ADICIONAR
    messages: messagesToStore
  })
  .select()
  .single();
```

**4. Atualizar sidebar apos salvar mensagens**

Apos o `saveConversation` salvar no banco, atualizar o titulo da conversa no estado local `conversations` para refletir a primeira mensagem do usuario (sem precisar recarregar tudo do banco).

**5. Corrigir a permissao de DELETE**

A politica de DELETE exige `is_org_admin`. Para permitir que qualquer usuario delete suas proprias conversas, a funcao `deleteConversation` deve verificar se o usuario e o dono (`user_id`) alem do filtro por organizacao. Se necessario, ajustar a politica RLS para permitir que o dono da conversa tambem possa exclui-la.

### Resumo das mudancas

- Buscar `organization_id` ao montar o componente
- Incluir `organization_id` em todos os inserts de conversas
- Atualizar titulo da conversa no sidebar apos mensagens serem salvas
- Ajustar politica RLS de DELETE para permitir exclusao pelo dono da conversa
