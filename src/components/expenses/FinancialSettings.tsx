import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Loader2, Percent, CreditCard, Receipt, Landmark, TrendingDown, TrendingUp, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PlatformLogo } from "@/components/ui/platform-logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  useMarketplaceFees, 
  PLATFORM_LABELS, 
  TAX_REGIMES, 
  DEFAULT_FEES,
  MarketplaceFeeProfile 
} from "@/hooks/useMarketplaceFees";

export interface FinancialSettingsData {
  marketplaceFeePercent: number;
  targetMarginPercent: number;
}

interface FinancialSettingsProps {
  onSettingsChange?: (settings: FinancialSettingsData) => void;
}

function FeeMetric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
      <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function getProfileTotalFee(profile: MarketplaceFeeProfile) {
  const defaults = DEFAULT_FEES[profile.platform];
  const commission = defaults?.commission ?? profile.commission_percent;
  const paymentFee = defaults?.payment_fee ?? profile.payment_fee_percent;
  return commission + paymentFee + profile.tax_percent;
}

interface PlatformAccordionItemProps {
  profile: MarketplaceFeeProfile;
  onRegimeChange: (profileId: string, regime: string, taxPercent: number) => void;
  isPending: boolean;
}

function PlatformAccordionItem({ profile, onRegimeChange, isPending }: PlatformAccordionItemProps) {
  const platform = profile.platform;
  const label = PLATFORM_LABELS[platform] || platform;
  const defaults = DEFAULT_FEES[platform];

  const commission = defaults?.commission ?? profile.commission_percent;
  const paymentFee = defaults?.payment_fee ?? profile.payment_fee_percent;
  const fixedFee = defaults?.fixed_fee ?? profile.fixed_fee_amount;
  const totalFee = getProfileTotalFee(profile);
  const currentRegimeData = TAX_REGIMES[profile.tax_regime];

  return (
    <AccordionItem value={profile.id} className="border rounded-lg px-4 data-[state=open]:bg-muted/20 transition-colors">
      <AccordionTrigger className="hover:no-underline py-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <PlatformLogo platform={platform} size="md" className="shrink-0" />
          <span className="font-semibold text-foreground text-base">{label}</span>
          <Badge variant="outline" className="ml-auto mr-2 font-bold text-primary border-primary/30">
            {totalFee.toFixed(1)}%
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {currentRegimeData?.label || profile.tax_regime}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-5">
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FeeMetric icon={Percent} label="Comissão" value={`${commission}%`} />
            <FeeMetric icon={CreditCard} label="Taxa de Pgto" value={`${paymentFee}%`} />
            <FeeMetric icon={Receipt} label="Taxa Fixa" value={`R$ ${fixedFee.toFixed(2)}`} />
            <FeeMetric icon={Landmark} label="Imposto" value={`${profile.tax_percent}%`} />
          </div>

          {/* Simulação rápida */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs text-muted-foreground mb-1">Simulação: venda de R$ 100,00</p>
            <div className="flex items-center gap-4">
              <span className="text-sm text-destructive font-medium">
                - R$ {totalFee.toFixed(2)} em taxas
              </span>
              <span className="text-sm text-foreground font-bold">
                = R$ {(100 - totalFee).toFixed(2)} líquido
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-border">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Regime Tributário</p>
              <p className="text-xs text-muted-foreground">
                {currentRegimeData?.description || "Selecione o regime"}
              </p>
            </div>
            <Select
              value={profile.tax_regime}
              onValueChange={(regime) => {
                const regimeData = TAX_REGIMES[regime];
                if (regimeData) onRegimeChange(profile.id, regime, regimeData.defaultPercent);
              }}
              disabled={isPending}
            >
              <SelectTrigger className="w-full sm:w-[220px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TAX_REGIMES).map(([key, regime]) => (
                  <SelectItem key={key} value={key}>
                    {regime.label} — {regime.defaultPercent}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function ComparisonPanel({ profiles }: { profiles: MarketplaceFeeProfile[] }) {
  if (profiles.length === 0) return null;

  const sorted = [...profiles]
    .map(p => ({ profile: p, totalFee: getProfileTotalFee(p) }))
    .sort((a, b) => a.totalFee - b.totalFee);

  const cheapest = sorted[0];
  const mostExpensive = sorted[sorted.length - 1];
  const avgFee = sorted.reduce((sum, s) => sum + s.totalFee, 0) / sorted.length;
  const maxFee = mostExpensive.totalFee;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs font-medium text-muted-foreground">Menor taxa</span>
            </div>
            <div className="flex items-center gap-2">
              <PlatformLogo platform={cheapest.profile.platform} size="sm" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  {PLATFORM_LABELS[cheapest.profile.platform]}
                </p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {cheapest.totalFee.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-xs font-medium text-muted-foreground">Maior taxa</span>
            </div>
            <div className="flex items-center gap-2">
              <PlatformLogo platform={mostExpensive.profile.platform} size="sm" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  {PLATFORM_LABELS[mostExpensive.profile.platform]}
                </p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">
                  {mostExpensive.totalFee.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Média geral</span>
            </div>
            <p className="text-2xl font-bold text-primary mt-1">
              {avgFee.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              entre {profiles.length} plataformas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Horizontal bar chart ranking */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">
            Ranking de Taxas Totais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.map(({ profile, totalFee }) => {
            const barWidth = maxFee > 0 ? (totalFee / maxFee) * 100 : 0;
            const isLowest = profile.id === cheapest.profile.id;
            const isHighest = profile.id === mostExpensive.profile.id;

            return (
              <div key={profile.id} className="flex items-center gap-3">
                <PlatformLogo platform={profile.platform} size="sm" className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground truncate">
                      {PLATFORM_LABELS[profile.platform]}
                    </span>
                    <span className={`text-xs font-bold ${
                      isLowest ? "text-green-600 dark:text-green-400" : 
                      isHighest ? "text-red-600 dark:text-red-400" : "text-foreground"
                    }`}>
                      {totalFee.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLowest ? "bg-green-500" : 
                        isHighest ? "bg-red-500" : "bg-primary"
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export function FinancialSettings({ onSettingsChange }: FinancialSettingsProps) {
  const { feeProfiles, isLoading, updateFeeProfile } = useMarketplaceFees();
  const { toast } = useToast();

  const handleRegimeChange = (profileId: string, regime: string, taxPercent: number) => {
    updateFeeProfile.mutate(
      { id: profileId, tax_regime: regime, tax_percent: taxPercent },
      {
        onSuccess: () => {
          const regimeData = TAX_REGIMES[regime];
          toast({ title: "Regime atualizado", description: `Alterado para ${regimeData?.label || regime}.` });
        },
        onError: () => {
          toast({ title: "Erro ao atualizar regime", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Taxas por Marketplace
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Taxas automáticas por plataforma. Ajuste o regime tributário individualmente.
        </p>
      </div>

      {feeProfiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed border-border">
          <Settings className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <p className="text-base text-muted-foreground font-medium mb-1">
            Nenhum perfil de taxas encontrado
          </p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Os perfis são criados automaticamente ao configurar sua organização.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Accordion - left side */}
          <div className="xl:col-span-3">
            <Accordion type="multiple" className="space-y-2">
              {feeProfiles.map(profile => (
                <PlatformAccordionItem
                  key={profile.id}
                  profile={profile}
                  onRegimeChange={handleRegimeChange}
                  isPending={updateFeeProfile.isPending}
                />
              ))}
            </Accordion>
          </div>

          {/* Comparison panel - right side */}
          <div className="xl:col-span-2">
            <ComparisonPanel profiles={feeProfiles} />
          </div>
        </div>
      )}
    </div>
  );
}
