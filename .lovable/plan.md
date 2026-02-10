
# Corrigir Dashboard de Ads: Suporte a multiplas plataformas simultaneas

## Problema

Voce tem **ambas** as integracoes conectadas (Meta Ads e TikTok Ads), mas o codigo atual so reconhece uma por vez. Como o TikTok foi adicionado depois, ele "esconde" o Meta Ads em todos os pontos:

- Linha 40: `const integration = metaIntegration || tiktokIntegration` -- so mostra uma
- Linha 108: `tiktokIntegration ? 'TikTok Ads' : 'Meta Ads'` -- TikTok sempre ganha
- Linha 132: `platform={tiktokIntegration ? 'tiktok_ads' : 'meta_ads'}` -- botao Sincronizar so chama TikTok
- Resultado: o Meta Ads (que tem dados) nunca e sincronizado

## Solucao

Transformar o banner e a logica para suportar **todas** as integracoes conectadas ao mesmo tempo.

### 1. `AdsDashboard.tsx`

- Criar lista de integracoes ativas (ex: `[{platform: 'meta_ads', ...}, {platform: 'tiktok_ads', ...}]`)
- Renderizar um `AdsConnectionBanner` **por integracao** conectada (um para Meta, outro para TikTok)
- Platform breakdown: mostrar ambas as plataformas com porcentagem proporcional ao gasto, em vez de forcar 100% para uma so
- Manter a logica de `isConnected` para decidir entre dados reais vs mock

### 2. `AdsConnectionBanner.tsx`

- Receber a integracao especifica e sua plataforma como props (sem mudanca na interface, apenas garantir que cada instancia receba a plataforma correta)
- Cada banner tera seu proprio botao "Sincronizar" chamando a edge function correta

### 3. Resultado esperado

- Dois banners: um para Meta Ads (com "Dados reais") e outro para TikTok Ads (com "Sem dados ainda")
- Botao Sincronizar do Meta chama `sync-meta-ads`, do TikTok chama `sync-tiktok-ads`
- Metricas e campanhas consolidam dados de **ambas** as plataformas
- Filtro por plataforma continua funcionando normalmente
