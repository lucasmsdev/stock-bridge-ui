import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

export type PlanType = 'estrategista' | 'competidor' | 'dominador' | 'unlimited';

// Definição clara de features disponíveis
export type FeatureName = 
  | 'IntegracoesCompletas'
  | 'AnaliseDeConcorrencia'
  | 'AnaliseDePrecoIdeal'
  | 'DashboardDePerformance'
  | 'ReprecificacaoPorAlerta'
  | 'RelatoriosAvancados'
  | 'SuportePrioritario';

// Interface para compatibilidade com código existente (LEGACY)
export interface LegacyPlanFeatures {
  maxSkus: number;
  hasReprecificacaoPorAlerta: boolean;
  hasSuportePrioritario: boolean;
  hasRelatoriosAvancados: boolean;
}

// Nova interface para o sistema de planos
export interface PlanFeatures {
  maxSkus: number;
  features: FeatureName[];
  price: number;
  description: string;
  name: string;
}

// Mapa claro de permissões por plano
const planFeatures: Record<PlanType, PlanFeatures> = {
  estrategista: {
    maxSkus: 100,
    features: [
      'IntegracoesCompletas',
      'AnaliseDeConcorrencia', 
      'AnaliseDePrecoIdeal',
      'DashboardDePerformance'
    ],
    price: 97.00,
    description: 'Essencial para gerenciar vendas em múltiplas plataformas',
    name: 'Iniciante'
  },
  competidor: {
    maxSkus: 500,
    features: [
      'IntegracoesCompletas',
      'AnaliseDeConcorrencia', 
      'AnaliseDePrecoIdeal',
      'DashboardDePerformance', 
      'ReprecificacaoPorAlerta',
      'SuportePrioritario'
    ],
    price: 197.00,
    description: 'Para escalar operações e aumentar eficiência',
    name: 'Profissional'
  },
  dominador: {
    maxSkus: 1000,
    features: [
      'IntegracoesCompletas',
      'AnaliseDeConcorrencia',
      'AnaliseDePrecoIdeal',
      'DashboardDePerformance', 
      'ReprecificacaoPorAlerta',
      'RelatoriosAvancados',
      'SuportePrioritario'
    ],
    price: 297.00,
    description: 'Solução completa com análise avançada e IA',
    name: 'Enterprise'
  },
  unlimited: {
    maxSkus: Infinity,
    features: [
      'IntegracoesCompletas',
      'AnaliseDeConcorrencia',
      'AnaliseDePrecoIdeal',
      'DashboardDePerformance', 
      'ReprecificacaoPorAlerta',
      'RelatoriosAvancados',
      'SuportePrioritario'
    ],
    price: 397.00,
    description: 'SKUs ilimitados, todas features + API e automação completa',
    name: 'Unlimited'
  },
};

// Mapeamento de features legadas para o novo sistema
const legacyFeatureMap: Record<string, FeatureName> = {
  'hasReprecificacaoPorAlerta': 'ReprecificacaoPorAlerta',
  'hasSuportePrioritario': 'SuportePrioritario',
  'hasRelatoriosAvancados': 'RelatoriosAvancados',
};

// Função para converter nova estrutura em formato legado
const convertToLegacyFeatures = (plan: PlanFeatures): LegacyPlanFeatures => {
  return {
    maxSkus: plan.maxSkus,
    hasReprecificacaoPorAlerta: plan.features.includes('ReprecificacaoPorAlerta'),
    hasSuportePrioritario: plan.features.includes('SuportePrioritario'),
    hasRelatoriosAvancados: plan.features.includes('RelatoriosAvancados'),
  };
};

