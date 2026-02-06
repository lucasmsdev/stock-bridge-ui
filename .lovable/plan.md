

## Tornar os Dados Demo Mais Realistas

### Problema Atual
Os dados gerados mostram valores exagerados porque combinam:
- Produtos muito caros (iPhone R$8.499, Notebook R$5.299)
- Volume alto de pedidos (35-45 por dia, 500+ no total)
- Ordens com quantidades multiplicadas por precos altos

Isso gera faturamentos de R$180k+ que nao refletem a realidade de um e-commerce pequeno/medio.

### O Que Vai Mudar

**1. Produtos com precos mais acessiveis**
- Remover itens premium como iPhone (R$8.499) e Notebook Gamer (R$5.299)
- Substituir por produtos mais comuns no e-commerce brasileiro (capinhas, camisetas, organizadores, etc.)
- Faixa de preco: R$29 a R$349 (maioria abaixo de R$200)

**2. Volume de pedidos mais realista**
- Hoje: 8-15 pedidos (em vez de 35-45)
- Ultimos 7 dias: 5-12 por dia (em vez de 20-30)
- Dias 8-30: 3-8 por dia (em vez de 10-20)
- Dias 31-90: 1-5 por dia (em vez de 5-12)
- Total: ~200 pedidos (em vez de 500+)

**3. Despesas proporcionais**
- Google Ads: R$1.500 (em vez de R$5.000)
- Meta Ads: R$800 (em vez de R$3.500)
- Funcionarios: R$1.800 e R$1.500 (em vez de R$2.800 e R$2.200)
- Aluguel: R$1.800 (em vez de R$3.500)
- Total mensal de despesas: ~R$8.500 (em vez de ~R$20.500)

**4. Campanhas de ads com budgets menores**
- Budgets diarios entre R$15 e R$80 (em vez de R$60 a R$350)
- Mais condizente com e-commerce pequeno/medio

### Resultado Esperado
- Faturamento mensal: ~R$25.000-35.000 (realista para operacao solo/equipe pequena)
- Margem liquida mantendo o minimo de 25%
- Valores que o usuario reconhece como "possiveis" no seu negocio

### Detalhes Tecnicos

**Arquivo: `supabase/functions/seed-demo-data/index.ts`**

Atualizar o array `products` (linhas 46-72) com produtos mais acessiveis:

```text
Exemplos de novos produtos:
- Capinha Silicone Premium (R$39, custo R$12)
- Camiseta Algodao Estampada (R$59, custo R$22)
- Fone de Ouvido Bluetooth (R$89, custo R$35)
- Organizador de Mesa MDF (R$79, custo R$30)
- Pelicula Vidro Temperado Kit 3 (R$29, custo R$8)
- Luminaria LED USB Flexivel (R$49, custo R$18)
- Mochila Notebook Impermeavel (R$149, custo R$65)
- Kit Pinceis Maquiagem 12pcs (R$69, custo R$25)
- Garrafa Termica 500ml (R$59, custo R$22)
- Relogio Digital Esportivo (R$99, custo R$40)
- Mouse Sem Fio Ergonomico (R$79, custo R$30)
- Suporte Celular Carro (R$39, custo R$12)
- Hub USB 4 Portas (R$59, custo R$20)
- Capa Kindle/Tablet (R$69, custo R$25)
- Ring Light 10" com Tripe (R$119, custo R$45)
- Teclado Bluetooth Compacto (R$129, custo R$50)
- Pochete Esportiva (R$49, custo R$18)
- Cabo USB-C 2m Reforçado (R$34, custo R$10)
- Caixa de Som Portatil (R$99, custo R$38)
- Power Bank 10000mAh (R$89, custo R$35)
```

Atualizar volume de pedidos (linhas 241-336):
- Today: `randomInt(8, 15)`
- Days 1-7: `randomInt(5, 12)`
- Days 8-30: `randomInt(3, 8)`
- Days 31-90: `randomInt(1, 5)`

Atualizar `expenses` (linhas 85-98) com valores menores e mais realistas para operacao pequena.

Atualizar `adCampaigns` (linhas 114-131) com daily budgets entre R$15-80.

Atualizar textos de notificacoes (linhas 100-111) para refletir os novos valores mais baixos.

A funcao precisa ser redeployada apos as alteracoes.
