
# Corrigir Carrossel Infinito de Marketplaces - Abordagem JavaScript

## Problema Confirmado
Testei no browser e confirmei: o carrossel esta completamente estatico. A animacao CSS com `translateX(-50%)` nao esta funcionando porque o navegador nao esta calculando corretamente a largura do container `width: max-content` dentro de um pai com `overflow: hidden`.

## Solucao: Animacao com JavaScript (useEffect + requestAnimationFrame)

Abandonar a abordagem CSS pura (que falhou em multiplas tentativas) e usar uma animacao JavaScript simples e confiavel.

### Arquivo: `src/pages/Landing.tsx`

**Mudancas na secao Marketplaces (linhas ~559-609):**

1. Adicionar um `useRef` para o container do marquee e um `useEffect` que:
   - Mede a largura real de um conjunto de itens
   - Usa `requestAnimationFrame` para mover o container continuamente
   - Quando o deslocamento atinge a largura de um conjunto, reseta para 0 (loop infinito)
   - Pausa no hover

2. Estrutura HTML simplificada:
```text
marquee-container (overflow: hidden, w-full, ref)
  └── inner div (flex, gap-8, style transform via JS)
        ├── set 1: 7 marketplace cards (shrink-0)
        └── set 2: 7 marketplace cards (shrink-0, clone para loop)
```

3. Logica do efeito:
   - `scrollRef` aponta para o inner div
   - `offset` incrementa a cada frame (~0.5px por frame = ~30px/s)
   - Quando `offset >= largura de 1 conjunto`, reseta para 0
   - `transform: translateX(-${offset}px)` aplicado via style

### Arquivo: `src/index.css`

- Remover a classe `.animate-marquee` (nao sera mais usada para este carrossel)
- Manter `.marquee-container` com `overflow: hidden` e a mascara de gradiente
- Manter `.animate-marquee-reverse` caso seja usada em outro lugar

### Por que esta abordagem funciona
- `requestAnimationFrame` garante animacao fluida a 60fps
- Calculo de largura em pixels reais (nao percentual) elimina o problema de calculo do navegador
- Controle total sobre velocidade e pausa
- Padrao amplamente usado em producao para marquees

### Velocidade
- ~0.5px por frame a 60fps = ~30px/s
- 7 itens x 160px + gaps = ~1300px de largura por conjunto
- Ciclo completo a cada ~43 segundos (similar aos 30s do CSS original)