export const usePlan = () => {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<PlanType>('estrategista');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<{ plan: PlanType; role: string } | null>(null);

  const fetchUserPlan = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('plan, role')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors

      if (error) {
        console.error('Error fetching user plan:', error);
        setError('Erro ao carregar plano do usuário');
        // Se não encontrar o perfil, definir plano padrão
        setCurrentPlan('estrategista');
        setUserProfile({ plan: 'estrategista', role: 'user' });
        return;
      }

      if (data) {
        const plan = data.plan as PlanType || 'estrategista';
        const role = data.role || 'user';
        setCurrentPlan(plan);
        setUserProfile({ plan, role });
        console.log('User profile loaded:', { plan, role });
      } else {
        // Se não tiver perfil definido, usar o padrão
        setCurrentPlan('estrategista');
        setUserProfile({ plan: 'estrategista', role: 'user' });
      }
    } catch (err) {
      console.error('Unexpected error fetching plan:', err);
      setError('Erro inesperado ao carregar plano');
      setCurrentPlan('estrategista');
      setUserProfile({ plan: 'estrategista', role: 'user' });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUserPlan();
  }, [fetchUserPlan]);

  // Nova função para verificar acesso usando o sistema de features
  const hasFeature = (feature: FeatureName): boolean => {
    if (!user || isLoading) return false;
    
    // **NOVA LÓGICA DE ADMIN** - Se o usuário é admin, tem acesso a tudo
    if (userProfile?.role === 'admin') {
      return true;
    }
    
    return planFeatures[currentPlan].features.includes(feature);
  };

  // Função legada para compatibilidade - aceita tanto propriedades legadas quanto features
  const canAccess = (feature: keyof LegacyPlanFeatures | FeatureName): boolean => {
    if (!user || isLoading) return false;
    
    // **NOVA LÓGICA DE ADMIN** - Se o usuário é admin, tem acesso a tudo
    if (userProfile?.role === 'admin') {
      return true;
    }
    
    // Se é uma string que começa com 'has', é uma propriedade legada
    if (typeof feature === 'string' && feature.startsWith('has')) {
      const newFeature = legacyFeatureMap[feature];
      return newFeature ? hasFeature(newFeature) : false;
    }
    
    // Se é uma FeatureName, usa o sistema novo
    if (typeof feature === 'string') {
      return hasFeature(feature as FeatureName);
    }

    return false;
  };

  const canImportProducts = (currentProductCount: number, newProductsCount: number): boolean => {
    // **NOVA LÓGICA DE ADMIN** - Se o usuário é admin, pode importar produtos ilimitadamente
    if (userProfile?.role === 'admin') {
      return true;
    }
    
    const totalProducts = currentProductCount + newProductsCount;
    return totalProducts <= planFeatures[currentPlan].maxSkus;
  };

  const getMaxSkus = (): number => {
    // **NOVA LÓGICA DE ADMIN** - Se o usuário é admin, tem SKUs ilimitados
    if (userProfile?.role === 'admin') {
      return Infinity;
    }
    
    return planFeatures[currentPlan].maxSkus;
  };

  // Retorna as features no formato novo
  const getPlanFeatures = (): PlanFeatures => {
    return planFeatures[currentPlan];
  };

  // Retorna as features no formato legado para compatibilidade
  const getLegacyPlanFeatures = (): LegacyPlanFeatures => {
    return convertToLegacyFeatures(planFeatures[currentPlan]);
  };

  const getUpgradeRequiredMessage = (feature: keyof LegacyPlanFeatures | FeatureName): string => {
    let requiredFeature: FeatureName;
    
    // Convert legacy feature to new feature name
    if (typeof feature === 'string' && feature.startsWith('has')) {
      requiredFeature = legacyFeatureMap[feature];
    } else {
      requiredFeature = feature as FeatureName;
    }

    // Find the cheapest plan that has this feature
    const plansWithFeature = Object.entries(planFeatures)
      .filter(([_, plan]) => plan.features.includes(requiredFeature))
      .map(([planKey, plan]) => ({ key: planKey as PlanType, ...plan }))
      .sort((a, b) => a.price - b.price);

    if (plansWithFeature.length === 0) {
      return `Esta funcionalidade não está disponível em nenhum plano.`;
    }

    const cheapestPlan = plansWithFeature[0];
    return `Faça upgrade para o plano ${cheapestPlan.name} para acessar esta funcionalidade.`;
  };

  // Função para obter o próximo plano recomendado
  const getRecommendedUpgrade = (): { plan: PlanType; features: PlanFeatures } | null => {
    const currentFeatures = planFeatures[currentPlan];
    const allPlans = Object.entries(planFeatures) as [PlanType, PlanFeatures][];
    
    // Find plans with more features and higher price
    const upgradePlans = allPlans
      .filter(([_, plan]) => plan.price > currentFeatures.price)
      .sort((a, b) => a[1].price - b[1].price);
    
    if (upgradePlans.length === 0) return null;
    
    const [planKey, planData] = upgradePlans[0];
    return { plan: planKey, features: planData };
  };

  // Função para verificar se é necessário upgrade para uma funcionalidade
  const needsUpgradeFor = (feature: FeatureName): boolean => {
    return !hasFeature(feature);
  };

  // Função para obter todos os planos disponíveis
  const getAllPlans = (): Record<PlanType, PlanFeatures> => {
    return planFeatures;
  };

  return {
    currentPlan,
    isLoading,
    error,
    // Funções para o sistema novo
    hasFeature,
    needsUpgradeFor,
    getRecommendedUpgrade,
    getAllPlans,
    // Funções para compatibilidade
    canAccess,
    canImportProducts,
    getMaxSkus,
    getPlanFeatures,
    getLegacyPlanFeatures,
    getUpgradeRequiredMessage,
    // Nova funcionalidade de admin
    isAdmin: userProfile?.role === 'admin',
    userRole: userProfile?.role || 'user',
  };
};