

## Corrigir NaN no Valor Total da pagina de Pedidos

### Problema
O calculo do valor total esta quebrando porque o codigo tenta converter uma string de moeda formatada ("R$ 1.234,56") de volta para numero. O `Intl.NumberFormat` usa um espaco especial (non-breaking space) entre "R$" e o valor, entao o `replace("R$ ", "")` nao funciona e o `parseFloat` retorna `NaN`.

### Solucao
Guardar o valor numerico original junto com o valor formatado no objeto de pedido, e usar esse numero direto no calculo do total.

### Detalhes Tecnicos

**Arquivo: `src/pages/Orders.tsx`**

1. Adicionar campo `totalRaw` (tipo `number`) na interface `FormattedOrder` para armazenar o valor numerico original
2. No mapeamento dos pedidos (linha ~158), incluir `totalRaw: order.total_value` junto com o `total` formatado
3. Substituir o calculo do `totalValue` (linhas 255-258) para usar `order.totalRaw` diretamente em vez de tentar fazer parse da string formatada:

```text
Antes (quebrado):
  const value = parseFloat(order.total.replace("R$ ", "").replace(".", "").replace(",", "."));

Depois (correto):
  const totalValue = filteredOrders.reduce((sum, order) => sum + (order.totalRaw || 0), 0);
```

Essa abordagem e mais robusta porque elimina qualquer dependencia do formato da string de moeda.

