import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useCampaignLinks } from "@/hooks/useCampaignLinks";
import { Link, Loader2, Megaphone, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CampaignLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productSku: string;
  productName: string;
}

export function CampaignLinkDialog({
  open,
  onOpenChange,
  productId,
  productSku,
  productName,
}: CampaignLinkDialogProps) {
  const { availableCampaigns, createLink, isLoading } = useCampaignLinks(productId);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const selectedCampaignData = availableCampaigns.find(
    c => c.campaign_id === selectedCampaign
  );

  const handleSubmit = () => {
    if (!selectedCampaign || !selectedCampaignData) return;

    createLink.mutate({
      campaign_id: selectedCampaign,
      campaign_name: selectedCampaignData.campaign_name,
      platform: selectedCampaignData.platform,
      product_id: productId,
      sku: productSku,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setSelectedCampaign("");
        setStartDate("");
        setEndDate("");
      },
    });
  };

  const getPlatformLabel = (platform: string) => {
    switch (platform) {
      case 'meta_ads': return 'Meta Ads';
      case 'google_ads': return 'Google Ads';
      case 'tiktok_ads': return 'TikTok Ads';
      case 'mercadolivre_ads': return 'Mercado Livre Ads';
      default: return platform;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5 text-primary" />
            Vincular Campanha ao Produto
          </DialogTitle>
          <DialogDescription>
            Associe uma campanha de anúncios a <strong>{productName}</strong> para rastrear o ROI real deste produto.
          </DialogDescription>
        </DialogHeader>

        {availableCampaigns.length === 0 && !isLoading && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma campanha encontrada. Sincronize seus dados de anúncios primeiro na página de Integrações.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="product">Produto</Label>
            <Input
              id="product"
              value={`${productSku} - ${productName}`}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign">Campanha de Anúncios</Label>
            <Select
              value={selectedCampaign}
              onValueChange={setSelectedCampaign}
              disabled={isLoading || availableCampaigns.length === 0}
            >
              <SelectTrigger id="campaign">
                <SelectValue placeholder="Selecione uma campanha" />
              </SelectTrigger>
              <SelectContent>
                {availableCampaigns.map(campaign => (
                  <SelectItem key={campaign.campaign_id} value={campaign.campaign_id}>
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-muted-foreground" />
                      <span>{campaign.campaign_name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({getPlatformLabel(campaign.platform)})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Início (opcional)</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Fim (opcional)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {selectedCampaignData && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="text-muted-foreground">
                Esta campanha será usada para atribuir vendas do SKU <strong>{productSku}</strong> 
                {" "}na plataforma <strong>{getPlatformLabel(selectedCampaignData.platform)}</strong>.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedCampaign || createLink.isPending}
          >
            {createLink.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Vincular Campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
