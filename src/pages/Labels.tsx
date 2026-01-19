import { Tag } from "lucide-react";
import { LabelGenerator } from "@/components/labels/LabelGenerator";

export default function Labels() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Tag className="h-8 w-8 text-primary" />
          Gerador de Etiquetas
        </h1>
        <p className="text-muted-foreground mt-2">
          Crie etiquetas profissionais para seus produtos com código de barras, preço e logo
        </p>
      </div>

      {/* Label Generator */}
      <LabelGenerator />
    </div>
  );
}
