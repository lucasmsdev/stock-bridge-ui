import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryClient";

export enum PlanType {
  INICIANTE = 'iniciante',
  PROFISSIONAL = 'profissional',
  ENTERPRISE = 'enterprise',
  UNLIMITED = 'unlimited',
}

export enum FeatureName {
  PRODUCT_MANAGEMENT = 'product_management',
  MULTI_MARKETPLACE = 'multi_marketplace',
  AI_ASSISTANT = 'ai_assistant',
  REPORTS = 'reports',
  ADVANCED_REPORTS = 'advanced_reports',
  FINANCIAL_CALCULATOR = 'financial_calculator',
  MARKET_ANALYSIS = 'market_analysis',
  PRIORITY_SUPPORT = 'priority_support',
  UNLIMITED_INTEGRATIONS = 'unlimited_integrations',
}

// Interface para compatibilidade com código existente (LEGACY)
export interface LegacyPlanFeatures {
  maxSkus: number;
  hasReprecificacaoPorAlerta: boolean;
  hasSuportePrioritario: boolean;
  hasRelatoriosAvancados: boolean;
}

// Nova interface para o sistema de planos
export interface PlanFeatures {
  name: string;
  features: FeatureName[];
  maxIntegrationsPerMarketplace: number;
  maxProducts: number;
  pricing: { monthly: number; currency: string };
  // Sistema de quota de IA
  aiQueryLimit: number; // -1 para ilimitado
  aiModel: 'sonar' | 'sonar-pro';
}

// Mapa claro de permissões por plano
export const planFeatures: Record<PlanType, PlanFeatures> = {
  [PlanType.INICIANTE]: {
    name: 'Iniciante',
    features: [
      FeatureName.PRODUCT_MANAGEMENT,
      FeatureName.MULTI_MARKETPLACE,
    ],
    maxIntegrationsPerMarketplace: 1,
    maxProducts: 100,
    pricing: { monthly: 97, currency: 'BRL' },
    aiQueryLimit: 0, // Sem acesso
    aiModel: 'sonar'
  },
  [PlanType.PROFISSIONAL]: {
    name: 'Profissional',
    features: [
      FeatureName.PRODUCT_MANAGEMENT,
      FeatureName.MULTI_MARKETPLACE,
      FeatureName.AI_ASSISTANT,
      FeatureName.REPORTS,
      FeatureName.FINANCIAL_CALCULATOR,
    ],
    maxIntegrationsPerMarketplace: 2,
    maxProducts: 500,
    pricing: { monthly: 197, currency: 'BRL' },
    aiQueryLimit: 50, // 50 consultas/mês
    aiModel: 'sonar'
  },
  [PlanType.ENTERPRISE]: {
    name: 'Enterprise',
    features: [
      FeatureName.PRODUCT_MANAGEMENT,
      FeatureName.MULTI_MARKETPLACE,
      FeatureName.AI_ASSISTANT,
      FeatureName.REPORTS,
      FeatureName.ADVANCED_REPORTS,
      FeatureName.FINANCIAL_CALCULATOR,
      FeatureName.MARKET_ANALYSIS,
      FeatureName.PRIORITY_SUPPORT,
    ],
    maxIntegrationsPerMarketplace: 5,
    maxProducts: 2000,
    pricing: { monthly: 297, currency: 'BRL' },
    aiQueryLimit: 200, // 200 consultas/mês
    aiModel: 'sonar-pro'
  },
  [PlanType.UNLIMITED]: {
    name: 'Unlimited',
    features: [
      FeatureName.PRODUCT_MANAGEMENT,
      FeatureName.MULTI_MARKETPLACE,
      FeatureName.AI_ASSISTANT,
      FeatureName.REPORTS,
      FeatureName.ADVANCED_REPORTS,
      FeatureName.FINANCIAL_CALCULATOR,
      FeatureName.MARKET_ANALYSIS,
      FeatureName.PRIORITY_SUPPORT,
      FeatureName.UNLIMITED_INTEGRATIONS,
    ],
    maxIntegrationsPerMarketplace: Infinity,
    maxProducts: Infinity,
    pricing: { monthly: 397, currency: 'BRL' },
    aiQueryLimit: -1, // Ilimitado
    aiModel: 'sonar-pro'
  },
};

// Mapeamento de features legadas para o novo sistema
const legacyFeatureMap: Record<string, FeatureName> = {
  'hasReprecificacaoPorAlerta': FeatureName.MARKET_ANALYSIS,
  'hasSuportePrioritario': FeatureName.PRIORITY_SUPPORT,
  'hasRelatoriosAvancados': FeatureName.REPORTS,
};

// Função para converter nova estrutura em formato legado
const convertToLegacyFeatures = (plan: PlanFeatures): LegacyPlanFeatures => {
  return {
    maxSkus: plan.maxProducts,
    hasReprecificacaoPorAlerta: plan.features.includes(FeatureName.MARKET_ANALYSIS),
    hasSuportePrioritario: plan.features.includes(FeatureName.PRIORITY_SUPPORT),
    hasRelatoriosAvancados: plan.features.includes(FeatureName.REPORTS),
  };
};

