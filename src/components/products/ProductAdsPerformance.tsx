import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCampaignLinks } from "@/hooks/useCampaignLinks";
import { CampaignLinkDialog } from "./CampaignLinkDialog";
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  TrendingUp,
  DollarSign,
  Calendar,
  Link as LinkIcon
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProductAdsPerformanceProps {
  productId: string;
  productSku: string;
  productName: string;
  totalAttributedSpend?: number;
  totalAttributedRevenue?: number;
  attributedRoas?: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const getPlatformLabel = (platform: string) => {
  switch (platform) {
    case 'meta_ads': return 'Meta Ads';
    case 'google_ads': return 'Google Ads';
    case 'tiktok_ads': return 'TikTok Ads';
    case 'mercadolivre_ads': return 'Mercado Livre Ads';
    default: return platform;
  }
};

export function ProductAdsPerformance({
  productId,
  productSku,
  productName,
  totalAttributedSpend = 0,
  totalAttributedRevenue = 0,
  attributedRoas = 0,
}: ProductAdsPerformanceProps) {
  const { links, isLoading, deleteLink } = useCampaignLinks(productId);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                Performance de Anúncios
              </CardTitle>
              <CardDescription>
                Campanhas vinculadas e métricas de ROI deste produto
              </CardDescription>
            </div>
            <Button onClick={() => setIsLinkDialogOpen(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Vincular Campanha
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Metrics Summary */}
          {(totalAttributedSpend > 0 || totalAttributedRevenue > 0) && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Gasto Ads</span>
                </div>
                <p className="text-lg font-bold">{formatCurrency(totalAttributedSpend)}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs">Receita</span>
                </div>
                <p className="text-lg font-bold">{formatCurrency(totalAttributedRevenue)}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Megaphone className="h-4 w-4" />
                  <span className="text-xs">ROAS</span>
                </div>
                <p className={`text-lg font-bold ${attributedRoas >= 1 ? 'text-primary' : 'text-destructive'}`}>
                  {attributedRoas.toFixed(2)}x
                </p>
              </div>
            </div>
          )}

          {/* Linked Campaigns */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Campanhas Vinculadas ({links.length})
            </h4>
            
            {links.length === 0 ? (
              <div className="text-center py-6 bg-muted/30 rounded-lg border border-dashed">
                <Megaphone className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma campanha vinculada a este produto.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => setIsLinkDialogOpen(true)}
                >
                  Vincular primeira campanha
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {links.map((link) => (
                  <div 
                    key={link.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${link.is_active ? 'bg-primary' : 'bg-muted-foreground'}`} />
                      <div>
                        <p className="font-medium text-sm">{link.campaign_name || link.campaign_id}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {getPlatformLabel(link.platform)}
                          </Badge>
                          {(link.start_date || link.end_date) && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {link.start_date || '...'} - {link.end_date || '...'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso removerá a associação entre esta campanha e o produto. 
                            Os dados históricos de conversões atribuídas não serão afetados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteLink.mutate(link.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CampaignLinkDialog
        open={isLinkDialogOpen}
        onOpenChange={setIsLinkDialogOpen}
        productId={productId}
        productSku={productSku}
        productName={productName}
      />
    </>
  );
}
