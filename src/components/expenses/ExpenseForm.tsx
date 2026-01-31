import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Expense } from "@/pages/Expenses";
import { Loader2 } from "lucide-react";

interface ExpenseFormProps {
  expense?: Expense | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const categoryLabels = {
  fixed: 'Fixo (Aluguel, Salários, Software)',
  variable: 'Variável (Marketing, Comissões)',
  operational: 'Operacional (Embalagens, Materiais)',
};

const recurrenceLabels = {
  monthly: 'Mensal',
  weekly: 'Semanal',
  yearly: 'Anual',
  'one-time': 'Único',
};

export function ExpenseForm({ expense, onSuccess, onCancel }: ExpenseFormProps) {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'fixed' as 'fixed' | 'variable' | 'operational',
    amount: '',
    recurrence: 'monthly' as 'monthly' | 'weekly' | 'yearly' | 'one-time',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    notes: '',
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        name: expense.name,
        category: expense.category,
        amount: expense.amount.toString(),
        recurrence: expense.recurrence,
        start_date: expense.start_date,
        end_date: expense.end_date || '',
        notes: expense.notes || '',
      });
    } else {
      setFormData({
        name: '',
        category: 'fixed',
        amount: '',
        recurrence: 'monthly',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        notes: '',
      });
    }
  }, [expense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.name.trim() || !formData.amount) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e o valor da despesa.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(formData.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Valor inválido",
        description: "O valor deve ser um número positivo.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const expenseData = {
        user_id: user.id,
        organization_id: organizationId,
        name: formData.name.trim(),
        category: formData.category,
        amount,
        recurrence: formData.recurrence,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        notes: formData.notes.trim() || null,
      };

      if (expense) {
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', expense.id);

        if (error) throw error;

        toast({
          title: "Despesa atualizada",
          description: "Os dados foram salvos com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert(expenseData);

        if (error) throw error;

        toast({
          title: "Despesa cadastrada",
          description: "A despesa foi adicionada com sucesso.",
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving expense:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome da Despesa *</Label>
        <Input
          id="name"
          placeholder="Ex: Aluguel, Internet, Funcionário..."
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Categoria *</Label>
          <Select
            value={formData.category}
            onValueChange={(value: 'fixed' | 'variable' | 'operational') => 
              setFormData({ ...formData, category: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixo</SelectItem>
              <SelectItem value="variable">Variável</SelectItem>
              <SelectItem value="operational">Operacional</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Valor (R$) *</Label>
          <Input
            id="amount"
            type="text"
            placeholder="0,00"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="recurrence">Recorrência *</Label>
          <Select
            value={formData.recurrence}
            onValueChange={(value: 'monthly' | 'weekly' | 'yearly' | 'one-time') => 
              setFormData({ ...formData, recurrence: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
              <SelectItem value="one-time">Único</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="start_date">Data Início *</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="end_date">Data Fim (opcional)</Label>
        <Input
          id="end_date"
          type="date"
          value={formData.end_date}
          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          placeholder="Detalhes adicionais..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {expense ? 'Atualizar' : 'Cadastrar'}
        </Button>
        {expense && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
