

# Transicoes Suaves entre Secoes da Landing Page

## Objetivo
Adicionar divisores visuais modernos e suaves entre cada secao da landing page, criando um fluxo visual elegante e continuo.

## Abordagem

Criar um componente `SectionDivider` reutilizavel que renderiza uma onda SVG com gradiente sutil entre as secoes. Esse padrao e amplamente usado em landing pages modernas (Stripe, Linear, Vercel).

## Secoes da Landing Page (em ordem)
1. Hero
2. Before vs After
3. Benefits
4. Features (Bento Grid)
5. Partners (Marquee)
6. Pricing
7. Final CTA
8. FAQ
9. Footer

Serao inseridos divisores entre cada par de secoes (7-8 divisores no total).

## Mudancas

### 1. Criar componente `src/components/ui/section-divider.tsx`

Componente simples que renderiza um SVG com curva suave (wave) e cores que fazem a transicao entre o fundo da secao anterior e o fundo da proxima. Props:
- `variant`: "wave" | "curve" | "angle" (diferentes formas de transicao)
- `flip`: boolean (inverter verticalmente para alternar direcao)
- `fromColor` / `toColor`: cores de fundo (usando classes Tailwind como `bg-background`, `bg-muted/30`)
- `className`: customizacao adicional

O SVG usa `viewBox` e `preserveAspectRatio` para ser responsivo, com altura de ~48-80px.

### 2. Modificar `src/pages/Landing.tsx`

Inserir o componente `SectionDivider` entre cada secao com variantes alternadas para criar ritmo visual:

- Hero -> Before vs After: wave
- Before vs After -> Benefits: curve (flip)
- Benefits -> Features: wave
- Features -> Partners: curve (flip)
- Partners -> Pricing: wave
- Pricing -> Final CTA: curve (flip)
- Final CTA -> FAQ: wave
- FAQ -> Footer: curve (flip)

As cores serao ajustadas automaticamente para combinar com o fundo de cada secao (ex: `background` -> `muted/30` -> `background`).

### 3. Adicionar CSS em `src/index.css`

Estilos minimos para o divisor:
- `width: 100%`, sem margin/padding entre secoes
- Cor do SVG path usa `fill: currentColor` com classes Tailwind
- Transicao suave de cor no dark mode

## Resultado Visual
Cada secao tera uma transicao suave em formato de onda/curva, eliminando as bordas retas entre secoes e criando um fluxo visual moderno e profissional.
