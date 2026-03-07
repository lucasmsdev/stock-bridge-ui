

# Plano: Validar Fluxo de Novo Usuário + Responsividade Mobile

## Parte 1: Corrigir Fluxo de Novo Usuário

### Problemas identificados no código:

1. **PendingPayment.tsx redireciona para rotas erradas**: Linhas 39 e 59 usam `navigate('/dashboard')` em vez de `navigate('/app/dashboard')`. Isso causa tela branca porque `/dashboard` não existe como rota -- cai no catch-all `*` que redireciona para `/`.

2. **Signup.tsx redireciona para `/checkout` após cadastro**: O fluxo signup -> checkout funciona, mas se o Supabase exigir confirmação de email, o usuário fica preso (sem sessão ativa, o checkout não consegue criar a sessão Stripe).

3. **Login.tsx não trata o param `?checkout=`**: Quando o Checkout redireciona para login com `?checkout=plan`, o Login não pega esse parâmetro para redirecionar de volta ao checkout após login bem-sucedido.

### Correções:

- **PendingPayment.tsx**: Corrigir `navigate('/dashboard')` para `navigate('/app/dashboard')` nas linhas 39 e 59.
- **Login.tsx**: Após login bem-sucedido, verificar se existe `searchParams.get('checkout')` e redirecionar para `/checkout?plan=X` em vez do dashboard.
- **AppLayout.tsx**: O fluxo de verificação de assinatura já está correto (redireciona para `/pending-payment` se não tem assinatura).

---

## Parte 2: Responsividade Mobile em Tabelas e Telas

### Problema:
As tabelas de Pedidos, Produtos e Rastreamento usam `<Table>` HTML padrão com muitas colunas, que ficam cortadas ou com scroll horizontal ruim em telas de 390px.

### Abordagem:
Criar um padrão de "card layout" para mobile que substitui a tabela em telas pequenas, mantendo a tabela no desktop.

### Páginas que precisam de ajuste:

**1. Orders.tsx (7 colunas)**
- Mobile: esconder colunas "Data", "Itens", "Cliente" e mostrar layout de card compacto
- Manter: ID, Canal (logo), Valor, Status

**2. Products.tsx (7 colunas incluindo checkbox)**
- Mobile: esconder colunas "SKU", "Canais" e converter para card com info empilhada
- Manter: Checkbox, Produto (nome+imagem), Estoque, Preço, Ações

**3. Tracking.tsx (8 colunas)**
- Já tem `overflow-x-auto` mas precisa de esconder colunas menos críticas no mobile
- Mobile: esconder "Transportadora", "Atualização" e simplificar "Código de Rastreio"

**4. Header de páginas (Orders, Products, Suppliers)**
- Botões "Sincronizar" e "Exportar" ficam apertados no mobile
- Converter para layout empilhado ou ícone-only no mobile

### Implementação técnica:
- Usar classes `hidden md:table-cell` nas colunas menos importantes
- Nos `TableCell` mobile-visible, empilhar informações secundárias como subtexto
- Ajustar headers de página com `flex-wrap` e botões menores no mobile
- Garantir que filtros (Select + Input) empilhem corretamente com `flex-col sm:flex-row`

### Páginas que já estão OK:
- **Suppliers.tsx**: Já usa grid de cards (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
- **Expenses**: Usa cards, não tabelas
- **Dashboard**: Já tem `grid-cols-1 md:grid-cols-*`

---

## Resumo de Arquivos a Editar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/auth/PendingPayment.tsx` | Corrigir rotas `/dashboard` para `/app/dashboard` |
| `src/pages/auth/Login.tsx` | Tratar param `?checkout=` no redirect pós-login |
| `src/pages/Orders.tsx` | Responsividade mobile: esconder colunas, ajustar header |
| `src/pages/Products.tsx` | Responsividade mobile: esconder colunas, ajustar header |
| `src/pages/Tracking.tsx` | Responsividade mobile: esconder colunas |

