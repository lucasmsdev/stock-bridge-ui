
# Animacoes Modernas para a Landing Page UniStock

## Visao Geral

Implementar 8 tipos de animacao usando apenas CSS + IntersectionObserver nativo do React (sem dependencia externa), mantendo performance e acessibilidade.

---

## 1. Hook useScrollReveal - Base de tudo

Criar um hook customizado `useScrollReveal` que usa `IntersectionObserver` para detectar quando elementos entram na viewport e aplicar classes CSS de animacao.

**Arquivo novo**: `src/hooks/useScrollReveal.ts`

- Recebe `threshold` (0.1 default) e `triggerOnce` (true default)
- Retorna `ref` e `isVisible`
- Usa `IntersectionObserver` nativo, sem bibliotecas externas

---

## 2. Componente AnimatedSection

Criar componente wrapper reutilizavel que aplica animacoes de scroll.

**Arquivo novo**: `src/components/ui/animated-section.tsx`

Props:
- `animation`: "fade-up" | "fade-left" | "fade-right" | "scale" | "none"
- `delay`: numero em ms para stagger
- `children`: conteudo

---

## 3. Componente AnimatedCounter

Contador animado que conta de 0 ate o valor alvo quando entra na viewport.

**Arquivo novo**: `src/components/ui/animated-counter.tsx`

- Usa `useScrollReveal` para detectar entrada
- `requestAnimationFrame` para animacao suave
- Suporta prefixo/sufixo (ex: "3h", "R$ 97", "14 dias")

---

## 4. Novas keyframes CSS

**Arquivo modificado**: `src/index.css`

Adicionar keyframes:
- `fade-up`: opacity 0 + translateY(30px) para opacity 1 + translateY(0)
- `fade-left`: translateX(-30px) para 0
- `fade-right`: translateX(30px) para 0
- `float`: translateY oscilante para efeito de flutuacao
- `marquee`: translateX(0) para translateX(-50%) para loop infinito de logos
- `highlight-sweep`: background-position animado para efeito de destaque no texto
- `scroll-progress`: para a barra de progresso no header
- `glow-pulse`: box-shadow pulsante para hover em cards

---

## 5. Landing Page - Aplicar animacoes

**Arquivo modificado**: `src/pages/Landing.tsx`

### 5.1 Header - Barra de progresso de scroll
- Adicionar `div` fino no topo do header com width baseada em `scrollY / documentHeight`
- Cor primary, height 3px, transicao suave

### 5.2 Hero - Efeitos especiais
- Titulo com highlight animado no trecho "em um so lugar" (gradient sweep)
- Imagem do dashboard com animacao `float` (sobe e desce suavemente, 3s loop)
- Botoes CTA com hover glow pulsante

### 5.3 Before vs After - Staggered reveal
- Envolver cada card em `AnimatedSection` com delay diferente
- Itens da lista aparecem com stagger de 100ms cada

### 5.4 Benefits - Slide lateral
- Imagem entra da esquerda (`fade-left`)
- Lista de beneficios entra da direita (`fade-right`), com stagger por item

### 5.5 Features Bento Grid - Cascade reveal
- Cada card aparece com delay progressivo (index * 100ms)
- Hover com glow-pulse na borda

### 5.6 Integracoes - Logo Marquee
- Substituir grid estatico por marquee infinito horizontal
- Duas fileiras se movendo em direcoes opostas (opcional)
- Pause on hover

### 5.7 Pricing - Scale-in com stagger
- Cards de pricing aparecem com scale-in, delay progressivo
- Card "Mais vendido" com animacao de glow permanente na borda

### 5.8 FAQ - Accordion ja animado
- Manter animacoes existentes, apenas envolver secao em `AnimatedSection`

---

## 6. Acessibilidade

- Respeitar `prefers-reduced-motion`: desativar todas as animacoes quando o usuario prefere movimento reduzido
- Adicionar `@media (prefers-reduced-motion: reduce)` no CSS para desativar keyframes
- Todas as animacoes sao decorativas, nao bloqueiam conteudo

---

## Resumo de arquivos

| Arquivo | Acao |
|---|---|
| `src/hooks/useScrollReveal.ts` | Novo - hook IntersectionObserver |
| `src/components/ui/animated-section.tsx` | Novo - wrapper de animacao |
| `src/components/ui/animated-counter.tsx` | Novo - contador animado |
| `src/index.css` | Modificar - novas keyframes e classes |
| `src/pages/Landing.tsx` | Modificar - aplicar animacoes em todas as secoes |

## Performance

- Zero dependencias externas (sem Framer Motion, sem GSAP)
- IntersectionObserver nativo com `triggerOnce` para evitar re-renders
- CSS keyframes rodam na GPU (transform + opacity)
- Marquee usa CSS puro com `animation` infinito
- Estimativa de impacto no bundle: menos de 3KB adicionais
