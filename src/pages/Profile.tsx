import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  User, 
  Building2, 
  Crown, 
  CreditCard, 
  Lock, 
  Trash2, 
  Camera, 
  Save,
  Loader2,
  Database 
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ProfileData {
  full_name: string;
  company_name: string;
  avatar_url: string | null;
}

interface ProfileRow {
  id: string;
  email: string;
  plan: string;
  created_at: string;
  full_name?: string | null;
  company_name?: string | null;
  avatar_url?: string | null;
  updated_at?: string;
}

interface DeleteAccountResponse {
  success: boolean;
  error?: string;
  deleted_data?: {
    products: number;
    orders: number;
    integrations: number;
    profile: boolean;
  };
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const { currentPlan, getPlanFeatures, getLegacyPlanFeatures, isAdmin } = usePlan();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: '',
    company_name: '',
    avatar_url: null
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Mapeamento de product_id do Stripe para nomes de planos
  const stripePlanMapping: Record<string, { name: string; color: string }> = {
    'prod_TMXhL6PpJGIdes': { name: 'Iniciante', color: 'bg-blue-500' },
    'prod_TMXhvv2uUeASgd': { name: 'Profissional', color: 'bg-purple-500' },
    'prod_TMZ21bgbH6pvO1': { name: 'Enterprise', color: 'bg-gold-500' },
    'prod_TMXi6ibUp81vUz': { name: 'Unlimited', color: 'bg-gradient-to-r from-gold-500 to-orange-500' },
  };

  const planNames = {
    estrategista: 'Estrategista (Legacy)',
    competidor: 'Competidor (Legacy)',
    dominador: 'Dominador (Legacy)',
    admin: 'Administrador ✨'
  };

  const planColors = {
    estrategista: 'bg-blue-500',
    competidor: 'bg-purple-500',
    dominador: 'bg-gold-500',
    admin: 'bg-gradient-to-r from-purple-500 to-pink-500'
  };

  // Estado para armazenar dados da assinatura do Stripe
  const [stripeSubscription, setStripeSubscription] = useState<{
    productId: string | null;
    subscriptionEnd: string | null;
    subscribed: boolean;
  }>({ productId: null, subscriptionEnd: null, subscribed: false });

  useEffect(() => {
    loadProfileData();
    checkStripeSubscription();
  }, [user]);

