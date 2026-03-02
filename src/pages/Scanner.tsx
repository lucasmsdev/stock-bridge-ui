import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { ScanResult } from '@/components/scanner/ScanResult';
import { ScanHistory, ScanHistoryItem } from '@/components/scanner/ScanHistory';
import { QuickStockAdjust } from '@/components/scanner/QuickStockAdjust';
import { supabase } from '@/integrations/supabase/client';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PackagePlus, ShoppingCart, ArrowLeft, ScanBarcode } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

export type ScanMode = 'add' | 'sell';

const HISTORY_KEY = 'unistock_scan_history';
const MAX_HISTORY = 10;

const Scanner = () => {
  const { user } = useAuthSession({ requireAuth: true });
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [scanMode, setScanMode] = useState<ScanMode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [product, setProduct] = useState<Tables<'products'> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [showStockAdjust, setShowStockAdjust] = useState(false);

  // Carregar histórico do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Erro ao carregar histórico:', e);
    }
  }, []);

  // Salvar histórico no localStorage
  const saveHistory = useCallback((newHistory: ScanHistoryItem[]) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory.slice(0, MAX_HISTORY)));
    } catch (e) {
      console.error('Erro ao salvar histórico:', e);
    }
  }, []);

  // Buscar produto pelo código
  const searchProduct = useCallback(async (code: string) => {
    if (!user?.id) return;
    
    setIsLoading(true);
    setScannedCode(code);
    setProduct(null);

    try {
      let { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .eq('sku', code)
        .maybeSingle();

      if (!productData) {
        const { data: productByEan } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', user.id)
          .eq('ean', code)
          .maybeSingle();
        
        productData = productByEan;
      }

      setProduct(productData);

      const historyItem: ScanHistoryItem = {
        code,
        productName: productData?.name || null,
        productId: productData?.id || null,
        timestamp: Date.now(),
        found: !!productData,
      };

      const newHistory = [historyItem, ...history.filter(h => h.code !== code)];
      setHistory(newHistory);
      saveHistory(newHistory);

      if (!productData) {
        toast({
          title: 'Produto não encontrado',
          description: `O código "${code}" não está cadastrado.`,
          variant: 'destructive',
        });
      } else {
        // Abrir ajuste de estoque automaticamente ao encontrar produto
        setShowStockAdjust(true);
      }
    } catch (error) {
      console.error('Erro ao buscar produto:', error);
      toast({
        title: 'Erro na busca',
        description: 'Não foi possível buscar o produto.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, history, saveHistory, toast]);

  const handleDetected = useCallback((code: string) => {
    setIsScanning(false);
    searchProduct(code);
  }, [searchProduct]);

  const handleError = useCallback((error: string) => {
    toast({
      title: 'Erro no scanner',
      description: error,
      variant: 'destructive',
    });
  }, [toast]);

  const handleHistorySelect = (code: string) => {
    searchProduct(code);
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    toast({
      title: 'Histórico limpo',
      description: 'O histórico de scans foi apagado.',
    });
  };

  const handleReprint = () => {
    if (product) {
      navigate('/app/labels', { state: { preSelectedProduct: product } });
    }
  };

  const handleBack = () => {
    setScanMode(null);
    setIsScanning(false);
    setScannedCode(null);
    setProduct(null);
  };

  // Tela de seleção de modo
  if (!scanMode) {
    return (
      <div className="container mx-auto p-4 max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scanner de Produtos</h1>
          <p className="text-muted-foreground">
            Escolha o que deseja fazer antes de escanear
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card 
            className="cursor-pointer border-2 border-transparent hover:border-primary/50 transition-all hover:shadow-md group"
            onClick={() => setScanMode('add')}
          >
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <PackagePlus className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Adicionar produto</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Recebeu mercadoria? Escaneie para dar entrada no estoque.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer border-2 border-transparent hover:border-primary/50 transition-all hover:shadow-md group"
            onClick={() => setScanMode('sell')}
          >
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <ShoppingCart className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Vendi um produto</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Fez uma venda? Escaneie para dar baixa no estoque.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Histórico sempre visível */}
        <ScanHistory
          history={history}
          onSelect={(code) => {
            setScanMode('add');
            setTimeout(() => searchProduct(code), 100);
          }}
          onClear={handleClearHistory}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-6">
      {/* Header com modo ativo */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              {scanMode === 'add' ? 'Entrada de Estoque' : 'Saída por Venda'}
            </h1>
          </div>
          <p className="text-muted-foreground flex items-center gap-1.5">
            <ScanBarcode className="h-4 w-4" />
            {scanMode === 'add' 
              ? 'Escaneie para adicionar ao estoque' 
              : 'Escaneie para dar baixa no estoque'
            }
          </p>
        </div>
      </div>

      {/* Badge do modo */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
        scanMode === 'add' 
          ? 'bg-primary/10 text-primary' 
          : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
      }`}>
        {scanMode === 'add' ? (
          <><PackagePlus className="h-4 w-4" /> Modo: Entrada</>
        ) : (
          <><ShoppingCart className="h-4 w-4" /> Modo: Venda</>
        )}
      </div>

      {/* Scanner */}
      <BarcodeScanner
        isActive={isScanning}
        onActiveChange={setIsScanning}
        onDetected={handleDetected}
        onError={handleError}
      />

      {/* Resultado do scan */}
      {(scannedCode || isLoading) && (
        <ScanResult
          product={product}
          scannedCode={scannedCode || ''}
          isLoading={isLoading}
          onAdjustStock={() => setShowStockAdjust(true)}
          onReprint={handleReprint}
        />
      )}

      {/* Histórico */}
      <ScanHistory
        history={history}
        onSelect={handleHistorySelect}
        onClear={handleClearHistory}
      />

      {/* Modal de ajuste de estoque com modo pré-selecionado */}
      {product && (
        <QuickStockAdjust
          product={product}
          isOpen={showStockAdjust}
          onClose={() => setShowStockAdjust(false)}
          defaultMode={scanMode}
          onSuccess={() => {
            if (scannedCode) {
              searchProduct(scannedCode);
            }
          }}
        />
      )}
    </div>
  );
};

export default Scanner;
