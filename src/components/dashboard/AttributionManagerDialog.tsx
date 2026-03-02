import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCampaignLinks } from "@/hooks/useCampaignLinks";
import { useProductROI } from "@/hooks/useProductROI";
import { Settings2, Search, Trash2, Plus, Link2, Loader2 } from "lucide-react";
import { PlatformLogo } from "@/components/ui/platform-logo";

export function AttributionManagerDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Configurar Atribuições
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Gestão de Atribuições
          </DialogTitle>
          <DialogDescription>
            Vincule campanhas de ads a produtos para calcular ROI com precisão.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="active" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">Vínculos Ativos</TabsTrigger>
            <TabsTrigger value="new" className="flex-1">Novo Vínculo</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="flex-1 overflow-auto">
            <ActiveLinksTab />
          </TabsContent>
          <TabsContent value="new" className="flex-1 overflow-auto">
            <NewLinkTab onCreated={() => {}} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ActiveLinksTab() {
  const { links, isLoading, updateLink, deleteLink } = useCampaignLinks();
  const [search, setSearch] = useState("");

  const filtered = links.filter(
    (l) =>
      (l.campaign_name || "").toLowerCase().includes(search.toLowerCase()) ||
      l.sku.toLowerCase().includes(search.toLowerCase()) ||
      l.platform.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (id: string, currentActive: boolean) => {
    updateLink.mutate({ id, is_active: !currentActive });
  };

  const handleDelete = (id: string) => {
    deleteLink.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por campanha, SKU ou plataforma..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Link2 className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {links.length === 0
              ? "Nenhum vínculo criado ainda. Use a aba \"Novo Vínculo\" para começar."
              : "Nenhum resultado para esta busca."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-auto max-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-center">Ativo</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((link) => (
                <TableRow key={link.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {link.campaign_name || link.campaign_id}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1.5">
                      <PlatformLogo platform={link.platform} size="sm" />
                      {link.platform}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{link.sku}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={link.is_active}
                      onCheckedChange={() => handleToggle(link.id, link.is_active)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(link.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function NewLinkTab({ onCreated }: { onCreated: () => void }) {
  const { availableCampaigns, createLink } = useCampaignLinks();
  const { allProducts } = useProductROI();
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");

  const filteredProducts = allProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredCampaigns = availableCampaigns.filter(
    (c) =>
      c.campaign_name.toLowerCase().includes(campaignSearch.toLowerCase()) ||
      c.platform.toLowerCase().includes(campaignSearch.toLowerCase())
  );

  const selectedProductData = allProducts.find((p) => p.id === selectedProduct);
  const selectedCampaignData = availableCampaigns.find(
    (c) => c.campaign_id === selectedCampaign
  );

  const canSubmit = selectedProduct && selectedCampaign;

  const handleSubmit = () => {
    if (!selectedProductData || !selectedCampaignData) return;

    createLink.mutate(
      {
        campaign_id: selectedCampaignData.campaign_id,
        campaign_name: selectedCampaignData.campaign_name,
        platform: selectedCampaignData.platform,
        product_id: selectedProductData.id,
        sku: selectedProductData.sku,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      },
      {
        onSuccess: () => {
          setSelectedProduct("");
          setSelectedCampaign("");
          setStartDate("");
          setEndDate("");
          onCreated();
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Product select */}
      <div className="space-y-2">
        <Label>Produto</Label>
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um produto" />
          </SelectTrigger>
          <SelectContent>
            <div className="p-2">
              <Input
                placeholder="Buscar produto..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="h-8"
              />
            </div>
            {filteredProducts.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} — {p.sku}
              </SelectItem>
            ))}
            {filteredProducts.length === 0 && (
              <p className="text-sm text-muted-foreground p-2 text-center">
                Nenhum produto encontrado
              </p>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Campaign select */}
      <div className="space-y-2">
        <Label>Campanha de Ads</Label>
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma campanha" />
          </SelectTrigger>
          <SelectContent>
            <div className="p-2">
              <Input
                placeholder="Buscar campanha..."
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                className="h-8"
              />
            </div>
            {filteredCampaigns.map((c) => (
              <SelectItem key={c.campaign_id} value={c.campaign_id}>
                [{c.platform}] {c.campaign_name}
              </SelectItem>
            ))}
            {filteredCampaigns.length === 0 && (
              <p className="text-sm text-muted-foreground p-2 text-center">
                Nenhuma campanha sincronizada encontrada
              </p>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Optional dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data início (opcional)</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Data fim (opcional)</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Preview */}
      {selectedProductData && selectedCampaignData && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
          <p className="text-sm font-medium">Preview do vínculo:</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedCampaignData.campaign_name}</span>
            {" "}({selectedCampaignData.platform}) →{" "}
            <span className="font-medium text-foreground">{selectedProductData.name}</span>
            {" "}({selectedProductData.sku})
          </p>
          {(startDate || endDate) && (
            <p className="text-xs text-muted-foreground">
              Período: {startDate || "—"} até {endDate || "—"}
            </p>
          )}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || createLink.isPending}
        className="w-full gap-2"
      >
        {createLink.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Criar Vínculo
      </Button>
    </div>
  );
}
