
# Consulta Automática de Taxas do Mercado Livre + Aviso nas Demais Plataformas

## Resumo

Implementar a consulta automática de comissões do Mercado Livre via API oficial (`/sites/MLB/listing_prices`) e adicionar um aviso informativo nas demais plataformas explicando por que as taxas precisam ser ajustadas manualmente.

## O que muda para o usuário

1. **Mercado Livre**: Um botao "Atualizar taxas" dentro do accordion da plataforma que consulta a API oficial e atualiza a comissao real com base na categoria dos produtos do usuario.
2. **Demais plataformas**: Um aviso discreto (tooltip ou texto explicativo) informando que aquela plataforma nao disponibiliza API publica de taxas, e que os valores devem ser conferidos manualmente.

## Por que so o Mercado Livre?

| Plataforma | API publica de taxas? | Motivo |
|---|---|---|
| Mercado Livre | Sim - `/sites/MLB/listing_prices` | Unica plataforma que expoe endpoint publico com comissoes por categoria, tipo de anuncio e nivel do vendedor |
| Amazon | Nao | Taxas variam por categoria e programa (FBA/FBM), mas nao ha endpoint publico. Dados disponiveis apenas no Seller Central |
| Shopee | Nao | Comissoes dependem do nivel do vendedor e campanhas ativas. Sem API publica |
| Shopify | N/A | Shopify nao cobra comissao sobre vendas, apenas taxa do gateway de pagamento |
| Magalu | Nao | API do marketplace nao expoe estrutura de comissoes |
| SHEIN | Nao | Plataforma fechada, sem documentacao publica de APIs |
| TikTok Shop | Nao | API de seller nao inclui endpoint de consulta de taxas |

## Implementacao Tecnica

### 1. Nova Edge Function: `get-mercadolivre-fees`

- Recebe `category_id` e `price` como parametros
- Consulta `https://api.mercadolibre.com/sites/MLB/listing_prices?category_id={id}&price={price}`
- Retorna a comissao (sale_fee_amount) e detalhes por tipo de listagem (classico, premium)
- Nao requer autenticacao (endpoint publico do ML)

### 2. Alteracoes no `FinancialSettings.tsx`

- **Mercado Livre**: Adicionar botao "Atualizar taxas via API" no accordion. Ao clicar, busca as categorias dos produtos cadastrados e consulta a edge function para obter a comissao media real.
- **Demais plataformas**: Adicionar um pequeno texto/badge "Manual" com tooltip explicando: "Esta plataforma nao disponibiliza API publica para consulta automatica de taxas. Verifique os valores no painel do vendedor."
- Badge visual diferenciando: "Automatico" (verde, para ML) vs "Manual" (amarelo, para as demais)

### 3. Alteracoes no `useMarketplaceFees.ts`

- Adicionar funcao `fetchMercadoLivreFees(categoryId, price)` que chama a edge function
- Adicionar mutation para atualizar o `commission_percent` do perfil ML com o valor real retornado pela API

### 4. Fluxo

```
Usuario clica "Atualizar taxas" no ML
  -> Frontend busca categorias dos produtos ML cadastrados
  -> Chama edge function get-mercadolivre-fees para cada categoria
  -> Calcula media ponderada da comissao
  -> Atualiza marketplace_fee_profiles com valor real
  -> Toast de confirmacao
```

### Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| `supabase/functions/get-mercadolivre-fees/index.ts` | Criar - Edge function para consultar API do ML |
| `src/hooks/useMarketplaceFees.ts` | Modificar - Adicionar mutation para fetch de taxas ML |
| `src/components/expenses/FinancialSettings.tsx` | Modificar - Botao de atualizacao no ML + badges Manual/Automatico + tooltips explicativos |
