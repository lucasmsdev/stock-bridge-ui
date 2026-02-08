import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlatformLogo } from "@/components/ui/platform-logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles,
  ShoppingCart,
  Package,
  BarChart3,
  DollarSign,
  Bot,
  ArrowRight,
  ArrowLeft,
  Check,
  Upload,
  Plus,
  LayoutDashboard,
} from "lucide-react";

interface OnboardingWizardProps {
  userName?: string | null;
  userId?: string;
}

const STEPS = [
  { label: "Boas-vindas", icon: Sparkles },
  { label: "Marketplace", icon: ShoppingCart },
  { label: "Produtos", icon: Package },
  { label: "Visão geral", icon: LayoutDashboard },
];

const MARKETPLACES = [
  { id: "mercadolivre", name: "Mercado Livre", platform: "mercadolivre" },
  { id: "shopee", name: "Shopee", platform: "shopee" },
  { id: "amazon", name: "Amazon", platform: "amazon" },
  { id: "shopify", name: "Shopify", platform: "shopify" },
  { id: "magalu", name: "Magalu", platform: "magalu" },
];

const FEATURES = [
  {
    icon: BarChart3,
    title: "Vendas em tempo real",
    description: "Acompanhe vendas de todos os marketplaces em um só painel",
  },
  {
    icon: Package,
    title: "Estoque unificado",
    description: "Controle e sincronize estoque entre todas as plataformas",
  },
  {
    icon: DollarSign,
    title: "Financeiro completo",
    description: "Custos, margens, despesas e lucro líquido automatizados",
  },
  {
    icon: Bot,
    title: "Uni AI",
    description: "Assistente inteligente com sugestões e ações de 1 clique",
  },
];

