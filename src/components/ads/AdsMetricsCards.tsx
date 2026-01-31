import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, 
  Eye, 
  MousePointerClick, 
  Percent, 
  Target, 
  TrendingUp,
  Wallet,
  BarChart3
} from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
}

function MetricCard({ title, value, change, changeType = 'neutral', icon }: MetricCardProps) {
  const changeColor = {
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-muted-foreground',
  }[changeType];

  return (
    <Card className="shadow-soft hover:shadow-medium transition-all duration-200 hover:scale-[1.02]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className={`text-xs mt-1 ${changeColor}`}>
            {change} vs mês anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface AdsMetricsCardsProps {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  cpc: number;
  costPerConversion: number;
  roas: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('pt-BR').format(value);
};

export function AdsMetricsCards({
  spend,
  impressions,
  clicks,
  ctr,
  conversions,
  cpc,
  costPerConversion,
  roas,
}: AdsMetricsCardsProps) {
  const metrics = [
    {
      title: 'Gasto Total',
      value: formatCurrency(spend),
      change: '+12%',
      changeType: 'negative' as const,
      icon: <DollarSign className="h-4 w-4 text-red-500" />,
    },
    {
      title: 'Impressões',
      value: formatNumber(impressions),
      change: '+8%',
      changeType: 'positive' as const,
      icon: <Eye className="h-4 w-4 text-blue-500" />,
    },
    {
      title: 'Cliques',
      value: formatNumber(clicks),
      change: '+15%',
      changeType: 'positive' as const,
      icon: <MousePointerClick className="h-4 w-4 text-primary" />,
    },
    {
      title: 'CTR Médio',
      value: `${ctr.toFixed(2)}%`,
      change: '+0.2%',
      changeType: 'positive' as const,
      icon: <Percent className="h-4 w-4 text-purple-500" />,
    },
    {
      title: 'Conversões',
      value: formatNumber(conversions),
      change: '+23%',
      changeType: 'positive' as const,
      icon: <Target className="h-4 w-4 text-emerald-500" />,
    },
    {
      title: 'CPC Médio',
      value: formatCurrency(cpc),
      change: '-5%',
      changeType: 'positive' as const,
      icon: <Wallet className="h-4 w-4 text-amber-500" />,
    },
    {
      title: 'Custo por Conversão',
      value: formatCurrency(costPerConversion),
      change: '-8%',
      changeType: 'positive' as const,
      icon: <BarChart3 className="h-4 w-4 text-indigo-500" />,
    },
    {
      title: 'ROAS',
      value: `${roas.toFixed(1)}x`,
      change: '+0.4x',
      changeType: 'positive' as const,
      icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.title} {...metric} />
      ))}
    </div>
  );
}
