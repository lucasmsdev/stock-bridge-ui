import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { usePlan, FeatureName, planFeatures } from "./usePlan";
import { supabase } from "@/integrations/supabase/client";

interface AIUsage {
  id: string;
  user_id: string;
  month_year: string;
  query_count: number;
  created_at: string;
  updated_at: string;
}

const getCurrentMonthYear = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getNextMonthFirstDay = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
};

export const useAIQuota = () => {
  const { user } = useAuth();
  const { currentPlan, hasFeature, isAdmin, isLoading: planLoading } = usePlan();
  const queryClient = useQueryClient();

  const monthYear = getCurrentMonthYear();

  // Buscar uso atual do mês
  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['ai-usage', user?.id, monthYear],
    queryFn: async (): Promise<AIUsage | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('ai_usage')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', monthYear)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar uso de IA:', error);
        throw error;
      }

      return data;
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 segundos
  });

  // Mutation para incrementar uso
  const incrementUsage = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Tentar atualizar primeiro (upsert)
      if (usage) {
        const { error } = await supabase
          .from('ai_usage')
          .update({ query_count: usage.query_count + 1 })
          .eq('id', usage.id);

        if (error) throw error;
      } else {
        // Criar novo registro
        const { error } = await supabase
          .from('ai_usage')
          .insert({
            user_id: user.id,
            month_year: monthYear,
            query_count: 1
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-usage', user?.id, monthYear] });
    }
  });

  // Obter limites do plano
  const planData = planFeatures[currentPlan];
  const limit = isAdmin ? -1 : planData.aiQueryLimit;
  const aiModel = isAdmin ? 'sonar-pro' : planData.aiModel;

  // Calcular métricas
  const currentUsage = usage?.query_count || 0;
  const isUnlimited = limit === -1;
  const remaining = isUnlimited ? Infinity : Math.max(0, limit - currentUsage);
  const percentUsed = isUnlimited ? 0 : limit > 0 ? Math.round((currentUsage / limit) * 100) : 100;
  const isNearLimit = !isUnlimited && percentUsed >= 80;
  const isAtLimit = !isUnlimited && currentUsage >= limit;
  const hasAccess = hasFeature(FeatureName.AI_ASSISTANT) || isAdmin;

  // Data de renovação
  const resetDate = getNextMonthFirstDay();
  const daysUntilReset = Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return {
    // Status de acesso
    hasAccess,
    isAtLimit,
    isNearLimit,
    isUnlimited,
    
    // Métricas
    currentUsage,
    limit,
    remaining,
    percentUsed,
    
    // Modelo
    aiModel,
    
    // Renovação
    resetDate,
    daysUntilReset,
    
    // Loading states
    isLoading: planLoading || usageLoading,
    
    // Ações
    incrementUsage: incrementUsage.mutateAsync,
    isIncrementing: incrementUsage.isPending,
  };
};