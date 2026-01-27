import { useState } from "react";
import { Image, Plus, Trash2, RefreshCw, Loader2, AlertTriangle, CheckCircle, Link as LinkIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PlatformLogo } from "@/components/ui/platform-logo";

interface ChannelStock {
  channel: string;
  channelId: string;
  stock: number;
  status: string;
  images?: string[];
}

interface ProductListing {
  id: string;
  platform: string;
  integration_id: string;
  platform_product_id: string;
  sync_status?: string;
}

interface MarketplaceImagesCardProps {
  productId: string;
  listings: ProductListing[];
  channelStocks: ChannelStock[];
  onImagesUpdated: () => void;
}

const platformNames: Record<string, string> = {
  mercadolivre: "Mercado Livre",
  shopify: "Shopify",
  amazon: "Amazon",
  shopee: "Shopee",
};

const platformLimits: Record<string, { maxImages: number; formats: string; maxSize: string }> = {
  mercadolivre: { maxImages: 10, formats: "JPEG, PNG", maxSize: "4MB" },
  shopify: { maxImages: 250, formats: "JPEG, PNG, GIF, WebP", maxSize: "20MB" },
  amazon: { maxImages: 9, formats: "JPEG, PNG, TIFF, GIF", maxSize: "10MB" },
};

export function MarketplaceImagesCard({ 
  productId, 
  listings, 
  channelStocks, 
  onImagesUpdated 
}: MarketplaceImagesCardProps) {
  const { toast } = useToast();
  const [imagesByPlatform, setImagesByPlatform] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    channelStocks.forEach(cs => {
      if (cs.images && cs.images.length > 0) {
        initial[cs.channel] = [...cs.images];
      }
    });
    return initial;
  });
  const [newImageUrl, setNewImageUrl] = useState<Record<string, string>>({});
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});

  // Get unique platforms that have listings
  const activePlatforms = [...new Set(listings.map(l => l.platform))];

  // If no listings exist, show a message
  if (activePlatforms.length === 0) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Imagens por Marketplace
          </CardTitle>
          <CardDescription>
            Gerencie as imagens do produto em cada plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Este produto não está publicado em nenhum marketplace. 
              Publique o produto primeiro para gerenciar suas imagens.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const handleAddImage = (platform: string) => {
    const url = newImageUrl[platform]?.trim();
    if (!url) {
      toast({
        title: "URL obrigatória",
        description: "Cole a URL de uma imagem válida.",
        variant: "destructive",
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      toast({
        title: "URL inválida",
        description: "A URL informada não é válida.",
        variant: "destructive",
      });
      return;
    }

    const currentImages = imagesByPlatform[platform] || [];
    const limits = platformLimits[platform];
    
    if (limits && currentImages.length >= limits.maxImages) {
      toast({
        title: "Limite atingido",
        description: `${platformNames[platform]} permite no máximo ${limits.maxImages} imagens.`,
        variant: "destructive",
      });
      return;
    }

    setImagesByPlatform(prev => ({
      ...prev,
      [platform]: [...(prev[platform] || []), url]
    }));
    setNewImageUrl(prev => ({ ...prev, [platform]: "" }));
    setHasChanges(prev => ({ ...prev, [platform]: true }));
  };

  const handleRemoveImage = (platform: string, index: number) => {
    setImagesByPlatform(prev => ({
      ...prev,
      [platform]: prev[platform].filter((_, i) => i !== index)
    }));
    setHasChanges(prev => ({ ...prev, [platform]: true }));
  };

  const handleMoveImage = (platform: string, fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= (imagesByPlatform[platform]?.length || 0)) return;
    
    setImagesByPlatform(prev => {
      const images = [...(prev[platform] || [])];
      const [movedImage] = images.splice(fromIndex, 1);
      images.splice(toIndex, 0, movedImage);
      return { ...prev, [platform]: images };
    });
    setHasChanges(prev => ({ ...prev, [platform]: true }));
  };

  const handleSyncImages = async (platform: string) => {
    const listing = listings.find(l => l.platform === platform);
    if (!listing) {
      toast({
        title: "Erro",
        description: "Listing não encontrado para esta plataforma.",
        variant: "destructive",
      });
      return;
    }

    const images = imagesByPlatform[platform] || [];
    if (images.length === 0) {
      toast({
        title: "Sem imagens",
        description: "Adicione pelo menos uma imagem antes de sincronizar.",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(prev => ({ ...prev, [platform]: true }));

    try {
      const { data, error } = await supabase.functions.invoke('update-product-images', {
        body: {
          productId,
          listingId: listing.id,
          platform,
          images,
        }
      });

      if (error) throw error;

      toast({
        title: "✅ Imagens sincronizadas!",
        description: `As imagens foram atualizadas no ${platformNames[platform]}.`,
      });

      setHasChanges(prev => ({ ...prev, [platform]: false }));
      onImagesUpdated();

    } catch (error: any) {
      console.error('Error syncing images:', error);
      toast({
        title: "Erro ao sincronizar",
        description: error.message || "Não foi possível atualizar as imagens.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(prev => ({ ...prev, [platform]: false }));
    }
  };

  const getChannelStock = (platform: string) => {
    return channelStocks.find(cs => cs.channel === platform);
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5 text-primary" />
          Imagens por Marketplace
        </CardTitle>
        <CardDescription>
          Visualize e edite as imagens do produto em cada plataforma conectada
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={activePlatforms[0]} className="w-full">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${activePlatforms.length}, 1fr)` }}>
            {activePlatforms.map(platform => (
              <TabsTrigger key={platform} value={platform} className="flex items-center gap-2">
                <PlatformLogo platform={platform} className="h-4 w-4" />
                <span className="hidden sm:inline">{platformNames[platform]}</span>
                {hasChanges[platform] && (
                  <Badge variant="secondary" className="ml-1 h-5 text-xs">
                    •
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {activePlatforms.map(platform => {
            const channelStock = getChannelStock(platform);
            const images = imagesByPlatform[platform] || [];
            const limits = platformLimits[platform];
            const isLoading = isSyncing[platform];

            return (
              <TabsContent key={platform} value={platform} className="mt-4 space-y-4">
                {/* Status indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlatformLogo platform={platform} className="h-5 w-5" />
                    <span className="font-medium">{platformNames[platform]}</span>
                    {channelStock?.status === 'synced' || channelStock?.status === 'synchronized' ? (
                      <Badge variant="outline" className="bg-success/20 text-success border-0">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Sincronizado
                      </Badge>
                    ) : channelStock?.status === 'error' ? (
                      <Badge variant="outline" className="bg-destructive/20 text-destructive border-0">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Erro
                      </Badge>
                    ) : null}
                  </div>
                  {limits && (
                    <span className="text-xs text-muted-foreground">
                      {images.length}/{limits.maxImages} imagens • {limits.formats}
                    </span>
                  )}
                </div>

                {/* Images grid */}
                {images.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {images.map((image, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square overflow-hidden rounded-lg border bg-muted">
                          <img
                            src={image}
                            alt={`Imagem ${index + 1}`}
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
                          />
                        </div>
                        
                        {/* Position badge */}
                        <Badge 
                          variant="secondary" 
                          className="absolute top-1 left-1 text-xs px-1.5 py-0.5"
                        >
                          {index === 0 ? "Principal" : index + 1}
                        </Badge>

                        {/* Action buttons */}
                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {index > 0 && (
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMoveImage(platform, index, index - 1)}
                              title="Mover para esquerda"
                            >
                              ←
                            </Button>
                          )}
                          {index < images.length - 1 && (
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMoveImage(platform, index, index + 1)}
                              title="Mover para direita"
                            >
                              →
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleRemoveImage(platform, index)}
                            title="Remover imagem"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg bg-muted/30">
                    <Image className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma imagem encontrada neste marketplace
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Adicione URLs de imagens abaixo
                    </p>
                  </div>
                )}

                {/* Add new image */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cole a URL da imagem (https://...)"
                      value={newImageUrl[platform] || ""}
                      onChange={(e) => setNewImageUrl(prev => ({ ...prev, [platform]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddImage(platform)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleAddImage(platform)}
                    disabled={!newImageUrl[platform]?.trim()}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>

                {/* Sync button */}
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => handleSyncImages(platform)}
                    disabled={isLoading || !hasChanges[platform]}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sincronizar Imagens
                      </>
                    )}
                  </Button>
                </div>

                {hasChanges[platform] && (
                  <p className="text-xs text-muted-foreground text-center">
                    Você tem alterações não salvas. Clique em "Sincronizar Imagens" para atualizar no marketplace.
                  </p>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
