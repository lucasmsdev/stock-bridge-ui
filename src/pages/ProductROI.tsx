import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductROI } from "@/hooks/useProductROI";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Package,
  Search,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  RefreshCcw
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export default function ProductROI() {
  const { roiData, summary, isLoading, refetch } = useProductROI();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<'roas' | 'revenue' | 'spend'>('roas');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const navigate = useNavigate();

  const filteredData = roiData
    .filter(p => 
      p.product_name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = sortBy === 'roas' ? a.roas : sortBy === 'revenue' ? a.total_attributed_revenue : a.total_attributed_spend;
      const bVal = sortBy === 'roas' ? b.roas : sortBy === 'revenue' ? b.total_attributed_revenue : b.total_attributed_spend;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

  const toggleSort = (field: 'roas' | 'revenue' | 'spend') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getRoasStatus = (roas: number) => {
    if (roas >= 3) return { variant: 'default' as const, label: 'Excelente', icon: CheckCircle, color: 'text-primary' };
    if (roas >= 1.5) return { variant: 'secondary' as const, label: 'Bom', icon: TrendingUp, color: 'text-secondary-foreground' };
    if (roas >= 1) return { variant: 'outline' as const, label: 'Neutro', icon: Target, color: 'text-muted-foreground' };
    return { variant: 'destructive' as const, label: 'Prejuízo', icon: AlertTriangle, color: 'text-destructive' };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análise de ROI por Produto</h1>
          <p className="text-muted-foreground">
            Visualize o retorno real dos seus investimentos em anúncios por SKU
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Atribuída</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {summary.totalOrders} pedidos atribuídos
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto com Ads</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalSpend)}</div>
            <p className="text-xs text-muted-foreground">
              Investimento total atribuído
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROAS Médio</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.averageRoas.toFixed(2)}x</div>
            <p className="text-xs text-muted-foreground">
              Retorno médio sobre investimento
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos Lucrativos</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.profitableProducts}/{summary.profitableProducts + summary.unprofitableProducts}
            </div>
            <p className="text-xs text-muted-foreground">
              Produtos com ROAS ≥ 1.0
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Best/Worst Products */}
      {(summary.bestProduct || summary.worstProduct) && (
        <div className="grid gap-4 md:grid-cols-2">
          {summary.bestProduct && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Melhor Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{summary.bestProduct.product_name}</p>
                    <p className="text-sm text-muted-foreground">SKU: {summary.bestProduct.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{summary.bestProduct.roas.toFixed(2)}x</p>
                    <p className="text-sm text-muted-foreground">ROAS</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {summary.worstProduct && summary.worstProduct.roas < 1 && (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  Precisa Atenção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{summary.worstProduct.product_name}</p>
                    <p className="text-sm text-muted-foreground">SKU: {summary.worstProduct.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-destructive">{summary.worstProduct.roas.toFixed(2)}x</p>
                    <p className="text-sm text-muted-foreground">ROAS</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Table */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                ROI por Produto
              </CardTitle>
              <CardDescription>
                Clique em um produto para ver detalhes e vincular campanhas
              </CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum dado de ROI encontrado</h3>
              <p className="text-sm text-muted-foreground max-w-md mt-2">
                Para ver análises de ROI, vincule suas campanhas de anúncios aos produtos e processe as atribuições de vendas.
              </p>
              <Button 
                className="mt-4" 
                variant="outline"
                onClick={() => navigate('/app/integrations')}
              >
                Ir para Integrações
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleSort('revenue')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Receita
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleSort('spend')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Gasto Ads
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">CPA</TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleSort('roas')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        ROAS
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((product) => {
                    const status = getRoasStatus(product.roas);
                    const StatusIcon = status.icon;
                    return (
                      <TableRow 
                        key={product.product_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/app/products/${product.product_id}`)}
                      >
                        <TableCell className="font-medium">{product.product_name}</TableCell>
                        <TableCell className="text-muted-foreground">{product.sku}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(product.total_attributed_revenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(product.total_attributed_spend)}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.total_attributed_units}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(product.cost_per_acquisition)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {product.roas.toFixed(2)}x
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className={`h-3 w-3 ${status.color}`} />
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
