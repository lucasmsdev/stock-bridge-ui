import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "./useOrganization";

export interface MarketplaceFeeProfile {
  id: string;
  organization_id: string;
  platform: string;
  commission_percent: number;
  payment_fee_percent: number;
  fixed_fee_amount: number;
  shipping_subsidy: number;
  tax_regime: string;
  tax_percent: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeeCalculation {
  commissionAmount: number;
  paymentFeeAmount: number;
  fixedFeeAmount: number;
  taxAmount: number;
  totalDeductions: number;
  netPerUnit: number;
}

export const PLATFORM_LABELS: Record<string, string> = {
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
  shopify: "Shopify",
  magalu: "Magalu",
  shein: "SHEIN",
  tiktok_shop: "TikTok Shop",
};

export const PLATFORM_LOGOS: Record<string, string> = {
  mercadolivre: "/logos/mercadolivre.svg",
  shopee: "/logos/shopee.svg",
  amazon: "/logos/amazon.svg",
  shopify: "/logos/shopify.svg",
  magalu: "/logos/magalu.png",
  shein: "/logos/shein.png",
  tiktok_shop: "/logos/tiktok-shop.png",
};

export const TAX_REGIMES: Record<string, { label: string; defaultPercent: number; description: string }> = {
  mei: { label: "MEI", defaultPercent: 0, description: "DAS fixo mensal, não incide por venda" },
  simples_nacional: { label: "Simples Nacional", defaultPercent: 6, description: "4-19% conforme faixa de faturamento" },
  lucro_presumido: { label: "Lucro Presumido", defaultPercent: 11.33, description: "IRPJ + CSLL + PIS + COFINS" },
  isento: { label: "Isento", defaultPercent: 0, description: "Sem tributação sobre vendas" },
};

export const DEFAULT_FEES: Record<string, { commission: number; payment_fee: number; fixed_fee: number }> = {
  mercadolivre: { commission: 13, payment_fee: 4.99, fixed_fee: 0 },
  shopee: { commission: 14, payment_fee: 0, fixed_fee: 0 },
  amazon: { commission: 15, payment_fee: 0, fixed_fee: 0 },
  shopify: { commission: 0, payment_fee: 2.5, fixed_fee: 0 },
  magalu: { commission: 16, payment_fee: 0, fixed_fee: 0 },
  shein: { commission: 12, payment_fee: 0, fixed_fee: 0 },
  tiktok_shop: { commission: 5, payment_fee: 0, fixed_fee: 0 },
};

export function useMarketplaceFees() {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();

  const { data: feeProfiles = [], isLoading } = useQuery({
    queryKey: ["marketplace-fees", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("marketplace_fee_profiles" as any)
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("platform");

      if (error) throw error;
      return (data || []) as unknown as MarketplaceFeeProfile[];
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  const updateFeeProfile = useMutation({
    mutationFn: async (profile: Partial<MarketplaceFeeProfile> & { id: string }) => {
      const { id, ...updates } = profile;
      const { error } = await supabase
        .from("marketplace_fee_profiles" as any)
        .update(updates as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-fees"] });
    },
  });

  const getFeeProfile = (platform: string): MarketplaceFeeProfile | undefined => {
    return feeProfiles.find((fp) => fp.platform === platform.toLowerCase());
  };

  const calculateFees = (platform: string, sellingPrice: number, costPrice = 0): FeeCalculation => {
    const profile = getFeeProfile(platform);

    if (!profile) {
      // Fallback to defaults
      const defaults = DEFAULT_FEES[platform.toLowerCase()];
      if (!defaults) {
        return {
          commissionAmount: 0,
          paymentFeeAmount: 0,
          fixedFeeAmount: 0,
          taxAmount: 0,
          totalDeductions: 0,
          netPerUnit: sellingPrice - costPrice,
        };
      }
      const commissionAmount = sellingPrice * (defaults.commission / 100);
      const paymentFeeAmount = sellingPrice * (defaults.payment_fee / 100);
      const fixedFeeAmount = defaults.fixed_fee;
      const taxAmount = sellingPrice * 0.06; // default 6%
      const totalDeductions = commissionAmount + paymentFeeAmount + fixedFeeAmount + taxAmount;
      return {
        commissionAmount,
        paymentFeeAmount,
        fixedFeeAmount,
        taxAmount,
        totalDeductions,
        netPerUnit: sellingPrice - costPrice - totalDeductions,
      };
    }

    const commissionAmount = sellingPrice * (profile.commission_percent / 100);
    const paymentFeeAmount = sellingPrice * (profile.payment_fee_percent / 100);
    const fixedFeeAmount = profile.fixed_fee_amount;
    const taxAmount = sellingPrice * (profile.tax_percent / 100);
    const totalDeductions = commissionAmount + paymentFeeAmount + fixedFeeAmount + taxAmount;

    return {
      commissionAmount,
      paymentFeeAmount,
      fixedFeeAmount,
      taxAmount,
      totalDeductions,
      netPerUnit: sellingPrice - costPrice - totalDeductions,
    };
  };

  // Calculate total effective fee percent for a platform
  const getTotalFeePercent = (platform: string): number => {
    const profile = getFeeProfile(platform);
    if (!profile) {
      const defaults = DEFAULT_FEES[platform.toLowerCase()];
      if (!defaults) return 0;
      return defaults.commission + defaults.payment_fee + 6; // default 6% tax
    }
    return profile.commission_percent + profile.payment_fee_percent + profile.tax_percent;
  };

  return {
    feeProfiles,
    isLoading,
    getFeeProfile,
    calculateFees,
    getTotalFeePercent,
    updateFeeProfile,
  };
}
