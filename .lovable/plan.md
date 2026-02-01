

# Plano: Corrigir Edge Function seed-demo-data

## Problema Identificado

A Edge Function `seed-demo-data` está inserindo dados **sem `organization_id`**, e as RLS policies exigem que `organization_id = get_user_org_id(auth.uid())` para permitir leitura. Isso faz com que os dados gerados fiquem "invisíveis" para o usuário no Dashboard.

Dados no banco confirmam o problema:
- 1089 pedidos com `organization_id = NULL`
- 25 produtos com `organization_id = NULL`
- O usuário pertence à organização `7deae850-e4c2-42d6-880b-2ec84c9a5eca`

---

## Solução

Modificar a Edge Function `seed-demo-data` para:

1. **Buscar a organização do usuário** antes de inserir dados
2. **Incluir `organization_id`** em todos os inserts (products, orders, expenses, suppliers, notifications, etc.)

---

## Modificações

### Arquivo: `supabase/functions/seed-demo-data/index.ts`

#### 1. Buscar organization_id do usuário (após autenticação, ~linha 141)

Adicionar consulta para obter a organização do usuário:

```typescript
// Buscar organization_id do usuário
const { data: orgMember } = await supabase
  .from('organization_members')
  .select('organization_id')
  .eq('user_id', user.id)
  .single();

const organizationId = orgMember?.organization_id;

if (!organizationId) {
  return new Response(JSON.stringify({ 
    error: 'Usuário não pertence a nenhuma organização' 
  }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

#### 2. Adicionar organization_id em todos os inserts

**Suppliers (linha ~161):**
```typescript
const supplierInserts = suppliers.map(s => ({
  user_id: user.id,
  organization_id: organizationId,  // <- ADICIONAR
  name: s.name,
  ...
}));
```

**Products (linha ~175):**
```typescript
const productInserts = products.map((p, i) => ({
  user_id: user.id,
  organization_id: organizationId,  // <- ADICIONAR
  name: p.name,
  ...
}));
```

**Orders (linhas ~204, 227, 251, 275):**
```typescript
orders.push({
  user_id: user.id,
  organization_id: organizationId,  // <- ADICIONAR
  order_id_channel: ...,
  ...
});
```

**Expenses (linha ~301):**
```typescript
const expenseInserts = expenses.map(e => ({
  user_id: user.id,
  organization_id: organizationId,  // <- ADICIONAR
  name: e.name,
  ...
}));
```

**Notifications (linha ~314):**
```typescript
const notificationInserts = notifications.map((n, i) => ({
  user_id: user.id,
  organization_id: organizationId,  // <- ADICIONAR (se a tabela tiver esse campo)
  type: n.type,
  ...
}));
```

**Price Monitoring Jobs (linha ~330):**
```typescript
const monitoringJobs = insertedProducts!.slice(0, 8).map(p => ({
  user_id: user.id,
  organization_id: organizationId,  // <- ADICIONAR (se a tabela tiver esse campo)
  product_id: p.id,
  ...
}));
```

---

## Tabelas Afetadas

| Tabela | Tem organization_id? | Precisa Adicionar? |
|--------|---------------------|-------------------|
| suppliers | Verificar | Sim |
| products | Sim | Sim |
| orders | Sim | Sim |
| expenses | Sim | Sim |
| notifications | Verificar | Possivelmente |
| price_monitoring_jobs | Verificar | Possivelmente |

---

## Ações Adicionais

Após atualizar a Edge Function, será necessário:

1. **Deploy** da Edge Function atualizada
2. **Limpar dados antigos** com organization_id NULL (ou atualizar para o ID correto)
3. **Testar novamente** o botão "Gerar Demo"

---

## Resultado Esperado

Após a correção:
- O botão "Gerar Demo" criará dados com o `organization_id` correto
- As RLS policies permitirão a leitura dos dados
- O Dashboard exibirá os dados corretamente

