

# Correcao dos 3 Problemas Criticos (Plano Atualizado)

## Contexto importante

O projeto tem **dois sistemas de nomes** em conflito:
- `usePlan.tsx` (enum): `iniciante`, `profissional`, `enterprise`, `unlimited`
- Todo o resto (Stripe, Billing, Checkout, Landing, Signup): `estrategista`, `competidor`, `dominador`, `unlimited`

Os 4 planos corretos sao: **Iniciante** (R$97), **Profissional** (R$197), **Enterprise** (R$297), **Unlimited** (R$397). O trial continua em 14 dias.

---

## 1. Unificar nomes dos planos em todo o projeto

Todos os arquivos serao migrados para usar os nomes do enum: `iniciante`, `profissional`, `enterprise`, `unlimited`. Isso elimina a confusao entre nomes antigos e novos.

### Backend (Edge Functions)

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/create-checkout/index.ts` | Trocar chaves do `planPriceMap` de `estrategista/competidor/dominador` para `iniciante/profissional/enterprise` |
| `supabase/functions/stripe-webhook/index.ts` | Trocar valores dos dois `priceToPlantMap` para `iniciante/profissional/enterprise/unlimited`. Corrigir o Price ID do enterprise: de `price_1SPpumKRFmEnuZwjDVJSIOZ2` para `price_1SUaBhKdlB8Nu9cyPgDnMGtR` (mesmo do create-checkout) |
| `supabase/functions/import-products/index.ts` | Trocar chaves do `skuLimits` para `iniciante/profissional/enterprise` |
| `supabase/functions/check-subscription-compatibility/index.ts` | Atualizar comentarios dos Price IDs |

### Frontend

| Arquivo | Mudanca |
|---|---|
| `src/pages/Landing.tsx` | Trocar `id` dos planos: `estrategista` para `iniciante`, `competidor` para `profissional`, `dominador` para `enterprise` |
| `src/pages/Checkout.tsx` | Remover `planMap` (nao precisa mais traduzir nomes). Usar `iniciante/profissional/enterprise/unlimited` diretamente em `planDetails` e validacoes |
| `src/pages/Billing.tsx` | Trocar chaves de `planIcons`, `planColors`, `planGradients`, `planPrices` para `iniciante/profissional/enterprise/unlimited` |
| `src/pages/auth/Signup.tsx` | Trocar validacao e `selectedPlan` default para usar `iniciante/profissional/enterprise/unlimited` |
| `src/pages/Profile.tsx` | Trocar chaves de `planNames` e `planColors` para novos nomes |
| `src/components/ui/upgrade-banner.tsx` | Trocar todas as chaves dos mapas (`planIcons`, `planNames`, `planColors`, `buttonColors`) para `iniciante/profissional/enterprise/unlimited` |

### Migracao de dados existentes

Usuarios que ja tem `estrategista`, `competidor` ou `dominador` gravado na tabela `organizations` precisam ser atualizados. Sera adicionada uma query SQL de migracao:

```text
UPDATE organizations SET plan = 'iniciante' WHERE plan = 'estrategista';
UPDATE organizations SET plan = 'profissional' WHERE plan = 'competidor';
UPDATE organizations SET plan = 'enterprise' WHERE plan = 'dominador';
```

---

## 2. Pagina de Detalhes do Pedido

Criar uma pagina completa para visualizar um pedido individual:
- Informacoes do pedido (ID, data, status, plataforma)
- Dados do cliente (nome, email)
- Lista de itens do pedido
- Informacoes de rastreio
- Botao de voltar

| Arquivo | Tipo |
|---|---|
| `src/pages/OrderDetails.tsx` | Novo |
| `src/App.tsx` | Edicao - adicionar rota `/app/orders/:id` |
| `src/pages/Orders.tsx` | Edicao - adicionar `onClick` + `useNavigate` nas linhas da tabela |

---

## 3. Paginacao na Listagem de Pedidos

- Limite de 50 pedidos por pagina
- Query com `.range(from, to)` e `{ count: 'exact' }`
- Controles de paginacao na parte inferior da tabela
- Reset para pagina 1 ao aplicar filtros

| Arquivo | Tipo |
|---|---|
| `src/pages/Orders.tsx` | Edicao - refatorar query e adicionar controles de pagina |

---

## Resumo de todos os arquivos

| Arquivo | Tipo |
|---|---|
| `supabase/functions/create-checkout/index.ts` | Edicao |
| `supabase/functions/stripe-webhook/index.ts` | Edicao |
| `supabase/functions/import-products/index.ts` | Edicao |
| `supabase/functions/check-subscription-compatibility/index.ts` | Edicao |
| `src/pages/Landing.tsx` | Edicao |
| `src/pages/Checkout.tsx` | Edicao |
| `src/pages/Billing.tsx` | Edicao |
| `src/pages/auth/Signup.tsx` | Edicao |
| `src/pages/Profile.tsx` | Edicao |
| `src/components/ui/upgrade-banner.tsx` | Edicao |
| `src/pages/OrderDetails.tsx` | Novo |
| `src/App.tsx` | Edicao |
| `src/pages/Orders.tsx` | Edicao |

