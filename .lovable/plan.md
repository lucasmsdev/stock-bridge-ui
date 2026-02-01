
# Plano: Adicionar Google Ads (Em Breve)

## Visão Geral

Adicionar o Google Ads à lista de integrações disponíveis na página de Integrações, porém marcado como "Em breve" com botão desabilitado.

---

## Modificações

### Arquivo: `src/pages/Integrations.tsx`

#### 1. Atualizar o array `availableIntegrations` (linha ~32)

Adicionar Google Ads após Meta Ads:

```typescript
{
  id: "google_ads",
  name: "Google Ads",
  description: "Métricas de campanhas do Google Ads - pesquisa, display e shopping",
  popular: false,
  comingSoon: true,
  logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Google_Ads_logo.svg",
}
```

#### 2. Modificar o render do card (linhas ~918-964)

Atualizar para:
- Exibir badge "Em breve" ao lado do nome quando `comingSoon: true`
- Desabilitar o botão "Conectar" para integrações `comingSoon`
- Alterar texto do botão para "Em breve" quando desabilitado

---

## Visual Esperado

```
┌─────────────────────────────────────┐
│  [Google Ads Logo]                  │
│  Google Ads          [Em breve]     │
│  Métricas de campanhas do Google    │
│  Ads - pesquisa, display e shopping │
│                                     │
│  ┌─────────────────────────────────┐│
│  │       Em breve (disabled)       ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

---

## Detalhes Técnicos

| Item | Valor |
|------|-------|
| Badge | `variant="outline"` com classes `bg-muted text-muted-foreground` |
| Botão | `disabled={true}` com ícone `Clock` ao invés de `Plus` |
| Estilo | Opacidade reduzida no card para indicar indisponibilidade |

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/Integrations.tsx` | Modificar |

---

## Resultado

O Google Ads aparecerá na lista de integrações disponíveis, claramente marcado como "Em breve", mantendo a expectativa do usuário de que a funcionalidade será adicionada futuramente, sem confusão sobre o status atual.
