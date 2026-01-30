
# Plano: Sistema Multi-Usuario com Organizacoes e Roles

## Modelo de Negocio

O plano de assinatura (Iniciante, Profissional, Enterprise, Unlimited) sera vinculado a **organizacao**, nao ao usuario individual. O admin (dono) paga o plano, e todos os membros da organizacao herdam o acesso as features desse plano.

```text
+------------------------------------------+
|  Organizacao (Empresa)                   |
|  - Plano: Enterprise                     |
|  - Limite SKUs: 2000                     |
|  - IA: 200 consultas/mes (compartilhado) |
+------------------------------------------+
        |
        +-- Admin (Dono) - paga o plano
        |
        +-- Operador - edita produtos/pedidos
        |
        +-- Visualizador - apenas consulta
```

---

## Estrutura de Papeis (Roles)

| Papel | Produtos | Pedidos | Financeiro | Integracoes | Equipe |
|-------|----------|---------|------------|-------------|--------|
| Admin | Tudo | Tudo | Tudo | Gerenciar | Convidar/Gerenciar |
| Operador | Criar/Editar | Criar/Editar | Visualizar | Visualizar | - |
| Visualizador | Ver | Ver | Ver | - | - |

---

## Fluxo do Usuario

```text
1. Usuario faz signup
   └─> Sistema cria organizacao automatica (nome da empresa)
   └─> Usuario vira admin dessa organizacao

2. Admin gera codigo de convite
   └─> Define papel (Operador ou Visualizador)
   └─> Codigo valido por 7 dias

3. Novo membro usa codigo no signup ou perfil
   └─> Entra na organizacao com papel definido
   └─> Herda acesso ao plano da organizacao

4. Membros compartilham:
   └─> Produtos, Pedidos, Integracoes, Fornecedores, Despesas
   └─> Quota de IA (compartilhada por organizacao)
```

---

## Fase 1: Banco de Dados

### Tabela: organizations
Armazena as empresas. O plano sera movido para ca (atualmente esta em profiles).

```sql
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  -- Plano da organizacao (antes estava em profiles.plan)
  plan subscription_plan NOT NULL DEFAULT 'iniciante',
  stripe_customer_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  owner_id uuid NOT NULL
);
```

### Tabela: organization_members
Relaciona usuarios com organizacoes e define papeis.

```sql
CREATE TYPE public.org_role AS ENUM ('admin', 'operator', 'viewer');

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role org_role NOT NULL DEFAULT 'viewer',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
```

### Tabela: organization_invites
Codigos de convite com validade.

```sql
CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  code text UNIQUE NOT NULL, -- 8 caracteres (ex: ABC12345)
  role org_role NOT NULL DEFAULT 'viewer',
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### Alteracoes em Tabelas Existentes
Adicionar organization_id em todas as tabelas de dados:

- products
- orders
- integrations
- suppliers
- expenses
- product_listings
- ai_usage (quota compartilhada)
- ai_conversations
- notifications
- scheduled_reports
- etc.

### Funcoes de Seguranca (Security Definer)

```sql
-- Retorna a organizacao do usuario
CREATE FUNCTION get_user_org_id(user_uuid uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT organization_id FROM organization_members 
  WHERE user_id = user_uuid LIMIT 1
$$;

-- Retorna o papel do usuario na organizacao
CREATE FUNCTION get_user_org_role(user_uuid uuid)
RETURNS org_role
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM organization_members 
  WHERE user_id = user_uuid LIMIT 1
$$;

-- Verifica se pode escrever (admin ou operator)
CREATE FUNCTION can_write_in_org(user_uuid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = user_uuid 
    AND role IN ('admin', 'operator')
  )
$$;
```

### Politicas RLS Atualizadas

```sql
-- Exemplo para products (aplica a todas as tabelas)
CREATE POLICY "Members can view org products"
  ON products FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Writers can insert org products"
  ON products FOR INSERT
  WITH CHECK (
    organization_id = get_user_org_id(auth.uid())
    AND can_write_in_org(auth.uid())
  );

CREATE POLICY "Writers can update org products"
  ON products FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()))
  WITH CHECK (can_write_in_org(auth.uid()));

