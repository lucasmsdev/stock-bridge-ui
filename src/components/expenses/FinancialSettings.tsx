import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Save, Loader2, RotateCcw } from "lucide-react";
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

function PlatformFeeCard({ profile, onSave }: { 
  profile: MarketplaceFeeProfile; 
  onSave: (updates: Partial<MarketplaceFeeProfile> & { id: string }) => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    commission_percent: profile.commission_percent,
    payment_fee_percent: profile.payment_fee_percent,
    fixed_fee_amount: profile.fixed_fee_amount,
    tax_regime: profile.tax_regime,
    tax_percent: profile.tax_percent,
  });

  const platform = profile.platform;
  const logo = PLATFORM_LOGOS[platform];
  const label = PLATFORM_LABELS[platform] || platform;

  const handleRegimeChange = (regime: string) => {
    const regimeData = TAX_REGIMES[regime];
    setForm(prev => ({
      ...prev,
      tax_regime: regime,
      tax_percent: regimeData?.defaultPercent ?? prev.tax_percent,
    }));
  };

  const handleResetDefaults = () => {
    const defaults = DEFAULT_FEES[platform];
    if (defaults) {
      setForm(prev => ({
        ...prev,
        commission_percent: defaults.commission,
        payment_fee_percent: defaults.payment_fee,
        fixed_fee_amount: defaults.fixed_fee,
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      onSave({ id: profile.id, ...form });
      setEditing(false);
      toast({ title: "Taxas atualizadas", description: `${label} atualizado com sucesso.` });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const totalFee = form.commission_percent + form.payment_fee_percent + form.tax_percent;

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
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Editar</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleResetDefaults}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Padrão
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Comissão (%)</Label>
                <Input
                  type="number" step="0.01" 
                  value={form.commission_percent}
                  onChange={e => setForm(prev => ({ ...prev, commission_percent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pgto (%)</Label>
                <Input
                  type="number" step="0.01"
                  value={form.payment_fee_percent}
                  onChange={e => setForm(prev => ({ ...prev, payment_fee_percent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fixa (R$)</Label>
                <Input
                  type="number" step="0.01"
                  value={form.fixed_fee_amount}
                  onChange={e => setForm(prev => ({ ...prev, fixed_fee_amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Regime Tributário</Label>
                <Select value={form.tax_regime} onValueChange={handleRegimeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TAX_REGIMES).map(([key, regime]) => (
                      <SelectItem key={key} value={key}>{regime.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Imposto (%)</Label>
                <Input
                  type="number" step="0.01"
                  value={form.tax_percent}
                  onChange={e => setForm(prev => ({ ...prev, tax_percent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded bg-muted/50">
              <p className="text-xs text-muted-foreground">Comissão</p>
              <p className="text-sm font-semibold">{form.commission_percent}%</p>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <p className="text-xs text-muted-foreground">Pgto</p>
              <p className="text-sm font-semibold">{form.payment_fee_percent}%</p>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <p className="text-xs text-muted-foreground">Fixa</p>
              <p className="text-sm font-semibold">R${form.fixed_fee_amount}</p>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <p className="text-xs text-muted-foreground">Imposto</p>
              <p className="text-sm font-semibold">{form.tax_percent}%</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FinancialSettings({ onSettingsChange }: FinancialSettingsProps) {
  const { feeProfiles, isLoading, updateFeeProfile } = useMarketplaceFees();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Taxas por Marketplace
        </CardTitle>
        <CardDescription>
          Configure comissões, taxas de pagamento e impostos para cada plataforma. Esses valores são usados no cálculo de lucro real.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {feeProfiles.map(profile => (
            <PlatformFeeCard
              key={profile.id}
              profile={profile}
              onSave={(updates) => updateFeeProfile.mutate(updates)}
            />
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
