import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Calendar, Crown, TrendingUp, BarChart3, Package, Target } from "lucide-react";
import { usePlan, FeatureName } from "@/hooks/usePlan";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

export default function Reports() {
  const { hasFeature, isLoading: planLoading } = usePlan();
  const { toast } = useToast();
  const [reportType, setReportType] = useState("");
  const [period, setPeriod] = useState("");
  const [formatType, setFormatType] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

  const hasAdvancedReports = hasFeature(FeatureName.ADVANCED_REPORTS);

  // Check access - wait for plan to load
  if (planLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  if (!hasFeature(FeatureName.REPORTS)) {
    return <Navigate to="/app/billing" state={{ targetFeature: FeatureName.REPORTS }} replace />;
  }

  const generateReport = async () => {
    if (!reportType || !period || !formatType) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos antes de gerar o relatório.",
        variant: "destructive"
      });
      return;
    }

    // Validate custom date range
    if (period === 'custom' && (!customDateRange?.from || !customDateRange?.to)) {
      toast({
        title: "Erro",
        description: "Selecione as datas de início e fim para o período personalizado.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const requestBody: any = {
        reportType,
        period,
        format: formatType
      };

      // Add custom dates if custom period is selected
      if (period === 'custom' && customDateRange?.from && customDateRange?.to) {
        requestBody.customStartDate = customDateRange.from.toISOString();
        requestBody.customEndDate = customDateRange.to.toISOString();
      }

      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: requestBody
      });

      if (error) throw error;

      if (data?.fileUrl) {
        // Create download link for data URL
        const link = document.createElement('a');
        link.href = data.fileUrl;
        link.download = data.filename || `relatorio-${reportType}-${period}.${formatType.toLowerCase()}`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: "Sucesso!",
          description: "Relatório gerado e download iniciado."
        });
      } else {
        throw new Error('URL do arquivo não recebida');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao gerar relatório.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Basic report types available to all REPORTS users
  const basicReportTypes = [
    { value: "sales", label: "Relatório de Vendas", icon: BarChart3 },
    { value: "profitability", label: "Relatório de Lucratividade", icon: TrendingUp }
  ];

  // Advanced report types only for Enterprise+
  const advancedReportTypes = [
    { value: "marketplace_performance", label: "Performance por Marketplace", icon: Target },
    { value: "trends", label: "Análise de Tendências", icon: TrendingUp },
    { value: "stock_forecast", label: "Previsão de Estoque", icon: Package },
    { value: "roi_by_channel", label: "ROI por Canal", icon: BarChart3 }
  ];

  const reportTypeOptions = hasAdvancedReports 
    ? [...basicReportTypes, ...advancedReportTypes]
    : basicReportTypes;

  // Basic periods available to all REPORTS users
  const basicPeriods = [
    { value: "last_7_days", label: "Últimos 7 dias" },
    { value: "last_30_days", label: "Últimos 30 dias" },
    { value: "last_month", label: "Mês passado" }
  ];

  // Advanced periods only for Enterprise+
  const advancedPeriods = [
    { value: "last_3_months", label: "Últimos 3 meses" },
    { value: "last_6_months", label: "Últimos 6 meses" },
    { value: "current_year", label: "Ano atual" },
    { value: "custom", label: "Período personalizado" }
  ];

  const periodOptions = hasAdvancedReports 
    ? [...basicPeriods, ...advancedPeriods]
    : basicPeriods;

  const formatOptions = [
    { value: "CSV", label: "CSV" },
    { value: "PDF", label: "PDF" }
  ];

  // Info cards for reports
  const basicReportInfo = [
    {
      title: "Relatório de Vendas",
      description: "Inclui dados de pedidos, receita total, produtos mais vendidos e performance por período.",
      icon: BarChart3
    },
    {
      title: "Relatório de Lucratividade",
      description: "Análise detalhada de margem de lucro por produto, custos e ROI.",
      icon: TrendingUp
    }
  ];

  const advancedReportInfo = [
    {
      title: "Performance por Marketplace",
      description: "Compare vendas e lucro entre Mercado Livre, Shopee, Amazon e Shopify.",
      icon: Target
    },
    {
      title: "Análise de Tendências",
      description: "Visualize crescimento percentual e tendências ao longo do tempo.",
      icon: TrendingUp
    },
    {
      title: "Previsão de Estoque",
      description: "Previsão inteligente baseada na média de vendas e demanda histórica.",
      icon: Package
    },
    {
      title: "ROI por Canal",
      description: "Lucro líquido e retorno sobre investimento por marketplace.",
      icon: BarChart3
    }
  ];

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">
          Gere relatórios detalhados sobre vendas e lucratividade
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Gerador de Relatórios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="report-type">Tipo de Relatório</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypeOptions.map((option) => {
                    const isAdvanced = advancedReportTypes.some(a => a.value === option.value);
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className="h-4 w-4 text-muted-foreground" />
                          <span>{option.label}</span>
                          {isAdvanced && (
                            <Badge variant="secondary" className="ml-1 text-xs bg-accent/20 text-accent">
                              <Crown className="h-3 w-3 mr-1" />
                              Enterprise
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="period">Período</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((option) => {
                    const isAdvanced = advancedPeriods.some(a => a.value === option.value);
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <span>{option.label}</span>
                          {isAdvanced && (
                            <Badge variant="secondary" className="ml-1 text-xs bg-accent/20 text-accent">
                              <Crown className="h-3 w-3 mr-1" />
                              Enterprise
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Custom date range picker - only shown when custom period is selected */}
            {period === 'custom' && hasAdvancedReports && (
              <div>
                <Label>Selecione o Período</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {customDateRange?.from ? (
                        customDateRange.to ? (
                          <>
                            {format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                            {format(customDateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                          </>
                        ) : (
                          format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        )
                      ) : (
                        <span>Selecione as datas</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      initialFocus
                      mode="range"
                      defaultMonth={customDateRange?.from}
                      selected={customDateRange}
                      onSelect={setCustomDateRange}
                      numberOfMonths={2}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div>
              <Label htmlFor="format">Formato</Label>
              <Select value={formatType} onValueChange={setFormatType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o formato" />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={generateReport} 
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                "Gerando..."
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Gerar Relatório
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Informações dos Relatórios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {/* Basic reports info */}
              {basicReportInfo.map((info) => (
                <div key={info.title} className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <info.icon className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium">{info.title}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {info.description}
                  </p>
                </div>
              ))}

              {/* Advanced reports info - only for Enterprise+ */}
              {hasAdvancedReports && (
                <>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                    <Crown className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium text-accent">Relatórios Exclusivos Enterprise</span>
                  </div>
                  {advancedReportInfo.map((info) => (
                    <div key={info.title} className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                      <div className="flex items-center gap-2">
                        <info.icon className="h-4 w-4 text-accent" />
                        <h4 className="font-medium">{info.title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {info.description}
                      </p>
                    </div>
                  ))}
                </>
              )}

              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <h4 className="font-medium text-primary">Formatos Disponíveis</h4>
                <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                  <li>• <strong>CSV:</strong> Para análise em planilhas</li>
                  <li>• <strong>PDF:</strong> Para apresentações e arquivo</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
