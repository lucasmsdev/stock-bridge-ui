

# Plano: Corrigir Sincronização de Imagens com Shopify

## Diagnóstico

### Problema 1: Imagens sumiram da Shopify
A Edge Function reporta sucesso `"Shopify images updated: 2"` mas as imagens não aparecem na loja.

**Causa raiz identificada:**
| Item | Descrição |
|------|-----------|
| URL do Supabase | A imagem local está hospedada no Supabase Storage, que pode ter problemas de acesso externo |
| Substituição total | A Shopify API substitui TODAS as imagens quando enviamos o array - se uma falhar, pode afetar as outras |
| Sem validação | A função não verifica se as URLs são acessíveis antes de enviar para a Shopify |

### Problema 2: Importação sem imagens
O `platform_metadata.images` está vazio (`[]`) indicando que na hora da importação o produto não tinha imagens na Shopify.

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────┐
│  ANTES (problema)                                                │
│                                                                   │
│  URLs do Supabase Storage + URLs Shopify                         │
│         ↓                                                         │
│  Envia todas para Shopify API                                    │
│         ↓                                                         │
│  Shopify não consegue baixar URL do Supabase                     │
│         ↓                                                         │
│  IMAGENS SOMEM ou são parcialmente ignoradas                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  DEPOIS (corrigido)                                              │
│                                                                   │
│  URLs do Supabase Storage + URLs Shopify                         │
│         ↓                                                         │
│  Verifica se URL é acessível externamente                        │
│         ↓                                                         │
│  Se for Supabase Storage → faz upload direto via base64          │
│         ↓                                                         │
│  IMAGENS FUNCIONAM corretamente                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementação

### Arquivo 1: `supabase/functions/update-product-images/index.ts`

#### Mudança A: Adicionar função para converter imagem em base64 para Shopify

```typescript
async function prepareImageForShopify(imageUrl: string): Promise<{ src?: string; attachment?: string } | null> {
  try {
    // Se for URL do CDN da Shopify, usar diretamente
    if (imageUrl.includes('cdn.shopify.com')) {
      return { src: imageUrl };
    }
    
    // Para outras URLs (Supabase, externas), baixar e enviar como base64
    console.log(`Downloading image for Shopify upload: ${imageUrl}`);
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status} - ${imageUrl}`);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    
    console.log(`Image converted to base64: ${buffer.byteLength} bytes`);
    return { attachment: base64 };
    
  } catch (error) {
    console.error(`Error preparing image: ${error.message}`);
    return null;
  }
}
```

#### Mudança B: Atualizar função updateShopifyImages

**Antes (linha 325-341):**
```typescript
const shopifyImages = images.map((url, index) => ({
  src: url,
  position: index + 1,
}));
```

**Depois:**
```typescript
// Preparar imagens - converter para base64 se necessário
const preparedImages: any[] = [];
for (let i = 0; i < images.length; i++) {
  const imageData = await prepareImageForShopify(images[i]);
  if (imageData) {
    preparedImages.push({
      ...imageData,
      position: i + 1,
    });
  } else {
    console.warn(`Skipping invalid image at position ${i + 1}: ${images[i]}`);
  }
}

if (preparedImages.length === 0) {
  return { 
    success: false, 
    error: 'Nenhuma imagem válida para enviar à Shopify',
    code: ErrorCodes.VALIDATION_ERROR 
  };
}

console.log(`Sending ${preparedImages.length} images to Shopify`);
```

#### Mudança C: Atualizar platform_metadata após sincronização bem-sucedida

**Adicionar após linha 363 (depois do response.json()):**
```typescript
const data = await response.json();
console.log('Shopify images updated:', data.product?.images?.length);

// Atualizar platform_metadata com as novas imagens da Shopify
if (data.product?.images) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Buscar metadata atual e mesclar com novas imagens
  const { data: currentListing } = await supabase
    .from('product_listings')
    .select('platform_metadata')
    .eq('id', listingId)
    .single();
  
  const updatedMetadata = {
    ...(currentListing?.platform_metadata || {}),
    images: data.product.images,
  };
  
  await supabase
    .from('product_listings')
    .update({ platform_metadata: updatedMetadata })
    .eq('id', listingId);
    
  console.log('Platform metadata updated with new Shopify images');
}
```

---

### Arquivo 2: `supabase/functions/import-products/index.ts`

#### Mudança: Garantir que imagens sejam capturadas corretamente

**Verificar linha 490-500:**
```typescript
// Extrair todas as imagens do Shopify
const allImages = product.images?.map((img: any) => img.src).filter(Boolean) || [];
```

Adicionar log para debug:
```typescript
console.log(`📸 Produto ${product.title}: ${allImages.length} imagens encontradas`);
if (allImages.length === 0 && product.image?.src) {
  console.log(`  ↳ Usando imagem principal: ${product.image.src}`);
  allImages.push(product.image.src);
}
```

---

## Fluxo Corrigido

```text
┌────────────────────┐
│  Usuário adiciona  │
│  imagem local      │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Upload para       │
│  Supabase Storage  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────────────────────────────┐
│  Clica "Salvar e Sincronizar"              │
└─────────┬──────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────┐
│  Edge Function detecta URL Supabase         │
│         ↓                                   │
│  Baixa imagem e converte para base64       │
│         ↓                                   │
│  Envia { attachment: base64 } para Shopify │
└─────────┬──────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────┐
│  Shopify processa e retorna CDN URLs       │
│         ↓                                   │
│  Atualiza platform_metadata com novas URLs │
│         ↓                                   │
│  Retorna sucesso ao frontend               │
└────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/update-product-images/index.ts` | Upload base64 para Shopify + atualizar metadata |
| `supabase/functions/import-products/index.ts` | Melhorar captura de imagens na importação |

---

## Por que as imagens sumiram?

A Shopify recebeu a requisição com 2 URLs:
1. `https://cdn.shopify.com/...` ✅ (acessível)
2. `https://fcvwogaqarkuqvumyqqm.supabase.co/storage/...` ❓ (pode ter falhado)

Quando a Shopify não consegue baixar uma URL:
- Ela pode ignorar silenciosamente
- Ou pode falhar parcialmente

O resultado `"Shopify images updated: 2"` vem da resposta da API, mas não significa que as 2 imagens foram salvas com sucesso.

---

## Benefícios

1. **Compatibilidade total**: Imagens do Supabase Storage funcionarão corretamente
2. **Feedback preciso**: Logs mostrarão exatamente quais imagens falharam
3. **Metadata atualizado**: O `platform_metadata.images` refletirá as imagens reais na Shopify
4. **Importação corrigida**: Capturará todas as imagens disponíveis

---

## Testes Esperados

| Cenário | Resultado |
|---------|-----------|
| Adicionar imagem local → sincronizar | Imagem aparece na Shopify via upload base64 |
| Reordenar imagens → sincronizar | Ordem reflete corretamente na Shopify |
| Importar produto com imagens | Todas as imagens são capturadas |
| Imagem com URL inválida | Aviso no toast + outras imagens sincronizam |

