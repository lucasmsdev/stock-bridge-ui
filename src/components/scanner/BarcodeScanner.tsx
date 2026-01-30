import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SwitchCamera, Camera, CameraOff } from 'lucide-react';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onError?: (error: string) => void;
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
}

export const BarcodeScanner = ({ 
  onDetected, 
  onError, 
  isActive,
  onActiveChange 
}: BarcodeScannerProps) => {
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScannedRef = useRef<string | null>(null);

  // Inicializar lista de câmeras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          setHasPermission(true);
          // Preferir câmera traseira
          const backCameraIndex = devices.findIndex(
            (d) => d.label.toLowerCase().includes('back') || 
                   d.label.toLowerCase().includes('traseira') ||
                   d.label.toLowerCase().includes('rear')
          );
          if (backCameraIndex !== -1) {
            setCurrentCameraIndex(backCameraIndex);
          }
        } else {
          setHasPermission(false);
          onError?.('Nenhuma câmera encontrada');
        }
      })
      .catch((err) => {
        console.error('Erro ao listar câmeras:', err);
        setHasPermission(false);
        onError?.('Não foi possível acessar a câmera. Verifique as permissões.');
      });
  }, [onError]);

  // Controlar scanner
  useEffect(() => {
    if (!isActive || cameras.length === 0) {
      // Parar scanner se desativado
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    const startScanner = async () => {
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
      }

      const scanner = new Html5Qrcode('barcode-scanner-container');
      scannerRef.current = scanner;

      try {
        await scanner.start(
          cameras[currentCameraIndex].id,
          {
            fps: 10,
            qrbox: { width: 280, height: 150 },
            aspectRatio: 1.5,
          },
          (decodedText) => {
            // Evitar scans duplicados em sequência
            if (lastScannedRef.current !== decodedText) {
              lastScannedRef.current = decodedText;
              onDetected(decodedText);
              
              // Vibrar se disponível
              if (navigator.vibrate) {
                navigator.vibrate(100);
              }
              
              // Limpar para permitir novo scan do mesmo código após 3s
              setTimeout(() => {
                lastScannedRef.current = null;
              }, 3000);
            }
          },
          () => {
            // Scan em andamento, sem resultado ainda
          }
        );
      } catch (err: any) {
        console.error('Erro ao iniciar scanner:', err);
        onError?.(err.message || 'Erro ao iniciar scanner');
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isActive, cameras, currentCameraIndex, onDetected, onError]);

  const toggleCamera = () => {
    if (cameras.length > 1) {
      setCurrentCameraIndex((prev) => (prev + 1) % cameras.length);
    }
  };

  const toggleScanner = () => {
    onActiveChange(!isActive);
  };

  if (hasPermission === false) {
    return (
      <Card className="p-6 text-center">
        <CameraOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-medium text-lg mb-2">Câmera não disponível</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Permita o acesso à câmera para escanear códigos de barras.
        </p>
        <Button onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden bg-black relative">
        <div 
          id="barcode-scanner-container" 
          ref={containerRef}
          className="w-full aspect-[4/3] md:aspect-video"
          style={{ minHeight: '250px' }}
        />
        
        {!isActive && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white">
            <Camera className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-sm opacity-70">Clique para iniciar o scanner</p>
          </div>
        )}
      </Card>

      <div className="flex gap-2 justify-center">
        <Button
          onClick={toggleScanner}
          variant={isActive ? 'destructive' : 'default'}
          size="lg"
          className="flex-1 max-w-xs"
        >
          {isActive ? (
            <>
              <CameraOff className="h-5 w-5 mr-2" />
              Parar Scanner
            </>
          ) : (
            <>
              <Camera className="h-5 w-5 mr-2" />
              Iniciar Scanner
            </>
          )}
        </Button>

        {cameras.length > 1 && isActive && (
          <Button
            onClick={toggleCamera}
            variant="outline"
            size="lg"
          >
            <SwitchCamera className="h-5 w-5" />
          </Button>
        )}
      </div>

      {isActive && (
        <p className="text-center text-sm text-muted-foreground">
          Aponte a câmera para o código de barras da etiqueta
        </p>
      )}
    </div>
  );
};
