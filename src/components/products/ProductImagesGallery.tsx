import { useState, useRef, useCallback } from "react";
import { Upload, X, Link as LinkIcon, Plus, Loader2, Save, ImageIcon, GripVertical } from "lucide-react";
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
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Drag-and-drop reorder state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles: PendingUpload[] = [];
    
    for (const file of Array.from(files)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast({
          title: "Formato inválido",
          description: `${file.name} não é uma imagem válida (use JPG, PNG ou WebP)`,
          variant: "destructive",
        });
        continue;
      }
      
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

  // Drag-and-drop reorder handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Add a slight delay to show the drag effect
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOverImage = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDropOnImage = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }
    
    const newImages = [...images];
    const [draggedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(dropIndex, 0, draggedImage);
    
    setImages(newImages);
    setHasChanges(true);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const uploadedUrls = await uploadPendingFiles();
      const allImages = [...images, ...uploadedUrls];
      
      const { error } = await supabase
        .from('products')
        .update({ 
          images: allImages,
          image_url: allImages[0] || null
        })
        .eq('id', productId);
      
      if (error) throw error;
      
      setImages(allImages);
      setPendingUploads([]);
      setHasChanges(false);
      
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

  // File drop zone handlers
  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    // Only trigger file drag if no image is being reordered
    if (draggedIndex === null) {
      setIsDraggingFile(true);
    }
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (draggedIndex === null && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
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
        {/* Drag hint */}
        {images.length > 1 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <GripVertical className="h-3 w-3" />
            Arraste e solte para reordenar. A primeira imagem será a principal.
          </p>
        )}

        {/* Images Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Existing Images */}
          {images.map((url, index) => (
            <div 
              key={`img-${index}`} 
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOverImage(e, index)}
              onDrop={(e) => handleDropOnImage(e, index)}
              className={`relative group aspect-square rounded-lg overflow-hidden border-2 bg-muted cursor-grab active:cursor-grabbing transition-all duration-200 ${
                draggedIndex === index 
                  ? 'opacity-50 scale-95' 
                  : dragOverIndex === index 
                    ? 'border-primary ring-2 ring-primary/50 scale-105' 
                    : 'border-border hover:border-primary/50'
              }`}
            >
              <img 
                src={url} 
                alt={`Imagem ${index + 1}`}
                className="w-full h-full object-cover pointer-events-none"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
              
              {/* Drag handle indicator */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-background/80 rounded-full p-2 shadow-md">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
              
              {/* Delete button */}
              <Button 
                size="icon" 
                variant="destructive" 
                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveImage(index);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
              
              {/* Position badge */}
              <Badge 
                className="absolute top-2 left-2 text-xs pointer-events-none"
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
              isDraggingFile 
                ? 'border-primary bg-primary/10' 
                : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleFileDragOver}
            onDragLeave={handleFileDragLeave}
            onDrop={handleFileDrop}
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