CREATE POLICY "Admins can delete org products"
  ON products FOR DELETE
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND get_user_org_role(auth.uid()) = 'admin'
  );
```

### Trigger para Criar Organizacao no Signup

```sql
CREATE FUNCTION handle_new_user_org()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  new_org_id uuid;
  company text;
BEGIN
  -- Usa company_name do metadata ou nome do email
  company := COALESCE(
    NEW.raw_user_meta_data->>'company_name', 
    split_part(NEW.email, '@', 1)
  );
  
  -- Cria organizacao
  INSERT INTO organizations (name, slug, owner_id)
  VALUES (company, gen_random_uuid()::text, NEW.id)
  RETURNING id INTO new_org_id;
  
  -- Adiciona como admin
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'admin');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_org
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_org();
```

---

## Fase 2: Edge Function - manage-organization

### Endpoints

| Metodo | Path | Acao | Permissao |
|--------|------|------|-----------|
| POST | /invite | Gera codigo de convite | Admin |
| POST | /join | Usa codigo de convite | Qualquer |
| GET | /members | Lista membros | Admin |
| PATCH | /members/:id | Altera papel | Admin |
| DELETE | /members/:id | Remove membro | Admin |
| GET | /info | Info da organizacao | Todos |

### Logica Principal

```typescript
// Gerar convite (apenas admin)
if (action === 'invite') {
  // Verifica se usuario e admin
  // Gera codigo aleatorio de 8 caracteres
  // Salva em organization_invites
  // Retorna codigo
}

// Usar convite
if (action === 'join') {
  // Busca convite pelo codigo
  // Verifica se nao expirou
  // Adiciona usuario a organizacao
  // Marca convite como usado
}
```

---

## Fase 3: Atualizacao do usePlan

O hook precisa buscar o plano da **organizacao**, nao mais do profile do usuario:

```typescript
// Antes: buscar de profiles.plan
// Depois: buscar de organizations.plan via organization_members

const { data } = await supabase
  .from('organization_members')
  .select(`
    role,
    organizations (
      id,
      name,
      plan,
      stripe_customer_id
    )
  `)
  .eq('user_id', user.id)
  .single();

const plan = data?.organizations?.plan || 'iniciante';
const orgRole = data?.role || 'viewer';
```

---

## Fase 4: Atualizacao do Stripe Webhook

O webhook precisa atualizar o plano na **organizacao**, nao no profile:

```typescript
// Antes: atualiza profiles.plan
// Depois: atualiza organizations.plan

// Encontra organizacao pelo stripe_customer_id
const { data: org } = await supabaseClient
  .from('organizations')
  .select('id')
  .eq('stripe_customer_id', stripeCustomerId)
  .single();

// Atualiza plano da organizacao
await supabaseClient
  .from('organizations')
  .update({ plan: newPlan })
  .eq('id', org.id);
```

---

## Fase 5: Frontend

### Novos Arquivos

| Arquivo | Descricao |
|---------|-----------|
| src/pages/Team.tsx | Pagina de gerenciamento de equipe |
| src/components/team/TeamMembersList.tsx | Lista de membros |
| src/components/team/InviteCodeDialog.tsx | Gerar codigo de convite |
| src/components/team/JoinOrganizationDialog.tsx | Usar codigo |
| src/components/team/RoleBadge.tsx | Badge visual do papel |
| src/hooks/useOrganization.tsx | Dados da organizacao |
| src/hooks/useOrgRole.tsx | Verificar permissoes |

### Interface da Pagina de Equipe

```text
+------------------------------------------+
|  Equipe - Minha Empresa                  |
|  Plano: Enterprise (200 consultas IA)    |
+------------------------------------------+
|                                          |
|  [+ Gerar Codigo de Convite]             |
|                                          |
|  Membros (3)                             |
|  +--------------------------------------+|
|  | Avatar | Email       | Papel   | ... ||
|  |--------|-------------|---------|-----||
|  |  JD    | joao@...    | Admin   |     ||
|  |  MS    | maria@...   | Operador| [v] ||
|  |  PL    | pedro@...   | Viewer  | [v] ||
|  +--------------------------------------+|
|                                          |
|  Convites Ativos                         |
|  +--------------------------------------+|
|  | Codigo   | Papel    | Expira  | [x]  ||
|  |----------|----------|---------|------||
|  | ABC12345 | Operador | 7 dias  | [x]  ||
|  +--------------------------------------+|
+------------------------------------------+
```

### Hook useOrgRole

```typescript
export const useOrgRole = () => {
  const { user } = useAuth();
  
  const { data } = useQuery({
    queryKey: ['org-role', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .single();
      return data?.role;
    },
  });
  
  return {
    role: data || 'viewer',
    isAdmin: data === 'admin',
    isOperator: data === 'operator',
    isViewer: data === 'viewer',
    canWrite: data === 'admin' || data === 'operator',
    canManageTeam: data === 'admin',
  };
};
```

### Verificacoes de Permissao nos Componentes

```typescript
// Em qualquer componente de edicao
const { canWrite, isAdmin } = useOrgRole();

