
# Plano: Galeria de Imagens na Página de Detalhes do Produto

## Resumo

Criar uma seção de galeria de imagens na página de detalhes do produto que exiba **todas as fotos armazenadas** no campo `images` do produto, com funcionalidades para **adicionar** e **excluir** fotos.

---

## Situação Atual

| O que existe | Comportamento |
|--------------|---------------|
| Campo `images` (JSON) | Existe na tabela `products` mas **não é exibido** na UI |
| `MarketplaceImagesCard` | Só aparece se o produto está **publicado em marketplaces** |
| `image_url` (string) | Usada como thumbnail em listagens |

### Problema

Quando o usuário clica em um produto, ele **não consegue ver todas as fotos** nem gerenciá-las localmente, pois o `MarketplaceImagesCard` só funciona para produtos publicados.

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────┐
│                 PÁGINA DE DETALHES DO PRODUTO                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           NOVO: ProductImagesGallery                     │   │
│  │                                                          │   │
│  │  • Exibe todas as fotos do campo products.images        │   │
│  │  • Permite adicionar fotos via upload ou URL            │   │
│  │  • Permite excluir fotos individuais                    │   │
│  │  • Permite reordenar (primeira = principal)             │   │
│  │  • Salva diretamente no banco (não no marketplace)      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           EXISTENTE: MarketplaceImagesCard               │   │
│  │                                                          │   │
│  │  • Gerencia imagens por marketplace                      │   │
│  │  • Sincroniza com API externa                            │   │
│  │  • Só aparece se produto está publicado                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementação

### Arquivo 1: Novo Componente - `ProductImagesGallery.tsx`

Criar: `src/components/products/ProductImagesGallery.tsx`

#### Funcionalidades

| Feature | Descrição |
|---------|-----------|
| Exibir galeria | Grid com todas as imagens do campo `images` |
| Upload local | Drag-and-drop ou seleção de arquivos |
| URL externa | Input para colar URLs de imagens |
| Excluir | Botão de lixeira em cada imagem |
| Reordenar | Setas para mover posição (primeira = principal) |
| Salvar | Atualiza `products.images` e `products.image_url` |

#### Estrutura do Componente

```typescript
interface ProductImagesGalleryProps {
  productId: string;
  initialImages: string[];
  onUpdate: (images: string[]) => void;
}

export function ProductImagesGallery({ 
  productId, 
  initialImages, 
  onUpdate 
}: ProductImagesGalleryProps) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Upload files to Supabase Storage
  const handleFileUpload = async (files: FileList) => { ... };
  
  // Add image by URL
  const handleAddUrl = (url: string) => { ... };
  
  // Remove image
  const handleRemove = (index: number) => { ... };
  
  // Reorder images
  const handleMove = (fromIndex: number, toIndex: number) => { ... };
  
  // Save to database
  const handleSave = async () => {
    const { error } = await supabase
      .from('products')
      .update({ 
        images: images,
        image_url: images[0] || null  // Primeira = principal
      })
      .eq('id', productId);
    
    if (!error) onUpdate(images);
  };
}
```

---

### Arquivo 2: Atualizar Interface do Product

Modificar: `src/pages/ProductDetails.tsx`

#### Mudança 1: Adicionar campo `images` na interface

```typescript
interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  cost_price?: number;
  selling_price?: number;
  ad_spend?: number;
  image_url?: string;
  supplier_id?: string;
  images?: string[];  // ← NOVO
}
```

---

### Arquivo 3: Adicionar Galeria na Página

Modificar: `src/pages/ProductDetails.tsx`

#### Mudança 2: Importar o novo componente

```typescript
import { ProductImagesGallery } from "@/components/products/ProductImagesGallery";
```

#### Mudança 3: Adicionar galeria logo após o título

Inserir entre o título do produto e o card de estoque central:

```tsx
{/* Product Images Gallery - NEW */}
<ProductImagesGallery
  productId={product.id}
  initialImages={product.images || []}
  onUpdate={(images) => {
    setProductDetails({
      ...productDetails,
      product: { ...product, images, image_url: images[0] || null }
    });
  }}
/>
```

---

## Layout Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│  ← Voltar                              [Calculadora de Lucro]   │
├─────────────────────────────────────────────────────────────────┤
│  Camiseta Polo Azul                                             │
│  SKU: SKU-0001                                                  │
├─────────────────────────────────────────────────────────────────┤
│  📷 Galeria de Imagens                                [Salvar]  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────────────────────┐    │   │
│  │  │     │  │     │  │     │  │  + Arrastar fotos   │    │   │
│  │  │ 🖼️  │  │ 🖼️  │  │ 🖼️  │  │    ou clicar       │    │   │
│  │  │ ✖️  │  │ ✖️  │  │ ✖️  │  │                     │    │   │
│  │  └─────┘  └─────┘  └─────┘  └─────────────────────┘    │   │
│  │  Principal  2       3                                   │   │
│  │                                                         │   │
│  │  [🔗 Adicionar por URL...                    ] [Add]    │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  📦 Estoque Central (UniStock)                                  │
│  ...                                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Dados

```text
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Upload/URL  │ ──► │  Supabase        │ ──► │  products.images│
│              │     │  Storage         │     │  (JSON array)   │
└──────────────┘     │  (product-images)│     └─────────────────┘
                     └──────────────────┘              │
                                                       ▼
                                               products.image_url
                                               (primeira imagem)
```

---

## Detalhes Técnicos

### Upload de Arquivos

O componente reutilizará a lógica existente do `MarketplaceImagesCard`:

- Upload para bucket `product-images` do Supabase
- Caminho: `{productId}/local/{timestamp}-{random}.{ext}`
- Formatos: JPEG, PNG, WebP
- Tamanho máximo: 10MB por arquivo

### Salvamento no Banco

```typescript
// Salvar array de imagens
await supabase
  .from('products')
  .update({ 
    images: newImagesArray,
    image_url: newImagesArray[0] || null  // Sincroniza thumbnail
  })
  .eq('id', productId);
```

### Exclusão de Imagem

1. Remove da array local
2. Se era do Storage, deleta o arquivo
3. Atualiza banco de dados

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/products/ProductImagesGallery.tsx` | Criar | Novo componente de galeria |
| `src/pages/ProductDetails.tsx` | Modificar | Adicionar campo `images` na interface e incluir galeria |

---

## Comportamento Esperado

| Cenário | Resultado |
|---------|-----------|
| Produto sem imagens | Área de upload vazia com "Adicione fotos" |
| Produto com imagens importadas | Grid exibindo todas as fotos |
| Adicionar foto via upload | Preview imediato, salva no Storage e atualiza banco |
| Adicionar foto via URL | Adiciona à array e salva no banco |
| Excluir foto | Remove da galeria e atualiza banco |
| Reordenar fotos | Move posição, primeira vira `image_url` principal |

---

## Benefícios

1. **Visibilidade completa** - Usuário vê todas as fotos importadas
2. **Gestão local** - Pode editar fotos sem precisar publicar
3. **Independência** - Funciona mesmo sem marketplaces conectados
4. **Sincronização** - Primeira imagem sempre reflete em `image_url`
