
# Plano: Sincronização Completa de Imagens com Amazon ✅ CONCLUÍDO

## Visão Geral

Completar a integração da Amazon para que todas as funcionalidades disponíveis no Mercado Livre e Shopify também funcionem com a Amazon: alterar nome, imagem, preço e estoque.

## Status Final

| Funcionalidade | Mercado Livre | Shopify | Amazon |
|----------------|---------------|---------|--------|
| Alterar nome | ✅ | ✅ | ✅ |
| Alterar preço | ✅ | ✅ | ✅ |
| Alterar estoque | ✅ | ✅ | ✅ |
| Alterar imagem principal | ✅ | ✅ | ✅ |
| Galeria de imagens (múltiplas) | ✅ | ✅ | ✅ |

## Implementação Realizada

### Função `updateAmazonImages` em `supabase/functions/update-product-images/index.ts`

- Suporta até 9 imagens (1 principal + 8 adicionais)
- Usa Amazon SP-API Listings Items API com operação `patchListingsItem`
- Busca `productType` real via `getListingsItem` antes de enviar PATCH
- Limpa slots de imagens não utilizados quando usuário remove fotos
- Tratamento de erros específicos (token expirado, catálogo bloqueado, produto não encontrado)
- Informa ao usuário que alterações podem levar até 24h para refletir

### Atributos de Imagem Suportados

- `main_product_image_locator` - imagem principal
- `other_product_image_locator_1` até `other_product_image_locator_8` - imagens adicionais

### Query da Integração Atualizada

Incluídos campos `marketplace_id` e `selling_partner_id` na busca de integração para Amazon.

## Limitações da Amazon

1. **Máximo de 9 imagens** (1 principal + 8 adicionais)
2. **Formatos aceitos**: JPEG, PNG, TIFF, GIF
3. **Tamanho máximo**: 10MB por imagem
4. **Requisitos de qualidade**: mínimo 1000px no lado maior para zoom
5. **Processamento assíncrono**: alterações podem levar até 24h para refletir
6. **Catálogo Amazon**: produtos vinculados a ASINs podem ter restrições de edição