// Botao de criar/editar
{canWrite && <Button>Criar Produto</Button>}

// Botao de deletar (apenas admin)
{isAdmin && <Button variant="destructive">Excluir</Button>}

// Menu Equipe no sidebar (apenas admin)
{isAdmin && (
  <SidebarMenuItem>
    <Link to="/app/team">Equipe</Link>
  </SidebarMenuItem>
)}
```

---

## Fase 6: Migracao de Dados Existentes

Script para migrar usuarios existentes:

```sql
DO $$
DECLARE
  user_record RECORD;
  new_org_id uuid;
BEGIN
  FOR user_record IN 
    SELECT id, email, plan, company_name, stripe_customer_id 
    FROM profiles
  LOOP
    -- Criar organizacao
    INSERT INTO organizations (name, slug, owner_id, plan, stripe_customer_id)
    VALUES (
      COALESCE(user_record.company_name, split_part(user_record.email, '@', 1)),
      gen_random_uuid()::text,
      user_record.id,
      COALESCE(user_record.plan, 'iniciante'),
      user_record.stripe_customer_id
    )
    RETURNING id INTO new_org_id;
    
    -- Adicionar como admin
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (new_org_id, user_record.id, 'admin');
    
    -- Atualizar dados existentes
    UPDATE products SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE orders SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE integrations SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE suppliers SET organization_id = new_org_id WHERE user_id = user_record.id;
    UPDATE expenses SET organization_id = new_org_id WHERE user_id = user_record.id;
    -- ... outras tabelas
  END LOOP;
END $$;
```

---

## Arquivos a Criar

| Arquivo | Tipo |
|---------|------|
| supabase/functions/manage-organization/index.ts | Edge Function |
| src/pages/Team.tsx | Pagina |
| src/components/team/TeamMembersList.tsx | Componente |
| src/components/team/InviteCodeDialog.tsx | Componente |
| src/components/team/JoinOrganizationDialog.tsx | Componente |
| src/components/team/RoleBadge.tsx | Componente |
| src/hooks/useOrganization.tsx | Hook |
| src/hooks/useOrgRole.tsx | Hook |

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| src/App.tsx | Adicionar rota /app/team |
| src/components/layout/AppSidebar.tsx | Menu Equipe (condicional admin) |
| src/hooks/usePlan.tsx | Buscar plano da organizacao |
| src/hooks/useAIQuota.tsx | Quota por organizacao |
| supabase/functions/stripe-webhook/index.ts | Atualizar org.plan |
| supabase/functions/check-subscription/index.ts | Buscar org.plan |
| Todos os componentes de edicao | Verificar canWrite |

---

## Ordem de Execucao

1. Criar tabelas (organizations, organization_members, organization_invites)
2. Criar funcoes de seguranca (get_user_org_id, etc.)
3. Migrar dados existentes
4. Adicionar organization_id nas tabelas existentes
5. Atualizar politicas RLS
6. Criar edge function manage-organization
7. Atualizar hooks (usePlan, useAIQuota)
8. Criar hooks (useOrganization, useOrgRole)
9. Criar pagina Team e componentes
10. Atualizar sidebar e verificacoes de permissao
11. Atualizar webhooks do Stripe
