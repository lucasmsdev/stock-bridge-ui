import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import { Campaign, getCampaignStatus } from "./mockAdsData";

interface CampaignPerformanceTableProps {
  campaigns: Campaign[];
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

export function CampaignPerformanceTable({ campaigns }: CampaignPerformanceTableProps) {
  // Sort campaigns by ROAS descending
  const sortedCampaigns = [...campaigns].sort((a, b) => b.roas - a.roas);

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Performance por Campanha
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-6">
          <div className="inline-block min-w-full align-middle px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Conversões</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCampaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      Nenhuma campanha encontrada. Clique em Sincronizar para buscar dados.
                    </TableCell>
                  </TableRow>
                ) : sortedCampaigns.map((campaign) => {
                  const status = getCampaignStatus(campaign.roas);
                  return (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className={`w-3 h-3 rounded-full ${
                              campaign.platform === 'meta_ads' 
                                ? 'bg-blue-500' 
                                : campaign.platform === 'tiktok_ads'
                                ? 'bg-pink-500'
                                : 'bg-green-500'
                            }`}
                          />
                          <span className="text-sm">
                            {campaign.platform === 'meta_ads' ? 'Meta' : campaign.platform === 'tiktok_ads' ? 'TikTok' : 'Google'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{campaign.name}</span>
                          {campaign.status === 'paused' && (
                            <Badge variant="outline" className="text-xs">
                              Pausada
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(campaign.spend)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(campaign.impressions)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(campaign.clicks)}
                      </TableCell>
                      <TableCell className="text-right">
                        {campaign.ctr.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(campaign.conversions)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {campaign.roas.toFixed(1)}x
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={status.variant}>
                          {status.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
