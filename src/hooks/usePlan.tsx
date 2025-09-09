import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

type PlanType = 'estrategista' | 'competidor' | 'dominador';

interface PlanFeatures {
  maxSkus: number;
  hasReprecificacaoPorAlerta: boolean;
  hasPrecificacaoDinamica: boolean;
  hasAutomacaoIA: boolean;
  hasSuportePrioritario: boolean;
  hasRelatoriosAvancados: boolean;
  hasIntegracaoAPI: boolean;
}

const planFeatures: Record<PlanType, PlanFeatures> = {
  estrategista: {
    maxSkus: 100,
    hasReprecificacaoPorAlerta: false,
    hasPrecificacaoDinamica: false,
    hasAutomacaoIA: false,
    hasSuportePrioritario: false,
    hasRelatoriosAvancados: false,
    hasIntegracaoAPI: false,
  },
  competidor: {
    maxSkus: 500,
    hasReprecificacaoPorAlerta: true,
    hasPrecificacaoDinamica: false,
    hasAutomacaoIA: false,
    hasSuportePrioritario: true,
    hasRelatoriosAvancados: true,
    hasIntegracaoAPI: false,
  },
  dominador: {
    maxSkus: Infinity,
    hasReprecificacaoPorAlerta: true,
    hasPrecificacaoDinamica: true,
    hasAutomacaoIA: true,
    hasSuportePrioritario: true,
    hasRelatoriosAvancados: true,
    hasIntegracaoAPI: true,
  },
};

export const usePlan = () => {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<PlanType>('estrategista');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserPlan = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user plan:', error);
          setError('Erro ao carregar plano do usuário');
          return;
        }

        if (data?.plan) {
          setCurrentPlan(data.plan as PlanType);
        }
      } catch (err) {
        console.error('Unexpected error fetching plan:', err);
        setError('Erro inesperado ao carregar plano');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserPlan();
  }, [user]);

  const canAccess = (feature: keyof PlanFeatures): boolean => {
    if (!user || isLoading) return false;
    return planFeatures[currentPlan][feature] as boolean;
  };

  const canImportProducts = (currentProductCount: number, newProductsCount: number): boolean => {
    const totalProducts = currentProductCount + newProductsCount;
    return totalProducts <= planFeatures[currentPlan].maxSkus;
  };

  const getMaxSkus = (): number => {
    return planFeatures[currentPlan].maxSkus;
  };

  const getPlanFeatures = (): PlanFeatures => {
    return planFeatures[currentPlan];
  };

  const getUpgradeRequiredMessage = (feature: keyof PlanFeatures): string => {
    const requiredPlans: Record<keyof PlanFeatures, PlanType[]> = {
      maxSkus: ['competidor', 'dominador'],
      hasReprecificacaoPorAlerta: ['competidor', 'dominador'],
      hasPrecificacaoDinamica: ['dominador'],
      hasAutomacaoIA: ['dominador'],
      hasSuportePrioritario: ['competidor', 'dominador'],
      hasRelatoriosAvancados: ['competidor', 'dominador'],
      hasIntegracaoAPI: ['dominador'],
    };

    const required = requiredPlans[feature];
    const lowestPlan = required[0];
    
    const planNames = {
      estrategista: 'Estrategista',
      competidor: 'Competidor',
      dominador: 'Dominador'
    };

    return `Faça upgrade para o plano ${planNames[lowestPlan]} para acessar esta funcionalidade.`;
  };

  return {
    currentPlan,
    isLoading,
    error,
    canAccess,
    canImportProducts,
    getMaxSkus,
    getPlanFeatures,
    getUpgradeRequiredMessage,
  };
};