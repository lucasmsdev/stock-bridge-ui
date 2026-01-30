
# Plano: Completar Verificacoes de Permissao e Integracao do Convite

## Objetivo

Finalizar a implementacao do sistema multi-usuario adicionando as verificacoes de permissao (role-based) nos componentes e integrando o dialog de convite na pagina de Perfil.

---

## O Que Sera Feito

### 1. Adicionar Verificacoes de Permissao nos Componentes

Cada componente que permite criar, editar ou excluir dados precisa respeitar os papeis:
- **Admin**: Pode criar, editar e excluir
- **Operator**: Pode criar e editar (nao pode excluir)
- **Viewer**: Apenas visualiza (nao pode criar, editar ou excluir)

**Componentes a modificar:**

| Componente | Alteracao |
|------------|-----------|
| Products.tsx | Ocultar botao "Novo Produto" para viewers, ocultar "Excluir" para operators |
| CreateProduct.tsx | Redirecionar viewers que tentarem acessar diretamente |
| ProductDetails.tsx | Ocultar botoes de edicao para viewers, excluir para operators |
| Orders.tsx | Mesma logica de permissoes |
| Suppliers.tsx | Mesma logica de permissoes |
| SupplierDetails.tsx | Mesma logica de permissoes |
| Expenses.tsx | Mesma logica de permissoes |
| Integrations.tsx | Ocultar completamente para viewers e operators (apenas admin) |

**Exemplo de implementacao:**

```text
// No componente
const { canWrite, isAdmin, isViewer } = useOrgRole();

// Botao de criar (admin e operator)
{canWrite && <Button>Novo Produto</Button>}

// Botao de excluir (apenas admin)
{isAdmin && <Button variant="destructive">Excluir</Button>}

// Redirecionar viewer de paginas de criacao
if (isViewer) {
  navigate('/app/products');
  toast({ title: "Acesso negado", description: "Voce nao tem permissao para criar produtos." });
  return;
}
```

---

### 2. Adicionar Dialog de Convite na Pagina de Perfil

Permitir que usuarios usem codigos de convite para entrar em organizacoes existentes.

**Alteracoes em Profile.tsx:**
- Adicionar secao "Entrar em uma Organizacao"
- Botao "Tenho um codigo de convite"
- Ao clicar, abre o JoinOrganizationDialog existente
- Apos entrar com sucesso, recarrega a pagina para atualizar o contexto

**Interface:**

```text
+------------------------------------------+
|  Organizacao                             |
+------------------------------------------+
|  Voce faz parte de: Minha Empresa        |
|  Papel: Operador                         |
|                                          |
|  [Tenho um codigo de convite]            |
+------------------------------------------+
```

---

### 3. Bloquear Acesso a Integracoes para Nao-Admins

A pagina de Integracoes deve ser acessivel apenas para admins, pois conectar marketplaces e afeta toda a organizacao.

**Alteracoes:**
- Integrations.tsx: Verificar se e admin, se nao, mostrar mensagem e redirecionar
- AppSidebar.tsx: Ja oculta o menu para nao-admins (implementado)

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| src/pages/Products.tsx | Importar useOrgRole, ocultar botoes conforme papel |
| src/pages/CreateProduct.tsx | Verificar canWrite antes de renderizar |
| src/pages/ProductDetails.tsx | Ocultar botoes de edicao/exclusao |
| src/pages/Orders.tsx | Verificar permissoes |
| src/pages/Suppliers.tsx | Verificar permissoes |
| src/pages/SupplierDetails.tsx | Verificar permissoes |
| src/pages/Expenses.tsx | Verificar permissoes |
| src/pages/Integrations.tsx | Bloquear acesso para nao-admins |
| src/pages/Profile.tsx | Adicionar secao de organizacao e JoinOrganizationDialog |

---

## Detalhes Tecnicos

### Logica de Permissoes Resumida

| Acao | Admin | Operator | Viewer |
|------|-------|----------|--------|
| Visualizar dados | Sim | Sim | Sim |
| Criar produtos/pedidos | Sim | Sim | Nao |
| Editar produtos/pedidos | Sim | Sim | Nao |
| Excluir produtos/pedidos | Sim | Nao | Nao |
| Gerenciar integracoes | Sim | Nao | Nao |
| Gerenciar equipe | Sim | Nao | Nao |

### Hook useOrgRole (ja existe)

```typescript
const { 
  role,           // 'admin' | 'operator' | 'viewer'
  isAdmin,        // true se admin
  isOperator,     // true se operator
  isViewer,       // true se viewer
  canWrite,       // true se admin ou operator
  canManageTeam,  // true se admin
  canManageIntegrations, // true se admin
  canDeleteItems  // true se admin
} = useOrgRole();
```

---

## Ordem de Execucao

1. Adicionar verificacoes em Products.tsx (botoes de criar/excluir)
2. Adicionar verificacoes em CreateProduct.tsx (redirect se viewer)
3. Adicionar verificacoes em ProductDetails.tsx
4. Adicionar verificacoes em Orders.tsx
5. Adicionar verificacoes em Suppliers.tsx e SupplierDetails.tsx
6. Adicionar verificacoes em Expenses.tsx
7. Bloquear Integrations.tsx para nao-admins
8. Adicionar secao de organizacao e JoinOrganizationDialog em Profile.tsx
9. Testar fluxo completo com diferentes papeis