interface UserProfileData {
  plan: PlanType;
  role: string;
  orgRole: 'admin' | 'operator' | 'viewer' | null;
  organizationId: string | null;
}

export const usePlan = () => {
  const { user, isLoading: authLoading } = useAuth();

  // React Query para buscar o plano da organização do usuário
  const { data: userProfile, isLoading: profileLoading, error } = useQuery({
    queryKey: queryKeys.profile.plan(user?.id || ''),
    queryFn: async (): Promise<UserProfileData> => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Buscar a organização e plano via organization_members
      const { data: orgData, error: orgError } = await supabase
        .from('organization_members')
        .select(`
          role,
          organization_id,
          organizations (
            plan
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (orgError && orgError.code !== 'PGRST116') {
        console.error('Error fetching organization:', orgError);
        throw orgError;
      }

      // Buscar o role do usuário da tabela user_roles (SEGURO - para admin do sistema)
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Error fetching user role:', roleError);
      }

      // Plano vem da organização agora
      const plan = (orgData?.organizations?.plan as PlanType) || PlanType.INICIANTE;
      const role = roleData?.role || 'user';
      const orgRole = orgData?.role as 'admin' | 'operator' | 'viewer' | null;
      const organizationId = orgData?.organization_id || null;
      
      console.log('User profile loaded (React Query):', { plan, role, orgRole, isAdmin: role === 'admin' });

      return { plan, role, orgRole, organizationId };
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const isLoading = authLoading || profileLoading;
  const currentPlan = userProfile?.plan || PlanType.INICIANTE;
  const isAdmin = userProfile?.role === 'admin';
  const userRole = userProfile?.role || 'user';
  const orgRole = userProfile?.orgRole || null;
  const organizationId = userProfile?.organizationId || null;

  // Nova função para verificar acesso usando o sistema de features
  const hasFeature = (feature: FeatureName): boolean => {
    // CRÍTICO: Enquanto carrega, retorna false para evitar flash de conteúdo
    if (!user || isLoading || !userProfile) return false;
    
    // **LÓGICA DE ADMIN** - Se o usuário é admin, tem acesso a tudo
    if (isAdmin) {
      return true;
    }
    
    return planFeatures[currentPlan].features.includes(feature);
  };

  // Função legada para compatibilidade - aceita tanto propriedades legadas quanto features
  const canAccess = (feature: keyof LegacyPlanFeatures | FeatureName): boolean => {
    // CRÍTICO: Enquanto carrega, retorna false para evitar flash de conteúdo
    if (!user || isLoading || !userProfile) return false;
    
    // **LÓGICA DE ADMIN** - Se o usuário é admin, tem acesso a tudo
    if (isAdmin) {
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
    // CRÍTICO: Enquanto carrega, retorna false
    if (!userProfile) return false;
    
    // **LÓGICA DE ADMIN** - Se o usuário é admin, pode importar produtos ilimitadamente
    if (isAdmin) {
      return true;
    }
    
    const totalProducts = currentProductCount + newProductsCount;
    return totalProducts <= planFeatures[currentPlan].maxProducts;
  };

  const getMaxSkus = (): number => {
    // **LÓGICA DE ADMIN** - Se o usuário é admin, tem SKUs ilimitados
    if (isAdmin) {
      return Infinity;
    }
    
    // Fallback seguro enquanto carrega
    if (!userProfile) return 0;
    
    return planFeatures[currentPlan].maxProducts;
  };

  // Retorna as features no formato novo
  const getPlanFeatures = (): PlanFeatures => {
    // Fallback seguro enquanto carrega
    return planFeatures[currentPlan];
  };

  // Retorna as features no formato legado para compatibilidade
  const getLegacyPlanFeatures = (): LegacyPlanFeatures => {
    // Fallback seguro enquanto carrega
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
      .sort((a, b) => a.pricing.monthly - b.pricing.monthly);

    if (plansWithFeature.length === 0) {
      return `Esta funcionalidade não está disponível em nenhum plano.`;
    }

    const cheapestPlan = plansWithFeature[0];
    return `Faça upgrade para o plano ${cheapestPlan.name} para acessar esta funcionalidade.`;
  };

  // Função para obter o próximo plano recomendado
  const getRecommendedUpgrade = (): { plan: PlanType; features: PlanFeatures } | null => {
    // Fallback seguro enquanto carrega
    if (!userProfile) return null;
    
    const currentFeatures = planFeatures[currentPlan];
    const allPlans = Object.entries(planFeatures) as [PlanType, PlanFeatures][];
    
    // Find plans with more features and higher price
    const upgradePlans = allPlans
      .filter(([_, plan]) => plan.pricing.monthly > currentFeatures.pricing.monthly)
      .sort((a, b) => a[1].pricing.monthly - b[1].pricing.monthly);
    
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
    error: error ? 'Erro ao carregar plano do usuário' : null,
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
    // Admin do sistema (user_roles)
    isAdmin,
    userRole,
    // Papel na organização
    orgRole,
    organizationId,
    isOrgAdmin: orgRole === 'admin',
  };
};
