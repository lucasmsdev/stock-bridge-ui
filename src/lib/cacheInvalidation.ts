import { queryClient, queryKeys } from './queryClient';

/**
 * Helper para invalidar caches específicos do usuário
 * Use após operações que modificam dados do usuário (update de plano, mudança de role, etc.)
 */

export const invalidateUserCache = {
  // Invalida todos os dados do perfil do usuário
  all: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
  },

  // Invalida apenas o plano do usuário
  plan: (userId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.profile.plan(userId) });
  },

  // Invalida apenas o role do usuário
  role: (userId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.profile.role(userId) });
  },

  // Invalida a sessão de autenticação
  auth: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
  },

  // Limpa todo o cache (útil após logout ou mudanças críticas)
  clearAll: () => {
    queryClient.clear();
  },
};

/**
 * Atualiza otimisticamente o cache antes de fazer a requisição ao servidor
 * Útil para feedback instantâneo ao usuário
 */
export const updateCacheOptimistically = {
  // Atualiza o plano do usuário no cache
  plan: (userId: string, newPlan: string) => {
    queryClient.setQueryData(
      queryKeys.profile.plan(userId),
      (oldData: any) => ({
        ...oldData,
        plan: newPlan,
      })
    );
  },

  // Atualiza o role do usuário no cache
  role: (userId: string, newRole: string) => {
    queryClient.setQueryData(
      queryKeys.profile.plan(userId),
      (oldData: any) => ({
        ...oldData,
        role: newRole,
      })
    );
  },
};
