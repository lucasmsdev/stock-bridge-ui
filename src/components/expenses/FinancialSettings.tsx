import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Loader2, ChevronDown, Percent, CreditCard, Receipt, Landmark } from "lucide-react";
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

interface PlatformAccordionItemProps {
  profile: MarketplaceFeeProfile;
  onRegimeChange: (profileId: string, regime: string, taxPercent: number) => void;
  isPending: boolean;
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

function PlatformAccordionItem({ profile, onRegimeChange, isPending }: PlatformAccordionItemProps) {
  const platform = profile.platform;
  const label = PLATFORM_LABELS[platform] || platform;
  const defaults = DEFAULT_FEES[platform];

  const commission = defaults?.commission ?? profile.commission_percent;
  const paymentFee = defaults?.payment_fee ?? profile.payment_fee_percent;
  const fixedFee = defaults?.fixed_fee ?? profile.fixed_fee_amount;
  const totalFee = commission + paymentFee + profile.tax_percent;
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
          {/* Fee breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FeeMetric icon={Percent} label="Comissão" value={`${commission}%`} />
            <FeeMetric icon={CreditCard} label="Taxa de Pgto" value={`${paymentFee}%`} />
            <FeeMetric icon={Receipt} label="Taxa Fixa" value={`R$ ${fixedFee.toFixed(2)}`} />
            <FeeMetric icon={Landmark} label="Imposto" value={`${profile.tax_percent}%`} />
          </div>

          {/* Tax regime selector per platform */}
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
      )}
    </div>
  );
}
