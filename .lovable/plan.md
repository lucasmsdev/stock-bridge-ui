
Contexto (o que está acontecendo de verdade)
- Nos logs do próprio app e nos logs da Edge Function ficou claro que o item do Mercado Livre que você está testando é um anúncio de catálogo:
  - platform_product_id: MLB4193807241
  - Edge logs: catalog_listing: true, catalog_product_id: MLB19516519
- Em anúncio de catálogo, o Mercado Livre bloqueia atualização de imagens (inclui ordem e “imagem principal”). Por isso:
  - A sincronização volta com erro
  - A ordem que você define no UNISTOCK não reflete no Mercado Livre
  - Trocar “imagem principal” (primeira imagem) também não reflete

Do I know what the issue is?
- Sim: é uma limitação/regra do Mercado Livre para anúncios de catálogo (não é mais um bug de upload/regex). O nosso sistema está tentando, mas o ML nega.

Objetivo da mudança
1) Parar de te deixar em “loop de erro” tentando sincronizar algo que o ML não permite.
2) Mostrar uma mensagem direta na tela dizendo “este anúncio é de catálogo, imagens não podem ser alteradas”, com o ID do anúncio.
3) (Opcional) Oferecer uma ação prática: “Republicar/criar novo anúncio” (com aviso de que o ML pode transformar em catálogo de novo dependendo do produto).

Plano de implementação (código)

A) Melhorar o feedback no Front-end (para você ver o motivo exato)
Arquivos:
- src/components/products/ProductImagesGallery.tsx
- src/components/products/MarketplaceImagesCard.tsx (mesma melhoria para consistência)

Mudanças:
1. Ao chamar supabase.functions.invoke('update-product-images'):
   - Capturar { data, error } (não só error)
   - Se error for FunctionsHttpError, ler o body da resposta via error.context (que é um Response) e extrair JSON:
     - Esperado hoje: { error: string, details?: string }
2. Mostrar toast com a mensagem real do backend (ex: “Este anúncio é de catálogo…”) em vez de só “Edge Function returned non-2xx”.
3. Guardar/usar o “details” quando vier 'catalog_listing' para montar uma mensagem bem objetiva.

Resultado esperado:
- Quando falhar, você vê exatamente: “Mercado Livre: anúncio de catálogo — imagens não podem ser alteradas” (sem mensagem genérica).

B) Não tentar sincronizar imagens para anúncios “bloqueados”
Arquivo:
- src/components/products/ProductImagesGallery.tsx

Mudanças:
1. Antes de tentar sincronizar um listing do Mercado Livre:
   - Se listing.sync_error já contém “catálogo” ou “pictures is not modifiable” (ou se o último retorno vier com details='catalog_listing'):
     - Pular a tentativa automaticamente (não chamar a Edge Function de novo)
     - Contabilizar como “skipped/blocked” e mostrar isso no toast final:
       - Ex: “Imagens salvas. 1 marketplace sincronizado, 1 bloqueado (catálogo).”
2. Adicionar um pequeno Alert/Banner no card da Galeria quando existir listing do Mercado Livre com bloqueio:
   - Texto simples:
     - “Mercado Livre bloqueou alteração de imagens porque este anúncio é de catálogo. A ordem e a imagem principal não podem ser alteradas via UNISTOCK.”
   - Mostrar o ID do anúncio (MLB...) para referência.

Resultado esperado:
- Você para de “tentar e falhar” toda vez.
- Fica claro por que não atualiza.

C) Padronizar a resposta do Backend para facilitar o front-end (sem adivinhação por texto)
Arquivo:
- supabase/functions/update-product-images/index.ts

Mudanças:
1. Quando detectar catalog_listing/catalog_product_id:
   - Retornar sempre uma estrutura padronizada, por exemplo:
     - status: 409 (ou 400, mas 409 deixa claro “conflito/regra do recurso”)
     - body: { error: '...', code: 'CATALOG_LOCKED', details: 'catalog_listing', itemId, catalogProductId }
2. Quando vier erro de “pictures is not modifiable” (mesmo sem catalog_listing explícito):
   - Retornar code: 'PICTURES_NOT_MODIFIABLE' e manter details com causas.
3. Ao salvar no product_listings:
   - Se code for CATALOG_LOCKED ou PICTURES_NOT_MODIFIABLE, setar sync_status para algo como:
     - 'restricted' (em vez de 'error')
   - Isso ajuda o front-end a filtrar sem depender de texto.

Obs: sync_status é string no banco, então não exige migration, mas vamos atualizar a UI onde isso apareça para não ficar “invisível”.

D) Ajustes de UI para o novo status “restricted”
Arquivos prováveis:
- src/pages/ProductDetails.tsx (onde você já lista e recarrega listings)
- src/pages/Products.tsx (onde hoje só marca bolinha vermelha quando sync_status === 'error')

Mudanças:
1. Tratar 'restricted' como “bloqueado” (ícone/Badge diferente de erro genérico).
2. Exibir sync_error para restricted como mensagem informativa (não “erro de conexão”).

E) Testes (para confirmar o que dá e o que não dá no ML)
1. Caso catálogo (o seu atual MLB4193807241):
   - Reordenar no UNISTOCK e clicar “Salvar e Sincronizar”
   - Esperado: salva localmente e mostra aviso de bloqueio “catálogo”, sem ficar repetindo tentativa.
2. Caso não-catálogado (outro anúncio que NÃO seja catalog_listing):
   - Reordenar imagens e mudar a principal (primeira)
   - Esperado: Mercado Livre refletir a nova ordem.
3. Verificar logs:
   - Supabase Edge Function logs: update-product-images
   - Confirmar retorno com code/details padronizado

Riscos/limitações (importante e direto)
- Se o anúncio for de catálogo, não existe “correção de código” que force o Mercado Livre a aceitar ordem/imagem principal. O máximo que o UNISTOCK pode fazer é:
  - Identificar automaticamente
  - Parar de insistir
  - Te orientar para alternativa (criar novo anúncio fora do catálogo / editar direto no ML)
- “Republicar” pode ou não resolver, porque o ML pode re-vincular ao catálogo dependendo do produto (EAN/GTIN e regras internas).

Entregáveis (o que vai mudar ao final)
- Você vai ver o motivo real no toast (catálogo/bloqueio), não erro genérico.
- O UNISTOCK vai parar de tentar sincronizar imagens para anúncios bloqueados e vai te avisar claramente.
- Para anúncios normais (não catálogo), a ordem + imagem principal devem refletir no Mercado Livre após o sync.
