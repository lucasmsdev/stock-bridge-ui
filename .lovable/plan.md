

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

```text
+-------------------------------------+
|  [Google Ads Logo]                  |
|  Google Ads          [Em breve]     |
|  Metricas de campanhas do Google    |
|  Ads - pesquisa, display e shopping |
|                                     |
|  +-------------------------------+  |
|  |       Em breve (disabled)     |  |
|  +-------------------------------+  |
+-------------------------------------+
```

---

## Detalhes Tecnicos

| Item | Valor |
|------|-------|
| Badge | `variant="outline"` com classes `bg-muted text-muted-foreground` |
| Botao | `disabled={true}` com icone `Clock` ao inves de `Plus` |
| Estilo | Opacidade reduzida no card para indicar indisponibilidade |

---

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| `src/pages/Integrations.tsx` | Modificar |

---

## Resultado

O Google Ads aparecera na lista de integracoes disponiveis, claramente marcado como "Em breve", mantendo a expectativa do usuario de que a funcionalidade sera adicionada futuramente, sem confusao sobre o status atual.

