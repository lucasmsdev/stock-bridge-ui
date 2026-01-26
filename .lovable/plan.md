
# Corrigir Race Condition no Sistema de Sessão (Erro 401 Após Login)

## Diagnóstico do Problema

O sistema está entrando em um **loop de logout imediato** após o login devido a uma race condition entre a criação e verificação da sessão.

### Sequência de Eventos Atual (Quebrada)

```
1. Usuário envia credenciais
2. Login.tsx recebe resposta de sucesso
3. useAuth detecta evento SIGNED_IN
4. useAuthSession detecta user/session no useEffect
5. useAuthSession chama isSessionExpired()
6. SESSION_START_KEY não existe → retorna TRUE
7. Sistema força logout (linha 122 useAuthSession.tsx)
8. Usuário é redirecionado para /login
9. DEPOIS disso, registerLogin() tenta executar (mas já é tarde)
```

**Evidência nos Logs:**
```
🔐 useAuthSession: Sessão expirada detectada na verificação inicial
🔐 useAuthSession: Forçando logout, razão: expired
🔐 useAuth: Auth state change: SIGNED_IN true
🔐 useAuthSession: Sessão registrada, expira em 6 horas
```

Note que "Sessão registrada" aparece DEPOIS de "Forçando logout".

---

## Solução: Integrar Registro de Sessão no AuthProvider

Mover a responsabilidade de registrar sessões para dentro do `useAuth` (AuthProvider), eliminando a dependência manual de `registerLogin()`.

### Benefícios
✅ Elimina race condition completamente  
✅ Registro automático em TODOS os pontos de login  
✅ Não depende de chamadas manuais em componentes  
✅ Sincronização garantida entre auth state e session timing  

---

## Mudanças Técnicas

### 1. Atualizar `src/hooks/useAuth.tsx`

**O que mudar**: Adicionar lógica para registrar automaticamente o início da sessão quando detectar `SIGNED_IN`.

**Arquivo**: `src/hooks/useAuth.tsx`  
**Linhas**: 42-75 (dentro do `useEffect` com `onAuthStateChange`)

**Antes:**
```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, newSession) => {
    console.log('🔐 useAuth: Auth state change:', event, !!newSession?.user);
    
    queryClient.setQueryData(queryKeys.auth.session, newSession);
    
    if (event === 'SIGNED_OUT') {
      clearAllSessionData();
    }
    
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
    }
  }
);
```

**Depois:**
```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, newSession) => {
    console.log('🔐 useAuth: Auth state change:', event, !!newSession?.user);
    
    queryClient.setQueryData(queryKeys.auth.session, newSession);
    
    if (event === 'SIGNED_OUT') {
      clearAllSessionData();
    }
    
    // NOVO: Registrar início de sessão automaticamente no login
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
```

**Por que aqui?**  
O evento `SIGNED_IN` é disparado ANTES de qualquer componente receber o `user`, garantindo que `SESSION_START_KEY` exista quando `useAuthSession` verificar pela primeira vez.

---

### 2. Tornar `registerLogin()` opcional em `Login.tsx`

**O que mudar**: Remover a chamada manual de `registerLogin()`, pois agora é automática.

**Arquivo**: `src/pages/auth/Login.tsx`  
**Linha**: 88

**Antes:**
```typescript
if (data.user) {
  // Registrar início da sessão de 6 horas
  registerLogin();
  
  // Primeiro verificar se é admin
  // ...
}
```

**Depois:**
```typescript
if (data.user) {
  // ✅ Sessão registrada automaticamente pelo AuthProvider
  
  // Primeiro verificar se é admin
  // ...
}
```

**Nota**: Não precisamos remover o import ou a desestruturação de `registerLogin`, apenas não chamá-lo mais. Isso mantém compatibilidade caso seja necessário para outros fluxos.

---

### 3. Adicionar proteção adicional no `useAuthSession`

**O que mudar**: Adicionar verificação para evitar logout se a sessão foi criada há menos de 5 segundos.

**Arquivo**: `src/hooks/useAuthSession.tsx`  
**Linhas**: 119-124

**Antes:**
```typescript
// Verificar imediatamente
if (isSessionExpired()) {
  console.log("🔐 useAuthSession: Sessão expirada detectada na verificação inicial");
  forceLogout(true, "expired");
  return;
}
```

