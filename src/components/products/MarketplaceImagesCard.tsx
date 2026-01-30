import { useState, useRef } from "react";
import { Image, Plus, Trash2, RefreshCw, Loader2, AlertTriangle, CheckCircle, Link as LinkIcon, Upload, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PlatformLogo } from "@/components/ui/platform-logo";
import { AmazonLatencyWarning } from "@/components/amazon/AmazonLatencyWarning";

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

interface PendingUpload {
  file: File;
  preview: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

const platformNames: Record<string, string> = {
  mercadolivre: "Mercado Livre",
  shopify: "Shopify",
  amazon: "Amazon",
  shopee: "Shopee",
};

const platformLimits: Record<string, { maxImages: number; formats: string; maxSize: string; maxSizeBytes: number }> = {
  mercadolivre: { maxImages: 10, formats: "JPEG, PNG", maxSize: "4MB", maxSizeBytes: 4 * 1024 * 1024 },
  shopify: { maxImages: 250, formats: "JPEG, PNG, GIF, WebP", maxSize: "20MB", maxSizeBytes: 20 * 1024 * 1024 },
  amazon: { maxImages: 9, formats: "JPEG, PNG, TIFF, GIF", maxSize: "10MB", maxSizeBytes: 10 * 1024 * 1024 },
};

const acceptedFormats: Record<string, string> = {
  mercadolivre: "image/jpeg,image/png",
  shopify: "image/jpeg,image/png,image/gif,image/webp",
  amazon: "image/jpeg,image/png,image/tiff,image/gif",
};

export function MarketplaceImagesCard({ 
  productId, 
  listings, 
  channelStocks, 
  onImagesUpdated 
}: MarketplaceImagesCardProps) {
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  
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
  const [pendingUploads, setPendingUploads] = useState<Record<string, PendingUpload[]>>({});
  const [isDragging, setIsDragging] = useState<Record<string, boolean>>({});

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

  const validateFile = (file: File, platform: string): string | null => {
    const limits = platformLimits[platform];
    if (!limits) return null;

    // Check file size
    if (file.size > limits.maxSizeBytes) {
      return `Arquivo muito grande. Máximo permitido: ${limits.maxSize}`;
    }

    // Check file type
    const accepted = acceptedFormats[platform]?.split(',') || [];
    if (!accepted.includes(file.type)) {
      return `Formato não suportado. Use: ${limits.formats}`;
    }

    return null;
  };

  const handleFileSelect = async (platform: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const limits = platformLimits[platform];
    const currentImages = imagesByPlatform[platform] || [];
    const currentPending = pendingUploads[platform] || [];
    const totalImages = currentImages.length + currentPending.length + files.length;

    if (limits && totalImages > limits.maxImages) {
      toast({
        title: "Limite de imagens",
        description: `${platformNames[platform]} permite no máximo ${limits.maxImages} imagens. Você já tem ${currentImages.length + currentPending.length}.`,
        variant: "destructive",
      });
      return;
    }

    const newPending: PendingUpload[] = [];

    for (const file of Array.from(files)) {
      const error = validateFile(file, platform);
      if (error) {
        toast({
          title: "Arquivo inválido",
          description: `${file.name}: ${error}`,
          variant: "destructive",
        });
        continue;
      }

      // Create preview URL
      const preview = URL.createObjectURL(file);
      newPending.push({
        file,
        preview,
        progress: 0,
        status: 'pending',
      });
    }

    if (newPending.length > 0) {
      setPendingUploads(prev => ({
        ...prev,
        [platform]: [...(prev[platform] || []), ...newPending],
      }));
      setHasChanges(prev => ({ ...prev, [platform]: true }));
    }
  };

  const handleRemovePendingUpload = (platform: string, index: number) => {
    setPendingUploads(prev => {
      const uploads = [...(prev[platform] || [])];
      // Revoke the object URL to prevent memory leaks
      URL.revokeObjectURL(uploads[index].preview);
      uploads.splice(index, 1);
      return { ...prev, [platform]: uploads };
    });
  };

  const uploadFilesToStorage = async (platform: string): Promise<string[]> => {
    const uploads = pendingUploads[platform] || [];
    if (uploads.length === 0) return [];

    const uploadedUrls: string[] = [];

    for (let i = 0; i < uploads.length; i++) {
      const upload = uploads[i];
      
      // Update status to uploading
      setPendingUploads(prev => {
        const updated = [...(prev[platform] || [])];
        if (updated[i]) {
          updated[i] = { ...updated[i], status: 'uploading', progress: 10 };
        }
        return { ...prev, [platform]: updated };
      });

      try {
        // Generate unique filename
        const ext = upload.file.name.split('.').pop();
        const fileName = `${productId}/${platform}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(fileName, upload.file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) throw error;

        // Update progress
        setPendingUploads(prev => {
          const updated = [...(prev[platform] || [])];
          if (updated[i]) {
            updated[i] = { ...updated[i], progress: 80 };
          }
          return { ...prev, [platform]: updated };
        });

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(data.path);

        uploadedUrls.push(publicUrl);

        // Mark as done
        setPendingUploads(prev => {
          const updated = [...(prev[platform] || [])];
          if (updated[i]) {
            updated[i] = { ...updated[i], status: 'done', progress: 100 };
          }
          return { ...prev, [platform]: updated };
        });

      } catch (error: any) {
        console.error('Upload error:', error);
        
        // Mark as error
        setPendingUploads(prev => {
          const updated = [...(prev[platform] || [])];
          if (updated[i]) {
            updated[i] = { ...updated[i], status: 'error' };
          }
          return { ...prev, [platform]: updated };
        });

        toast({
          title: "Erro no upload",
          description: `Falha ao enviar ${upload.file.name}: ${error.message}`,
          variant: "destructive",
        });
      }
    }

    return uploadedUrls;
  };

  const handleDragOver = (e: React.DragEvent, platform: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(prev => ({ ...prev, [platform]: true }));
  };

  const handleDragLeave = (e: React.DragEvent, platform: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(prev => ({ ...prev, [platform]: false }));
  };

  const handleDrop = (e: React.DragEvent, platform: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(prev => ({ ...prev, [platform]: false }));
    
    const files = e.dataTransfer.files;
    handleFileSelect(platform, files);
  };

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
    const currentPending = pendingUploads[platform] || [];
    const limits = platformLimits[platform];
    
    if (limits && (currentImages.length + currentPending.length) >= limits.maxImages) {
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

    setIsSyncing(prev => ({ ...prev, [platform]: true }));

    try {
      // First, upload any pending files
      const uploadedUrls = await uploadFilesToStorage(platform);
      
      // Combine existing URLs with newly uploaded URLs
      const allImages = [...(imagesByPlatform[platform] || []), ...uploadedUrls];
      
      if (allImages.length === 0) {
        toast({
          title: "Sem imagens",
          description: "Adicione pelo menos uma imagem antes de sincronizar.",
          variant: "destructive",
        });
        setIsSyncing(prev => ({ ...prev, [platform]: false }));
        return;
      }

      // Update local state with uploaded images
      setImagesByPlatform(prev => ({
        ...prev,
        [platform]: allImages,
      }));

      // Clear pending uploads
      setPendingUploads(prev => {
        const uploads = prev[platform] || [];
        uploads.forEach(u => URL.revokeObjectURL(u.preview));
        return { ...prev, [platform]: [] };
      });

      // Sync to marketplace
      const { data, error } = await supabase.functions.invoke('update-product-images', {
        body: {
          productId,
          listingId: listing.id,
          platform,
          images: allImages,
        }
      });

      if (error) throw error;

      // Toast específico para Amazon com aviso de latência
      if (platform === 'amazon') {
        toast({
          title: "✅ Sincronização aceita pela Amazon",
          description: "Alterações de imagens podem levar até 24-48h para aparecer no catálogo.",
        });
      } else {
        toast({
          title: "✅ Imagens sincronizadas!",
          description: `As imagens foram atualizadas no ${platformNames[platform]}.`,
        });
      }

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
            const pending = pendingUploads[platform] || [];
            const limits = platformLimits[platform];
            const isLoading = isSyncing[platform];
            const dragging = isDragging[platform];

            return (
              <TabsContent key={platform} value={platform} className="mt-4 space-y-4">
                {/* Amazon latency warning */}
                {platform === 'amazon' && (
                  <AmazonLatencyWarning type="images" />
                )}
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
                      {images.length + pending.length}/{limits.maxImages} imagens • {limits.formats}
                    </span>
                  )}
                </div>

                {/* Upload area with drag and drop */}
                <div
                  onDragOver={(e) => handleDragOver(e, platform)}
                  onDragLeave={(e) => handleDragLeave(e, platform)}
                  onDrop={(e) => handleDrop(e, platform)}
                  className={`
                    relative border-2 border-dashed rounded-lg p-6 transition-all duration-200
                    ${dragging 
                      ? 'border-primary bg-primary/5 scale-[1.02]' 
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                    }
                  `}
                >
                  <input
                    ref={(el) => { fileInputRefs.current[platform] = el; }}
                    type="file"
                    accept={acceptedFormats[platform]}
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(platform, e.target.files)}
                  />
                  
                  <div className="flex flex-col items-center justify-center text-center">
                    <Upload className={`h-8 w-8 mb-2 ${dragging ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className="text-sm font-medium">
                      {dragging ? 'Solte as imagens aqui' : 'Arraste imagens ou'}
                    </p>
                    {!dragging && (
                      <Button
                        variant="link"
                        className="text-primary p-0 h-auto"
                        onClick={() => fileInputRefs.current[platform]?.click()}
                      >
                        clique para selecionar
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {limits?.formats} • Máximo {limits?.maxSize} por arquivo
                    </p>
                  </div>
                </div>

                {/* Pending uploads preview */}
                {pending.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Aguardando envio ({pending.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {pending.map((upload, index) => (
                        <div key={index} className="relative group">
                          <div className="aspect-square overflow-hidden rounded-lg border-2 border-dashed border-primary/50 bg-muted">
                            <img
                              src={upload.preview}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-full object-cover opacity-75"
                            />
                            {upload.status === 'uploading' && (
                              <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                                <Progress value={upload.progress} className="w-3/4 h-1" />
                              </div>
                            )}
                            {upload.status === 'done' && (
                              <div className="absolute inset-0 bg-success/20 flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-success" />
                              </div>
                            )}
                            {upload.status === 'error' && (
                              <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
                                <AlertTriangle className="h-8 w-8 text-destructive" />
                              </div>
                            )}
                          </div>
                          
                          <Badge 
                            variant="outline" 
                            className="absolute top-1 left-1 text-xs px-1.5 py-0.5 bg-background/80"
                          >
                            Novo
                          </Badge>

                          {upload.status === 'pending' && (
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemovePendingUpload(platform, index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                          
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {upload.file.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing images grid */}
                {images.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Imagens no marketplace ({images.length})
                    </p>
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
                  </div>
                )}

                {/* Empty state */}
                {images.length === 0 && pending.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <Image className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma imagem encontrada neste marketplace
                    </p>
                  </div>
                )}

                {/* Add by URL */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Ou cole a URL da imagem (https://...)"
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
                    disabled={isLoading || (!hasChanges[platform] && pending.length === 0)}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {pending.some(p => p.status === 'uploading') ? 'Enviando...' : 'Sincronizando...'}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sincronizar Imagens
                      </>
                    )}
                  </Button>
                </div>

                {(hasChanges[platform] || pending.length > 0) && (
                  <p className="text-xs text-muted-foreground text-center">
                    {pending.length > 0 
                      ? `${pending.length} imagem(ns) aguardando upload. Clique em "Sincronizar" para enviar e atualizar no marketplace.`
                      : 'Você tem alterações não salvas. Clique em "Sincronizar Imagens" para atualizar no marketplace.'
                    }
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