  const checkStripeSubscription = async () => {
    if (!user) {
      setIsCheckingSubscription(false);
      return;
    }
    
    try {
      setIsCheckingSubscription(true);
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('Erro ao verificar assinatura:', error);
        setIsCheckingSubscription(false);
        return;
      }

      if (data) {
        setStripeSubscription({
          productId: data.product_id || null,
          subscriptionEnd: data.subscription_end || null,
          subscribed: data.subscribed || false,
        });
      }
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
    } finally {
      setIsCheckingSubscription(false);
    }
  };

  const loadProfileData = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const profileRow = data as ProfileRow;
        setProfileData({
          full_name: profileRow.full_name || '',
          company_name: profileRow.company_name || '',
          avatar_url: profileRow.avatar_url || null
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "❌ Erro ao carregar perfil",
        description: "Não foi possível carregar os dados do perfil.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: profileData.full_name || null,
          company_name: profileData.company_name || null,
          avatar_url: profileData.avatar_url,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "✅ Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "❌ Erro ao salvar",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "❌ Senhas não coincidem",
        description: "A nova senha e confirmação devem ser iguais.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "❌ Senha muito curta",
        description: "A nova senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      toast({
        title: "✅ Senha alterada",
        description: "Sua senha foi alterada com sucesso.",
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: "❌ Erro ao alterar senha",
        description: "Não foi possível alterar a senha.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    try {
      setIsDeleting(true);
      
      // Call the secure RPC function to delete user and all associated data
      const { data, error } = await supabase.rpc('delete_user_account');
      
      if (error) throw error;

      // Check if the deletion was successful
      const response = data as unknown as DeleteAccountResponse;
      if (!response || !response.success) {
        throw new Error(response?.error || 'Falha ao deletar conta');
      }

      toast({
        title: "✅ Conta deletada",
        description: "Sua conta foi removida permanentemente.",
      });

      // Sign out after successful deletion
      await signOut();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: "❌ Erro ao deletar conta",
        description: error instanceof Error ? error.message : "Não foi possível deletar a conta. Entre em contato com o suporte.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;
    
    try {
      setIsSaving(true);
      
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('❌ Erro na função create-portal-session:', error);
        throw new Error(error.message || 'Erro ao acessar portal de assinatura');
      }

      if (data?.url) {
        console.log('✅ Sessão do portal criada, redirecionando para:', data.url);
        window.open(data.url, '_blank');
        
        toast({
          title: "🔄 Abrindo portal de gerenciamento",
          description: "Você será redirecionado para gerenciar sua assinatura no Stripe.",
        });
      } else {
        throw new Error('URL do portal não recebida');
      }
    } catch (error) {
      console.error('💥 Erro ao acessar portal:', error);
      toast({
        title: "❌ Erro no portal",
        description: error instanceof Error ? error.message : "Erro ao acessar portal de assinatura. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedAdminAccount = async () => {
    if (!user || !isAdmin) return;
    
    try {
      setIsSeeding(true);
      
      const { data, error } = await supabase.functions.invoke('seed-admin-account', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('❌ Erro na função seed-admin-account:', error);
        throw new Error(error.message || 'Erro ao gerar dados de demonstração');
      }

      toast({
        title: "✅ Dados de demonstração criados!",
        description: `Foram criados: ${data.summary?.products || 0} produtos, ${data.summary?.orders || 0} pedidos, ${data.summary?.monitoring_jobs || 0} alertas e ${data.summary?.notifications || 0} notificações.`,
      });
      
    } catch (error) {
      console.error('💥 Erro ao gerar dados:', error);
      toast({
        title: "❌ Erro ao gerar dados",
        description: error instanceof Error ? error.message : "Não foi possível gerar os dados de demonstração.",
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const getUserInitials = (email: string) => {
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando perfil...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Meu Perfil</h1>
        <p className="text-muted-foreground">
          Gerencie suas informações pessoais e configurações da conta
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Informações do Perfil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profileData.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {user?.email ? getUserInitials(user.email) : 'US'}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" disabled>
                    <Camera className="h-4 w-4 mr-2" />
                    Alterar Foto
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG até 2MB (Em breve)
                  </p>
                </div>
              </div>

              <Separator />

              {/* Profile Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    O email não pode ser alterado
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData(prev => ({
                      ...prev,
                      full_name: e.target.value
                    }))}
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="companyName">Nome da Empresa</Label>
                  <Input
                    id="companyName"
                    value={profileData.company_name}
                    onChange={(e) => setProfileData(prev => ({
                      ...prev,
                      company_name: e.target.value
                    }))}
                    placeholder="Nome da sua empresa (opcional)"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="bg-gradient-primary hover:bg-primary-hover"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Alterar Senha
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({
                      ...prev,
                      newPassword: e.target.value
                    }))}
                    placeholder="Digite sua nova senha"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({
                      ...prev,
                      confirmPassword: e.target.value
                    }))}
                    placeholder="Confirme sua nova senha"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleChangePassword}
                  variant="outline"
                  disabled={!passwordData.newPassword || !passwordData.confirmPassword}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Alterar Senha
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar with Plan Info */}
        <div className="space-y-6">
          {/* Plan Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Plano e Assinatura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-3">
                {/* Mostrar nome do plano do Stripe se houver assinatura ativa */}
                {stripeSubscription.subscribed && stripeSubscription.productId ? (
                  <Badge 
                    variant="outline" 
                    className={`${stripePlanMapping[stripeSubscription.productId]?.color || 'bg-primary'} text-white border-none px-4 py-2 text-sm font-medium`}
                  >
                    <Crown className="h-3 w-3 mr-1" />
                    Plano {stripePlanMapping[stripeSubscription.productId]?.name || 'Atual'}
                  </Badge>
                ) : (
                  <Badge 
                    variant="outline" 
                    className={`${isAdmin ? planColors.admin : planColors[currentPlan]} text-white border-none px-4 py-2 text-sm font-medium`}
                  >
                    <Crown className="h-3 w-3 mr-1" />
                    Plano {isAdmin ? planNames.admin : planNames[currentPlan]}
                  </Badge>
                )}
                
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium text-foreground">Status</p>
                  <p className="text-lg font-semibold text-green-600">
                    {stripeSubscription.subscribed ? 'Ativo' : 'Legacy'}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                 <h4 className="font-medium text-foreground">Recursos inclusos:</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {isAdmin ? (
                      <>
                        <p>• ∞ produtos (Acesso Total)</p>
                        <p>• ✅ Reprecificação por alerta</p>
                        <p>• ✅ Suporte prioritário</p>
                        <p>• ✅ Relatórios avançados</p>
                        <p>• ✅ Todas as funcionalidades</p>
                      </>
                    ) : (
                      <>
                        <p>• {getLegacyPlanFeatures().maxSkus === Infinity ? '∞' : getLegacyPlanFeatures().maxSkus} produtos</p>
                        <p>• {getLegacyPlanFeatures().hasReprecificacaoPorAlerta ? '✅' : '❌'} Reprecificação por alerta</p>
                        <p>• {getLegacyPlanFeatures().hasSuportePrioritario ? '✅' : '❌'} Suporte prioritário</p>
                        <p>• {getLegacyPlanFeatures().hasRelatoriosAvancados ? '✅' : '❌'} Relatórios avançados</p>
                      </>
                    )}
                  </div>
              </div>

              {/* Mostrar botões apropriados baseado na assinatura */}
              {isCheckingSubscription ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : stripeSubscription.subscribed ? (
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleManageSubscription}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    Gerenciar Assinatura
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Cancele ou altere seu plano no portal do Stripe
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button 
                    variant="default" 
                    className="w-full bg-gradient-primary hover:bg-primary-hover"
                    onClick={() => window.location.href = '/billing'}
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Fazer Upgrade
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Desbloqueie todos os recursos com um plano atual
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Admin Tools */}
          {isAdmin && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Database className="h-5 w-5" />
                  Ferramentas de Administrador
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-foreground mb-2">Gerar Dados de Demonstração</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Popula sua conta com produtos, pedidos e alertas fictícios para captura de tela do dashboard.
                    </p>
                    
                    <Button 
                      onClick={handleSeedAdminAccount}
                      disabled={isSeeding}
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                    >
                      {isSeeding ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Database className="h-4 w-4 mr-2" />
                      )}
                      Gerar Dados de Demonstração
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account Management */}
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Zona de Perigo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Deletar Conta</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Esta ação é irreversível. Todos os seus dados, produtos e integrações serão removidos permanentemente.
                  </p>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Deletar Conta
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. Isso excluirá permanentemente sua conta 
                          e removerá todos os seus dados dos nossos servidores.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteAccount}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Sim, deletar minha conta
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}