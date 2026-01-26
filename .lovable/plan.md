

# Correção: Adicionar "disconnected" à Constraint do Banco de Dados

## Problema Identificado

O erro 404 na Shopify está sendo detectado corretamente, mas a atualização do `sync_status` para `'disconnected'` está **falhando silenciosamente** porque existe uma constraint CHECK no banco de dados que só permite valores específicos.

### Evidência do Erro (Logs do Postgres)

```
new row for relation "product_listings" violates check constraint "product_listings_sync_status_check"
```

### Constraint Atual

```sql
CHECK ((sync_status = ANY (ARRAY['active', 'paused', 'error', 'deleted'])))
```

**O valor `'disconnected'` NÃO está na lista permitida.**

### Resultado

- A Edge Function tenta fazer `UPDATE ... SET sync_status = 'disconnected'`
- O banco rejeita por causa da constraint
- O status permanece como `'active'` mas com `sync_error = 'Not Found'`
- O produto nunca aparece como "desconectado" no frontend
- O botão "Republicar" nunca aparece

## Solução

Adicionar o valor `'disconnected'` à constraint CHECK existente.

## Arquivos a Modificar

### 1. Nova Migration SQL

**Criar arquivo**: `supabase/migrations/XXXXXX_add_disconnected_sync_status.sql`

```sql
-- Adicionar 'disconnected' como status válido para product_listings
-- Este status indica que o produto foi deletado no marketplace
-- e precisa ser republicado

ALTER TABLE product_listings 
  DROP CONSTRAINT IF EXISTS product_listings_sync_status_check;

ALTER TABLE product_listings 
  ADD CONSTRAINT product_listings_sync_status_check 
  CHECK (sync_status = ANY (ARRAY['active', 'paused', 'error', 'deleted', 'disconnected']));

-- Atualizar produtos que já estão com erro 404 para disconnected
UPDATE product_listings 
SET sync_status = 'disconnected' 
WHERE sync_status = 'error' 
  AND sync_error LIKE '%Not Found%';
```

### Nenhuma alteração adicional necessária

O código do frontend (`ProductDetails.tsx`) e da Edge Function (`sync-shopify-listing`) já estão corretos:

**Frontend (já implementado):**
- Linha 52: `status: 'disconnected'` está no tipo `ChannelStock`
- Linhas 124-129: `statusConfig.disconnected` com ícone e cores
- Linhas 475-510: Alert e botão "Republicar" para listings desconectados
- Linhas 145-201: Função `handleRepublish` funcional

**Edge Function (já implementado):**
- Linhas 185-206: Tratamento de 404 com `sync_status: 'disconnected'`

## Diagrama do Fluxo Corrigido

```text
┌──────────────────────────────────┐
│  Usuário edita produto           │
└──────────────┬───────────────────┘
               │
               v
┌──────────────────────────────────┐
│  sync-shopify-listing            │
│  PUT /products/{id}.json         │
└──────────────┬───────────────────┘
               │
               v
        ┌──────────────┐
        │ Resposta 404 │
        └──────┬───────┘
               │
               v
┌──────────────────────────────────────┐
│  UPDATE sync_status = 'disconnected' │
│  ✅ Constraint permite agora!        │
└──────────────┬───────────────────────┘
               │
               v
┌──────────────────────────────────────┐
│  Frontend detecta 'disconnected'     │
│  Mostra Alert + Botão "Republicar"   │
└──────────────────────────────────────┘
```

## Valores Finais do sync_status

| Valor         | Significado                              |
|---------------|------------------------------------------|
| `active`      | Sincronizando normalmente                |
| `paused`      | Sincronização pausada pelo usuário       |
| `error`       | Erro temporário (token, rede, etc)       |
| `deleted`     | Produto deletado localmente              |
| `disconnected`| Produto não existe mais no marketplace   |

## Teste Após Implementação

1. Executar a migration no Supabase
2. Acessar um produto com erro 404 (como o "Produto ")
3. Tentar editar qualquer campo
4. Verificar que o status muda para "disconnected"
5. Confirmar que aparece o Alert com botão "Republicar"
6. Clicar em "Republicar" 
7. Verificar que novo produto é criado na Shopify

## Benefícios

- **Detecção automática** de produtos deletados no marketplace
- **UI clara** mostrando o problema e a solução com um clique
- **Consistência** entre banco, Edge Function e frontend
- **Sem mais erros silenciosos** - constraint permite o valor correto

