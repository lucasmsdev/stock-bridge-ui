import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Settings, Save, Loader2, Percent, Store } from "lucide-react";

export interface FinancialSettingsData {
  marketplaceFeePercent: number;
  targetMarginPercent: number;
}

interface FinancialSettingsProps {
  onSettingsChange?: (settings: FinancialSettingsData) => void;
}

export function FinancialSettings({ onSettingsChange }: FinancialSettingsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FinancialSettingsData>({
    marketplaceFeePercent: 12,
    targetMarginPercent: 30,
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_financial_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const newSettings = {
          marketplaceFeePercent: Number(data.marketplace_fee_percent) || 12,
          targetMarginPercent: Number(data.target_margin_percent) || 30,
        };
        setSettings(newSettings);
        onSettingsChange?.(newSettings);
      }
    } catch (error) {
      console.error('Error loading financial settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('user_financial_settings')
        .upsert({
          user_id: user.id,
          marketplace_fee_percent: settings.marketplaceFeePercent,
          target_margin_percent: settings.targetMarginPercent,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "Suas taxas foram atualizadas com sucesso.",
      });

      onSettingsChange?.(settings);
    } catch (error: any) {
      console.error('Error saving financial settings:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
          Configurar Taxas
        </CardTitle>
        <CardDescription>
          Ajuste as taxas padrão usadas nos cálculos de lucratividade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Marketplace Fee */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              <Label>Taxa de Marketplace</Label>
            </div>
            <span className="text-sm font-medium text-primary">
              {settings.marketplaceFeePercent}%
            </span>
          </div>
          <Slider
            value={[settings.marketplaceFeePercent]}
            onValueChange={([value]) => 
              setSettings(prev => ({ ...prev, marketplaceFeePercent: value }))
            }
            min={0}
            max={30}
            step={0.5}
          />
          <p className="text-xs text-muted-foreground">
            Comissão média cobrada pelas plataformas de venda (ML, Shopee, Amazon).
          </p>
        </div>

        {/* Target Margin */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <Label>Margem Bruta Alvo</Label>
            </div>
            <span className="text-sm font-medium text-primary">
              {settings.targetMarginPercent}%
            </span>
          </div>
          <Slider
            value={[settings.targetMarginPercent]}
            onValueChange={([value]) => 
              setSettings(prev => ({ ...prev, targetMarginPercent: value }))
            }
            min={5}
            max={60}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            Margem bruta esperada após custos do produto e taxas.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Presets rápidos</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettings({ marketplaceFeePercent: 11, targetMarginPercent: 25 })}
            >
              Mercado Livre (11%)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettings({ marketplaceFeePercent: 14, targetMarginPercent: 25 })}
            >
              Shopee (14%)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettings({ marketplaceFeePercent: 15, targetMarginPercent: 30 })}
            >
              Amazon (15%)
            </Button>
          </div>
        </div>

        <Button onClick={saveSettings} disabled={saving} className="w-full">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </CardContent>
    </Card>
  );
}
