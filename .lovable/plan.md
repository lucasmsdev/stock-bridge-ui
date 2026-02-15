

# Painel Centralizado de Atribuicao na Aba ROI

## O que sera feito

### 1. Novo componente: AttributionManagerDialog
Um dialog completo com duas abas:

**Aba "Vinculos Ativos"** - Lista todos os vinculos campanha-produto existentes com:
- Nome da campanha, plataforma de ads, SKU do produto
- Toggle para ativar/desativar cada vinculo sem deletar
- Botao para remover vinculo
- Busca por campanha ou SKU

**Aba "Novo Vinculo"** - Formulario para criar novos vinculos:
- Select de produto (com busca entre todos os produtos do catalogo)
- Select de campanha (todas as campanhas sincronizadas de qualquer plataforma de ads)
- Datas de inicio/fim opcionais
- Preview do vinculo antes de salvar

### 2. Botoes na aba ROI (ProductROITab)
- **"Configurar Atribuicoes"** - Abre o dialog de gestao
- **"Processar Agora"** - Chama a Edge Function `attribute-conversions` sob demanda e atualiza a tabela

### 3. Coluna "Fonte" na tabela de ROI
Nova coluna mostrando a plataforma de ads que gerou o gasto (ex: "Meta Ads"), para o usuario ver exatamente de onde vem a atribuicao.

## Detalhes tecnicos

### Arquivos novos:
| Arquivo | Descricao |
|---------|-----------|
| `src/components/dashboard/AttributionManagerDialog.tsx` | Dialog com abas para gestao de vinculos e criacao de novos |

### Arquivos modificados:
| Arquivo | Alteracao |
|---------|-----------|
| `src/components/dashboard/ProductROITab.tsx` | Adicionar botoes "Configurar Atribuicoes" e "Processar Agora"; adicionar coluna "Fonte" na tabela |
| `src/hooks/useProductROI.tsx` | Incluir campo `platform` (plataforma de ads) nos dados retornados da query de attributed_conversions |

### Reutilizacao:
- `useCampaignLinks()` (sem productId) para listar todos os vinculos e campanhas disponiveis
- `useProductROI()` para lista de produtos
- Edge Function `attribute-conversions` ja existente para processamento sob demanda

