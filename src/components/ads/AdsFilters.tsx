import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import { AdsPlatform } from "./mockAdsData";

export type AdsPeriod = '7days' | '30days' | '90days';

interface AdsFiltersProps {
  platform: AdsPlatform;
  period: AdsPeriod;
  onPlatformChange: (platform: AdsPlatform) => void;
  onPeriodChange: (period: AdsPeriod) => void;
  onClear: () => void;
}

export function AdsFilters({
  platform,
  period,
  onPlatformChange,
  onPeriodChange,
  onClear,
}: AdsFiltersProps) {
  const isFiltered = platform !== 'all' || period !== '30days';

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Filtros:</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Select value={platform} onValueChange={(v) => onPlatformChange(v as AdsPlatform)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Plataforma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Plataformas</SelectItem>
            <SelectItem value="meta_ads">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                Meta Ads
              </div>
            </SelectItem>
            <SelectItem value="google_ads">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                Google Ads
              </div>
            </SelectItem>
            <SelectItem value="tiktok_ads">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-pink-500" />
                TikTok Ads
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={(v) => onPeriodChange(v as AdsPeriod)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Últimos 7 dias</SelectItem>
            <SelectItem value="30days">Últimos 30 dias</SelectItem>
            <SelectItem value="90days">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>

        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-9 px-2">
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
