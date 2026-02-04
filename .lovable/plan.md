
# Plano: Corrigir 404 no Deploy Vercel para SPA React

## Diagnóstico

O problema não está no `vite.config.ts` - a configuração atual está correta. O Vite já:
- Gera a pasta `dist/` por padrão
- Inclui `index.html` automaticamente
- Usa `base: '/'` como padrão

**O problema real**: A Vercel não sabe que seu projeto é uma SPA (Single Page Application) e tenta servir arquivos estáticos para cada rota. Quando você acessa `/app/produto`, ela busca um arquivo que não existe.

## Solução

Criar um arquivo `vercel.json` na raiz do projeto que instrui a Vercel a:
1. Redirecionar todas as rotas para `index.html`
2. Usar a pasta `dist` como output
3. Configurar o comando de build correto

## Implementação

### Arquivo a ser criado: `vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## Detalhes Técnicos

| Configuração | Propósito |
|--------------|-----------|
| `buildCommand` | Define explicitamente o comando de build |
| `outputDirectory` | Aponta para a pasta `dist` gerada pelo Vite |
| `framework` | Otimiza a Vercel para projetos Vite |
| `rewrites` | Redireciona TODAS as rotas para `index.html`, permitindo que o React Router gerencie a navegação |

## Por que isso resolve

Quando um usuário acessa `/app/produto`:
1. **Antes**: Vercel busca `/app/produto/index.html` → 404
2. **Depois**: Vercel serve `/index.html` → React Router renderiza a rota `/app/produto`

## Alternativa (se preferir Netlify)

Para Netlify, seria necessário criar `public/_redirects`:
```
/*    /index.html   200
```

## Passos após implementação

1. Commitar o `vercel.json` no repositório
2. Fazer novo deploy na Vercel
3. Testar as rotas `/app/dashboard`, `/app/produto`, etc.
