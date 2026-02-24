

# SEO e Performance: Lazy Loading de Rotas + Otimizacao de Imagens

## O que sera feito

### 1. Lazy Loading de todas as rotas

Atualmente, **todas as 30+ paginas sao importadas no topo do `App.tsx`**, o que significa que o navegador baixa TODO o codigo de todas as paginas antes de mostrar qualquer coisa. Com lazy loading, cada pagina so e carregada quando o usuario acessa ela.

**Arquivo**: `src/App.tsx`

- Trocar todos os `import` estaticos por `React.lazy(() => import(...))`
- Envolver as rotas com `<Suspense fallback={<LoadingSpinner />}>` para mostrar um loading enquanto carrega
- Manter apenas os imports essenciais como estaticos (providers, layout)

Exemplo da mudanca:
```text
ANTES:  import Dashboard from "./pages/Dashboard";
DEPOIS: const Dashboard = lazy(() => import("./pages/Dashboard"));
```

### 2. Componente de Loading para o Suspense

**Arquivo**: `src/components/ui/loading-spinner.tsx` (Novo)

- Spinner simples e leve usando o logo do UniStock ou um indicador minimalista
- Centralizado na tela com animacao suave

### 3. Otimizacao de imagens na Landing Page

**Arquivo**: `src/pages/Landing.tsx`

- Adicionar `loading="lazy"` em todas as imagens abaixo do fold (seções Benefits, Features, Partners)
- Adicionar `loading="eager"` + `fetchpriority="high"` na imagem hero (acima do fold)
- Adicionar atributos `width` e `height` para evitar layout shift (CLS)
- Adicionar `decoding="async"` nas imagens lazy

### 4. Melhorias de SEO no `index.html`

**Arquivo**: `index.html`

- Trocar `lang="en"` para `lang="pt-BR"` (o site e em portugues)
- Atualizar OG image para usar uma imagem propria do UniStock (em vez do placeholder do Lovable)
- Adicionar meta tags: `theme-color`, `robots`, canonical URL
- Adicionar structured data (JSON-LD) basico para Organization

### 5. Meta tags por pagina (SEO dinamico)

**Arquivo**: `src/components/seo/PageMeta.tsx` (Novo)

- Componente reutilizavel que atualiza `document.title` e meta description por rota
- Usar nas paginas principais (Landing, Login, Signup, Checkout, Contato)

---

## Resumo dos arquivos

| Arquivo | Tipo | Descricao |
|---|---|---|
| `src/App.tsx` | Edicao | Lazy loading de todas as rotas com React.lazy + Suspense |
| `src/components/ui/loading-spinner.tsx` | Novo | Componente de loading para fallback do Suspense |
| `src/pages/Landing.tsx` | Edicao | Atributos de lazy loading e dimensoes nas imagens |
| `index.html` | Edicao | lang="pt-BR", meta tags SEO, structured data |
| `src/components/seo/PageMeta.tsx` | Novo | Componente para title/description dinamico por pagina |

## Impacto esperado

- **Bundle inicial ~70% menor**: Apenas o codigo da pagina acessada e carregado
- **LCP (Largest Contentful Paint) melhor**: Hero image com prioridade alta, demais com lazy
- **CLS (Cumulative Layout Shift) reduzido**: Dimensoes explicitas nas imagens
- **SEO**: Meta tags corretas em portugues, structured data para Google