**Depois:**
```typescript
// Verificar imediatamente, mas permitir grace period para sessões recém-criadas
const sessionStart = getSessionStartTime();
const now = Date.now();

if (isSessionExpired()) {
  // Grace period: se a sessão foi criada há menos de 5 segundos, aguardar
  const isRecentLogin = sessionStart && (now - sessionStart) < 5000;
  
  if (!isRecentLogin) {
    console.log("🔐 useAuthSession: Sessão expirada detectada na verificação inicial");
    forceLogout(true, "expired");
    return;
  } else {
    console.log("🔐 useAuthSession: Login recente detectado, ignorando verificação inicial");
  }
}
```

**Por que?**  
Camada extra de segurança caso haja algum delay mínimo entre `SIGNED_IN` e o `useEffect` disparar.

---

## Fluxo Após Correção

```
┌─────────────────────────────────┐
│  Usuário faz login              │
└──────────────┬──────────────────┘
               │
               v
┌─────────────────────────────────┐
│  Supabase auth: signInWithPassword│
└──────────────┬──────────────────┘
               │
               v
┌─────────────────────────────────────────────┐
│  AuthProvider detecta SIGNED_IN             │
│  → Salva SESSION_START_KEY                  │  ✅ PRIMEIRO
│  → console.log("Sessão registrada...")      │
└──────────────┬──────────────────────────────┘
               │
               v
┌─────────────────────────────────────────────┐
│  useAuthSession detecta user/session        │
│  → Checa isSessionExpired()                 │
│  → SESSION_START_KEY existe ✅              │  ✅ DEPOIS
│  → Retorna FALSE                            │
│  → Nenhum logout forçado                    │
└──────────────┬──────────────────────────────┘
               │
               v
┌─────────────────────────────────┐
│  Usuário acessa dashboard       │
│  Edge Functions funcionam ✅    │
└─────────────────────────────────┘
```

---

## Arquivos Modificados

| Arquivo | Mudança | Linhas |
|---------|---------|--------|
| `src/hooks/useAuth.tsx` | Adicionar registro automático de sessão no evento SIGNED_IN | ~52-69 |
| `src/pages/auth/Login.tsx` | Remover chamada manual de registerLogin() | ~88 |
| `src/hooks/useAuthSession.tsx` | Adicionar grace period na verificação inicial | ~119-128 |

---

## Testes de Validação

Após a correção, testar:

1. ✅ **Login fresco**
   - Fazer logout completo
   - Fazer login
   - Verificar que NÃO há "Sessão expirada" nos logs
   - Confirmar acesso ao dashboard

2. ✅ **Edge Functions**
   - Tentar importar produtos
   - Tentar acessar detalhes de produto
   - Verificar que não há erro 401

3. ✅ **Sessão expirada real**
   - Modificar `SESSION_DURATION_MS` para 10 segundos
   - Fazer login
   - Aguardar 15 segundos
   - Confirmar que sistema desloga automaticamente

4. ✅ **Refresh de página**
   - Fazer login
   - Recarregar a página
   - Confirmar que sessão continua ativa

---

## Logs Esperados Após Correção

```
🔐 useAuth: Inicializando autenticação com React Query...
🔐 useAuth: Auth state change: SIGNED_IN true
🔐 useAuth: Sessão de 6h registrada automaticamente  ← NOVO
🔐 useAuthSession: Login recente detectado, ignorando verificação inicial  ← NOVO (ou não aparece)
```

**NÃO deve aparecer:**
```
❌ 🔐 useAuthSession: Sessão expirada detectada na verificação inicial
❌ 🔐 useAuthSession: Forçando logout, razão: expired
```

---

## Rollback Plan

Se algo der errado:

1. Reverter mudanças em `useAuth.tsx`
2. Reverter mudanças em `Login.tsx` (restaurar `registerLogin()`)
3. Sistema volta ao comportamento anterior (com race condition)
4. Investigar logs para identificar novo problema

---

## Melhorias Futuras (Opcional)

- **Sincronizar sessão com token do Supabase**: Usar `session.expires_at` em vez de timestamp customizado
- **Renovação automática**: Estender sessão automaticamente em cada ação do usuário
- **Notificação visual**: Mostrar tempo restante na sidebar
- **Modo "Remember Me"**: Permitir sessões mais longas (opcionalmente)
