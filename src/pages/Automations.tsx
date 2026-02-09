import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgRole } from "@/hooks/useOrgRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Package, TrendingDown, PauseCircle, Clock, AlertTriangle, PackageSearch, ShoppingCart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AutomationRule {
  id: string;
  organization_id: string;
  user_id: string;
  rule_type: string;
  is_active: boolean;
  config: Record<string, number>;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AutomationLog {
  id: string;
  automation_rule_id: string;
  action_taken: string;
  details: Record<string, unknown>;
  created_at: string;
}

const RULE_TYPES = [
  {
    type: "pause_zero_stock",
    title: "Pausa automática de anúncios",
    description: "Quando o estoque de um produto zera, os anúncios nos marketplaces são pausados automaticamente. Quando reposto, são reativados.",
    icon: PauseCircle,
    color: "border-l-red-500",
    iconColor: "text-red-500",
    configFields: [] as { key: string; label: string; placeholder: string; defaultValue: number }[],
  },
  {
    type: "low_stock_alert",
    title: "Alerta de reposição de estoque",
    description: "Receba uma notificação quando qualquer produto atingir o limite mínimo de estoque que você definir.",
    icon: Package,
    color: "border-l-amber-500",
    iconColor: "text-amber-500",
    configFields: [
      { key: "threshold", label: "Alertar quando estoque for menor ou igual a", placeholder: "10", defaultValue: 10 },
    ],
  },
  {
    type: "low_margin_alert",
    title: "Alerta de margem baixa",
    description: "Receba uma notificação quando a margem de lucro de um produto ficar abaixo do percentual que você definir.",
    icon: TrendingDown,
    color: "border-l-orange-500",
    iconColor: "text-orange-500",
    configFields: [
      { key: "min_margin", label: "Alertar quando margem for menor que (%)", placeholder: "15", defaultValue: 15 },
    ],
  },
  {
    type: "stale_tracking",
    title: "Pedido sem rastreio",
    description: "Alerta quando um pedido fica sem código de rastreio por muito tempo. Evita penalizações nos marketplaces por atraso de envio.",
    icon: PackageSearch,
    color: "border-l-blue-500",
    iconColor: "text-blue-500",
    configFields: [
      { key: "hours", label: "Alertar após quantas horas sem rastreio", placeholder: "48", defaultValue: 48 },
    ],
  },
  {
    type: "no_sales_alert",
    title: "Produto sem venda",
    description: "Alerta quando um produto com estoque fica muitos dias sem nenhuma venda. Identifica itens encalhados que ocupam espaço e capital.",
    icon: ShoppingCart,
    color: "border-l-purple-500",
    iconColor: "text-purple-500",
    configFields: [
      { key: "days", label: "Alertar quando ficar sem venda por ___ dias", placeholder: "30", defaultValue: 30 },
    ],
  },
];

const ACTION_LABELS: Record<string, string> = {
  listing_paused: "Anúncio pausado",
  listing_reactivated: "Anúncio reativado",
  low_stock_alert: "Alerta de estoque baixo",
  low_margin_alert: "Alerta de margem baixa",
  stale_tracking_alert: "Pedido sem rastreio",
  no_sales_alert: "Produto sem venda",
};

