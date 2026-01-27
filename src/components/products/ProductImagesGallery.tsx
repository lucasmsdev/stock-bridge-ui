import { useState, useRef, useCallback } from "react";
import { Upload, X, Link as LinkIcon, Plus, ChevronLeft, ChevronRight, Loader2, Save, ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PendingUpload {
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

interface ProductImagesGalleryProps {
  productId: string;
  initialImages: string[];
  onUpdate: (images: string[]) => void;
}

export function ProductImagesGallery({ 
  productId, 
  initialImages, 
  onUpdate 
}: ProductImagesGalleryProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [images, setImages] = useState<string[]>(initialImages || []);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles: PendingUpload[] = [];
    
    for (const file of Array.from(files)) {
      // Validate file type
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast({
          title: "Formato inválido",
          description: `${file.name} não é uma imagem válida (use JPG, PNG ou WebP)`,
          variant: "destructive",
        });
        continue;
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede 10MB`,
          variant: "destructive",
        });
        continue;
      }
      
      validFiles.push({
        file,
        preview: URL.createObjectURL(file),
        status: 'pending',
      });
    }
    
    if (validFiles.length > 0) {
      setPendingUploads(prev => [...prev, ...validFiles]);
      setHasChanges(true);
    }
  }, [toast]);

  const uploadPendingFiles = async () => {
    const uploadedUrls: string[] = [];
    
    for (let i = 0; i < pendingUploads.length; i++) {
      const upload = pendingUploads[i];
      if (upload.status !== 'pending') continue;
      
      setPendingUploads(prev => 
        prev.map((u, idx) => idx === i ? { ...u, status: 'uploading' } : u)
      );
      
      try {
        const ext = upload.file.name.split('.').pop() || 'jpg';
        const fileName = `${productId}/local/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, upload.file, {
            contentType: upload.file.type,
            upsert: false,
          });
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        uploadedUrls.push(publicUrl);
        
        setPendingUploads(prev => 
          prev.map((u, idx) => idx === i ? { ...u, status: 'done' } : u)
        );
      } catch (error) {
        console.error('Upload error:', error);
        setPendingUploads(prev => 
          prev.map((u, idx) => idx === i ? { ...u, status: 'error' } : u)
        );
      }
    }
    
    return uploadedUrls;
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    
    // Basic URL validation
    try {
      new URL(urlInput);
    } catch {
      toast({
        title: "URL inválida",
        description: "Digite uma URL válida de imagem",
        variant: "destructive",
      });
      return;
    }
    
    setImages(prev => [...prev, urlInput.trim()]);
    setUrlInput("");
    setHasChanges(true);
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleRemovePending = (index: number) => {
    setPendingUploads(prev => {
      const upload = prev[index];
      if (upload) {
        URL.revokeObjectURL(upload.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleMove = (fromIndex: number, direction: 'left' | 'right') => {
    const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= images.length) return;
    
    const newImages = [...images];
    [newImages[fromIndex], newImages[toIndex]] = [newImages[toIndex], newImages[fromIndex]];
    setImages(newImages);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Upload pending files first
      const uploadedUrls = await uploadPendingFiles();
      
      // Combine existing images with newly uploaded ones
      const allImages = [...images, ...uploadedUrls];
      
      // Save to database
      const { error } = await supabase
        .from('products')
        .update({ 
          images: allImages,
          image_url: allImages[0] || null
        })
        .eq('id', productId);
      
      if (error) throw error;
      
      // Update local state
      setImages(allImages);
      setPendingUploads([]);
      setHasChanges(false);
      
      // Notify parent
      onUpdate(allImages);
      
      toast({
        title: "✅ Imagens salvas",
        description: `${allImages.length} imagem(ns) salva(s) com sucesso`,
      });
    } catch (error: any) {
      console.error('Error saving images:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar as imagens",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const totalImages = images.length + pendingUploads.length;

  return (
    <Card className="shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <ImageIcon className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Galeria de Imagens</CardTitle>
          {totalImages > 0 && (
            <Badge variant="secondary">{totalImages} foto(s)</Badge>
          )}
        </div>
        
        {hasChanges && (
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            size="sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Images Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Existing Images */}
          {images.map((url, index) => (
            <div 
              key={`img-${index}`} 
              className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted"
            >
              <img 
                src={url} 
                alt={`Imagem ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
              
              {/* Overlay with controls */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                {/* Move left */}
                {index > 0 && (
                  <Button 
                    size="icon" 
                    variant="secondary" 
                    className="h-7 w-7"
                    onClick={() => handleMove(index, 'left')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                
                {/* Delete */}
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="h-7 w-7"
                  onClick={() => handleRemoveImage(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
                
                {/* Move right */}
                {index < images.length - 1 && (
                  <Button 
                    size="icon" 
                    variant="secondary" 
                    className="h-7 w-7"
                    onClick={() => handleMove(index, 'right')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {/* Position badge */}
              <Badge 
                className="absolute top-2 left-2 text-xs"
                variant={index === 0 ? "default" : "secondary"}
              >
                {index === 0 ? "Principal" : index + 1}
              </Badge>
            </div>
          ))}
          
          {/* Pending Uploads */}
          {pendingUploads.map((upload, index) => (
            <div 
              key={`pending-${index}`} 
              className="relative group aspect-square rounded-lg overflow-hidden border-2 border-dashed border-primary/50 bg-primary/5"
            >
              <img 
                src={upload.preview} 
                alt={`Upload pendente ${index + 1}`}
                className="w-full h-full object-cover"
              />
              
              {/* Status overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                {upload.status === 'uploading' && (
                  <div className="bg-background/90 rounded-full p-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                {upload.status === 'error' && (
                  <div className="bg-destructive/90 rounded-full p-2">
                    <X className="h-6 w-6 text-destructive-foreground" />
                  </div>
                )}
              </div>
              
              {/* Remove button */}
              {upload.status === 'pending' && (
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemovePending(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              
              <Badge 
                className="absolute top-2 left-2 text-xs"
                variant="outline"
              >
                Pendente
              </Badge>
            </div>
          ))}
          
          {/* Upload Area */}
          <div 
            className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isDragging 
                ? 'border-primary bg-primary/10' 
                : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-xs text-muted-foreground text-center px-2">
              Clique ou arraste
            </span>
            <input 
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </div>
        </div>
        
        {/* URL Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Adicionar imagem por URL..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
              className="pl-9"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={handleAddUrl}
            disabled={!urlInput.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        
        {/* Help text */}
        {images.length === 0 && pendingUploads.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma imagem cadastrada. Faça upload de fotos ou adicione URLs de imagens.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
