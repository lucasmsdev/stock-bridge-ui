import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Filter, Calendar as CalendarIcon, Store, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface DashboardFiltersState {
  marketplace: string;
  period: string;
  startDate?: Date;
  endDate?: Date;
}

interface DashboardFiltersProps {
  onApply: (filters: DashboardFiltersState) => void;
  onClear: () => void;
  isLoading?: boolean;
}

const marketplaces = [
  { value: "all", label: "Todos os Marketplaces" },
  { value: "mercadolivre", label: "Mercado Livre" },
  { value: "shopee", label: "Shopee" },
  { value: "amazon", label: "Amazon" },
  { value: "shopify", label: "Shopify" },
];

const periods = [
  { value: "today", label: "Hoje" },
  { value: "7days", label: "Últimos 7 dias" },
  { value: "30days", label: "Últimos 30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "custom", label: "Personalizado" },
];

export default function DashboardFilters({ onApply, onClear, isLoading }: DashboardFiltersProps) {
  const [marketplace, setMarketplace] = useState("all");
  const [period, setPeriod] = useState("7days");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const handleApply = () => {
    if (period === "custom" && (!startDate || !endDate)) {
      return; // Validação: datas são obrigatórias para período personalizado
    }
    
    if (startDate && endDate && startDate > endDate) {
      return; // Validação: data inicial não pode ser posterior à final
    }

    onApply({
      marketplace,
      period,
      startDate: period === "custom" ? startDate : undefined,
      endDate: period === "custom" ? endDate : undefined,
    });
  };

  const handleClear = () => {
    setMarketplace("all");
    setPeriod("7days");
    setStartDate(undefined);
    setEndDate(undefined);
    onClear();
  };

  const hasActiveFilters = marketplace !== "all" || period !== "7days";
  const isCustomPeriod = period === "custom";
  const isValidCustomPeriod = !isCustomPeriod || (startDate && endDate && startDate <= endDate);

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Filtros</h3>
        {hasActiveFilters && (
          <Badge variant="secondary" className="ml-2">
            Filtros ativos
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Filtro de Marketplace */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Store className="h-4 w-4" />
            Marketplace
          </label>
          <Select value={marketplace} onValueChange={setMarketplace}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {marketplaces.map((mp) => (
                <SelectItem key={mp.value} value={mp.value}>
                  {mp.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro de Período */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Período
          </label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Data Inicial (apenas para período personalizado) */}
        {isCustomPeriod && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Data Inicial</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP", { locale: ptBR }) : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Data Final (apenas para período personalizado) */}
        {isCustomPeriod && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Data Final</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP", { locale: ptBR }) : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  disabled={(date) => startDate ? date < startDate : false}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Botões de Ação */}
      <div className="flex items-center gap-3 mt-6">
        <Button
          onClick={handleApply}
          disabled={isLoading || !isValidCustomPeriod}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Aplicar Filtros
        </Button>
        
        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={handleClear}
            disabled={isLoading}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>

      {/* Badges de Filtros Ativos */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          {marketplace !== "all" && (
            <Badge variant="secondary" className="gap-1">
              <Store className="h-3 w-3" />
              {marketplaces.find((m) => m.value === marketplace)?.label}
            </Badge>
          )}
          {period !== "7days" && (
            <Badge variant="secondary" className="gap-1">
              <CalendarIcon className="h-3 w-3" />
              {periods.find((p) => p.value === period)?.label}
              {isCustomPeriod && startDate && endDate && (
                <span className="ml-1">
                  ({format(startDate, "dd/MM", { locale: ptBR })} - {format(endDate, "dd/MM", { locale: ptBR })})
                </span>
              )}
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}
