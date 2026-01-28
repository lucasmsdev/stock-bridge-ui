
# Plano: Corrigir Extração de IDs de Imagens do Mercado Livre

## Problema Identificado

A função `extractMlPictureId` não consegue extrair corretamente o ID das URLs de imagens do ML, fazendo com que **todas as imagens sejam re-uploadadas** a cada sincronização, gerando novos IDs e perdendo a ordem original.

### Exemplo do Problema

```text
URL: https://http2.mlstatic.com/D_868544-MLA83755569527_042025-O.jpg
                                   └─────────────────────────────┘
                                   ID esperado: 868544-MLA83755569527_042025

Regex atual: (\d+-MLA\d+[_-]\d+)
→ Não captura porque a URL tem "D_" antes do número
```

### Comportamento Atual (Incorreto)

```text
Imagem 1 (mlstatic.com) → Regex falha → Faz upload → NOVO ID gerado
Imagem 2 (mlstatic.com) → Regex falha → Faz upload → NOVO ID gerado
```

### Comportamento Esperado (Correto)

```text
Imagem 1 (mlstatic.com) → Regex extrai ID → Reutiliza ID existente → Ordem mantida
Imagem 2 (mlstatic.com) → Regex extrai ID → Reutiliza ID existente → Ordem mantida
```

---

## Solução

Atualizar a função `extractMlPictureId` para capturar corretamente os padrões de URLs do ML, incluindo o prefixo `D_`.

### Arquivo: `supabase/functions/update-product-images/index.ts`

#### Mudança: Corrigir regex para extrair IDs

```typescript
function extractMlPictureId(url: string): string | null {
  // Patterns for ML image URLs
  // Format 1: D_XXXXXX-MLB00000000000_MMYYYY-X.jpg
  // Format 2: XXXXXX-MLB00000000000_MMYYYY
  // Format 3: D_NQ_NP_XXXXXX-MLB00000000000_MMYYYY
  
  const patterns = [
    // Match D_XXXXXX-MLx format (most common)
    /D_(\d+-ML[A-Z]\d+[_-]\d+)/i,
    // Match D_NQ_NP_XXXXXX-MLx format  
    /D_NQ_NP_(\d+-ML[A-Z]\d+[_-]\d+)/i,
    // Match D_Q_NP_XXXXXX-MLx format
    /D_Q_NP_(\d+-ML[A-Z]\d+[_-]\d+)/i,
    // Match direct XXXXXX-MLx format (fallback)
    /(\d{6,}-ML[A-Z]\d+[_-]\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}
```

---

## Fluxo Corrigido

```text
┌────────────────────────────────────────────────────────────────┐
│  ANTES (problema)                                               │
│                                                                  │
│  URL: D_868544-MLA83755569527_042025-O.jpg                      │
│  Regex: (\d+-MLA\d+[_-]\d+) → NÃO CAPTURA                       │
│  Resultado: Faz upload → NOVO ID → ORDEM PERDIDA                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  DEPOIS (corrigido)                                             │
│                                                                  │
│  URL: D_868544-MLA83755569527_042025-O.jpg                      │
│  Regex: D_(\d+-ML[A-Z]\d+[_-]\d+) → CAPTURA "868544-MLA..."    │
│  Resultado: Reutiliza ID → ORDEM MANTIDA ✅                     │
└────────────────────────────────────────────────────────────────┘
```

---

## Testes Esperados

| URL de Teste | ID Extraído |
|--------------|-------------|
| `D_868544-MLA83755569527_042025-O.jpg` | `868544-MLA83755569527_042025` |
| `D_NQ_NP_654616-MLA100052373945_122025-O.jpg` | `654616-MLA100052373945_122025` |
| `D_Q_NP_745762-MLA88339485001_072025-V.jpg` | `745762-MLA88339485001_072025` |
| `782129-MLB105943089361_012026` | `782129-MLB105943089361_012026` |

---

## Arquivos a Modificar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/update-product-images/index.ts` | Corrigir função `extractMlPictureId` |

---

## Benefícios

1. **Ordem preservada**: Imagens existentes do ML mantêm seus IDs, então a ordem definida no UNISTOCK é refletida corretamente no marketplace
2. **Performance**: Evita uploads desnecessários de imagens que já existem no ML
3. **Estabilidade**: Menos chamadas à API do ML = menor risco de erros
