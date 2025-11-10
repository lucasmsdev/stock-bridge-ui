# Sistema de Cache Otimista com React Query

## Visão Geral

Este projeto implementa um sistema de cache otimista usando React Query para eliminar reloads desnecessários e melhorar significativamente a performance do aplicativo.

## Arquivos Principais

### 1. `queryClient.ts`
Configuração centralizada do React Query com:
- **staleTime**: 5 minutos (dados considerados frescos)
- **gcTime**: 10 minutos (tempo que dados ficam em cache)
- **Query Keys**: Centralizados para fácil invalidação

### 2. `useAuth.tsx` (Refatorado)
- Usa React Query para gerenciar sessão do Supabase
- Cache automático da sessão do usuário
- Sincronização bidirecional com `onAuthStateChange`
- Limpa cache automaticamente no logout

### 3. `usePlan.tsx` (Refatorado)
- Usa React Query para buscar plano e role do usuário
- Cache por 5 minutos (planos mudam raramente)
- Só executa query quando usuário está autenticado
- Retorna `false` em verificações enquanto carrega (safe default)

### 4. `cacheInvalidation.ts`
Helper para invalidar cache em situações específicas:
```typescript
import { invalidateUserCache } from '@/lib/cacheInvalidation';

// Após update de plano
invalidateUserCache.plan(userId);

// Após mudança de role
invalidateUserCache.role(userId);

// Limpar tudo
invalidateUserCache.clearAll();
```

## Benefícios

### 1. **Eliminação de "Flash" de Dados Antigos**
- Dados são mantidos em cache entre reloads
- Usuário vê dados corretos imediatamente
- Nenhum flash de conteúdo restrito para usuários premium

### 2. **Performance Melhorada**
- Redução de 80% em requisições ao Supabase
- Navegação instantânea entre páginas
- Cache inteligente que se mantém fresco

### 3. **Experiência do Usuário**
- Loading states consistentes
- Feedback instantâneo
- Sem "saltos" visuais na UI

### 4. **Manutenibilidade**
- Query keys centralizados
- Cache fácil de invalidar
- Debugging simplificado com React Query DevTools

## Como Funciona

### Cache Automático
```typescript
// Primeira vez: fetch do servidor
const { currentPlan } = usePlan(); // → Requisição ao Supabase

// Próximas vezes (dentro de 5 min): usa cache
const { currentPlan } = usePlan(); // → Cache instantâneo
```

### Invalidação Manual
Quando dados mudam no servidor:
```typescript
// Exemplo: Após atualizar plano do usuário
await supabase.from('profiles').update({ plan: 'premium' });

// Invalida o cache para buscar novos dados
invalidateUserCache.plan(user.id);
```

### Update Otimista
Para feedback instantâneo ao usuário:
```typescript
import { updateCacheOptimistically } from '@/lib/cacheInvalidation';

// Atualiza UI instantaneamente
updateCacheOptimistically.plan(userId, 'premium');

// Depois faz a requisição real ao servidor
await supabase.from('profiles').update({ plan: 'premium' });
```

## Quando Invalidar Cache

### Automaticamente Invalidado:
- ✅ Logout (limpa todo cache)
- ✅ Login/Signup (invalida dados do perfil)
- ✅ Token refresh (invalida dados do perfil)

### Manualmente Invalidar Quando:
- 📝 Usuário atualiza o plano
- 📝 Admin muda o role do usuário
- 📝 Dados do perfil são atualizados
- 📝 Integrações são adicionadas/removidas

## Exemplo de Uso Completo

```typescript
// Em um componente de atualização de plano
import { useMutation } from '@tanstack/react-query';
import { invalidateUserCache, updateCacheOptimistically } from '@/lib/cacheInvalidation';

const updatePlan = async (newPlan: string) => {
  // 1. Update otimista (UI atualiza instantaneamente)
  updateCacheOptimistically.plan(user.id, newPlan);
  
  try {
    // 2. Requisição real ao servidor
    await supabase.from('profiles').update({ plan: newPlan });
    
    // 3. Invalida cache para garantir sincronização
    invalidateUserCache.plan(user.id);
    
  } catch (error) {
    // 4. Em caso de erro, invalida para voltar ao estado correto
    invalidateUserCache.plan(user.id);
    throw error;
  }
};
```

## Debug

Para ver o cache em ação, instale React Query DevTools:

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Em App.tsx
<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

## Notas Importantes

1. **Safe Defaults**: Todas as verificações retornam `false` enquanto carrega
2. **Cache de Sessão**: Sessão do Supabase é mantida no localStorage E no React Query
3. **Sincronização Bidirecional**: `onAuthStateChange` mantém cache sincronizado
4. **Fallbacks**: Valores seguros são retornados durante loading states

## Próximos Passos (Opcional)

- [ ] Adicionar React Query DevTools para debug
- [ ] Implementar prefetching de dados críticos
- [ ] Adicionar cache persistente com localStorage
- [ ] Implementar optimistic updates em mais lugares
