import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Line, ComposedChart, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

interface DailyData {
  date: string;
  displayDate: string;
  spend: number;
  conversions: number;
}

interface AdsPerformanceChartProps {
  data: DailyData[];
}

const chartConfig = {
  spend: {
    label: "Gasto",
    color: "hsl(var(--primary))",
  },
  conversions: {
    label: "Conversões",
    color: "hsl(142.1 76.2% 36.3%)",
  },
} satisfies ChartConfig;

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export function AdsPerformanceChart({ data }: AdsPerformanceChartProps) {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Gasto x Conversões
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-8">
        <div className="h-[300px] w-full">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <ComposedChart
              data={data}
              margin={{ top: 20, right: 30, left: 0, bottom: 40 }}
            >
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="displayDate" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `R$${(value / 1).toFixed(0)}`}
                width={60}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-md">
                        <p className="font-medium mb-2">{label}</p>
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">
                            Gasto: <span className="font-medium text-primary">{formatCurrency(payload[0]?.value as number)}</span>
                          </p>
                          <p className="text-muted-foreground">
                            Conversões: <span className="font-medium text-emerald-500">{payload[1]?.value}</span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                yAxisId="left"
                type="monotone"
                dataKey="spend" 
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#spendGradient)"
              />
              <Line 
                yAxisId="right"
                type="monotone"
                dataKey="conversions" 
                stroke="hsl(142.1 76.2% 36.3%)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
        </div>
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Gasto (R$)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm text-muted-foreground">Conversões</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
