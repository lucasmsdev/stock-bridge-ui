import { useEffect, createContext, useContext, useCallback, type ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryClient";

// Constante para localStorage - tempo de início da sessão de 6h
const SESSION_START_KEY = "unistock_session_start";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  clearAllSessionData: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();

  // React Query para gerenciar a sessão com cache otimista
  const { data: session, isLoading } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });

  const user = session?.user ?? null;

  // Função para limpar todos os dados de sessão
  const clearAllSessionData = useCallback(() => {
    console.log('🔐 useAuth: Limpando todos os dados de sessão');
    localStorage.removeItem(SESSION_START_KEY);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    console.log('🔐 useAuth: Inicializando autenticação com React Query...');
    
    // IMPORTANTE: A sessão já persiste automaticamente por várias horas
    // O Supabase está configurado com:
    // - localStorage para armazenar o token
    // - persistSession: true para manter a sessão
    // - autoRefreshToken: true para renovar automaticamente (token válido por 1h, renova antes de expirar)
    
    // Set up auth state listener para sincronizar com o cache do React Query
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('🔐 useAuth: Auth state change:', event, !!newSession?.user);
        
        // Atualiza o cache do React Query com a nova sessão
        queryClient.setQueryData(queryKeys.auth.session, newSession);
        
        // Se logout, limpa todo o cache e dados de sessão
        if (event === 'SIGNED_OUT') {
          clearAllSessionData();
        }
        
        // IMPORTANTE: Registrar início de sessão automaticamente no login
        // Isso elimina a race condition onde useAuthSession verificava antes do registro
        if (event === 'SIGNED_IN') {
          const sessionStart = Date.now().toString();
          localStorage.setItem(SESSION_START_KEY, sessionStart);
          console.log('🔐 useAuth: Sessão de 6h registrada automaticamente');
          queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
        }
        
        if (event === 'TOKEN_REFRESHED') {
          queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
        }
      }
    );

    return () => {
      console.log('🔐 useAuth: Limpando subscription');
      subscription.unsubscribe();
    };
  }, [queryClient, clearAllSessionData]);

  const signOut = async () => {
    console.log('🔐 useAuth: Executando signOut');
    clearAllSessionData();
    await supabase.auth.signOut();
    // O cache será limpo automaticamente pelo onAuthStateChange
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut, clearAllSessionData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
