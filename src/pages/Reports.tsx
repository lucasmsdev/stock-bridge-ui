import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Calendar } from "lucide-react";
import { usePlan, FeatureName } from "@/hooks/usePlan";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";

export default function Reports() {
  const { hasFeature, isLoading: planLoading } = usePlan();
  const { toast } = useToast();
  const [reportType, setReportType] = useState("");
  const [period, setPeriod] = useState("");
  const [format, setFormat] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

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
    if (!reportType || !period || !format) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos antes de gerar o relatório.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: {
          reportType,
          period,
          format
        }
      });

      if (error) throw error;

      if (data?.fileUrl) {
        // Create download link for data URL
        const link = document.createElement('a');
        link.href = data.fileUrl;
        link.download = data.filename || `relatorio-${reportType}-${period}.${format.toLowerCase()}`;
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

  const reportTypeOptions = [
    { value: "sales", label: "Relatório de Vendas" },
    { value: "profitability", label: "Relatório de Lucratividade por Produto" }
  ];

  const periodOptions = [
    { value: "last_7_days", label: "Últimos 7 dias" },
    { value: "last_30_days", label: "Últimos 30 dias" },
    { value: "last_month", label: "Mês passado" }
  ];

  const formatOptions = [
    { value: "CSV", label: "CSV" },
    { value: "PDF", label: "PDF" }
  ];

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Relatórios Avançados</h1>
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
                  {reportTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
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
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="format">Formato</Label>
              <Select value={format} onValueChange={setFormat}>
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
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium">Relatório de Vendas</h4>
                <p className="text-sm text-muted-foreground">
                  Inclui dados de pedidos, receita total, produtos mais vendidos e performance por período.
                </p>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium">Relatório de Lucratividade</h4>
                <p className="text-sm text-muted-foreground">
                  Análise detalhada de margem de lucro por produto, custos e ROI.
                </p>
              </div>

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