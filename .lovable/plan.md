
# Wizard de Onboarding para Novos Usuarios

## Resumo

Um wizard guiado em 4 passos que aparece apenas na primeira vez que o usuario acessa o app apos o cadastro. O wizard e um dialog fullscreen com navegacao por steps, visual alinhado ao design system UNISTOCK.

---

## Experiencia do usuario

Ao fazer login pela primeira vez, o usuario ve um dialog de tela cheia com 4 etapas:

1. **Boas-vindas** - Saudacao personalizada com o nome do usuario, breve explicacao do que o UNISTOCK faz e o que sera configurado
2. **Conectar Marketplace** - Cards dos marketplaces disponiveis (Mercado Livre, Shopee, Amazon, Shopify, Magalu) com botao para conectar. O usuario pode pular esta etapa
3. **Importar Produtos** - Explicacao de como importar produtos (via marketplace conectado ou manualmente). Se conectou um marketplace no passo anterior, mostra botao de importar. Senao, mostra opcao de criar produto manualmente
4. **Visao Geral** - Mini-tour visual do dashboard mostrando os cards principais (vendas, pedidos, estoque, lucro) e funcionalidades-chave. Botao "Comecar a usar" para finalizar

Cada passo tem indicador de progresso (stepper), botoes "Voltar" e "Proximo/Pular", e o ultimo passo tem "Comecar a usar". Ao finalizar, o campo `has_completed_onboarding` no perfil do usuario e marcado como `true` e o dialog fecha permanentemente.

---

## Detalhes tecnicos

### 1. Migracao de banco de dados

Adicionar coluna `has_completed_onboarding` na tabela `profiles`:

```sql
ALTER TABLE public.profiles 
ADD COLUMN has_completed_onboarding boolean DEFAULT false;
```

Valor padrao `false` garante que todos os novos usuarios vejam o wizard. Usuarios existentes tambem verao o wizard na proxima vez que acessarem (comportamento aceitavel para apresentar o recurso).

### 2. Novo componente: `src/components/onboarding/OnboardingWizard.tsx`

Componente principal do wizard com:

- Estado local para controlar o step atual (0-3)
- Query ao Supabase para verificar `has_completed_onboarding` do perfil
- Se `true`, nao renderiza nada
- Se `false`, renderiza o Dialog fullscreen
- Ao finalizar (ultimo passo ou "Pular tudo"), faz UPDATE no perfil e fecha o dialog
- Usa `Dialog` do Radix UI para o overlay
- Stepper visual com circulos numerados e barra de progresso

Subcomponentes internos por step:

- **WelcomeStep**: Icone UNISTOCK, saudacao com nome, lista de beneficios
- **ConnectMarketplaceStep**: Grid de cards de marketplace com logos (reutiliza `PlatformLogo`). Ao clicar, redireciona para `/app/integrations` com `onboarding=true` na URL e fecha o wizard (marcando onboarding como completo)
- **ImportProductsStep**: Opcoes de importar via marketplace ou criar manualmente. Links para `/app/products` e `/app/integrations`
- **DashboardOverviewStep**: Preview visual das funcionalidades com icones e descricoes curtas (vendas, estoque, financeiro, Uni AI)

### 3. Integracao no `src/components/layout/AppLayout.tsx`

Importar e renderizar `<OnboardingWizard />` apos o conteudo principal:

```tsx
<OnboardingWizard userName={user?.user_metadata?.name} />
```

O componente internamente faz a query de verificacao e decide se mostra ou nao.

### 4. Atualizacao do `src/integrations/supabase/types.ts`

Adicionar `has_completed_onboarding` nos tipos Row, Insert e Update da tabela `profiles`.

### Arquivos modificados

1. **Nova migracao SQL** - Adicionar coluna `has_completed_onboarding`
2. **`src/components/onboarding/OnboardingWizard.tsx`** (novo) - Componente do wizard completo
3. **`src/components/layout/AppLayout.tsx`** - Renderizar o wizard
4. **`src/integrations/supabase/types.ts`** - Tipos atualizados

### Design visual

- Dialog com fundo `bg-background` e overlay semi-transparente
- Stepper no topo com 4 circulos conectados por linha, step ativo em `primary` (laranja)
- Cards de marketplace com hover effect e borda `border-primary` ao selecionar
- Botoes seguem o design system: primario (laranja) para avancar, outline para voltar/pular
- Responsivo: layout em coluna no mobile, grid no desktop
- Animacao de transicao suave entre steps usando `animate-fade-in`
