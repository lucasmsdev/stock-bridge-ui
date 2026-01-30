import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Eye, 
  Boxes, 
  Tag,
  AlertTriangle,
  CheckCircle 
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

interface ScanResultProps {
  product: Tables<'products'> | null;
  scannedCode: string;
  isLoading: boolean;
  onAdjustStock: () => void;
  onReprint: () => void;
}

export const ScanResult = ({ 
  product, 
  scannedCode, 
  isLoading,
  onAdjustStock,
  onReprint 
}: ScanResultProps) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-muted rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!product) {
    // Determine if code looks like EAN (8-14 digits) or SKU
    const isEanCode = /^\d{8,14}$/.test(scannedCode);
    
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-destructive">Produto não encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Código escaneado: <span className="font-mono">{scannedCode}</span>
                {isEanCode && <span className="ml-2 text-xs text-muted-foreground">(EAN/GTIN)</span>}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Este código não corresponde a nenhum produto cadastrado.
              </p>
              <Button 
                variant="default" 
                size="sm" 
                className="mt-3"
                onClick={() => navigate('/app/products/new', { 
                  state: isEanCode ? { ean: scannedCode } : { sku: scannedCode } 
                })}
              >
                <Package className="h-4 w-4 mr-2" />
                Cadastrar com este código
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isLowStock = product.stock <= 5;
  const isOutOfStock = product.stock <= 0;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Imagem */}
          <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            {product.image_url ? (
              <img 
                src={product.image_url} 
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <Package className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-foreground truncate">{product.name}</h3>
                <p className="text-sm text-muted-foreground font-mono">
                  SKU: {product.sku}
                </p>
              </div>
              <Badge variant="outline" className="flex items-center gap-1 shrink-0">
                <CheckCircle className="h-3 w-3 text-primary" />
                Encontrado
              </Badge>
            </div>

            {/* Estoque e Preço */}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1">
                <Boxes className="h-4 w-4 text-muted-foreground" />
                <span className={`text-sm font-medium ${
                  isOutOfStock ? 'text-destructive' : 
                  isLowStock ? 'text-warning' : 
                  'text-foreground'
                }`}>
                  {product.stock} un
                </span>
                {isOutOfStock && (
                  <Badge variant="destructive" className="text-xs ml-1">
                    Esgotado
                  </Badge>
                )}
                {isLowStock && !isOutOfStock && (
                  <Badge variant="outline" className="text-xs ml-1 text-warning border-warning">
                    Baixo
                  </Badge>
                )}
              </div>

              {product.selling_price && (
                <span className="text-sm font-medium text-primary">
                  R$ {product.selling_price.toFixed(2)}
                </span>
              )}
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-2 mt-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate(`/app/products/${product.id}`)}
              >
                <Eye className="h-4 w-4 mr-1" />
                Detalhes
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={onAdjustStock}
              >
                <Boxes className="h-4 w-4 mr-1" />
                Estoque
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={onReprint}
              >
                <Tag className="h-4 w-4 mr-1" />
                Etiqueta
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
