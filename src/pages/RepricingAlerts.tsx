import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Plus, Trash2, Eye, EyeOff, Loader2, Play } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UpgradeBanner } from "@/components/ui/upgrade-banner";

interface Product {
  id: string;
  name: string;
  sku: string;
  selling_price: number;
}

interface MonitoringJob {
  id: string;
  product_id: string;
  competitor_url: string;
  last_price: number | null;
  trigger_condition: string;
  is_active: boolean;
  created_at: string;
  products: {
    name: string;
    sku: string;
  };
}

export default function RepricingAlerts() {
  // ALL HOOKS MUST BE CALLED FIRST - BEFORE ANY CONDITIONAL RETURNS
  const { hasFeature, isLoading: planLoading } = usePlan();
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [monitoringJobs, setMonitoringJobs] = useState<MonitoringJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Form state
  const [selectedProductId, setSelectedProductId] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [triggerCondition, setTriggerCondition] = useState("price_decrease");

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      
      // Fetch user products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, selling_price')
        .order('name');

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Fetch monitoring jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('price_monitoring_jobs')
        .select(`
          id,
          product_id,
          competitor_url,
          last_price,
          trigger_condition,
          is_active,
          created_at,
          products (
            name,
            sku
          )
        `)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;
      setMonitoringJobs(jobsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast]);

  const createAlert = useCallback(async () => {
    if (!selectedProductId || !competitorUrl || !user?.id) {
      toast({
        title: "Erro",
        description: "Selecione um produto e insira a URL do concorrente.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    try {
      // Call the edge function to create alert with initial price check
      const { data, error } = await supabase.functions.invoke('create-repricing-alert', {
        body: {
          product_id: selectedProductId,
          competitor_url: competitorUrl,
          trigger_condition: triggerCondition
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      // Add the new alert to the state immediately
      if (data?.alert) {
        setMonitoringJobs(prev => [data.alert, ...prev]);
      }

      toast({
        title: "Sucesso!",
        description: "Alerta criado com sucesso! O preço está sendo verificado..."
      });

      setIsDialogOpen(false);
      setSelectedProductId("");
      setCompetitorUrl("");
      setTriggerCondition("price_decrease");
    } catch (error) {
      console.error('Error creating alert:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar alerta.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  }, [selectedProductId, competitorUrl, user?.id, toast, triggerCondition]);

  const toggleAlert = useCallback(async (jobId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('price_monitoring_jobs')
        .update({ is_active: !currentStatus })
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `Alerta ${!currentStatus ? 'ativado' : 'desativado'} com sucesso.`
      });

      fetchData();
    } catch (error) {
      console.error('Error toggling alert:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status do alerta.",
        variant: "destructive"
      });
    }
  }, [toast, fetchData]);

  const deleteAlert = useCallback(async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('price_monitoring_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Alerta excluído com sucesso."
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting alert:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir alerta.",
        variant: "destructive"
      });
    }
  }, [toast, fetchData]);

  const formatUrl = useCallback((url: string) => {
    if (!url) return '';
    return url.length > 50 ? `${url.substring(0, 50)}...` : url;
  }, []);

  const checkPricesManually = useCallback(async () => {
    if (!user?.id) return;
    
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-competitor-prices', {
        body: { source: 'manual' }
      });

      if (error) throw error;

      toast({
        title: "Verificação Concluída!",
        description: `Processados ${data?.processed || 0} alertas. ${data?.triggered_alerts || 0} notificações criadas.`
      });

      // Refresh data to show any updates
      fetchData();
    } catch (error) {
      console.error('Error checking prices manually:', error);
      toast({
        title: "Erro",
        description: "Erro ao verificar preços. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsChecking(false);
    }
  }, [user?.id, toast, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh data every 10 seconds to show price updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Only auto-refresh if user is not currently interacting and there are pending jobs
      if (!isCreating && !isChecking && monitoringJobs.some(job => job.last_price === null)) {
        fetchData();
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [fetchData, isCreating, isChecking, monitoringJobs]);

  // NOW HANDLE CONDITIONAL RETURNS AFTER ALL HOOKS
  // Check access - wait for plan to load
  if (planLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Carregando informações do plano...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show upgrade banner if feature not available
  if (!hasFeature('ReprecificacaoPorAlerta')) {
    return (
      <div className="container mx-auto py-6">
        <div className="max-w-2xl mx-auto">
          <UpgradeBanner
            title="Reprecificação por Alerta"
            description="Esta funcionalidade permite monitorar preços da concorrência e receber alertas automáticos quando há mudanças. Disponível nos planos Competidor e Dominador."
            requiredPlan="competidor"
            feature="ReprecificacaoPorAlerta"
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Carregando dados...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reprecificação por Alerta</h1>
          <p className="text-muted-foreground">
            Monitore preços da concorrência e receba alertas automáticos
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={checkPricesManually}
            disabled={isChecking || monitoringJobs.length === 0}
          >
            {isChecking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Verificar Preços Agora
              </>
            )}
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Criar Novo Alerta
            </Button>
          </DialogTrigger>
           <DialogContent>
             <DialogHeader>
               <DialogTitle>Criar Alerta de Reprecificação</DialogTitle>
               <DialogDescription>
                 Configure um alerta para monitorar automaticamente os preços da concorrência
               </DialogDescription>
             </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="product">Produto</Label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} (SKU: {product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="url">URL do Produto Concorrente</Label>
                <Input
                  id="url"
                  placeholder="https://..."
                  value={competitorUrl}
                  onChange={(e) => setCompetitorUrl(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="trigger">Gatilho</Label>
                <Select value={triggerCondition} onValueChange={setTriggerCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price_decrease">Quando o preço baixar</SelectItem>
                    <SelectItem value="price_increase">Quando o preço subir</SelectItem>
                    <SelectItem value="any_change">Qualquer mudança de preço</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={createAlert} 
                disabled={isCreating || !selectedProductId || !competitorUrl}
                className="w-full"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Salvar Alerta"
                )}
              </Button>
            </div>
           </DialogContent>
         </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Alertas Configurados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monitoringJobs.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum alerta configurado</h3>
              <p className="text-muted-foreground mb-4">
                Você ainda não tem nenhum alerta de preço. Clique em "Criar Novo Alerta" para começar a monitorar a concorrência.
              </p>
              <Button
                onClick={() => setIsDialogOpen(true)}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Alerta
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>URL Concorrente</TableHead>
                    <TableHead>Último Preço</TableHead>
                    <TableHead>Gatilho</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monitoringJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{job.products.name}</div>
                          <div className="text-sm text-muted-foreground">
                            SKU: {job.products.sku}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <a 
                            href={job.competitor_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate block"
                            title={job.competitor_url}
                          >
                            {formatUrl(job.competitor_url)}
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        {job.last_price !== null ? (
                          `R$ ${Number(job.last_price).toFixed(2)}`
                        ) : (
                          <div className="flex items-center space-x-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-muted-foreground">Verificando...</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {job.trigger_condition === 'price_decrease' && 'Preço baixar'}
                          {job.trigger_condition === 'price_increase' && 'Preço subir'}
                          {job.trigger_condition === 'any_change' && 'Qualquer mudança'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={job.is_active ? "default" : "secondary"}>
                          {job.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAlert(job.id, job.is_active)}
                          >
                            {job.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAlert(job.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}