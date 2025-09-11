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

export default function MarketAnalysis() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ComparativeAnalysis | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Digite um termo de busca ou URL para analisar.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-competitor', {
        body: { searchTerm: searchTerm.trim() }
      });

      if (error) {
        console.error('Error analyzing competitors:', error);
        toast({
          title: "Erro na análise",
          description: "Não foi possível analisar os concorrentes. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      if (data?.success && data?.analysis) {
        setAnalysis(data.analysis);
        toast({
          title: "Análise concluída",
          description: `Análise comparativa realizada com sucesso.`,
        });
      } else {
        toast({
          title: "Nenhum resultado",
          description: "Não foram encontrados produtos concorrentes para este termo.",
        });
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro durante a análise. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
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
              onClick={handleAnalyze}
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
                    Buscando produtos no Mercado Livre, Shopee e Amazon...
                  </p>
                </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Title */}
      {analysis && (
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              {analysis.productTitle}
            </h2>
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
      {!isAnalyzing && !analysis && (
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