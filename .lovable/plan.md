
# Plano: Edicao em Massa de Produtos

## Objetivo

Implementar a funcionalidade de edicao em massa que permite aos usuarios selecionar multiplos produtos e atualizar campos especificos de todos eles de uma vez, economizando tempo e esforco.

---

## Como Funcionara

### Fluxo do Usuario

1. Usuario seleciona produtos usando os checkboxes na tabela
2. Barra de acoes aparece mostrando "X produtos selecionados"
3. Usuario clica em "Editar em Massa"
4. Modal abre com campos editaveis (apenas campos que fazem sentido editar em massa)
5. Usuario preenche apenas os campos que quer alterar
6. Sistema atualiza todos os produtos selecionados com os novos valores
7. Sincronizacao com marketplaces e executada para cada produto

### Campos Disponiveis para Edicao em Massa

| Campo | Tipo | Comportamento |
|-------|------|---------------|
| Preco de Venda | Numero | Aplica mesmo preco a todos |
| Preco de Custo | Numero | Aplica mesmo custo a todos |
| Estoque (Ajuste) | Numero | Duas opcoes: "Definir valor" ou "Adicionar/Subtrair" |
| Fornecedor | Select | Vincula mesmo fornecedor a todos |

Campos NAO incluidos (por serem unicos por produto): Nome, SKU, Imagem

---

## O Que Sera Criado

### 1. Componente BulkEditDialog

Novo componente que exibe o modal de edicao em massa.

```text
+--------------------------------------------------+
|  Editar 5 Produtos em Massa                      |
+--------------------------------------------------+
|                                                  |
|  Preco de Venda                                  |
|  [_______________________] R$                    |
|  [ ] Nao alterar                                 |
|                                                  |
|  Preco de Custo                                  |
|  [_______________________] R$                    |
|  [ ] Nao alterar                                 |
|                                                  |
|  Estoque                                         |
|  (o) Nao alterar                                 |
|  ( ) Definir valor: [____]                       |
|  ( ) Adicionar: [____]                           |
|  ( ) Subtrair: [____]                            |
|                                                  |
|  Fornecedor                                      |
|  [Selecione um fornecedor    v]                  |
|  [ ] Nao alterar                                 |
|                                                  |
|               [Cancelar]  [Aplicar Alteracoes]   |
+--------------------------------------------------+
```

### 2. Edge Function bulk-update-products

Nova Edge Function que processa a atualizacao de multiplos produtos de forma eficiente.

Responsabilidades:
- Receber array de IDs de produtos
- Validar que todos pertencem ao usuario
- Aplicar alteracoes em lote
- Disparar sincronizacao com marketplaces para cada produto
- Retornar resumo do resultado

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| src/components/products/BulkEditDialog.tsx | Criar | Modal de edicao em massa |
| supabase/functions/bulk-update-products/index.ts | Criar | Edge Function para update em lote |
| src/pages/Products.tsx | Modificar | Integrar o BulkEditDialog e conectar ao botao |
| supabase/config.toml | Modificar | Registrar nova Edge Function |

---

## Detalhes Tecnicos

### Interface do BulkEditDialog

```text
interface BulkEditFormData {
  sellingPrice?: number | null;       // null = nao alterar
  costPrice?: number | null;
  stockMode: 'none' | 'set' | 'add' | 'subtract';
  stockValue?: number;
  supplierId?: string | null;
}

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProducts: Product[];
  suppliers: Supplier[];
  onSuccess: () => void;
}
```

### Payload da Edge Function

```text
// Request
{
  productIds: string[];
  updates: {
    selling_price?: number;
    cost_price?: number;
    stock_mode?: 'set' | 'add' | 'subtract';
    stock_value?: number;
    supplier_id?: string;
  }
}

// Response
{
  success: boolean;
  updated: number;
  synced: number;
  errors: Array<{productId: string; error: string}>;
}
```

### Logica de Atualizacao de Estoque

```text
switch (stock_mode) {
  case 'set':
    // UPDATE SET stock = stock_value
    break;
  case 'add':
    // UPDATE SET stock = stock + stock_value
    break;
  case 'subtract':
    // UPDATE SET stock = GREATEST(0, stock - stock_value)
    break;
}
```

---

## Verificacoes de Permissao

- Apenas usuarios com `canWrite` (admin ou operator) podem usar edicao em massa
- O botao "Editar em Massa" ja esta condicionado a isso na barra de acoes
- A Edge Function valida que todos os produtos pertencem ao usuario autenticado

---

## Sincronizacao com Marketplaces

Para cada produto atualizado:
1. Buscar listings vinculados
2. Chamar funcoes de sync existentes (sync-amazon-listing, sync-mercadolivre-listing, sync-shopify-listing)
3. Coletar resultados e exibir resumo ao usuario

Toast final:
"5 produtos atualizados. 12/15 listings sincronizados com marketplaces."

---

## Ordem de Execucao

1. Criar Edge Function `bulk-update-products`
2. Registrar em `supabase/config.toml`
3. Criar componente `BulkEditDialog.tsx`
4. Integrar dialog em `Products.tsx`
5. Conectar botao "Editar em Massa" ao dialog
6. Testar fluxo completo
