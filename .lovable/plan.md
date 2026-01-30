

# Plano: Corrigir Erro de Exclusão de Slots Vazios na Amazon

## Problema Identificado

Quando o usuário sincroniza imagens com a Amazon e tem apenas 1 imagem na galeria, o sistema tenta **deletar os slots de imagens adicionais (1 a 8)** que podem nunca ter sido preenchidos. A Amazon retorna:

```
Error: Invalid empty value provided in patch at index of 1
```

Isso significa que não podemos enviar operações `DELETE` para slots que já estão vazios.

## Causa Raiz

No código atual (linhas 254-265 de `update-product-images/index.ts`):

```typescript
// Delete unused image slots (if user removed images)
for (let i = validImages.length; i <= 8; i++) {
  if (i > 0) {
    patches.push({
      op: 'delete',
      path: `/attributes/other_product_image_locator_${i}`
    });
  }
}
```

O problema é que o código **sempre tenta deletar** todos os slots não usados, independentemente de eles existirem ou não.

## Solução

**Antes de deletar um slot, verificar se ele existe no listing atual.** 

Modificar o fluxo para:
1. Buscar o listing atual via `getListingsItem` com `includedData=['attributes', 'summaries']`
2. Extrair quais slots `other_product_image_locator_X` existem atualmente
3. Só deletar os slots que realmente existem

## Implementacao Tecnica

### Arquivo: `supabase/functions/update-product-images/index.ts`

#### Mudanca 1: Expandir query do getListingsItem para incluir attributes

```typescript
// ANTES
query: {
  marketplaceIds: [marketplaceId],
  includedData: ['summaries'],
}

// DEPOIS
query: {
  marketplaceIds: [marketplaceId],
  includedData: ['summaries', 'attributes'],
}
```

#### Mudanca 2: Extrair slots de imagem existentes

```typescript
// Apos buscar o listing, identificar quais slots existem
const existingImageSlots = new Set<number>();

// Verificar slots 1-8
for (let i = 1; i <= 8; i++) {
  const locator = listingResponse?.attributes?.[`other_product_image_locator_${i}`];
  if (locator && locator.length > 0 && locator[0]?.media_location) {
    existingImageSlots.add(i);
  }
}
console.log(`Existing image slots: ${Array.from(existingImageSlots).join(', ')}`);
```

#### Mudanca 3: So deletar slots que existem

```typescript
// Delete only slots that actually exist
for (let i = validImages.length; i <= 8; i++) {
  if (i > 0 && existingImageSlots.has(i)) {
    console.log(`Deleting existing image slot ${i}`);
    patches.push({
      op: 'delete',
      path: `/attributes/other_product_image_locator_${i}`
    });
  }
  // Se o slot nao existe, simplesmente ignora
}
```

## Fluxo Corrigido

```text
1. Recebe lista de imagens para sincronizar (ex: 1 imagem)

2. Busca listing atual da Amazon (com attributes)
   ├─ Extrai productType
   └─ Extrai slots de imagem que existem (ex: slots 1, 2 preenchidos)

3. Constroi patches:
   ├─ REPLACE main_product_image_locator → imagem 1
   ├─ DELETE other_product_image_locator_1 (existe) ✓
   ├─ DELETE other_product_image_locator_2 (existe) ✓
   └─ IGNORA slots 3-8 (nao existem, nao precisa deletar)

4. Envia PATCH para Amazon → Sucesso
```

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `supabase/functions/update-product-images/index.ts` | Modificar logica de delete para verificar slots existentes |

## Sobre o Titulo "Manter o Mesmo Nome"

Pelos logs, o titulo na Amazon ainda mostra `Bambola Boneca Lola Baby Rosa Midia` mesmo apos alteracao. Isso e **comportamento normal da Amazon** - alteracoes de titulo e imagem podem levar:

- **15 minutos a 2 horas** para ofertas e estoque
- **Ate 24 horas** para titulo e imagens
- **Ate 48 horas** em casos extremos

O frontend deveria mostrar uma mensagem informando isso ao usuario.

