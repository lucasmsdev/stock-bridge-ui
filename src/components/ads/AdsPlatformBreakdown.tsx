import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer, ChartTooltip, ChartConfig,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

interface PlatformData {
  platform: string;
  spend: number;
  percentage: number;
  color: string;
}

interface AdsPlatformBreakdownProps {
  data: PlatformData[];
}

const chartConfig = {
  meta: { label: "Meta Ads", color: "hsl(214, 89%, 52%)" },
  google: { label: "Google Ads", color: "hsl(142, 71%, 45%)" },
  tiktok: { label: "TikTok Ads", color: "hsl(349, 100%, 50%)" },
  mercadolivre: { label: "Mercado Livre Ads", color: "hsl(54, 100%, 50%)" },
  shopee: { label: "Shopee Ads", color: "hsl(14, 85%, 55%)" },
  amazon: { label: "Amazon Ads", color: "hsl(36, 100%, 50%)" },
  magalu: { label: "Magalu Ads", color: "hsl(210, 100%, 50%)" },
  tiktokshop: { label: "TikTok Shop Ads", color: "hsl(174, 90%, 55%)" },
} satisfies ChartConfig;

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function AdsPlatformBreakdown({ data }: AdsPlatformBreakdownProps) {
  const totalSpend = data.reduce((sum, d) => sum + d.spend, 0);

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-primary" />
          Distribuição por Plataforma
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="spend" nameKey="platform">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload as PlatformData;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-md">
                        <p className="font-medium mb-1">{d.platform}</p>
                        <p className="text-sm text-muted-foreground">
                          Gasto: <span className="font-medium text-foreground">{formatCurrency(d.spend)}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Percentual: <span className="font-medium text-foreground">{d.percentage.toFixed(1)}%</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ChartContainer>
        </div>
        
        <div className="mt-4 space-y-3">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Gasto Total</p>
            <p className="text-2xl font-bold">{formatCurrency(totalSpend)}</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {data.map((item) => (
              <div key={item.platform} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.platform}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(item.spend)} ({item.percentage.toFixed(0)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
