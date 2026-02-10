

# Botao Sincronizar com suporte a TikTok Ads

## Problema atual

O banner de conexao no Dashboard de Ads ja tem um botao "Sincronizar", mas ele so chama a edge function `sync-meta-ads`. Quando a integracao ativa e do TikTok Ads, o botao precisa chamar `sync-tiktok-ads` em vez disso.

## O que sera feito

### 1. Atualizar `AdsConnectionBanner.tsx`

- Receber a plataforma da integracao ativa (meta_ads ou tiktok_ads) como prop
- Usar `useSyncTikTokAds` quando a plataforma for TikTok
- Usar `useSyncMetaAds` quando for Meta Ads
- Mostrar o nome correto da plataforma no banner (em vez de sempre "Meta Ads")

### 2. Atualizar `AdsDashboard.tsx`

- Passar a informacao de plataforma para o `AdsConnectionBanner`
- Quando nenhuma integracao estiver conectada, mostrar mensagem generica em vez de "Meta Ads nao conectado"

## Detalhes tecnicos

| Arquivo | Alteracao |
|---|---|
| `src/components/ads/AdsConnectionBanner.tsx` | Adicionar prop `platform`, usar o hook de sync correto baseado na plataforma, exibir nome da plataforma dinamicamente |
| `src/components/ads/AdsDashboard.tsx` | Passar prop `platform` com o valor da integracao ativa (`meta_ads` ou `tiktok_ads`) |

O botao "Sincronizar" que ja existe no banner passara a funcionar corretamente para qualquer plataforma conectada (Meta ou TikTok).

