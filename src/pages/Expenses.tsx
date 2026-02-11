import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { ExpensesList } from "@/components/expenses/ExpensesList";
import { ProfitBreakdown } from "@/components/expenses/ProfitBreakdown";
import { ProfitProjection } from "@/components/expenses/ProfitProjection";
import { FinancialSettings, FinancialSettingsData } from "@/components/expenses/FinancialSettings";
import { MonthlyHistoryChart } from "@/components/expenses/MonthlyHistoryChart";
import { Receipt, PlusCircle, PieChart, TrendingUp, Settings, BarChart3 } from "lucide-react";
import { useOrgRole } from "@/hooks/useOrgRole";

export interface Expense {
  id: string;
  user_id: string;
  name: string;
  category: 'fixed' | 'variable' | 'operational';
  amount: number;
  recurrence: 'monthly' | 'weekly' | 'yearly' | 'one-time';
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function Expenses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { canWrite, canDeleteItems } = useOrgRole();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [financialSettings, setFinancialSettings] = useState<FinancialSettingsData>({
    marketplaceFeePercent: 12,
    targetMarginPercent: 30,
  });

  const loadExpenses = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses((data || []) as Expense[]);
    } catch (error: any) {
      console.error('Error loading expenses:', error);
      toast({
        title: "Erro ao carregar despesas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [user]);

  const handleExpenseCreated = () => {
    loadExpenses();
    setEditingExpense(null);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Despesa removida",
        description: "A despesa foi removida com sucesso.",
      });
      loadExpenses();
    } catch (error: any) {
      toast({
        title: "Erro ao remover despesa",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: isActive ? "Despesa desativada" : "Despesa ativada",
        description: `A despesa foi ${isActive ? 'desativada' : 'ativada'} com sucesso.`,
      });
      loadExpenses();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar despesa",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Receipt className="h-8 w-8 text-primary" />
          Centro de Custos
        </h1>
        <p className="text-muted-foreground mt-1">
          Registre suas despesas fixas e variáveis para calcular seu lucro líquido real.
        </p>
      </div>

      <Tabs defaultValue="register" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 max-w-[800px]">
          <TabsTrigger value="register" className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Registrar
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="projection" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Projeção
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Taxas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {canWrite && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {editingExpense ? 'Editar Despesa' : 'Nova Despesa'}
                  </CardTitle>
                  <CardDescription>
                    {editingExpense 
                      ? 'Atualize os dados da despesa abaixo.'
                      : 'Adicione uma nova despesa recorrente ou pontual.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ExpenseForm 
                    expense={editingExpense}
                    onSuccess={handleExpenseCreated}
                    onCancel={() => setEditingExpense(null)}
                  />
                </CardContent>
              </Card>
            )}

            <Card className={!canWrite ? "lg:col-span-2" : ""}>
              <CardHeader>
                <CardTitle>Despesas Cadastradas</CardTitle>
                <CardDescription>
                  {canWrite 
                    ? 'Gerencie suas despesas ativas e inativas.'
                    : 'Visualize as despesas cadastradas.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExpensesList 
                  expenses={expenses}
                  loading={loading}
                  onEdit={canWrite ? handleEditExpense : undefined}
                  onDelete={canDeleteItems ? handleDeleteExpense : undefined}
                  onToggleActive={canWrite ? handleToggleActive : undefined}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overview">
          <ProfitBreakdown 
            expenses={expenses} 
            marketplaceFeePercent={financialSettings.marketplaceFeePercent}
            targetMarginPercent={financialSettings.targetMarginPercent}
          />
        </TabsContent>

        <TabsContent value="history">
          <MonthlyHistoryChart 
            expenses={expenses} 
            marketplaceFeePercent={financialSettings.marketplaceFeePercent}
          />
        </TabsContent>

        <TabsContent value="projection">
          <ProfitProjection 
            expenses={expenses} 
            targetMarginPercent={financialSettings.targetMarginPercent}
          />
        </TabsContent>

        <TabsContent value="settings">
          <FinancialSettings onSettingsChange={setFinancialSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
