import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Loader2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  useMarketplaceFees, 
  PLATFORM_LABELS, 
  PLATFORM_LOGOS, 
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
  const logo = PLATFORM_LOGOS[platform];
  const label = PLATFORM_LABELS[platform] || platform;
  const defaults = DEFAULT_FEES[platform];
  
  const commission = defaults?.commission ?? profile.commission_percent;
  const paymentFee = defaults?.payment_fee ?? profile.payment_fee_percent;
  const fixedFee = defaults?.fixed_fee ?? profile.fixed_fee_amount;
  const totalFee = commission + paymentFee + profile.tax_percent;

  return (
    <Card className="shadow-soft hover:shadow-medium transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt={label} className="h-8 w-8 object-contain rounded" />
            <div>
              <p className="font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">
                Taxa total: <span className="font-medium text-primary">{totalFee.toFixed(1)}%</span>
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1 text-xs">
            <Zap className="h-3 w-3" />
            Automático
          </Badge>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded bg-muted/50">
            <p className="text-xs text-muted-foreground">Comissão</p>
            <p className="text-sm font-semibold">{commission}%</p>
          </div>
          <div className="p-2 rounded bg-muted/50">
            <p className="text-xs text-muted-foreground">Pgto</p>
            <p className="text-sm font-semibold">{paymentFee}%</p>
          </div>
          <div className="p-2 rounded bg-muted/50">
            <p className="text-xs text-muted-foreground">Fixa</p>
            <p className="text-sm font-semibold">R${fixedFee}</p>
          </div>
          <div className="p-2 rounded bg-muted/50">
            <p className="text-xs text-muted-foreground">Imposto</p>
            <p className="text-sm font-semibold">{profile.tax_percent}%</p>
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Taxas por Marketplace
        </CardTitle>
        <CardDescription>
          As taxas de comissão e pagamento são aplicadas automaticamente com base nos valores oficiais de cada plataforma. Você só precisa definir o regime tributário da sua empresa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Tax Regime Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border bg-muted/30">
          <div className="flex-1">
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
            <SelectTrigger className="w-full sm:w-[220px]">
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
        <div className="grid gap-4 md:grid-cols-2">
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
