
# Plano: Adicionar Aviso de Latência da Amazon no Frontend

## Contexto

Os logs confirmam que **todas as sincronizações estão funcionando** (preço, nome, estoque e imagens). A Amazon retorna `status: "ACCEPTED"` para todas as operações. O problema é que o usuário não sabe que a Amazon leva tempo para processar:

- **15 min a 2 horas**: Preço e Estoque
- **24 a 48 horas**: Nome e Imagens

## Solucao

Adicionar avisos visuais no frontend informando sobre os tempos de processamento da Amazon, para que o usuario entenda que "ACCEPTED" nao significa "visivel imediatamente".

## Implementacao

### Arquivo 1: `src/components/products/MarketplaceImagesCard.tsx`

Adicionar um alerta informativo na aba Amazon explicando o delay:

```typescript
{activeTab === 'amazon' && (
  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
    <div className="flex items-start gap-2">
      <Clock className="h-4 w-4 text-amber-600 mt-0.5" />
      <div className="text-sm text-amber-800 dark:text-amber-200">
        <strong>Importante:</strong> Alteracoes de imagens na Amazon podem levar 
        ate 24-48 horas para aparecer no catalogo publico, mesmo apos a sincronizacao 
        ser aceita com sucesso.
      </div>
    </div>
  </div>
)}
```

### Arquivo 2: `src/pages/ProductDetails.tsx`

Apos sincronizacao com Amazon bem-sucedida, mostrar toast informativo:

```typescript
// Quando syncResult.platform === 'amazon' && syncResult.success
toast({
  title: "Amazon sincronizado",
  description: "Preco/estoque: 15min-2h. Nome/imagens: ate 48h para refletir.",
  variant: "default",
});
```

### Arquivo 3: Criar componente `src/components/amazon/AmazonLatencyWarning.tsx`

Componente reutilizavel para exibir o aviso de latencia:

```typescript
import { Clock, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AmazonLatencyWarningProps {
  type: 'images' | 'stock' | 'general';
}

export const AmazonLatencyWarning = ({ type }: AmazonLatencyWarningProps) => {
  const messages = {
    images: "Alteracoes de imagens podem levar ate 24-48 horas para aparecer no catalogo.",
    stock: "Alteracoes de preco e estoque podem levar ate 15 minutos a 2 horas.",
    general: "Preco/estoque: 15min-2h. Nome/imagens: ate 48h para refletir na Amazon."
  };

  return (
    <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200">
      <Clock className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        {messages[type]}
      </AlertDescription>
    </Alert>
  );
};
```

## Onde Exibir os Avisos

| Local | Tipo de Aviso |
|-------|---------------|
| Aba Amazon em MarketplaceImagesCard | `type="images"` |
| Toast apos salvar produto com Amazon | `type="general"` |
| Dialogo de sincronizacao Amazon | `type="general"` |

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/components/amazon/AmazonLatencyWarning.tsx` | **Criar** - Componente de aviso |
| `src/components/products/MarketplaceImagesCard.tsx` | Adicionar aviso na aba Amazon |
| `src/pages/ProductDetails.tsx` | Melhorar toast de sucesso Amazon |

## Resultado Esperado

O usuario vera claramente que:
1. A sincronizacao foi **aceita** pela Amazon
2. Mas pode levar **tempo** para aparecer no site publico
3. Isso e **comportamento normal** da Amazon, nao um erro do sistema
