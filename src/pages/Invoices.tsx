import { FileText, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Invoices = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
          <FileText className="w-12 h-12 text-muted-foreground" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-background">
          <Lock className="w-5 h-5 text-primary" />
        </div>
      </div>

      <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
        Em breve
      </Badge>

      <h1 className="text-2xl font-bold text-foreground mb-2">
        Emissão de Notas Fiscais
      </h1>
      <p className="text-muted-foreground max-w-md">
        Em breve você poderá emitir notas fiscais diretamente pelo UniStock, sem precisar de outro sistema.
      </p>
    </div>
  );
};

export default Invoices;