export const OnboardingWizard = ({ userName, userId }: OnboardingWizardProps) => {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;

    const checkOnboarding = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("has_completed_onboarding")
          .eq("id", userId)
          .maybeSingle();

        if (error) {
          console.error("Erro ao verificar onboarding:", error);
          setIsLoading(false);
          return;
        }

        // Use type assertion since the column was just added
        const profile = data as { has_completed_onboarding?: boolean } | null;
        const hasCompleted = profile?.has_completed_onboarding ?? false;
        
        if (!hasCompleted) {
          setOpen(true);
        }
      } catch (err) {
        console.error("Erro ao verificar onboarding:", err);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboarding();
  }, [userId]);

  const completeOnboarding = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ has_completed_onboarding: true } as Record<string, unknown>)
        .eq("id", userId);

      if (error) {
        console.error("Erro ao marcar onboarding:", error);
      }
    } catch (err) {
      console.error("Erro ao marcar onboarding:", err);
    }
    setOpen(false);
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleConnectMarketplace = async (platform: string) => {
    await completeOnboarding();
    navigate(`/app/integrations?onboarding=true&platform=${platform}`);
    toast.success("Vamos conectar seu marketplace!");
  };

  const handleImportFromMarketplace = async () => {
    await completeOnboarding();
    navigate("/app/integrations?onboarding=true");
    toast.success("Conecte um marketplace para importar produtos.");
  };

  const handleCreateManually = async () => {
    await completeOnboarding();
    navigate("/app/products/new");
    toast.success("Vamos criar seu primeiro produto!");
  };

  const handleFinish = async () => {
    await completeOnboarding();
    toast.success("Tudo pronto! Bem-vindo ao UNISTOCK 🚀");
  };

  if (isLoading || !open) return null;

  const displayName = userName || "empreendedor";

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 gap-0 border-none shadow-xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Stepper */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStep;
              const isDone = index < currentStep;
              return (
                <div key={step.label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md scale-110"
                          : isDone
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                    </div>
                    <span
                      className={`text-xs font-medium hidden sm:block ${
                        isActive ? "text-primary" : isDone ? "text-primary/70" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 mt-[-1rem] rounded-full transition-colors duration-300 ${
                        isDone ? "bg-primary/40" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Step Content */}
        <div className="p-6 min-h-[320px] flex flex-col animate-fade-in" key={currentStep}>
          {currentStep === 0 && <WelcomeStep name={displayName} />}
          {currentStep === 1 && <ConnectMarketplaceStep onConnect={handleConnectMarketplace} />}
          {currentStep === 2 && (
            <ImportProductsStep
              onImportFromMarketplace={handleImportFromMarketplace}
              onCreateManually={handleCreateManually}
            />
          )}
          {currentStep === 3 && <DashboardOverviewStep />}
        </div>

        <div className="h-px bg-border" />

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            {currentStep > 0 ? (
              <Button variant="outline" onClick={handleBack} size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            ) : (
              <Button variant="ghost" onClick={completeOnboarding} size="sm" className="text-muted-foreground">
                Pular tudo
              </Button>
            )}
          </div>
          <div>
            {currentStep < STEPS.length - 1 ? (
              <Button onClick={handleNext} size="sm">
                Próximo
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleFinish} size="sm">
                Começar a usar 🚀
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ---- Step Components ---- */

function WelcomeStep({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-6 flex-1 justify-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          Olá, {name}! 👋
        </h2>
        <p className="text-muted-foreground max-w-md">
          Bem-vindo ao <span className="font-semibold text-foreground">UNISTOCK</span> — seu painel unificado para gerenciar vendas, estoque e lucro em todos os marketplaces.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md mt-2">
        {[
          { icon: ShoppingCart, text: "Conecte seus marketplaces" },
          { icon: Package, text: "Centralize seus produtos" },
          { icon: BarChart3, text: "Acompanhe vendas em tempo real" },
          { icon: DollarSign, text: "Controle seu lucro líquido" },
        ].map((item) => (
          <div
            key={item.text}
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm"
          >
            <item.icon className="h-4 w-4 text-primary shrink-0" />
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectMarketplaceStep({ onConnect }: { onConnect: (platform: string) => void }) {
  return (
    <div className="flex flex-col gap-5 flex-1">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Conecte seu primeiro marketplace</h2>
        <p className="text-muted-foreground text-sm">
          Escolha uma plataforma para sincronizar automaticamente produtos, pedidos e estoque.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
        {MARKETPLACES.map((mp) => (
          <button
            key={mp.id}
            onClick={() => onConnect(mp.platform)}
            className="group flex flex-col items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <div className="w-12 h-12 flex items-center justify-center">
              <PlatformLogo platform={mp.platform} size="lg" />
            </div>
            <span className="text-sm font-medium group-hover:text-primary transition-colors">
              {mp.name}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-auto">
        Você pode conectar mais marketplaces depois em <span className="font-medium">Integrações</span>.
      </p>
    </div>
  );
}

function ImportProductsStep({
  onImportFromMarketplace,
  onCreateManually,
}: {
  onImportFromMarketplace: () => void;
  onCreateManually: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 flex-1">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Importe seus produtos</h2>
        <p className="text-muted-foreground text-sm">
          Traga seus produtos de um marketplace conectado ou crie manualmente.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 flex-1">
        <button
          onClick={onImportFromMarketplace}
          className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary bg-card hover:bg-primary/5 transition-all duration-200 cursor-pointer"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm">Importar de marketplace</p>
            <p className="text-xs text-muted-foreground mt-1">
              Conecte e importe automaticamente
            </p>
          </div>
        </button>
        <button
          onClick={onCreateManually}
          className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary bg-card hover:bg-primary/5 transition-all duration-200 cursor-pointer"
        >
          <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center">
            <Plus className="h-7 w-7 text-secondary" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm">Criar manualmente</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastre produto por produto
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

function DashboardOverviewStep() {
  return (
    <div className="flex flex-col gap-5 flex-1">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Tudo pronto para começar!</h2>
        <p className="text-muted-foreground text-sm">
          Conheça as principais funcionalidades do seu painel.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <feature.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">{feature.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-auto">
        Dica: Use a <span className="font-medium text-primary">Uni AI</span> para pedir análises e executar ações com 1 clique!
      </p>
    </div>
  );
}
