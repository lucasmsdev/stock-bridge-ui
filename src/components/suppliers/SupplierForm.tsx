import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import type { Json } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Supplier } from "@/pages/Suppliers";

interface SupplierFormProps {
  supplier?: Supplier | null;
  onSaved: () => void;
  onCancel: () => void;
}

const parseAddress = (address: Json): Record<string, string> => {
  if (typeof address === 'object' && address !== null && !Array.isArray(address)) {
    return address as Record<string, string>;
  }
  return {};
};

export const SupplierForm = ({ supplier, onSaved, onCancel }: SupplierFormProps) => {
  const { user } = useAuthSession();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const addressData = supplier?.address ? parseAddress(supplier.address) : {};
  
  const [formData, setFormData] = useState({
    name: supplier?.name || "",
    contact_name: supplier?.contact_name || "",
    email: supplier?.email || "",
    phone: supplier?.phone || "",
    website: supplier?.website || "",
    cnpj_cpf: supplier?.cnpj_cpf || "",
    payment_terms: supplier?.payment_terms || "",
    notes: supplier?.notes || "",
    is_active: supplier?.is_active ?? true,
    address: {
      street: addressData.street || "",
      number: addressData.number || "",
      complement: addressData.complement || "",
      neighborhood: addressData.neighborhood || "",
      city: addressData.city || "",
      state: addressData.state || "",
      zip_code: addressData.zip_code || "",
    },
  });

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      address: { ...prev.address, [field]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "O nome do fornecedor é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        user_id: user.id,
        name: formData.name.trim(),
        contact_name: formData.contact_name.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        website: formData.website.trim() || null,
        cnpj_cpf: formData.cnpj_cpf.trim() || null,
        payment_terms: formData.payment_terms.trim() || null,
        notes: formData.notes.trim() || null,
        is_active: formData.is_active,
        address: formData.address,
      };

      if (supplier) {
        const { error } = await supabase
          .from("suppliers")
          .update(payload)
          .eq("id", supplier.id);
        if (error) throw error;

        toast({
          title: "Fornecedor atualizado",
          description: "As informações foram salvas com sucesso.",
        });
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;

        toast({
          title: "Fornecedor cadastrado",
          description: "O fornecedor foi criado com sucesso.",
        });
      }

      onSaved();
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o fornecedor.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground">Nome do Fornecedor *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Ex: Atacado China Brasil"
            className="bg-background border-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_name" className="text-foreground">Nome do Contato</Label>
          <Input
            id="contact_name"
            value={formData.contact_name}
            onChange={(e) => handleChange("contact_name", e.target.value)}
            placeholder="Ex: João Silva"
            className="bg-background border-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="contato@fornecedor.com"
            className="bg-background border-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-foreground">Telefone/WhatsApp</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="(11) 99999-9999"
            className="bg-background border-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cnpj_cpf" className="text-foreground">CNPJ/CPF</Label>
          <Input
            id="cnpj_cpf"
            value={formData.cnpj_cpf}
            onChange={(e) => handleChange("cnpj_cpf", e.target.value)}
            placeholder="00.000.000/0001-00"
            className="bg-background border-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website" className="text-foreground">Website</Label>
          <Input
            id="website"
            value={formData.website}
            onChange={(e) => handleChange("website", e.target.value)}
            placeholder="https://fornecedor.com.br"
            className="bg-background border-input"
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Endereço</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="street" className="text-foreground">Rua</Label>
            <Input
              id="street"
              value={formData.address.street}
              onChange={(e) => handleAddressChange("street", e.target.value)}
              placeholder="Rua das Flores"
              className="bg-background border-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="number" className="text-foreground">Número</Label>
            <Input
              id="number"
              value={formData.address.number}
              onChange={(e) => handleAddressChange("number", e.target.value)}
              placeholder="123"
              className="bg-background border-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="complement" className="text-foreground">Complemento</Label>
            <Input
              id="complement"
              value={formData.address.complement}
              onChange={(e) => handleAddressChange("complement", e.target.value)}
              placeholder="Sala 10"
              className="bg-background border-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="neighborhood" className="text-foreground">Bairro</Label>
            <Input
              id="neighborhood"
              value={formData.address.neighborhood}
              onChange={(e) => handleAddressChange("neighborhood", e.target.value)}
              placeholder="Centro"
              className="bg-background border-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zip_code" className="text-foreground">CEP</Label>
            <Input
              id="zip_code"
              value={formData.address.zip_code}
              onChange={(e) => handleAddressChange("zip_code", e.target.value)}
              placeholder="00000-000"
              className="bg-background border-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city" className="text-foreground">Cidade</Label>
            <Input
              id="city"
              value={formData.address.city}
              onChange={(e) => handleAddressChange("city", e.target.value)}
              placeholder="São Paulo"
              className="bg-background border-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state" className="text-foreground">Estado</Label>
            <Input
              id="state"
              value={formData.address.state}
              onChange={(e) => handleAddressChange("state", e.target.value)}
              placeholder="SP"
              className="bg-background border-input"
            />
          </div>
        </div>
      </div>

      {/* Payment Terms and Notes */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="payment_terms" className="text-foreground">Condições de Pagamento</Label>
          <Input
            id="payment_terms"
            value={formData.payment_terms}
            onChange={(e) => handleChange("payment_terms", e.target.value)}
            placeholder="Ex: 30/60/90 dias, PIX, Boleto"
            className="bg-background border-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-foreground">Observações</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Anotações sobre o fornecedor..."
            rows={3}
            className="bg-background border-input resize-none"
          />
        </div>
      </div>

      {/* Active Switch */}
      <div className="flex items-center space-x-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => handleChange("is_active", checked)}
        />
        <Label htmlFor="is_active" className="text-foreground">Fornecedor ativo</Label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-gradient-primary text-primary-foreground"
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {supplier ? "Salvar Alterações" : "Cadastrar Fornecedor"}
        </Button>
      </div>
    </form>
  );
};
