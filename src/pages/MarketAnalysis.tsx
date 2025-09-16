import { useState } from "react";
import { Target, Search, Loader2, TrendingUp, Users, DollarSign, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BestOffer {
  title: string;
  price: number;
  seller: string;
  link: string;
}

interface PlatformAnalysis {
  platform: string;
  bestOffer: BestOffer;
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

interface VariationAnalysis {
  productTitle: string;
  variations: string[];
}

export default function MarketAnalysis() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ComparativeAnalysis | null>(null);
  const [variations, setVariations] = useState<VariationAnalysis | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async (variation?: string) => {
    if (!searchTerm.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Digite um termo de busca ou URL para analisar.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    
    // Reset states based on whether we're analyzing a variation
    if (variation) {
      setAnalysis(null);
      setSelectedVariation(variation);
    } else {
      setAnalysis(null);
      setVariations(null);
      setSelectedVariation(null);
    }

    try {
      console.log('🚀 Iniciando análise de mercado para:', searchTerm.trim(), variation ? `com variação: ${variation}` : '');
      
      const { data, error: functionError } = await supabase.functions.invoke('get-comparative-pricing', {
        body: { 
          searchTerm: searchTerm.trim(),
          variation: variation || null
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

      if (data?.success && data?.step === 'variations' && data?.data) {
        console.log('✅ Variações recebidas com sucesso');
        setVariations(data.data);
        toast({
          title: "Variações encontradas",
          description: `Encontradas ${data.data.variations.length} variações para "${data.data.productTitle}".`,
        });
      } else if (data?.success && data?.step === 'analysis' && data?.data) {
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
    setVariations(null);
    setAnalysis(null);
    setSelectedVariation(null);
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
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" />
          Análise de Mercado
        </h1>
        <p className="text-muted-foreground">
          Analise a concorrência e descubra oportunidades de preços no mercado
        </p>
      </div>

      {/* Search Section */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Buscar Concorrentes</CardTitle>
          <CardDescription>
            Digite o nome de um produto ou cole a URL de um concorrente para começar a análise
          </CardDescription>
          <p className="text-sm text-muted-foreground mt-2 italic">
            A busca é realizada em tempo real nos marketplaces e pode apresentar inconsistências pontuais. Use os resultados como um guia estratégico.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Ex: iPhone 15 Pro Max, notebook gamer, ou https://produto.mercadolivre.com.br/..."
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
                  <p className="text-sm text-muted-foreground">
                    Analisando preços no Mercado Livre, Shopee e Amazon...
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

      {/* Variation Selection */}
      {variations && !selectedVariation && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Selecione a Variação</CardTitle>
            <CardDescription>
              Encontramos diferentes variações para "{variations.productTitle}". Selecione a que você deseja analisar:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {variations.variations.map((variation, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="text-left justify-start h-auto p-4 hover:border-primary hover:bg-primary/5"
                  onClick={() => handleAnalyze(variation)}
                  disabled={isAnalyzing}
                >
                  <div>
                    <div className="font-medium">{variation}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Clique para analisar preços
                    </div>
                  </div>
                </Button>
              ))}
            </div>
            
            <Separator className="my-4" />
            
            <div className="flex justify-center">
              <Button 
                variant="ghost" 
                onClick={handleStartOver}
                className="text-muted-foreground hover:text-foreground"
              >
                Voltar à busca inicial
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Title */}
      {analysis && (
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                {analysis.productTitle}
                {selectedVariation && (
                  <Badge variant="secondary" className="ml-2 text-sm">
                    {selectedVariation}
                  </Badge>
                )}
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
            <CardTitle>Análise Comparativa de Preços</CardTitle>
            <CardDescription>
              Melhores ofertas encontradas em cada plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysis.analysis.map((platformAnalysis, index) => (
                <div key={index} className="border border-border rounded-lg p-4 hover:shadow-soft transition-shadow">
                  <div className="flex items-start justify-between space-x-4">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      {/* Platform Badge */}
                      <div className="flex-shrink-0">
                        <Badge 
                          variant="outline" 
                          className={`text-xs font-medium px-2 py-1 ${getPlatformColor(platformAnalysis.platform)}`}
                        >
                          {platformAnalysis.platform}
                        </Badge>
                      </div>
                      
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                          <a 
                            href={platformAnalysis.bestOffer.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-primary transition-colors cursor-pointer"
                          >
                            {platformAnalysis.bestOffer.title}
                          </a>
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>Vendedor: {platformAnalysis.bestOffer.seller}</span>
                          <Badge variant="secondary">
                            Melhor oferta
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    {/* Price and Action */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold text-primary">
                        {formatPrice(platformAnalysis.bestOffer.price)}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => window.open(platformAnalysis.bestOffer.link, '_blank')}
                      >
                        Ver Oferta
                      </Button>
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
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Pronto para Analisar o Mercado
              </h3>
              <p className="text-muted-foreground mb-6">
                Digite um termo de busca acima para descobrir como seus concorrentes estão precificando produtos similares nas principais plataformas de e-commerce.
              </p>
              <div className="text-sm text-muted-foreground space-y-2">
                <p><strong>Plataformas analisadas:</strong> Mercado Livre, Shopee e Amazon</p>
                <p><strong>Dica:</strong> Seja específico na sua busca para obter melhores resultados</p>
                <p>Exemplos: "iPhone 15 128GB", "notebook Dell inspiron", "tênis Nike air max"</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}