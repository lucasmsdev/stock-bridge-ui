import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Loader2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PlatformLogo } from "@/components/ui/platform-logo";
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

function PlatformFeeCard({ profile }: { profile: MarketplaceFeeProfile }) {
  const platform = profile.platform;
  const label = PLATFORM_LABELS[platform] || platform;
  const defaults = DEFAULT_FEES[platform];
  
  const commission = defaults?.commission ?? profile.commission_percent;
  const paymentFee = defaults?.payment_fee ?? profile.payment_fee_percent;
  const fixedFee = defaults?.fixed_fee ?? profile.fixed_fee_amount;
  const totalFee = commission + paymentFee + profile.tax_percent;

  return (
    <Card className="shadow-soft hover:shadow-medium transition-shadow w-full">
      <CardContent className="pt-7 pb-6 px-7">
        <div className="flex items-center gap-4 mb-3">
          <PlatformLogo platform={platform} size="lg" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-foreground">{label}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Taxa total: <span className="font-semibold text-primary">{totalFee.toFixed(1)}%</span>
            </p>
          </div>
        </div>
        <div className="flex justify-end mb-5">
          <Badge variant="secondary" className="gap-1.5 text-xs px-3 py-1">
            <Zap className="h-3.5 w-3.5" />
            Automático
          </Badge>
        </div>

        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="p-3.5 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1.5">Comissão</p>
            <p className="text-lg font-semibold">{commission}%</p>
          </div>
          <div className="p-3.5 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1.5">Pgto</p>
            <p className="text-lg font-semibold">{paymentFee}%</p>
          </div>
          <div className="p-3.5 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1.5">Fixa</p>
            <p className="text-lg font-semibold">R${fixedFee}</p>
          </div>
          <div className="p-3.5 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1.5">Imposto</p>
            <p className="text-lg font-semibold">{profile.tax_percent}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FinancialSettings({ onSettingsChange }: FinancialSettingsProps) {
  const { feeProfiles, isLoading, updateTaxRegime, currentTaxRegime } = useMarketplaceFees();
  const { toast } = useToast();

  const handleRegimeChange = (regime: string) => {
    const regimeData = TAX_REGIMES[regime];
    if (!regimeData) return;
    
    updateTaxRegime.mutate(
      { regime, taxPercent: regimeData.defaultPercent },
      {
        onSuccess: () => {
          toast({ title: "Regime tributário atualizado", description: `Todos os marketplaces agora usam ${regimeData.label}.` });
        },
        onError: () => {
          toast({ title: "Erro ao atualizar regime", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const currentRegimeData = TAX_REGIMES[currentTaxRegime];

  return (
    <Card>
      <CardHeader className="p-8">
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Taxas por Marketplace
        </CardTitle>
        <CardDescription>
          As taxas de comissão e pagamento são aplicadas automaticamente com base nos valores oficiais de cada plataforma. Você só precisa definir o regime tributário da sua empresa.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8 pt-2 space-y-8">
        {/* Global Tax Regime Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-5 rounded-lg border bg-muted/30">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Regime Tributário</p>
            <p className="text-xs text-muted-foreground">
              {currentRegimeData?.description || "Selecione o regime da sua empresa"}
            </p>
          </div>
          <Select 
            value={currentTaxRegime} 
            onValueChange={handleRegimeChange}
            disabled={updateTaxRegime.isPending}
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

        {/* Platform Cards */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 w-full">
          {feeProfiles.map(profile => (
            <PlatformFeeCard key={profile.id} profile={profile} />
          ))}
        </div>
        {feeProfiles.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum perfil de taxas encontrado. Os perfis são criados automaticamente ao configurar sua organização.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
