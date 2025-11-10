import { QueryClient } from '@tanstack/react-query';

// Configuração otimizada do React Query para cache de dados do usuário
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache por 5 minutos (dados do usuário mudam raramente)
      staleTime: 5 * 60 * 1000,
      // Manter cache por 10 minutos
      gcTime: 10 * 60 * 1000,
      // Retry apenas 1 vez em caso de erro
      retry: 1,
      // Não refetch automaticamente ao focar a janela (evita reloads desnecessários)
      refetchOnWindowFocus: false,
      // Não refetch automaticamente ao reconectar
      refetchOnReconnect: false,
    },
  },
});

// Query Keys centralizados para fácil invalidação
export const queryKeys = {
  auth: {
    session: ['auth', 'session'] as const,
    user: ['auth', 'user'] as const,
  },
  profile: {
    all: ['profile'] as const,
    plan: (userId: string) => ['profile', 'plan', userId] as const,
    role: (userId: string) => ['profile', 'role', userId] as const,
  },
} as const;
