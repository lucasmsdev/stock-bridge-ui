

# Pagina de Rastreio de Envios

## Resumo

Criar uma nova pagina dedicada ao rastreamento de entregas, acessivel a partir do menu lateral (dentro do grupo de Pedidos ou como item separado). A pagina mostrara todos os pedidos que foram enviados/em transito, com codigo de rastreio, transportadora, status de entrega e timeline de atualizacoes.

---

## O que e possivel tecnicamente

Sim, e possivel puxar rastreio direto dos marketplaces. Cada plataforma tem APIs para isso:

| Marketplace | API de Rastreio | Como funciona |
|-------------|----------------|---------------|
| Mercado Livre | `GET /orders/{id}/shipments` e `GET /shipments/{id}` | Retorna tracking_number, transportadora, status, historico |
| Amazon | SP-API Orders (fulfillment info) | Retorna tracking via fulfillment data |
| Shopify | Fulfillments API | Retorna tracking_number, tracking_url, tracking_company |
| Shopee | Logistics API | Retorna tracking info e timeline |
| Magalu | Seller API - Shipments | Retorna status de envio e codigo |

---

## O que sera criado

### 1. Coluna de rastreio na tabela `orders`

Adicionar campos via migracao SQL:

- `tracking_code` (text) - codigo de rastreio (ex: "BR123456789BR")
- `tracking_url` (text) - link direto para rastrear
- `carrier` (text) - nome da transportadora (ex: "Correios", "Jadlog")
- `shipping_status` (text) - status do envio (pending_shipment, shipped, in_transit, out_for_delivery, delivered, returned)
- `shipping_updated_at` (timestamptz) - ultima atualizacao do rastreio
- `shipping_history` (jsonb) - historico de eventos do rastreio

### 2. Edge Function `sync-tracking`

Nova edge function que:
- Busca todas as orders com status `shipped` ou `processing` que tenham integracao ativa
- Para cada marketplace, chama a API de rastreio correspondente
- Atualiza os campos de rastreio na tabela orders
- Pode ser chamada manualmente ou via cron

### 3. Pagina `/app/tracking` (Rastreio)

Interface com:

**Cards de resumo no topo:**
- Total de envios ativos
- Aguardando envio
- Em transito
- Entregues (ultimos 7 dias)

**Filtros:**
- Busca por codigo de rastreio, nome do cliente ou ID do pedido
- Filtro por marketplace
- Filtro por status de envio

**Tabela principal:**
- Pedido (ID + marketplace logo)
- Cliente
- Produto(s)
- Codigo de rastreio (com botao de copiar)
- Transportadora
- Status de envio (com badge colorido)
- Ultima atualizacao
- Acao: link externo para rastrear

**Detalhe expandivel** (ao clicar na linha):
- Timeline visual dos eventos de rastreio (historico)
- Mapa simplificado do progresso (barra de etapas)

### 4. Menu lateral

Adicionar "Rastreio" no sidebar como sub-item de "Pedidos", ou como item independente com icone `PackageSearch` do Lucide.

### 5. Dados demo de rastreio

Atualizar o `seed-demo-data` para:
- Pedidos com status `shipped` receberao codigos de rastreio ficticios (formato Correios: BR + 9 digitos + BR)
- Pedidos com status `completed`/`delivered` terao historico completo de rastreio
- Transportadoras variadas (Correios, Jadlog, Total Express, Sequoia)
- Timeline realista (postado > em transito > saiu para entrega > entregue) com datas proporcionais

---

## Detalhes tecnicos

### Arquivos a criar

1. **`src/pages/Tracking.tsx`** - Pagina principal de rastreio
2. **`supabase/functions/sync-tracking/index.ts`** - Edge function para sincronizar rastreio dos marketplaces

### Arquivos a modificar

1. **`src/App.tsx`** - Adicionar rota `/app/tracking`
2. **`src/components/layout/AppSidebar.tsx`** - Adicionar item "Rastreio" no menu
3. **`supabase/functions/seed-demo-data/index.ts`** - Gerar dados demo de rastreio
4. **`supabase/config.toml`** - Registrar nova edge function

### Migracao SQL

```text
ALTER TABLE orders ADD COLUMN tracking_code text;
ALTER TABLE orders ADD COLUMN tracking_url text;
ALTER TABLE orders ADD COLUMN carrier text;
ALTER TABLE orders ADD COLUMN shipping_status text DEFAULT 'pending_shipment';
ALTER TABLE orders ADD COLUMN shipping_updated_at timestamptz;
ALTER TABLE orders ADD COLUMN shipping_history jsonb DEFAULT '[]'::jsonb;
```

### Status de envio e cores

| Status | Label | Cor |
|--------|-------|-----|
| pending_shipment | Aguardando Envio | Amarelo |
| shipped | Postado | Azul |
| in_transit | Em Transito | Azul escuro |
| out_for_delivery | Saiu para Entrega | Laranja |
| delivered | Entregue | Verde |
| returned | Devolvido | Vermelho |

### Dados demo de rastreio

Para pedidos com status `shipped`:
- tracking_code: formato "BR" + 9 digitos + "BR" (Correios) ou "JADLOG" + 8 digitos
- carrier: Correios (60%), Jadlog (20%), Total Express (10%), Sequoia (10%)
- shipping_status: distribuicao entre in_transit (40%), shipped (30%), out_for_delivery (20%), delivered (10%)
- shipping_history: array de eventos com data e descricao

Para pedidos com status `completed`:
- shipping_status: delivered
- shipping_history: timeline completa de 4-5 eventos

