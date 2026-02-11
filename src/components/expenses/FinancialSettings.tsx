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
      <CardContent className="pt-10 pb-8 px-10"> {/* Aumentado: mais padding */}
        <div className="flex items-center gap-6 mb-6"> {/* Gap maior */}
          <PlatformLogo platform={platform} size="xl" className="shrink-0" /> {/* Logo maior */}
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-foreground"> {/* Fonte maior */}
              {label}
            </p>
            <p className="text-base text-muted-foreground mt-2"> {/* Fonte e mt maiores */}
              Taxa total: <span className="font-bold text-primary text-lg">{totalFee.toFixed(1)}%</span>
            </p>
          </div>
        </div>
        <div className="flex justify-end mb-8"> {/* mb maior */}
          <Badge variant="secondary" className="gap-2 text-sm px-4 py-2"> {/* Badge maior */}
            <Zap className="h-4 w-4" />
            Automático
          </Badge>
        </div>

        <div className="grid grid-cols-4 gap-6 text-center"> {/* Gap maior */}
          <div className="p-6 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors"> {/* p e rounded maiores */}
            <p className="text-sm text-muted-foreground mb-2">Comissão</p>
            <p className="text-2xl font-bold text-foreground">{commission}%</p> {/* Fonte muito maior */}
          </div>
          <div className="p-6 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors">
            <p className="text-sm text-muted-foreground mb-2">Pgto</p>
            <p className="text-2xl font-bold text-foreground">{paymentFee}%</p>
          </div>
          <div className="p-6 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors">
            <p className="text-sm text-muted-foreground mb-2">Fixa</p>
            <p className="text-2xl font-bold text-foreground">R${fixedFee}</p>
          </div>
          <div className="p-6 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors">
            <p className="text-sm text-muted-foreground mb-2">Imposto</p>
            <p className="text-2xl font-bold text-foreground">{profile.tax_percent}%</p>
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
        <CardContent className="flex items-center justify-center py-12"> {/* py maior */}
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const currentRegimeData = TAX_REGIMES[currentTaxRegime];

  return (
  <Card className="w-full max-w-7xl mx-auto"> {/* Largura controlada e centralizada */}
    <CardHeader className="p-12 pb-8"> {/* Top mais alto, bottom ajustado */}
      <CardTitle className="flex items-center gap-3 text-3xl"> {/* Ainda maior */}
        <Settings className="h-7 w-7 text-primary" />
        Taxas por Marketplace
      </CardTitle>
      <CardDescription className="text-xl mt-3 leading-relaxed max-w-2xl"> {/* Mais proeminente */}
        As taxas de comissão e pagamento são aplicadas automaticamente com base nos valores oficiais de cada plataforma. Você só precisa definir o regime tributário da sua empresa.
      </CardDescription>
    </CardHeader>
    <CardContent className="p-12 pt-0 space-y-12 min-h-[600px]"> {/* Padding lateral/topo alto, altura mínima para "encher" */}
      {/* Global Tax Regime Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 p-8 rounded-2xl border-2 border-border bg-muted/20 shadow-sm"> {/* Mais destaque */}
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-foreground">Regime Tributário</p>
          <p className="text-base text-muted-foreground mt-1">
            {currentRegimeData?.description || "Selecione o regime da sua empresa"}
          </p>
        </div>
        <Select 
          value={currentTaxRegime} 
          onValueChange={handleRegimeChange}
          disabled={updateTaxRegime.isPending}
        >
          <SelectTrigger className="w-full sm:w-[280px] shrink-0 h-12">
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
      <div className="grid gap-10 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 w-full flex-1"> {/* Gap maior, flex para crescer */}
        {feeProfiles.map(profile => (
          <PlatformFeeCard key={profile.id} profile={profile} />
        ))}
        {feeProfiles.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
            <Settings className="h-16 w-16 text-muted-foreground mb-6 opacity-50" />
            <p className="text-xl text-muted-foreground font-medium mb-2">
              Nenhum perfil de taxas encontrado
            </p>
            <p className="text-base text-muted-foreground max-w-md">
              Os perfis são criados automaticamente ao configurar sua organização.
            </p>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

