import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AmazonStatusCardProps {
  productId: string;
  sku: string;
  integrationId: string;
}

interface VerifyResult {
  success: boolean;
  sku?: string;
  marketplace?: string;
  currency?: string;
  // Dois preços separados: offer = preço de venda, list = preço de comparação
  observedAmazonOfferPrice?: number | null;
  observedAmazonListPrice?: number | null;
  // Backwards compat
  observedAmazonPrice?: number | null;
  observedAmazonTitle?: string | null;
  observedAmazonMainImage?: string | null;
  observedAmazonStock?: number | null;
  productType?: string | null;
  issues?: any[];
  verifiedAt?: string;
  error?: string;
}

export function AmazonStatusCard({ productId, sku, integrationId }: AmazonStatusCardProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const handleVerify = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-amazon-listing', {
        body: { productId, sku, integrationId }
      });

      if (error) throw error;

      setVerifyResult(data);

      if (data.success) {
        toast({
          title: "Verificação concluída",
          description: `Dados da Amazon atualizados às ${new Date(data.verifiedAt).toLocaleTimeString('pt-BR')}`,
        });
      } else {
        toast({
          title: "Erro na verificação",
          description: data.error || "Não foi possível verificar",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error verifying Amazon listing:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao verificar na Amazon",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <img 
            src="/logos/amazon.svg" 
            alt="Amazon" 
            className="h-5 w-5"
          />
          Status na Amazon
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleVerify}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Revalidar
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {!verifyResult ? (
          <p className="text-sm text-muted-foreground">
            Clique em "Revalidar" para ver os dados atuais na Amazon.
          </p>
        ) : verifyResult.success ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Preço de Venda:</span>
                <p className="font-medium">
                  {(verifyResult.observedAmazonOfferPrice ?? verifyResult.observedAmazonPrice) !== null 
                    ? `${verifyResult.currency} ${(verifyResult.observedAmazonOfferPrice ?? verifyResult.observedAmazonPrice)?.toFixed(2)}`
                    : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Preço Lista:</span>
                <p className="font-medium text-muted-foreground">
                  {verifyResult.observedAmazonListPrice !== null && verifyResult.observedAmazonListPrice !== undefined
                    ? `${verifyResult.currency} ${verifyResult.observedAmazonListPrice?.toFixed(2)}`
                    : 'N/A'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Estoque:</span>
                <p className="font-medium">
                  {verifyResult.observedAmazonStock !== null 
                    ? verifyResult.observedAmazonStock 
                    : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">SKU:</span>
                <p className="font-medium font-mono text-xs">{verifyResult.sku || 'N/A'}</p>
              </div>
            </div>
            
            {verifyResult.observedAmazonTitle && (
              <div className="text-sm">
                <span className="text-muted-foreground">Título:</span>
                <p className="font-medium line-clamp-2">{verifyResult.observedAmazonTitle}</p>
              </div>
            )}

            {verifyResult.observedAmazonMainImage && (
              <div className="flex items-center gap-3">
                <img 
                  src={verifyResult.observedAmazonMainImage} 
                  alt="Imagem Amazon"
                  className="w-16 h-16 object-cover rounded border"
                />
                <a 
                  href={verifyResult.observedAmazonMainImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Ver imagem <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {verifyResult.issues && verifyResult.issues.length > 0 && (
              <div className="p-2 bg-yellow-500/10 rounded text-sm">
                <div className="flex items-center gap-1 text-yellow-700 dark:text-yellow-400 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Avisos ({verifyResult.issues.length})
                </div>
                <ul className="list-disc list-inside mt-1 text-yellow-600 dark:text-yellow-300 text-xs">
                  {verifyResult.issues.slice(0, 3).map((issue: any, i: number) => (
                    <li key={i}>{issue.message || JSON.stringify(issue)}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <Badge variant="outline" className="text-xs">
                {verifyResult.productType || 'PRODUCT'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Verificado: {new Date(verifyResult.verifiedAt!).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4" />
            {verifyResult.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
