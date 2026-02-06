

## Adicionar TikTok Shop e Magalu como "Em breve" nos Marketplaces

### O Que Vai Mudar

Duas novas plataformas serao adicionadas na secao **Marketplaces** da pagina de Integracoes, ambas com o badge "Em breve":

1. **TikTok Shop** - marketplace do TikTok para venda direta
2. **Magalu** - Magazine Luiza marketplace

### Etapas

**1. Salvar as logos no projeto**
- Copiar a imagem do Magalu (image-76.png) para `public/logos/magalu.png`
- Copiar a imagem do TikTok Shop (image-77.png) para `public/logos/tiktok-shop.png`

**2. Adicionar as plataformas no array `marketplaceIntegrations`**

No arquivo `src/pages/Integrations.tsx`, adicionar dois novos itens ao array `marketplaceIntegrations` (apos o Shein):

- **TikTok Shop**: id `tiktokshop`, logo `/logos/tiktok-shop.png`, `comingSoon: true`
- **Magalu**: id `magalu`, logo `/logos/magalu.png`, `comingSoon: true`

**3. Atualizar o `PlatformLogo` component**

No arquivo `src/components/ui/platform-logo.tsx`, adicionar as novas plataformas nos mapeamentos:
- `platformLogos`: adicionar `tiktokshop` e `magalu` com os caminhos das logos
- `platformFallbacks`: adicionar emojis de fallback
- `platformColors`: adicionar cores de fundo para fallback

**4. Ajustar o grid dos marketplaces**

Atualizar o grid de `lg:grid-cols-4` para `lg:grid-cols-4` (manter 4 colunas, as 7 plataformas vao distribuir em 2 linhas naturalmente).

### Resultado
A secao Marketplaces passara a ter 7 plataformas: Mercado Livre, Shopee, Amazon, Shopify, Shein (em breve), TikTok Shop (em breve) e Magalu (em breve).

