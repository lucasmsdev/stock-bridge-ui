
# Plano: Corrigir Sincronização de Imagens com Mercado Livre

## Problema Identificado

Os logs mostram dois cenários de falha:

| Erro | Causa | Solução |
|------|-------|---------|
| `"Processing image..."` | ML não consegue baixar imagem do Supabase (erro 403/timeout) | Upload direto via multipart para API do ML |
| `"pictures is not modifiable"` | Anúncio de catálogo tem imagens bloqueadas | Detectar e informar usuário |

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO ATUAL (FALHA)                                      │
│                                                                              │
│  Supabase Storage URL ─────► ML tenta baixar ─────► 403/Timeout ─────► ❌   │
│                              (servidores bloqueados)                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO NOVO (FUNCIONA)                                    │
│                                                                              │
│  1. Baixar imagem do Supabase Storage (servidor → servidor)                 │
│  2. Upload multipart para /pictures/items/upload                            │
│  3. Receber picture_id do ML                                                │
│  4. Atualizar item com { pictures: [{ id: "picture_id" }] }                 │
│                                                                              │
│  Imagem ──► Edge Function ──► ML Multipart API ──► picture_id ──► ✅        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementação

### Arquivo: `supabase/functions/update-product-images/index.ts`

#### Mudança 1: Nova função para upload multipart

```typescript
async function uploadImageToMercadoLivre(
  accessToken: string,
  imageUrl: string
): Promise<{ success: boolean; pictureId?: string; error?: string }> {
  try {
    // 1. Baixar a imagem
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return { success: false, error: `Não foi possível baixar: ${imageUrl}` };
    }
    
    const imageBlob = await imageResponse.blob();
    
    // 2. Criar FormData para multipart upload
    const formData = new FormData();
    formData.append('file', imageBlob, 'image.jpg');
    
    // 3. Upload para ML
    const uploadResponse = await fetch(
      'https://api.mercadolibre.com/pictures/items/upload',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData,
      }
    );
    
    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      return { success: false, error: errorData.message || 'Erro no upload' };
    }
    
    const data = await uploadResponse.json();
    return { success: true, pictureId: data.id };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

#### Mudança 2: Refatorar `updateMercadoLivreImages`

```typescript
async function updateMercadoLivreImages(
  accessToken: string, 
  itemId: string, 
  images: string[]
): Promise<{ success: boolean; error?: string }> {
  console.log(`Updating ML images for item: ${itemId}`);
  
  // 1. Verificar se item é de catálogo (não permite edição de fotos)
  const itemCheck = await fetch(
    `https://api.mercadolibre.com/items/${itemId}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  const itemData = await itemCheck.json();
  
  if (itemData.catalog_listing) {
    return { 
      success: false, 
      error: 'Este anúncio é de catálogo. Imagens não podem ser alteradas pelo vendedor.' 
    };
  }
  
  // 2. Para cada imagem, fazer upload multipart e coletar IDs
  const pictureIds: string[] = [];
  
  for (const imageUrl of images) {
    // Se já é uma URL do ML (mlstatic.com), extrair o ID existente
    if (imageUrl.includes('mlstatic.com') || imageUrl.includes('mercadolibre.com')) {
      const match = imageUrl.match(/(\d+-[A-Z]{3}\d+)/);
      if (match) {
        pictureIds.push(match[1]);
        continue;
      }
    }
    
    // Upload de imagens externas via multipart
    const result = await uploadImageToMercadoLivre(accessToken, imageUrl);
    if (result.success && result.pictureId) {
      pictureIds.push(result.pictureId);
    } else {
      console.log(`Falha ao fazer upload: ${imageUrl} - ${result.error}`);
    }
  }
  
  if (pictureIds.length === 0) {
    return { success: false, error: 'Nenhuma imagem foi processada com sucesso.' };
  }
  
  // 3. Atualizar item com os IDs das imagens
  const updateResponse = await fetch(
    `https://api.mercadolibre.com/items/${itemId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pictures: pictureIds.map(id => ({ id }))
      }),
    }
  );
  
  if (!updateResponse.ok) {
    const errorData = await updateResponse.json();
    
    // Detectar erro de catálogo
    if (errorData.cause?.some(c => c.code === 'field_not_updatable')) {
      return { 
        success: false, 
        error: 'As imagens deste anúncio não podem ser alteradas (anúncio de catálogo ou com vendas).' 
      };
    }
    
    return { success: false, error: errorData.message || 'Erro ao atualizar imagens' };
  }
  
  console.log(`ML images updated: ${pictureIds.length} imagens`);
  return { success: true };
}
```

---

## Fluxo de Dados Atualizado

```text
┌────────────────────┐
│  Usuário clica     │
│  "Salvar e Sync"   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Salva no banco    │
│  products.images   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────────────────────────────────────────────┐
│  Edge Function: update-product-images                       │
│                                                              │
│  Para cada imagem:                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ É URL do ML (mlstatic.com)?                          │  │
│  │ ├─ SIM: Extrair picture_id existente                 │  │
│  │ └─ NÃO: Fazer upload multipart → obter novo ID       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  PUT /items/{id} com { pictures: [{ id: "..." }, ...] }    │
└─────────┬──────────────────────────────────────────────────┘
          │
          ▼
┌────────────────────┐
│  ✅ Imagens        │
│  atualizadas no ML │
└────────────────────┘
```

---

## Tratamento de Erros Específicos

| Situação | Mensagem ao Usuário |
|----------|---------------------|
| Anúncio de catálogo | "Este anúncio é de catálogo. As imagens são gerenciadas pelo Mercado Livre." |
| Anúncio com vendas (título bloqueado) | "As imagens deste anúncio não podem ser alteradas." |
| URL inacessível | "Não foi possível processar a imagem: [URL]. Verifique se é uma URL pública." |
| Token expirado | "Token expirado. Reconecte sua conta do Mercado Livre." |

---

## Arquivos a Modificar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/update-product-images/index.ts` | Implementar upload multipart e detecção de anúncios bloqueados |

---

## Benefícios

1. **Funciona com qualquer URL**: Upload passa pela Edge Function, não depende de ML acessar URLs externas
2. **Feedback claro**: Mensagens específicas para cada tipo de erro
3. **Reutiliza IDs existentes**: Se imagem já é do ML, não faz upload desnecessário
4. **Compatível com catálogo**: Detecta e informa quando imagens são bloqueadas

---

## Testes Esperados

| Cenário | Resultado Esperado |
|---------|-------------------|
| Upload de imagem local (Supabase) | Imagem aparece corretamente no anúncio |
| Upload de URL externa (HTTP/HTTPS) | Imagem processada e exibida |
| Anúncio de catálogo | Toast informando bloqueio |
| Exclusão de imagem | Imagem removida do anúncio |
| Reordenação | Nova ordem refletida no ML |
