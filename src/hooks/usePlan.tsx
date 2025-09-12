import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

export type PlanType = 'estrategista' | 'competidor' | 'dominador';

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
    description: 'Tome decisões de preço com base em dados, não em achismos.',
    name: 'Estrategista'
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
    price: 147.00,
    description: 'Reaja à concorrência em tempo real e não perca mais vendas.',
    name: 'Competidor'
  },
  dominador: {
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
    price: 197.00,
    description: 'Automatize sua competitividade e foque em crescer seu negócio.',
    name: 'Dominador'
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

  const fetchUserPlan = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors

      if (error) {
        console.error('Error fetching user plan:', error);
        setError('Erro ao carregar plano do usuário');
        // Se não encontrar o perfil, definir plano padrão
        setCurrentPlan('estrategista');
        return;
      }

      if (data?.plan) {
        setCurrentPlan(data.plan as PlanType);
        console.log('User plan loaded:', data.plan);
      } else {
        // Se não tiver plano definido, usar o padrão
        setCurrentPlan('estrategista');
      }
    } catch (err) {
      console.error('Unexpected error fetching plan:', err);
      setError('Erro inesperado ao carregar plano');
      setCurrentPlan('estrategista');
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
    return planFeatures[currentPlan].features.includes(feature);
  };

  // Função legada para compatibilidade - aceita tanto propriedades legadas quanto features
  const canAccess = (feature: keyof LegacyPlanFeatures | FeatureName): boolean => {
    if (!user || isLoading) return false;
    
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
    const totalProducts = currentProductCount + newProductsCount;
    return totalProducts <= planFeatures[currentPlan].maxSkus;
  };

  const getMaxSkus = (): number => {
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
  };
};