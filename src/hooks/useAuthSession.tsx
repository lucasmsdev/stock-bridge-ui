import { useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

// Constantes de sessão
const SESSION_DURATION_MS = 6 * 60 * 60 * 1000; // 6 horas em milissegundos
const SESSION_START_KEY = "unistock_session_start";
const SESSION_CHECK_INTERVAL = 60 * 1000; // Verificar a cada 1 minuto

interface UseAuthSessionOptions {
  redirectTo?: string;
  requireAuth?: boolean;
}

export const useAuthSession = (options: UseAuthSessionOptions = {}) => {
  const { redirectTo = "/login", requireAuth = true } = options;
  const { user, session, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Obter tempo de início da sessão
  const getSessionStartTime = useCallback((): number | null => {
    const stored = localStorage.getItem(SESSION_START_KEY);
    return stored ? parseInt(stored, 10) : null;
  }, []);

  // Definir tempo de início da sessão
  const setSessionStartTime = useCallback(() => {
    localStorage.setItem(SESSION_START_KEY, Date.now().toString());
  }, []);

  // Limpar dados da sessão
  const clearSessionData = useCallback(() => {
    localStorage.removeItem(SESSION_START_KEY);
  }, []);

  // Verificar se a sessão expirou
  const isSessionExpired = useCallback((): boolean => {
    const startTime = getSessionStartTime();
    if (!startTime) return true;
    
    const elapsed = Date.now() - startTime;
    return elapsed >= SESSION_DURATION_MS;
  }, [getSessionStartTime]);

  // Tempo restante da sessão em ms
  const getSessionTimeRemaining = useCallback((): number => {
    const startTime = getSessionStartTime();
    if (!startTime) return 0;
    
    const elapsed = Date.now() - startTime;
    const remaining = SESSION_DURATION_MS - elapsed;
    return Math.max(0, remaining);
  }, [getSessionStartTime]);

  // Tempo restante formatado
  const getFormattedTimeRemaining = useCallback((): string => {
    const remaining = getSessionTimeRemaining();
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}min`;
  }, [getSessionTimeRemaining]);

  // Forçar logout com limpeza completa
  const forceLogout = useCallback(async (showNotification = true, reason = "expired") => {
    console.log("🔐 useAuthSession: Forçando logout, razão:", reason);
    
    clearSessionData();
    
    try {
      await signOut();
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
    
    if (showNotification) {
      if (reason === "expired") {
        toast({
          title: "Sessão expirada",
          description: "Sua sessão expirou após 6 horas. Por favor, faça login novamente.",
          variant: "default",
        });
      } else if (reason === "manual") {
        toast({
          title: "Desconectado",
          description: "Você foi desconectado com sucesso.",
        });
      }
    }
    
    navigate(redirectTo, { replace: true });
  }, [clearSessionData, signOut, toast, navigate, redirectTo]);

  // Verificar sessão válida (para auto-redirect no login)
  const hasValidSession = useCallback((): boolean => {
    if (!user || !session) return false;
    return !isSessionExpired();
  }, [user, session, isSessionExpired]);

  // Registrar novo login (chamar após login bem-sucedido)
  const registerLogin = useCallback(() => {
    setSessionStartTime();
    console.log("🔐 useAuthSession: Sessão registrada, expira em 6 horas");
  }, [setSessionStartTime]);

  // Verificação periódica de expiração
  useEffect(() => {
    if (!user || !session || isLoading) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    // Verificar imediatamente
    if (isSessionExpired()) {
      console.log("🔐 useAuthSession: Sessão expirada detectada na verificação inicial");
      forceLogout(true, "expired");
      return;
    }

    // Configurar verificação periódica
    checkIntervalRef.current = setInterval(() => {
      if (isSessionExpired()) {
        console.log("🔐 useAuthSession: Sessão expirada detectada na verificação periódica");
        forceLogout(true, "expired");
      } else {
        const remaining = getSessionTimeRemaining();
        // Avisar quando faltar 10 minutos
        if (remaining > 0 && remaining <= 10 * 60 * 1000 && remaining > 9 * 60 * 1000) {
          toast({
            title: "Sessão expirando",
            description: "Sua sessão expira em 10 minutos. Salve seu trabalho.",
            variant: "default",
          });
        }
      }
    }, SESSION_CHECK_INTERVAL);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [user, session, isLoading, isSessionExpired, forceLogout, getSessionTimeRemaining, toast]);

  // Proteção de rota
  useEffect(() => {
    if (isLoading) return;
    
    if (requireAuth && !user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, isLoading, requireAuth, navigate, redirectTo]);

  return {
    user,
    session,
    isLoading,
    isSessionExpired,
    hasValidSession,
    getSessionTimeRemaining,
    getFormattedTimeRemaining,
    registerLogin,
    forceLogout,
    clearSessionData,
  };
};
