import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { ScanResult } from '@/components/scanner/ScanResult';
import { ScanHistory, ScanHistoryItem } from '@/components/scanner/ScanHistory';
import { QuickStockAdjust } from '@/components/scanner/QuickStockAdjust';
import { supabase } from '@/integrations/supabase/client';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

const HISTORY_KEY = 'unistock_scan_history';
const MAX_HISTORY = 10;

const Scanner = () => {
  const { user } = useAuthSession({ requireAuth: true });
  const { toast } = useToast();
  const navigate = useNavigate();
  
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
      // Primeiro tenta buscar por SKU
      let { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .eq('sku', code)
        .maybeSingle();

      // Se não encontrar, tenta por EAN
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

      // Adicionar ao histórico
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
    // Pausar scanner ao detectar
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

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Scanner de Produtos</h1>
        <p className="text-muted-foreground">
          Escaneie o código de barras das etiquetas UNISTOCK
        </p>
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

      {/* Modal de ajuste de estoque */}
      {product && (
        <QuickStockAdjust
          product={product}
          isOpen={showStockAdjust}
          onClose={() => setShowStockAdjust(false)}
          onSuccess={() => {
            // Re-buscar produto para atualizar dados
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
