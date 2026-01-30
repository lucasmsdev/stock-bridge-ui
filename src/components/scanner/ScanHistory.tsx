import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, Package, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ScanHistoryItem {
  code: string;
  productName: string | null;
  productId: string | null;
  timestamp: number;
  found: boolean;
}

interface ScanHistoryProps {
  history: ScanHistoryItem[];
  onSelect: (code: string) => void;
  onClear: () => void;
}

export const ScanHistory = ({ history, onSelect, onClear }: ScanHistoryProps) => {
  if (history.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico recente
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-muted-foreground"
            onClick={onClear}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {history.slice(0, 5).map((item, index) => (
            <li key={`${item.code}-${item.timestamp}`}>
              <button
                onClick={() => onSelect(item.code)}
                className="w-full px-4 py-2 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
              >
                <div className={`p-1.5 rounded ${item.found ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Package className={`h-4 w-4 ${item.found ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    item.found ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {item.productName || item.code}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(item.timestamp, { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                {!item.found && (
                  <span className="text-xs text-muted-foreground">
                    Não encontrado
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
