
# Melhorias de Design na Landing Page

## Visao Geral

5 melhorias principais na landing page: menu mobile hamburger, secao antes/depois, bento grid nos features, secao de testemunhos, e correcao do copyright para 2026.

---

## 1. Menu Mobile Hamburger

**Problema**: A navegacao `hidden md:flex` desaparece completamente no mobile. O usuario so ve o logo e o botao "Comece agora".

**Solucao**: Adicionar um botao hamburger (icone `Menu` / `X`) que abre um menu lateral (Sheet) com todos os links de navegacao.

**Detalhes tecnicos**:
- Usar o componente `Sheet` ja existente no projeto (`src/components/ui/sheet.tsx`)
- Botao hamburger visivel apenas em `md:hidden`
- Menu lateral com links: Inicio, Funcoes, Planos, FAQ, Login
- Fechar automaticamente ao clicar em um link

---

## 2. Secao Antes vs Depois

**Posicao**: Entre o Hero e a secao de Benefits atual (linha ~284).

**Conceito**: Dois cards lado a lado mostrando o contraste visual entre a vida SEM e COM o UniStock.

```text
+----------------------------+----------------------------+
|   ANTES (vermelho/cinza)   |   DEPOIS (verde/accent)    |
+----------------------------+----------------------------+
| x 4+ abas abertas          | v 1 painel unico           |
| x Planilhas manuais        | v Sincronizacao automatica |
| x Lucro estimado "no olho" | v Lucro real calculado     |
| x Estoque desatualizado    | v Estoque em tempo real    |
| x Horas perdidas por dia   | v Economize 3h/dia         |
+----------------------------+----------------------------+
```

**Detalhes tecnicos**:
- Dois `Card` com icones `X` (vermelho) e `CheckCircle` (verde/accent)
- Layout `grid md:grid-cols-2` com gap
- Card "Antes" com borda/fundo sutilmente avermelhado, card "Depois" com borda accent
- Animacao de entrada com CSS (fade-in)

---

## 3. Bento Grid nos Features

**Problema atual**: Os 6 cards de features sao todos iguais (`grid lg:grid-cols-3`), sem hierarquia visual.

**Solucao**: Transformar em Bento Grid onde os 2 features mais importantes (Sincronizacao Automatica e Analise de Lucro Real) ocupam mais espaco.

```text
+------------------+----------+
|  Sincronizacao   |   IA     |
|  (grande, 2 col) |          |
+--------+---------+----------+
| Vendas | Dashboards| Mais   |
|        |           | Vendidos|
+--------+-----------+--------+
```

**Detalhes tecnicos**:
- Manter os mesmos 6 features, mas os 2 primeiros com `md:col-span-2` ou tamanho maior
- Cards maiores com icone maior e descricao mais visivel
- Cards menores mantem o layout atual compacto
- Hover effects diferenciados por tamanho

---

## 4. Secao de Testemunhos

**Posicao**: Entre a secao de Integracoes e a secao de Pricing.

**Conceito**: 3 depoimentos de personas ficticias (como placeholder ate ter depoimentos reais), com badge "Depoimento ilustrativo" para transparencia.

**Conteudo dos depoimentos**:
1. "Antes eu gastava 3 horas por dia alternando entre marketplaces. Agora faco tudo em 20 minutos." - Vendedor Mercado Livre/Shopee
2. "Finalmente sei meu lucro real. Descobri que alguns produtos davam prejuizo e eu nem sabia." - Lojista multi-canal
3. "A sincronizacao de estoque me salvou de vender sem estoque. Isso acontecia toda semana antes." - Vendedor Amazon/Shopify

**Detalhes tecnicos**:
- Grid de 3 cards com avatar (iniciais), nome, cargo/contexto e depoimento
- Badge "Depoimento ilustrativo" discreto para transparencia
- Icone de aspas (`Quote`) ou estrelas para visual
- Layout responsivo: 1 coluna mobile, 3 colunas desktop

---

## 5. Copyright 2026

**Mudanca simples**: Linha 800, alterar `2025` para `2026`.

---

## Arquivo modificado

| Arquivo | Mudancas |
|---|---|
| `src/pages/Landing.tsx` | Menu mobile, secao antes/depois, bento grid, testemunhos, copyright |

## Ordem de implementacao

1. Menu mobile hamburger (header)
2. Secao antes vs depois (apos hero)
3. Bento grid nos features
4. Secao de testemunhos (antes do pricing)
5. Copyright 2026 (footer)