const Automations = () => {
  const { toast } = useToast();
  const { organizationId } = useOrganization();
  const { canWrite } = useOrgRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch automation rules
  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ["automation-rules", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("organization_id", organizationId);
      if (error) throw error;
      return (data || []) as AutomationRule[];
    },
    enabled: !!organizationId,
  });

  // Fetch automation logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["automation-logs", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("automation_logs")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as AutomationLog[];
    },
    enabled: !!organizationId,
  });

  // Create default rules for missing types
  useEffect(() => {
    if (!rulesLoading && rules && organizationId && user?.id && canWrite) {
      const existingTypes = new Set(rules.map(r => r.rule_type));
      const missingTypes = RULE_TYPES.filter(rt => !existingTypes.has(rt.type));
      
      if (missingTypes.length === 0) return;

      const defaults = missingTypes.map((rt) => ({
        organization_id: organizationId,
        user_id: user.id,
        rule_type: rt.type,
        is_active: false,
        config: rt.configFields.reduce((acc, f) => ({ ...acc, [f.key]: f.defaultValue }), {}),
      }));

      supabase
        .from("automation_rules")
        .insert(defaults)
        .then(({ error }) => {
          if (!error) {
            queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
          }
        });
    }
  }, [rulesLoading, rules, organizationId, user?.id, canWrite, queryClient]);

  // Toggle rule
  const toggleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("automation_rules")
        .update({ is_active: isActive })
        .eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast({
        title: isActive ? "Automação ativada" : "Automação desativada",
        description: isActive
          ? "A regra será verificada periodicamente."
          : "A regra foi desativada com sucesso.",
      });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível atualizar a automação.", variant: "destructive" });
    },
  });

  // Update config
  const configMutation = useMutation({
    mutationFn: async ({ ruleId, config }: { ruleId: string; config: Record<string, number> }) => {
      const { error } = await supabase
        .from("automation_rules")
        .update({ config })
        .eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast({ title: "Configuração salva", description: "O parâmetro foi atualizado." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar a configuração.", variant: "destructive" });
    },
  });

  const getRuleForType = (type: string) => rules?.find((r) => r.rule_type === type);

  const handleConfigChange = (ruleId: string, currentConfig: Record<string, number>, key: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) return;
    configMutation.mutate({ ruleId, config: { ...currentConfig, [key]: numValue } });
  };

  if (rulesLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-8 w-8 text-primary" />
            Automações
          </h1>
          <p className="text-muted-foreground mt-1">Configure regras automáticas para sua operação</p>
        </div>
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Zap className="h-8 w-8 text-primary" />
          Automações
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure regras automáticas para sua operação. Ative ou desative cada automação conforme sua necessidade.
        </p>
      </div>

      {/* Automation Cards */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        {RULE_TYPES.map((ruleType) => {
          const rule = getRuleForType(ruleType.type);
          const Icon = ruleType.icon;

          return (
            <Card key={ruleType.type} className={`border-l-4 ${ruleType.color} relative`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${ruleType.iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{ruleType.title}</CardTitle>
                    </div>
                  </div>
                  <Switch
                    checked={rule?.is_active ?? false}
                    onCheckedChange={(checked) => {
                      if (!canWrite) {
                        toast({ title: "Sem permissão", description: "Apenas admins e operadores podem alterar automações.", variant: "destructive" });
                        return;
                      }
                      if (rule) {
                        toggleMutation.mutate({ ruleId: rule.id, isActive: checked });
                      }
                    }}
                    disabled={!rule || !canWrite || toggleMutation.isPending}
                  />
                </div>
                <CardDescription className="mt-2 text-sm">
                  {ruleType.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Config fields */}
                {ruleType.configFields.map((field) => {
                  const currentValue = (rule?.config as Record<string, number>)?.[field.key] ?? field.defaultValue;
                  return (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={`${ruleType.type}-${field.key}`} className="text-sm text-muted-foreground">
                        {field.label}
                      </Label>
                      <Input
                        id={`${ruleType.type}-${field.key}`}
                        type="number"
                        min={0}
                        value={currentValue}
                        placeholder={field.placeholder}
                        disabled={!canWrite || !rule}
                        className="max-w-[120px]"
                        onChange={(e) => {
                          // We use onBlur for saving
                        }}
                        onBlur={(e) => {
                          if (rule && e.target.value !== String(currentValue)) {
                            handleConfigChange(rule.id, rule.config, field.key, e.target.value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && rule) {
                            handleConfigChange(rule.id, rule.config, field.key, (e.target as HTMLInputElement).value);
                          }
                        }}
                        defaultValue={currentValue}
                      />
                    </div>
                  );
                })}

                {/* Last triggered */}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {rule?.last_triggered_at ? (
                      <span>
                        Última execução:{" "}
                        {formatDistanceToNow(new Date(rule.last_triggered_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    ) : (
                      <span>Nunca executada</span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <Badge variant={rule?.is_active ? "default" : "secondary"} className="text-xs">
                  {rule?.is_active ? "Ativa" : "Inativa"}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Automation Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Histórico de execuções
          </CardTitle>
          <CardDescription>Últimas ações executadas pelas automações</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma ação executada ainda</p>
              <p className="text-sm">Ative uma automação para começar a ver o histórico aqui.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ACTION_LABELS[log.action_taken] || log.action_taken}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {(log.details as Record<string, unknown>)?.product_name
                          ? `${(log.details as Record<string, unknown>).product_name}`
                          : JSON.stringify(log.details)}
                        {(log.details as Record<string, unknown>)?.platform &&
                          ` (${(log.details as Record<string, unknown>).platform})`}
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
};

export default Automations;
