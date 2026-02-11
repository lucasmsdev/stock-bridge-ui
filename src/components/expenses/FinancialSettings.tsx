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
  MarketplaceFeeProfile,
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
      <CardContent className="pt-10 pb-8 px-10">
        {" "}
        {/* Aumentado: mais padding */}
        <div className="flex items-center gap-6 mb-6">
          {" "}
          {/* Gap maior */}
          <PlatformLogo platform={platform} size="xl" className="shrink-0" /> {/* Logo maior */}
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-foreground">
              {" "}
              {/* Fonte maior */}
              {label}
            </p>
            <p className="text-base text-muted-foreground mt-2">
              {" "}
              {/* Fonte e mt maiores */}
              Taxa total: <span className="font-bold text-primary text-lg">{totalFee.toFixed(1)}%</span>
            </p>
          </div>
        </div>
        <div className="flex justify-end mb-8">
          {" "}
          {/* mb maior */}
          <Badge variant="secondary" className="gap-2 text-sm px-4 py-2">
            {" "}
            {/* Badge maior */}
            <Zap className="h-4 w-4" />
            Automático
          </Badge>
        </div>
        <div className="grid grid-cols-4 gap-6 text-center">
          {" "}
          {/* Gap maior */}
          <div className="p-6 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors">
            {" "}
            {/* p e rounded maiores */}
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
          toast({
            title: "Regime tributário atualizado",
            description: `Todos os marketplaces agora usam ${regimeData.label}.`,
          });
        },
        onError: () => {
          toast({ title: "Erro ao atualizar regime", variant: "destructive" });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          {" "}
          {/* py maior */}
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const currentRegimeData = TAX_REGIMES[currentTaxRegime];

  return (
    <Card>
      <CardHeader className="p-10">
        {" "}
        {/* Padding maior */}
        <CardTitle className="flex items-center gap-3 text-2xl">
          {" "}
          {/* Título maior */}
          <Settings className="h-6 w-6 text-primary" />
          Taxas por Marketplace
        </CardTitle>
        <CardDescription className="text-lg mt-2">
          {" "}
          {/* Fonte maior */}
          As taxas de comissão e pagamento são aplicadas automaticamente com base nos valores oficiais de cada
          plataforma. Você só precisa definir o regime tributário da sua empresa.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-10 pt-4 space-y-10">
        {" "}
        {/* Padding e space maiores */}
        {/* Global Tax Regime Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-6 rounded-xl border bg-muted/30">
          {" "}
          {/* p e rounded maiores */}
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-foreground">
              {" "}
              {/* Fonte maior */}
              Regime Tributário
            </p>
            <p className="text-sm text-muted-foreground">
              {currentRegimeData?.description || "Selecione o regime da sua empresa"}
            </p>
          </div>
          <Select value={currentTaxRegime} onValueChange={handleRegimeChange} disabled={updateTaxRegime.isPending}>
            <SelectTrigger className="w-full sm:w-[260px] shrink-0">
              {" "}
              {/* Largura maior */}
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
        <div className="grid gap-8 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 w-full">
          {" "}
          {/* Gap maior */}
          {feeProfiles.map((profile) => (
            <PlatformFeeCard key={profile.id} profile={profile} />
          ))}
        </div>
        {feeProfiles.length === 0 && (
          <p className="text-base text-muted-foreground text-center py-12">
            {" "}
            {/* Fonte e py maiores */}
            Nenhum perfil de taxas encontrado. Os perfis são criados automaticamente ao configurar sua organização.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
