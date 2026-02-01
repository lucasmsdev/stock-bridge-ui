
# Plano: Criar Páginas de Termos de Serviço e Política de Privacidade

## Visão Geral

Criar duas novas páginas públicas para o site:
1. **Termos de Serviço** (`/termos`) - condições de uso da plataforma
2. **Política de Privacidade** (`/privacidade`) - como dados são coletados e tratados

Ambas seguirão o mesmo padrão visual da página de Contato, com header consistente, conteúdo legal formatado e footer simples.

---

## Arquivos a Criar

### 1. `src/pages/TermsOfService.tsx`

Página com os termos de uso do UniStock incluindo:
- Aceitação dos termos
- Descrição do serviço
- Cadastro e conta do usuário
- Planos e pagamentos
- Uso aceitável
- Propriedade intelectual
- Limitação de responsabilidade
- Modificações nos termos
- Lei aplicável e foro

### 2. `src/pages/PrivacyPolicy.tsx`

Página com a política de privacidade incluindo:
- Dados coletados
- Como os dados são usados
- Compartilhamento com terceiros
- Cookies e tecnologias de rastreamento
- Segurança dos dados
- Direitos do usuário (LGPD)
- Retenção de dados
- Contato para questões de privacidade

---

## Arquivos a Modificar

### 1. `src/App.tsx`

Adicionar rotas públicas:
```typescript
<Route path="/termos" element={<TermsOfService />} />
<Route path="/privacidade" element={<PrivacyPolicy />} />
```

### 2. `src/pages/Landing.tsx`

Adicionar links no footer (seção "Links"):
- Link para Termos de Serviço
- Link para Política de Privacidade

---

## Estrutura Visual

Ambas as páginas seguirão este layout:

```text
+------------------------------------------+
|  [Logo]                    [Voltar ao site] |
+------------------------------------------+
|                                            |
|   Título Principal                         |
|   Última atualização: DD/MM/YYYY           |
|                                            |
|   +--------------------------------------+ |
|   | Seção 1 - Título                     | |
|   | Conteúdo do parágrafo...             | |
|   +--------------------------------------+ |
|                                            |
|   +--------------------------------------+ |
|   | Seção 2 - Título                     | |
|   | Conteúdo do parágrafo...             | |
|   +--------------------------------------+ |
|                                            |
|   ... (demais seções)                      |
|                                            |
+------------------------------------------+
|  © 2025 UNISTOCK. Todos os direitos...   |
+------------------------------------------+
```

---

## Detalhes Técnicos

| Item | Valor |
|------|-------|
| Componentes | Card, ScrollArea para conteúdo longo |
| Estilo | Tipografia clara, espaçamento generoso |
| Responsivo | Mobile-first, texto legível em todas as telas |
| Tema | Suporte a light/dark mode |
| Navegação | Botão "Voltar ao site" no header |

---

## Conteúdo Legal

O conteúdo será baseado em modelos padrão de SaaS brasileiros, adaptados para:
- Gestão de estoque multi-marketplace
- Integrações com Mercado Livre, Shopify, Amazon, Shopee
- Planos de assinatura mensal
- Conformidade com LGPD (Lei Geral de Proteção de Dados)

---

## Resultado Esperado

- Duas novas páginas acessíveis via `/termos` e `/privacidade`
- Links no footer da Landing page
- Design consistente com o resto do site
- Conteúdo legal básico pronto para revisão jurídica
