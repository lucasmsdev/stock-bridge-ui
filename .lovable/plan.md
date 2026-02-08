
# Uni AI com Ações Executáveis - "Sugestão com 1 Clique"

## Resumo

Permitir que a Uni AI sugira alterações concretas em produtos (preço, estoque, etc.) e o usuário execute essas alterações com um único clique direto no chat, sem precisar navegar para outras páginas ou preencher formulários.

---

## Como funciona para o usuário

1. O usuário pergunta algo como "quais produtos precisam de ajuste de preço?" ou a Uni identifica proativamente uma oportunidade
2. A Uni responde com a análise e inclui **botões de ação** inline na resposta
3. O usuário clica no botão para executar a alteração
4. Um toast confirma que a alteração foi aplicada (inclusive nos marketplaces vinculados)

Exemplo visual no chat:

```text
Uni: Identifiquei 2 produtos com margem abaixo de 10%:

1. **Capa iPhone 15** (SKU: CIP15)
   Preço atual: R$ 25,00 | Custo: R$ 23,50 | Margem: 6%
   Sugestão: Aumentar para R$ 32,90 (margem ~28%)

   [Aplicar: R$ 32,90]

2. **Película Samsung S24** (SKU: PLS24)
   Estoque: 3 unidades | Vendas 30d: 15 unidades
   Sugestão: Repor estoque para 50 unidades

   [Aplicar: Estoque 50]
```

---

## Detalhes tecnicos

### Limitação da Perplexity API

A Perplexity nao suporta "function calling" nativo. A solução é usar o **system prompt** para instruir a IA a emitir blocos de ação em formato JSON delimitado quando identificar alterações concretas, e o frontend parseia esses blocos.

### 1. Modificar o system prompt da Edge Function `ai-assistant/index.ts`

Adicionar instrução ao system prompt para que a Uni emita blocos de ação estruturados quando sugerir mudanças concretas:

```text
AÇÕES EXECUTÁVEIS:
Quando recomendar uma alteração concreta em um produto, inclua um bloco de ação
no formato abaixo APÓS sua explicação. O sistema vai renderizar um botão para o
usuário executar com 1 clique.

Formato:
:::action
{"type":"update_price","product_id":"uuid","sku":"SKU123","product_name":"Nome","new_value":32.90,"label":"Aplicar: R$ 32,90"}
:::

:::action
{"type":"update_stock","product_id":"uuid","sku":"SKU123","product_name":"Nome","new_value":50,"label":"Aplicar: Estoque 50"}
:::

Tipos de ação suportados:
- update_price: altera selling_price
- update_stock: altera stock (modo "set")

REGRAS:
- Só emita ações quando tiver dados concretos (product_id real, valores calculados)
- Sempre explique o motivo ANTES do bloco de ação
- Use o product_id real dos dados do contexto, nunca invente
- O label deve ser curto e claro para o botão
```

### 2. Modificar o frontend `src/pages/AIAssistant.tsx`

**a) Parser de blocos de ação**

Criar uma função que detecta blocos `:::action ... :::` no conteúdo da mensagem da Uni e os separa do texto normal.

```typescript
interface AIAction {
  type: 'update_price' | 'update_stock';
  product_id: string;
  sku: string;
  product_name: string;
  new_value: number;
  label: string;
}

function parseActions(content: string): { text: string; actions: AIAction[] } {
  const actionRegex = /:::action\n([\s\S]*?)\n:::/g;
  const actions: AIAction[] = [];
  const text = content.replace(actionRegex, (_, json) => {
    try {
      actions.push(JSON.parse(json.trim()));
    } catch {}
    return '';
  });
  return { text: text.trim(), actions };
}
```

**b) Componente ActionButton**

Criar um componente inline que renderiza o botão de ação com estados: idle, loading, success, error.

- Ao clicar, chama a edge function `update-product` (para preço) ou `bulk-update-products` (para estoque) via Supabase client
- Mostra feedback visual (loading spinner, checkmark verde, ou erro)
- Desabilita o botão após sucesso para evitar cliques duplos

**c) Renderização no chat**

No bloco que renderiza mensagens do assistant, após o `ReactMarkdown`, verificar se existem ações parseadas e renderizar os botões correspondentes.

### 3. Edge Function de execução (reutilização)

Não é necessário criar nova edge function. As ações usam as funções existentes:

- `update_price` chama `update-product` com `{ productId, selling_price, name, sku }`
- `update_stock` chama `bulk-update-products` com `{ productIds: [id], updates: { stock_mode: 'set', stock_value: N } }`

Ambas já sincronizam automaticamente com os marketplaces vinculados.

### 4. Inclusão dos product_id no contexto da IA

O system prompt já inclui nome e SKU dos produtos, mas precisa incluir também o `id` (UUID) para que a IA possa referenciá-los nos blocos de ação. Ajustar a linha no `dataContext`:

```
- ${p.name} (SKU: ${p.sku}, ID: ${p.id})
```

### Fluxo completo

```text
Usuário pergunta: "quais produtos precisam de ajuste de preço?"
    |
    v
Edge Function ai-assistant:
  - Busca dados reais dos produtos (com IDs)
  - Envia para Perplexity com system prompt incluindo instrução de ações
  - Perplexity responde com análise + blocos :::action:::
    |
    v
Frontend AIAssistant.tsx:
  - Recebe stream SSE
  - Ao finalizar, parseia o conteúdo separando texto e ações
  - Renderiza markdown normalmente + botões de ação abaixo
    |
    v
Usuário clica no botão "Aplicar: R$ 32,90"
    |
    v
Frontend chama supabase.functions.invoke('update-product', {...})
    |
    v
Edge Function update-product:
  - Atualiza produto no banco
  - Sincroniza com marketplaces vinculados
  - Retorna resultado
    |
    v
Frontend mostra toast: "Preço atualizado para R$ 32,90 e sincronizado com 2 marketplaces"
```

### Arquivos modificados

1. `supabase/functions/ai-assistant/index.ts` - System prompt + incluir product_id no contexto
2. `src/pages/AIAssistant.tsx` - Parser de ações + componente de botão + renderização inline

### Segurança

- O usuário SEMPRE tem que clicar para confirmar -- a IA nunca executa automaticamente
- As edge functions de update já validam autenticação e propriedade do produto (RLS + user_id check)
- Os product_id no contexto são reais e verificados

### Limitações e evolução futura

- Perplexity pode ocasionalmente emitir blocos de ação mal formatados -- o parser ignora silenciosamente
- Futuramente, se migrar para um provider com function calling (OpenAI, Anthropic), o sistema pode ser aprimorado para execução mais confiável
- Tipos de ação podem ser expandidos (ex: `create_kit`, `pause_listing`, `reorder_stock`)
