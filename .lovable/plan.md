

# Transicoes Clean entre Secoes

## O que muda

Remover todos os `SectionDivider` com ondas SVG (visual pesado e datado) e substituir por **gradientes CSS sutis** entre secoes. Essa abordagem e usada por sites como Linear, Vercel e Stripe - minimalista e moderna.

## Abordagem

Em vez de formas SVG entre secoes, cada secao tera um **gradiente de fundo suave** que faz a transicao naturalmente para a proxima. O efeito e quase invisivel, mas elimina cortes bruscos.

### Mudancas

**1. Deletar `src/components/ui/section-divider.tsx`** - nao sera mais necessario.

**2. Editar `src/pages/Landing.tsx`:**
- Remover todas as 8 instancias de `<SectionDivider ... />`
- Remover o import do `SectionDivider`
- Adicionar classes de gradiente sutil nas secoes que fazem transicao de cor:
  - Secoes com fundo `bg-muted/30` recebem `bg-gradient-to-b from-background to-muted/30` no inicio e `bg-gradient-to-b from-muted/30 to-background` no final
  - Isso cria um fade suave entre cores de fundo, sem elementos visuais extras
- Restaurar `border-t` no footer

### Resultado visual
- Zero elementos decorativos entre secoes
- Transicoes de cor acontecem naturalmente via gradiente CSS
- Visual limpo, moderno e profissional
- Funciona perfeitamente em light e dark mode

