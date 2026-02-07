

# Implementacao Real do Sync de Rastreio - Shopify, Amazon e Mercado Livre

## Resumo

Reescrever a Edge Function `sync-tracking` para realizar chamadas reais as APIs de rastreio dos 3 marketplaces conectados. A funcao ira buscar pedidos pendentes de atualizacao, descriptografar tokens, chamar as APIs de cada plataforma e atualizar os campos `tracking_code`, `carrier`, `shipping_status`, `shipping_history`, `tracking_url` e `shipping_updated_at` na tabela `orders`.

---

## Como funciona cada API

### Mercado Livre
- **Endpoint**: `GET /orders/{order_id}/shipments` retorna o `shipment_id`
- **Detalhes**: `GET /shipments/{shipment_id}` retorna `tracking_number`, `tracking_url`, `status`, `substatus`, `date_created`, `last_updated`, e `tracking_method` (transportadora)
- **Status possiveis**: `pending`, `handling`, `ready_to_ship`, `shipped`, `delivered`, `not_delivered`, `cancelled`
- **Requer**: Header `X-Format-New: true` para o JSON atualizado

### Amazon SP-API
- **Limitacao importante**: A API de Orders (`GET /orders/v0/orders/{orderId}`) retorna o `FulfillmentChannel` (AFN = FBA, MFN = Seller) mas NAO retorna tracking numbers diretamente para pedidos MFN
- **Para pedidos FBA**: O tracking esta disponivel via relatarios (`GET_AMAZON_FULFILLED_SHIPMENTS_DATA_GENERAL`)
- **Abordagem pratica**: Buscar o campo `LatestShipDate`, `LatestDeliveryDate` e `OrderStatus` para inferir o estado de envio. Para pedidos FBA, verificar se o status e `Shipped` e marcar como em transito
- **Status uteis**: `Pending`, `Unshipped`, `Shipped`, `Canceled`

### Shopify
- **Endpoint**: `GET /admin/api/2024-01/orders/{order_id}/fulfillments.json`
- **Retorna**: Array de fulfillments, cada um com `tracking_number`, `tracking_url`, `tracking_company`, `shipment_status` e `updated_at`
- **Status possiveis**: `confirmed`, `in_transit`, `out_for_delivery`, `attempted_delivery`, `delivered`, `failure`
- API mais completa e direta para tracking

---

## O que sera modificado

### 1. `supabase/functions/sync-tracking/index.ts` (reescrita completa)

A funcao sera reestruturada com:

**Autenticacao e setup**:
- Valida JWT do usuario
- Cria cliente Supabase com service role key
- Busca integracoes ativas do usuario (mercadolivre, shopify, amazon)
- Busca pedidos com `shipping_status` em (`pending_shipment`, `shipped`, `in_transit`, `out_for_delivery`) OU pedidos com status `shipped`/`processing` sem `shipping_status`

**Token handling** (reutilizando o padrao do `sync-orders`):
- Descriptografa `encrypted_access_token` via `decrypt_token` RPC
- Para Shopify: usa direto (nao expira)
- Para ML e Amazon: descriptografa e usa (refresh e feito pelo cron separado)

**Provider de rastreio para Mercado Livre**:
- Para cada pedido ML: `GET /orders/{order_id_channel}/shipments` com Bearer token
- Extrai `shipment_id` da resposta
- Faz `GET /shipments/{shipment_id}` para obter detalhes completos
- Mapeia status ML para nosso status: `handling`/`ready_to_ship` -> `pending_shipment`, `shipped` -> `in_transit`, `delivered` -> `delivered`, `not_delivered` -> `returned`
- Extrai `tracking_number`, `tracking_url` (do campo `tracking_method`), e nome da transportadora
- Constroi historico a partir dos dados de status

**Provider de rastreio para Shopify**:
- Para cada pedido Shopify: `GET /admin/api/2024-01/orders/{order_id_channel}/fulfillments.json`
- Pega o primeiro fulfillment ativo (mais recente)
- Extrai `tracking_number`, `tracking_url`, `tracking_company`
- Mapeia `shipment_status`: `confirmed` -> `shipped`, `in_transit` -> `in_transit`, `out_for_delivery` -> `out_for_delivery`, `delivered` -> `delivered`
- Se nao tem fulfillment, mantem `pending_shipment`

**Provider de rastreio para Amazon**:
- Para cada pedido Amazon: `GET /orders/v0/orders/{order_id_channel}` para verificar `OrderStatus`
- Mapeia: `Unshipped`/`Pending` -> `pending_shipment`, `Shipped` -> `in_transit` (para FBA/AFN) ou `shipped` (para MFN), `Canceled` -> ignora
- Atualiza `shipping_status` e `shipping_updated_at` baseado nos dados disponiveis

**Atualizacao no banco**:
- Para cada pedido atualizado, faz UPDATE na tabela `orders` com os novos dados
- Adiciona eventos ao `shipping_history` (JSONB array) sem duplicar eventos existentes
- Atualiza `shipping_updated_at` com timestamp atual

**Resposta**:
- Retorna resumo: total verificado, total atualizado, erros por plataforma

### 2. `src/pages/Tracking.tsx` (ajuste menor)

- Incluir pedidos com status `shipped` ou `processing` que ainda nao tem `shipping_status` preenchido na query, para que aparecam como "Aguardando Envio" na tela
- Isso garante que pedidos recem-sincronizados (via sync-orders) aparecam na tela de rastreio mesmo antes do primeiro sync-tracking

---

## Detalhes tecnicos

### Mapeamento de status por plataforma

```text
Mercado Livre:
  pending/handling/ready_to_ship -> pending_shipment
  shipped                        -> in_transit
  delivered                      -> delivered
  not_delivered                  -> returned
  cancelled                     -> (ignora)

Shopify:
  (sem fulfillment)              -> pending_shipment
  confirmed                     -> shipped
  in_transit                    -> in_transit
  out_for_delivery              -> out_for_delivery
  delivered                     -> delivered
  failure                       -> returned

Amazon:
  Pending/Unshipped              -> pending_shipment
  PartiallyShipped              -> shipped
  Shipped                       -> in_transit
  Canceled                      -> (ignora)
```

### Estrutura do shipping_history (JSONB)

Cada evento segue o formato:
```text
{
  "date": "2026-02-05T14:30:00Z",
  "status": "in_transit",
  "description": "Objeto em transito - Curitiba/PR",
  "location": "Curitiba/PR"
}
```

### Arquivos modificados

1. **`supabase/functions/sync-tracking/index.ts`** - Reescrita com implementacao real
2. **`src/pages/Tracking.tsx`** - Query ajustada para incluir pedidos sem shipping_status

### Deploy

- Deploy da edge function `sync-tracking` apos as alteracoes

