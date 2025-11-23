import { useState } from "react";
import { Target, Search, Loader2, TrendingUp, Users, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PriceBreakdown {
  price: number;
  sales: number;
}

interface PlatformAnalysis {
  platform: string;
  averagePrice: number;
  sampleSize: number;
  totalSales: number;
  priceBreakdown: PriceBreakdown[];
  priceRange: {
    min: number;
    max: number;
  };
}

interface ComparativeAnalysis {
  productTitle: string;
  analysis: PlatformAnalysis[];
  priceSummary: {
    lowestPrice: number;
    highestPrice: number;
    averagePrice: number;
  };
}

export default function MarketAnalysis() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ComparativeAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Digite um termo de busca para analisar.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      console.log('🚀 Iniciando análise de mercado com IA para:', searchTerm.trim());
      
      toast({
        title: "Analisando mercado",
        description: "A IA está pesquisando preços nos principais marketplaces. Isso pode levar alguns segundos...",
      });
      
      const { data, error: functionError } = await supabase.functions.invoke('market-analysis-ai', {
        body: { 
          searchTerm: searchTerm.trim()
        }
      });

      console.log('📥 Resposta da função:', { data, functionError });

      if (functionError) {
        console.error('❌ Erro da função:', functionError);
        setError('Erro ao comunicar com o servidor. Tente novamente.');
        toast({
          title: "Erro na análise",
          description: "Falha na comunicação com o servidor. Verifique sua conexão e tente novamente.",
          variant: "destructive",
        });
        return;
      }

      if (data?.success && data?.data) {
        console.log('✅ Análise recebida com sucesso');
        setAnalysis(data.data);
        toast({
          title: "Análise concluída",
          description: `Análise comparativa realizada com sucesso para "${data.data.productTitle}".`,
        });
      } else if (data?.success === false) {
        console.log('⚠️ Função retornou erro:', data.error);
        setError(data.error || 'Erro desconhecido na análise');
        toast({
          title: "Erro na análise",
          description: data.error || "Não foi possível processar a análise.",
          variant: "destructive",
        });
      } else {
        console.log('⚠️ Nenhum resultado encontrado');
        setError('Nenhum resultado encontrado para este termo de busca');
        toast({
          title: "Nenhum resultado",
          description: "Não foram encontrados produtos para este termo. Tente uma busca mais específica.",
        });
      }
    } catch (error) {
      console.error('💥 Erro inesperado:', error);
      setError('Ocorreu um erro inesperado. Tente novamente mais tarde.');
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro durante a análise. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartOver = () => {
    setAnalysis(null);
    setError(null);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };


  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'Mercado Livre':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Shopee':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'Amazon':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-heading flex items-center gap-3">
          <Target className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          Análise de Mercado
        </h1>
        <p className="text-muted-foreground font-body">
          Compare preços e concorrência
        </p>
      </div>

      {/* Search Section */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="font-heading">Buscar Produto</CardTitle>
          <CardDescription className="font-body">
            🤖 Análise por IA em tempo real nos principais marketplaces
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Ex: iPhone 15 Pro Max, notebook gamer, fone de ouvido bluetooth..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isAnalyzing) {
                    handleAnalyze();
                  }
                }}
                className="text-base"
                disabled={isAnalyzing}
              />
            </div>
            <Button 
              onClick={() => handleAnalyze()}
              disabled={isAnalyzing || !searchTerm.trim()}
              className="bg-gradient-primary hover:bg-primary-hover transition-all duration-200 px-6"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Analisar
                </>
              )}
            </Button>
          </div>
          
          {isAnalyzing && (
            <div className="flex items-center justify-center py-8">
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground font-body">
                    🤖 Analisando preços nas plataformas...
                  </p>
                </div>
            </div>
          )}
          
          {error && !isAnalyzing && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center">
              <div className="flex items-center justify-center space-x-2 text-destructive">
                <Target className="h-5 w-5" />
                <h3 className="font-semibold">Erro na Análise</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={() => setError(null)}
              >
                Tentar Novamente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Title */}
      {analysis && (
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                {analysis.productTitle}
              </h2>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleStartOver}
                className="text-muted-foreground hover:text-foreground"
              >
                Nova Busca
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Price Summary */}
      {analysis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatPrice(analysis.priceSummary.lowestPrice)}
                  </p>
                  <p className="text-sm text-muted-foreground">Menor Preço</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatPrice(analysis.priceSummary.averagePrice)}
                  </p>
                  <p className="text-sm text-muted-foreground">Preço Médio</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatPrice(analysis.priceSummary.highestPrice)}
                  </p>
                  <p className="text-sm text-muted-foreground">Maior Preço</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Comparative Analysis Table */}
      {analysis && analysis.analysis.length > 0 && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Preço Médio por Marketplace</CardTitle>
            <CardDescription>
              Análise baseada em 3-5 ofertas de cada plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysis.analysis.map((platformAnalysis, index) => (
                <div key={index} className="border border-border rounded-lg p-5 hover:shadow-soft transition-shadow">
                  <div className="flex items-center justify-between">
                    {/* Platform Info */}
                    <div className="flex items-center space-x-4 flex-1">
                      <Badge 
                        variant="outline" 
                        className={`text-sm font-medium px-3 py-1.5 ${getPlatformColor(platformAnalysis.platform)}`}
                      >
                        {platformAnalysis.platform}
                      </Badge>
                      
                      <div className="flex-1">
                        <div className="flex items-baseline space-x-3">
                          <p className="text-3xl font-bold text-primary">
                            {formatPrice(platformAnalysis.averagePrice)}
                          </p>
                          <span className="text-sm text-muted-foreground">
                            preço médio
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                          <span>
                            📊 {platformAnalysis.sampleSize} {platformAnalysis.sampleSize === 1 ? 'oferta analisada' : 'ofertas analisadas'}
                          </span>
                          <span>•</span>
                          <span>
                            🛒 {platformAnalysis.totalSales.toLocaleString('pt-BR')} vendas totais
                          </span>
                          <span>•</span>
                          <span>
                            De {formatPrice(platformAnalysis.priceRange.min)} até {formatPrice(platformAnalysis.priceRange.max)}
                          </span>
                        </div>
                        
                        {/* Price Breakdown */}
                        {platformAnalysis.priceBreakdown && platformAnalysis.priceBreakdown.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <p className="text-sm font-medium text-foreground mb-3">
                              Vendas por Preço:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {platformAnalysis.priceBreakdown
                                .sort((a, b) => b.sales - a.sales)
                                .map((breakdown, idx) => (
                                <div 
                                  key={idx}
                                  className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2 text-sm"
                                >
                                  <span className="font-medium text-primary">
                                    {formatPrice(breakdown.price)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {breakdown.sales.toLocaleString('pt-BR')} vendas
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isAnalyzing && !analysis && !error && (
        <Card className="shadow-soft">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="max-w-md mx-auto">
              <Target className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
              <h3 className="text-xl font-semibold font-heading text-foreground mb-2">
                Análise de Mercado
              </h3>
              <p className="text-muted-foreground font-body mb-4">
                Compare preços de produtos nos principais marketplaces
              </p>
              <div className="text-sm text-muted-foreground font-body space-y-2">
                <p><strong>Plataformas:</strong> Mercado Livre, Shopee, Amazon</p>
                <p><strong>📊 Análise:</strong> Busca 3-5 ofertas por marketplace mostrando vendas por preço</p>
                <p>Ex: "iPhone 15 128GB", "notebook Dell", "tênis Nike"</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}