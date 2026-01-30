import { Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AmazonLatencyWarningProps {
  type: 'images' | 'stock' | 'general';
}

const messages = {
  images: "Alterações de imagens podem levar até 24-48 horas para aparecer no catálogo da Amazon.",
  stock: "Alterações de preço e estoque podem levar de 15 minutos a 2 horas para refletir.",
  general: "Preço/estoque: 15min-2h. Nome/imagens: até 48h para refletir na Amazon."
};

export const AmazonLatencyWarning = ({ type }: AmazonLatencyWarningProps) => {
  return (
    <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
      <Clock className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        <strong>Importante:</strong> {messages[type]}
      </AlertDescription>
    </Alert>
  );
};
