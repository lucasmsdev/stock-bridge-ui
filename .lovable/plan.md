
# Corrigir Carrossel de Marketplaces

## Problema
O carrossel de marketplaces nao esta animando. Os logos aparecem estaticos. A causa raiz e que o container flex interno esta sendo limitado pela largura do pai, fazendo os itens ficarem comprimidos em vez de se estenderem horizontalmente para criar o efeito de loop infinito.

## Solucao

**Arquivo**: `src/pages/Landing.tsx` (secao Marketplaces, linha ~564-586)

Adicionar `style={{ width: 'max-content' }}` ou classe equivalente no div `.animate-marquee` para garantir que os itens se estendam alem do container visivel. Sem isso, o flex container nao tem conteudo "excedente" para animar.

Mudancas:
1. No div com classe `animate-marquee`, adicionar `gap-8` e `style={{ width: 'max-content' }}` para forcar os itens a se alinharem em uma unica linha sem quebra
2. Garantir que cada card de marketplace tenha `w-40` (largura fixa) para manter consistencia no loop

Isso permitira que a animacao CSS `translateX(-50%)` funcione corretamente, pois havera conteudo suficiente (4x duplicado) para criar um loop visual sem lacunas.
