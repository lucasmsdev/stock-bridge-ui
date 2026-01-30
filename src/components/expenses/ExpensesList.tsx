import { Expense } from "@/pages/Expenses";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Pencil, 
  Trash2, 
  Loader2,
  Building,
  TrendingUp,
  Package
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ExpensesListProps {
  expenses: Expense[];
  loading: boolean;
  onEdit?: (expense: Expense) => void;
  onDelete?: (id: string) => void;
  onToggleActive?: (id: string, isActive: boolean) => void;
}

const categoryConfig = {
  fixed: { 
    label: 'Fixo', 
    icon: Building, 
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
  },
  variable: { 
    label: 'Variável', 
    icon: TrendingUp, 
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' 
  },
  operational: { 
    label: 'Operacional', 
    icon: Package, 
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' 
  },
};

const recurrenceLabels = {
  monthly: 'Mensal',
  weekly: 'Semanal',
  yearly: 'Anual',
  'one-time': 'Único',
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function ExpensesList({ 
  expenses, 
  loading, 
  onEdit, 
  onDelete,
  onToggleActive 
}: ExpensesListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Nenhuma despesa cadastrada ainda.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Use o formulário ao lado para adicionar sua primeira despesa.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-3">
        {expenses.map((expense) => {
          const config = categoryConfig[expense.category];
          const CategoryIcon = config.icon;
          
          return (
            <div
              key={expense.id}
              className={`p-4 rounded-lg border bg-card transition-opacity ${
                expense.is_active ? 'opacity-100' : 'opacity-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <CategoryIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground truncate">
                        {expense.name}
                      </h4>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {recurrenceLabels[expense.recurrence]}
                      </Badge>
                    </div>
                    <p className="text-lg font-semibold text-primary mt-1">
                      {formatCurrency(expense.amount)}
                    </p>
                    {expense.notes && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {expense.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onToggleActive && (
                    <Switch
                      checked={expense.is_active}
                      onCheckedChange={() => onToggleActive(expense.id, expense.is_active)}
                      aria-label="Ativar/desativar despesa"
                    />
                  )}
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(expense)}
                      className="h-8 w-8"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover despesa?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A despesa "{expense.name}" 
                            será permanentemente removida.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDelete(expense.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
