import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, TrendingUp, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMarketplaceFees, PLATFORM_LABELS, PLATFORM_LOGOS } from "@/hooks/useMarketplaceFees";

export function ProfitabilityCalculator() {
  const { feeProfiles, calculateFees, getFeeProfile } = useMarketplaceFees();
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [formData, setFormData] = useState({
    costPrice: "",
    marketplaceFee: "16",
    taxes: "8",
    shippingCost: "",
    adSpend: "",
    sellingPrice: "",
  });

  const handlePlatformChange = (platform: string) => {
    setSelectedPlatform(platform);
    const profile = getFeeProfile(platform);
    if (profile) {
      setFormData(prev => ({
        ...prev,
        marketplaceFee: (profile.commission_percent + profile.payment_fee_percent).toString(),
        taxes: profile.tax_percent.toString(),
      }));
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const costPrice = parseFloat(formData.costPrice) || 0;
  const sellingPrice = parseFloat(formData.sellingPrice) || 0;
  const marketplaceFee = (parseFloat(formData.marketplaceFee) || 0) / 100;
  const taxes = (parseFloat(formData.taxes) || 0) / 100;
  const shippingCost = parseFloat(formData.shippingCost) || 0;
  const adSpend = parseFloat(formData.adSpend) || 0;

  const marketplaceFeeAmount = sellingPrice * marketplaceFee;
  const taxAmount = sellingPrice * taxes;
  const totalCosts = costPrice + marketplaceFeeAmount + taxAmount + shippingCost + adSpend;
  const grossProfit = sellingPrice - totalCosts;
  const profitMargin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;
  const roi = adSpend > 0 ? (grossProfit / adSpend) * 100 : 0;

  // Marketplace comparison
  const comparison = useMemo(() => {
    if (sellingPrice <= 0 || costPrice <= 0) return [];
    return feeProfiles.map(profile => {
      const fees = calculateFees(profile.platform, sellingPrice, costPrice);
      const net = fees.netPerUnit - shippingCost - adSpend;
      const margin = sellingPrice > 0 ? (net / sellingPrice) * 100 : 0;
      return {
        platform: profile.platform,
        label: PLATFORM_LABELS[profile.platform] || profile.platform,
        logo: PLATFORM_LOGOS[profile.platform] || '',
        netProfit: net,
        margin,
      };
    }).sort((a, b) => b.netProfit - a.netProfit);
  }, [feeProfiles, sellingPrice, costPrice, shippingCost, adSpend, calculateFees]);

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Calculator className="h-6 w-6 text-primary" />
          Calculadora de Precificação e Lucro
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Selecione um marketplace para preencher automaticamente as taxas reais
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform Selector */}
        <div className="space-y-2">
          <Label>Marketplace</Label>
          <Select value={selectedPlatform} onValueChange={handlePlatformChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um marketplace" />
            </SelectTrigger>
            <SelectContent>
              {feeProfiles.map(profile => (
                <SelectItem key={profile.platform} value={profile.platform}>
                  <div className="flex items-center gap-2">
                    <img src={PLATFORM_LOGOS[profile.platform]} alt="" className="h-4 w-4 object-contain" />
                    {PLATFORM_LABELS[profile.platform] || profile.platform}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="costPrice">Preço de Custo (R$)</Label>
            <Input id="costPrice" type="number" step="0.01" placeholder="0.00" value={formData.costPrice}
              onChange={(e) => handleInputChange('costPrice', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sellingPrice">Preço de Venda (R$)</Label>
            <Input id="sellingPrice" type="number" step="0.01" placeholder="0.00" value={formData.sellingPrice}
              onChange={(e) => handleInputChange('sellingPrice', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketplaceFee">Taxa do Marketplace (%)</Label>
            <Input id="marketplaceFee" type="number" step="0.1" value={formData.marketplaceFee}
              onChange={(e) => handleInputChange('marketplaceFee', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxes">Impostos (%)</Label>
            <Input id="taxes" type="number" step="0.1" value={formData.taxes}
              onChange={(e) => handleInputChange('taxes', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shippingCost">Custo de Envio (R$)</Label>
            <Input id="shippingCost" type="number" step="0.01" placeholder="0.00" value={formData.shippingCost}
              onChange={(e) => handleInputChange('shippingCost', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adSpend">Gasto com Anúncios por Venda (R$)</Label>
            <Input id="adSpend" type="number" step="0.01" placeholder="0.00" value={formData.adSpend}
              onChange={(e) => handleInputChange('adSpend', e.target.value)} />
          </div>
        </div>

        {/* Results */}
        {sellingPrice > 0 && (
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Resultados da Simulação
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">R$ {grossProfit.toFixed(2)}</div>
                  <p className="text-sm text-green-600 dark:text-green-500 font-medium">Lucro por Venda</p>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{profitMargin.toFixed(1)}%</div>
                  <p className="text-sm text-blue-600 dark:text-blue-500 font-medium">Margem de Lucro</p>
                </div>
                {adSpend > 0 && (
                  <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                    <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{roi.toFixed(0)}%</div>
                    <p className="text-sm text-purple-600 dark:text-purple-500 font-medium">ROI do Anúncio</p>
                  </div>
                )}
              </div>

              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h5 className="font-medium mb-2">Detalhamento dos Custos:</h5>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between"><span>Preço de custo:</span><span>R$ {costPrice.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Taxa marketplace:</span><span>R$ {marketplaceFeeAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Impostos:</span><span>R$ {taxAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Frete:</span><span>R$ {shippingCost.toFixed(2)}</span></div>
                  {adSpend > 0 && <div className="flex justify-between"><span>Anúncios:</span><span>R$ {adSpend.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-medium border-t pt-1"><span>Total de custos:</span><span>R$ {totalCosts.toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            {/* Marketplace Comparison */}
            {comparison.length > 0 && costPrice > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">📊 Onde você lucra mais?</h4>
                <div className="space-y-2">
                  {comparison.map((c, i) => (
                    <div key={c.platform} className={`flex items-center justify-between p-3 rounded-lg ${i === 0 ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'bg-muted/50'}`}>
                      <div className="flex items-center gap-3">
                        {i === 0 && <span className="text-lg">🏆</span>}
                        {c.logo && <img src={c.logo} alt="" className="h-5 w-5 object-contain" />}
                        <span className="text-sm font-medium">{c.label}</span>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${c.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          R$ {c.netProfit.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">{c.margin.toFixed(1)}% margem</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profitMargin < 10 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Margem de lucro baixa (menos de 10%). Considere revisar seus custos ou preço de venda.</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
